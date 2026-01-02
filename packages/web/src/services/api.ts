import axios from 'axios'

const API_URL = '/api'

export interface ScrapeRequest {
  url: string
  selector?: string
  timeout?: number
  headers?: Record<string, string>
  userAgent?: string
}

export const scraperApi = {
  async scrape(request: ScrapeRequest) {
    const response = await axios.post(`${API_URL}/scrape`, request)
    return response.data
  },

  async scrapeMultiple(urls: string[], selector?: string) {
    const response = await axios.post(`${API_URL}/scrape/multiple`, {
      urls,
      selector
    })
    return response.data
  },

  async health() {
    const response = await axios.get(`${API_URL}/health`)
    return response.data
  }
}
