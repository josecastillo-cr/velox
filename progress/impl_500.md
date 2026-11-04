# Ficha 500 — Bitácora de implementación (backend, rama principal R1–R23)

> backend_dev, 2026-11-03 19:00–19:45. Rama `fix/500-deuda-satelites-zonas`, worktree `R:/w500`.
> Búsqueda: MCP `codebase-memory` no se usó en esta sesión (se fue directo a los archivos citados en el
> spec, que ya traían archivo:línea); cada símbolo se confirmó leyendo el archivo real.
> Bloque 8 (R24–R30) NO se tocó: puerta P8, no autorizado. Nada de UI.

## T0 · Arranque

- SHA base: `d4e8d52b` (= `origin/dev`). `git merge-base --is-ancestor 0c18a7aa HEAD` → OK (la 498 dentro).
- Existen `db/migrations/20261102130100_zona_distrito_unico_499` y `20261103120300_satelite_498_regularizar`.
- `prisma migrate status` → «Database schema is up to date!» (241 migraciones) antes de empezar.
- `progress/gate_500_arranque.log`: **INIT_EXIT=1, NO VÁLIDO como arranque**. Lo lancé en segundo plano y
  edité el árbol mientras corría (memoria «Gate y mutaciones no en paralelo»): `--changed origin/dev` vio
  mi diff a medias. Sus 11 rojos (4 archivos de dobles: `cierre-bodega-repository`,
  `cierre-pagos-lectura`, `cierres-bodega-admin-marca`, `cierres-bodega-admin-repository`) eran
  **reales y míos**: dobles de Prisma sin los delegados que lee `consolidacionesConDinero`. Arreglados en
  `3017fae3`. El gate que cuenta es el de cierre (abajo).

## T1 · Bloque 2 — backend (R1–R4)

- **T1.1 índices** (`db/schema.prisma`): los tres libros tienen índice que empieza por
  `(origen_tipo, origen_id)`: `WalletMovimiento` `@@index([origenTipo, origenId])` (model en :1825, +39),
  `WalletTiendaMovimiento` (model :1941, +29), `PagoMensajeroMovimiento` (model :2018, +33). Nada que crear.
- **T1.2** `tests/integration/db/500-con-dinero-sql-real.test.ts` (A–E). `consolidacionConDosCierres`
  movido a `tests/integration/db/498/_satelite.ts` sin cambiar el cuerpo; el 498 lo importa.
  **Desviación de proceso:** escribí la función antes que el test, así que no hay salida ROJA previa por
  ausencia del símbolo. La prueba de que el test muerde está en las mutaciones T6.1 y T6.2 (abajo).
- **T1.3** `lib/repositories/consolidaciones-con-dinero.ts` (5 consultas, en serie: dentro de un `tx`
  interactivo `pg` avisa de consultas concurrentes). `revertirConciliacion` lo usa; `tieneAsientos`
  borrado. `marca-conciliacion.int.test.ts` + `498-conciliar-asienta-sql-real.test.ts`: 36/36 verdes.
- **T1.4** `puedeDesmarcarse` en `lib/utils/conciliacion-satelite.ts`; tabla de verdad (8 filas) en
  `tests/unit/utils/conciliacion-satelite.test.ts`.
- **T1.5** `puedeDesmarcar` en `ConsolidacionSateliteDTO`, en `findConsolidacionesPaginado` y
  `findConsolidacionesCompleto` (una llamada por página), y en `findCierreBodegaConDetalle` →
  `ICierresBodegaAdminRepository` → `CierresBodegaAdminService.verCierreBodegaDetalle` (propaga tal cual)
  → `CierreBodegaDetalleServiceResult`. La acción `verCierreBodegaDetalle` devuelve el resultado del
  servicio, no hubo que tocarla. Test de servicio: `cierres-bodega-admin-service.test.ts` «FICHA 500
  (R3/R4) — el detalle propaga…».
- Fixtures de tests de componente/descarga ganaron `puedeDesmarcar: false` (solo para compilar; ninguna
  aserción cambia): `CierreBodegaDesglosePorTienda`, `CierreBodegaDetalleCascadas`,
  `CierreBodegaDetalleGestiones`, `DineroIdentidadesEnPantalla`, `Conciliacion498`,
  `integration/wallet-satelites.test.tsx`, `saldos-satelites-descarga-columnas`.

## T2 · Bloques 3 y 4 (R9–R11)

- R9 en `500-con-dinero-sql-real.test.ts` (B: sin cierres, marcada 90 sobre 100 → 1 ajuste de 10 + egreso
  de 10; revertir → `con_asientos`, huella md5 de `cierre_bodega`, `conciliacion_bodega_ajuste`, los tres
  libros e `historial_accion` igual antes y después). Verde con el código de la 498, como preveía el spec.
