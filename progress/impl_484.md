# impl 484 — puntero `orden_en_gestion` colgado (backend)

Rama `feat/484-puntero-gestion-colgado`, worktree aislado, base `5bebf00b`. Sin migracion (R16).
Busqueda de codigo: MCP `codebase-memory` (proyecto `R-job-singularis-projects-ordenex`) y cada
simbolo confirmado en el archivo real.

## Archivos

Codigo:
- `lib/repositories/CierreDiaRepository.ts` — T4: `crearCierre`, bloque `corteSinGestionar`, dentro
  de `if (movidas.count > 0)`: `tx.usuario.updateMany` con `ordenEnGestionId IN ids` +
  `ordenEnGestion.estatusId = sinGestionarEstatusId`.
- `lib/repositories/CierresAdminRepository.ts` — T5: `resolverCierre`, ramas `enElTope` (guarda
  `rechazadaEstatusId`) y `aBodega` (guarda `destinoEstatusId`), cada una dentro de su
  `if (movidas.count > 0)`.
- `lib/repositories/OrdenRepository.ts` — T6: `traspasarMensajeroLote`, tras el `throw` de
  perdedoras y antes de las conversaciones: `id = mensajeroOrigenId AND ordenEnGestionId IN ids`.
- `lib/repositories/GestionOrdenRepository.ts` — T7c: predicado unico `whereOrdenEnGestionVigente`
  (en_reparto + mensajero + no borrada + `whereOrdenSinGestionPendiente()`); `getOrdenEnGestion`
  pasa a `findFirst` con `ordenEnGestion: { is: vigente }`; tercera rama
  `NOT: { ordenEnGestion: { is: vigente } }` en el `OR` de `setOrdenEnGestion`.
- `lib/interfaces/repositories/IGestionOrdenRepository.ts` — JSDoc de los dos metodos.
- `lib/services/MisAsignacionesService.ts` — T7d: `publicarOrdenEnGestion` (puntero solo si esta en
  `porGestionar ∪ conAyuda`), en memoria.

Tests nuevos:
- `tests/integration/db/484-puntero-corte-sql-real.test.ts` (T1)
- `tests/integration/db/484-puntero-aprobacion-sql-real.test.ts` (T2)
- `tests/integration/db/484-puntero-traspaso-sql-real.test.ts` (T3)
- `tests/integration/db/484-puntero-vigente-sql-real.test.ts` (T7a)
- `tests/integration/db/484-puntero-incidente-blst765.test.ts` (T8)
- `tests/integration/db/_puntero-484.ts` (utilidades; reutiliza `454/_escenario.ts`)
- `tests/unit/services/mis-asignaciones-puntero-colgado.test.ts` (T7b)

Tests tocados (sin cambiar asercion de comportamiento previo):
- `tests/unit/repositories/gestion-orden-repository.test.ts` — `findUnique` → `findFirst` en el
  doble, y el `OR` de `setOrdenEnGestion` comprueba las dos ramas de siempre + la tercera.
- `tests/unit/repositories/cierre-dia-repository.test.ts`,
  `tests/unit/repositories/cierres-admin-repository.test.ts`,
  `tests/unit/services/cierres-admin-service.aprobar.sin-gestion.test.ts` — sus dobles de `tx`
  responden `usuario.updateMany`.
- `tests/unit/guards/aprobacion-escrituras-cubiertas.guardia.test.ts` — se declara
  `tx.usuario.updateMany` en el inventario de la aprobacion con su suite (la guardia se puso roja,
  que es su funcion).

## R → test

