# Web Scraper Toolkit — Estado del proyecto

**Actualizado:** 17 septiembre 2026 · **Repo:** [github.com/operezol/web-scraper-toolkit](https://github.com/operezol/web-scraper-toolkit)

Monorepo (pnpm): TypeScript, React/Vite/Tailwind (web), Express (API), Commander (CLI).

**Mapa de docs:** [docs/README.md](docs/README.md) — este fichero es la **única** lista de objetivos / *next coming*.

**Modelo:** la base (`shared` + CLI genérica) es generalista; los comandos FXStreet (y futuros) son scripts específicos encima. Capacidades compartidas por ≥2 scripts se **promueven** a la base — [docs/crawl-architecture-plan.md](docs/crawl-architecture-plan.md) §0. Al añadir/cambiar un script específico se actualizan docs y, si aplica, la base en el mismo ciclo (§0 *Ciclo*).

---

## Inventario (existe hoy)

| Pieza | Qué hace |
|-------|----------|
| **scraper-shared** | `WebScraper` (scrape / batch), `link-extract`, `crawlInternalLinks`, `env-detect` (Next/Sitefinity hardcode), `dual-origin-crawl`, `fxstreet-es-crawl`. Axios + Cheerio. |
| **scraper-api** | Express :3000 — `GET /health`, `POST /scrape`, `POST /scrape/multiple` |
| **scraper-cli** | `scrape`, `batch`, `links`, `crawl`, `fxstreet-es`, `fxstreet-locale`, `fxstreet-batch`, `compare-crawls`, `fxstreet-dual` |
| **scraper-web** | Dashboard React + Zustand; proxy API en dev |

Uso y ejemplos de comandos: [README.md](README.md).

### FXStreet (código actual)

| Comando | Comportamiento |
|---------|----------------|
| `fxstreet-dual` | Crawl www + qa `fxstreet.com`; detecta Next/Sitefinity; CSV merge por path |
| `fxstreet-es` | Wrapper sobre `crawlFxstreetSite`; solo hosts `.es` |
| `fxstreet-locale` | Inventario 2xx de cualquier TLD (`--locale` / `--url`); hosts derivados |
| `fxstreet-batch` | Varios locales en serie + compare offline vs EN. Semillas `{tld}/sitemap.xml` + Chromium para menús React. `--with-keys` emite CSV de i18n por locale |
| `fxstreet-translation-keys` | Inventario 2xx + Site i18n → `{locale}-keys.csv`; descarta 404 / EN-only / páginas que no van |
| `compare-crawls` | Merge offline locale vs EN (aliases conocidos + colas compartidas) |
| `compare-origins` | Dos crawls (legacy vs processed) + merge por path y aliases ES |

**Análisis CSV ES (7264 URLs, 2026-09-03):** bajo `news` / `analysis`, conservar landings + `feed`/`latest`; el resto son slugs de artículo (~3000 news). ~3150 URLs con query (casi todas `/account/login?...`) → strip query. Preset: `FXSTREET_ARTICLE_RULES` + `FXSTREET_DETECTION`.

**Preset ampliado (2026-09-09):** también excluye slugs de `education`, `company`, `author`, `press-releases`, `currencies`, `commodities`, `live-video`, `cryptocurrencies/*`, `rates-charts/[asset]`, `brokers` detail + `best|reviews|prop/[slug]`, calendar `event/*`, `curso-forex/*`, root dated posts. Crawl de planificación ≈ **67 URLs** (antes ~960 con solo news/analysis filtrados).

**Antes de una run `fxstreet-es` “completa” con `--keep-articles`:** confirmar con el usuario (volumen alto). Para validar inventario de lanzamiento, usar el preset por defecto (sin `--keep-articles`).

---

## Next coming (única checklist)

Detalle de diseño: [docs/crawl-architecture-plan.md](docs/crawl-architecture-plan.md).  
Contrato compare: [docs/flexible-compare-crawl.md](docs/flexible-compare-crawl.md).

### Crawl — capa A (motor genérico)

- [x] `url-normalize` (strip query/hash; default filtros on; `--keep-query` / `--keep-hash`)
- [x] `ArticlePathRule` + `isArticlePath` + flags CLI (`--keep-articles`, …)
- [x] `maxPages` / `-m` **opt-in**: sin flag = sin límite
- [x] `crawlSite` / `crawlInternalLinks`: inventario = **solo 2xx**; rotos aparte con `foundOn`
- [x] `evaluateDetection` genérico + preset FXStreet (`next`/`sitefinity`)
- [x] Checkpoint A1: flush parcial **opt-in** (`--checkpoint-every`)
- [ ] Checkpoint A2: resume **opt-in** (`visited` + cola + `--resume`)

### Crawl — presets y compare

- [ ] Ejemplo JSON FXStreet (origins, article `news` + allowlist, detection `next`/`sitefinity`)
- [ ] Ampliar allowlist `news` con paths no-post reales (`*/news/*`)
- [x] CLI `compare-origins` (merge por path + aliases ES; `compareCrawl --config` sigue pendiente)
- [x] Wrappers `fxstreet-es` sobre motor + preset (dual aún acoplado en parte)
- [ ] Wrappers `fxstreet-dual` sobre motor + preset
- [x] Allowlist FXStreet `news`/`analysis`: `feed`, `latest` (análisis CSV ES 2026-09)
- [ ] Salidas opcionales: JSON Lines / SQLite

### Scraping genérico (resto)

- [x] CSV enlaces + crawl recursivo con `max-pages`
- [ ] Profundidad máxima, concurrencia, robots.txt opcional

### Calidad · API · Web · docs

- [ ] Tests amplios + CI
- [ ] API: rate limiting, payloads acotados; auth opcional
- [ ] Dashboard: historial; deploy documentado
- [ ] `docs/recipes/`, notas de uso responsable

---

## Historial breve

Repos `web-scrapper-api` / `web-scrapper-cli` → monorepo + dashboard.  
2026-09: `fxstreet-es`; planning capas crawl / frameworks por config; limpieza de docs; checkpoint A1/A2 en plan de base.

---

**Autor:** Oriol Pérez Olivares
