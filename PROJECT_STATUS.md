# Web Scraper Toolkit - Project Status

**Fecha de referencia:** 6 Mayo 2026  
**Estado:** ✅ Completado (con evolución activa en CLI / shared)

---

## 📦 Proyecto Completado

**Repositorio:** <https://github.com/operezol/web-scraper-toolkit>  
**Tipo:** Monorepo profesional (pnpm workspaces)  
**Stack:** TypeScript + React + Vite + Tailwind + Express + Commander

---

## ✅ Componentes Implementados

### 1. **@operezol/scraper-shared** (Shared Package)

- `WebScraper` class con lógica de scraping
- Método `extractInternalLinks()` para extraer enlaces internos (HTML vía `link-extract.ts`)
- Método `crawlInternalLinks()` para crawling recursivo con tracking de visitados
- **Detección de entorno de página** (`env-detect.ts`): Next.js (`style[data-precedence="next"]` o `script[src*="_next"]`) vs Sitefinity (`meta[name="Generator"]` con Sitefinity)
- **Crawl dual FXStreet** (`dual-origin-crawl.ts`): cola única BFS para `www.fxstreet.com` y `qa.fxstreet.com`, solo enlaces internos; utilidades `mergePagesByPath`, `mergedPathsToCsvRows`, `formatMergedCsv`
- Tipos TypeScript compartidos
- Utilidades (validación de URLs, formateo)
- **Dependencias:** axios, cheerio

### 2. **@operezol/scraper-api** (REST API)

- Express server en puerto 3000
- Endpoints:
  - `GET /health` - Health check
  - `POST /scrape` - Scrape single URL
  - `POST /scrape/multiple` - Scrape multiple URLs
- CORS habilitado
- Error handling robusto

### 3. **@operezol/scraper-cli** (CLI Tool)

- Commander-based CLI
- Comandos:
  - `scraper scrape <url>` - Scrape single URL
  - `scraper batch <file>` - Scrape from file
  - `scraper links <url>` - Extract internal links and export to CSV
  - `scraper crawl <url>` - Crawl recursively and extract all internal links
  - `scraper fxstreet-dual` - Crawl conjunto www + QA de FXStreet, entorno por página, CSV fusionado por ruta normalizada
- Opciones: selector, timeout, output file, max-pages; en `fxstreet-dual`: `--www`, `--qa`, `-m`, `-d`
- Spinners y colores con ora + chalk
- Exportación a CSV ordenado alfabéticamente
- Progress tracking en tiempo real para crawling

### 4. **@operezol/scraper-web** (Web Dashboard) 🆕

- React 18 + TypeScript + Vite + Tailwind
- Dark theme moderno con gradientes
- Formulario de scraping (URL + selector)
- Visualización de resultados en tiempo real
- Estadísticas (total scrapes, exitosos)
- State management con Zustand
- Proxy a API en desarrollo

---

## 🎯 Features Implementadas

- ✅ **Monorepo** con pnpm workspaces
- ✅ **TypeScript** strict en todos los packages
- ✅ **Shared logic** entre API, CLI y Web
- ✅ **REST API** con Express
- ✅ **CLI tool** con Commander
- ✅ **Web Dashboard** con React + Tailwind
- ✅ **Error handling** robusto
- ✅ **Customizable** (headers, timeout, selectors)
- ✅ **Batch scraping** (múltiples URLs)
- ✅ **Link extraction** (enlaces internos a CSV)
- ✅ **Recursive crawling** (visita todas las páginas con tracking)
- ✅ **Crawl dual FXStreet** (www vs QA, Next vs Sitefinity, CSV comparativo por path)
- ✅ **Real-time results** en dashboard

---

## 🏗️ Arquitectura

```
web-scraper-toolkit/
├── packages/
│   ├── shared/          # Lógica compartida
│   │   ├── src/
│   │   │   ├── scraper.ts            # WebScraper class
│   │   │   ├── env-detect.ts         # Next vs Sitefinity
│   │   │   ├── link-extract.ts       # Enlaces internos desde HTML
│   │   │   ├── dual-origin-crawl.ts  # Crawl www+qa FXStreet
│   │   │   ├── types.ts              # TypeScript types
│   │   │   └── utils.ts              # Utilities
│   │   └── package.json
│   ├── api/             # REST API (Express)
│   │   ├── src/
│   │   │   └── index.ts      # API server
│   │   └── package.json
│   ├── cli/             # CLI tool (Commander)
│   │   ├── src/
│   │   │   └── cli.ts        # CLI commands
│   │   └── package.json
│   └── web/             # Web Dashboard (React)
│       ├── src/
│       │   ├── App.tsx       # Main component
│       │   ├── store/        # Zustand store
│       │   └── services/     # API client
│       └── package.json
├── package.json         # Root package
├── pnpm-workspace.yaml
└── README.md
```