| R | Test |
|---|---|
| R1 | `484-puntero-corte-sql-real` («R1: el puntero de M…», «R1: tambien queda NULL el de OTRO usuario…») |
| R2 | `484-puntero-corte-sql-real` («R2: no se tocan los punteros…», «R2: las filas de esos usuarios no cambian…») |
| R3 | `484-puntero-aprobacion-sql-real` («R3: …liberada a bodega…») |
| R4 | `484-puntero-aprobacion-sql-real` («R4: …terminada por tope…») |
| R5 | `484-puntero-aprobacion-sql-real` («R5: …no libera ni termina…», «R5: si la aprobacion no llega a confirmarse…» con SAVEPOINT real) |
| R6 | `484-puntero-traspaso-sql-real` (tres casos R6) |
| R7 | `484-puntero-traspaso-sql-real` (dos casos R7: con savepoint y de paso) |
| R8 | `484-puntero-corte-sql-real` y `484-puntero-aprobacion-sql-real` (casos R8: fila de M, historial, totales, libros) |
| R9 | `mis-asignaciones-puntero-colgado` (5 casos), `484-puntero-vigente-sql-real` (getOrdenEnGestion), `484-puntero-incidente-blst765` (heredado) |
| R10 | `mis-asignaciones-puntero-colgado` («R10…»), `484-puntero-incidente-blst765` (el puntero sigue tras listar) |
| R11 | `484-puntero-vigente-sql-real` (5 causas + servicio), `484-puntero-incidente-blst765` (heredado) |
| R12 | `484-puntero-vigente-sql-real` (vigente y con ayuda → false; servicio → conflicto) |
| R13 | `mis-asignaciones-puntero-colgado` («R13…»), `484-puntero-vigente-sql-real` (servicio real) |
| R14 | `mis-asignaciones-puntero-colgado` («R14…»), `484-puntero-vigente-sql-real` (servicio real) |
| R15 | `484-puntero-incidente-blst765` |
| R16 | T10, verificacion de release (leader). Sin migracion ni backfill en el diff. |

## Mutaciones (arnes `mutar.py`, una por corrida, restaurando el archivo; base verde antes y despues)

El arnes exige que el patron aparezca exactamente una vez y que el archivo cambie; lista los tests
que caen por nombre.

| # | Mutacion | Resultado |
|---|---|---|
| M1 | corte: borrar la limpieza | muere (3 rojos: R1 ×2, R8) |
| M2 | corte: quitar `ordenEnGestionId IN ids` | muere (R2 ×2) |
| M3 | corte: quitar la guarda de destino `estatusId = sin_gestionar` | **sobrevive** (ver abajo) |
| M4 | corte: añadir `id = mensajero` | muere (R1 «otro usuario») |
| M5 | aprobacion: borrar limpieza rama `aBodega` | muere (R3) |
| M6 | aprobacion: borrar limpieza rama `enElTope` | muere (R4) |
| M7 | aprobacion `aBodega`: quitar `IN ids` | muere (R5) |
| M8 | aprobacion `enElTope`: quitar `IN ids` | muere (R5) |
| M9 | aprobacion `aBodega`: quitar guarda de destino | **sobrevive** |
| M10 | aprobacion `enElTope`: quitar guarda de destino | **sobrevive** |
| M11 | traspaso: borrar la limpieza | muere (R6) |
| M12 | traspaso: quitar `id = mensajeroOrigenId` | muere (R6 destino) |
| M13 | traspaso: limpieza antes del `throw` de perdedoras | muere (R7 de paso) |
| M14-M17 | vigencia: quitar estado / mensajero / `deletedAt` / sin gestion pendiente | mueren las cuatro (2 rojos cada una, su causa) |
| M18 | `setOrdenEnGestion`: quitar la rama «colgado» | muere (R11 ×6) |
| M19 | `getOrdenEnGestion`: puntero crudo | muere (R9/R13 ×6) |
| M20 | servicio: publicar el puntero crudo | muere (R9 ×2, R10) |
| M21 | T8: revertir a la vez raiz (corte+aprobacion) y defensa del repo | muere (R15 ×2, heredado R11) |

Supervivientes M3/M9/M10: mutantes equivalentes en ausencia de concurrencia. Los `ids` sobre los que
se limpia ya estan filtrados por el estado de origen bajo candado (corte: `UPDATE … RETURNING` +
re-lectura; aprobacion: `findMany` por `estatusId = sin_gestionar` dentro de la tx), asi que toda
orden de `ids` es movida por el `updateMany`. La guarda de destino solo cambia el resultado si una
orden de `ids` NO se mueve, que exige una carrera entre la lectura y la escritura que no se puede
provocar con una sola conexion. Se conservan como defensa (design §3); lo que protege a los demas
punteros, `IN ids`, si esta medido (M2, M7, M8). Para matar M7/M8 hizo falta añadir testigos que
apuntan a ordenes AJENAS ya en `en_bodega_central` y en `devolucion_a_origen_por_rechazo`; para
M14, la causa «barrida» (`novedad_interna` conservando el mensajero, el estado intermedio del
incidente).

