# 477 — Corregir las gestiones de un cierre rechazado — bitacora de implementacion (backend)

> backend_dev, 2026-10-15. Tareas T0-T4 de `specs/477-corregir-gestiones-cierre-rechazado/tasks.md`.
> T5 (frontend) NO es de este paso. Worktree aislado, rama `feature/477-corregir-gestiones-cierre-rechazado`.
> Busqueda: MCP `codebase-memory` disponible (proyecto `R-job-singularis-projects-ordenex`) y
> `git grep`/`Grep` para leer y confirmar en el archivo real.

## T0 — Puertas

- **T0.1 — Preguntas abiertas 1-6:** todas por DEFECTO (aprobado por el humano: «valores por
  defecto P1-P6»). P1 se acepta el corte adelantado; P2 se borran las filas de `cierre_detail` sin
  gestion; P3 se permite re-solicitar con ordenes sin rehacer; P4 tarifa de HOY de la zona destino;
  P5 solo `rechazado`; P6 no se toca la valvula del admin. Ninguna alternativa -> no hay vuelta al spec.
- **T0.2 — Medicion en produccion: NO HECHA.** El MCP `supabase` no esta en el conjunto de
  herramientas de este agente. Queda pendiente para el leader: contar cierres `rechazado` hoy y
  gestiones LEGADAS (sin evento `gestion_registrada`) vinculadas a ellos (si hay, R10 las deja sin
  correccion y hay que avisar al humano).

## Archivos

Codigo (creado / modificado):
- `lib/repositories/correccion-cierre.ts` (NUEVO) — predicado unico D2 (`sqlOrdenesEnCorreccion`,
  `ordenesEnCorreccion`).
- `lib/repositories/OrdenRepository.ts` + `lib/interfaces/repositories/IOrdenRepository.ts` —
  `findOrdenesEnCorreccion(mensajeroId, ordenIds)` (lista vacia = 0 consultas).
- `lib/repositories/CierreDiaRepository.ts` + `lib/interfaces/repositories/ICierreDiaRepository.ts` —
  `findGestionParaDeshacer` (+`cierreEstado`, `cierreMensajeroId`), `findCierreResolicitableMasViejo`
  (+`destinoZonaId`), `anularGestionDeCierreRechazado`, `resolicitarCierreRechazado`,
  `findCorreccionesPendientes`; helpers de modulo `recalcularTotalesDelCierre` (D3, mismo calculo
  que la 398) y `registrarGestionAnulada` (evento + webhook, ahora compartido con
  `anularGestionPendiente`, sin cambio de conducta).
- `lib/services/CierreDiaService.ts` + `lib/interfaces/services/ICierreDiaService.ts` — guardas del
  deshacer (D4), rama 2 de `solicitarCierre` (rechazado -> D5; vencido igual que hoy),
  `listarCierreDia.correcciones` (`CorreccionCierreDTO`, `OrdenEnCorreccionDTO`).
- `lib/services/MisAsignacionesService.ts` + `lib/interfaces/services/IMisAsignacionesService.ts` —
  exencion por objeto en `escogerParaGestion`/`gestionar`; `enCorreccion` en el DTO.

Tests nuevos:
- `tests/integration/db/_correccion-477.ts` (utilidades)
- `tests/integration/db/477-ordenes-en-correccion-sql-real.test.ts`
- `tests/integration/db/477-deshacer-cierre-rechazado-sql-real.test.ts`
- `tests/integration/db/477-regestionar-sin-cierre-sql-real.test.ts`
- `tests/integration/db/477-resolicitud-rechazado-sql-real.test.ts`
- `tests/integration/db/477-aprobacion-tras-correccion-sql-real.test.ts`
- `tests/unit/services/cierre-dia-477-deshacer.test.ts`
- `tests/unit/services/cierre-dia-477-resolicitud.test.ts`
- `tests/unit/services/mis-asignaciones-477-correccion.test.ts`

Tests existentes tocados (dobles + contrato que el spec cambia):
- Dobles con los metodos nuevos (stub inerte): `bulk-orden-service*.test.ts`, `orden-service.test.ts`,
  `rol-admin-satelite-authz.test.ts`, los `mis-asignaciones-*.test.ts`, `tope-intentos-dto-derivado`,
  `correccion-dia-reparto-efectos.int.test.ts`, `cierre-dia-service-totales-mixtos`,
  `cierre-dia-deshacer-dia-reparto`, `cierre-dia-pasados-*`, `integration/actions/cierre-dia-action`.
