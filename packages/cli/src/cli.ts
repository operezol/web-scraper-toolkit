#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { WebScraper, isValidUrl, formatResult } from "@operezol/scraper-shared";

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
  .description("Recursively crawl a website and extract all internal links")
  .argument("<url>", "Starting URL to crawl from")
  .option("-o, --output <file>", "Output CSV file", "crawl-links.csv")
  .option("-m, --max-pages <number>", "Maximum number of pages to visit", "100")
  .action(async (url, options) => {
    if (!isValidUrl(url)) {
      console.error(chalk.red("❌ Invalid URL"));
      process.exit(1);
    }

    const maxPages = parseInt(options.maxPages);
    const spinner = ora("Starting crawl...").start();

    try {
      const links = await scraper.crawlInternalLinks(
        url,
        maxPages,
        (visited, total, currentUrl) => {
          spinner.text = chalk.cyan(
            `Crawling... Visited: ${visited}/${maxPages} | Queue: ${total - visited} | Current: ${currentUrl.substring(0, 60)}...`,
          );
        },
      );

      spinner.succeed(
        chalk.green(
          `✓ Crawl completed! Found ${links.length} unique internal links`,
        ),
      );

      const fs = await import("fs/promises");
      const csvContent = "URL\n" + links.join("\n");
      await fs.writeFile(options.output, csvContent, "utf-8");

      console.log(chalk.green(`\n✓ Saved to ${options.output}`));
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

program.parse();
