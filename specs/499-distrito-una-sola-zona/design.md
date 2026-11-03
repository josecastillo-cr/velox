# Ficha 499: diseño

Se trata de arreglar lo que se ha evidenciado, no de rediseñar. El modelo N:M se queda, y encima se ponen
cuatro capas: el índice, la lectura de conflictos en la transacción del guardado, el árbol con la lista de
zonas y el selector que bloquea. Todas las rutas están confirmadas en el archivo real el 2026-11-02 (`dev`,
HEAD `82cc4f36`).

## 1. Lo que hay hoy (confirmado)

| Pieza | Dónde | Qué hace |
|---|---|---|
| N:M | `db/schema.prisma:683-695` `ZonaDistrito` | `@@unique([zonaId, distritoId])`, `@@index([zonaId])`, `@@index([distritoId])`. Lo crea `db/migrations/20260711210000_zona_distrito_nm`. RLS activada sin políticas. |
| Service | `lib/services/ZonaService.ts:59-109` `prepararDatos` | Valida el nombre imprimible, deduplica y comprueba que existen los distritos (`countExistingDistritos`) y los vehículos. **No mira conflictos.** |
| Crear | `lib/repositories/ZonaRepository.ts:213-271` | `$transaction` interactiva: lee la central previa, la apaga (`updateMany`), crea la zona, la N:M (`createMany`), las tarifas y el historial de la marca. Devuelve `ZonaDTO` a secas. El `catch` llama a `translateEsCentralConflict`. |
| Actualizar | `ZonaRepository.ts:346-…` | `findUnique` de la zona (`not_found`), el corte `sin_zona_central`, apagar la otra central, `zona.update`, la lectura de `distritosPrevios` y `pagosPrevios`, `deleteMany` + `createMany` de la N:M, la reconciliación de `orden.zona_id` (366/377) y el historial. |
| Unicidad bajo el adapter | `lib/repositories/_shared/prisma-unique.ts` `textoConstraintP2002` | Junta `meta.target` y `meta.driverAdapterError.cause.originalMessage`. Solo reconoce `PrismaClientKnownRequestError` P2002. |
| FK bajo el adapter | `ZonaRepository.ts:702-711` + `_shared/prisma-fk.ts` | Medido en la 373: dentro de una transacción interactiva, la violación de FK llega como `DriverAdapterError` **sin `code`** y con `cause.code`. Es el precedente de por qué la red final se mide (§4.3). |
| Árbol | `lib/repositories/GeoRepository.ts:192-247` `listArbol` | Ya pide todas las zonas del distrito (`zonas: { select: { zona: { id, nombre } } }`), pero las colapsa con `zonaUnicaDeDistrito` a `zonaId`/`zonaNombre`. Tipo `DistritoArbolDTO` en `lib/types/geografia-nodo.ts:141`. |
| Preselección | `app/(app)/configuracion/tarifas/_components/ZonasTarifasModule.tsx:106-110` | `d.zonaId === full.id` sobre el estado `provincias`. `abrirCrear` (`:80-85`) y `abrirEditar` (`:87-140`) no leen el árbol. `onSaved` (`:142-145`) hace `void refetch()`. |
| Selector | `.../GeografiaSelector.tsx` | `Checkbox` del distrito sin `disabled` (`:262-266`). Pinta `(zona: X)` (`:268-272`). `provDistIds`/`cantDistIds` (`:72-85`) y `stateFor` (`:87-92`) cuentan todos los distritos. No sabe qué zona se edita. |
| Formulario | `.../CrearZonaForm.tsx` | Pinta `errors.distritoIds` bajo el selector (`:522`). El toast sale de `mensajeDeError` (`:725-753`). El `validation_error` solo mira `nombre` y `esCentral`. El `conflict` dice «Ya existe una zona con ese nombre o un distrito ya está asignado.» (`:743`). |
| Colapso | `lib/repositories/_shared/zona-colapso.ts` | 1 zona da esa zona; 0 o más de 1 dan `null`. Lo usan `GeoRepository`, `OrdenRepository` (`:2676`, `:2840`), `ZonaRepository.update` y `cobertura-distrito.ts`. **Se queda tal cual.** |

