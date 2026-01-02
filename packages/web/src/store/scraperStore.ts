import { create } from 'zustand'

interface ScraperResult {
  url: string
  title?: string
  content: string | string[]
  timestamp: Date
  statusCode: number
}

interface ScraperError {
  url: string
  error: string
  timestamp: Date
}

interface ScraperState {
  results: (ScraperResult | ScraperError)[]
  isLoading: boolean
  addResult: (result: ScraperResult | ScraperError) => void
  clearResults: () => void
  setLoading: (loading: boolean) => void
}

export const useScraperStore = create<ScraperState>((set) => ({
  results: [],
  isLoading: false,
  addResult: (result) => set((state) => ({ 
    results: [result, ...state.results] 
  })),
  clearResults: () => set({ results: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
}))
