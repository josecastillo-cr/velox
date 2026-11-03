# 496 — Recolección recibida en central libera al mensajero · design

> Requisitos: `requirements.md` (R1–R17). Fuente: H1 de `progress/prompt-hotfix-portable.md` e
> inventario `progress/inventario_hotfix_H1_H4.md`. Todas las rutas y líneas de abajo se confirmaron
> en el archivo real el 2026-11-02 (rama `dev`); el implementer las vuelve a confirmar al arrancar,
> porque `dev` se mueve.

## 0. Qué hay hoy (medido en el código, no supuesto)

| Pieza | Dónde | Estado actual |
|---|---|---|
| Asignar la recolección | `lib/repositories/OrdenRepository.ts` `asignarRecoleccionLote` | `por_recolectar_en_tienda → recolectando`, `data: { mensajeroAsignadoId, estatusId }`. **No** estampa `asignadoAt` (157/R38: es denominador del ranking). Historial `asignacion_recoleccion`. |
| Recolectar | `OrdenRepository.recolectarEnTienda` (`:4416-4455`) | `recolectando → en_ruta_bodega_central`, mensajero en el `WHERE`, `data: { estatusId }`. Historial `recoleccion_tienda`, actor = el mensajero. |
| Recepción central (service) | `lib/services/RecepcionBodegaCentralService.ts:17-26` (tabla `TRANSICIONES`), llamada al repo en `:84` | Dos aristas: `en_ruta_bodega_central → en_bodega_central` y `devolviendo_a_bodega_central → por_devolver_a_tienda`, ambas `origenTipo: recepcion_bodega_central`. |
| Recepción central (repo) | `OrdenRepository.recibirEnBodegaCentral` (`:4363-4402`); contrato en `lib/interfaces/repositories/IOrdenRepository.ts:2066-2071` | `updateMany` guardado por `id + deletedAt: null + estatus.value = origenValue`, **`data: { estatusId }`**. Historial solo con `count === 1`. JSDoc: «NO toca `mensajeroAsignadoId` ni `numGuia` (R18)». |
| Reasignables | `OrdenRepository.list` (`:1956-2071`), rama `params.where.reasignables` (`:2000-2005`) | `mensajeroAsignadoId: null` **y** `estatus.value = en_bodega_central`. |
| Monitoreo | `lib/repositories/TableroDiaRepository.ts` `contarPorMensajero` (`:339-376`), CTE `ids_recoleccion` (`:224-243`) | La orden entra por la `asignacion_recoleccion` del día; `asignadas` exige `mensajero_asignado_id IS NOT NULL` (`:352`) y agrupa por el mensajero actual. `en_ruta_bodega_central`/`en_bodega_central` caen en «otros». |
| «Recolectadas hoy» | `RecoleccionTiendaService` (`:197-234`) → `OrdenHistorialRepository.findRecoleccionesDeActor` (`:482-507`, ids por historial) → `GestionOrdenRepository.findMisAsignacionesByIds` (`:525-539`) | La segunda lectura filtra `mensajeroAsignadoId: mensajeroId`; lo que no devuelve se cae de la lista (`:229-232`). Único llamador de producción: este service (los demás aciertos de `grep` son dobles de test). |
| Satélite | `OrdenRepository.rutearBodegaSateliteLote` | Ya limpia el trío (`mensajeroAsignadoId: null, asignadoAt: null, fechaReparto: null`). Sin defecto: fuera de alcance. |
| Columnas | `db/schema.prisma` modelo `Orden` `:730-740` | `mensajeroAsignadoId` (`mensajero_asignado_id`), `asignadoAt` (`asignado_at`), `fechaReparto` (`fecha_reparto`, `@db.Date`). Relación `historialEstados` (`:828`). |

Conclusión: **el arreglo de Monitoreo no necesita código propio**. En cuanto la recepción deja
`mensajero_asignado_id` en NULL, el `WHERE … IS NOT NULL` de `asignadas` la saca de todas las filas.
Solo lleva test (R8, R9).

## 1. Revocación de la R18 de la 138 (decisión del humano, 2026-11-02)

La R18 de `specs/138-recepcion-bodega-central/requirements.md` («conservar `num_guia` y
`mensajero_asignado_id` durante la recepción») queda **revocada para la arista
`en_ruta_bodega_central → en_bodega_central`** en lo referido a `mensajero_asignado_id` (y, por
extensión, a `asignado_at` y `fecha_reparto`, que se escriben y limpian juntos). Sigue vigente:

