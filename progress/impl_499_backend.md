# Ficha 499 — bitácora del backend (bloque B)

Rama `fix/499-distrito-una-sola-zona`, nacida de `f0833d64` (worktree `wt-499`). Spec aprobado el
2026-11-02: `specs/499-distrito-una-sola-zona/`. Búsqueda de código: MCP `codebase-memory`
(proyecto `R-job-singularis-projects-ordenex`) para localizar símbolos; confirmación siempre en el
archivo real del worktree.

> El spec cita `progress/impl_499.md`; el leader pidió este archivo para la mitad backend. El
> frontend puede continuar aquí o en `impl_499.md`.

## Lo hecho, por tarea

| Tarea | Commit | Qué |
|---|---|---|
| B.0 | `8be1c795` | `tests/integration/db/zona-distrito-unico-499.test.ts` con (i) crear y (ii) actualizar con un distrito de otra zona. **Rojo medido en `dev` sin cambios: 2 de 2, `expected 'ok' to be 'validation_error'`.** |
| B.1 | `e12fb9c4` | `db/migrations/20261102130000_zona_distrito_limpieza_499/{migration,down}.sql` y `20261102130100_zona_distrito_unico_499/{migration,down}.sql`; `@@unique([distritoId])` en `ZonaDistrito`. Prefijo `20261102130000` porque `120000` lo propuso la 497 y la 496 propone `150000` (comprobado contra `origin/dev`, wt-495 y wt-496: ninguno tiene migraciones `202611*`). |
| B.2 | `77ce6481` | Forma del rechazo medida (abajo). Script de un solo uso borrado. |
| B.3 | `d51e5c69` | `tests/integration/db/zona-distrito-499-migration.test.ts` (7 casos, R1-R8). |
| B.4 | `7d60ef61` | Contratos en `IZonaRepository` (`ConflictoDistritoZona`, `DistritoEnOtraZona`, `CreateZonaResult`, rama nueva de `UpdateZonaResult`). `create` devuelve `{ estado: "ok", zona }`. **La traducción del service (design §3.2) entró aquí** para que `tsc` quedara verde en el commit; su unitario es B.6. Helper `tests/integration/db/_fixtures/zona-creada.ts`. |
| B.5 | `08a1b2df` | `leerConflictos` (filtro en el `WHERE`), en `create` como primera sentencia y en `update` tras `not_found`/`sin_zona_central`. `esViolacionDistritoUnico` + `INDICE_DISTRITO_UNICO` en `_shared/prisma-unique.ts`, en los dos `catch` antes de la central. Unitario `tests/unit/repositories/prisma-unique-distrito.test.ts` (8). Dobles de `zona-repository.test.ts` con la lectura nueva. |
| B.6 | `32d8614e` | `tests/unit/services/zona-service-499.test.ts` (5). `MSG_DISTRITO_RECIEN_ASIGNADO` exportada desde `ZonaService.ts`. |
| B.7 | `754ccd4d` | `zona-distrito-unico-499.test.ts` completo: 10 casos contra Postgres, carrera incluida. |
| B.8 | `97ff5f9b` | `DistritoArbolDTO.zonas` + `listArbol` (comparador español) + `tests/unit/repositories/geo-repository-arbol-499.test.ts` (3). Las fixtures de `DistritoArbolDTO` de 11 tests ganan `zonas` coherente con su `zonaId`. |
| B.9 | `f47a2943` | Los 4 tests reescritos (detalle abajo). |
| B.10 | — | **No corrido por orden del leader** (`./init.sh --rapido` lo corre el frontend al final). Sin `[x]`. |

## B.2 — la forma medida del rechazo del índice

Medido el 2026-11-02, cliente real con adapter `pg`, `createMany` duplicado **dentro de un
`$transaction` interactivo**:

