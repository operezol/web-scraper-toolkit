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
  formatFxstreetEsPagesCsv,
  formatFxstreetEsBrokenCsv,
  compareOrigins,
  formatOriginCompareCsv,
} from "@operezol/scraper-shared";

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