- para la devolución (`devolviendo_a_bodega_central → por_devolver_a_tienda`): conserva el trío;
- para `num_guia`, en las dos aristas.

Superficies que la fijaban y que esta ficha cambia: el JSDoc de `OrdenRepository.recibirEnBodegaCentral`
y de `IOrdenRepository.recibirEnBodegaCentral`, el comentario de la tabla del service, y el test
unitario `tests/unit/repositories/orden-repository.recepcion-bodega-central.test.ts:65-67`. Se añade
además una línea bajo la R18 de la spec 138 que remite a esta ficha (es documentación, no código).

Superficie que la fija y **no** cambia: `tests/integration/db/devolucion-rechazadas-flow.test.ts:517-530`
(rama satélite: la recepción central es de devolución → conserva el mensajero, R2). Debe seguir verde
sin tocarla.

## 2. Repositorio: `recibirEnBodegaCentral` con parámetro obligatorio

Contrato nuevo (interfaz e implementación):

```ts
recibirEnBodegaCentral(
  ordenId: string,
  origenValue: string,
  destinoEstatusId: string,
  liberaAsignacion: boolean, // obligatorio, sin valor por defecto
  historial: HistorialContexto,
): Promise<boolean>;
```

- **Posición:** cuarto argumento, antes de `historial`. Así cualquier llamador viejo
  (`(id, origen, destino, historial)`) deja de compilar, porque un objeto no es `boolean`: el
  typecheck enumera todos los llamadores. Hoy solo hay uno (`RecepcionBodegaCentralService.ts:84`).
- **`data` del `updateMany`:**
  - `liberaAsignacion: true` → `{ estatusId: destinoEstatusId, mensajeroAsignadoId: null, asignadoAt: null, fechaReparto: null }`;
  - `liberaAsignacion: false` → `{ estatusId: destinoEstatusId }` (igual que hoy).
- **Mismo `UPDATE` atómico:** el trío se limpia en la misma sentencia que cambia el estado y bajo
  la misma guarda (`id + deletedAt: null + estatus.value = origenValue`). Si la guarda no casa
  (`count = 0`: ya recibida, estado no origen, borrada, carrera perdida), no se toca nada (R3).
- **Historial:** sin cambios. Una sola fila `recepcion_bodega_central` y solo si `count === 1`
  (R4). No se escribe ninguna fila de «desasignación». `numGuia` no entra en `data` (R4).
- La pre-lectura del origen (`findFirst`) no cambia.

## 3. Service: la tabla de transiciones decide

`lib/services/RecepcionBodegaCentralService.ts`, tabla `TRANSICIONES`:

```ts
en_ruta_bodega_central:       { destino: "en_bodega_central",     origenTipo: "recepcion_bodega_central", liberaAsignacion: true  },
devolviendo_a_bodega_central: { destino: "por_devolver_a_tienda", origenTipo: "recepcion_bodega_central", liberaAsignacion: false },
```

El tipo del valor de la tabla lleva `liberaAsignacion: boolean` obligatorio, y el service lo pasa
tal cual al repo. Nada más cambia en el service: rol, idempotencia (`ESTADOS_RECIBIDA`), guardia de
estado y relectura tras carrera siguen igual. El resultado del service (`ok`/`ya_recibida`/…) no
cambia: la UI y la action no se tocan.