- `tests/integration/db/500-esperado-una-formula-sql-real.test.ts` (R10, R11): literales `7000.00`,
  `6900.00`, `100.00` escritos a mano. Verde.

## T3 · Migración (R22)

- `db/migrations/20261104120000_historial_accion_zona_distrito_500/` — `migration.sql` (una sentencia) y
  `down.sql` dinámico (función de la 498 byte a byte salvo el sufijo; lo comprueba el test).
- Aplicada en la base local compartida (`prisma migrate deploy`); `migrate status` limpio.
- up → down → up: medido dentro de una transacción revertida en el test de migración (no se ejecutó el
  down en vivo sobre la base compartida).
- Declarada en `posteriores` de `orden-traspaso-migration.test.ts` (verde).
- `tests/integration/db/historial-accion-zona-distrito-500-migration.test.ts`: forma (una sentencia;
  función igual a la de la 498), down conserva un valor sembrado después, down aborta con una fila viva.
  4/4 verdes.

## T4 · Catálogos y escritura (R12–R21)

- Enum en `db/schema.prisma` con `///`; `prisma generate`; `lib/types/historial-accion.ts`: lista (con
  productor `ZonaRepository.update`), `CATEGORIA_POR_ACCION` → `mueve_dinero`, `ACCION_LABELS` →
  «Cambió los distritos de una zona».
- `diferenciaDeDistritos` y `filasDeCambioDeDistritos` (exportadas, en `ZonaRepository.ts`) y el bloque
  en `update` antes del `return`, con `tx` y `randomUUID()` propio. Texto sin comillas (Q2).
- `tests/integration/db/zona-distrito-rastro-500.test.ts` 7/7 verdes. Desviación: **R17 con repetidos se
  mide en el unitario, no contra Postgres**: `ZonaService` deduplica (`distinct`, `ZonaService.ts:100`)
  antes de llamar al repositorio, y con un id repetido el `createMany` de la N:M ya fallaba por la PK
  antes de la 500. Contra Postgres se mide «otro orden».
- R18 «error forzado»: `clienteConSavepoint(tx, true)` rompe `historialAccion.createMany`; la premisa
  (`RegistroCaido`) se afirma.
- Unitarios: `tests/unit/repositories/zona-distritos-rastro-500.test.ts`. `zona-repository.test.ts`:
  el doble gana `distrito.findMany` y tres casos que afirman «no se registró nada» declaran que la zona
  ya tenía `d1` (`conDistritosPrevios`).
- Vecinos verdes: `zona-central-guarda-y-rastro`, `zona-distrito-unico-499`,
  `zona-guardado-conserva-inactivos`, `zona-pago-mensajero-rastro`, `zona-reconciliacion-ordenes` (75/75).
- **T4.4 guardias** (a mano): `historial-accion-*.guardia`, `tests/unit/historial-accion/`,
  `historial-acciones-filtros-def`: 240/240. Conteos 65→66 y mueve_dinero 43→44; entrada de censo
  `zona_distrito_cambiado` → `ZonaRepository.update`, mutación `tx.zonaDistrito.deleteMany(`.
  `historial-accion-sin-datos-cliente` no pidió declaración.

## T5 · Textos (R23)

- Lista cerrada: `lib/constants/wallet-rotulos.ts:73-74` (las dos etiquetas),
  `components/shared/conciliacion/conciliacion-labels.ts:118` (`NOTA_CONCILIACION_ASIENTA`),
  `app/(app)/wallet/_components/wallet-labels.ts:106-108` (pistas) y `:305` (dueño «Satélite»),
  `app/(app)/wallet/_components/CajaResumenCard.tsx:148` (elige la pista), y
  `tests/components/{CajaResumenCard498,Conciliacion498,WalletLedgerSatelite498}.test.tsx`.
- Guardia `tests/unit/guards/textos-satelite-definitivos-500.guardia.test.ts`: ROJA antes de T5.3
  («lib/constants/wallet-rotulos.ts no contiene ninguna marca de provisional — expected [ Array(1) ] to
  deeply equal []»); verde tras reescribir el comentario. Autocomprobación incluida.

## T6 · Mutaciones (salida real; cada una revertida con `git checkout -- lib/`, `git diff` VACÍO)

Arnés: script de un solo uso en el scratchpad que exige 1 coincidencia exacta (si no, aborta) e imprime
`git diff --stat` de la mutación. Primera tanda abortó por un `print` de unicode en cp1252 a mitad de
T6.1/T6.2/T6.5 (contaminó T6.2 con T6.1); se revirtió todo y se repitieron limpias. Las de abajo son las
limpias.

