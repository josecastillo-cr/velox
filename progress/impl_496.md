# impl_496 — Recolección recibida en central libera al mensajero

Rama `fix/496-recoleccion-central-libera-mensajero` (worktree `wt-496`), nacida de `f0833d64`.
Implementa `backend_dev`, 2026-11-02. Spec aprobado por el humano el 2026-11-02 (incluida la P1:
también libera cuando la orden volvió a `en_ruta_bodega_central` por reversión de incidente).

Grafo: no se usó el MCP `codebase-memory` para buscar; las rutas del design §0 se confirmaron
leyendo los archivos reales con `grep`/`sed` (todas coinciden con el design; `OrdenRepository.recibirEnBodegaCentral`
en `:4363`, `IOrdenRepository` en `:2066`, service en `:84`, `GestionOrdenRepository.findMisAsignacionesByIds` en `:525`).

## Lo hecho por task

| Task | Commit | Resumen |
|---|---|---|
| T0 | — | `prisma migrate status`: host `localhost:5432`, al día. Triggers sobre `orden`: 0. Los cinco tests de línea base aislados: 5 archivos, 82 tests verdes, 0 skipped (SHA `f0833d64`). |
| T1 | `47a5374c` | `tests/integration/db/recepcion-central-libera-496.test.ts` (11 casos). Contra el código actual: **rojos R1, R6, R10** y **R12** (ver nota); verdes R2, R3, R4, R5, R7, R11, R13. |
| T2 | `108b3935` | `tests/integration/tablero-dia-recoleccion-496.test.ts`. Contra el código actual: **rojo R8**, verde R9. |
| T3 | `a44df5c5` | `recibirEnBodegaCentral(ordenId, origenValue, destinoEstatusId, liberaAsignacion, historial)` en interfaz e implementación; `data` con el trío a NULL si `true`. JSDoc sin la R18 en la arista revocada. Unit del repo reescrito (6 verdes). Typecheck rojo solo en el service (único llamador). |
| T4 | `57d0c899` | `TRANSICIONES` con `liberaAsignacion` obligatorio (true/false) y paso al repo; unit del service con `true`/`false` en 4.ª posición. Typecheck verde; R1, R6, R8 verdes; `devolucion-rechazadas-flow` verde sin tocarlo. |
| T5 | `26ddd08c` | `findMisAsignacionesByIds`: `deletedAt` fuera del OR; rama 2 = sin mensajero + `recoleccion_tienda` mía (literal con `satisfies OrdenHistorialOrigenTipo`). JSDoc de repo e interfaz. R10, R12 verdes; `recoleccion-tienda-service` verde sin tocarlo. |
| T6 | `f6c7be42` | `tests/integration/db/recoleccion-central-libera-496-migration.test.ts`: objetivo + 6 hermanas (a posterior, b devolución, c borrada, d sin recolección ni mensajero, e otro tipo, f otro estado). Rojo: ENOENT (carpeta inexistente). |
| T7 | `2aec0f11` | `db/migrations/20261102150000_recoleccion_central_libera_496/{migration.sql,down.sql}` (LF). T6 verde. (El cast explícito al enum se quitó en la revisión: ver «Revisión».) |
| T8 | — | 15 mutaciones, todas rojas (tabla abajo). |
| T9 | `056f94ed` | Nota bajo la R18 de `specs/138-recepcion-bodega-central/requirements.md`. |
| T10 | `3a53639a` | Gate (abajo). Dos guardias rojas eran mías y se corrigieron en este commit. |

**Nota R12 (desvío menor del tasks).** El tasks esperaba R12 verde antes del arreglo. La aserción
propia de R12 (M1 no ve la orden) sí pasaba; el caso salió rojo por su **control** (el recolector
real M2 debe verla), que depende de la rama 2 del OR. Es el control que impide que el `[]` sea
vacío por otra causa; se dejó.

**Nota T1/R3.** El caso de carrera llama al repo directamente con la firma nueva; entre T1 y T3 el
typecheck estuvo rojo por esa llamada (en runtime no afecta: `count = 0` no usa `historial`).

## Mapa R → test

