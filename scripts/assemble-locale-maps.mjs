/**
 * Merge partial translation work in locales/_work into {locale}-map.json.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.resolve(HERE, "../../spanish-site-translation-plan/locales/_work");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function saveMap(locale, map) {
  const out = path.join(WORK, `${locale}-map.json`);
  writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  return out;
}

function mergeDictFiles(globPrefix) {
  const map = {};
  const files = readdirSync(WORK)
    .filter((f) => f.startsWith(globPrefix) && f.endsWith(".json"))
    .sort();
  for (const file of files) {
    const data = readJson(path.join(WORK, file));
    if (Array.isArray(data)) continue;
    Object.assign(map, data);
  }
  return map;
}

function mergeArrayParts(prefix) {
  const unique = readJson(path.join(WORK, "en-unique.json"));
  const values = [];
  const files = readdirSync(WORK)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort();
  for (const file of files) {
    values.push(...readJson(path.join(WORK, file)));
  }
  const map = {};
  for (let i = 0; i < Math.min(unique.length, values.length); i++) {
    const v = values[i];
    if (v) map[unique[i]] = v;
  }
  return map;
}

function mergeTripleLang(langIndex, lang) {
  const unique = readJson(path.join(WORK, "en-unique.json"));
  const map = {};
  const partsDir = path.join(WORK, "_parts");
  if (!existsSync(partsDir)) return map;
  for (const file of readdirSync(partsDir).filter((f) => f.startsWith("triple_"))) {
    const data = readJson(path.join(partsDir, file));
    for (const [en, vals] of Object.entries(data)) {
      if (vals?.[langIndex]) map[en] = vals[langIndex];
    }
  }
  for (const file of readdirSync(partsDir).filter((f) => f.startsWith(`${lang}_`))) {
    Object.assign(map, readJson(path.join(partsDir, file)));
  }
  return map;
}

function pairFaqs(lang) {
  const pairs = [
    "AUD/USD", "EUR/GBP", "EUR/USD", "GBP/JPY", "GBP/USD", "NZD/USD",
    "USD/CAD", "USD/INR", "USD/JPY", "BTC/USD", "XAU/USD",
  ];
  const t = {
    id: {
      what: "Apa itu {p}?",
      forecast: "Bagaimana saya dapat memprakirakan nilai tukar {p}?",
      which: "Faktor mana yang memengaruhi nilai tukar {p}?",
      whatf: "Faktor apa yang memengaruhi nilai tukar {p}?",
      cb: "Bagaimana kebijakan bank sentral memengaruhi nilai tukar {p}?",
      trade: "Bagaimana saya dapat men-trade {p}?",
      time: "Kapan waktu terbaik untuk men-trade {p}?",
      ta: "Bagaimana analisis teknikal digunakan dalam trading {p}?",
    },
    ja: {
      what: "{p}とは何ですか？",
      forecast: "{p}の為替レートをどのように予測できますか？",
      which: "{p}の為替レートに影響する要因は何ですか？",
      whatf: "{p}の為替レートに影響する要因は何ですか？",
      cb: "中央銀行の政策は{p}の為替レートにどのように影響しますか？",
      trade: "{p}はどのように取引できますか？",
      time: "{p}を取引する最適な時間帯はいつですか？",
      ta: "{p}の取引でテクニカル分析はどのように使われますか？",
    },
    zh: {
      what: "什麼是{p}？",
      forecast: "我要如何預測{p}匯率？",
      which: "哪些因素會影響{p}匯率？",
      whatf: "哪些因素會影響{p}匯率？",
      cb: "央行政策如何影響{p}匯率？",
      trade: "我要如何交易{p}？",
      time: "交易{p}的最佳時段是什麼？",
      ta: "技術分析如何應用於{p}交易？",
    },
  }[lang];
  const out = {};
  for (const p of pairs) {
    out[`What is ${p}?`] = t.what.replace("{p}", p);
    out[`How can I forecast the ${p} exchange rate?`] = t.forecast.replace("{p}", p);
    out[`Which factors influence the ${p} exchange rate?`] = t.which.replace("{p}", p);
    out[`What factors influence the ${p} exchange rate?`] = t.whatf.replace("{p}", p);
    out[`How do central bank policies influence the ${p} exchange rate?`] = t.cb.replace("{p}", p);
    out[`How can I trade ${p}?`] = t.trade.replace("{p}", p);
    out[`What is the best time to trade ${p}?`] = t.time.replace("{p}", p);
    out[`How is technical analysis used in trading ${p}?`] = t.ta.replace("{p}", p);
  }
  return out;
}

function report(locale, map) {
  const unique = readJson(path.join(WORK, "en-unique.json"));
  const missing = unique.filter((s) => !map[s]);
  console.log(`${locale}: ${Object.keys(map).length}/${unique.length} mapped, missing=${missing.length}`);
}

const unique = readJson(path.join(WORK, "en-unique.json"));

// FR already complete if present
if (existsSync(path.join(WORK, "fr-map.json"))) {
  report("fr", readJson(path.join(WORK, "fr-map.json")));
}

const de = mergeDictFiles("de-part-");
saveMap("de", de);
report("de", de);

const pt = mergeDictFiles("_pt_part_");
saveMap("pt", pt);
report("pt", pt);

const it = mergeArrayParts("_it_v");
saveMap("it", it);
report("it", it);

const vi = mergeArrayParts("vi-part");
saveMap("vi", vi);
report("vi", vi);

for (const [locale, idx] of [
  ["id", 0],
  ["ja", 1],
  ["zh", 2],
]) {
  const map = { ...mergeTripleLang(idx, locale), ...pairFaqs(locale) };
  saveMap(locale, map);
  report(locale, map);
}

// ar/ru/tr only have keep-exact stubs unless expanded later
for (const locale of ["ar", "ru", "tr"]) {
  const file = path.join(WORK, `${locale}-map.json`);
  if (existsSync(file)) report(locale, readJson(file));
}

console.log(`\nUnique EN strings: ${unique.length}`);