## 2. Modelo de datos

### 2.1 `db/schema.prisma`

En `ZonaDistrito` se añade `@@unique([distritoId])`. Prisma le pone el nombre por convención:
**`zona_distrito_distrito_id_key`**. Ese nombre es el contrato de la red final (§4.3) y el de la consulta
posterior al despliegue (§8).

- `@@unique([zonaId, distritoId])` **se queda**: Prisma genera la clave compuesta `zonaId_distritoId` en
  `WhereUniqueInput`, y quitarla cambiaría el cliente sin necesidad.
- `@@index([distritoId])` también se queda. Es redundante con el único, pero quitarlo es una migración más
  sin ningún defecto que la pida.

### 2.2 Migración 1: `20261102120000_zona_distrito_limpieza_499`

> Timestamp provisional. Va después de la última, `20261023120100_iva_por_pagar_488_checks`. Hay otras fichas
> del mismo lote (496-498) en paralelo: el backend_dev mira `origin/dev` al empezar (B.1) y corre los dos
> timestamps si hace falta. Esta migración y la del índice van siempre juntas y en este orden.

```sql
CREATE SCHEMA IF NOT EXISTS respaldo;

CREATE TABLE IF NOT EXISTS respaldo.zona_distrito_499 (
  id            TEXT        PRIMARY KEY,   -- el id de la fila de zona_distrito
  zona_id       TEXT        NOT NULL,
  distrito_id   TEXT        NOT NULL,
  respaldado_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE respaldo.zona_distrito_499 ENABLE ROW LEVEL SECURITY;   -- sin políticas, como zona_distrito
REVOKE ALL ON SCHEMA respaldo FROM PUBLIC;
-- anon / authenticated solo existen en Supabase: el REVOKE va dentro de un DO que mira pg_roles,
-- para que la misma migración corra en la base local de tests.

WITH g AS (
  SELECT zd.id, zd.zona_id, zd.distrito_id, z.es_central,
         count(*)                         OVER (PARTITION BY zd.distrito_id) AS n,
         count(*) FILTER (WHERE z.es_central) OVER (PARTITION BY zd.distrito_id) AS centrales
  FROM zona_distrito zd JOIN zona z ON z.id = zd.zona_id
)
INSERT INTO respaldo.zona_distrito_499 (id, zona_id, distrito_id)
SELECT id, zona_id, distrito_id FROM g
WHERE n > 1
  AND NOT (n = 2 AND centrales = 1 AND es_central = false)   -- regla (a): se queda la no central
ON CONFLICT (id) DO NOTHING;

DELETE FROM zona_distrito zd
USING respaldo.zona_distrito_499 r
WHERE zd.id = r.id;
```

- Las columnas de los ids son `TEXT`, el mismo tipo que en `zona_distrito`
  (`20260711210000_zona_distrito_nm/migration.sql:9-11`).
- El `DELETE` usa **los ids del respaldo** y no vuelve a evaluar la regla. Por eso no puede borrar nada que
  no esté respaldado (R4).
- No toca ninguna otra tabla (R6). Sin duplicados, el `INSERT` no inserta nada y el `DELETE` no borra nada
  (R5).
- La migración es idempotente (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), así que se puede volver a aplicar
  sin error (R8).
- La regla (a) y la (b) salen de la misma ventana. Un grupo `n = 2, centrales = 1` respalda solo su fila
  central. Cualquier otro grupo con `n > 1` respalda todas sus filas.

`down.sql`:

```sql
INSERT INTO zona_distrito (id, zona_id, distrito_id)
SELECT r.id, r.zona_id, r.distrito_id
FROM respaldo.zona_distrito_499 r
WHERE EXISTS (SELECT 1 FROM zona z WHERE z.id = r.zona_id)
  AND EXISTS (SELECT 1 FROM distrito d WHERE d.id = r.distrito_id)
ON CONFLICT DO NOTHING;
DROP TABLE respaldo.zona_distrito_499;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'respaldo') THEN
    DROP SCHEMA respaldo;
  END IF;
END $$;
```

