/**
 * Import one locale CSV (locale-translation-plan/{xx}.csv) into Site.
 *
 *   node scripts/import-locale-drafts.mjs it [--csv path] [--site path] [--no-register]
 *
 * Writes:
 *   packages/ui/src/components/{name}/{name}.{xx}.json    every component dictionary (EN parity)
 *   packages/lib/server-only/rss/rss-feed.{xx}.json
 *   packages/ui/src/components/header/navigation-data/navigation-labels.{xx}.json
 *   i18n/locales/{xx}.ts                                  static imports for message-catalog
 * Registers the locale (idempotent string edits) in:
 *   i18n/locales/index.ts, navigation-labels.ts, app/global-error.tsx, Build/site-deploy.yaml (QA row)
 *
 * Value per key: "{Language} (revisado)" > "{Language} (borrador IA)" > English. Non-string leaves
 * (numbers, booleans) and keys missing from the CSV (English-only surfaces) keep the English value,
 * so every locale file has full key parity with its English source.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPOS = path.resolve(HERE, "../..");

const args = process.argv.slice(2);
const locale = args.find((a) => !a.startsWith("--"));
if (!locale || !/^[a-z]{2}$/.test(locale)) {
  console.error("usage: node scripts/import-locale-drafts.mjs <locale> [--csv path] [--site path] [--no-register]");
  process.exit(1);
}
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const SITE = path.resolve(opt("--site", path.join(REPOS, "Site")));
const CSV = path.resolve(opt("--csv", path.join(REPOS, "locale-translation-plan", `${locale}.csv`)));
const REGISTER = !args.includes("--no-register");

const LOCALE_UPPER = locale.toUpperCase();
const LOCALE_PASCAL = locale[0].toUpperCase() + locale.slice(1);

const QA_HOSTS = {
  // languages.ts: `${subdomain}.fxstreet.xx` except ar/pt (`qa-ar.fxstreet.com`)
  ar: "https://qa-ar.fxstreet.com",
  pt: "https://qa-pt.fxstreet.com",
};
const PRO_HOSTS = {
  id: "https://www.fxstreet-id.com",
  ar: "https://ar.fxstreet.com",
  de: "https://www.fxstreet.de.com",
  vi: "https://www.fxstreet-vn.com",
  zh: "https://www.fxstreet.hk",
  ru: "https://www.fxstreet.ru.com",
  tr: "https://www.fxstreet.com.tr",
  pt: "https://pt.fxstreet.com",
  it: "https://www.fxstreet.it",
  fr: "https://www.fxstreet.fr",
  hu: "https://www.fxstreet.hu",
  ja: "https://www.fxstreet.jp",
};

// ---------------------------------------------------------------- csv

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

const csvText = readFileSync(CSV, "utf8").replace(/^\uFEFF/, "");
const [header, ...records] = parseCsv(csvText);
const col = (re) => header.findIndex((h) => re.test(h));
const COL = {
  folder: col(/^Carpeta$/i),
  block: col(/^Bloque$/i),
  key: col(/^Clave$/i),
  en: col(/original/i),
  draft: col(/borrador/i),
  reviewed: col(/revisado/i),
};
for (const [name, index] of Object.entries(COL)) {
  if (index === -1) throw new Error(`CSV column not found: ${name} (${header.join(" | ")})`);
}

const normalize = (s) => (s ?? "").replace(/\r\n/g, "\n").trim();

/** folder -> Map(key -> { en, value, source }) */
const byFolder = new Map();
const stats = { reviewed: 0, draft: 0, english: 0 };
for (const r of records) {
  const folder = r[COL.folder];
  const key = r[COL.key];
  if (!folder || !key) continue;
  const en = normalize(r[COL.en]);
  const reviewed = normalize(r[COL.reviewed]);
  const draft = normalize(r[COL.draft]);
  let value;
  let source;
  if (reviewed) {
    value = reviewed;
    source = "reviewed";
  } else if (draft) {
    value = draft;
    source = "draft";
  } else {
    value = en;
    source = "english";
  }
  stats[source]++;
  if (!byFolder.has(folder)) byFolder.set(folder, new Map());
  byFolder.get(folder).set(key, { en, value, source });
}

// ---------------------------------------------------------------- json helpers

function pathParts(keyPath) {
  const parts = [];
  for (const seg of keyPath.split(".")) {
    const m = /^([^[]*)((?:\[\d+\])*)$/.exec(seg);
    if (!m) throw new Error(`bad key path: ${keyPath}`);
    if (m[1]) parts.push(m[1]);
    for (const idx of m[2].matchAll(/\[(\d+)\]/g)) parts.push(Number(idx[1]));
  }
  return parts;
}

function translateTree(en, translations, report) {
  const walk = (node, prefix) => {
    if (Array.isArray(node)) {
      return node.map((v, i) => walk(v, `${prefix}[${i}]`));
    }
    if (node && typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] = walk(v, prefix ? `${prefix}.${k}` : k);
      }
      return out;
    }
    if (typeof node === "string") {
      const hit = translations?.get(prefix);
      if (!hit) {
        report.uncovered.push(prefix);
        return node;
      }
      if (hit.en !== normalize(node)) {
        report.englishDrift.push(prefix);
      }
      return hit.value;
    }
    return node;
  };
  return walk(en, "");
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------- catalog modules (PascalCase <-> path)

