# Inventario H1 y H4 (`progress/prompt-hotfix-portable.md`): ¿existe aquí el bug?

Fecha: 2026-11-02. Rama `dev` (HEAD fed2d010). Solo lectura: no se corrió nada contra ninguna base.
Las rutas del documento de origen se usaron como pistas; todo lo de abajo está confirmado en el archivo real.

Última migración (local y `origin/dev`): **`20261023120100_iva_por_pagar_488_checks`** (2026-10-23 12:01).
Las nuevas deben ir después, p. ej. `20261102…`.

---

## H1 — Una recolección recibida en la bodega central sigue a nombre del mensajero

### Veredicto: EXISTE tal cual, pero el código actual lo hace POR CONTRATO (spec 138, R18)

### 1. El mecanismo existe

| Pieza | Aquí |
|---|---|
| Tabla de transiciones de la recepción central | `lib/services/RecepcionBodegaCentralService.ts:21-25`: `en_ruta_bodega_central → en_bodega_central` y `devolviendo_a_bodega_central → por_devolver_a_tienda`, las dos con `origenTipo: "recepcion_bodega_central"`. Llamada al repositorio en `:84`. |
| UPDATE de la recepción | `lib/repositories/OrdenRepository.ts:4363-4402` `recibirEnBodegaCentral`. El `updateMany` de `:4380-4387` hace **`data: { estatusId: destinoEstatusId }`** guardado por `estatus.value = origenValue` y `deletedAt: null`. **No toca `mensajeroAsignadoId`, `asignadoAt` ni `fechaReparto`.** El historial solo se escribe con `count === 1` (`:4389`). |
| El patrón es deliberado | El JSDoc `:4361` dice «NO toca `mensajeroAsignadoId` ni `numGuia` (R18)», y `specs/138-recepcion-bodega-central/requirements.md:96-97` dice: «R18 … DEBE conservar sin cambios `num_guia` y `mensajero_asignado_id` … (la recepción solo cambia el estado)». El test unitario `tests/unit/repositories/orden-repository.recepcion-bodega-central.test.ts:65-67` lo fija (`expect(arg.data).not.toHaveProperty("mensajeroAsignadoId")`). |
| Filtro «Reasignables» | `lib/repositories/OrdenRepository.ts:2000-2005`: `mensajeroAsignadoId: null` **y** `estatus.value = en_bodega_central`. El contrato está en `lib/interfaces/repositories/IOrdenRepository.ts:302-312`. Por eso la recolección recibida no sale en el filtro. |
| Conteo de Monitoreo por mensajero | `lib/repositories/TableroDiaRepository.ts:339-376` `contarPorMensajero`. El CTE `ids_recoleccion` (`:224-243`) mete las órdenes con historial `asignacion_recoleccion` del día. `asignadas` (`:345-355`) exige `mensajero_asignado_id IS NOT NULL` (`:352`) y agrupa por el mensajero actual. `en_ruta_bodega_central` y `en_bodega_central` no tienen cubo en `BUCKET_POR_ESTATUS` (`lib/types/tablero-dia.ts:70-`), así que caen en **«otros»** (`:306-307`). |
| «Recolectadas hoy» | La fuente es el historial: `lib/repositories/OrdenHistorialRepository.ts:482-507` `findRecoleccionesDeActor` (actor = yo, `origen_tipo = recoleccion_tienda`, ventana del día CR). Los datos de la tarjeta se leen después con `lib/repositories/GestionOrdenRepository.ts:525-538` `findMisAsignacionesByIds`, que filtra **`mensajeroAsignadoId: mensajeroId`** (`:533`). El servicio descarta lo que esa lectura no devuelve (`lib/services/RecoleccionTiendaService.ts:216-231`). Es el único llamador. |
| El ruteo a satélite ya limpia | `lib/repositories/OrdenRepository.ts:3931-3973` `rutearBodegaSateliteLote`, `:3957`: `data: { estatusId, mensajeroAsignadoId: null, asignadoAt: null, fechaReparto: null }`. Confirmado: la satélite no tiene el defecto. |