| R | Archivo | `it` |
|---|---|---|
| R1 | `tests/integration/db/recepcion-central-libera-496.test.ts` | «⭑ R1: recepción de recolección deja el trío en NULL»; forma del `data`: `tests/unit/repositories/orden-repository.recepcion-bodega-central.test.ts` «R2/R11 (138) + 496/R1: UPDATE guardado…»; flag: `tests/unit/services/recepcion-bodega-central-service.test.ts` «R3/R17 (138): persiste…» |
| R2 | `recepcion-central-libera-496.test.ts` | «⭑ R2: recepción de devolución conserva el trío»; unit del repo «R17 (139): guarda por el origen…»; unit del service «R17 (139): ok…» |
| R3 | `recepcion-central-libera-496.test.ts` | «⭑ R3: recepción que no transiciona no toca la asignación ni escribe historial (ya recibida, borrada, estado no origen, carrera)» |
| R4 | `recepcion-central-libera-496.test.ts` | «⭑ R4: una sola fila de recepción y num_guia intacto (las dos aristas)» |
| R5 | `recepcion-central-libera-496.test.ts` | «⭑ R5: conteos de gestión, wallet, pagos y cierres sin cambio» (REPEATABLE READ) |
| R6 | `recepcion-central-libera-496.test.ts` | «⭑ R6: Reasignables trae la recolección recibida» |
| R7 | `recepcion-central-libera-496.test.ts` | «⭑ R7: Reasignables no trae una orden en central con mensajero» |
| R8 | `tests/integration/tablero-dia-recoleccion-496.test.ts` | «⭑ R8: recibida en central no cuenta en ninguna fila» |
| R9 | `tablero-dia-recoleccion-496.test.ts` | «⭑ R9: aún en ruta a la central sigue contando en la fila de su mensajero (otros)» |
| R10 | `recepcion-central-libera-496.test.ts` | «⭑ R10: Recolectadas hoy trae la recibida (sin mensajero) y la asignada a mí» |
| R11 | `recepcion-central-libera-496.test.ts` | «⭑ R11: Recolectadas hoy no trae la mía asignada a otro» |
| R12 | `recepcion-central-libera-496.test.ts` | «⭑ R12: no trae la sin mensajero recolectada por otro (ni la que no tiene recolección)» |
| R13 | `recepcion-central-libera-496.test.ts` | «⭑ R13: no trae la recolectada borrada (con y sin mensajero)» (con control: la hermana viva sí sale) |
| R14 | `tests/integration/db/recoleccion-central-libera-496-migration.test.ts` | «⭑ R14: libera la orden objetivo, sin historial» |
| R15 | `recoleccion-central-libera-496-migration.test.ts` | «⭑ R15: no toca a las hermanas (columna a columna)» |
| R16 | `recoleccion-central-libera-496-migration.test.ts` | «⭑ R16: down repone al mensajero y nada más» (incluye la hermana (g): sin mensajero, con recolección y fila posterior: no se repone) |
| R17 | `recoleccion-central-libera-496-migration.test.ts` | «⭑ R17: base sin objetivo y segunda aplicación: 0 filas» |

Ningún R sin test.

## Mutaciones (design §7.1)

Driver en el scratchpad: mutar → correr el/los archivo(s) → restaurar los bytes → `git diff --stat`
del archivo. Todas: `diff_restaurado = vacío`, `skipped = 0`. Ninguna corrió a la vez que el gate.