El `down.sql` de esta migración solo funciona si antes se ha quitado el índice, es decir, si ya corrió el
`down.sql` de la migración 2. Es el orden normal de reversión. Se deja dicho en un comentario de cabecera.

### 2.3 Migración 2: `20261102120100_zona_distrito_unico_499`

```sql
CREATE UNIQUE INDEX "zona_distrito_distrito_id_key" ON "zona_distrito"("distrito_id");
```

Va en una migración propia. Si la limpieza dejara algún duplicado, este `CREATE` falla y aborta el despliegue
(R7). Sin `CONCURRENTLY`: Prisma envuelve la migración en una transacción y la tabla es pequeña (como mucho un
renglón por distrito).

`down.sql`: `DROP INDEX IF EXISTS "zona_distrito_distrito_id_key";`

### 2.4 El respaldo: una limitación aceptada

La app entra a la base por Prisma con un rol con acceso total, y las migraciones van por el mismo camino. El
`REVOKE` y la RLS sin políticas cierran la Data API de Supabase (`anon`, `authenticated`). El esquema
`respaldo` además no está entre los esquemas expuestos. Pero **no aíslan nada del rol con el que entra la
app**. Por eso «inaccesible para la app» **no es un requisito ni tiene test**: lo decidió el humano el
2026-11-02. El respaldo vive hasta que la ficha 500 lo retire, con su propia puerta.

## 3. Contratos

### 3.1 `IZonaRepository`

```ts
export interface ConflictoDistritoZona { distritoNombre: string; zonaNombre: string }

/** 499: el desenlace compartido de crear y actualizar cuando un elegido ya está en otra zona. */
export type DistritoEnOtraZona = {
  estado: "distrito_en_otra_zona";
  /** `null` = lo rechazó el índice (carrera), no la lectura: no hay nombres que dar. */
  conflictos: ConflictoDistritoZona[] | null;
};

export type CreateZonaResult = { estado: "ok"; zona: ZonaDTO } | DistritoEnOtraZona;
create(data: CreateZonaData, actorUsuarioId: string | null): Promise<CreateZonaResult>;

export type UpdateZonaResult =
  | { estado: "ok"; zona: ZonaDTO; ordenesReconciliadas: number; ordenesRetenidasEnBodegaSatelite: number }
  | { estado: "not_found" }
  | { estado: "sin_zona_central" }
  | DistritoEnOtraZona;
```

`create` deja de devolver `ZonaDTO` a secas. Sus llamadores son `ZonaService.crear` y 7 llamadas en 4
archivos de `tests/integration/db` (`zona-reconciliacion-ordenes`, `zona-pago-mensajero-rastro`,
`zona-central-guarda-y-rastro`, `zona-sinpe-revision`). Esas llamadas se ajustan para desenvolver
`estado: "ok"`, sin cambiar lo que comprueban. El backend_dev confirma la lista con `tsc`.

### 3.2 `IZonaService`

No cambia ningún tipo: `validation_error` con `fieldErrors` ya existe en `CrearZonaServiceResult` y en
`ActualizarZonaServiceResult`.

- Con `conflictos` como lista, `fieldErrors.distritoIds` es un mensaje por conflicto,
  `` `${distritoNombre} ya está en la zona ${zonaNombre}.` ``. Van ordenados por `distritoNombre` con
  `localeCompare(…, "es", { sensitivity: "base" })`, el mismo comparador que `cobertura-distrito.ts`.
  Ordena el **service**, no el repositorio: R11 se fija en un unitario sin depender de la colación de la base.
- Con `conflictos: null`, `fieldErrors.distritoIds` es solo el mensaje de recarga (glosario). La constante va
  en `ZonaService.ts`, junto a `MSG_SIN_ZONA_CENTRAL`.

### 3.3 `DistritoArbolDTO` (`lib/types/geografia-nodo.ts`)

Se añade `zonas: { id: string; nombre: string }[]`, ordenada por `nombre` con el mismo comparador español
(R15). `zonaId` y `zonaNombre` se quedan con su colapso (R16): los usan `GeografiaAdminModule.tsx:602` y
`zonas-sin-distritos.ts:45`, que no cambian.

## 4. Flujo transaccional

