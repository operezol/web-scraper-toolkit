# Web Scraper Toolkit — Estado del proyecto

**Actualizado:** 6 mayo 2026 · **Repo:** [github.com/operezol/web-scraper-toolkit](https://github.com/operezol/web-scraper-toolkit)

Monorepo (pnpm): TypeScript, React/Vite/Tailwind (web), Express (API), Commander (CLI).

---

## Qué incluye

| Paquete | Rol |
|---------|-----|
| **scraper-shared** | `WebScraper`, extracción de enlaces (`link-extract`), crawl recursivo, detección Next/Sitefinity (`env-detect`), crawl dual FXStreet (`dual-origin-crawl` + CSV merge). Stack: axios, cheerio. |
| **scraper-api** | Express :3000 — `GET /health`, `POST /scrape`, `POST /scrape/multiple`. |
| **scraper-cli** | Comandos: `scrape`, `batch`, `links`, `crawl`, `fxstreet-dual` (www+QA FXStreet, CSV por path). ora/chalk. |
| **scraper-web** | Dashboard React + Zustand; proxy a la API en dev. |

**Comandos y ejemplos:** [README.md](README.md) (Quick Start, CLI Usage, API).

**Árbol de carpetas:** [README.md — Project Structure](README.md#-project-structure).

---

## Crawl dual FXStreet (`fxstreet-dual`)

Implementación actual **acoplada** a `www.fxstreet.com` / `qa.fxstreet.com` y reglas Next/Sitefinity en código.

**Evolución planeada:** crawl multi-origen y reglas HTML **solo por configuración** — especificación en **[docs/flexible-compare-crawl.md](docs/flexible-compare-crawl.md)** (contrato JSON, CLI tentativa `compare-crawl`). Implementar alineado a ese doc o actualizar el doc si cambia el contrato.

---

## Roadmap (resumen)

Detalle y casillas en subsecciones siguientes; evita duplicar lo ya cubierto en el código actual.

### Calidad · API · Web

- [ ] Tests (Vitest en shared, contrato CSV/JSON, E2E dashboard opcional), CI (lint + test + build)
- [ ] API: rate limiting, payloads acotados; auth opcional para deploy público
- [ ] Dashboard: historial local/back ligero; deploy documentado

### Scraping genérico (`scrape` / `links` / `crawl`)

- [ ] Filtros URL, profundidad máxima, checkpoints/resume, concurrencia acotada, robots.txt opcional
- [x] CSV de enlaces y crawl recursivo con `max-pages`

### Crawl multi-origen / comparativo

- [ ] Motor según [docs/flexible-compare-crawl.md](docs/flexible-compare-crawl.md)
- [ ] Salidas extra (JSON Lines / SQLite) opcional
- [x] FXStreet www vs QA (CSV por path; versión flexible pendiente de motor genérico)

### Docs

- [x] Especificación flexible: [docs/flexible-compare-crawl.md](docs/flexible-compare-crawl.md)
- [ ] `docs/recipes/`, notas de uso responsable frente a sitios remotos

---

## Historial breve

Repos previos `web-scrapper-api` / `web-scrapper-cli` sustituidos por este monorepo + dashboard.

---

## Notas

**Métricas LOC/commits:** orientativas; el repo crece con shared/CLI.

**Portfolio:** cubre monorepo TS, API, CLI, UI React y scraping compartido.

---

**Autor:** Oriol Pérez Olivares