**Consecuencia asumida (P1 de requirements).** La regla va por arista: también la orden que llegó a
`en_ruta_bodega_central` por la reversión de un incidente (#56) sale sin mensajero.

## 4. «Recolectadas hoy»: `findMisAsignacionesByIds` con OR

`lib/repositories/GestionOrdenRepository.ts`, `findMisAsignacionesByIds(mensajeroId, ids)`. Firma
igual; el `WHERE` pasa a:

```ts
where: {
  id: { in: ids },
  deletedAt: null,
  OR: [
    { mensajeroAsignadoId: mensajeroId },
    {
      mensajeroAsignadoId: null,
      historialEstados: {
        some: { origenTipo: "recoleccion_tienda", actorUsuarioId: mensajeroId },
      },
    },
  ],
}
```

- La rama 1 conserva el comportamiento actual (R10, asignada a mí; R11, asignada a otro → fuera).
- La rama 2 es la nueva: sin mensajero **y** con una `recoleccion_tienda` mía en el historial (R10).
  La exigencia del historial (R12) es la guarda de propiedad: un id que llega de fuera no autoriza a
  leer una orden sin dueño. Sin esa condición, cualquier id sin mensajero sería legible.
- `deletedAt: null` sigue fuera del OR (R13).
- El literal `recoleccion_tienda` va tipado (`satisfies OrdenHistorialOrigenTipo`, de
  `lib/types/orden-historial.ts`), como la constante privada `ORIGEN_TIPO_RECOLECCION_TIENDA` de
  `OrdenHistorialRepository.ts:62`; un error de escritura debe romper el typecheck.
- No se filtra por la ventana del día en esta lectura: la ventana ya la impone
  `findRecoleccionesDeActor`, que es quien decide los ids. Esta lectura solo resuelve datos y
  propiedad.
- Se actualiza el JSDoc del método (hoy dice que la guardia es «propiedad (`mensajero_asignado_id`)»).
  La interfaz `IGestionOrdenRepository` no cambia de firma; se actualiza su comentario si lo cita.
- El service (`RecoleccionTiendaService`) no cambia.

Índices: `orden_historial_estado` ya tiene índices por actor y origen (schema `:2722`, comentario de
la 167). La rama 2 se evalúa sobre a lo sumo `TOPE_RECOLECTADAS_HOY` ids: no se crea índice.

## 5. Reasignables y Monitoreo

Sin cambios de código. Los dos dependen de `mensajero_asignado_id IS NULL / IS NOT NULL`, que la
recepción ya deja bien (§2). Solo se añaden tests de integración (R6–R9).

## 6. Migración de datos

Carpeta: `db/migrations/20261102150000_recoleccion_central_libera_496/` con `migration.sql` y
`down.sql`. Fecha posterior a la última del repo (`20261023120100_iva_por_pagar_488_checks`). **Otras
fichas de hotfix (497–500) se especifican el mismo día:** el implementer comprueba contra
`origin/dev` que el prefijo no colisiona y que la suya sigue siendo posterior a la última antes de
commitear; si colisiona, cambia la hora, no el orden lógico (ninguna depende de otra).

Solo datos: no hay cambio de esquema ni de `db/schema.prisma`, ni RLS (no hay tabla nueva).

Medición previa en producción: **hecha por el humano en solo lectura** (2026-11-02); la migración
sale vacía hoy. Se escribe igual por si aparecen filas entre la medición y la release. Ningún número
de producción va al repo.

### 6.1 `migration.sql` (up)

```sql
-- 496 (R14/R15/R17): libera el trío de asignación de las recolecciones ya recibidas en central.
-- No escribe historial. Desempate de "última fila": created_at DESC, id DESC.
WITH candidatas AS (
  SELECT o.id
  FROM orden o
  JOIN order_status s ON s.id = o.estatus_id AND s.value = 'en_bodega_central'
  WHERE o.deleted_at IS NULL
    AND o.mensajero_asignado_id IS NOT NULL
),
ult AS (
  SELECT DISTINCT ON (h.orden_id) h.orden_id, h.origen_tipo, h.estatus_origen_id
  FROM orden_historial_estado h
  WHERE h.orden_id IN (SELECT id FROM candidatas)
  ORDER BY h.orden_id, h.created_at DESC, h.id DESC
)
UPDATE orden o
SET mensajero_asignado_id = NULL,
    asignado_at           = NULL,
    fecha_reparto         = NULL
FROM ult u
JOIN order_status so ON so.id = u.estatus_origen_id
WHERE u.orden_id = o.id
  AND u.origen_tipo = 'recepcion_bodega_central'
  AND so.value = 'en_ruta_bodega_central';
```

- `candidatas` acota el `DISTINCT ON` a las órdenes en central con mensajero (no recorre todo el
  historial).
- Si la última fila es posterior a la recepción (p. ej. una asignación del maestro), `ult` no es la
  recepción y la orden no se toca (R15): esa asignación es una decisión posterior.
- No toca `updated_at` ni ninguna otra columna: el rastro del cambio es exactamente el trío.
- Idempotente: tras aplicarse, las objetivo ya no tienen mensajero y salen de `candidatas` (R17).
- El `origen_tipo` es enum `orden_historial_origen_tipo`; la comparación con el literal funciona
  sin cast explícito (Postgres resuelve el literal al tipo del enum). Si el implementer prefiere el
  cast explícito, `'recepcion_bodega_central'::"orden_historial_origen_tipo"`.

### 6.2 `down.sql`

```sql
-- 496 (R16): repone el mensajero desde el actor de la última recoleccion_tienda.
-- No repone asignado_at ni fecha_reparto: la recolección no los estampa (157/R38).
WITH candidatas AS (
  SELECT o.id
  FROM orden o
  JOIN order_status s ON s.id = o.estatus_id AND s.value = 'en_bodega_central'
  WHERE o.deleted_at IS NULL
    AND o.mensajero_asignado_id IS NULL
),
ult AS (
  SELECT DISTINCT ON (h.orden_id) h.orden_id, h.origen_tipo, h.estatus_origen_id
  FROM orden_historial_estado h
  WHERE h.orden_id IN (SELECT id FROM candidatas)
  ORDER BY h.orden_id, h.created_at DESC, h.id DESC
),
rec AS (
  SELECT DISTINCT ON (h.orden_id) h.orden_id, h.actor_usuario_id
  FROM orden_historial_estado h
  WHERE h.orden_id IN (SELECT id FROM candidatas)
    AND h.origen_tipo = 'recoleccion_tienda'
  ORDER BY h.orden_id, h.created_at DESC, h.id DESC
)
UPDATE orden o
SET mensajero_asignado_id = r.actor_usuario_id
FROM ult u
JOIN order_status so ON so.id = u.estatus_origen_id
JOIN rec r ON r.orden_id = u.orden_id
WHERE u.orden_id = o.id
  AND u.origen_tipo = 'recepcion_bodega_central'
  AND so.value = 'en_ruta_bodega_central'
  AND r.actor_usuario_id IS NOT NULL;
```

- **Más estricto que la letra del documento de origen** («cada orden que siga en ese estado y sin
  mensajero»): exige además que la última fila siga siendo la recepción desde
  `en_ruta_bodega_central`, simétrico al up. Así el down no reasigna una orden que el maestro
  desasignó o movió después por otra vía. Es un estrechamiento del down, no cambia ninguna regla de
  negocio.
- Propiedad conocida y aceptada: el down también repone el mensajero de las órdenes que la
  **recepción nueva** liberó después del deploy (cumplen el mismo criterio). Es coherente con
  revertir la ficha entera (código + datos).
- Sin `recoleccion_tienda` (p. ej. llegó por #56 sin recolección) → `JOIN rec` no casa → sigue sin
  mensajero (R16).
- Antes de la release: `prisma migrate deploy` → `down.sql` → `migrate deploy` contra la base local,
  sin errores (up/down/up del checklist global).

### 6.3 Verificación en producción tras el deploy (solo lectura, la corre o autoriza el humano)

La consulta global H1 de `progress/prompt-hotfix-portable.md` («Checklist de verificación global»)
vale tal cual en este esquema (`orden`, `order_status`, `orden_historial_estado`, `estatus_id`,
`estatus_origen_id`, `origen_tipo` existen con esos nombres). Debe devolver 0. No se anota el número
en el repo; solo «verificado 0, fecha».

## 7. Tests (dónde vive cada criterio)

Regla de esta ficha: **los criterios que viven en SQL se prueban contra Postgres real**
(`tests/integration/db/_postgres-real.ts`: `HAY_BASE_DE_DATOS`, `crearPrismaDeTest`,
`enTransaccionRevertida`). Los unitarios con dobles solo fijan la **forma** de la llamada y no
cuentan como prueba de R1/R3/R10–R12 (no ven el `WHERE`).

| Archivo | Nuevo/cambia | Cubre |
|---|---|---|
| `tests/integration/db/recepcion-central-libera-496.test.ts` | nuevo | R1–R7, R10–R13. Recorre el flujo por el **service real** (`RecepcionBodegaCentralService` + `OrdenRepository` sobre Postgres) para que la tabla de transiciones también quede cubierta; Reasignables por `OrdenRepository.list({ where: { reasignables: true } … })`; «Recolectadas hoy» por `GestionOrdenRepository.findMisAsignacionesByIds`. |
| `tests/integration/tablero-dia-recoleccion-496.test.ts` | nuevo | R8, R9, con `_semilla-tablero-dia` (`sembrarBase`, `crearOrden`, `transicionDeRecoleccion`) y la identidad de ocho sumandos (`sumaDeLosOcho`) en cada caso. Archivo aparte para no editar el de la 192/259. |
| `tests/integration/db/recoleccion-central-libera-496-migration.test.ts` | nuevo | R14–R17. Lee `migration.sql`/`down.sql` del disco (normalizando CRLF, patrón `iva-488-migration.test.ts`) y los ejecuta dentro de `enTransaccionRevertida` sobre filas sembradas. |
| `tests/unit/repositories/orden-repository.recepcion-bodega-central.test.ts` | cambia | Reescribe la aserción R18 de la rama 138: con `liberaAsignacion: true`, `data` es literalmente `{ estatusId, mensajeroAsignadoId: null, asignadoAt: null, fechaReparto: null }`; con `false` (139), `{ estatusId }`. `numGuia` ausente en las dos. Los demás casos solo añaden el argumento. |
| `tests/unit/services/recepcion-bodega-central-service.test.ts` | cambia | Los `toHaveBeenCalledWith` de `:92-97` y `:112-117` pasan a llevar `true` y `false` en cuarta posición. |

Siembra: una orden **sin** FKs sembradas no puede «pasar en verde»: si la siembra no encuentra sus
dependencias, el test **falla** (`expect(...).not.toBeNull()`), nunca `return` temprano.

Conteos de R5: `count(*)` de `gestion_orden`, `wallet_movimiento`, `wallet_tienda_movimiento`,
`pago_mensajero_movimiento` y `cierre_dia` antes y después de la recepción, dentro de la misma
transacción revertida, comparados como literales (`toBe(antes)`).

### 7.1 Contraprueba por mutación (obligatoria, una por test de regresión)

| Mutación | Debe poner rojo |
|---|---|
| Quitar `mensajeroAsignadoId: null` del `data` cuando libera | R1, R6, R8, R10 (rama sin mensajero) |
| Quitar `asignadoAt: null` / `fechaReparto: null` del `data` (una cada vez) | R1 |
| `liberaAsignacion: true` en la fila de la devolución | R2 |
| Liberar fuera de la guarda (p. ej. un `update` previo sin `estatus.value = origenValue`) | R3 |
| Escribir una segunda fila de historial al liberar | R4 |
| Quitar `mensajeroAsignadoId: null` de la rama de Reasignables | R7 |
| Quitar la condición `historialEstados.some(...)` de la rama 2 del OR | R12 |
| Cambiar `actorUsuarioId: mensajeroId` por cualquier actor en la rama 2 | R12 |
| Mover `deletedAt: null` dentro de una sola rama del OR | R13 |
| Quitar `AND so.value = 'en_ruta_bodega_central'` del up | R15 (hermana devolución) |
| Cambiar `DISTINCT ON … created_at DESC, id DESC` por el primer registro (`ASC`) | R15 (hermana con fila posterior) |
| Quitar `o.deleted_at IS NULL` del up | R15 (hermana borrada) |
| Añadir `asignado_at = now()` en el down | R16 |

Cada mutación: verde con el arreglo → mutar → rojo → restaurar → `git diff` de la mutación vacío. Se
anota en `progress/impl_496.md` (archivo, mutación, test que se puso rojo). Las mutaciones no corren
en paralelo con el gate.

## 8. Alternativas descartadas

1. **Liberar al recolectar (`recolectando → en_ruta_bodega_central`) en vez de al recibir.**
   Descartada: mientras va en ruta el paquete está físicamente con el mensajero; quitarle la
   asignación borra quién responde por él y lo sacaría de Monitoreo antes de tiempo (R9 lo exige
   contado). La liberación tiene sentido cuando la central tiene el paquete.
2. **Ampliar el filtro «Reasignables» para incluir órdenes en central con mensajero cuya última fila
   sea la recepción.** Descartada: arregla una pantalla y deja las otras dos mintiendo (Monitoreo y
   la propia ficha de la orden), y `mensajero_asignado_id` es la única fuente de verdad del
   mensajero (feature 159). El arreglo va en el dato, no en cada lector.
3. **Parámetro opcional `liberaAsignacion = false`.** Descartada (y vedada por el documento): un
   llamador nuevo que lo olvide reproduce el bug en silencio. Obligatorio y en una posición que
   rompe la compilación de los llamadores viejos.
4. **Escribir una fila de historial de «desasignación» al recibir.** Descartada: el documento lo
   veda (una sola fila de recepción) y duplicaría el evento; además alteraría el «última fila» que
   usan la migración y la verificación.
5. **Método nuevo `findRecolectadasByIds` en vez de cambiar `findMisAsignacionesByIds`.**
   Descartada: el método actual tiene un único llamador de producción (este service) y fue creado
   para esta lista (2026-08-11); duplicarlo dejaría uno muerto o forzaría a tocar ~15 dobles de test
   que implementan la interfaz. Se cambia el `WHERE` y su JSDoc.
6. **No migrar (la medición sale vacía hoy).** Descartada por decisión del humano y del documento:
   no se deja como deuda; la migración vacía cuesta nada y cubre las filas que aparezcan hasta la
   release.

## 9. Fuera de alcance

Bodega satélite (ya limpia), gestiones, pagos al mensajero, wallet, cierres, ranking, UI, action y
API pública (el resultado del service no cambia). Multiempresa (no existe aquí).
