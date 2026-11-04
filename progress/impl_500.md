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
  down en vivo sobre la base compartida). Desde la revisión m2 el test SÍ reaplica el up tras el down
  (`errorReUp` null y el valor vuelve al final del enum).
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

## Revisión 1 (`progress/review_500.md`, HEAD 55fdee73) — correcciones

- **B1** `500-con-dinero-sql-real.test.ts`: `fotoDeTodo(e, ids)` ya no compara seis tablas enteras; se
  acota a la fila de `cierre_bodega`, sus ajustes, los movimientos de los tres libros con origen en sus
  cierres o en sus ajustes, y el historial con `entidad_id` A/B. Nuevo caso de anti-vacuidad (A: fila,
  caja y historial no vacíos; B: 1 ajuste y 1 movimiento de caja). La foto se afirma ANTES que el estado.
  Aislado 3 veces: 9/9, 9/9, 9/9. Mutaciones repetidas:
  - T6.1 (sin ajustes): ROJO R1, R9, R3 ×2, R4 (5 failed / 9).
  - T6.2 (sin `!saldadaReglaAnterior`): ROJO R3 ×2, R4 (3 failed / 9).
  - Nueva B1.sincorte (quitar el corte `con_asientos` de `revertirConciliacion`): ROJO R2 y R9 **por la
    foto** («expected 'cierre_bodega=1:13b7…' to be 'cierre_bodega=1:ab1d…'» y la de B), y R4. La foto
    acotada sigue cazando el fallo. `git diff -- lib` vacío al terminar.
- **m2** `historial-accion-zona-distrito-500-migration.test.ts`: reaplica el up dentro de la transacción
  revertida y afirma `[...trasDown, VALOR]`. 4/4.
- **m3** `docs/ayuda/oficina/wallet-satelites.md`: «antes de que alguien la marcara» → «antes de que
  alguien corrigiera el monto». `ayuda-wallet-satelites-498.test.ts` no fija esa frase; verde (17/17 junto
  con m2: 21/21).

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

## T7 · Frontend (frontend_dev)

- **T7.1/T7.2** `tests/components/ConciliacionAcciones500.test.tsx` (9 casos, R3/R5/R6/R7): ROJO antes
  del cambio (4/9). `ConciliacionAcciones` con `puedeDesmarcar?: boolean = false`, el botón con
  `estado !== "pendiente" && puedeDesmarcar`, cabecera «recibido sin dinero → Desmarcar»; avisos 498
  intactos (R7). Montajes: `ConciliacionSatelite.tsx` → `c.puedeDesmarcar`; `CierresBodegaAdminModule.tsx`
  → `DetalleAbierto.puedeDesmarcar` copiado de `verCierreBodegaDetalle` y pasado al componente; los dos
  comentarios del módulo actualizados.
  Suites del valor del DTO: `Conciliacion498.test.tsx` (dos conciliadas, solo la `true` ofrece
  «Desmarcar» y revierte SU id) y `CierresBodegaAdminDebe498.test.tsx` (detalle `true` → hay; `false` → no).
  Fixtures: `Conciliacion498` R21 monta con `puedeDesmarcar` (datos viejos, R7); `wallet-satelites`
  INCOMPLETA y COMPLETA con `puedeDesmarcar: true`. Ningún assert cambiado.
- **T7.3** Ayuda `docs/ayuda/oficina/wallet-satelites.md` («Una vez marcada, se corrige»): «**Desmarcar**
  solo aparece en una consolidación que todavía no movió dinero en la caja.» + qué pasa con pantalla
  vieja. Punto nuevo en `ayuda-wallet-satelites-498.test.ts` (R8).
- **T7.4** `tests/components/HistorialAccionesZonaDistrito500.test.tsx` (R21): celdas de pantalla y fila
  de descarga (añadido: «—» → «Carmen (San José)»; quitado: al revés; «Mueve dinero», «Zona», monto null)
  y `accionesDeCategoria("mueve_dinero")` la contiene.
