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
```

## 🏗️ Project Structure

```
web-scraper-toolkit/
├── packages/
│   ├── shared/          # Shared utilities
│   │   ├── src/
│   │   │   ├── scraper.ts
│   │   │   ├── types.ts
│   │   │   └── utils.ts
│   │   └── package.json
│   ├── api/             # REST API
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   └── cli/             # CLI tool
│       ├── src/
│       │   └── cli.ts
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
