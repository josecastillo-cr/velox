# review 484 — puntero `orden_en_gestion` colgado

Revisor: reviewer (subagente). Fecha: 2026-10-19. Rama `feat/484-puntero-gestion-colgado`, HEAD
revisado `500d3fd5`, base `origin/dev` = `ade121a2` (merge-base, sin movimiento). Worktree
`.claude/worktrees/agent-abccc80eb3f43da2f`.

Búsqueda de código: MCP `codebase-memory` (`R-job-singularis-projects-ordenex`). Para los llamadores
de `setOrdenEnGestion`/`getOrdenEnGestion` el grafo no ve las llamadas a través de la interfaz
(0 llamadores); confirmado con grep sobre `lib/`: solo `MisAsignacionesService` (l.279, 584, 675) y la
relectura interna de `setOrdenEnGestion`.

## Checklist

### Especificación
- [x] `requirements.md` con R1–R16 en EARS.
- [x] `design.md` con alternativas descartadas (§7, tres) e inventario de 17 caminos (§2).
- [ ] `tasks.md` con todas las tasks `[x]` — **ninguna está marcada** (T1–T10 siguen `[ ]`). Ver
  hallazgo m1.

### Trazabilidad (R → test, leído el test, no solo el nombre)
| R | Test | Verifica de verdad |
|---|---|---|
| R1 | `484-puntero-corte-sql-real` «R1: el puntero de M…», «R1: …OTRO usuario…» | sí: corte real (`CorteDiarioService`), puntero de M y de un tercero → NULL |
| R2 | ídem «R2: no se tocan…», «R2: las filas… ni `updated_at`» | sí: reservada, pendiente, por recoger y `sin_gestionar` vieja de otro mensajero; filas enteras iguales |
| R3 | `484-puntero-aprobacion-sql-real` «R3…» | sí: orden a `en_bodega_central`, mensajero NULL, punteros de M y testigo NULL |
| R4 | ídem «R4…» | sí: `por_devolver_a_tienda` (tope → rechazada → 139), puntero NULL |
| R5 | ídem «R5: …no libera ni termina…», «R5: si la aprobacion no llega a confirmarse…» | sí: testigos en estados destino ajenos (matan M7/M8); fallo real con SAVEPOINT y `RegistroCaido`, cierre sigue `solicitado` |
| R6 | `484-puntero-traspaso-sql-real` tres casos R6 | sí: origen NULL, destino intacto aunque apunte a la orden, origen con otra orden intacto |
| R7 | ídem dos casos R7 | sí: con savepoint (rollback real) y «de paso» (prueba que la limpieza va tras el `throw`) |
| R8 | corte y aprobación, casos R8 | sí: fila de M salvo puntero/`updated_at`, delta de historial, vínculo, totales del cierre y libros de dinero acotados al escenario vs. corrida sin punteros |
| R9 | `mis-asignaciones-puntero-colgado` (5), `484-puntero-vigente-sql-real` (lectura × 7 causas), `484-puntero-incidente-blst765` (heredado) | sí |
| R10 | `mis-asignaciones-puntero-colgado` «R10» (ningún método de escritura de los dobles), `484-puntero-incidente-blst765` (puntero sigue tras listar) | sí |
| R11 | `484-puntero-vigente-sql-real` (5 causas colgadas + servicio real), incidente (heredado) | sí |
| R12 | `484-puntero-vigente-sql-real` (vigente y con ayuda → `false`, puntero intacto; servicio → conflicto) | sí |
| R13 | `mis-asignaciones-puntero-colgado` «R13», `484-puntero-vigente-sql-real` (servicio real, `gestionar` ok) | sí |
| R14 | `mis-asignaciones-puntero-colgado` «R14», `484-puntero-vigente-sql-real` (conflicto y 0 gestiones) | sí |
| R15 | `484-puntero-incidente-blst765` (escoger real → corte → re-solicitud → aprobación → Reparto `null` → escoger otra ok) | sí |
| R16 | Sin migración ni backfill en el diff (comprobado: ni `db/migrations` ni `schema.prisma`). La consulta de producción es T10 de release (leader) | pendiente de release, por diseño |

- [x] Todo R1–R15 mapea a test que lo verifica; R16 es verificación de release declarada.
- [x] `progress/impl_484.md` contiene el mapa R → test y las 21 mutaciones.

### Calidad de código
- [x] typecheck / lint / tests: gate `--rapido` AMPLIADO en `progress/gate_484.log`, `INIT_EXIT=0`;
  integration/db 451 archivos, 4213 passed, **0 skipped**; relacionados 671 archivos (26 skipped,
  `it.skip` preexistentes de Analitica). Los cinco `484-*` aparecen ejecutados en el log.