- **T7.5 y demás mutaciones** (cada una con `vitest run` real, revertida, `git diff` vacío):
  - default `puedeDesmarcar = true` → 2 rojos R6 («recibida SIN la prop», «incompleta SIN la prop»);
  - componente ignora la prop → 4 rojos (R3/R5/R6);
  - `ConciliacionSatelite` pasa `false` → rojo el caso 500/R3 de `Conciliacion498`;
  - `CierresBodegaAdminModule` sin la prop → rojo «el detalle dice que se puede»; con `true` fijo → rojo
    «el detalle dice que no»;
  - ayuda sin «solo» → rojo el punto 500/R8;
  - `zona_distrito_cambiado` en `ACCIONES_CON_RESULTADO_EN_VALOR` → 3 rojos R21; categoría cambiada →
    rojo el del filtro.
- **Gate** `progress/gate_500_frontend.log`: **INIT_EXIT=0**; typecheck y lint verdes; rapido ampliado
  6489 passed / 1 failed / 26 skipped (los 26 `it.skip` de Analitica), guardias 3893/1, integración
  4413 passed con 2 archivos rojos. Los 4 rojos repetidos AISLADOS por el propio gate en verde →
  intermitentes: `AnaliticaNoSustitucion` (timeout 20 s), `marca-fuente-unica-493.guardia` (timeout 20 s),
  `ranking-snapshot-migration` y `454/corte-concurrencia` (deadlock de la base compartida).

## T7.6 · Ver la app (frontend_dev, 2026-11-03 21:20–21:45 hora local)

Dev server propio, uno solo: `pnpm exec next dev --webpack -p 3500` desde `/r/w500`. Recorrido con
Playwright (`@playwright/test` por `createRequire`, script en el scratchpad) como **`maestro.local`**
(maestro: lo exige la edición de zonas). Login sin seeds de usuarios: se guardaron `password_hash` y
`updated_at` de `maestro.local`, se puso una clave temporal y al terminar se restauraron **los dos
exactos** (consulta: hash igual; `updated_at` = 2026-09-07 17:37:24.212, el original). Al entrar se abre
el modal ajeno «Confirmá el SINPE de GAM» (se cierra con Escape).

**Siembra** (base local): dos consolidaciones `solicitado` sin cierres en la bodega **Quepos**
(`30d1fad3-…`), por `satelite.qa`: `50000000-0000-4000-8000-00000000000b` (total ₡100) y `…000c` (₡0).
Se marcaron **por la app** (camino real del servidor):

- `…000c` (debe ₡0) marcada con **₡90** → el servidor escribió 1 ajuste `marca` (diferencia −90) y 1
  `wallet_movimiento` `ingreso_diferencia_satelite` de 90 → **con dinero**.
- `…000b` (debe ₡100) marcada con **₡100** → sin ajuste y sin cierres en los libros → **sin dinero**.

**`/wallet/satelites/<id de Quepos>`** (filtro «Todas», texto leído con `innerText`):

| Consolidación | Fila | Botones |
| --- | --- | --- |
| con dinero | «Debe ₡0 · Monto recibido ₡90 · Falta por recibir -₡90 · Recibido · Maestro Local 374 · 3 nov» | **ninguno** (ni «Desmarcar» ni «Corregir») |
| sin dinero | «Debe ₡100 · Monto recibido ₡100 · Falta por recibir ₡0 · Recibido · Maestro Local 374 · 3 nov» | **«Desmarcar»** |

Pulsado «Desmarcar» en la sin dinero: el diálogo dice «Ahora mismo consta recibida por ₡100.» + la nota;
al confirmar, POST 200, el diálogo se cierra y la fila vuelve a «Pendiente de conciliar · Marcar
recibido» (R4 en la app). Historial: «Revirtió la conciliación de una consolidación de bodega · ₡100».

**`/cierres-admin`** → «Bodega» → «Resueltos» → «Ver el cierre de bodega resuelto de Quepos» (antes de
desmarcar): detalle de la con dinero (Total general ₡0) → botones **[«Cerrar»]**; detalle de la sin
dinero (Total general ₡100) → **[«Desmarcar», «Cerrar»]**.

**Zona** (`/configuracion/tarifas` → «Limón Abajo» → «Editar»): añadido Colorado (Abangares), quitado
Llanuras del Gaspar (Sarapiquí) (ninguno de los dos tiene órdenes) → «Zona actualizada».
**`/historico/acciones`** (columnas Cuándo · Quién · Rol · Categoría · Qué · Tipo · Sobre qué · Importe ·
Valor anterior · Valor nuevo):