### 2. El bug, con su condición concreta

- Asignar una recolección: `OrdenRepository.ts:3822-3865` `asignarRecoleccionLote`, `por_recolectar_en_tienda → recolectando`, `:3846` `data: { mensajeroAsignadoId: mensajeroId, estatusId }`, historial `asignacion_recoleccion`.
- Recolectar: `OrdenRepository.ts:4416-4455` `recolectarEnTienda`, `recolectando → en_ruta_bodega_central`. El mensajero entra en el `WHERE` (`:4438`) y `data: { estatusId }` (`:4440`). El historial es `recoleccion_tienda` con `actor_usuario_id` = el mensajero.
- Recibir en la central: `:4386`, que solo cambia el estado. La orden queda en `en_bodega_central` con `mensajero_asignado_id` todavía puesto. **Es el mismo bug.**
- **¿Se estampan `asignado_at` / `fecha_reparto`?** No, ni al asignar la recolección ni al recolectar. El JSDoc `:3811-3814` (R38 de la 157) dice que `asignadoAt` no se estampa adrede porque es el denominador del ranking. El `down.sql` puede reponer solo el mensajero, igual que en el origen.
- El trío se llama igual que en el origen: `mensajero_asignado_id`, `asignado_at`, `fecha_reparto` (`db/schema.prisma`, modelo `Orden`, líneas 730-740 aprox.).
- `origen_tipo` del historial (enum `orden_historial_origen_tipo`): `recepcion_bodega_central`, `recoleccion_tienda` y, además, `asignacion_recoleccion` (`db/schema.prisma:2631-2686`).
- Matiz en Monitoreo: aquí la orden solo entra en el tablero por `ids_recoleccion` (el día de la `asignacion_recoleccion`, con `fecha_reparto` NULL), porque `asignado_at` y `fecha_reparto` son NULL. En la práctica, el conteo indebido se ve **el mismo día**, en «otros».

### 3. Diferencias con lo que asume el documento

- Aquí hay un estado intermedio, **`recolectando`**, y una arista de asignación `asignacion_recoleccion` hecha por maestro o admin. El origen de la recolección es `recolectando`, no `por_recolectar_en_tienda`. No cambia el arreglo.
- **El defecto es contractual:** liberar la asignación revoca la R18 de la spec 138 en la rama `en_ruta_bodega_central` y obliga a reescribir la aserción del test unitario citado.
- No hay multiempresa (ver H4): las lecturas nuevas no llevan filtro por empresa.
- No hay ningún test de integración contra Postgres de `recibirEnBodegaCentral`; solo el unitario con dobles. `tests/integration/db/devolucion-rechazadas-flow.test.ts:525` fija que la devolución conserva el mensajero.

### 4. SQL de medición y verificación (adaptado, NO ejecutado)

Medición previa, agrupada por mensajero y sin nombres:

```sql
WITH ult AS (
  SELECT DISTINCT ON (h.orden_id) h.orden_id, h.origen_tipo::text AS origen_tipo, so.value AS origen
  FROM orden_historial_estado h
  LEFT JOIN order_status so ON so.id = h.estatus_origen_id
  ORDER BY h.orden_id, h.created_at DESC, h.id DESC
)
SELECT o.mensajero_asignado_id, count(*) AS ordenes
FROM orden o
JOIN order_status s ON s.id = o.estatus_id AND s.value = 'en_bodega_central'
JOIN ult u ON u.orden_id = o.id
WHERE o.deleted_at IS NULL
  AND o.mensajero_asignado_id IS NOT NULL
  AND u.origen_tipo = 'recepcion_bodega_central'
  AND u.origen = 'en_ruta_bodega_central'
GROUP BY o.mensajero_asignado_id
ORDER BY ordenes DESC;
```

