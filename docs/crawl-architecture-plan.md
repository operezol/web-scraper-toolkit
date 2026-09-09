# Plan: arquitectura en capas del crawl

**Estado:** diseño aprobado · pendiente de implementación en código  
**Actualizado:** 3 septiembre 2026

Roadmap y checkboxes: [PROJECT_STATUS.md](../PROJECT_STATUS.md).  
Contrato compare-crawl (JSON, reglas HTML): [flexible-compare-crawl.md](flexible-compare-crawl.md).  
Índice docs: [README.md](README.md).

---

## 0. Modelo de producto

| Pieza | Rol |
|-------|-----|
| **Base generalista** (`shared` + CLI genérica `scrape` / `links` / `crawl` / futuro `compare-crawl`) | Caja de herramientas abstracta: fetch, extract, crawl, normalización, reglas de path, evaluación de labels por config. **No** conoce un site concreto. |
| **Scripts específicos** (`fxstreet-es`, `fxstreet-dual`, futuros scrapers de otros dominios) | Productos finos: hosts, URLs, presets, columnas CSV, UX del comando. Se **construyen sobre** la base. |

**Promoción a la base (regla práctica):**

1. Implementar primero en el script específico si solo ese script lo necesita.
2. Si la **misma** capacidad aparece (o está a punto de aparecer) en **≥ 2 scripts específicos** → extraerla a la capa abstracta y que ambos scripts la consuman.
3. No meter en la base atajos de un solo dominio (“solo FXStreet”) disfrazados de genéricos; sí meter el *patrón* configurable (p. ej. “detectar label por reglas HTML”, no “detectar Sitefinity”).

Así la base crece por **reutilización real**, no por especulación.

### Ciclo al añadir o cambiar un script específico

Cada script que cubre una **necesidad concreta** (p. ej. listado ES, compare www/QA, otro site) dispara, si aplica:

1. **Script** — implementar o ajustar el comando/módulo específico (hosts, preset, CSV, UX).
2. **Base** — reescribir o extraer a la capa A lo que ya cumpla la regla de promoción (≥2 usos, o patrón claramente reutilizable ya usado dos veces).
3. **Documentación** — actualizar en el mismo lote lo que corresponda:
   - inventario / roadmap: [PROJECT_STATUS.md](../PROJECT_STATUS.md)
   - uso actual: [README.md](../README.md) (CLI del script nuevo)
   - diseño si cambió el contrato de la base: este doc y/o [flexible-compare-crawl.md](flexible-compare-crawl.md)
   - índice: [README.md](README.md) solo si hay doc nuevo

No dejar scripts específicos “huérfanos” de docs, ni docs que describan una base que el código ya no refleja.

---

## 1. Capas

| Capa | Incluye | Excluye |
|------|---------|---------|
| **A — Base / motor** | Normalización URL, BFS, dedupe, opciones de crawl, `ArticlePathRule`, `evaluateDetection(html, config)`, helpers CSV genéricos, **checkpoint periódico de resultados** (+ resume en incremento posterior) | Hosts FXStreet; labels `next`/`sitefinity` fijos en TypeScript |
| **B — Presets** | JSON/ejemplos por site: origins, article rules, `detection.definitions` | Lógica de fetch duplicada |
| **C — Scripts específicos** | `fxstreet-es`, `fxstreet-dual`, …: defaults de URL/host, nombre CSV, cableado al preset | Copiar-pegar del motor; reimplementar strip-query o detección si ya está en A |

**Criterio rápido:** ¿lo usan (o lo usarán ya) dos scripts? → A. ¿Es “en este site las noticias son `…/news/…`”? → B/C.

---

## 2. Filtros del crawl genérico (defaults)

**Filtros activos por defecto**; opt-out explícito para crawl “crudo”.

| Filtro | Default | Opt-out CLI (tentativo) |
|--------|---------|-------------------------|
| Strip query (unicidad / fetch) | on | `--keep-query` |
| Strip hash | on | `--keep-hash` |
| Excluir paths de artículo según reglas | on | `--keep-articles` |

Breaking de `crawl` a documentar en README al implementar.

---

## 3. Piezas de la capa A

### 3.1 Normalización URL

- Módulo orientativo: `url-normalize`.
- `keepQuery` / `keepHash` (default `false`).
- Misma clave en `visited`, cola y CSV.

### 3.2 `ArticlePathRule`

Bajo una sección (`news`, `blog`, …) conviven landings, feeds y posts: no usar un glob ciego `**/news/**`.

```ts
interface ArticlePathRule {
  section: string;
  match: "slug-after-section" | "min-slug-depth" | "path-regex";
  allowSegments?: string[]; // p.ej. feed, latest — nunca artículo
}
```

- Varias reglas en **OR** → si alguna marca artículo y `excludeArticles` → descartar.
- Landings `…/{section}` se conservan.
- v1.1 opcional: heurística `slug-looks-like-article` si la allowlist crece demasiado.
- Otros sites: otras `section` / `match` / regex, sin fork del motor.

