import { useState } from 'react'
import { scraperApi } from './services/api'
import { useScraperStore } from './store/scraperStore'

export default function App() {
  const [url, setUrl] = useState('')
  const [selector, setSelector] = useState('')
  const { results, isLoading, addResult, clearResults, setLoading } = useScraperStore()

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setLoading(true)
    try {
      const result = await scraperApi.scrape({ url, selector: selector || undefined })
      addResult(result)
      setUrl('')
      setSelector('')
    } catch (error) {
      console.error('Scraping failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const isError = (result: any): result is { error: string } => {
    return 'error' in result
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-white">
            🕷️ Web Scraper Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Professional web scraping toolkit</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Scraper Form */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-4">New Scrape</h2>
            
            <form onSubmit={handleScrape} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  CSS Selector (optional)
                </label>
                <input
                  type="text"
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder="h1, .title, #content"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  {isLoading ? 'Scraping...' : 'Scrape'}
                </button>
                
                <button
                  type="button"
                  onClick={clearResults}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            </form>

            {/* Stats */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">{results.length}</div>
                  <div className="text-sm text-slate-400">Total Scrapes</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-400">
                    {results.filter(r => !isError(r)).length}
                  </div>
                  <div className="text-sm text-slate-400">Successful</div>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-4">Results</h2>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {results.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No results yet. Start scraping!
                </div>
              ) : (
                results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      isError(result)
                        ? 'bg-red-900/20 border-red-700'
                        : 'bg-slate-900/50 border-slate-700'
                    }`}
                  >
                    {isError(result) ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-red-400 font-medium">❌ Error</span>
                          <span className="text-xs text-slate-500">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm text-slate-400 mb-1">{result.url}</div>
                        <div className="text-sm text-red-300">{result.error}</div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-green-400 font-medium">✓ Success</span>
                          <span className="text-xs text-slate-500">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">
                            {result.statusCode}
                          </span>
                        </div>
                        <div className="text-sm text-slate-400 mb-2">{result.url}</div>
                        {result.title && (
                          <div className="text-sm font-medium text-white mb-2">
                            {result.title}
                          </div>
                        )}
                        <div className="text-sm text-slate-300 bg-slate-900 p-3 rounded max-h-32 overflow-y-auto">
                          {Array.isArray(result.content) ? (
                            <ul className="list-disc list-inside space-y-1">
                              {result.content.slice(0, 5).map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                              {result.content.length > 5 && (
                                <li className="text-slate-500">
                                  ... and {result.content.length - 5} more
                                </li>
                              )}
                            </ul>
                          ) : (
                            <p className="line-clamp-3">{result.content}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
