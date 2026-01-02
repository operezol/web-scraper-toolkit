#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { WebScraper, isValidUrl, formatResult } from '@operezol/scraper-shared'

const program = new Command()
const scraper = new WebScraper()

program
  .name('scraper')
  .description('Professional web scraping CLI tool')
  .version('1.0.0')

program
  .command('scrape')
  .description('Scrape a single URL')
  .argument('<url>', 'URL to scrape')
  .option('-s, --selector <selector>', 'CSS selector to extract')
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '10000')
  .option('-o, --output <file>', 'Output file (JSON)')
  .action(async (url, options) => {
    if (!isValidUrl(url)) {
      console.error(chalk.red('❌ Invalid URL'))
      process.exit(1)
    }

    const spinner = ora('Scraping...').start()

    try {
      const result = await scraper.scrape({
        url,
        selector: options.selector,
        timeout: parseInt(options.timeout)
      })

      spinner.succeed(chalk.green('✓ Scraping completed'))

      if ('error' in result) {
        console.error(chalk.red(`Error: ${result.error}`))
      } else {
        console.log(chalk.cyan('\nResults:'))
        console.log(formatResult(result))

        if (options.output) {
          const fs = await import('fs/promises')
          await fs.writeFile(options.output, JSON.stringify(result, null, 2))
          console.log(chalk.green(`\n✓ Saved to ${options.output}`))
        }
      }
    } catch (error) {
      spinner.fail(chalk.red('✗ Scraping failed'))
      console.error(error)
      process.exit(1)
    }
  })

program
  .command('batch')
  .description('Scrape multiple URLs from a file')
  .argument('<file>', 'File containing URLs (one per line)')
  .option('-s, --selector <selector>', 'CSS selector to extract')
  .option('-o, --output <file>', 'Output file (JSON)')
  .action(async (file, options) => {
    const spinner = ora('Reading URLs...').start()

    try {
      const fs = await import('fs/promises')
      const content = await fs.readFile(file, 'utf-8')
      const urls = content.split('\n').filter(line => line.trim())

      spinner.text = `Scraping ${urls.length} URLs...`

      const results = await scraper.scrapeMultiple(urls, options.selector)

      spinner.succeed(chalk.green(`✓ Scraped ${urls.length} URLs`))

      console.log(chalk.cyan('\nResults:'))
      console.log(formatResult(results))

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(results, null, 2))
        console.log(chalk.green(`\n✓ Saved to ${options.output}`))
      }
    } catch (error) {
      spinner.fail(chalk.red('✗ Batch scraping failed'))
      console.error(error)
      process.exit(1)
    }
  })

program.parse()
