export interface ScraperOptions {
  url: string
  selector?: string
  timeout?: number
  headers?: Record<string, string>
  userAgent?: string
}

export interface ScraperResult {
  url: string
  title?: string
  content: string | string[]
  timestamp: Date
  statusCode: number
}

export interface ScraperError {
  url: string
  error: string
  timestamp: Date
}
