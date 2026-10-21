# 419 — Bitacora de implementacion (bloque B, backend)

Rama `feature/419-central-cierra-devolucion-comprobante` (worktree `.claude/worktrees/f419`, nace de
`dev` f34f0f6d). Spec aprobado: `specs/419-central-cierra-devolucion-con-comprobante/`. Decisiones del
humano aplicadas (defaults del spec): solo imagen JPEG/PNG/WebP, 5 MB, max 3; comprobante visible solo
a maestro/admin; un lote = una tienda; tope 300; sin registro en «Acciones» (362); marcan solo
maestro/admin.

Busqueda de codigo: el design ya citaba cada simbolo con archivo y linea; este bloque los leyo
directamente con `grep`/lectura de archivos (sin consultar el grafo `codebase-memory`), confirmando
todo en el archivo real.

## Archivos

Creados:
- `db/migrations/20261021120000_devolucion_tienda_comprobante_419/{migration.sql,down.sql}`
- `lib/types/devolucion-tienda.ts` — schema zod del borde, `TOPE_ORDENES_POR_LOTE` (300), ruta del objeto, tipos de resultado.
- `lib/interfaces/repositories/IDevolucionTiendaRepository.ts` (+ `SinTransicionesError`)
- `lib/interfaces/services/IDevolucionTiendaService.ts`
- `lib/repositories/DevolucionTiendaRepository.ts` — `confirmarEntregaLote` set-based (`UPDATE ... RETURNING`).
- `lib/services/DevolucionTiendaService.ts` — rol → validacion → catalogo → subida → lote → compensacion → reporte.
- `lib/actions/devolucion-tienda.ts` — `confirmarEntregaTienda(formData)`, `verComprobanteDevolucionTienda({ ordenId })`.
- Tests: `tests/unit/types/devolucion-tienda-schema.test.ts`, `tests/unit/services/devolucion-tienda-service.test.ts`,
  `tests/unit/actions/devolucion-tienda-action.test.ts`, `tests/unit/actions/ver-comprobante-devolucion-tienda.test.ts`,
  `tests/integration/db/419/{_escenario-419.ts, confirmar-entrega-lote-sql-real.test.ts, confirmar-entrega-webhook-sql-real.test.ts, confirmar-entrega-sin-dinero-sql-real.test.ts}`.

Modificados:
- `db/schema.prisma` — 3 modelos + relaciones inversas en `Usuario` (2) y `Orden` (1).
- `lib/types/order-status-transiciones.ts` — metadato `rol` de #28 (sin arista nueva).
- `tests/fixtures/inventario-transiciones-140.ts` — `callSite` de #28 nombra los dos productores.
- `tests/unit/domain/order-status-transiciones.guardia.test.ts` — bloque R24.
- `tests/fixtures/api-key-dependencias-usuario.ts` — censo 373: las 2 FK nuevas a `usuario` clasificadas `no_alcanzable`.
- `tests/integration/db/orden-traspaso-migration.test.ts` — su lista de migraciones POSTERIORES gana la de la 419 (rojo real del primer gate).

NO tocados (R16): `RecepcionOrigenService.ts`, `lib/actions/recepcion-origen.ts`, `OrdenRepository.recibirEnOrigen`, `EscanerRecepcionOrigen.tsx`.

## Migracion

`20261021120000_devolucion_tienda_comprobante_419`: tablas `devolucion_tienda_comprobante`,
`devolucion_tienda_evidencia`, `devolucion_tienda_orden` (PK = `orden_id`); FKs RESTRICT; CHECK
`content_type IN (jpeg,png,webp)`, `indice >= 0`, `storage_path` no vacio; RLS habilitada sin policies.
No toca enums ni filas. `down.sql`: aborta si hay filas; si no, `DROP TABLE` en orden inverso.

Verificado en la base LOCAL (`prisma migrate status` → `localhost:5432`): `migrate deploy` aplica →
`db execute down.sql` revierte → (borrada la fila de `_prisma_migrations`) `migrate deploy` re-aplica
limpio → `migrate status` «up to date» → `migrate diff --from-config-datasource --to-schema` vacio (sin
drift) → `prisma generate` OK.

## Desviaciones del design (y por que)

1. **Desenlace `devuelta` → `devuelta_a_tienda`.** La guardia `censo-order-status-rename` (455/R40)
   prohibe el literal `"devuelta"` (codigo anterior de `novedad`) en todo el arbol. El valor del
   desenlace de una orden que transiciono en el lote es `"devuelta_a_tienda"`.