Comprobación auxiliar del `down.sql` (el actor de la última `recoleccion_tienda` coincide con el mensajero actual):

```sql
WITH ult AS ( /* el mismo CTE */ ),
rec AS (
  SELECT DISTINCT ON (h.orden_id) h.orden_id, h.actor_usuario_id
  FROM orden_historial_estado h
  WHERE h.origen_tipo = 'recoleccion_tienda'
  ORDER BY h.orden_id, h.created_at DESC, h.id DESC
)
SELECT (r.actor_usuario_id = o.mensajero_asignado_id) AS coincide, count(*)
FROM orden o
JOIN order_status s ON s.id = o.estatus_id AND s.value = 'en_bodega_central'
JOIN ult u ON u.orden_id = o.id
LEFT JOIN rec r ON r.orden_id = o.id
WHERE o.deleted_at IS NULL AND o.mensajero_asignado_id IS NOT NULL
  AND u.origen_tipo = 'recepcion_bodega_central' AND u.origen = 'en_ruta_bodega_central'
GROUP BY 1;
```

Verificación posterior al despliegue (la del checklist global). Funciona tal cual aquí: las tablas `orden`, `order_status` y `orden_historial_estado` y las columnas `estatus_id`, `estatus_origen_id` y `origen_tipo` existen con esos nombres. Debe dar 0.

---

## H4 — Un distrito no puede quedar en dos zonas

### Veredicto: EXISTE, pero DISTINTO en el modelo: aquí no hay multiempresa

### 1. El mecanismo existe

| Pieza | Aquí |
|---|---|
| N:M y sus únicos | `db/schema.prisma:683-695` `ZonaDistrito` (`zona_distrito`): **solo** `@@unique([zonaId, distritoId])` más índices simples en `zona_id` y `distrito_id`. Lo crea `db/migrations/20260711210000_zona_distrito_nm/migration.sql:17` (`zona_distrito_zona_id_distrito_id_key`). Ninguna migración posterior añade un único por distrito. |
| `organizacion_id` | **No existe**, ni en la N:M ni en ninguna otra parte del esquema: 0 apariciones de `organizacion`, `empresa_id` o `tenant` en `db/schema.prisma`. `zona.nombre` es único global (`schema.prisma`, modelo `Zona`). |
| RLS | `zona_distrito` tiene `ENABLE ROW LEVEL SECURITY` **sin políticas**: acceso solo por service role (`20260711210000_zona_distrito_nm/migration.sql:31-34`). No hay RLS por empresa. |
| Marca de zona central | `zona.es_central` (`esCentral`), a lo sumo una gracias al índice único parcial `zona_es_central_unico` (`ZonaRepository.ts:353-355`). |
| Service | `lib/services/ZonaService.ts:59-104` `prepararDatos`: deduplica (`:76`) y comprueba que los distritos existan (`:77-80`). **No comprueba si ya tienen otra zona.** |
| Repositorio: crear | `lib/repositories/ZonaRepository.ts:213-271`: quita la marca de central (`:228-230`), crea la zona y hace `zonaDistrito.createMany` (`:245-249`) **sin validar**. No reconcilia órdenes. |
| Repositorio: actualizar | `ZonaRepository.ts:346-…`: comprueba que la zona existe (`:356-360`), `deleteMany` más `createMany` sobre la N:M (`:422-427`) **sin validar** y reconcilia `orden.zona_id` (366/377, `:442-540`). Los cortes de elegibilidad están en `whereBaseElegible` (`:187-200`): borrada, con `cierreDetalles`, o con gestión vigente `entregado`, `devolucion_a_origen_por_rechazo` o `incidente`; además, `en_bodega_satelite` queda retenida. Hoy **sí** reconcilia al guardar sin cambios. |
| Colapso | `lib/repositories/_shared/zona-colapso.ts` `zonaUnicaDeDistrito`: 1 zona devuelve esa zona; 0 o más de 1 devuelven `null`. Lo usan `GeoRepository.ts:232`, `OrdenRepository.ts:2676` y `:2840`, `ZonaRepository.ts:470` y `lib/utils/cobertura-distrito.ts:26,34` (estado `varias_zonas`). Con `null` sale «no tiene zona asignada» (`lib/services/geo-resolucion.ts:189`). |
| Árbol | `lib/repositories/GeoRepository.ts:192-240` `listArbol`: trae todas las zonas (`:212`) pero colapsa a `zonaId`/`zonaNombre` (`:232-237`). **No expone la lista.** `lib/repositories/CoberturaRepository.ts:39,49` ya devuelve la lista completa por distrito (otra pantalla). |
| Preselección de «Editar» | `app/(app)/configuracion/tarifas/_components/ZonasTarifasModule.tsx:106-110`: `if (d.zonaId === full.id)`. Es el bug del origen: un distrito con dos zonas sale desmarcado en las dos. |
| Refetch tras guardar | `ZonasTarifasModule.tsx:142-145` `onSaved` hace `void refetch()` (no lo espera). `abrirEditar` (`:87-140`) y `abrirCrear` (`:80-85`) usan el estado `provincias` de ese momento, **sin volver a leer el árbol**. |
| Selector | `app/(app)/configuracion/tarifas/_components/GeografiaSelector.tsx:261-272`: el `Checkbox` del distrito **no tiene `disabled`**; solo pinta `(zona: X)`. El estado del grupo (`:85-91`) se calcula sobre todos los distritos. |