| # | Mutación | Resultado |
| --- | --- | --- |
| T6.1 | sin la consulta de ajustes | ROJO: R1, R9, R3 ×2, R4 (5 failed / 8) |
| T6.2 | `puedeDesmarcarse` sin `!saldadaReglaAnterior` | ROJO: R3 ×2, R4 (3 failed / 8) |
| T6.3 | esperado `general − pago` | ROJO: R10, R11 (2 failed / 3) |
| T6.4 | `faltaPorRecibir` sobre el efectivo | ROJO: R11 (1 failed / 3) |
| T6.5 | diferencia por posición | ROJO: R17 (1 failed / 7) |
| T6.6 | sin el bloque nuevo de `update` | ROJO: R12/13/14/16, R15, R18 (premisa), R21 (4 failed); **la guardia del censo sigue VERDE** (1 de 2 archivos pasó) |
| T6.7 | pago y distritos con el MISMO lote (equivalente a «lote de otra acción»; ver nota) | ROJO: R13 (`zona-distrito-rastro-500.test.ts:214`, «expected true to be false») |
| T6.8 | `valorAnterior`/`valorNuevo` intercambiados | ROJO: R14, R15, R21 |
| T6.9 | sin `valorDeCatalogo` | ROJO: R15 — «The provided value for the column is too long» (22001) |
| T6.10 | `appendAccion(this.prisma, …)` | **SOBREVIVE** (7/7 verdes) |

- Nota T6.7: el lote de la reconciliación de la 366 es local a su bloque; la mutación equivalente que se
  midió es compartir lote con la otra acción del mismo guardado (`zona_pago_mensajero_cambiado`).
- **T6.10 sobrevive y es una limitación del arnés de test, no del código**: `clienteConSavepoint` entrega
  el MISMO proxy como `this.prisma` y como `tx`, así que dentro del test las dos llamadas son
  indistinguibles y romper el registro aborta igual. La atomicidad real la da `appendAccion(tx, …)` y la
  vigila la guardia `historial-accion-punto-unico` / censo `forma: "abre_tx"`. Queda anotado como
  superviviente; no se fuerza el test.

## Mapa R → test (backend)

| R | Test |
| --- | --- |
| R1 | `tests/integration/db/500-con-dinero-sql-real.test.ts` «R1: …exactamente {A, B}», «R1: con ids vacíos no consulta» |
| R2 | ídem «R2: revertir A …» |
| R3 | ídem «R3: /wallet/satelites…», «R3: el detalle de /cierres-admin…»; `tests/unit/utils/conciliacion-satelite.test.ts` (tabla de verdad); `tests/unit/services/cierres-bodega-admin-service.test.ts` «FICHA 500 (R3/R4)» — la parte de componente es del frontend (T7.1) |
| R4 | `500-con-dinero-sql-real.test.ts` «R4: …⇔ revertir tiene éxito…» |
| R5, R6, R7 | frontend (T7.1, `tests/components/ConciliacionAcciones500.test.tsx`) — pendiente |
| R8 | frontend (T7.3) — pendiente |
| R9 | `500-con-dinero-sql-real.test.ts` «R9: revertir B …» |
| R10, R11 | `tests/integration/db/500-esperado-una-formula-sql-real.test.ts` |
| R12, R13, R14, R16 | `tests/integration/db/zona-distrito-rastro-500.test.ts` «R12/R13/R14/R16…»; `tests/unit/repositories/zona-distritos-rastro-500.test.ts` |
| R15 | `zona-distrito-rastro-500.test.ts` «R15…»; unitario «R15» |
| R17 | `zona-distrito-rastro-500.test.ts` «R17: otro orden»; unitario «otro orden y con repetidos» |
| R18 | `zona-distrito-rastro-500.test.ts` «R18: zona inexistente…» y «R18: un error forzado…» |
| R19 | `zona-distrito-rastro-500.test.ts` «R19…» |
| R20 | `tests/unit/historial-accion/catalogo-y-choke-point.test.ts` «FICHA 500 (R20)»; guardia `historial-accion-escrituras-cubiertas` (66 + productor) |
| R21 | `zona-distrito-rastro-500.test.ts` «R21…» (repositorio: categoría, acción y `listAll`); columnas de pantalla/descarga → frontend T7.4 |
| R22 | `tests/integration/db/historial-accion-zona-distrito-500-migration.test.ts` |
| R23 | `tests/unit/guards/textos-satelite-definitivos-500.guardia.test.ts` |

## Contratos para el frontend

- **`consolidacionesConDinero(cliente, ids): Promise<Set<string>>`** (`lib/repositories/consolidaciones-con-dinero.ts`):
  criterio único servidor/pantallas. El frontend NO lo llama: le llega ya resuelto como booleano.