### 3.3 Detección de framework / label (abstracta)

El motor **no** conoce Next ni Sitefinity. Solo:

- `definitions`: `{ label, rules[], combine? }`
- política de conflicto / `fallbackLabel` / `conflictLabel`
- `evaluateDetection(html, detectionConfig) → label`

Labels concretos (`next`, `sitefinity`, `wordpress`, …) = **preset**. Tipos de regla HTML: [flexible-compare-crawl.md](flexible-compare-crawl.md) §5.

### 3.4 API de crawl genérico

- `CrawlOptions`: `maxPages?` (**opt-in**, ver abajo), `delayMs`, keepQuery/Hash, `excludeArticles`, `articleRules?`, `detection?` (opcional), `checkpointEvery?`, rutas de checkpoint (ver §3.5).
- CLI `crawl`: opt-outs + `--article-section` / `--article-allow` / `-m` / `--checkpoint-every` / etc.

**Límite de páginas (`maxPages` / `-m`):** solo aplica si se especifica. Sin flag / `undefined` → **sin tope** (hasta vaciar la cola o error). Breaking respecto a hoy (`crawl` 100, `fxstreet-es` 10 000, `fxstreet-dual` 50 000). Scripts específicos dejan de imponer caps por defecto; el usuario pasa `-m` cuando quiera un safety cap.

### 3.5 Checkpoint periódico (capa A)

**Hoy:** crawls como `fxstreet-es` solo escriben el CSV **al terminar**; si el proceso muere, se pierde el progreso en disco.

**Destino (base genérica):** flush de resultados cada N páginas (p. ej. 100), no por cada URL. Motivación: crawls largos (`crawl`, `fxstreet-es`, `fxstreet-dual`, futuro `compare-crawl`). Cumple regla de promoción (≥2 scripts).

| Incremento | Qué |
|------------|-----|
| **A1 — Flush parcial** | Solo si se especifica `checkpointEvery` / `--checkpoint-every <n>` (`n` > 0). Default **off** (`0` o ausente): comportamiento actual (escribir al terminar). Con `n` (p. ej. 100): flush cada N resultados. Al acabar: CSV final y limpiar parcial si aplica. |
| **A2 — Resume** | Solo si se pide (`--resume` / `resume: true`); persiste `visited` + cola. |

Opciones tentativas en `CrawlOptions` / CLI:

- `checkpointEvery?: number` → `--checkpoint-every <n>` (**opt-in**; sin flag = sin flush parcial)
- `checkpointPath?: string` → fichero parcial (default derivado de `-o`)
- A2: `resume?: boolean` (**opt-in**), path del estado de cola/visited

Los **scripts específicos** solo pasan N y rutas; el motor ejecuta el flush. Formato del parcial alineado con la salida del crawl (CSV genérico o filas ya tipadas vía callback `onCheckpoint(pages)` si el formateo es del script).

**Nota:** A1 evita perder el *listado*; sin A2, al reiniciar se puede re-visitar URLs ya hechas. A2 es el complemento.

---

## 4. Capa B/C — scripts FXStreet (sobre la base)

| Concern | Dónde |
|---------|--------|
| Hosts `.com` / `.es`, start URLs | Script / preset |
| Labels `next` + `sitefinity` + selectores/metas | Preset `detection.definitions` |
| Article: `section: "news"|"analysis"`, allow `feed`, `latest` (CSV ES 2026-09: landings + esos segmentos; resto = posts) | Preset `FXSTREET_ARTICLE_RULES` |
| Merge www vs qa | Base compare (cuando exista) + script dual que la invoca |
| Comandos `fxstreet-es`, `fxstreet-dual` | Scripts específicos |

**Ejemplo de promoción:** `fxstreet-es` y `fxstreet-dual` ya comparten detección HTML y crawl BFS → esos patrones deben vivir en la base (`evaluateDetection`, crawl genérico); cada script solo aporta hosts y preset. Hoy aún hay duplicación/hardcode; el refactor sigue la regla §0 cuando el roadmap lo permita.

Hoy hardcodeado en `env-detect.ts`, `dual-origin-crawl.ts`, `fxstreet-es-crawl.ts`.

---

## 5. Criterios de hecho (capa A)

- Sin flags de filtro: query/hash fuera; posts bajo reglas default fuera; landings / `feed` / `latest` dentro.
- Sin `-m` / `maxPages`: el crawl no corta por número de páginas (solo cola vacía o fallo).
- Con `-m N`: para tras N visitas.
- `--keep-articles` / `--keep-query` restauran comportamiento amplio.
- Otro site: solo cambia config (`articleRules` / `detection`).
- `next` / `sitefinity` solo vía preset FXStreet.
- Con `--checkpoint-every 100`, tras un kill artificial queda un parcial usable (~múltiplos de 100 filas); al completar, CSV final coherente. Sin el flag, solo escribe al final (como hoy).