const catalogSource = readFileSync(path.join(SITE, "i18n/message-catalog.ts"), "utf8");
const catalogModules = [];
for (const m of catalogSource.matchAll(/^import (\w+)En from '\.\.\/(.+?)\.en\.json';/gm)) {
  catalogModules.push({ pascal: m[1], base: m[2] }); // base e.g. packages/ui/src/components/about-us/about-us
}
if (catalogModules.length === 0) throw new Error("no *.en.json imports found in message-catalog.ts");

const serverOnlyBlock = /const serverOnlyMessageModules[\s\S]*?\{([\s\S]*?)\n\};/.exec(catalogSource);
if (!serverOnlyBlock) throw new Error("serverOnlyMessageModules not found in message-catalog.ts");
const serverOnlyPascals = new Set(
  [...serverOnlyBlock[1].matchAll(/^\s{2}(\w+): \{/gm)].map((x) => x[1]),
);

// ---------------------------------------------------------------- component + rss dictionaries

const report = { uncovered: [], englishDrift: [], files: 0, unknownFolders: [] };
const componentsDir = path.join(SITE, "packages/ui/src/components");
const knownFolders = new Set();

for (const name of readdirSync(componentsDir)) {
  const enFile = path.join(componentsDir, name, `${name}.en.json`);
  if (!existsSync(enFile)) continue;
  knownFolders.add(`componentes/${name}`);
  const local = { uncovered: [], englishDrift: [] };
  const out = translateTree(readJson(enFile), byFolder.get(`componentes/${name}`), local);
  writeJson(path.join(componentsDir, name, `${name}.${locale}.json`), out);
  report.files++;
  report.uncovered.push(...local.uncovered.map((k) => `${name}:${k}`));
  report.englishDrift.push(...local.englishDrift.map((k) => `${name}:${k}`));
}

{
  const rssEn = path.join(SITE, "packages/lib/server-only/rss/rss-feed.en.json");
  const local = { uncovered: [], englishDrift: [] };
  writeJson(
    path.join(SITE, `packages/lib/server-only/rss/rss-feed.${locale}.json`),
    translateTree(readJson(rssEn), byFolder.get("rss"), local),
  );
  knownFolders.add("rss");
  report.files++;
  report.uncovered.push(...local.uncovered.map((k) => `rss:${k}`));
  report.englishDrift.push(...local.englishDrift.map((k) => `rss:${k}`));
}

// ---------------------------------------------------------------- navigation labels

const navDir = path.join(SITE, "packages/ui/src/components/header/navigation-data");
{
  const year = String(new Date().getFullYear());
  const labels = {};
  for (const { en, value, source } of byFolder.get("navegacion")?.values() ?? []) {
    if (!en || source === "english" || value === en) continue;
    labels[en.replaceAll(year, "{year}")] = value.replaceAll(year, "{year}");
  }
  knownFolders.add("navegacion");
  writeJson(
    path.join(navDir, `navigation-labels.${locale}.json`),
    Object.fromEntries(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))),
  );
  report.files++;
  report.navLabels = Object.keys(labels).length;
}

report.unknownFolders = [...byFolder.keys()].filter((f) => !knownFolders.has(f));

// ---------------------------------------------------------------- i18n/locales/{xx}.ts

{
  const lines = [
    `/* Generated by web-scraper-toolkit/scripts/import-locale-drafts.mjs ${locale} — do not edit by hand. */`,
    `import type { LocaleMessageModules } from './index';`,
    "",
  ];
  const components = [];
  const serverOnly = [];
  for (const { pascal, base } of catalogModules) {
    const ident = `${pascal}${LOCALE_PASCAL}`;
    lines.push(`import ${ident} from '../../${base}.${locale}.json';`);
    (serverOnlyPascals.has(pascal) ? serverOnly : components).push(`  ${pascal}: ${ident},`);
  }
  lines.push(
    "",
    `export const ${locale}MessageModules: LocaleMessageModules = {`,
    "  components: {",
    ...components.map((l) => `  ${l}`),
    "  },",
    "  serverOnly: {",
    ...serverOnly.map((l) => `  ${l}`),
    "  },",
    "};",
    "",
  );
  mkdirSync(path.join(SITE, "i18n/locales"), { recursive: true });
  writeFileSync(path.join(SITE, "i18n/locales", `${locale}.ts`), lines.join("\n"), "utf8");
  report.files++;
}

// ---------------------------------------------------------------- registrations

function edit(file, fn) {
  const before = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const after = fn(before);
  if (after !== before) {
    writeFileSync(file, after, "utf8");
    return true;
  }
  return false;
}

function addImportAfterLast(src, importLine, matcher) {
  if (src.includes(importLine)) return src;
  const lines = src.split("\n");
  let last = -1;
  lines.forEach((l, i) => {
    if (matcher.test(l)) last = i;
  });
  if (last === -1) throw new Error(`no anchor import found for: ${importLine}`);
  lines.splice(last + 1, 0, importLine);
  return lines.join("\n");
}