| # | Archivo | Mutación | Rojo |
|---|---|---|---|
| M1 | `OrdenRepository.ts` | quitar `mensajeroAsignadoId: null` del `data` que libera | R1, R6, R8, R10 |
| M2 | `OrdenRepository.ts` | quitar `asignadoAt: null` | R1 |
| M3 | `OrdenRepository.ts` | quitar `fechaReparto: null` | R1 |
| M4 | `RecepcionBodegaCentralService.ts` | `liberaAsignacion: true` en la devolución | R2 |
| M5 | `OrdenRepository.ts` | `updateMany` previo sin la guarda de estado que limpia el trío | R3 |
| M6 | `OrdenRepository.ts` | segunda fila de historial al liberar | R4 |
| M7 | `OrdenRepository.ts` (`list`) | quitar `mensajeroAsignadoId: null` de Reasignables | R7 |
| M8 | `GestionOrdenRepository.ts` | quitar `historialEstados.some(...)` de la rama 2 | R12 |
| M9 | `GestionOrdenRepository.ts` | rama 2 con cualquier actor | R12 |
| M10a | `GestionOrdenRepository.ts` | `deletedAt: null` solo en la rama 1 | R13 |
| M10b | `GestionOrdenRepository.ts` | `deletedAt: null` solo en la rama 2 | R13 |
| M11 | `migration.sql` | quitar `AND so.value = 'en_ruta_bodega_central'` | R14, R15, R17 |
| M12 | `migration.sql` | `DISTINCT ON … ASC` (primer registro) | R14, R15, R16, R17 |
| M13 | `migration.sql` | quitar `o.deleted_at IS NULL` | R14, R15, R17 |
| M14 | `down.sql` | `asignado_at = now()` en el down | R16 |
| G1 | `migration.sql` | `asignado_at = now()` (guardia nueva, T10) | «496: el permiso es SOLO para limpiar…» |
| G2 | `migration.sql` | no limpiar `mensajero_asignado_id` (guardia nueva, T10) | «496: el permiso es SOLO para limpiar…» |

## Migración: up / down / up contra la base local

- Medición previa (solo lectura, base local): órdenes objetivo = 0; filas que el `down` tocaría = 0.
- `prisma migrate deploy` → aplicada `20261102150000_recoleccion_central_libera_496`.
- `pnpm run db:rollback` (ejecuta `down.sql` y borra la fila de `_prisma_migrations`) → «Rollback
  completado»; `migrate status` la lista como pendiente.
- `prisma migrate deploy` → aplicada de nuevo; «All migrations have been successfully applied».
- Sin errores. Prefijo comprobado tras `git fetch`: no choca con `origin/dev` (última
  `20261023120100_iva_por_pagar_488_checks`) ni con wt-499 (`20261102130000_*`, `20261102130100_*`).
- `migrate status` informa además dos migraciones de la base que no están en este árbol:
  `20261102130000_zona_distrito_limpieza_499` y `20261102130100_zona_distrito_unico_499` (las aplicó
  la ficha 499 en la base compartida).

## Verificación

- `pnpm exec tsc --noEmit`: «TypeScript: No errors found» (tras T10).
- `eslint` de los archivos tocados: «ESLint: No issues found». El lint del gate pasó.
- Gate `./init.sh --rapido` (una vez, log `progress/gate_496_1.log`, sin commitear): **`INIT_EXIT=1`**.
  - `tests/integration/db` corrió ampliada: 4284 tests, 2 skipped (`wallet-comprobante-esta-anulado-488`,
    marcado por el propio gate «intermitente: rojo en paralelo, verde aislado»). No salió saltada entera.
  - Los cinco archivos de la ficha y `tablero-dia-recoleccion.test.ts` / `devolucion-rechazadas-flow.test.ts`: verdes dentro del gate.
  - **Rojos míos (2), corregidos después en `3a53639a`** y comprobados aislados (26/26 verdes con el test de la migración):
    - `tests/unit/guards/censo-order-status-rename.test.ts`: los comentarios del test de la migración decían «en_ruta» a secas (value retirado).
    - `tests/unit/tablero-dia/asignado-at-solo-lectura.guardia.test.ts` (guardia de DINERO): la migración 496 escribe `asignado_at`. Entra en la lista blanca mirada a mano, con un caso nuevo que acota el permiso (solo `= NULL`, en la misma sentencia que `mensajero_asignado_id = NULL`; el denominador del ranking exige mensajero no nulo, `RankingRepository`). **Para el reviewer/humano: es una ampliación de una guardia de dinero.**
  - `tests/unit/guards/marca-fuente-unica-493.guardia.test.ts`: timeout de 20 s en el gate; aislado 19/19 verdes → intermitente por carga.
  - **Rojos de `integration/db` (6 archivos). ATRIBUCIÓN CORREGIDA en la revisión: 2 propios + 4 ajenos.**
    El informe original los daba los 6 por ajenos; era un error.
    - **Propios (2), leen el ÁRBOL `db/migrations/`, no la base** — corregidos en la revisión:
      `orden-traspaso-migration` (lista `posteriores`: ve 37, espera 36; la carpeta nueva de la 496) y
      `ayuda-tienda-migration` (censo de columnas del enum: la línea del up terminaba en
      `::"orden_historial_origen_tipo"` y casaba el patrón `/"orden_historial_origen_tipo",?$/`).
    - **Ajenos (4), de la 499 en la base compartida:** `cobertura-repository`,
      `corregir-datos-cliente.repo`, `geografia-catalogo-activo`, `zona-reconciliacion-ordenes`.
      Causa medida: «Unique constraint failed» en `tx.zonaDistrito.create()/createMany()` y
      `tx.distrito.create()`; la base tiene el índice `zona_distrito_distrito_id_key` y las dos
      migraciones de la 499 (no presentes en este árbol). No se arreglaron ni se añadieron al baseline.
  - No se volvió a correr el gate tras `3a53639a` (regla: una vez); lo corregido se verificó aislado.