- Contrato cambiado por el spec (no «arreglados para que pasen»):
  - `cierre-dia-service.test.ts` (109/R28): el `rechazado` ya va por `resolicitarCierreRechazado`
    con la tarifa de la zona destino (D5); el R5 de la 111 ya no afirma «sin leer la gestion» (D4:
    con bloqueo se LEE para saber si es corregible) y afirma que no se llama a ninguna escritura.
  - `cierre-bloqueo-superficies.test.ts`: el doble de Prisma gana `$queryRaw` (ninguna orden en
    correccion); el deshacer bloqueado afirma el motivo de bloqueo y la lectura (D4) en vez de
    «no lee».
  - `cierre-dia-repository.test.ts` (fila de `findGestionParaDeshacer` con los dos campos nuevos),
    `recoleccion-tienda-service.test.ts` (`toDTO` emite `enCorreccion: false`; ese `toEqual` existe
    para caer cuando `toDTO` gana un campo) y `integration/db/cierre-bloqueo-nv-sql-real.test.ts`
    (`findCierreResolicitableMasViejo` trae `destinoZonaId`: `toEqual` -> `toMatchObject`).
  - `gestion-desde-ayuda-cierre-aprobacion.test.ts` / `notificacion-productores-wiring.test.ts`: la
    rama `rechazado` llama a `resolicitarCierreRechazado`; la propiedad de la 237 (una gestion de la
    tienda de OTRA orden cae en el cierre siguiente) se conserva y la mide R16 contra Postgres.

## Decisiones y desviaciones del spec

1. **R11, motivo:** si `anularGestionDeCierreRechazado` devuelve `false`, el servicio responde
   `MSG_YA_EN_CIERRE` (la carrera que esta via añade es la re-solicitud; la de orden movida ya la
   filtra la guarda previa con su motivo). El repo devuelve `boolean` como dice el design.
2. **Re-solicitud, orden de pasos:** las ordenes en correccion se leen ANTES del `rechazado ->
   solicitado` (el predicado D2 exige `rechazado`); la poda de `cierre_detail` borra
   «en correccion − recien vinculadas», que es el predicado D2 evaluado tras vincular, sin escribir
   una segunda copia de el. Todo bajo el candado `FOR UPDATE` de `cierre_dia` (§4).
3. **Vincular con ids:** se pre-leen los ids candidatos (`gestionesDelCierreWhere` AND ordenes en
   correccion) y el `updateMany` repite el predicado; se congela pago/ingreso solo de las que
   quedaron con `cierre_id = X`. `gestionesDelCierreWhere` no se modifica.
4. **`enCorreccion` opcional en `MiAsignacionDTO`** (tasks T3.2 decia obligatorio): mismo patron
   aditivo que `enElTope?` para no romper los fixtures de componentes (frontend) que construyen el
   DTO. `toDTO` emite `false` siempre y el listado lo sobreescribe; `correcciones?` igual en
   `ListarCierreDiaServiceResult` (patron `tieneRechazado?`).
5. **`regestionada`** usa `gestionesDelCierreWhere` (el MISMO predicado con el que la re-solicitud
   vincula), no un «cualquier gestion vigente sin cierre»: la pantalla no puede prometer una gestion
   que el cierre no se llevaria (p. ej. un rechazo de tienda).
6. **Caso (b) del deshacer** exige ademas gestion 454 (`registradaComoPendiente`), sin anular, como
   dice el glosario.
7. **listar `enCorreccion`:** con bloqueo, una consulta en lote; libre, ninguna (cuesta la lectura
   de `findBloqueoDetalle`, que el listado no hacia antes).
8. **Sin migracion.** Ni esquema ni RLS.

## T3.5 — Composition root

- `lib/actions/cierre-dia.ts:54` — `new OrdenRepository(prisma)` (real) como `ordenRepo` de
  `CierreDiaService`; el `Pick` incluye `findOrdenesEnCorreccion` y el typecheck lo exige.
- `lib/actions/mis-asignaciones.ts:114-119` — `const ordenRepo = new OrdenRepository(prisma)` pasado
  como 2.º argumento de `MisAsignacionesService`.
- `CierreDiaRepository` real en `lib/actions/cierre-dia.ts` implementa los tres metodos nuevos
  (`implements ICierreDiaRepository`, obligatorios en la interfaz).

## Mapa R -> test

| R | Test |
|---|---|
| R1, R2, R3 | `tests/integration/db/477-deshacer-cierre-rechazado-sql-real.test.ts` (R1/R2/R3) |
| R4 | `tests/unit/services/cierre-dia-477-deshacer.test.ts` (R4) |
| R5 | `cierre-dia-477-deshacer.test.ts` (R5, 5 casos con igualdad de respuesta) |
| R6 | `cierre-dia-477-deshacer.test.ts` (R6) + `477-deshacer-…-sql-real` (R6) |
| R7, R8, R10 | `cierre-dia-477-deshacer.test.ts` |
| R9 | `cierre-dia-477-deshacer.test.ts` + `477-deshacer-…-sql-real` (R9) |
| R11 | `477-deshacer-…-sql-real` (R11) + `cierre-dia-477-deshacer.test.ts` (servicio) |
| R12, R13 | `tests/unit/services/mis-asignaciones-477-correccion.test.ts` + `477-regestionar-sin-cierre-sql-real` |
| R14 | `tests/integration/db/477-regestionar-sin-cierre-sql-real.test.ts` |
| D2 (predicado) | `tests/integration/db/477-ordenes-en-correccion-sql-real.test.ts` |
| R15-R19 | `tests/integration/db/477-resolicitud-rechazado-sql-real.test.ts` (caso 1) |
| R20 | `477-resolicitud-…-sql-real` (R20) + `454/caracterizacion/cierre-rechazado.test.ts` (existente) |
| R21 | `tests/unit/services/cierre-dia-477-resolicitud.test.ts` (R21) |
| R22 | `477-resolicitud-…-sql-real` (R22) + `cierre-dia-477-resolicitud.test.ts` (servicio) |
| R23, R24 | `tests/integration/db/477-aprobacion-tras-correccion-sql-real.test.ts` |
| R25, R26 (datos) | `cierre-dia-477-resolicitud.test.ts` (T4.7) — la pantalla es T5 |
| R27 (datos) | `mis-asignaciones-477-correccion.test.ts` (R27) + `477-regestionar-…` (R27) — la pantalla es T5 |
| R28 | T5 (frontend), sin parte backend |

