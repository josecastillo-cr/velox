# review_496 — Recolección recibida en central libera al mensajero (H1 portado)

Revisor: reviewer, 2026-11-02. Rama `fix/496-recoleccion-central-libera-mensajero`, HEAD revisado
`cf16e790` (10 commits sobre `f0833d64`). Worktree `wt-496`.

Búsqueda: MCP `codebase-memory` (`R-job-singularis-projects-ordenex`) para `appendCambioEstado` y
`search_code`; `trace_path` de `findMisAsignacionesByIds` devolvió 0 llamadores (índice incompleto),
así que el llamador se confirmó con `grep` en `lib/` (`RecoleccionTiendaService.ts:216`).

## Veredicto: CAMBIOS REQUERIDOS (RECHAZADO)

Un bloqueante: **dos rojos del gate que el informe atribuye a la 499 los causa la propia 496**. El
resto del trabajo (código, tests, migración, guardia) es correcto.

## Checklist

| Punto | Estado |
|---|---|
| requirements (EARS R1–R17), design (con alternativas descartadas), tasks | OK |
| Tasks `[x]` | T0–T10 sí; **T11 abierta** (verificación en prod tras la release; esperable, la hace el leader) |
| Trazabilidad R1–R17 → test con aserción real | OK (ver menores 1 y 5 sobre R16/R13) |
| `impl_496.md` con mapa R → test | OK |
| Regresiones T1/T2/T6 vistas en rojo antes del arreglo | OK según bitácora y coherente con el orden de commits (T1/T2 antes que T3–T5; T6 antes que T7) |
| Mutaciones (15 + G1/G2) | Creíbles: cada una apunta a la línea que su test afirma; no las re-ejecuté (no edito código) |
| typecheck (`tsc --noEmit`) | OK, corrido por mí |
| eslint de los archivos tocados | OK, corrido por mí |
| Tests de la ficha aislados (8 archivos, 75 tests, 0 skipped) | OK, corridos por mí |
| Gate `--rapido` | **ROJO, y 2 de los rojos son propios** (BLOQUEANTE 1) |
| E2E | Inaplicable (sin harness; riesgo cubierto con integración contra Postgres) |
| RLS | Sin tablas nuevas |
| Migración con `down.sql` y rollback probado | OK (up/down/up en local según bitácora) |
| Secretos / hardcode de país-moneda | Ninguno |
| Capas | OK: la decisión por arista vive en el service (`TRANSICIONES`); el repo solo ejecuta el `data` |

## Hallazgos

### BLOQUEANTE 1 — Dos censos rojos causados por la 496, atribuidos a la 499

`progress/impl_496.md` declara «rojos ajenos (6 archivos)» y entre ellos lista
`orden-traspaso-migration` y `ayuda-tienda-migration` («dos censos que esperan N y ven N+1»). Esos
dos NO dependen de la base: leen el **árbol** `db/migrations/`, y lo que mueve el número es la
carpeta nueva de esta ficha. Corridos aislados por mí en `cf16e790`:

- `tests/integration/db/orden-traspaso-migration.test.ts` › «su timestamp es POSTERIOR al de la
  ultima migracion anterior del arbol»: recibe 37, espera 36; el sobrante es
  `"20261102150000_recoleccion_central_libera_496"` (la lista `posteriores` termina en
  `20261023120100_iva_por_pagar_488_checks`, línea 199).
- `tests/integration/db/ayuda-tienda-migration.test.ts` › «y la UNICA columna del arbol que usa
  este enum sigue siendo `orden_historial_estado.origen_tipo`» (línea ~279): espera 2, recibe 3.
  El regex `/"orden_historial_origen_tipo",?$/` casa con la línea de `migration.sql`
  `AND u.origen_tipo = 'recepcion_bodega_central'::"orden_historial_origen_tipo"` (el cast cierra
  la línea). Es un falso positivo del censo (no es una declaración de columna), pero el rojo lo
  pone esta ficha.

Los otros 4 (`cobertura-repository`, `corregir-datos-cliente.repo`, `geografia-catalogo-activo`,
`zona-reconciliacion-ordenes`) sí son de la 499: sus fallos en el log son «Unique constraint
failed» (32 apariciones).

Qué falta para cumplirlo:
1. `orden-traspaso-migration.test.ts`: declarar `20261102150000_recoleccion_central_libera_496` en
   `posteriores` con su comentario de ficha (patrón de la lista; la igualdad exacta se queda).
2. `ayuda-tienda-migration.test.ts`: NO relajar el censo a ciegas. Lo más limpio es que la línea de
   la 496 deje de parecer una declaración de columna (que el cast no cierre la línea, o quitarlo si
   la comparación con el literal funciona sin él; si se edita `migration.sql`, hacer `db:rollback`
   + `migrate deploy` en local porque ya está aplicada allí). Alternativa aceptable: afinar el
   regex para que exija contexto de declaración, con un caso que demuestre que sigue detectando una
   columna nueva. Decidirlo y anotarlo.
3. Correr aislados esos dos archivos + `recoleccion-central-libera-496-migration.test.ts` + la
   guardia `asignado-at-solo-lectura` (si cambia la migración) y corregir la atribución en
   `impl_496.md` (2 propios + 4 ajenos, no 6 ajenos).

### menor 1 — La cláusula estricta del `down.sql` no tiene test que la mate

R16 exige reponer solo cuando la **última** fila de historial es una recepción desde
`en_ruta_bodega_central`. Las hermanas sembradas no lo cubren: (a), (b), (e), (f) tienen mensajero
(no son candidatas del down) y (d) no tiene `recoleccion_tienda`. Quitar del `down.sql` el filtro
sobre `u.origen_tipo` y `so.value` sobreviviría a R16. Falta una hermana «en central, sin
mensajero, con `recoleccion_tienda` de M1 y una fila posterior a la recepción» que el down no debe
tocar. La decisión del spec_author (down más estricto que el documento) es **correcta** —evita
reponer a un mensajero en una orden que la central movió después—, pero hoy no está protegida.

