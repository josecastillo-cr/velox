# Ficha 485 — Producto en «Detalle por guía» de la caja · parte BACKEND

Rama `feat/485-producto-detalle-guia-caja` (base 3e8b100c). sdd:false, complejidad baja. Sin migración:
`cierre_detail.producto` ya existe (foto congelada en el cierre, como `num_remision`/`destinatario`).

## De dónde sale el producto

Trazado con el grafo (`codebase-memory`, proyecto `R-job-singularis-projects-ordenex`) y confirmado en
los archivos: la hoja «Detalle por guía» de la caja la arma `agruparPorGuia`
(`lib/utils/detalle-por-guia.ts`) sobre el `DetalleDeMovimientoLoteDTO` de
`DetalleEnLoteService.detallar`, cuyas órdenes vienen de `CierreAporteRepository.listarAportesDeCierres`
(Prisma, `cierreDetail.findMany` con `SELECT_DE_APORTE`). No hay SQL crudo en este camino.

- `lib/repositories/CierreAporteRepository.ts` — `SELECT_DE_APORTE` gana `producto: true` (línea 107),
  junto a `numRemision`/`destinatario`; `aFilaDeAporte` lo copia a la fila.
- `lib/services/DetalleEnLoteService.ts` — `producto: fila.producto` en `OrdenDelLoteDTO`.
- `lib/utils/detalle-por-guia.ts` — el bloque toma `producto` del MISMO `CierreDelBloque` que la
  remisión: el del cierre más reciente (R39).

Misma fuente y misma regla que la remisión. Las otras superficies (mi-wallet, estados de cuenta de
tienda/mensajero) reciben el campo en el DTO; no se añadió ninguna columna (eso es de frontend_dev y
solo en la caja).

## Archivos

Código:
- `lib/interfaces/repositories/ICierreAporteRepository.ts` — `OrdenAporteRow.producto: string`.
- `lib/repositories/CierreAporteRepository.ts` — select + mapeo.
- `lib/types/detalle-en-lote.ts` — `OrdenDelLoteDTO.producto: string`.
- `lib/services/DetalleEnLoteService.ts` — pasa el campo.
- `lib/types/libro-kardex.ts` — `BloqueDeGuiaDTO.producto: string`.
- `lib/utils/detalle-por-guia.ts` — `CierreDelBloque.producto` y el bloque.

Tests:
- `tests/unit/utils/detalle-por-guia-468.test.ts` — 2 casos nuevos «485»: producto del cierre más
  reciente aunque llegue antes en la hoja (igual que la remisión), y orden sin guía con su producto.
- `tests/integration/db/detalle-en-lote-464.test.ts` — la siembra pone en la orden VIVA
  `"Caja viva"` y en el snapshot `Producto o<n>`; se afirma que cada orden del lote trae `Producto o<n>`
  (Postgres real: el SELECT se ve).
- `tests/unit/services/detalle-en-lote-464.test.ts` — el `toEqual` del DTO incluye `producto`.
- Fixtures que solo ganan el campo obligatorio (typecheck): `tests/components/EstadoCuenta468.test.tsx`,
  `tests/components/WalletCaja468.test.tsx`, `tests/unit/descarga/archivo-identico-470.test.ts`,
  `tests/unit/descarga/libro-kardex-468.test.ts`, `tests/unit/services/busqueda-por-guia-469-servicios.test.ts`,
  `tests/unit/services/detalle-en-lote-468.test.ts`, `tests/unit/services/libro-kardex-468.test.ts`,
  `tests/unit/services/wallet-caja-kardex-470.test.ts`, `tests/unit/services/wallet-detalle-movimiento.test.ts`,
  `tests/unit/services/wallet-tienda-detalle-movimiento.test.ts`.

## Mutaciones (los tests se mataron antes de creerlos; ambas deshechas)

- Quitar `producto: true` de `SELECT_DE_APORTE` → `detalle-en-lote-464` (integración) ROJO:
  1 failed | 5 passed, en `expect(o.producto).toMatch(/^Producto o\d$/)`.
- `producto: cierres[0].producto` (el cierre más antiguo) en `agruparPorGuia` → `detalle-por-guia-468`
  ROJO: 1 failed | 13 passed, en el caso «485: … cierre MAS RECIENTE …».

Corrida dirigida sin mutar: 3 archivos, 42 passed, 0 skipped (la integración corrió contra Postgres).

## Gate

`./init.sh --rapido` → `progress/gate_485_backend.log` (con `INIT_EXIT` dentro).

Resultado: `INIT_EXIT=0` («== init OK ==»). Typecheck y lint sin errores (lint solo con warnings
preexistentes ajenos).

- Tests relacionados (dos tandas del gate): 234 archivos / 3013 passed y 273 archivos / 3755 passed, 0 failed.
- `tests/integration/db` en modo ampliado (toco `lib/types/`): 451 archivos, 4210 passed, 3 failed,
  0 skipped (corrió contra Postgres; ningún archivo saltado).
- Los 3 rojos son de `tests/integration/db/caja-invariante-tiendas.test.ts` (invariante de saldos de la
  caja; no lee `cierre_detail.producto` ni el detalle en lote). El propio gate los repitió AISLADOS:
  9/9 passed, y ese mismo archivo ya había pasado 9/9 en la tanda de relacionados. Se anota como
  INTERMITENTE (base compartida), ajeno al diff.

## Veredicto

OK: `BloqueDeGuiaDTO.producto` llega congelado del cierre más reciente (misma fuente que la remisión), con unit + integración matados por mutación y gate `--rapido` en verde (1 intermitente ajeno anotado).
