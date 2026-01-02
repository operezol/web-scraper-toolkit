import express from 'express'
import cors from 'cors'
import { WebScraper } from '@operezol/scraper-shared'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

const scraper = new WebScraper()

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() })
})

app.post('/scrape', async (req, res) => {
  try {
    const { url, selector, timeout, headers, userAgent } = req.body

    if (!url) {
      return res.status(400).json({ error: 'URL is required' })
    }

    const result = await scraper.scrape({
      url,
      selector,
      timeout,
      headers,
      userAgent
    })

    res.json(result)
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})

app.post('/scrape/multiple', async (req, res) => {
  try {
    const { urls, selector } = req.body

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'URLs array is required' })
    }

    const results = await scraper.scrapeMultiple(urls, selector)
    res.json(results)
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Scraper API running on http://localhost:${PORT}`)
})
