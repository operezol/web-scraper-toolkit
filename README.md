# 🕷️ Web Scraper Toolkit

Professional web scraping toolkit with REST API and CLI. Built with TypeScript and pnpm workspaces.

## 📦 Packages

This monorepo contains four packages:

- **@operezol/scraper-shared** - Shared utilities and scraping logic
- **@operezol/scraper-api** - REST API for web scraping
- **@operezol/scraper-cli** - Command-line interface
- **@operezol/scraper-web** - Web dashboard (React + TypeScript + Tailwind)

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Web Dashboard

```bash
# Start both API and Web Dashboard
pnpm dev

# Or start them separately:
pnpm dev:api  # API at http://localhost:3000
pnpm dev:web  # Dashboard at http://localhost:5173
```

Open http://localhost:5173 in your browser to use the dashboard.

### API Usage

```bash
# Start the API server
pnpm dev:api

# The API will be available at http://localhost:3000
```

**Endpoints:**

- `GET /health` - Health check
- `POST /scrape` - Scrape a single URL
- `POST /scrape/multiple` - Scrape multiple URLs

**Example request:**

```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "selector": "h1"
  }'
```

### CLI Usage

```bash
# Scrape a single URL
pnpm --filter @operezol/scraper-cli start scrape https://example.com

# Scrape with CSS selector
pnpm --filter @operezol/scraper-cli start scrape https://example.com -s "h1"

# Scrape multiple URLs from file
pnpm --filter @operezol/scraper-cli start batch urls.txt -o results.json

# Extract internal links from a website and export to CSV
pnpm --filter @operezol/scraper-cli start links https://example.com -o links.csv

# Recursively crawl a website and extract all internal links
pnpm --filter @operezol/scraper-cli start crawl https://example.com -o crawl-links.csv -m 100

# FXStreet: crawl www + QA together, detect Next.js vs Sitefinity per page, CSV by path
pnpm --filter @operezol/scraper-cli start fxstreet-dual -o fxstreet-www-qa-env.csv
```

The `fxstreet-dual` command walks internal links on **www.fxstreet.com** and **qa.fxstreet.com** in one queue (each URL visited once), classifies each HTML response, and writes a merged CSV grouped by **normalized path** so you can compare production vs QA stacks side by side.

**Detection (mutually exclusive in normal pages):**

- **next** — `<style data-precedence="next">` and/or any `<script src>` whose URL contains `_next`
- **sitefinity** — `<meta name="Generator" content="...Sitefinity...">`
- **conflict** — both signals present (unexpected)
- **unknown** — no match or failed fetch

**Options:**

| Option | Description |
|--------|-------------|
| `--www <url>` | Start URL for production (default: `https://www.fxstreet.com/`) |
| `--qa <url>` | Start URL for QA (default: `https://qa.fxstreet.com/`) |
| `-o, --output <file>` | Output CSV path (default: `fxstreet-www-qa-env.csv`) |
| `-m, --max-pages <n>` | Max pages fetched across both hosts (default: `50000`) |
| `-d, --delay <ms>` | Delay between requests (default: `400`) |

**CSV columns:** `normalized_path`, `www_environment`, `qa_environment`, `www_url`, `qa_url`. Empty cells mean that path was not reached on that host (or yet, if you stop early with `-m`). Output path is relative to the **current working directory** (when using `pnpm --filter … start`, that is usually `packages/cli`).

## 🏗️ Project Structure

```
web-scraper-toolkit/
├── packages/
│   ├── shared/          # Shared utilities
│   │   ├── src/
│   │   │   ├── scraper.ts
│   │   │   ├── env-detect.ts      # Next vs Sitefinity from HTML
│   │   │   ├── link-extract.ts    # Internal links from HTML (used by WebScraper)
│   │   │   ├── dual-origin-crawl.ts  # www + qa FXStreet crawl & CSV merge helpers
│   │   │   ├── types.ts
│   │   │   └── utils.ts
│   │   └── package.json
│   ├── api/             # REST API
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── cli/             # CLI tool
│   │   ├── src/
│   │   │   └── cli.ts
│   │   └── package.json
│   └── web/             # Web dashboard (React + Vite)
│       ├── src/
│       └── package.json
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

## 🛠️ Development

```bash
# Run API in development mode
pnpm dev:api

