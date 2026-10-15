#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  WebScraper,
  isValidUrl,
  formatResult,
  crawlDualFxstreet,
  mergePagesByPath,
  mergedPathsToCsvRows,
  formatMergedCsv,
  crawlFxstreetEs,
  crawlFxstreetSite,
  formatFxstreetEsPagesCsv,
  formatFxstreetEsBrokenCsv,
  formatFxstreetSitePagesCsv,
  formatFxstreetSiteBrokenCsv,
  compareOrigins,
  formatOriginCompareCsv,
  FXSTREET_LOCALE_ORIGINS,
  getFxstreetLocaleOrigin,
  mergeLocaleCompare,
  pagesToCrawlResult,
  parseFxstreetPagesCsv,
  parseFxstreetBrokenCsv,
  formatLocaleCompareCsv,
  formatCompareSummaryMarkdown,
  collapsePathsToPatterns,
  formatListingPatternsCsv,
  fetchLocaleHeaderMenus,
  formatHeaderMenusCsv,
  formatHeaderMatrixCsv,
  formatHeaderSummaryMarkdown,
  generateTranslationKeys,
  formatTranslationKeyCsv,
  formatDiscardedKeyCsv,
  formatFxstreetRelinkCsv,
  parseFxstreetRelinkCsv,
  resolveSiteRoot,
} from "@operezol/scraper-shared";
import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";

const program = new Command();
const scraper = new WebScraper();

program
  .name("scraper")
  .description("Professional web scraping CLI tool")
  .version("1.0.0");

program
  .command("scrape")
  .description("Scrape a single URL")
  .argument("<url>", "URL to scrape")
  .option("-s, --selector <selector>", "CSS selector to extract")
  .option("-t, --timeout <ms>", "Request timeout in milliseconds", "10000")
  .option("-o, --output <file>", "Output file (JSON)")
  .action(async (url, options) => {
    if (!isValidUrl(url)) {
      console.error(chalk.red("❌ Invalid URL"));
      process.exit(1);
    }

    const spinner = ora("Scraping...").start();

    try {
      const result = await scraper.scrape({
        url,
        selector: options.selector,
        timeout: parseInt(options.timeout),
      });

      spinner.succeed(chalk.green("✓ Scraping completed"));

      if ("error" in result) {
        console.error(chalk.red(`Error: ${result.error}`));
      } else {
        console.log(chalk.cyan("\nResults:"));
        console.log(formatResult(result));

        if (options.output) {
          const fs = await import("fs/promises");
          await fs.writeFile(options.output, JSON.stringify(result, null, 2));
          console.log(chalk.green(`\n✓ Saved to ${options.output}`));
        }
      }
    } catch (error) {
      spinner.fail(chalk.red("✗ Scraping failed"));
      console.error(error);
      process.exit(1);
    }
  });

program
  .command("batch")
  .description("Scrape multiple URLs from a file")
  .argument("<file>", "File containing URLs (one per line)")
  .option("-s, --selector <selector>", "CSS selector to extract")
  .option("-o, --output <file>", "Output file (JSON)")
  .action(async (file, options) => {
    const spinner = ora("Reading URLs...").start();

    try {
      const fs = await import("fs/promises");
      const content = await fs.readFile(file, "utf-8");
      const urls = content.split("\n").filter((line) => line.trim());

      spinner.text = `Scraping ${urls.length} URLs...`;

      const results = await scraper.scrapeMultiple(urls, options.selector);

      spinner.succeed(chalk.green(`✓ Scraped ${urls.length} URLs`));

      console.log(chalk.cyan("\nResults:"));
      console.log(formatResult(results));

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(results, null, 2));
        console.log(chalk.green(`\n✓ Saved to ${options.output}`));
      }
    } catch (error) {
      spinner.fail(chalk.red("✗ Batch scraping failed"));
      console.error(error);
      process.exit(1);
    }
  });

program
  .command("links")
  .description("Extract internal links from a URL and export to CSV")
  .argument("<url>", "URL to extract links from")
  .option("-o, --output <file>", "Output CSV file", "links.csv")
  .action(async (url, options) => {
    if (!isValidUrl(url)) {
      console.error(chalk.red("❌ Invalid URL"));
      process.exit(1);
    }

    const spinner = ora("Extracting internal links...").start();

    try {
      const links = await scraper.extractInternalLinks(url);

      spinner.succeed(chalk.green(`✓ Found ${links.length} internal links`));

      console.log(
        chalk.cyan(
          `\nExtracted ${links.length} internal links (sorted alphabetically)`,
        ),
      );

      const fs = await import("fs/promises");
      const csvContent = "URL\n" + links.join("\n");
      await fs.writeFile(options.output, csvContent, "utf-8");

      console.log(chalk.green(`\n✓ Saved to ${options.output}`));
      console.log(chalk.gray(`\nFirst 10 links:`));
      links
        .slice(0, 10)
        .forEach((link) => console.log(chalk.gray(`  - ${link}`)));
      if (links.length > 10) {
        console.log(chalk.gray(`  ... and ${links.length - 10} more`));
      }
    } catch (error) {
      spinner.fail(chalk.red("✗ Failed to extract links"));
      console.error(
        chalk.red(error instanceof Error ? error.message : "Unknown error"),
      );
      process.exit(1);
    }
  });