### 4.1 La lectura de conflictos (un helper privado en `ZonaRepository`)

```ts
async function leerConflictos(tx, distritoIds: string[], zonaPropiaId: string | null)
  : Promise<ConflictoDistritoZona[]> {
  if (distritoIds.length === 0) return [];
  const filas = await tx.zonaDistrito.findMany({
    where: { distritoId: { in: distritoIds }, ...(zonaPropiaId ? { NOT: { zonaId: zonaPropiaId } } : {}) },
    select: { distrito: { select: { nombre: true } }, zona: { select: { nombre: true } } },
  });
  return filas.map((f) => ({ distritoNombre: f.distrito.nombre, zonaNombre: f.zona.nombre }));
}
```

El filtro va en el `WHERE`, en SQL, y no se filtra en JS. Así una mutación del `NOT` la ve un test contra
Postgres (lección «probar el WHERE donde vive»).

### 4.2 Dónde va

- **`create`:** es la **primera** sentencia del callback, antes incluso de leer y apagar la central previa
  (R9). Con conflictos devuelve `{ estado: "distrito_en_otra_zona", conflictos }` sin escribir nada.
- **`update`:** va justo después del `findUnique` de existencia y del corte `sin_zona_central`, que no
  escriben, y **antes** de `updateMany`, `zona.update` y todo lo demás (R10). Si la zona no existe, gana
  `not_found` (R14). Si se pide quitar la marca a la única central **y además** hay conflictos, gana
  `sin_zona_central`: es el corte que ya existía y no hace consultas. Lo fija un caso del test de
  integración, para que el orden no cambie por accidente.

### 4.3 La red final (R13)

La lectura de §4.1 se hace con `READ COMMITTED`, así que no ve la inserción **sin confirmar** de otro
guardado simultáneo. Ese guardado choca después en el `createMany` contra el índice. El error sale del
`$transaction` (Prisma hace el rollback, así que no queda ninguna escritura) y se atrapa en el `catch` que ya
existe en `create` y `update`. **Antes** de `translateEsCentralConflict` y de relanzar, se mira esto:

```ts
if (esViolacionDistritoUnico(e)) return { estado: "distrito_en_otra_zona", conflictos: null };
```

`esViolacionDistritoUnico` va en `lib/repositories/_shared/prisma-unique.ts` y detecta **por el nombre del
índice** (`zona_distrito_distrito_id_key`) en las dos formas posibles:

1. `PrismaClientKnownRequestError` P2002: con `textoConstraintP2002(e)`, que incluye el nombre.
2. El error del driver sin `code` (como el FK medido en la 373): un `DriverAdapterError` o una `cause` con
   `code === "23505"` y el nombre del índice en el mensaje.

**Antes de escribirlo, se mide cuál llega de verdad** (tarea B.2) y se anota en `progress/impl_499.md`, con
el mismo formato que el comentario de `ZonaRepository.ts:702-707`. Si llega solo una de las dos formas, se
cubren igual las dos: el adapter ya cambió de forma una vez (P2002 sin `meta.target`).

`zona_distrito_zona_id_distrito_id_key` (el par) **no** contiene la cadena `zona_distrito_distrito_id_key`,
así que no da falsos positivos. Esa colisión no puede pasar desde la app (se deduplica en
`prepararDatos` y el `deleteMany` va antes), pero el test de unidad del detector la comprueba igual.

**Test de la carrera, determinista** (en `zona-distrito-unico-499.test.ts`):

1. Una segunda conexión (`pg` o un `PrismaClient` aparte) abre una transacción e inserta
   `(zonaX, d)` **sin confirmar**.
2. Se llama a `repo.update(zonaY, { distritoIds: [d] })`. La lectura no ve la fila y el `createMany` se queda
   esperando en el índice.
3. La segunda conexión hace `COMMIT`.
4. El `update` recibe la violación. Se espera
   `{ estado: "distrito_en_otra_zona", conflictos: null }`, que la zona Y conserve su nombre, sus distritos y
   sus tarifas, y que no haya filas nuevas en `historial_accion`.

## 5. El árbol (`GeoRepository.listArbol`)