```
ctor: PrismaClientKnownRequestError · code: "P2002" · isKnownRequestError: true
meta.target: ausente · meta.modelName: "ZonaDistrito"
meta.driverAdapterError.cause.originalCode: "23505"
meta.driverAdapterError.cause.originalMessage: «llave duplicada viola restricción de unicidad «zona_distrito_distrito_id_key»»
cause (del propio error): undefined
```

En la carrera real de B.7 (dos conexiones, el `createMany` esperando en el índice) llega la misma
clase (`PrismaClientKnownRequestError`), vista con M4 aplicada. El detector cubre igual la forma del
driver sin `code` (`cause.code`/`cause.originalCode` 23505 + nombre en `message`/`originalMessage`/
`constraint`), y detecta **por el nombre del índice**: el del par
(`zona_distrito_zona_id_distrito_id_key`) no da falso positivo.

## Migraciones: up, down, up (base local compartida, `localhost:5432/ordenex`)

Antes de migrar la base local tenía 303 asignaciones y 3 distritos con dos zonas no centrales
(regla b). Solo conteos; ningún dato de producción aquí.

| Paso | `zona_distrito` | respaldo | índice | duplicados | esquema `respaldo` |
|---|---|---|---|---|---|
| up (`prisma migrate deploy`) | 297 | 6 filas | sí | 0 | sí |
| down 130100 → down 130000 | 303 | — | no | 3 | **borrado** (quedó vacío) |
| up otra vez | 297 | 6 filas | sí | 0 | sí |

Después: `prisma migrate status` → *up to date*; `prisma migrate diff --from-config-datasource
--to-schema` → *empty migration*. `git diff --stat origin/dev HEAD -- db/` solo muestra las dos
carpetas nuevas y `schema.prisma` (ningún `down.sql` previo tocado).

⚠️ `pnpm run db:rollback` **siempre toma la última carpeta**: la segunda llamada volvió a correr el
down de 130100 (inocuo, `DROP INDEX IF EXISTS`). El down de 130000 se corrió con
`prisma db execute --file=…/down.sql` y borrando su fila de `_prisma_migrations` a mano. Para revertir
la ficha en una base real hay que hacer lo mismo (o arreglar el script, fuera de alcance).

## B.9 — los 4 tests reescritos

| Archivo | Cambio |
|---|---|
| `cobertura-repository.test.ts` | «Dos Zonas» pasa a «Otra De Z1» (solo Z1). `varias_zonas` lo cubren los unitarios de cobertura (R25). |
| `geografia-catalogo-activo.test.ts` | `distritoDosZonas` pasa a `distritoZonaB` (solo B); se quita «con DOS zonas, `null` TAMBIÉN» (lo cubre `geo-repository-arbol-499`). |
| `corregir-datos-cliente.repo.test.ts` | Se quita el distrito ambiguo y su aserción (cubierto por «un distrito AMBIGUO» de `corregir-datos-cliente-service.test.ts`). |
| `zona-reconciliacion-ordenes.test.ts` | Se quita R3 ambiguo (como dice el design). **El inventario del design no listaba otros 4 casos de este archivo que también sembraban dos zonas:** `377/R2/R6`, `377/R3` y `377/R1` se reescriben con el distrito solo en B y guardando B (mismas aserciones, anti-vacuidad intacta); `R5/R11` pasa a «el quitado queda sin zona y no mueve nada», porque con el índice ya no puede haber dos zonas resueltas en un guardado. La UNIÓN (R5) y el lote único con dos grupos (R11) siguen probados por los unitarios con dobles de `zona-repository.test.ts`. |

`git diff origin/dev -- tests/unit/utils/cobertura-distrito.test.ts tests/unit/utils/cobertura-vs-resolve-geo.test.ts`: vacío; 44/44 verdes (R25).

## Mapa R → test (mitad backend)

