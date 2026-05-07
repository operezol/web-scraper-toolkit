# Crawl comparativo configurable (especificación previa a implementación)

Este documento define **qué** debe hacer la herramienta y **cómo** se expresa por configuración, **sin** acoplar URLs, hosts ni selectores HTML a código fuente. La implementación en `packages/shared` y la CLI vendrá **después** de validar este diseño.

---

## 1. Objetivo

Permitir **rastrear uno o más orígenes** (mismo sitio en distintos hostnames o entornos), **solo enlaces internos** por origen, y **clasificar cada página** según **reglas declarativas** sobre el HTML (presencia de selectores, metas, patrones en atributos, etc.). Opcionalmente, **fusionar resultados por una clave normalizada de URL** (p. ej. pathname) para comparar “la misma ruta” entre orígenes.

Casos de uso:

- Comparar producción vs QA (como FXStreet hoy).
- Comparar dos marcas / idiomas que comparten estructura de paths.
- Un solo origen con clasificación por reglas (sin comparación cruzada).

---

## 2. Principios

| Principio | Descripción |
|-----------|-------------|
| **Sin hardcode en código** | Orígenes, User-Agent, límites, reglas de detección y normalización viven en **config** (JSON recomendado para MVP; YAML opcional después). |
| **Reglas de detección declarativas** | Los “entornos” o etiquetas (p. ej. `next`, `sitefinity`) se definen como **conjuntos de condiciones** evaluables con Cheerio, no como `if` fijos en TypeScript. |
| **Orígenes arbitrarios** | Lista de `{ id, startUrl }`. El `id` es estable y sirve para columnas CSV y logs (p. ej. `prod`, `qa`, no solo `www`/`qa`). |
| **Un motor, varios modos** | El mismo núcleo puede: crawl de un solo origen con clasificación; crawl multi-origen con cola unificada; merge por clave configurable. |
| **Comportamiento ante conflictos explícito** | Si varias reglas “marcan” la misma página, la política debe ser configurable (`first-match`, `multi-label`, `conflict-token`). |

---

## 3. Conceptos

- **Origen (`origin`)**: `id` único + URL inicial. El crawl solo sigue enlaces cuyo hostname coincide con el de la página actual (comportamiento actual de enlaces internos).
- **Etiqueta / clase (`label`)**: valor de salida cuando coinciden las reglas de una definición con nombre (p. ej. `"next"`, `"sitefinity"`).
- **Regla (`rule`)**: condición booleana sobre el documento (ver §5).
- **Definición de detección (`detector`)**: nombre + lista ordenada de reglas (AND dentro de una definición; OR entre definiciones según política global).
- **Clave de merge (`mergeKey`)**: función configurable de URL → string para agrupar filas del CSV comparativo (por defecto: pathname sin trailing slash salvo `/`).

---

## 4. Formato de configuración (borrador JSON)

Nombre sugerido del fichero: `compare-crawl.config.json` (convención; no obligatorio).

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
    "maxPages": 50000,
    "delayMs": 400,
    "mergeByNormalizedPath": true
  },

  "pathNormalization": {
    "stripTrailingSlash": true,
    "includeQuery": false
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

### 4.1 Campos aclarados

- **`crawl.mergeByNormalizedPath`**: si es `true`, la salida principal incluye una fila por clave mergeada con columnas `{mergeKey}_{id}_label` y `{mergeKey}_{id}_url` (nombres exactos a fijar en implementación).
- **`detection.policy`** (valores tentativos):
  - `exclusive-first-match`: primera definición cuyas reglas se cumplen gana; si dos definiciones podrían aplicar según orden, solo la primera.
  - `multi-hit-conflict`: si más de una definición coincide → `conflictLabel`.
- **`combine`** dentro de una definición: `and` | `or` entre reglas de esa definición (FXStreet actual es OR entre “estilo next” y “script _next”; AND entre meta Sitefinity implícito en una sola regla).

Los valores concretos de `policy` y nombres de campos CSV se pueden ajustar en implementación siempre que este documento se actualice.

---

## 5. Catálogo de tipos de regla (extensible)

MVP sugerido:

| `type` | Parámetros | Semántica |
|--------|------------|------------|
| `selectorExists` | `selector` | Al menos un elemento coincide (Cheerio). |
| `selectorCountMin` | `selector`, `min` | Conteo ≥ `min`. |
| `metaContentContains` | `name`, `substring`, `caseInsensitive?` | Meta `name` (insensible a mayúsculas en nombre) con `content` que incluye substring. |
| `anyScriptSrcContains` | `substring`, `caseInsensitive?` | Algún `script[src]` contiene la substring. |
| `anyLinkHrefMatches` | `pattern` (regex string) | Opcional; útil para patrones internos (con precaución). |

Reglas futuras (fuera del MVP si no hace falta): `headerPresent`, `htmlContains`, `selectorTextMatches`.

---

## 6. Salidas esperadas

1. **CSV principal (comparativo)**  
   Una fila por `mergeKey` ordenado. Columnas mínimas:
   - `normalized_path` (o nombre configurable)
   - Por cada `origin.id`: `{id}_label`, `{id}_url`  
   Origen sin datos para esa clave: celdas vacías.

2. **Opcional (implementación posterior)**  
   JSON Lines con un objeto por URL visitada (auditoría).  
   SQLite / segundo CSV de errores HTTP.

---

## 7. Interfaz CLI (borrador)

Sin implementar aún; sirve como contrato orientativo:

```text
scraper compare-crawl --config ./compare-crawl.config.json -o ./out.csv
```

Opciones que podrían **sobrescribir** solo para la ejecución (sin editar el fichero):

- `--max-pages`, `--delay`, `--timeout`
- `--output` / `-o`

El comando actual `fxstreet-dual` puede mantenerse como **atajo** que carga un perfil por defecto equivalente al JSON de ejemplo FXStreet, o deprecarse a favor de `--config` más un ejemplo en `examples/`.

---

## 8. Estado actual del código vs esta especificación

| Pieza actual | Relación |
|--------------|----------|
| `dual-origin-crawl.ts` | Solo dos hosts fijos; merge y CSV con columnas `www`/`qa` fijas. Sustituir por motor driven por config. |
| `env-detect.ts` | Reglas Next/Sitefinity en código. Sustituir por evaluador de `detection.definitions` desde config; opcionalmente mantener helpers de ejemplo o tests. |
| CLI `fxstreet-dual` | Atajo temporal; alinear con `compare-crawl --config`. |

---

## 9. Fuera de alcance del primer incremento (opcional)

- Resume / checkpoints.
- robots.txt y crawling paralelo (documentados en roadmap global).
- UI web para editar config.

---

## 10. Orden sugerido de implementación (después de aprobar este doc)

1. Tipos TypeScript + validación ligera del JSON (`version`, `origins`, `detection`).
2. Motor `evaluateDetection(html, detection)` + tests con fragmentos HTML.
3. `compareCrawl(config)` reemplazando la lógica duplicada de `crawlDualFxstreet`.
4. Merge genérico por `origin.id` y generación CSV.
5. Comando CLI `compare-crawl`; perfil de ejemplo FXStreet en `examples/compare-crawl.fxstreet.json`.
6. Actualizar README y deprecación documentada de `fxstreet-dual` si aplica.

---

## Referencias internas

- Roadmap general: `PROJECT_STATUS.md` → sección *Crawl multi-origen y comparación de “entorno”*.

**Versión del documento:** 1.0 · **Fecha:** 6 mayo 2026