En el `select` no cambia nada: ya trae las zonas. En el `map` se añade
`zonas: d.zonas.map((z) => z.zona).sort(porNombreEs)`. El colapso de `zonaId`/`zonaNombre` no se toca.

Con el índice, en la base solo cabe una zona por distrito. El orden de R15 con dos o más zonas se prueba con
un doble de Prisma (`tests/unit/repositories/geo-repository-arbol-499.test.ts`). La forma con una zona y con
ninguna se prueba contra Postgres.

## 6. La pantalla

### 6.1 `GeografiaSelector`: un prop nuevo

```ts
/** 499: la zona que se edita, o `null` al crear. Un distrito con zona distinta de ésta se bloquea. */
zonaPropiaId: string | null;
```

- `bloqueado(d) = d.zonas.some((z) => z.id !== zonaPropiaId)`. Al crear, `zonaPropiaId = null`, así que
  cualquier zona lo bloquea.
- `Checkbox disabled={bloqueado(d)}`. La etiqueta `(zona: …)` sale de `d.zonas`: los nombres de las zonas
  que no son la propia, unidos con «, ». Con el índice siempre será una (R17).
- `provDistIds` y `cantDistIds` pasan a contener **solo los ids seleccionables**. Con eso, `toggleGrupo`
  (R19) y `stateFor` (R20) quedan corregidos sin tocar su lógica. Un grupo con la lista vacía pinta su
  casilla `disabled` (R20). `stateFor([])` ya devuelve «vacío».
- Los distritos de la zona propia no se bloquean (R18). La marca de «zona especial» no cambia: es del
  distrito y es independiente del bloqueo.
- **Lo que no cambia:** la búsqueda, el distintivo de retirado y la casilla de especial.

### 6.2 `ZonasTarifasModule`

- `abrirCrear` pasa a ser `async`. Llama a `listarArbolGeografico()`. Si no da `ok`, muestra
  `toast.error("No se pudo cargar la geografía. Inténtalo de nuevo.")` y **no** abre. Si da `ok`, hace
  `setProvincias` y abre (R21).
- `abrirEditar` añade `listarArbolGeografico()` al `Promise.all` que ya existe. Si falla, sale el mismo
  toast y no abre. La preselección se calcula sobre **el árbol recién leído**, no sobre el estado:
  `d.zonas.some((z) => z.id === full.id)` (R22).
- `onSaved` se queda con `void refetch()`: la frescura ya la garantiza la lectura al abrir.
- Le pasa a `CrearZonaForm` el `zonaPropiaId` (`initial?.zonaId ?? null`), y el formulario se lo pasa al
  selector.

### 6.3 `CrearZonaForm`

En modo «crear», tras un primer guardado que falló en la tarifa, el siguiente guardado es un `actualizar`
sobre `zonaIdGuardada`. El árbol del formulario es el de cuando se abrió, así que los distritos recién
guardados no aparecen como «de otra zona». No hace falta pasar `zonaIdGuardada` al selector. Se deja dicho en
un comentario.

### 6.4 Mensajes

- **Bajo el selector:** `errors.distritoIds`, todos, con el `FieldError` que ya existe (`:522`) (R23).
- **Toast de `validation_error`:** en `mensajeDeError`, la nueva rama va **antes** de `nombre` y
  `esCentral`.
  - Con 1 mensaje: el mensaje tal cual.
  - Con N > 1: el primero sin su punto final, seguido de `` ` (y ${N - 1} más).` ``. Por ejemplo, «San Pedro
    ya está en la zona Este (y 2 más).». Este texto depende de la pregunta abierta 1 de requirements.
- **Toast de `conflict`:** «Ya existe una zona con ese nombre.» (R24). El de hoy menciona distritos, y a
  partir de esta ficha un distrito ya no llega nunca como `conflict`.
- Sin la sigla «SLA» ni jerga en ningún texto (memoria «No "SLA" en frontend»).

## 7. Tests que se reescriben

Siembran contra Postgres un distrito en dos zonas, un estado que el índice hace imposible. Inventario del
2026-11-02:

| Archivo | Líneas | Qué cubrían | Qué se hace |
|---|---|---|---|
| `tests/integration/db/zona-reconciliacion-ordenes.test.ts` | 394-402 | 366/R3: «ambiguo, no mueve» | Se quita el caso de base. La rama `null` del colapso la cubren los unitarios de `zona-repository.test.ts` (dobles) y los de `zonaUnicaDeDistrito`. Se añade un comentario que cite la 499. |
| `tests/integration/db/cobertura-repository.test.ts` | 129, 189-190 | «Dos Zonas» como `varias_zonas` | Se quita la segunda asignación. `varias_zonas` queda cubierto por `tests/unit/utils/cobertura-distrito.test.ts` y `cobertura-vs-resolve-geo.test.ts` (R25). |
| `tests/integration/db/geografia-catalogo-activo.test.ts` | 60, 145, 344 | El árbol con un distrito en dos zonas (colapso a `null`) | Se reescribe con una sola zona. El colapso con más de una pasa al unitario de §5. |
| `tests/integration/db/corregir-datos-cliente.repo.test.ts` | 426, 476, 765, 798 | La re-derivación ambigua al corregir datos | Se quita el caso ambiguo de base. Cubierto por `tests/unit/services/corregir-datos-cliente-service.test.ts`. |

Los unitarios con dobles (`tests/unit/repositories/zona-repository.test.ts:609,809`,
`orden-repository.bulk.test.ts:170`) **no se tocan**. El colapso se conserva como defensa y siguen
probándolo. Los dobles de `zona-repository.test.ts` sí necesitan responder a la nueva `findMany` de §4.1
(lista vacía por defecto).

**Regla para el implementador:** antes de quitar una aserción, mirar si es el contrato (memoria «Literal:
contrato o polizón»). Ninguno de estos casos se cambia por la salida de su propia función.

## 8. Después del despliegue (obligatorio, solo lectura salvo el punto 4)

Se corre con el MCP `supabase` (producción). Antes, confirmar el proyecto con `get_project_url`.

1. **Duplicados.** Debe dar 0 filas:
   ```sql
   SELECT zd.distrito_id, count(*) AS n, count(*) FILTER (WHERE z.es_central) AS centrales
   FROM zona_distrito zd JOIN zona z ON z.id = zd.zona_id
   GROUP BY zd.distrito_id HAVING count(*) > 1;
   ```
2. **El índice existe.**
   ```sql
   SELECT indexname, indexdef FROM pg_indexes
   WHERE tablename = 'zona_distrito' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(distrito_id)%';
   ```
   Debe devolver `zona_distrito_distrito_id_key`.
3. **El respaldo.** `SELECT count(*) FROM respaldo.zona_distrito_499;` debe coincidir con lo que se midió
   antes de desplegar. El total de `zona_distrito` debe ser el de antes menos ese número.
4. **Reconciliar órdenes vivas.** La migración no movió órdenes.
   ```sql
   SELECT o.id, o.zona_id AS zona_orden, zd.zona_id AS zona_distrito, s.value AS estado
   FROM orden o
   JOIN zona_distrito zd ON zd.distrito_id = o.distrito_id
   JOIN order_status s ON s.id = o.estatus_id
   WHERE o.deleted_at IS NULL AND o.zona_id IS DISTINCT FROM zd.zona_id;
   ```
   - Si hay filas, el maestro **abre y guarda sin cambios**, desde la pantalla, cada zona que recibió esos
     distritos. Aquí funciona porque el guardado usa `update`, que reconcilia la `zona_id` de las órdenes
     elegibles (366/377, `whereBaseElegible`, `ZonaRepository.ts:187-200`).
   - No se mueven las órdenes con detalle de cierre, con una gestión vigente `entregado`,
     `devolucion_a_origen_por_rechazo` o `incidente`, ni las que están en `en_bodega_satelite`. Esas se
     retienen y se informan.
   - Volver a lanzar la consulta. Lo que quede debería ser solo lo no elegible: informarlo **por conteo y
     estado**.
   - Si el guardado no reconcilia, se informa al humano y **no se mueven órdenes con SQL**.