| Req | Test |
|---|---|
| R1 | `zona-distrito-499-migration.test.ts` «R1: con el índice puesto, una segunda asignación insertada a pelo se rechaza» |
| R2, R3, R4 | idem «R2/R3/R4: (a) queda la no central; (b1) y (b2) quedan sin zona; lo borrado es exactamente el respaldo» |
| R5 | idem «R5: sin duplicados no se borra nada y el respaldo queda vacío» |
| R6 | idem «R6: orden, zona, distrito, tarifa_zona_mensajero e historial_accion no cambian» (huella md5 por tabla) |
| R7 | idem «R7: la migración del índice sobre un duplicado restante falla y no crea el índice» |
| R8 | idem «R8: up, down, up…» y «R8: el down no devuelve filas cuya zona ya no existe y no borra un esquema con otras tablas» |
| R9 | `zona-distrito-unico-499.test.ts` «R9: crear con conflicto y una central previa…» + B.0 (i) |
| R10 | idem «R10: actualizar con conflicto no cambia…» (con control que sí reconcilia) + B.0 (ii) |
| R11 | idem «R11: el service real nombra cada conflicto…»; orden: `zona-service-499.test.ts` «R11 (crear)/(actualizar)» |
| R12 | idem «R12: los propios sin cambios, menos de los propios, o con uno libre: `ok`» |
| R13 | idem «R13: un guardado simultáneo asigna el distrito…» (carrera real); texto: `zona-service-499.test.ts` «R13…»; detector: `prisma-unique-distrito.test.ts` |
| R14 | idem «R14: una zona que no existe responde `not_found`…» |
| R15, R16 | `geo-repository-arbol-499.test.ts` (dos o más zonas, una, ninguna) + `zona-distrito-unico-499.test.ts` «R15/R16: listArbol real…» |
| R17-R24 | **frontend** (F.1-F.3) |
| R25 | `tests/unit/utils/cobertura-distrito.test.ts` y `cobertura-vs-resolve-geo.test.ts`, sin cambios, verdes |
| design §4.2 | `zona-distrito-unico-499.test.ts` «`sin_zona_central` gana a un conflicto» |

## Mutaciones (cada una: aplicar, ver rojo, restaurar con `git checkout`, `git diff` vacío)

| Mutación | Test que la mata |
|---|---|
| M1: quitar `leerConflictos` de `update` | «R11: el service real nombra…» (sale el mensaje de recarga) |
| M2: quitar el `NOT zonaId` del `WHERE` | «R10», «R12» y «R13» |
| M3: leer conflictos en `create` después del `updateMany` de la central | «R9» (la central pierde la marca) |
| M4: quitar `esViolacionDistritoUnico` de los `catch` | «R13» (se relanza el P2002) |
| M5: la regla (a) conserva la central | «R2/R3/R4» |
| Extra: `DELETE` por `distrito_id` en vez de por ids del respaldo | «R2/R3/R4» y los dos «R8» |
| Extra: down sin `EXISTS` de zona | «R8: el down no devuelve filas…» |
| Extra: down que borra el esquema siempre (`CASCADE`) | «R8: el down no devuelve filas…» |
| Extra: ordenar por código de carácter en el service | `zona-service-499` «R11 (crear)» y «(actualizar)» |
| Extra: quitar el `sort` de `zonas` en `listArbol` | `geo-repository-arbol-499` «R15/R16: con varias zonas…» |
| M6, M7, M8 | **frontend** |

## Verificación

- `pnpm exec tsc --noEmit`: **0 errores** (`TSC_EXIT=0`).
- `pnpm exec eslint` sobre los 34 archivos `.ts/.tsx` del diff: 0 errores, 1 warning previo
  (`normalizeName` sin usar en `ZonaRepository.ts`, ya estaba en `origin/dev`).
- `tests/integration/db` de zonas/geografía/cobertura/distrito (43 archivos):
  **43 passed, 501 tests passed, 0 skipped, EXIT=0**.