program
  .command("crawl")
  .description(
    "Recursively crawl a website (filters on by default: strip query/hash)",
  )
  .argument("<url>", "Starting URL to crawl from")
  .option("-o, --output <file>", "Output CSV file", "crawl-links.csv")
  .option(
    "-m, --max-pages <number>",
    "Max pages to visit (omit = no limit)",
  )
  .option("-d, --delay <ms>", "Delay between requests in ms", "500")
  .option("--keep-query", "Keep query string in URL identity")
  .option("--keep-hash", "Keep hash in URL identity")
  .option(
    "--checkpoint-every <n>",
    "Write partial CSV every N pages (opt-in)",
  )
  .action(async (url, options) => {
    if (!isValidUrl(url)) {
      console.error(chalk.red("❌ Invalid URL"));
      process.exit(1);
    }

    const maxPages =
      options.maxPages !== undefined
        ? parseInt(options.maxPages as string, 10)
        : undefined;
    const delayMs = parseInt(options.delay as string, 10);
    const checkpointEvery =
      options.checkpointEvery !== undefined
        ? parseInt(options.checkpointEvery as string, 10)
        : undefined;

    const spinner = ora("Starting crawl...").start();
    const fs = await import("fs/promises");
    const outFile = options.output as string;
    const partialFile = outFile.replace(/(\.\w+)?$/, ".partial$1");

    try {
      const links = await scraper.crawlInternalLinks(url, {
        maxPages,
        delayMs,
        keepQuery: Boolean(options.keepQuery),
        keepHash: Boolean(options.keepHash),
        excludeArticles: false,
        checkpointEvery,
        onCheckpoint: async ({ pages }) => {
          const csvContent =
            "URL,found_on\n" +
            pages.map((p) => `${p.url},${p.foundOn}`).join("\n");
          await fs.writeFile(partialFile, csvContent, "utf-8");
          spinner.text = chalk.yellow(
            `Checkpoint ${pages.length} → ${partialFile}`,
          );
        },
        onProgress: ({ visited, queueSize, currentUrl }) => {
          const cap = maxPages !== undefined ? `/${maxPages}` : "";
          spinner.text = chalk.cyan(
            `Crawling... Visited: ${visited}${cap} | Queue: ${queueSize} | ${currentUrl.substring(0, 60)}...`,
          );
        },
      });

      spinner.succeed(
        chalk.green(
          `✓ Crawl completed! Found ${links.length} unique internal links`,
        ),
      );

      const csvContent = "URL\n" + links.join("\n");
      await fs.writeFile(outFile, csvContent, "utf-8");
      try {
        await fs.unlink(partialFile);
      } catch {
        /* no partial */
      }

      console.log(chalk.green(`\n✓ Saved to ${outFile}`));
      console.log(chalk.cyan(`\nTotal unique links found: ${links.length}`));
      console.log(chalk.gray(`\nFirst 10 links:`));
      links
        .slice(0, 10)
        .forEach((link) => console.log(chalk.gray(`  - ${link}`)));
      if (links.length > 10) {
        console.log(chalk.gray(`  ... and ${links.length - 10} more`));
      }
    } catch (error) {
      spinner.fail(chalk.red("✗ Crawl failed"));
      console.error(
        chalk.red(error instanceof Error ? error.message : "Unknown error"),
      );
      process.exit(1);
    }
  });