function addMapEntry(src, objectStart, entry) {
  if (src.includes(entry.trim())) return src;
  const i = src.indexOf(objectStart);
  if (i === -1) throw new Error(`object not found: ${objectStart}`);
  const braceEnd = src.indexOf("};", i);
  if (braceEnd === -1) throw new Error(`object end not found: ${objectStart}`);
  const head = src.slice(0, braceEnd).replace(/\s*$/, "");
  return `${head}\n${entry}\n${src.slice(braceEnd)}`;
}

const registered = [];
if (REGISTER) {
  // i18n/locales/index.ts
  if (
    edit(path.join(SITE, "i18n/locales/index.ts"), (src) => {
      let s = src.replace("import type { Language } from '@workspace/utils';", "import { Language } from '@workspace/utils';");
      s = addImportAfterLast(s, `import { ${locale}MessageModules } from './${locale}';`, /^import .* from '(@workspace\/utils|\.\/\w+)';$/);
      s = addMapEntry(
        s,
        "export const localeMessageModules: Partial<Record<Language, LocaleMessageModules>> = {",
        `  [Language.${LOCALE_UPPER}]: ${locale}MessageModules,`,
      );
      return s;
    })
  )
    registered.push("i18n/locales/index.ts");

  // navigation-labels.ts
  if (
    edit(path.join(navDir, "navigation-labels.ts"), (src) => {
      let s = src.replace("import type { Language } from '@workspace/utils';", "import { Language } from '@workspace/utils';");
      s = addImportAfterLast(
        s,
        `import navigationLabels${LOCALE_PASCAL} from './navigation-labels.${locale}.json';`,
        /^import .* from '(@workspace\/utils|\.\/navigation-labels\.\w+\.json)';$/,
      );
      s = addMapEntry(
        s,
        "export const navigationLabelsByLocale: Partial<Record<Language, NavigationLabels>> = {",
        `  [Language.${LOCALE_UPPER}]: navigationLabels${LOCALE_PASCAL},`,
      );
      return s;
    })
  )
    registered.push("navigation-labels.ts");

  // app/global-error.tsx
  if (
    edit(path.join(SITE, "app/global-error.tsx"), (src) => {
      let s = addImportAfterLast(
        src,
        `import ${locale} from '@workspace/ui/components/error-500/error-500.${locale}.json';`,
        /^import \w+ from '@workspace\/ui\/components\/error-500\/error-500\.\w+\.json';$/,
      );
      s = addMapEntry(
        s,
        "const ERROR_MESSAGES: LocaleKeyed<AbstractIntlMessages> = {",
        `  [Language.${LOCALE_UPPER}]: { 'error-500': ${locale} },`,
      );
      return s;
    })
  )
    registered.push("app/global-error.tsx");

  // Build/site-deploy.yaml — QA target only; PRO row is a go-live decision (DNS/gateway/CDN by ops)
  if (
    edit(path.join(SITE, "Build/site-deploy.yaml"), (src) => {
      const label = `label: '${locale}-qa'`;
      if (src.includes(label)) return src;
      const siteUrl = QA_HOSTS[locale] ?? PRO_HOSTS[locale]?.replace("https://www.", "https://qa.");
      if (!siteUrl) throw new Error(`no QA site url known for ${locale}`);
      const row = [
        `      - culture: '${locale}'`,
        `        environment: 'qa'`,
        `        host: 'qa-${locale}-site.fxstreet.com'`,
        `        siteUrl: '${siteUrl}'`,
        `        replicas: 1`,
        `        containerName: 'fxs-site-${locale}-qa'`,
        `        ${label}`,
        "",
      ].join("\n");
      const anchor = "      - culture: 'es'\n        environment: 'pro'";
      const i = src.indexOf(anchor);
      if (i === -1) throw new Error("deploy matrix anchor (es/pro) not found");
      return src.slice(0, i) + row + src.slice(i);
    })
  )
    registered.push("Build/site-deploy.yaml");
}

// ---------------------------------------------------------------- summary

console.log(`[${locale}] csv=${path.relative(REPOS, CSV)} rows=${records.length}`);
console.log(`[${locale}] values: reviewed=${stats.reviewed} draft=${stats.draft} english=${stats.english}`);
console.log(`[${locale}] files written: ${report.files} (nav labels: ${report.navLabels})`);
console.log(`[${locale}] keys kept in English (not in CSV): ${report.uncovered.length}`);
if (report.uncovered.length) console.log("   " + report.uncovered.join("\n   "));
if (report.englishDrift.length) {
  console.log(`[${locale}] WARNING English source drifted since CSV export (${report.englishDrift.length}):`);
  console.log("   " + report.englishDrift.join("\n   "));
}
if (report.unknownFolders.length) {
  console.log(`[${locale}] WARNING CSV folders without target: ${report.unknownFolders.join(", ")}`);
}
if (REGISTER) console.log(`[${locale}] registered in: ${registered.join(", ") || "(already registered)"}`);
