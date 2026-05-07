# 🕷️ Web Scraper Toolkit

Monorepo TypeScript (pnpm): scraping compartido, REST API, CLI y dashboard web. Estado y roadmap: [PROJECT_STATUS.md](PROJECT_STATUS.md).

## 📦 Packages

| Package | Description |
|---------|-------------|
| **@operezol/scraper-shared** | Scraping, enlaces internos, crawl recursivo, utilidades FXStreet dual |
| **@operezol/scraper-api** | REST API (Express) |
| **@operezol/scraper-cli** | CLI (Commander) |
| **@operezol/scraper-web** | Dashboard (React, Vite, Tailwind) |

## 🚀 Quick Start

```bash
pnpm install
pnpm build
```

**Dashboard + API:** `pnpm dev` → API [http://localhost:3000](http://localhost:3000), web [http://localhost:5173](http://localhost:5173). Por separado: `pnpm dev:api`, `pnpm dev:web`.

**API** (`pnpm dev:api`): `GET /health`, `POST /scrape`, `POST /scrape/multiple`.

```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "selector": "h1"}'
```

## CLI

```bash
pnpm --filter @operezol/scraper-cli start scrape <url> [-s selector] [-o out.json]
pnpm --filter @operezol/scraper-cli start batch <urls-file> [-o out.json]
pnpm --filter @operezol/scraper-cli start links <url> [-o links.csv]
pnpm --filter @operezol/scraper-cli start crawl <url> [-o crawl.csv] [-m maxPages]

# Dos orígenes FXStreet (www + QA), clasificación por HTML, CSV fusionado por path
pnpm --filter @operezol/scraper-cli start fxstreet-dual [-o fxstreet-www-qa-env.csv] [--www URL] [--qa URL] [-m N] [-d ms]
```

`fxstreet-dual` encola **solo enlaces internos** por host, visita cada URL como mucho una vez y escribe CSV con columnas `normalized_path`, `www_environment`, `qa_environment`, `www_url`, `qa_url`. Detección: Next (`style[data-precedence="next"]` o `script[src*="_next"]`), Sitefinity (`meta[name="Generator"]` con Sitefinity), `conflict` si ambas, `unknown` si no aplica o falla la petición. La ruta `-o` es relativa al cwd (con `pnpm --filter` suele ser `packages/cli`).

**Roadmap / especificación** de un crawl comparativo **solo por config** (sin URLs ni reglas fijas en código): [docs/flexible-compare-crawl.md](docs/flexible-compare-crawl.md).

## 🏗️ Project Structure

```
web-scraper-toolkit/
├── packages/
│   ├── shared/src/   scraper.ts, link-extract.ts, env-detect.ts, dual-origin-crawl.ts, types.ts, utils.ts
│   ├── api/src/
│   ├── cli/src/
│   └── web/src/
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

## 🛠️ Development

```bash
pnpm dev:api    # API
pnpm dev:cli    # CLI (tsx watch)
pnpm build
pnpm test
pnpm clean
```

## 📚 Programmatic API (shared)

```typescript
import { WebScraper } from '@operezol/scraper-shared'

const scraper = new WebScraper()
await scraper.scrape({ url: 'https://example.com', selector: 'h1', timeout: 10000 })
await scraper.scrapeMultiple(['https://a.com', 'https://b.com'], 'h1')
await scraper.extractInternalLinks('https://example.com')
await scraper.crawlInternalLinks('https://example.com', 100, (v, t, u) => console.log(v, u))
```

**FXStreet dual (same as CLI internals):** `crawlDualFxstreet`, `mergePagesByPath`, `mergedPathsToCsvRows`, `formatMergedCsv`, `detectPageEnvironment` — import from `@operezol/scraper-shared`.

Tipos principales: `ScraperOptions`, `ScraperResult` / `ScraperError` en el paquete publicado.

## 🎯 Features

TypeScript estricto, workspaces, API Express, CLI Commander, Cheerio + Axios, dashboard React, batch/links/crawl, **FXStreet dual crawl** (pendiente generalización: ver `docs/flexible-compare-crawl.md`).

## 🔧 Tech Stack

TypeScript, pnpm, Express, Commander, Cheerio, Axios, Chalk, Ora; web: React, Vite, Tailwind, Zustand.

## 📝 License

MIT © Oriol Pérez Olivares

## 🤝 Contributing

Pull requests welcome.

## 📧 Contact

- GitHub: [@operezol](https://github.com/operezol)

---

**Made with ❤️ by Oriol Pérez Olivares**