## Verificacion

- Gate: `./init.sh --rapido`, log en `progress/gate_484.log`, `INIT_EXIT=0`. Modo AMPLIADO (el diff
  toca `CierreDiaRepository`/`CierresAdminRepository`). DATABASE_URL resuelta: «los 363 archivos de
  tests contra Postgres SI se ejecutan» (se exporto en la sesion desde el `.env` del arbol principal,
  sin copiarlo ni imprimirlo).
  - typecheck: paso. lint: paso (0 errors, 235 warnings preexistentes; ninguno en archivos de la 484).
  - relacionados (`--changed origin/dev`): 671 archivos, 8357 passed | 26 skipped (17 en
    `AnaliticaPage.test.tsx` y 9 en `AnaliticaShell.test.tsx`, `it.skip` preexistentes; ninguno de
    la 484).
  - guardias: 273 archivos, 3755 passed.
  - `tests/integration/db` completo: 451 archivos, 4213 passed, 0 skipped. «sin rojos nuevos».
- Primera corrida del gate (antes del ultimo commit de tests): `484-puntero-corte` rojo en paralelo y
  verde aislado — el R8 de dinero usaba `count()` GLOBALES y otra suite borro una fila de
  `wallet_tienda_movimiento` fuera del candado (`tienda: -1`). No era intermitencia ajena: era el
  test. Se acoto el recuento al escenario (tienda y mensajero propios, caja por origen) y la segunda
  corrida salio limpia.
- Guardias de T9 a mano (`vitest run` de los cinco archivos): `historial-accion-escrituras-cubiertas`
  72 ✓, `aprobacion-escrituras-cubiertas` 8 ✓ (tras declarar la escritura), `cierre-sin-gestion-sin-dinero`
  8 ✓, `consultas-concurrentes-en-transaccion` 23 ✓, `carga-del-mensajero` 18 ✓. Ademas, toda
  `tests/unit/guards` + `cierre-sin-gestion-sql-real` + `cierre-sin-gestion-tope-sql-real` +
  `traspaso-mensajero.int` + `tests/integration/db/454`: 246 archivos, 2911 passed (la guardia
  `censo-order-status-rename` cazo el identificador `rechazada` en un test nuevo; renombrado).
- `vitest related --run` de los seis archivos de `lib/` tocados: 670 archivos; los 3 rojos (dobles
  de `tx` sin `usuario.updateMany`) se arreglaron y re-corrieron: 179 passed.

## Desviaciones

- R8 «ninguna otra columna de `usuario`»: la limpieza usa `updateMany` de Prisma, que sella
  `updated_at` (`@updatedAt`), igual que los dos escritores del puntero que ya existian
  (`liberarOrdenEnGestion`, `registrarGestionPendiente`). Los tests comparan la fila entera salvo
  `orden_en_gestion_id` y `updated_at`; los usuarios NO tocados se comparan enteros (incluido
  `updated_at`).
- R1/R5 atomicidad: R5 se mide con un fallo provocado (registro de acciones roto, SAVEPOINT real). R1
  no tiene caso de fallo propio: la limpieza vive en el callback de la `$transaction` del corte y la
  unica salida por error tras ella (`SinGestionesVinculadas`) es inalcanzable cuando se barrio algo.
- T1/T2/T3/T7a/T7b «el archivo falla contra dev»: medido con las mutaciones M1/M5/M6/M11/M18/M19/M20,
  que equivalen a quitar el codigo nuevo de cada bloque; no se corrio contra un checkout de `dev`.
- T10 (R16, consulta en produccion) es del leader en la release; no se ejecuto.

Veredicto: R1-R15 implementados y trazados a test, gate `--rapido` ampliado verde (INIT_EXIT=0), 18 de
21 mutaciones muertas y las 3 supervivientes explicadas como guardas defensivas equivalentes.