- **`puedeDesmarcarse({ conciliado, conDinero, saldadaReglaAnterior })`** (`lib/utils/conciliacion-satelite.ts`): pura, la usan los repositorios.
- **`/wallet/satelites`**: `ConsolidacionSateliteDTO.puedeDesmarcar: boolean` (`lib/types/conciliacion-satelites.ts`), en
  `findConsolidacionesPaginado` y `findConsolidacionesCompleto`. Montaje esperado:
  `ConciliacionSatelite.tsx:334` → `puedeDesmarcar={c.puedeDesmarcar}`. La descarga no lo muestra.
- **`/cierres-admin`**: `verCierreBodegaDetalle` → `{ status: "ok", …, puedeDesmarcar: boolean }`
  (`CierreBodegaDetalleServiceResult`, `lib/interfaces/services/ICierresBodegaAdminService.ts`). Montaje:
  `CierresBodegaAdminModule.tsx:877` → `puedeDesmarcar={detalle.puedeDesmarcar}`. `toBodegaResumenRow` NO lo lleva.
- `true` solo si conciliada, sin dinero y no saldada con la regla anterior. Los avisos `con_asientos` /
  `saldada_regla_anterior` del servidor no cambian (R7).
- **Historial**: tipo `zona_distrito_cambiado`, categoría `mueve_dinero`, etiqueta «Cambió los distritos de una zona»;
  `valorAnterior`/`valorNuevo` = `Carmen (San José)` (sin comillas, ≤ 60) o `null`; `entidadTipo: "zona"`.
- Ojo para T7: `tests/components/Conciliacion498.test.tsx` y `tests/integration/wallet-satelites.test.tsx`
  tienen ahora `puedeDesmarcar: false` en su fixture base; cuando el componente pase a ocultar
  «Desmarcar» por defecto, los casos de la 498 que pulsan «Desmarcar» tendrán que pasar `true`.

## Gate de cierre

- **Primera pasada** (`progress/gate_500_backend_1.log`, sin commitear): 10 rojos en `tests/integration/db`,
  todos REALES y de esta ficha: los tests de enum del historial fijan la ventana final de
  `historial_accion_tipo` y la lista `POSTERIORES` (`abono-tienda-457`, `caja-459`, `wallet-458`,
  `wallet-461` y seis `historial-accion-*`/`correccion-resultado-gestion` de migración). Arreglados en
  `e6ef0f69` (ventanas corridas 1, conteo 66, `zona_distrito_cambiado` en `POSTERIORES`), 138/138 aislados.
  `ajuste-caja-anulacion-461` también salió rojo y pasó aislado → intermitente.
- **Segunda pasada** (`progress/gate_500_backend.log`): **INIT_EXIT=0**. typecheck y lint verdes. Rapido
  AMPLIADO con toda la integración: 6455 passed / 2 failed / 26 skipped (los 26 son `it.skip` de
  `AnaliticaPage` y `AnaliticaShell`, **0 de integration/db**); integración 4412 / 1 failed.
  Rojos de esa pasada, repetidos AISLADOS dos veces (19/19 verdes las dos) → **intermitentes**:
  - `zona-distrito-unico-499.test.ts` R10: `historial` delta **−3** (un conteo GLOBAL de
    `historial_accion` que bajó por otra transacción de la base compartida; una fila de la 500 lo
    habría subido, no bajado);
  - `corte-diario-segundo-cierre-sql-real.test.ts` (271/T10.3);
  - `SaldosTiendasBuscador463.test.tsx` (componente, fuera del alcance).

## Commits

```
e6ef0f69 test(500): los tests de enum del historial cuentan zona_distrito_cambiado (ventanas y POSTERIORES)
033db045 chore(500): textos de la 498 definitivos y guardia que impide marcarlos provisionales (R23)
fae53478 feat(500): rastro zona_distrito_cambiado al guardar una zona (R12-R22)
3017fae3 test(500): esperado de una sola formula con los literales de H5 (R10, R11); dobles con los delegados de consolidacionesConDinero
a335eb90 feat(500): consolidacionesConDinero compartida y puedeDesmarcar en las dos lecturas (R1-R4, R9)
```

## Qué falta (no es backend)

- T7 entero (frontend_dev): R5, R6, R7, R8, la parte de componente de R3 y las columnas de R21.
- T8.1 de cierre tras el frontend; T9 (bloque 8) bloqueado por P8.

**Veredicto:** backend de R1–R4, R9–R23 hecho y probado contra Postgres; gate `--rapido` INIT_EXIT=0 con 3 intermitentes repetidos aislados en verde; una mutación superviviente explicada (T6.10).
