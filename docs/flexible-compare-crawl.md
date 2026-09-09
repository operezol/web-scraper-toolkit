# Crawl comparativo configurable (especificación)

Contrato de **configuración y salidas** para un crawl multi-origen con clasificación HTML declarativa.  
Implementación pendiente; alinear código a este doc (o actualizar el doc si cambia el contrato).

**Capas / filtros / article rules:** [crawl-architecture-plan.md](crawl-architecture-plan.md)  
**Roadmap:** [PROJECT_STATUS.md](../PROJECT_STATUS.md)  
**Índice:** [README.md](README.md)

---

## 1. Objetivo

Rastrear uno o más orígenes (enlaces internos por host), clasificar cada página con reglas HTML declarativas, y opcionalmente fusionar por clave de path para comparar la misma ruta entre orígenes.

Casos: prod vs QA; marcas/idiomas con paths compartidos; un solo origen con labels.

---

## 2. Conceptos

| Término | Significado |
|---------|-------------|
| **origin** | `{ id, startUrl }`; solo enlaces del mismo hostname |
| **label** | Resultado de detección (p. ej. en perfil FXStreet: `next`, `sitefinity`) |
| **rule** | Condición booleana sobre el HTML (§5) |
| **definition** | `{ label, rules[], combine? }` |
| **mergeKey** | URL → string para filas comparativas (default: pathname sin trailing slash salvo `/`) |

Principios de producto (base vs scripts, promoción si ≥2 usos): [crawl-architecture-plan.md](crawl-architecture-plan.md) §0.

---

## 3. Formato de configuración (borrador JSON)

Nombre sugerido: `compare-crawl.config.json`.

```json
{
  "$schema": "opcional-en-el-futuro",
  "version": 1,

  "request": {
    "headers": {
      "User-Agent": "Mozilla/5.0 ..."
    },
    "timeoutMs": 25000
  },

  "crawl": {
    "maxPages": null,
    "delayMs": 400,
    "mergeByNormalizedPath": true
  },

  "pathNormalization": {
    "stripTrailingSlash": true,
    "includeQuery": false,
    "includeHash": false
  },

  "urlFilters": {
    "excludeArticles": true,
    "articleRules": [
      {
        "section": "news",
        "match": "slug-after-section",
        "allowSegments": ["feed", "latest"]
      }
    ]
  },

  "origins": [
    { "id": "prod", "startUrl": "https://www.example.com/" },
    { "id": "qa", "startUrl": "https://qa.example.com/" }
  ],

  "detection": {
    "mode": "named-rules",
    "policy": "exclusive-first-match",
    "definitions": [
      {
        "label": "next",
        "rules": [
          { "type": "selectorExists", "selector": "style[data-precedence=\"next\"]" },
          { "type": "anyScriptSrcContains", "substring": "_next" }
        ],
        "combine": "or"
      },
      {
        "label": "sitefinity",
        "rules": [
          {
            "type": "metaContentContains",
            "name": "Generator",
            "substring": "Sitefinity",
            "caseInsensitive": true
          }
        ]
      }
    ],
    "fallbackLabel": "unknown",
    "conflictLabel": "conflict"
  }
}
```

El bloque `detection` del ejemplo es el **perfil FXStreet**; otros configs usan otros `label`. Semántica de `articleRules`: [crawl-architecture-plan.md](crawl-architecture-plan.md) §3.2.

### 3.1 Campos

| Campo | Notas |
|-------|--------|
| `crawl.maxPages` | **Opt-in.** `null` / omitido = sin tope; número = safety cap. CLI: solo limita si se pasa `-m` / `--max-pages`. |
| `pathNormalization.includeQuery` / `includeHash` | Default `false` (filtros on) |
| `urlFilters.excludeArticles` | Default `true`; no glob ciego `**/news/**` |
| `crawl.mergeByNormalizedPath` | Fila por mergeKey; columnas `{id}_label`, `{id}_url` (nombres a fijar en impl.) |
| `detection.policy` | `exclusive-first-match` \| `multi-hit-conflict` (tentativo) |
| `combine` | `and` \| `or` dentro de una definition |

---

## 4. Catálogo de tipos de regla HTML (MVP)

| `type` | Parámetros | Semántica |
|--------|------------|------------|
| `selectorExists` | `selector` | ≥1 match Cheerio |
| `selectorCountMin` | `selector`, `min` | Conteo ≥ `min` |
| `metaContentContains` | `name`, `substring`, `caseInsensitive?` | Meta `content` contiene substring |
| `anyScriptSrcContains` | `substring`, `caseInsensitive?` | Algún `script[src]` |
| `anyLinkHrefMatches` | `pattern` | Opcional; usar con cuidado |

Futuro (fuera MVP): `headerPresent`, `htmlContains`, `selectorTextMatches`.

---

## 5. Salidas

1. **CSV comparativo** — una fila por `mergeKey`; `normalized_path`; por origin `{id}_label`, `{id}_url` (vacío si falta).
2. **Opcional después** — JSON Lines por URL; SQLite / CSV de errores HTTP.

---

## 6. CLI (borrador)

```text
scraper compare-crawl --config ./compare-crawl.config.json -o ./out.csv
```

Overrides de ejecución: `--max-pages`, `--delay`, `--timeout`, `-o`.  
`fxstreet-dual` / `fxstreet-es` permanecen como **atajos** que cargan el preset FXStreet (no sustituyen el contrato `--config`).

---

## 7. Gap vs código actual

| Hoy | Destino |
|-----|---------|
| `dual-origin-crawl.ts` hosts/columnas fijas | Motor + config `origins` |
| `fxstreet-es-crawl.ts` detección hardcodeada | Wrapper + mismo motor/preset |
| `env-detect.ts` Next/Sitefinity en TS | `evaluateDetection` + definitions en JSON |
| CLI `crawl` sin filtros default ni checkpoint; `-m` con default numérico | Capa A: filtros; checkpoint opt-in; **`-m` solo si se pasa** (sin flag = sin tope) |
| Salida solo al final del crawl | Checkpoint A1/A2 en base (§3.5 del plan de arquitectura) |

Orden de trabajo: solo en [PROJECT_STATUS.md](../PROJECT_STATUS.md).

**Versión:** 1.3 · **Fecha:** 3 septiembre 2026