---

## 🚀 Uso

### Web Dashboard

```bash
pnpm dev                    # API + Web juntos
# http://localhost:5173
```

### API

```bash
pnpm dev:api               # Solo API
# http://localhost:3000

curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "selector": "h1"}'
```

### CLI

```bash
pnpm --filter @operezol/scraper-cli start scrape https://example.com
pnpm --filter @operezol/scraper-cli start scrape https://example.com -s "h1"
pnpm --filter @operezol/scraper-cli start batch urls.txt -o results.json
pnpm --filter @operezol/scraper-cli start links https://example.com -o links.csv
pnpm --filter @operezol/scraper-cli start crawl https://example.com -o crawl-links.csv -m 100

# FXStreet: www + QA, CSV con entorno por columna (path normalizado)
pnpm --filter @operezol/scraper-cli start fxstreet-dual -o fxstreet-www-qa-env.csv
```

---

## 📊 Métricas del Proyecto

**Líneas de código:** orden ~10³ (aprox.; crece con nuevos módulos shared/CLI)  
**Packages:** 4  
**Dependencias principales:**

- axios, cheerio (scraping)
- express, cors (API)
- commander, chalk, ora (CLI)
- react, zustand, tailwindcss (Web)

**Tiempo de desarrollo:** ~2 horas  
**Commits:** 2

---

## 🎨 Valor del Proyecto

**Demuestra:**

- ✅ Arquitectura de monorepo con pnpm workspaces
- ✅ TypeScript strict en proyecto complejo
- ✅ Shared logic entre múltiples packages
- ✅ REST API con Express
- ✅ CLI tool profesional
- ✅ React dashboard moderno
- ✅ State management (Zustand)
- ✅ Tailwind CSS + diseño oscuro
- ✅ Error handling y validación
- ✅ Proxy de desarrollo (Vite)

---

## 📝 Documentación

- ✅ README.md completo con ejemplos
- ✅ Tipos TypeScript documentados
- ✅ Comentarios en código clave
- ✅ Ejemplos de uso para cada package

---

## 🔄 Consolidación Exitosa

**Repos eliminados:**

- ❌ web-scrapper-api (primitivo)
- ❌ web-scrapper-cli (primitivo)

**Repo nuevo:**

- ✅ web-scraper-toolkit (monorepo profesional + GUI)

**Mejoras sobre versiones anteriores:**

- Arquitectura de monorepo
- TypeScript strict
- Shared logic (DRY)
- Web dashboard moderno
- Mejor error handling
- Documentación completa

---

## 🚀 Próximos Pasos (Opcional)

Si se retoma el proyecto:

- [ ] Tests unitarios (Vitest)
- [ ] Tests E2E para dashboard (Playwright)
- [ ] Deploy de dashboard (Vercel/Netlify)
- [ ] Deploy de API (Railway/Render)
- [ ] Rate limiting en API
- [ ] Autenticación (opcional)
- [ ] Más selectores CSS avanzados
- [x] Export de resultados (CSV para enlaces)
- [x] Extracción recursiva de enlaces (crawling profundo)
- [ ] Historial persistente (localStorage)
- [ ] Filtros avanzados para enlaces (por patrón, extensión)
- [ ] Crawling paralelo para mayor velocidad
- [ ] Respeto de robots.txt
- [x] Comparativa FXStreet www vs QA (Next / Sitefinity, CSV por path)

---

## ✨ Conclusión

Proyecto completado exitosamente. Demuestra capacidad de:

- Diseñar arquitecturas de monorepo
- Compartir lógica entre packages
- Crear APIs REST
- Desarrollar CLI tools
- Construir dashboards React modernos
- Integrar múltiples tecnologías

**Estado:** Listo para portfolio ✅

---

**Última actualización:** 6 Mayo 2026 (documentación: crawl dual FXStreet, README y estado)  
**Autor:** Oriol Pérez Olivares
