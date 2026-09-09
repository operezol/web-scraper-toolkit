# Documentación del proyecto

| Documento | Rol (fuente de verdad) |
|-----------|------------------------|
| [../README.md](../README.md) | Uso actual: install, CLI, API, API programática |
| [../PROJECT_STATUS.md](../PROJECT_STATUS.md) | Inventario de lo existente + **roadmap único** (*next coming*) |
| [crawl-architecture-plan.md](crawl-architecture-plan.md) | Diseño: base vs scripts específicos, promoción si ≥2 usos, capas, filtros, `ArticlePathRule` |
| [flexible-compare-crawl.md](flexible-compare-crawl.md) | Contrato: JSON `compare-crawl`, tipos de regla HTML, salidas, CLI |

**Regla anti-duplicado:** objetivos y checkboxes solo en `PROJECT_STATUS.md`. Diseño de capas/filtros solo en `crawl-architecture-plan.md`. Schema JSON y catálogo de reglas HTML solo en `flexible-compare-crawl.md`.

**Ciclo de cambio:** cada script específico nuevo o evolucionado → actualizar docs (+ base si hay promoción). Ver [crawl-architecture-plan.md](crawl-architecture-plan.md) §0.