- `Maestro Local 374 | Maestro | Mueve dinero | Cambió los distritos de una zona | Zona | Limón Abajo | — | — | Colorado (Abangares)`
- `Maestro Local 374 | Maestro | Mueve dinero | Cambió los distritos de una zona | Zona | Limón Abajo | — | Llanuras del Gaspar (Sarapiquí) | —`

En la base: las dos filas comparten `lote_id` (`793101aa-…`), distinto del de la otra fila del mismo
guardado (R13); texto sin comillas (Q2).

**Hallazgos (no contradicen el spec; para el leader):**

1. **La nota de la 498 contradice el botón nuevo.** `NOTA_CONCILIACION_ASIENTA` («Marcar recibido asienta
   el dinero en la caja. Después no se puede desmarcar: si el monto no es el correcto, usa «Corregir»»)
   sigue al pie de la conciliación y **dentro del propio diálogo de «Desmarcar»**, que ahora sí se ofrece
   para una consolidación sin dinero. R23 declaró ese texto definitivo, así que no se tocó; candidato a
   ficha de texto.
2. El mismo guardado de zona escribió también «Cambió el pago al mensajero de una zona» (`— | —`): la zona
   no tenía filas en `tarifa_zona_mensajero` y el formulario guarda una por defecto (vehículo null, 0/0).
   Es de la 380 / del formulario, no de la 500.
3. «Falta por recibir -₡90» y «Quepos entregó ₡190 de más»: importes negativos al recibir de más,
   comportamiento de la 498, fuera del alcance.

**Limpieza** (comprobada por consulta después): borrados 1 `wallet_movimiento` (`ingreso_diferencia_satelite`
90), 1 `conciliacion_bodega_ajuste`, 6 `historial_accion` de `maestro.local` (2 marcas, 1 reversión,
1 pago al mensajero, 2 `zona_distrito_cambiado`), las 2 consolidaciones, la fila por defecto de
`tarifa_zona_mensajero` de Limón Abajo y la fila de `login_attempt`; Limón Abajo vuelve a «La Virgen,
Las Horquetas, Llanuras del Gaspar» y Colorado sin zona. Consulta final: `cierre_bodega` 0,
`…_diferencia_satelite` en caja 0, `zona_distrito_cambiado` en toda la tabla 0, `login_attempt` 1135
(el conteo de antes), `tarifa_zona_mensajero` de Limón Abajo 0. Un barrido de `created_at` por las 72
tablas que lo tienen no mostró otras filas de la sesión. Dev server matado; su log (imprime argumentos
del login), la sesión de Playwright y el respaldo del hash, borrados; `rm -rf .next/dev` antes del gate.

## T8 · Cierre

### T8.1 · Gate

`progress/gate_500.log`: **INIT_EXIT=0**, `init OK`. typecheck y lint verdes (solo warnings previos).
Relacionados 537 archivos · 6490 passed / 26 skipped (los `it.skip` de `AnaliticaPage` 17 y
`AnaliticaShell` 9); guardias 283 · 3894/3894; **`tests/integration/db` ampliado: 475 archivos · 4413
passed, 0 skipped, 0 rojos**. Ningún rojo: nada que repetir aislado.

### T8.2 · Mapa R → test (completo, R1–R23)