- [x] Re-ejecutado por mí, aislado, contra Postgres local: los cinco `484-*` + unit del servicio +
  `gestion-orden-repository` + guardia `aprobacion-escrituras-cubiertas` → 8 archivos, 100 passed,
  0 skipped. Guardias estructurales de T9 (`historial-accion-escrituras-cubiertas`,
  `cierre-sin-gestion-sin-dinero`, `consultas-concurrentes-en-transaccion`, `carga-del-mensajero`)
  + unit de `cierre-dia-repository`, `cierres-admin-repository`,
  `cierres-admin-service.aprobar.sin-gestion`, `mis-asignaciones-service` → 8 archivos, 378 passed.
  No se corrió `./init.sh` (ni completo ni `--rapido`) por instrucción del leader.
- [x] E2E: no aplica (no hay harness). El riesgo lo cubren los tests contra Postgres real de punta
  a punta (R15).

### Datos y seguridad
- [x] Sin tablas nuevas (RLS no aplica), sin migraciones, sin webhooks, sin secretos.
- [x] Sin hardcode de país/moneda/cuenta.

### Capas
- [x] Las escrituras viven en repositorios, dentro de la transacción existente de cada camino.
- [x] El predicado de vigencia vive en el repositorio; el servicio solo filtra en memoria lo que
  publica (`publicarOrdenEnGestion`), sin consulta ni escritura.
- [x] JSDoc de `IGestionOrdenRepository` actualizado.

### Verificación final
- [x] Gate `--rapido` verde (regla 5: el completo es solo de release).
- [x] Este informe.
- [ ] `progress/history.md` — lo añade el leader al cerrar.

## Comprobaciones pedidas por el leader

### Limpieza en la misma transacción y acotada al lote
- **Corte** (`CierreDiaRepository.crearCierre`, l.1136): dentro de `if (movidas.count > 0)` del
  bloque `corteSinGestionar`, con `tx`. `ids` = `pendientes`, re-leídas tras el candado del
  `UPDATE … RETURNING` (`bloqueadas`) y filtradas por `en_reparto` + mensajero + día + sin gestión
  pendiente. Filtro `ordenEnGestionId IN ids` + guarda `ordenEnGestion.estatusId = sin_gestionar`.
  `data` de una sola columna. Correcto.
- **Aprobación, rama tope** (`CierresAdminRepository.resolverCierre`, l.2102): con `tx`, dentro de
  `if (movidas.count > 0)`, tras las gestiones sintéticas y ANTES del bloque 139 que lleva
  `rechazada → por_devolver_*` (así la guarda `estatusId = rechazada` se cumple en ese instante).
  `IN ids` de `enElTope`. Correcto.
- **Aprobación, rama bodega** (l.2151): con `tx`, por cada destino del `Map`, guarda
  `estatusId = destinoEstatusId`, `IN ids` del destino. Correcto.
- **Traspaso** (`OrdenRepository.traspasarMensajeroLote`, l.4931): con `tx`, después del `throw` de
  perdedoras y antes de las conversaciones; `id = mensajeroOrigenId AND ordenEnGestionId IN ids`,
  donde `ids` son las del lote ya bloqueadas `FOR UPDATE`. El destino no se toca. Correcto.
- Las cuatro sentencias usan `tx.usuario.updateMany` con `data: { ordenEnGestionId: null }`; ninguna
  toca historial ni dinero (medido en R8).

### Definición de puntero vigente
- `whereOrdenEnGestionVigente(mensajeroId)` = `en_reparto` + `mensajeroAsignadoId = mensajeroId` +
  `deletedAt null` + `whereOrdenSinGestionPendiente()`. Coincide con lo que
  `listarMisAsignaciones` pone en `porGestionar ∪ conAyuda` (las reservadas para otro día también
  van a `porGestionar`, con `esParaManana`, así que no hay desfase repo/servicio).
- `getOrdenEnGestion`: sigue siendo lectura pura (`findFirst`, sin escritura). La lectura de
  Reparto no escribe (R10 medido con dobles y contra Postgres).
- `setOrdenEnGestion`: el `where` sigue anclado a `id: mensajeroId` — solo escribe la fila del
  propio actor; no hay vía para tocar el puntero de otro usuario. La tercera rama
  `NOT { ordenEnGestion: { is: vigente(mensajeroId) } }` solo abre la sustitución cuando el puntero
  actual NO es vigente para ese mismo mensajero; una vigente propia (incluida «con ayuda») sigue
  dando `false` (R12 medido). La validez de la orden destino la sigue garantizando
  `escogerParaGestion` (bloqueo de cierre, `cargarOrdenGestionable`, reserva) antes de llamar al
  repo, igual que antes; es su único llamador.