## Abiertos

1. Gate rojo por la 499 en la base compartida (4 archivos ajenos). Se resolverá cuando la 499 esté
   en el árbol o la base vuelva a su estado; repetir `--rapido` tras eso.
2. Guardia de dinero `asignado-at-solo-lectura` ampliada con la migración 496: confirmación del
   reviewer/humano.
3. T11 (verificación en producción tras el deploy): la hace el leader con el humano.

## Revisión (review_496.md, 2026-11-02)

**B1 — dos rojos propios.**
- `tests/integration/db/orden-traspaso-migration.test.ts`: `20261102150000_recoleccion_central_libera_496`
  declarada en `posteriores` con su comentario de ficha (la igualdad exacta se queda).
- `tests/integration/db/ayuda-tienda-migration.test.ts`: **vía (a)**, cambiar la migración y no el
  test. Se quitó el cast `::"orden_historial_origen_tipo"` de `migration.sql` y de `down.sql`
  (simetría). Por qué (a) y no (b): la línea NO era una declaración de columna, así que el censo
  tenía razón en no querer verla, y relajar o afinar el patrón de una guardia ajena para dar cabida a
  un estilo opcional es abrirle hueco. El cast sobraba: Postgres resuelve el literal al tipo enum de
  `origen_tipo` (el test de la migración lo ejecuta contra Postgres y pasa). Un comentario en
  `migration.sql` lo deja dicho.
  - Base local (la migración ya estaba aplicada): medido antes que el `down` tocaría 0 filas;
    `prisma db execute --file=…/down.sql` → borrada su fila de `_prisma_migrations` →
    `migrate status` la lista pendiente → `prisma migrate deploy` → aplicada (`finished_at` no nulo).
    No se usó `db:rollback`.

**m1 — la parte estricta del `down.sql`.** Hermana (g) nueva: en central, sin mensajero, con
`recoleccion_tienda` de M1 y una fila `ajuste_estado` POSTERIOR a la recepción; R16 afirma que sigue
sin mensajero. Conteos de siembra actualizados (7 hermanas, 18 filas de historial). Mutación: quitar
del `down.sql` `AND u.origen_tipo = 'recepcion_bodega_central' AND so.value = 'en_ruta_bodega_central'`
→ **R16 rojo**; restaurado (`cmp` igual).

**m5 — control positivo en R13.** Hermana viva, idéntica a la borrada sin mensajero salvo el
borrado: el resultado debe ser exactamente `[viva]`. Mutación `id: { in: [] }` en
`findMisAsignacionesByIds` (todo vacío) → **R13 rojo** (antes habría pasado); restaurado, `git diff` vacío.

**Aislados tras la revisión** (`vitest run`): `orden-traspaso-migration`, `ayuda-tienda-migration`,
`recoleccion-central-libera-496-migration`, `recepcion-central-libera-496`,
`asignado-at-solo-lectura.guardia`, `censo-order-status-rename` → **6 archivos, 80 tests verdes, 0 skipped**.
`tsc --noEmit` verde; `eslint` de los archivos tocados sin issues. Gate no corrido (lo corre el
leader tras mergear la 499).

Veredicto: implementación completa y R1–R17 trazados a tests verdes con mutaciones rojas; tras la revisión, los rojos del gate que quedan son solo los 4 ajenos de la 499 en la base compartida.