program
  .command("fxstreet-es")
  .description(
    "Crawl www.fxstreet.es with FXStreet preset (article filters + Next/Sitefinity)",
  )
  .option("--url <url>", "Start URL", "https://www.fxstreet.es/")
  .option("-o, --output <file>", "Output CSV", "fxstreet-es-pages.csv")
  .option("-m, --max-pages <number>", "Max pages (omit = no limit)")
  .option("-d, --delay <ms>", "Delay between requests in ms", "400")
  .option("--keep-query", "Keep query string in URL identity")
  .option("--keep-hash", "Keep hash in URL identity")
  .option("--keep-articles", "Do not exclude news/analysis article slugs")
  .option(
    "--checkpoint-every <n>",
    "Write partial CSV every N pages (opt-in)",
  )
  .action(async (options) => {
    const startUrl = options.url as string;
    if (!isValidUrl(startUrl)) {
      console.error(chalk.red("❌ Invalid --url"));
      process.exit(1);
    }

    const maxPages =
      options.maxPages !== undefined
        ? parseInt(options.maxPages as string, 10)
        : undefined;
    const delayMs = parseInt(options.delay as string, 10);
    const checkpointEvery =
      options.checkpointEvery !== undefined
        ? parseInt(options.checkpointEvery as string, 10)
        : undefined;

    const spinner = ora(
      "Crawling www.fxstreet.es (accessible pages only)...",
    ).start();
    const fs = await import("fs/promises");
    const outFile = options.output as string;
    const brokenFile = outFile.replace(/(\.\w+)?$/, ".broken$1");
    const partialFile = outFile.replace(/(\.\w+)?$/, ".partial$1");
    const brokenPartialFile = brokenFile.replace(/(\.\w+)?$/, ".partial$1");

    try {
      const { pages, broken } = await crawlFxstreetEs({
        startUrl,
        maxPages,
        delayMs,
        keepQuery: Boolean(options.keepQuery),
        keepHash: Boolean(options.keepHash),
        excludeArticles: !options.keepArticles,
        checkpointEvery,
        onCheckpoint: async (partial) => {
          await fs.writeFile(
            partialFile,
            formatFxstreetEsPagesCsv(partial.pages),
            "utf-8",
          );
          await fs.writeFile(
            brokenPartialFile,
            formatFxstreetEsBrokenCsv(partial.broken),
            "utf-8",
          );
          spinner.text = chalk.yellow(
            `Checkpoint ${partial.pages.length} ok / ${partial.broken.length} broken → ${partialFile}`,
          );
        },
        onProgress: ({ visited, queueSize, currentUrl }) => {
          const cap = maxPages !== undefined ? `/${maxPages}` : "";
          spinner.text = chalk.cyan(
            `Visited ${visited}${cap} | Queue ${queueSize} | ${currentUrl.slice(0, 72)}…`,
          );
        },
      });

      const csv = formatFxstreetEsPagesCsv(pages);
      await fs.writeFile(outFile, csv, "utf-8");
      await fs.writeFile(
        brokenFile,
        formatFxstreetEsBrokenCsv(broken),
        "utf-8",
      );
      for (const extra of [partialFile, brokenPartialFile]) {
        try {
          await fs.unlink(extra);
        } catch {
          /* no partial */
        }
      }

      spinner.succeed(
        chalk.green(
          `✓ Done. ${pages.length} accessible → ${outFile} · ${broken.length} broken → ${brokenFile}`,
        ),
      );

      const byEnv = pages.reduce(
        (acc, p) => {
          acc[p.environment] = (acc[p.environment] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      console.log(chalk.cyan("\nEnvironment counts (accessible):"));
      for (const [env, count] of Object.entries(byEnv).sort()) {
        console.log(chalk.gray(`  ${env}: ${count}`));
      }

      console.log(chalk.gray("\nFirst 10 accessible paths:"));
      [...pages]
        .sort((a, b) => a.normalizedPath.localeCompare(b.normalizedPath, "es"))
        .slice(0, 10)
        .forEach((p) =>
          console.log(
            chalk.gray(
              `  ${p.normalizedPath}  [${p.environment}]  found_on=${p.foundOn || "(start)"}`,
            ),
          ),
        );
      if (pages.length > 10) {
        console.log(chalk.gray(`  … and ${pages.length - 10} more`));
      }
    } catch (error) {
      spinner.fail(chalk.red("✗ Crawl failed"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    }
  });

async function runFxstreetLocaleInventory(options: {
  startUrl: string;
  outFile: string;
  maxPages?: number;
  delayMs: number;
  keepQuery?: boolean;
  keepHash?: boolean;
  keepArticles?: boolean;
  seedPaths?: string[];
  useSitemap?: boolean;
  useBrowser?: boolean;
  checkpointEvery?: number;
  onProgress?: (p: {
    visited: number;
    queueSize: number;
    currentUrl: string;
  }) => void;
}) {
  const outFile = options.outFile;
  const brokenFile = outFile.replace(/(\.\w+)?$/, ".broken$1");
  const partialFile = outFile.replace(/(\.\w+)?$/, ".partial$1");
  const brokenPartialFile = brokenFile.replace(/(\.\w+)?$/, ".partial$1");

  const { pages, broken, relink } = await crawlFxstreetSite({
    startUrl: options.startUrl,
    maxPages: options.maxPages,
    delayMs: options.delayMs,
    keepQuery: Boolean(options.keepQuery),
    keepHash: Boolean(options.keepHash),
    excludeArticles: !options.keepArticles,
    seedPaths: options.seedPaths,
    useSitemap: options.useSitemap,
    useBrowser: options.useBrowser,
    checkpointEvery: options.checkpointEvery,
    onCheckpoint: async (partial) => {
      await writeFile(partialFile, formatFxstreetSitePagesCsv(partial.pages), "utf-8");
      await writeFile(
        brokenPartialFile,
        formatFxstreetSiteBrokenCsv(partial.broken),
        "utf-8",
      );
    },
    onProgress: options.onProgress,
  });

  await mkdir(path.dirname(path.resolve(outFile)), { recursive: true });
  await writeFile(outFile, formatFxstreetSitePagesCsv(pages), "utf-8");
  await writeFile(brokenFile, formatFxstreetSiteBrokenCsv(broken), "utf-8");
  const relinkFile = outFile.replace(/(\.\w+)?$/, ".relink$1");
  await writeFile(relinkFile, formatFxstreetRelinkCsv(relink), "utf-8");
  const patternsFile = outFile.replace(/(\.\w+)?$/, ".patterns$1");
  await writeFile(
    patternsFile,
    formatListingPatternsCsv(
      collapsePathsToPatterns(pages.map((p) => p.normalizedPath)),
    ),
    "utf-8",
  );
  for (const extra of [partialFile, brokenPartialFile]) {
    try {
      await unlink(extra);
    } catch {
      /* no partial */
    }
  }

  return { pages, broken, relink, outFile, brokenFile, relinkFile, patternsFile };
}

function printInventoryPreview(
  pages: { normalizedPath: string; environment: string; foundOn: string }[],
) {
  const byEnv = pages.reduce(
    (acc, p) => {
      acc[p.environment] = (acc[p.environment] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log(chalk.cyan("\nEnvironment counts (accessible):"));
  for (const [env, count] of Object.entries(byEnv).sort()) {
    console.log(chalk.gray(`  ${env}: ${count}`));
  }
  console.log(chalk.gray("\nFirst 10 accessible paths:"));
  [...pages]
    .sort((a, b) => a.normalizedPath.localeCompare(b.normalizedPath))
    .slice(0, 10)
    .forEach((p) =>
      console.log(
        chalk.gray(
          `  ${p.normalizedPath}  [${p.environment}]  found_on=${p.foundOn || "(start)"}`,
        ),
      ),
    );
  if (pages.length > 10) {
    console.log(chalk.gray(`  … and ${pages.length - 10} more`));
  }
}

program
  .command("fxstreet-locale")
  .description(
    "Crawl one FXStreet TLD with the inventory preset (2xx + broken + article filters)",
  )
  .option("--locale <code>", "Catalog locale (en, es, it, fr, de, pt, …)")
  .option("--url <url>", "Start URL (overrides --locale)")
  .option("-o, --output <file>", "Output CSV")
  .option("-m, --max-pages <number>", "Max pages (omit = no limit)")
  .option("-d, --delay <ms>", "Delay between requests in ms", "400")
  .option("--keep-query", "Keep query string in URL identity")
  .option("--keep-hash", "Keep hash in URL identity")
  .option("--keep-articles", "Do not exclude article slugs")
  .option("--no-browser", "Do not render JS / open React menus")
  .option("--no-sitemap", "Do not seed from {tld}/sitemap.xml")
  .option("--checkpoint-every <n>", "Write partial CSV every N pages")
  .action(async (options) => {
    let startUrl = options.url as string | undefined;
    let locale = options.locale as string | undefined;
    if (!startUrl && locale) {
      startUrl = getFxstreetLocaleOrigin(locale).startUrl;
    }
    if (!startUrl) {
      console.error(chalk.red("❌ Pass --locale or --url"));
      process.exit(1);
    }
    if (!isValidUrl(startUrl)) {
      console.error(chalk.red("❌ Invalid start URL"));
      process.exit(1);
    }
    if (!locale) {
      locale =
        FXSTREET_LOCALE_ORIGINS.find((o) => o.startUrl === startUrl)?.locale ??
        "xx";
    }
    const outFile =
      (options.output as string | undefined) ?? `fxstreet-${locale}-pages.csv`;
    const maxPages =
      options.maxPages !== undefined
        ? parseInt(options.maxPages as string, 10)
        : undefined;
    const delayMs = parseInt(options.delay as string, 10);
    const checkpointEvery =
      options.checkpointEvery !== undefined
        ? parseInt(options.checkpointEvery as string, 10)
        : undefined;

    const spinner = ora(`Crawling ${startUrl}…`).start();
    try {
      const result = await runFxstreetLocaleInventory({
        startUrl,
        outFile,
        maxPages,
        delayMs,
        keepQuery: Boolean(options.keepQuery),
        keepHash: Boolean(options.keepHash),
        keepArticles: Boolean(options.keepArticles),
        useBrowser: options.browser !== false,
        useSitemap: options.sitemap !== false,
        checkpointEvery,
        onProgress: ({ visited, queueSize, currentUrl }) => {
          const cap = maxPages !== undefined ? `/${maxPages}` : "";
          spinner.text = chalk.cyan(
            `${locale} ${visited}${cap} | q ${queueSize} | ${currentUrl.slice(0, 72)}…`,
          );
        },
      });
      spinner.succeed(
        chalk.green(
          `✓ ${locale}: ${result.pages.length} accessible → ${result.outFile} · ${result.broken.length} broken → ${result.brokenFile}`,
        ),
      );
      printInventoryPreview(result.pages);
    } catch (error) {
      spinner.fail(chalk.red("✗ Crawl failed"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    }
  });

program
  .command("fxstreet-headers")
  .description(
    "Fetch home HTML only and dump desktop header menu links per locale",
  )
  .option(
    "--locales <codes>",
    "Comma or space separated locale codes",
    "en,es,it,fr,de,pt",
  )
  .option(
    "--out-dir <dir>",
    "Output directory",
    "crawls/latest",
  )
  .option("-d, --delay <ms>", "Delay between homes in ms", "250")
  .action(async (options) => {
    const locales = String(options.locales)
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const outDir = options.outDir as string;
    const delayMs = parseInt(options.delay as string, 10);
    const spinner = ora("Fetching header menus…").start();
    try {
      const menus = await fetchLocaleHeaderMenus(locales, {
        delayMs,
        onProgress: (locale, n) => {
          spinner.text = chalk.cyan(`${locale}: ${n} header links`);
        },
      });
      await mkdir(outDir, { recursive: true });
      await writeFile(
        path.join(outDir, "headers.csv"),
        formatHeaderMenusCsv(menus),
        "utf-8",
      );
      await writeFile(
        path.join(outDir, "headers-matrix.csv"),
        formatHeaderMatrixCsv(menus),
        "utf-8",
      );
      await writeFile(
        path.join(outDir, "headers.md"),
        formatHeaderSummaryMarkdown(menus),
        "utf-8",
      );
      spinner.succeed(chalk.green(`✓ Header menus → ${outDir}`));
      for (const menu of menus) {
        console.log(
          chalk.gray(
            `  ${menu.locale}: ${menu.links.length}  ${menu.links
              .map((l) => l.path)
              .slice(0, 8)
              .join(" ")}`,
          ),
        );
      }
    } catch (error) {
      spinner.fail(chalk.red("✗ Header fetch failed"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    }
  });

program
  .command("fxstreet-translation-keys")
  .description(
    "One translation CSV per locale (not ES-style lots). Includes EN-bounce relinks.",
  )
  .requiredOption("--locale <code>", "Target locale (it, fr, de, pt, …). Not en.")
  .option("--pages <file>", "Inventory pages CSV (default: {locale}-pages.csv)")
  .option("--relink <file>", "Relink CSV from crawl (default: sibling .relink)")
  .option(
    "--full-catalog",
    "Include every non-EN-only key without filtering by locale pages",
  )
  .option("--site <dir>", "Site repo root")
  .option("-o, --output <file>", "Single keys CSV (default: {locale}-keys.csv)")
  .action(async (options) => {
    const locale = String(options.locale).toLowerCase();
    if (locale === "en") {
      console.error(chalk.red("❌ EN is the source language — no translation CSV."));
      process.exit(1);
    }
    const fullCatalog = Boolean(options.fullCatalog);
    const pagesFile = fullCatalog
      ? undefined
      : ((options.pages as string | undefined) ?? `${locale}-pages.csv`);
    const outFile =
      (options.output as string | undefined) ?? `${locale}-keys.csv`;
    const discardedFile = outFile.replace(/(\.\w+)?$/, ".discarded$1");
    try {
      const siteRoot = resolveSiteRoot(options.site as string | undefined);
      const pages = pagesFile
        ? parseFxstreetPagesCsv(await readFile(pagesFile, "utf-8"))
        : [];
      const livePaths = pages
        .filter((p) => p.httpStatus >= 200 && p.httpStatus < 300)
        .map((p) => p.normalizedPath);
      const relinkFile =
        (options.relink as string | undefined) ??
        pagesFile?.replace(/(\.\w+)?$/, ".relink$1");
      const relink = relinkFile
        ? parseFxstreetRelinkCsv(
            await readFile(relinkFile, "utf-8").catch(() => ""),
          )
        : [];
      const keys = generateTranslationKeys({
        locale,
        inventoryPaths: livePaths,
        relinkPaths: relink.map((r) => r.normalizedPath),
        siteRoot,
        fullCatalog,
      });
      const localeName =
        FXSTREET_LOCALE_ORIGINS.find((o) => o.locale === locale)?.name ?? locale;
      await mkdir(path.dirname(path.resolve(outFile)), { recursive: true });
      await writeFile(
        outFile,
        formatTranslationKeyCsv(keys.included, localeName, {
          includePages: !fullCatalog,
        }),
        "utf-8",
      );
      if (!fullCatalog) {
        await writeFile(
          discardedFile,
          formatDiscardedKeyCsv(keys.discarded),
          "utf-8",
        );
      }
      console.log(
        chalk.green(
          `✓ ${locale}: 1 CSV de traducción → ${outFile} (${keys.included.length} claves)`,
        ),
      );
      console.log(
        chalk.gray(
          `  2xx=${livePaths.length} · relink-EN=${relink.length} · fuera de alcance (solo eng)=${keys.discarded.length}`,
        ),
      );
    } catch (error) {
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    }
  });

program
  .command("compare-crawls")
  .description(
    "Offline compare of two inventory CSVs (locale vs EN). No network.",
  )
  .requiredOption("--locale-csv <file>", "Locale pages CSV")
  .requiredOption("--en-csv <file>", "English pages CSV")
  .option("--locale-broken <file>", "Locale broken CSV (default: sibling .broken)")
  .option("--en-broken <file>", "EN broken CSV (default: sibling .broken)")
  .option("-o, --output <file>", "Compare CSV", "locale-vs-en.csv")
  .option("--locale <code>", "Locale label for the markdown summary", "xx")
  .option("--summary <file>", "Markdown summary path")
  .action(async (options) => {
    const localeCsv = options.localeCsv as string;
    const enCsv = options.enCsv as string;
    const localeBrokenPath =
      (options.localeBroken as string | undefined) ??
      localeCsv.replace(/(\.\w+)?$/, ".broken$1");
    const enBrokenPath =
      (options.enBroken as string | undefined) ??
      enCsv.replace(/(\.\w+)?$/, ".broken$1");

    const readOptional = async (file: string) => {
      try {
        return await readFile(file, "utf-8");
      } catch {
        return "";
      }
    };

    try {
      const localePages = parseFxstreetPagesCsv(await readFile(localeCsv, "utf-8"));
      const enPages = parseFxstreetPagesCsv(await readFile(enCsv, "utf-8"));
      const localeBroken = parseFxstreetBrokenCsv(await readOptional(localeBrokenPath));
      const enBroken = parseFxstreetBrokenCsv(await readOptional(enBrokenPath));
      const result = mergeLocaleCompare(
        pagesToCrawlResult(localePages, localeBroken),
        pagesToCrawlResult(enPages, enBroken),
      );
      const outFile = options.output as string;
      await mkdir(path.dirname(path.resolve(outFile)), { recursive: true });
      await writeFile(outFile, formatLocaleCompareCsv(result.rows), "utf-8");

      const summaryPath =
        (options.summary as string | undefined) ??
        outFile.replace(/(\.\w+)?$/, ".md");
      await writeFile(
        summaryPath,
        formatCompareSummaryMarkdown({
          locale: options.locale as string,
          localePages: localePages.length,
          enPages: enPages.length,
          localeBroken: localeBroken.length,
          enBroken: enBroken.length,
          result,
        }),
        "utf-8",
      );

      console.log(
        chalk.green(
          `✓ ${result.rows.length} path keys → ${outFile}\n  summary → ${summaryPath}`,
        ),
      );
      console.log(chalk.cyan("\nMatch types:"));
      for (const [k, n] of Object.entries(result.byType).sort()) {
        console.log(chalk.gray(`  ${k}: ${n}`));
      }
      if (result.inferredAliases.length) {
        console.log(chalk.cyan("\nAliases:"));
        for (const a of result.inferredAliases) {
          if (a.source === "known" && a.sharedTails === 0) continue;
          console.log(
            chalk.gray(
              `  ${a.localeSegment} → ${a.enSegment} (${a.source}, ${a.sharedTails} tails)`,
            ),
          );
        }
      }
    } catch (error) {
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    }
  });

program
  .command("fxstreet-batch")
  .description(
    "Crawl several FXStreet locales sequentially, then compare each vs EN",
  )
  .option(
    "--locales <codes>",
    "Comma-separated locale codes",
    "en,es,it,fr,de,pt",
  )
  .option(
    "--out-dir <dir>",
    "Output directory",
    "crawls/latest",
  )
  .option("-m, --max-pages <number>", "Max pages per locale")
  .option("-d, --delay <ms>", "Delay between requests in ms", "250")
  .option("--checkpoint-every <n>", "Partial flush every N pages", "25")
  .option("--keep-articles", "Do not exclude article slugs")
  .option("--no-browser", "Do not render JS / open React menus")
  .option("--no-sitemap", "Do not seed from {tld}/sitemap.xml")
  .option(
    "--seed-en-hubs",
    "Also probe EN inventory paths on each locale (not default; invents unlinked URLs)",
  )
  .option(
    "--with-keys",
    "After inventory, emit per-locale translation-key CSVs from Site i18n (skips EN)",
  )
  .option("--site <dir>", "Site repo root (for --with-keys)")
  .action(async (options) => {
    const locales = String(options.locales)
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const outDir = options.outDir as string;
    const maxPages =
      options.maxPages !== undefined
        ? parseInt(options.maxPages as string, 10)
        : undefined;
    const delayMs = parseInt(options.delay as string, 10);
    const checkpointEvery =
      options.checkpointEvery !== undefined
        ? parseInt(options.checkpointEvery as string, 10)
        : undefined;

    await mkdir(outDir, { recursive: true });
    const crawled: Record<
      string,
      { pages: number; broken: number; csv: string; patterns?: string }
    > = {};
    let extraSeedPaths: string[] = [];
    const seedEnHubs = Boolean(options.seedEnHubs);

    for (const locale of locales) {
      const origin = getFxstreetLocaleOrigin(locale);
      const outFile = path.join(outDir, `${locale}-pages.csv`);
      const spinner = ora(`Crawling ${locale} ${origin.startUrl}…`).start();
      try {
        const result = await runFxstreetLocaleInventory({
          startUrl: origin.startUrl,
          outFile,
          maxPages,
          delayMs,
          keepArticles: Boolean(options.keepArticles),
          useBrowser: options.browser !== false,
          useSitemap: options.sitemap !== false,
          seedPaths:
            seedEnHubs && extraSeedPaths.length ? extraSeedPaths : undefined,
          checkpointEvery,
          onProgress: ({ visited, queueSize, currentUrl }) => {
            const cap = maxPages !== undefined ? `/${maxPages}` : "";
            spinner.text = chalk.cyan(
              `${locale} ${visited}${cap} | q ${queueSize} | ${currentUrl.slice(0, 64)}…`,
            );
          },
        });
        crawled[locale] = {
          pages: result.pages.length,
          broken: result.broken.length,
          csv: result.outFile,
          patterns: result.patternsFile,
        };
        if (seedEnHubs && locale === "en") {
          extraSeedPaths = [
            ...new Set(result.pages.map((p) => p.normalizedPath)),
          ];
        }
        spinner.succeed(
          chalk.green(
            `✓ ${locale}: ${result.pages.length} ok / ${result.broken.length} broken`,
          ),
        );
      } catch (error) {
        spinner.fail(chalk.red(`✗ ${locale} failed`));
        console.error(
          chalk.red(error instanceof Error ? error.message : String(error)),
        );
        process.exit(1);
      }
    }

    const enCsv = crawled.en?.csv;
    if (enCsv) {
      for (const locale of locales.filter((l) => l !== "en")) {
        const localeCsv = crawled[locale]?.csv;
        if (!localeCsv) continue;
        const compareFile = path.join(outDir, `compare-${locale}-vs-en.csv`);
        const localePages = parseFxstreetPagesCsv(await readFile(localeCsv, "utf-8"));
        const enPages = parseFxstreetPagesCsv(await readFile(enCsv, "utf-8"));
        const localeBroken = parseFxstreetBrokenCsv(
          await readFile(localeCsv.replace(/(\.\w+)?$/, ".broken$1"), "utf-8").catch(
            () => "",
          ),
        );
        const enBroken = parseFxstreetBrokenCsv(
          await readFile(enCsv.replace(/(\.\w+)?$/, ".broken$1"), "utf-8").catch(
            () => "",
          ),
        );
        const result = mergeLocaleCompare(
          pagesToCrawlResult(localePages, localeBroken),
          pagesToCrawlResult(enPages, enBroken),
        );
        await writeFile(compareFile, formatLocaleCompareCsv(result.rows), "utf-8");
        const summaryFile = path.join(outDir, `compare-${locale}-vs-en.md`);
        await writeFile(
          summaryFile,
          formatCompareSummaryMarkdown({
            locale,
            localePages: localePages.length,
            enPages: enPages.length,
            localeBroken: localeBroken.length,
            enBroken: enBroken.length,
            result,
          }),
          "utf-8",
        );
        console.log(
          chalk.green(
            `✓ compare ${locale} vs en → ${compareFile} (${result.rows.length} keys)`,
          ),
        );
      }
    }

    if (Boolean(options.withKeys)) {
      const siteRoot = resolveSiteRoot(options.site as string | undefined);
      for (const locale of locales.filter((l) => l !== "en")) {
        const localeCsv = crawled[locale]?.csv;
        if (!localeCsv) continue;
        const pages = parseFxstreetPagesCsv(await readFile(localeCsv, "utf-8"));
        const livePaths = pages
          .filter((p) => p.httpStatus >= 200 && p.httpStatus < 300)
          .map((p) => p.normalizedPath);
        const relink = parseFxstreetRelinkCsv(
          await readFile(localeCsv.replace(/(\.\w+)?$/, ".relink$1"), "utf-8").catch(
            () => "",
          ),
        );
        const keys = generateTranslationKeys({
          locale,
          inventoryPaths: livePaths,
          relinkPaths: relink.map((r) => r.normalizedPath),
          siteRoot,
        });
        const localeName =
          FXSTREET_LOCALE_ORIGINS.find((o) => o.locale === locale)?.name ??
          locale;
        const keysFile = path.join(outDir, `${locale}-keys.csv`);
        await writeFile(
          keysFile,
          formatTranslationKeyCsv(keys.included, localeName),
          "utf-8",
        );
        console.log(
          chalk.green(
            `✓ ${locale}: 1 CSV de traducción → ${keysFile} (${keys.included.length} claves)`,
          ),
        );
      }
    }

    const overview = [
      "# FXStreet locale inventory batch",
      "",
      `| locale | 2xx | broken | csv |`,
      `|--------|-----|--------|-----|`,
      ...locales.map((l) => {
        const row = crawled[l];
        return `| ${l} | ${row?.pages ?? "—"} | ${row?.broken ?? "—"} | \`${row?.csv ?? ""}\` |`;
      }),
      "",
      "Compares: `compare-{locale}-vs-en.md` in this folder.",
      "Traducción PO: **un CSV por idioma** `{locale}-keys.csv` (no lotes 01–06).",
      "",
    ].join("\n");
    await writeFile(path.join(outDir, "README.md"), overview, "utf-8");
    console.log(chalk.cyan(`\nBatch done → ${path.join(outDir, "README.md")}`));
  });

program
  .command("fxstreet-dual")
  .description(
    "Crawl www.fxstreet.com + qa.fxstreet.com, detect Next vs Sitefinity per page, merge paths to CSV",
  )
  .option(
    "--www <url>",
    "WWW start URL",
    "https://www.fxstreet.com/",
  )
  .option(
    "--qa <url>",
    "QA start URL",
    "https://qa.fxstreet.com/",
  )
  .option(
    "-o, --output <file>",
    "Output CSV (merged by normalized path)",
    "fxstreet-www-qa-env.csv",
  )
  .option(
    "-m, --max-pages <number>",
    "Max pages to fetch across both hosts (safety cap)",
    "50000",
  )
  .option(
    "-d, --delay <ms>",
    "Delay between requests in milliseconds",
    "400",
  )
  .action(async (options) => {
    const wwwUrl = options.www as string;
    const qaUrl = options.qa as string;
    if (!isValidUrl(wwwUrl) || !isValidUrl(qaUrl)) {
      console.error(chalk.red("❌ Invalid --www or --qa URL"));
      process.exit(1);
    }

    const maxPages = parseInt(options.maxPages as string, 10);
    const delayMs = parseInt(options.delay as string, 10);

    const spinner = ora("Crawling www + qa (internal links only)...").start();

    try {
      const pages = await crawlDualFxstreet({
        wwwStartUrl: wwwUrl,
        qaStartUrl: qaUrl,
        maxPages,
        delayMs,
        onProgress: ({ visited, queueSize, currentUrl }) => {
          spinner.text = chalk.cyan(
            `Visited ${visited} | Queue ${queueSize} | ${currentUrl.slice(0, 72)}…`,
          );
        },
      });

      const merged = mergePagesByPath(pages);
      const rows = mergedPathsToCsvRows(merged);
      const csv = formatMergedCsv(rows);

      const fs = await import("fs/promises");
      await fs.writeFile(options.output as string, csv, "utf-8");

      spinner.succeed(
        chalk.green(
          `✓ Done. ${pages.length} page visits, ${rows.length} unique paths → ${options.output}`,
        ),
      );

      const conflicts = pages.filter((p) => p.environment === "conflict");
      if (conflicts.length > 0) {
        console.log(
          chalk.yellow(
            `\n⚠ ${conflicts.length} page(s) flagged both Next and Sitefinity (unexpected):`,
          ),
        );
        conflicts.slice(0, 5).forEach((p) =>
          console.log(chalk.yellow(`  - ${p.url}`)),
        );
        if (conflicts.length > 5) {
          console.log(chalk.yellow(`  … and ${conflicts.length - 5} more`));
        }
      }
    } catch (error) {
      spinner.fail(chalk.red("✗ Crawl failed"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    }
  });

program
  .command("compare-origins")
  .description(
    "Crawl two origins (accessible pages only) and merge by path + known ES aliases",
  )
  .requiredOption("--legacy <url>", "Legacy start URL")
  .requiredOption("--processed <url>", "Processed / Next start URL")
  .option(
    "-o, --output <file>",
    "Output CSV",
    "origin-compare.csv",
  )
  .option("-m, --max-pages <number>", "Max accessible pages per origin")
  .option("-d, --delay <ms>", "Delay between requests in ms", "400")
  .action(async (options) => {
    const legacyUrl = options.legacy as string;
    const processedUrl = options.processed as string;
    if (!isValidUrl(legacyUrl) || !isValidUrl(processedUrl)) {
      console.error(chalk.red("❌ Invalid --legacy or --processed URL"));
      process.exit(1);
    }

    const maxPages =
      options.maxPages !== undefined
        ? parseInt(options.maxPages as string, 10)
        : undefined;
    const delayMs = parseInt(options.delay as string, 10);
    const spinner = ora("Comparing origins (legacy ∥ processed)…").start();

    try {
      const { rows, legacy, processed } = await compareOrigins({
        legacyStartUrl: legacyUrl,
        processedStartUrl: processedUrl,
        maxPages,
        delayMs,
        onProgress: (side, { visited, queueSize, currentUrl }) => {
          spinner.text = chalk.cyan(
            `${side} ${visited} ok | q ${queueSize} | ${currentUrl.slice(0, 64)}…`,
          );
        },
      });

      const csv = formatOriginCompareCsv(rows);
      const fs = await import("fs/promises");
      const outFile = options.output as string;
      await fs.writeFile(outFile, csv, "utf-8");

      const byType = rows.reduce(
        (acc, r) => {
          acc[r.matchType] = (acc[r.matchType] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      spinner.succeed(
        chalk.green(
          `✓ ${rows.length} path keys → ${outFile} (legacy ${legacy.pages.length} ok / ${legacy.broken.length} broken · processed ${processed.pages.length} ok / ${processed.broken.length} broken)`,
        ),
      );
      console.log(chalk.cyan("\nMatch types:"));
      for (const [k, n] of Object.entries(byType).sort()) {
        console.log(chalk.gray(`  ${k}: ${n}`));
      }
    } catch (error) {
      spinner.fail(chalk.red("✗ Compare failed"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error)),
      );
      process.exit(1);
    }
  });

program.parse();