# Run CLI in development mode
pnpm dev:cli

# Build all packages
pnpm build

# Run tests
pnpm test

# Clean all build artifacts
pnpm clean
```

## 📚 API Reference

### Shared Package

**WebScraper Class:**

```typescript
import { WebScraper } from '@operezol/scraper-shared'

const scraper = new WebScraper()

// Scrape single URL
const result = await scraper.scrape({
  url: 'https://example.com',
  selector: 'h1',
  timeout: 10000,
  headers: { 'Custom-Header': 'value' },
  userAgent: 'Custom User Agent'
})

// Scrape multiple URLs
const results = await scraper.scrapeMultiple(
  ['https://example.com', 'https://example.org'],
  'h1'
)

// Extract internal links from a website
const links = await scraper.extractInternalLinks('https://example.com')
// Returns: string[] - Array of internal links sorted alphabetically

// Recursively crawl a website and extract all internal links
const allLinks = await scraper.crawlInternalLinks(
  'https://example.com',
  100, // maxPages
  (visited, total, currentUrl) => {
    console.log(`Visited: ${visited}, Queue: ${total - visited}, Current: ${currentUrl}`)
  }
)
// Returns: string[] - Array of all discovered internal links sorted alphabetically
```

**FXStreet dual-host crawl (programmatic):**

```typescript
import {
  detectPageEnvironment,
  crawlDualFxstreet,
  mergePagesByPath,
  mergedPathsToCsvRows,
  formatMergedCsv,
} from '@operezol/scraper-shared'

const pages = await crawlDualFxstreet({
  wwwStartUrl: 'https://www.fxstreet.com/',
  qaStartUrl: 'https://qa.fxstreet.com/',
  maxPages: 50000,
  delayMs: 400,
})

const merged = mergePagesByPath(pages)
const rows = mergedPathsToCsvRows(merged)
const csv = formatMergedCsv(rows)
```

**Types:**

```typescript
interface ScraperOptions {
  url: string
  selector?: string
  timeout?: number
  headers?: Record<string, string>
  userAgent?: string
}

interface ScraperResult {
  url: string
  title?: string
  content: string | string[]
  timestamp: Date
  statusCode: number
}
```

## 🎯 Features

- ✅ **TypeScript** - Full type safety
- ✅ **Monorepo** - pnpm workspaces
- ✅ **REST API** - Express server
- ✅ **CLI Tool** - Commander-based CLI
- ✅ **Shared Logic** - DRY principle
- ✅ **Error Handling** - Robust error handling
- ✅ **Customizable** - Headers, timeout, selectors
- ✅ **Batch Scraping** - Multiple URLs at once
- ✅ **Link Extraction** - Extract internal links and export to CSV
- ✅ **Recursive Crawling** - Visit all pages and extract links with progress tracking
- ✅ **FXStreet dual crawl** - Compare www vs QA internal URLs with Next.js vs Sitefinity detection (CLI + shared API)

## 🔧 Tech Stack

- **TypeScript** - Type-safe development
- **pnpm** - Fast, disk space efficient package manager
- **Express** - Web framework for API
- **Commander** - CLI framework
- **Cheerio** - HTML parsing
- **Axios** - HTTP client
- **Chalk** - Terminal styling
- **Ora** - Terminal spinners

## 📝 License

MIT © Oriol Pérez Olivares

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

- GitHub: [@operezol](https://github.com/operezol)
- Email: your.email@example.com

---

**Made with ❤️ by Oriol Pérez Olivares**