2. **Las dos actions llevan `@sin-superficie`** (guardia `superficie-de-uso`): nadie las importa hasta
   el bloque F. **El frontend que las monte DEBE borrar la anotacion** (la guardia exige quitarla en
   cuanto sean alcanzables).
3. **El reporte se clasifica en el servicio** (`clasificarOrden`, pura) sobre una lectura cruda del
   repo (`findOrdenesParaReporte`): el repo no lleva logica de negocio. Orden de chequeo: no
   encontrada/borrada → devuelta en este lote → tienda distinta → ya devuelta → estado invalido.
4. **Ruta del objeto**: no se reutiliza `subirEvidenciasCompensadas` porque mete `ordenId` en la ruta
   (R23 lo prohibe); bucle secuencial propio con el mismo criterio + `compensarEvidencias`.
5. `buildService` NO se exporta (en `"use server"` todo export async es invocable desde el cliente);
   el test del composition root lo ejercita por `verComprobanteDevolucionTienda` sin `service` inyectado.
6. R13: un fallo de escritura se compensa y **se propaga** (como el patron del repo: el borde lanza
   ante un `AppErrorCode` inesperado). La UI debe tratar el rechazo de la promesa como error generico.

## Mapa R → test

| R | Test |
|---|---|
| R1, R2 | `tests/unit/services/devolucion-tienda-service.test.ts` «R1/R2» (maestro/admin ejecutan; adminSatelite/adminTienda/mensajero/apiKey → `forbidden` con 0 llamadas a repo y storage) |
| R3, R4, R5 | `tests/unit/types/devolucion-tienda-schema.test.ts`; `tests/unit/actions/devolucion-tienda-action.test.ts` (FormData → `validation_error`, servicio no llamado); service test «R3/R4/R5» (sin subir ni escribir) |
| R6, R7, R9, R10 | `tests/integration/db/419/confirmar-entrega-lote-sql-real.test.ts` «lote mixto» (2 elegibles + ya_devuelta + estado_invalido + tienda_distinta + borrada + inexistente) |
| R8 | mismo archivo «R8 — concurrencia real»: 4x dos lotes a la vez (uno `ok`, otro `ninguna_devuelta`, 1 historial, 1 enlace) y 4x lote vs `OrdenRepository.recibirEnOrigen` (gana uno, 1 historial, enlace solo si gano el lote) |
| R11 | mismo archivo «R11» (0 filas en las 3 tablas, archivos retirados) + service test |
| R12 | service test «R12» (falla la 2a subida → se retira la 1a, repo no llamado; falla la 1a → `remove` no se llama) |
| R13 | mismo archivo «R13» (proxy que rompe el enlace → 0 transiciones, 0 historial, 0 comprobante, 0 jobs, archivos retirados) + service test |
| R14 | `tests/integration/db/419/confirmar-entrega-webhook-sql-real.test.ts` |
| R15 | `tests/integration/db/419/confirmar-entrega-sin-dinero-sql-real.test.ts` (`pg_stat_xact_user_tables`: delta 0 en 6 tablas de dinero; la semilla de dinero en la misma tx demuestra que la medicion no es vacia; la fila de la orden solo cambia `estatus_id`/`updated_at`) |
| R16 | existentes sin modificar: `recepcion-origen-service.test.ts`, `recepcion-origen-action.test.ts`, `EscanerRecepcionOrigen.test.tsx`, `tests/integration/db/devolucion-rechazadas-flow.test.ts` → 4 archivos, 42 tests verdes |
| R17–R21 | bloque F (frontend), fuera de este bloque |
| R22 | `tests/unit/actions/ver-comprobante-devolucion-tienda.test.ts` (rol ajeno sobre orden CON comprobante == admin sobre orden SIN: `no_encontrado`) + service test «R22» |
| R23 | service test «R23» (regex `^devolucion-tienda/[0-9a-f-]{36}\.(jpg|png|webp)$`, sin ids, ruta ausente del resultado serializado) + integracion «R23» + schema test |
| R24 | `tests/unit/domain/order-status-transiciones.guardia.test.ts` «419/R24» (+ inventario 140 con las mismas cifras) |

## Mutaciones (cada una ROJA, revertida despues; arnes en el scratchpad, autocomprobado con `count == 1` del texto mutado)