5. **Distritos sin zona con órdenes.**
   ```sql
   SELECT d.id, count(o.id) AS ordenes
   FROM distrito d
   LEFT JOIN orden o ON o.distrito_id = d.id AND o.deleted_at IS NULL
   WHERE NOT EXISTS (SELECT 1 FROM zona_distrito zd WHERE zd.distrito_id = d.id)
     AND EXISTS (SELECT 1 FROM orden o2 WHERE o2.distrito_id = d.id)
   GROUP BY d.id;
   ```
   Se informa al humano. Asignarlos es decisión suya, desde la pantalla.

**Antes de desplegar**, se repite la medición del punto 1 (solo conteos) y el resumen por regla (a)/(b) de
`progress/inventario_hotfix_H1_H4.md` §H4.4, y se anota en la nota de la release. Este spec no lleva números
de producción a propósito: los que valen son los de ese momento.

## 9. Test rojo antes del arreglo y mutaciones

- **Rojo en `dev` sin cambios (B.0):** en `zona-distrito-unico-499.test.ts`, crear una zona con un distrito
  que ya está en otra espera `validation_error`. Hoy responde `ok` y deja el distrito en dos zonas.
- **Mutaciones que deben poner rojo algún test:**
  - **M1.** Quitar la llamada a `leerConflictos` en `update`. El índice lo atrapa y sale el mensaje de
    recarga en vez del nombrado: R11 en rojo.
  - **M2.** Quitar el `NOT: { zonaId }` del `WHERE` de §4.1: los propios distritos dan conflicto y R12 se
    pone rojo.
  - **M3.** Mover `leerConflictos` en `create` detrás del `updateMany` de la central. Con una zona central
    previa, la marca se pierde: R9 en rojo.
  - **M4.** Quitar `esViolacionDistritoUnico` del `catch`: la carrera de §4.3 relanza el error. R13 en rojo.
  - **M5.** Cambiar la regla (a) para que conserve la central: R2 en rojo.
  - **M6.** Quitar `disabled` del `Checkbox`: R17 en rojo.
  - **M7.** Volver a `d.zonaId === full.id` en la preselección: R22 en rojo.
  - **M8.** Volver a calcular `cantDistIds` con todos los distritos: R19 y R20 en rojo.
- El implementador escribe en `progress/impl_499.md` cada mutación y el test que la mata. El arnés tiene que
  comprobarse a sí mismo: el árbol restaurado y el test que se espera en rojo (memoria «Arnés de mutaciones
  que miente»).

## 10. Alternativas descartadas

- **Validar en `ZonaService.prepararDatos`, fuera de la transacción.** Es el sitio que comparten crear y
  actualizar, y ahí se cerró la 392. Se descarta: la lectura y la escritura quedarían en transacciones
  distintas, y entre las dos otro guardado podría asignar el mismo distrito. Además el service no ve la zona
  central previa que `create` apaga. Dentro de la transacción, la lectura va antes de la primera escritura,
  y el índice cubre lo que queda.
- **Cambiar el modelo a `distrito.zona_id` (1:N) y retirar la N:M.** Expresa la regla en el tipo, pero toca
  cada lector de `zona_distrito` (`OrdenRepository`, `CoberturaRepository`, `GeoRepository`, la carga
  masiva…) y el colapso compartido. Es un rediseño sin ningún defecto que lo pida (memoria «Arreglar lo
  evidenciado, no rediseñar»).
- **Un trigger en vez de un índice único.** Da un mensaje propio, pero no sirve contra dos inserciones
  simultáneas sin bloquear la tabla. El índice es atómico y además es lo que lee el chequeo posterior al
  despliegue.
- **Respaldar en una tabla de `public`.** Quedaría expuesta por la Data API de Supabase. El esquema
  `respaldo` fuera de los expuestos es lo mínimo que de verdad cierra algo (§2.4).
- **Quitar `varias_zonas` de `cobertura-distrito.ts`.** Lo descartó el humano: se conserva como defensa.

## 11. Fuera de alcance

- El rastro de los distritos de una zona en el histórico (H5, bloque 6): es la ficha 500.
- Retirar `respaldo.zona_distrito_499`: es la ficha 500, con su propia puerta.
- Mover órdenes con SQL: nunca. Solo el guardado de pantalla del §8.4.