- `gestionar` (R21): con puntero colgado ya no rechaza; con vigente a otra, conflicto (R13/R14).

### Mutaciones supervivientes M3 / M9 / M10 (guarda de estado destino)
Aceptables. En el corte, `ids` ya está filtrado bajo candado y el `updateMany` de la orden los mueve
todos, así que la guarda es equivalente sin concurrencia. En la aprobación el `findMany` de
`ordenes` NO lleva `FOR UPDATE`, de modo que ahí la guarda de destino sí es la defensa real frente a
una orden que otro camino saque de `sin_gestionar` entre lectura y escritura; no se puede provocar
con una sola conexión. Lo que protege a los demás punteros (`IN ids`) sí está medido (M2, M7, M8).
Ver m3.

### Desviaciones declaradas en impl_484.md
1. `updated_at` sellado por Prisma en la limpieza: aceptable; es el mismo efecto que los dos
   escritores previos del puntero y los usuarios no tocados se comparan enteros. Choca con la letra
   de R8 («ninguna otra columna»): ver m2.
2. R1 sin caso de fallo propio: aceptable; la sentencia vive en el callback de la misma transacción
   del corte (leído en el código) y R5/R7 sí miden la reversión en caminos hermanos.
3. «Falla contra dev» medido por mutación en vez de checkout de `dev`: aceptable; M1/M5/M6/M11/
   M18/M19/M20 equivalen a retirar cada bloque nuevo y todas mueren.
4. T10 (R16) no ejecutado: correcto, es del leader en la release.

### Tests de integration/db sin datos
Ninguno de los cinco `484-*` usa el patrón de retorno temprano sin aserción. El salto sin base es
`describe.skip` explícito (visible como `skipped`; la corrida tuvo 0 skipped). Cada archivo abre con
un caso «anti-vacuidad» que afirma que el escenario existe (puntero puesto, vencido creado,
aprobación ok, traspaso movió 1), y los escenarios lanzan `Error` si el corte no crea el vencido.
Los dos retornos tempranos del test del incidente van DESPUÉS de `expect(status).toBe("ok")`, solo
para estrechar el tipo; no ocultan nada.

## Hallazgos

- **m1 · menor** — `tasks.md`: T1–T10 sin marcar. CHECKPOINTS pide `[x]`. La sustancia está hecha y
  verificada (T1–T9); falta el formato: marcar T1–T9 `[x]` y T10 como pendiente de release. Mismo
  criterio que reviews anteriores («solo formato, no bloquea»), pero debe quedar marcado antes de
  pasar la ficha a `done`.
- **m2 · menor** — R8 dice «NO DEBE modificar ninguna otra columna de `usuario`» y la limpieza sella
  `updated_at`. Comportamiento aceptable y declarado; conviene ajustar la letra de R8 (salvo el
  sello `updated_at`) para que spec y test digan lo mismo.
- **m3 · menor** — Las guardas de destino de la aprobación (M9/M10) no tienen test que las mate y,
  a diferencia del corte, ahí sí protegen algo real (el `findMany` no bloquea). Aceptado como
  defensa no medible con una conexión; queda anotado como riesgo conocido.
- **m4 · menor** — La consulta de verificación de `design.md` §6 (R16/T10) no incluye la condición
  «sin gestión pendiente» del predicado vigente, así que puede infra-contar punteros colgados
  (puntero a una orden `en_reparto` propia con gestión pendiente). En la release, o se añade la
  condición, o se asume que mide un subconjunto.
- **m5 · menor** — R3 solo se ejercita con destino `en_bodega_central`; la rama satélite usa el mismo
  código parametrizado por `destinoEstatusId`, sin test propio.
- **m6 · menor (no medido)** — `setOrdenEnGestion` lleva ahora un filtro relacional en `updateMany`
  (Prisma 7.8). No verifiqué si el motor lo emite como una sola sentencia `UPDATE … WHERE` o como
  lectura + `UPDATE` por id; en el segundo caso, dos «Gestionar pedido» simultáneos del MISMO
  mensajero podrían pisar un puntero recién fijado. Impacto bajo (mismo actor, doble pulsación); no
  bloquea.

Bloqueantes: ninguno.

## Veredicto

**OK**

R1–R15 trazados a tests que los verifican contra Postgres real (más R9/R10/R13/R14 en servicio);
las cuatro limpiezas van en la transacción de su camino y acotadas a las órdenes del lote; la
defensa no escribe en la lectura y no permite tocar punteros ajenos ni sustituir uno vigente; gate
`--rapido` ampliado verde y re-ejecución aislada verde (478 tests, 0 skipped). Antes de `done`:
marcar `tasks.md` (m1) y, en la release, ejecutar T10 con la consulta revisada (m4).
