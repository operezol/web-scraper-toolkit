import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScraperOptions, ScraperResult, ScraperError } from './types'

export class WebScraper {
  private defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }

  async scrape(options: ScraperOptions): Promise<ScraperResult | ScraperError> {
    try {
      const response = await axios.get(options.url, {
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
          ...(options.userAgent && { 'User-Agent': options.userAgent })
        },
        timeout: options.timeout || 10000
      })

      const $ = cheerio.load(response.data)
      const title = $('title').text()

      let content: string | string[]
      if (options.selector) {
        content = $(options.selector)
          .map((_, el) => $(el).text().trim())
          .get()
      } else {
        content = $('body').text().trim()
      }

      return {
        url: options.url,
        title,
        content,
        timestamp: new Date(),
        statusCode: response.status
      }
    } catch (error) {
      return {
        url: options.url,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    }
  }

  async scrapeMultiple(urls: string[], selector?: string): Promise<(ScraperResult | ScraperError)[]> {
    const promises = urls.map(url => this.scrape({ url, selector }))
    return Promise.all(promises)
  }
}