| Mutacion | Test | Resultado |
|---|---|---|
| M1 quitar `AND "estatus_id" = origen` del UPDATE | lote-sql-real | 6 failed (R6/R7/R9/R10 + concurrencia) |
| M2 quitar `AND "tienda_id" = tienda` | lote-sql-real | 6 failed |
| M3 quitar `AND "deleted_at" IS NULL` | lote-sql-real | 4 failed |
| M4 quitar `throw SinTransicionesError` | lote-sql-real | 4 failed (R11 + concurrencia) |
| M5 `esAccesoTotal` → `true` | service unit | 4 failed (R2) |
| M6 `emitir` no-op en `appendCambioEstado` | webhook-sql-real | 1 failed (R14) |
| M7 insertar un `wallet_tienda_movimiento` en la tx del lote | sin-dinero-sql-real | 1 failed (R15) |
| M8 revertir el `rol` de #28 | guardia de transiciones | 1 failed (R24) |

## Verificacion

- `pnpm run typecheck`: verde (sin salida de errores).
- `pnpm run lint`: `0 errors, 235 warnings` (ninguno en archivos de la 419).
- Tests de la 419 (unit + integracion): 4 unit (55 tests) + 3 integracion (16 tests) verdes.
- Guardias a mano `tests/unit/guards` + `tests/unit/db`: 203 archivos, 2702 tests verdes (tras clasificar
  las FK nuevas en el censo 373, anotar `@sin-superficie` y renombrar el desenlace).
- Gate `./init.sh --rapido` (ampliado con `tests/integration/db`): ver `progress/gate_419_backend.log`
  (no commiteado) — resultado en la seccion siguiente.

## Gate

`./init.sh --rapido`, ampliado solo con `tests/integration/db` (toca migracion/schema/`lib/types`).

1. Primera corrida (`progress/gate_419_backend_1.log`, no commiteado): `INIT_EXIT=1`. Rojo REAL:
   `orden-traspaso-migration.test.ts` «su timestamp es POSTERIOR…» (censo exacto de migraciones
   posteriores; faltaba la de la 419) → corregido. Los demas rojos (`TableroOperativo.test.tsx`,
   `ranking-snapshot-migration`, `eliminar-orden-api-frontera-tienda`, `454/caracterizacion/corte-concurrencia`)
   pasaron AISLADOS → intermitentes de la base compartida.
2. Segunda corrida (`progress/gate_419_backend.log`, no commiteado): **`INIT_EXIT=0`**.
   - relacionados: 11488 passed | 26 skipped (11514); guardias: 273 archivos / 3757 passed;
   - `tests/integration/db`: 4218 passed | 2 failed | 9 skipped (454 archivos) en paralelo; los 4
     archivos rojos (`liquidacion-reparto-migration`, `454/registro-gestion-concurrencia`,
     `notificacion-evento-avisos-agregados-migration`, `454/caracterizacion/corte-concurrencia`)
     repetidos AISLADOS por el propio gate: 4 passed / 48 tests → intermitentes; «sin rojos nuevos
     (0 sobre 1108 ejecutados)». Los 9 skipped de integracion son de esos archivos cuyo `beforeAll`
     cayo en la corrida paralela (pasan enteros aislados); las 3 suites de la 419 corrieron (no skip).

## Contrato para el frontend (bloque F)

- `confirmarEntregaTienda(formData: FormData): Promise<ConfirmarEntregaTiendaResult>` — FormData:
  `tiendaId` (uuid), una entrada `ordenId` por orden, una entrada `evidencia` por archivo (File).
- `verComprobanteDevolucionTienda({ ordenId }): Promise<VerComprobanteDevolucionTiendaResult>` —
  `{ status: "ok", confirmadoAt, confirmadoPor, archivos: { url, contentType, indice }[] }` |
  `no_encontrado` | `validation_error` | `unauthenticated`.
- Tipos en `lib/types/devolucion-tienda.ts`: `confirmarEntregaTiendaSchema`, `TOPE_ORDENES_POR_LOTE`,
  `DesenlaceOrden` (`devuelta_a_tienda | ya_devuelta | estado_invalido(+estado) | tienda_distinta |
  no_encontrada`, con `numGuia`), `ConfirmarEntregaTiendaResult` (`ok{devueltas,desenlaces}` |
  `ninguna_devuelta{desenlaces}` | `forbidden` | `comprobante_no_guardado` | `validation_error` |
  `unauthenticated`).
- Borrar los dos `@sin-superficie` de `lib/actions/devolucion-tienda.ts` al montarlas.

## Veredicto

Bloque B de la 419 hecho: R1–R16 y R22–R24 con test (integracion contra Postgres para el WHERE, RLS-sin-policies por migracion, R8, R14, R15; 8 mutaciones rojas), gate `--rapido` ampliado en verde.