### menor 2 — Desempate por `id`: determinista, no cronológico

`orden_historial_estado.id` es `uuid()` aleatorio: el `id DESC` del documento solo decide entre
filas con el mismo `created_at` (misma tx). La recepción escribe una sola fila por tx, así que no
afecta en la práctica. Sin test del desempate (la M12 solo prueba la dirección). Informativo.

### menor 3 — `down.sql` con pérdida en el caso de reversión de incidente (P1)

Una orden que llegó a `en_ruta_bodega_central` por reversión de incidente y tiene una
`recoleccion_tienda` antigua recibiría en el down al recolector antiguo, no al mensajero que tenía
antes del up. Un down de datos no puede ser inverso exacto sin guardar el valor; solo está
documentado el caso «sin recolección». Informativo.

### menor 4 — Guardia `asignado-at-solo-lectura`: permiso estrecho, sin autocomprobación

El permiso nuevo no debilita nada de la original. La igualdad exacta de
`MIGRACIONES_QUE_TOCAN_LA_COLUMNA` sigue (solo entra `…_496/migration.sql`; si el `down.sql`
nombrara la columna, cae). El caso «496» exige UNA sentencia con `asignado_at`, que toda asignación
sea exactamente `= NULL` (el patrón corta en la coma o el salto de línea, así que `COALESCE(NULL,
now())`, `NULLIF(...)` o un `now()` en la línea siguiente salen rojos) y `mensajero_asignado_id =
NULL` en la misma sentencia. Un `"asignado_at" = now()` entrecomillado no casa el patrón de
asignación, pero o deja 0 asignaciones (rojo por `> 0`), o duplica la columna en el mismo `SET`
(Postgres lo rechaza), o va en otra sentencia (rojo por `toHaveLength(1)`). Sin hueco práctico.
Dos observaciones: (a) no lleva autocomprobación en las dos direcciones como el caso «246» (G1/G2
se hicieron a mano); (b) la guardia no acota el `WHERE`: ampliar el universo de la migración (que sí
movería denominadores históricos al limpiar mensajero) lo vigila R15, no la guardia. Aceptable;
anotarlo en el comentario de la guardia sería mejor.

### menor 5 — R13 sin control positivo

«⭑ R13» afirma `[]` sin un caso hermano no borrado que sí salga en el mismo `it`. Las mutaciones
M10a/M10b lo ponen rojo, así que mide; pero un `[]` por otra causa pasaría.

## Verificado y correcto (puntos pedidos)

2. **Revocación de la R18 (138):** solo en `en_ruta_bodega_central` (`liberaAsignacion: true` en
   `TRANSICIONES`; la devolución `false`, obligatorio en el tipo). El trío va en el MISMO
   `updateMany` bajo la misma guarda (id + `deletedAt` + estado origen): count 0 implica que nada
   cambia (R3 probado con ya recibida, borrada, estado no origen y carrera directa al repo).
   `num_guia` fuera del `data` (unit + R4 contra Postgres). Una sola fila de historial (R4 compara
   la lista exacta de `origenTipo`). Nota de revocación bajo la R18 de la 138 presente.
3. **«Recolectadas hoy»:** `deletedAt: null` fuera del OR; rama 2 = sin mensajero **y**
   `historialEstados.some({ origenTipo: recoleccion_tienda, actorUsuarioId: yo })`. Los ids vienen
   de `findRecoleccionesDeActor(actor de sesión, ventana)`, no del cliente. R11/R12 con controles
   (el dueño real sí la ve). No filtra órdenes de otros.
4. **Migración:** `DISTINCT ON (orden_id) … created_at DESC, id DESC` sobre las candidatas; exige
   `origen_tipo = recepcion_bodega_central` y origen `en_ruta_bodega_central`; no toca órdenes con
   historial posterior (hermana a, sembrada con la recepción PRIMERO para matar el `ASC`). Las
   asignaciones de mensajero del código (`asignarBodegaLote`, `asignarRecoleccionLote`, generación
   de guía) pasan por `appendCambioEstado`, así que «sin fila posterior» sí implica «nadie la
   reasignó después». Sin `updated_at`, sin historial, idempotente (R17). `down.sql` más estricto
   que el documento: correcto (ver menor 1 sobre su cobertura).
6. **Tests borrados/debilitados:** solo se sustituyó en el unit del repo el
   `toEqual({ estatusId })` + `not.toHaveProperty("mensajeroAsignadoId")` de la arista revocada por
   el literal del trío en NULL (lo pide el spec). Se añadió `not.toHaveProperty("numGuia")` a la
   devolución. Ninguna aserción contra su propia fuente: literales ISO y objetos explícitos.

## Evidencia corrida por el revisor (en `cf16e790`)

- `vitest run` aislado: guardia `asignado-at-solo-lectura`, unit repo/service de recepción,
  `censo-order-status-rename`, `recepcion-central-libera-496`,
  `recoleccion-central-libera-496-migration`, `tablero-dia-recoleccion-496`,
  `tablero-dia-recoleccion`: 8 archivos, 75 tests verdes, 0 skipped.
- `vitest run` aislado de `orden-traspaso-migration` + `ayuda-tienda-migration`: 2 rojos
  (BLOQUEANTE 1).
- `tsc --noEmit` verde; `eslint` de los archivos tocados sin issues.
- No corrí `./init.sh` (instrucción del leader).
