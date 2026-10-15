# Web Scraper Toolkit

Monorepo TypeScript (pnpm): scraping compartido, REST API, CLI y dashboard web.

**Estado y roadmap:** [PROJECT_STATUS.md](PROJECT_STATUS.md) · **Docs:** [docs/README.md](docs/README.md)

## Packages

| Package | Description |
|---------|-------------|
| **@operezol/scraper-shared** | Scraping, enlaces internos, crawl, helpers FXStreet (dual + ES) |
| **@operezol/scraper-api** | REST API (Express) |
| **@operezol/scraper-cli** | CLI (Commander) |
| **@operezol/scraper-web** | Dashboard (React, Vite, Tailwind) |

## Quick Start

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

# FXStreet ES — listado de páginas + Next/Sitefinity
pnpm --filter @operezol/scraper-cli start fxstreet-es [-o fxstreet-es-pages.csv] [--url URL] [-m N] [-d ms]

# Cualquier TLD FXStreet (catálogo --locale o --url)
pnpm --filter @operezol/scraper-cli start fxstreet-locale --locale it [-o crawls/it-pages.csv] [-d 250]

# Lote + compare offline vs EN. Al cerrar inventario: añadir --with-keys --site ../Site
pnpm --filter @operezol/scraper-cli start fxstreet-batch --locales "en,es,it,fr,de,pt" --out-dir crawls/2026-09-17 -d 250

# Solo menú de cabecera (home HTML, sin BFS)
pnpm --filter @operezol/scraper-cli start fxstreet-headers --locales en,es,it,fr,de,pt --out-dir crawls/2026-09-17

# Claves UI a traducir (tras inventario 2xx; no pisa lotes ES)
pnpm --filter @operezol/scraper-cli start fxstreet-translation-keys --locale it --pages crawls/2026-09-17/it-pages.csv --site ../Site -o crawls/2026-09-17/it-keys.csv

# Compare offline de dos CSV de inventario
pnpm --filter @operezol/scraper-cli start compare-crawls --locale-csv crawls/it-pages.csv --en-csv crawls/en-pages.csv --locale it

# Comparar dos orígenes (accesibles + found_on)
pnpm --filter @operezol/scraper-cli start compare-origins --legacy URL --processed URL [-o origin-compare.csv] [-m N] [-d ms]

# FXStreet www + QA — CSV fusionado por path
pnpm --filter @operezol/scraper-cli start fxstreet-dual [-o fxstreet-www-qa-env.csv] [--www URL] [--qa URL] [-m N] [-d ms]
```

- **`fxstreet-es`:** enlaces internos en `www.fxstreet.es` que **responden 2xx**. CSV `normalized_path,environment,http_status,found_on,url`. Los enlaces rotos van a `*.broken.csv` (`found_on` = página que los enlazaba).
- **`fxstreet-locale` / `fxstreet-batch`:** semillas = `{tld}/sitemap.xml` (solo URLs de ese host) + BFS. Cada URL se **visita**; 404/410 y soft-404 van a `*.broken.csv`, nunca al inventario 2xx. Chromium abre menús React/Radix. `--no-browser` / `--no-sitemap` opt-out. Listado: `*.patterns.csv`.
- **`fxstreet-translation-keys`:** **un CSV por idioma** (`{locale}-keys.csv`), no lotes 01–06. Incluye páginas 2xx **y** enlaces heredados que hoy van a EN (luego el href debe ser el path del TLD). No toca los lotes PO ES. Batch: `--with-keys --site <Site>`.
- **`fxstreet-headers`:** vista extra del mega-menú desktop. No sustituye al crawl.
- **`compare-crawls`:** merge offline locale vs EN (same-path, aliases por primer segmento / colas compartidas, locale-only).
- **`compare-origins`:** crawl paralelo de dos orígenes (p. ej. legacy `fxstreet.es` vs QA Next) → CSV de paralelismos (`path_key`, `match_type`, HTTP, `found_on`, aliases calendario/educación/bróker).
- **`fxstreet-dual`:** www + qa `fxstreet.com` → CSV `normalized_path,www_environment,qa_environment,www_url,qa_url`. Solo páginas accesibles (2xx).
- **Detección (hoy):** Next (`style[data-precedence="next"]` o `script[src*="_next"]`), Sitefinity (meta Generator), `conflict` / `unknown`. `-o` relativo al cwd (`pnpm --filter` → suele ser `packages/cli`).

Planificación (capas, filtros, compare por config): [docs/README.md](docs/README.md).

## Project structure

```
web-scraper-toolkit/
├── packages/
│   ├── shared/src/   scraper, link-extract, env-detect, dual-origin-crawl, fxstreet-es-crawl, …
│   ├── api/src/
│   ├── cli/src/
│   └── web/src/
├── docs/             ver docs/README.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

## Development

```bash
pnpm dev:api    # API
pnpm dev:cli    # CLI (tsx watch)
pnpm build
pnpm test
pnpm clean
```

## Programmatic API (shared)

```typescript
import { WebScraper } from '@operezol/scraper-shared'

const scraper = new WebScraper()
await scraper.scrape({ url: 'https://example.com', selector: 'h1', timeout: 10000 })
await scraper.scrapeMultiple(['https://a.com', 'https://b.com'], 'h1')
await scraper.extractInternalLinks('https://example.com')
await scraper.crawlInternalLinks('https://example.com', 100, (v, t, u) => console.log(v, u))
```

Helpers: `crawlFxstreetEs`, `formatFxstreetEsPagesCsv`, `formatFxstreetEsBrokenCsv`, `compareOrigins`, `formatOriginCompareCsv`, `crawlDualFxstreet`, `mergePagesByPath`, `mergedPathsToCsvRows`, `formatMergedCsv`, `detectPageEnvironment`.

Tipos: `ScraperOptions`, `ScraperResult` / `ScraperError`.

## Features (actuales)

TypeScript estricto, workspaces, Express, Commander, Cheerio + Axios, dashboard React, `scrape` / `batch` / `links` / `crawl`, FXStreet dual + ES (generalización planificada en docs).

## Tech stack

TypeScript, pnpm, Express, Commander, Cheerio, Axios, Chalk, Ora; web: React, Vite, Tailwind, Zustand.

## License

MIT © Oriol Pérez Olivares

## Contributing

Pull requests welcome.

## Contact

- GitHub: [@operezol](https://github.com/operezol)