- `pnpm exec vitest related --run` de los 6 archivos de `lib/` tocados (ZonaRepository, ZonaService,
  IZonaRepository, prisma-unique, GeoRepository, geografia-nodo): **692 archivos passed, 8963 tests
  passed, 26 skipped, EXIT=0** (1046 s). Los 26 `skipped` no se identifican en la salida no verbosa:
  el gate del frontend debe compararlos con `dev` (memoria «Gate sin `.env`»).
- Los nuevos, aislados: `zona-distrito-unico-499` 10/10, `zona-distrito-499-migration` 7/7,
  `prisma-unique-distrito` 8/8, `zona-service-499` 5/5, `geo-repository-arbol-499` 3/3.
- Base local sin restos de los tests (0 zonas/distritos `499 %`; 297 asignaciones).

## Para el frontend (bloque F, tareas exactas)

Contrato que deja el backend:
- `DistritoArbolDTO.zonas: { id; nombre }[]`, ordenada (español); `zonaId`/`zonaNombre` sin cambios.
- `crearZona`/`actualizarZona` responden `validation_error` con `fieldErrors.distritoIds`: un
  mensaje por conflicto «`<distrito>` ya está en la zona `<zona>`.», ya ordenados; o solo
  «Alguno de los elegidos acaba de asignarse a otra zona. Recarga la página y vuelve a intentarlo.»
  (constante `MSG_DISTRITO_RECIEN_ASIGNADO` en `lib/services/ZonaService.ts`, módulo de servidor:
  no importarlo en cliente).
- Las fixtures de `tests/components/*` que construyen `DistritoArbolDTO` ya llevan `zonas`.

Pendiente: **F.1** (selector: `zonaPropiaId`, `bloqueado`, `disabled`, `(zona: …)` desde `d.zonas`,
`provDistIds`/`cantDistIds` solo seleccionables, grupo vacío deshabilitado; test
`GeografiaSelectorZonaUnica.test.tsx`; M6, M8), **F.2** (`abrirCrear`/`abrirEditar` leen el árbol,
toast y no abren si falla, preselección con `d.zonas.some`, `zonaPropiaId` hasta el selector; test
`ZonasTarifasDistritoUnico.test.tsx`; M7), **F.3** (rama `distritoIds` en `mensajeDeError` antes de
`nombre`/`esCentral`, toast «… (y N−1 más).», `conflict` sin «distrito»), **F.4** (ver la app),
**F.5** (`./init.sh --rapido`, que también cierra el B.10), y R.1 (trazabilidad R17-R24 y M6-M8).

## Abiertos y avisos

1. **Base local compartida.** El índice y la limpieza ya están aplicados en `localhost:5432/ordenex`
   (6 asignaciones de datos locales movidas a `respaldo.zona_distrito_499`). Hasta que esto se
   mergee, en cualquier otra rama se ponen ROJOS contra esa base los tests que siembran un distrito
   en dos zonas: los 4 archivos de B.9 (en `zona-reconciliacion-ordenes`, 5 casos, no 1).
2. **`prisma generate` escribió en el `node_modules` compartido** (junction al checkout principal):
   el cliente de los demás worktrees ya conoce `@@unique([distritoId])` (aditivo; `distritoId` pasa a
   ser `WhereUniqueInput` de `ZonaDistrito`).
3. **Inventario incompleto del design §7:** 4 casos más de `zona-reconciliacion-ordenes` (arriba).
   R5 (unión) y R11 (un lote con dos grupos) quedan cubiertos solo por dobles: en la base ya son
   inalcanzables.
4. **`db:rollback`** no sabe revertir dos migraciones seguidas (arriba).
5. `origin/dev` avanzó 1 commit desde `f0833d64`; no se rebasó.
6. Pregunta abierta 1 del requirements (texto del toast con varios conflictos): sigue abierta, es UI.

**Veredicto:** bloque B completo salvo B.10 (gate, por orden del leader); tsc y lint verdes, related y
la integración de zonas/geografía/cobertura verdes contra Postgres.
