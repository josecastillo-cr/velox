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

---

# Ficha 485 · parte FRONTEND

Búsqueda: el MCP `codebase-memory` no se usó en esta parte; los puntos de entrada venían dados y se
leyeron con `grep`/lectura directa de los archivos.

## Qué cambia

- `components/shared/wallet/libro-kardex-labels.ts` — `COLUMNA_LIBRO.producto` (`"Producto"`). Solo la
  declara la caja; añadirla al catálogo compartido no cambia ninguna otra lista.
- `app/(app)/wallet/_components/wallet-ledger-descarga-columnas.ts` —
  `COLUMNAS_DESCARGA_DETALLE_GUIA_CAJA` gana `COLUMNA_LIBRO.producto` justo tras `remision`.
  `filaCabeceraGuiaCaja` añade `producto: bloque.producto` SOBRE la cabecera compartida
  (`filaCabeceraDeGuia` NO se toca): las cabeceras de tienda, mensajero y mi-wallet quedan idénticas.
  Las filas de concepto y el «Total de la guía» no llevan la clave ⇒ celda vacía, igual que la remisión.
- `FIJAS_DETALLE_POR_GUIA` sin cambios ⇒ «Producto» es desmarcable.
- Preferencia (`lib/columnas/preferencia-columnas.ts`): es lista de EXCLUSIÓN (`ocultas`); una clave
  nueva sale marcada y `ordenEfectivo` la ancla tras su vecina de catálogo (`remision`). Vale también
  para una preferencia guardada antes de este cambio (test con el JSON viejo escrito a mano).

Hoja «Detalle por guía» de la caja: Guía · Remisión · Producto · Destinatario · Tienda · Mensajero ·
Cierre · Resultado · Concepto · Detalle · Entra · Sale · Cobrado a tiendas.

## Tests (`tests/unit/descarga/libro-kardex-468.test.ts`)

- Contratos R29 (encabezados y claves de la caja) con «Producto»/`producto` tras «Remisión», a mano.
- R34: la cabecera de la caja incluye `producto: "Camisa"`.
- Bloque «485» nuevo: ninguna otra lista (detalle de tienda/mensajero/mi-wallet, hojas «Movimientos»)
  lleva `producto`; la cabecera de la caja trae el producto de SU bloque y las filas de concepto no;
  las cabeceras de tienda/mensajero/mi-wallet no emiten `producto`; no está en `columnasFijas`; sale
  marcada tras «Remisión» sin preferencia y con una preferencia vieja.

Mutaciones (todas ROJAS y deshechas): quitar la columna de la caja (4 rojos); meter `producto` en las
fijas (2); quitarlo de `filaCabeceraGuiaCaja` (2); añadirlo a `filaCabeceraDeGuia` compartida (1);
añadir la columna a la hoja de tienda (3); rellenarlo en las filas de concepto (1).

Además, `tests/components/WalletCaja468.test.tsx` (archivo real de la caja, Excel leído): encabezados de
la hoja 2 con «Producto», índice de Concepto 7→8, la cabecera del bloque con `"Camisa"`, la fila de
concepto con la celda de producto vacía y la cabecera del bloque sin guía con `"Gorra"`.

## Gate

`./init.sh --rapido` → `progress/gate_485_frontend.log` (`INIT_EXIT=0`, «== init OK ==»).
- Primera corrida (`progress/gate_485_frontend_1.log`, `INIT_EXIT=1`): rojo PROPIO en
  `WalletCaja468.test.tsx` (contrato de columnas del archivo sin «Producto»), arreglado arriba.
- Corrida final: typecheck y lint sin errores (235 warnings preexistentes). Relacionados 237 archivos /
  3039 passed y 273 / 3755 passed, 0 failed. `tests/integration/db` (ampliado por el diff
  de backend de la rama, `lib/types/`): 451 archivos, 4204 passed, 9 skipped,
  1 archivo rojo `liquidacion-reparto-migration.test.ts` (205 bloque B, restricciones de Postgres; ajeno
  al diff). Repetido AISLADO por el gate: 24/24 passed ⇒ INTERMITENTE (base compartida).

## Veredicto frontend

OK: «Producto» tras «Remisión» solo en la hoja «Detalle por guía» de la caja, desmarcable y marcado
por defecto (también con preferencias viejas); las otras superficies sin cambios.