### 2. El bug, con su condición concreta

Nada impide `(zona_A, d)` y `(zona_B, d)` a la vez. El único es `(zona_id, distrito_id)`, y ni `prepararDatos` ni `create` ni `update` leen las filas de `distrito_id IN elegidos` con otra zona. Después, la preselección `d.zonaId === full.id` sobre un árbol colapsado desmarca el distrito, y el siguiente guardado lo borra con el `deleteMany`. **Mismo bug que en el origen.**

Dato previo, no de este inventario: la `status_note` de la ficha 366 (`feature_list.json`, 2026-09-03) anota «>1 es legal en el esquema (hoy 0 casos)» medido en producción. Hay que volver a medir.

Tests que hoy siembran un distrito en dos zonas contra Postgres. Con el índice nuevo, la siembra fallaría y hay que reescribirlos:
- `tests/integration/db/zona-reconciliacion-ordenes.test.ts:394-402` (R3 de la 366, «ambiguo, no mueve»);
- `tests/integration/db/cobertura-repository.test.ts:129,189-190` («Dos Zonas»);
- `tests/integration/db/geografia-catalogo-activo.test.ts:60,145,344`;
- `tests/integration/db/corregir-datos-cliente.repo.test.ts:426,476,765,798`.

Los unitarios con dobles (`tests/unit/repositories/zona-repository.test.ts:609,809` y `tests/unit/repositories/orden-repository.bulk.test.ts:170`) no los rompe el índice, pero modelan un estado que deja de ser posible.

### 3. Diferencias con lo que asume el documento (requieren decisión)

- **No hay multiempresa.** El índice sería `UNIQUE (distrito_id)` a secas. La ventana es `PARTITION BY distrito_id`. Las reglas y tests de «otra empresa / no se nombra su zona» y de «RLS por empresa» no aplican. La «red final» detectaría el nombre del índice nuevo, no `(organizacion_id, distrito_id)`.
- **No existe el esquema `respaldo`.** Ninguna migración lo crea y Prisma no usa `multiSchema`. Habría que crearlo en esta migración. Además, «sin acceso para el rol de la app» supone un rol de app distinto del dueño. Aquí la app y las migraciones van por Prisma y la N:M solo se lee por service role, así que el `REVOKE` podría no aislar nada. Ver la pregunta 6.
- `create` **no** reconcilia órdenes; solo `update`. El paso 4 posterior al despliegue («abrir y guardar sin cambios») funciona aquí porque usa `update`.
- Las respuestas del service aquí son `{ status: "validation_error", fieldErrors }` (`ZonaService.ts:114,158`). El repositorio devuelve uniones con `estado` (`"not_found"`, `"sin_zona_central"`, `ZonaRepository.ts:360,367`), así que `"distrito_en_otra_zona"` encaja con el patrón existente.