## Contraprueba de mutaciones (WHERE y recalculos)

Arnes propio (scratchpad, no commiteado): cada mutacion se aplica con `count == 1` comprobado, corre
los tests de Postgres indicados, y restaura el archivo comprobando que queda byte a byte igual.
Control sin mutar: `11 passed (11)`.

| Mutacion | Archivo | Resultado |
|---|---|---|
| M1 predicado sin `estado = 'rechazado'` | correccion-cierre.ts | MUERE (1 failed) |
| M2 predicado sin `mensajero_id` | correccion-cierre.ts | MUERE |
| M3 sin correlacion `g.cierre_id = cd.cierre_id` | correccion-cierre.ts | MUERE |
| M4 sin correlacion `g.orden_id = cd.orden_id` | correccion-cierre.ts | MUERE |
| M5 sin `g.anulada_at IS NULL` | correccion-cierre.ts | MUERE |
| M6 deshacer conserva `cierre_id` (A1) | CierreDiaRepository.ts | MUERE (deshacer + aprobacion: 2 failed) |
| M7 deshacer sin recalculo | CierreDiaRepository.ts | MUERE |
| M8 deshacer sin re-lectura ni guarda del recalculo | CierreDiaRepository.ts | MUERE |
| M8b deshacer sin re-lectura (sola) | CierreDiaRepository.ts | MUERE |
| M9 re-solicitud vincula sin estrechar por ordenes | CierreDiaRepository.ts | MUERE |
| M10 re-solicitud sin podar `cierre_detail` | CierreDiaRepository.ts | MUERE |
| M11 re-solicitud poda TODO el detalle | CierreDiaRepository.ts | MUERE |
| M12 re-solicitud sin recalculo | CierreDiaRepository.ts | MUERE |
| M13 re-solicitud sin guarda de estado | CierreDiaRepository.ts | MUERE |
| M14 re-solicitud congela con tarifa null | CierreDiaRepository.ts | MUERE |
| M15 sin exencion por objeto al gestionar | MisAsignacionesService.ts | MUERE |

## Verificacion

- `pnpm run typecheck`: verde (sin salida de error).
- `pnpm exec eslint` sobre los archivos tocados: 0 errores, 1 warning PREEXISTENTE
  (`IOrdenRepository.ts:11`, import sin uso de `OrdenHistorialOrigenTipo`, no es de esta ficha).
- Tests nuevos: `8 passed (8)` archivos, `42 passed (42)`.
- Tests afectados existentes (27 archivos): `658 passed (658)`.
- Gate `./init.sh --rapido`: ver `progress/gate_477_backend.log` (resumen abajo).

## Gate

`./init.sh --rapido` (modo AMPLIADO por tocar dinero/datos; `DATABASE_URL` resuelta con el `.env`
copiado al worktree, borrado al terminar). Log: `progress/gate_477_backend.log`.

- Corrida 1: `INIT_EXIT=1` — 3 rojos NUEVOS y MIOS (los tres tests de contrato de arriba:
  `cierre-dia-repository`, `recoleccion-tienda-service`, `cierre-bloqueo-nv-sql-real`). Corregidos y
  verificados aislados (`3 passed`, `171 passed`).
- Corrida 2 (la que vale):
  - relacionados (`--changed`): `658 passed (658)` archivos, `8592 passed | 26 skipped (8618)`;
  - guardias: `274 passed (274)`, `3764 passed (3764)`;
  - `tests/integration/db` entera: `1 failed | 445 passed (446)`, `1 failed | 4165 passed (4166)`,
    **0 skipped**; el rojo, `marca-conciliacion.int.test.ts`, repetido AISLADO por el gate:
    `9 passed (9)` -> intermitente (no toca codigo de esta ficha).
  - `== init OK ==`, `INIT_EXIT=0`.

## Veredicto

Backend de la 477 (T1-T4) implementado y verde en el gate rapido ampliado; pendiente T0.2 (medir en
produccion, sin MCP `supabase` en este agente) y T5 (frontend).