| R | Test |
| --- | --- |
| R1 | `tests/integration/db/500-con-dinero-sql-real.test.ts` «R1: …exactamente {A, B}», «R1: con ids vacíos no consulta» |
| R2 | ídem «R2: revertir A …» |
| R3 | ídem «R3: /wallet/satelites…», «R3: el detalle de /cierres-admin…»; `tests/unit/utils/conciliacion-satelite.test.ts`; `tests/unit/services/cierres-bodega-admin-service.test.ts` «FICHA 500 (R3/R4)»; `tests/components/ConciliacionAcciones500.test.tsx` «500/R3»; `tests/components/Conciliacion498.test.tsx` «500/R3 — `puedeDesmarcar` del DTO llega al botón…»; `tests/components/CierresBodegaAdminDebe498.test.tsx` «500 (R3) — /cierres-admin…» |
| R4 | `500-con-dinero-sql-real.test.ts` «R4: …⇔ revertir tiene éxito…» |
| R5 | `ConciliacionAcciones500.test.tsx` «500/R5 — una incompleta sigue ofreciendo «Corregir»…» (2 casos) |
| R6 | `ConciliacionAcciones500.test.tsx` «500/R6 — quien monta sin decirlo no ofrece «Desmarcar»» (2 casos) |
| R7 | `ConciliacionAcciones500.test.tsx` «500/R7 — con datos viejos, el servidor sigue siendo la última palabra» (`it.each` `con_asientos` / `saldada_regla_anterior`) |
| R8 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts` punto ««Desmarcar» solo aparece sin dinero en la caja (500/R8)» |
| R9 | `500-con-dinero-sql-real.test.ts` «R9: revertir B …» |
| R10, R11 | `tests/integration/db/500-esperado-una-formula-sql-real.test.ts` |
| R12, R13, R14, R16 | `tests/integration/db/zona-distrito-rastro-500.test.ts` «R12/R13/R14/R16…»; `tests/unit/repositories/zona-distritos-rastro-500.test.ts` |
| R15 | `zona-distrito-rastro-500.test.ts` «R15…»; unitario «R15» |
| R17 | `zona-distrito-rastro-500.test.ts` «R17: otro orden»; unitario «otro orden y con repetidos» |
| R18 | `zona-distrito-rastro-500.test.ts` «R18: zona inexistente…» y «R18: un error forzado…» (la mutación T6.10 sobrevive: limitación del arnés, ver T6) |
| R19 | `zona-distrito-rastro-500.test.ts` «R19…» |
| R20 | `tests/unit/historial-accion/catalogo-y-choke-point.test.ts` «FICHA 500 (R20)»; guardia `historial-accion-escrituras-cubiertas` |
| R21 | `zona-distrito-rastro-500.test.ts` «R21…»; `tests/components/HistorialAccionesZonaDistrito500.test.tsx` (pantalla, descarga y filtro) |
| R22 | `tests/integration/db/historial-accion-zona-distrito-500-migration.test.ts` |
| R23 | `tests/unit/guards/textos-satelite-definitivos-500.guardia.test.ts` |

**R sin test: 0.** R24–R30 son del bloque 8 (T9), bloqueado por la puerta P8.

### T8.3 · Commits (`git log --oneline origin/dev..HEAD` antes del commit de cierre)

```
86db056c docs(500): logs de los gates de backend y frontend
e4d0240f docs(500): bitacora del frontend (T7) en impl_500.md
6852c87b test(500): el registro de acciones pinta y descarga zona_distrito_cambiado (R21)
b8a436c4 docs(500): la ayuda de Wallet · Satélites dice cuándo aparece «Desmarcar» (R8)
3d71d4b3 feat(500): «Desmarcar» solo cuando el servidor dice que se puede (R3, R5, R6, R7)
f4358e1e docs(500): bitacora del backend (impl_500.md)
e6ef0f69 test(500): los tests de enum del historial cuentan zona_distrito_cambiado (ventanas y POSTERIORES)
033db045 chore(500): textos de la 498 definitivos y guardia que impide marcarlos provisionales (R23)
fae53478 feat(500): rastro zona_distrito_cambiado al guardar una zona (R12-R22)
3017fae3 test(500): esperado de una sola formula con los literales de H5 (R10, R11); dobles con los delegados de consolidacionesConDinero
a335eb90 feat(500): consolidacionesConDinero compartida y puedeDesmarcar en las dos lecturas (R1-R4, R9)
```

Más el commit de cierre (T7.6 + T8 en esta bitácora, `tasks.md` marcado y `progress/gate_500.log`).
Sin `feature_list.json`.

**Veredicto (cierre):** T7.6 visto en la app y conforme al spec (con dinero sin «Desmarcar» en las dos
pantallas, sin dinero con él y desmarcable; dos filas de distrito en el historial); base local limpia y
comprobada; gate `--rapido` INIT_EXIT=0 sin rojos y sin integración saltada; R1–R23 con test. T9
abierta (P8).