### 4. SQL de medición y verificación (adaptado, sin `organizacion_id`, NO ejecutado)

Medición previa (solo conteos):

```sql
SELECT zd.distrito_id, count(*) AS n,
       count(*) FILTER (WHERE z.es_central) AS centrales
FROM zona_distrito zd JOIN zona z ON z.id = zd.zona_id
GROUP BY zd.distrito_id
HAVING count(*) > 1;
```

Resumen por regla:

```sql
WITH g AS (
  SELECT zd.distrito_id, count(*) AS n, count(*) FILTER (WHERE z.es_central) AS centrales
  FROM zona_distrito zd JOIN zona z ON z.id = zd.zona_id
  GROUP BY zd.distrito_id HAVING count(*) > 1)
SELECT CASE WHEN n = 2 AND centrales = 1 THEN 'a' ELSE 'b' END AS regla,
       count(*) AS distritos, sum(n) AS filas
FROM g GROUP BY 1;
```

Índice después del despliegue:

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'zona_distrito' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(distrito_id)%';
```

Órdenes desalineadas:

```sql
SELECT o.id, o.zona_id AS zona_orden, zd.zona_id AS zona_distrito, s.value AS estado
FROM orden o
JOIN zona_distrito zd ON zd.distrito_id = o.distrito_id
JOIN order_status s ON s.id = o.estatus_id
WHERE o.deleted_at IS NULL AND o.zona_id IS DISTINCT FROM zd.zona_id;
```

Distritos sin zona con órdenes: la consulta del documento (punto 5) vale tal cual, porque no usa `organizacion_id`.

---

## Preguntas para el humano

1. **H1, R18 de la 138.** La spec 138 exige conservar `mensajero_asignado_id` en la recepción central. ¿Confirmas que el hotfix la revoca para `en_ruta_bodega_central → en_bodega_central` (la devolución la sigue conservando)?
2. **H1, Monitoreo.** Aquí la recolección solo cuenta en el tablero el día de la `asignacion_recoleccion`, en «otros». ¿El alcance sigue siendo el mismo (Reasignables, Monitoreo y «Recolectadas hoy»), sin más cambios?
3. **H1 y H4, medición.** ¿Autorizas las lecturas de solo lectura en producción (MCP `supabase`) con las consultas de arriba, o las corres tú?
4. **H4, multiempresa.** Aquí no hay `organizacion_id`. ¿Confirmas que el índice es `UNIQUE (distrito_id)` global y que se descartan los requisitos y tests de «otra empresa» y de RLS por empresa?
5. **H4, mapeo (a)/(b).** Con `es_central` como marca de central, ¿se mantiene «dos zonas, una central: se queda en la no central; cualquier otro caso: sin zona», a confirmar con los números de aquí? (En la 366 se midieron 0 casos el 2026-09-03.)
6. **H4, respaldo.** El esquema `respaldo` no existe aquí. ¿Se crea en esta migración? Y, si el rol de la app es el dueño o service role, ¿se acepta que «inaccesible para la app» no sea comprobable, o prefieres otra forma de respaldo?
7. **H4, tests.** Los 4 tests de integración que siembran un distrito en dos zonas cubren la rama `null` del colapso (`varias_zonas`), que pasa a ser imposible. ¿Se reescriben quitando esos casos y se conserva el colapso como defensa (como dice el documento), o se elimina también el estado `varias_zonas` de `cobertura-distrito.ts`?
