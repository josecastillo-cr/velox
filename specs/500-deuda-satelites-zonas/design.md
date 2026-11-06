# Ficha 500 — Diseño

> Parte del estado de `dev` en `0c18a7aa` (498 mergeada, 499 en producción). Todo lo citado con
> archivo:línea se leyó en el archivo real. Los bloques 3 y 4 no cambian código: solo ganan tests.

## 1 · Resumen de decisiones

| Bloque | Qué se hace | Capa |
| --- | --- | --- |
| 2 | Se saca `tieneAsientos` a una función compartida por lotes, `consolidacionesConDinero`. La usan `revertirConciliacion` y las dos lecturas que alimentan las acciones de conciliación, que ganan `puedeDesmarcar`. `ConciliacionAcciones` solo pinta «Desmarcar» si se lo dicen. | backend + frontend |
| 3 | Test contra Postgres del caso «solo ajuste». | tests |
| 4 | Test contra Postgres con los números literales de H5. | tests |
| 6 | Valor de enum nuevo `zona_distrito_cambiado` (migración propia, `down` dinámico), catálogos y la escritura en `ZonaRepository.update`. | backend (+ test de pantalla) |
| 7 | Se borra la marca de provisional de `lib/constants/wallet-rotulos.ts:69-72` y una guardia impide que vuelva. | backend |
| 8 | Migración de retiro **en rama y PR propios**, que no se abre hasta pasar la puerta P8. | backend, aparte |

Sin tablas nuevas. Sin cambios de RLS. Una migración en la rama principal (bloque 6) y otra en la rama
del bloque 8.

---

## 2 · Bloque 2 — «Desmarcar» solo cuando se puede (R1-R8)

### 2.1 · La función compartida (R1)

Archivo nuevo `lib/repositories/consolidaciones-con-dinero.ts`:

```ts
/** Lo que la función necesita del cliente: vale el `tx` de una transacción y el cliente raíz. */
export type ClienteConDinero = Pick<
  Prisma.TransactionClient,
  "conciliacionBodegaAjuste" | "cierreDia" | "walletMovimiento" | "walletTiendaMovimiento" | "pagoMensajeroMovimiento"
>;

/**
 * FICHA 500 (R1) — de estas consolidaciones, ¿cuáles tienen dinero? Una fila de ajuste, o una fila de
 * los tres libros con origen `cierre_dia` en uno de sus cierres. Es el predicado de `tieneAsientos`
 * de la 498, por lotes. Lo comparten el servidor (revertir) y las lecturas de las pantallas.
 */
export async function consolidacionesConDinero(
  cliente: ClienteConDinero,
  ids: readonly string[],
): Promise<Set<string>>;
```

Cuerpo, en este orden (el predicado de hoy, sin cambiar su semántica):

1. `ids` vacío → `new Set()` sin consultar.
2. `conciliacionBodegaAjuste.findMany({ where: { cierreBodegaId: { in: ids } }, select: { cierreBodegaId: true }, distinct: ["cierreBodegaId"] })`.
3. Para las que faltan: `cierreDia.findMany({ where: { cierreBodegaId: { in: resto } }, select: { id: true, cierreBodegaId: true } })`. Sin filtro de estado ni de destino, igual que `tieneAsientos` hoy (`CierresBodegaAdminRepository.ts:887-889`).
4. Para esos cierres, en los tres libros: `findMany({ where: { origenTipo: "cierre_dia", origenId: { in: cierreIds } }, select: { origenId: true }, distinct: ["origenId"] })`. El libro del mensajero **no** excluye premios: hoy tampoco lo hace y R4 exige el mismo criterio que el servidor.
5. Devuelve las consolidaciones con algún ajuste o con algún cierre que salió en el paso 4.

Cinco consultas por llamada, sea cual sea el número de ids: no hay N+1 por fila.

`CierresBodegaAdminRepository.revertirConciliacion` cambia una línea:

```ts
if ((await consolidacionesConDinero(tx, [id])).has(id)) return "con_asientos" as const; // R2
```

y se borra el método privado `tieneAsientos` (`:885-895`). El orden de los cortes no cambia: primero
`con_asientos`, luego `saldada_regla_anterior` (`:652-658`), luego el `updateMany`.

### 2.2 · La regla de la pantalla, en una función pura (R3)

En `lib/utils/conciliacion-satelite.ts`, junto a `esSaldadaReglaAnterior`:

```ts
/** FICHA 500 (R3/R4) — ¿se ofrece «Desmarcar»? Los mismos dos cortes que `revertirConciliacion`. */
export function puedeDesmarcarse(c: { conciliado: boolean; conDinero: boolean; saldadaReglaAnterior: boolean }): boolean {
  return c.conciliado && !c.conDinero && !c.saldadaReglaAnterior;
}
```

**Decisión técnica anotada:** H5 solo nombra el criterio «con dinero». La 498 añadió después un segundo
rechazo del servidor (`saldada_regla_anterior`, revisión m2). Ofrecer un botón que el servidor siempre
rechaza contradice «solo cuando se puede», así que la pantalla usa los dos cortes. R4 lo mide.

### 2.3 · Las dos lecturas

**`/wallet/satelites`.** `ConsolidacionSateliteDTO` (`lib/types/conciliacion-satelites.ts`, junto a
`saldadaReglaAnterior: boolean` en `:194`) gana `puedeDesmarcar: boolean`.
`SaldosSatelitesRepository.findConsolidacionesPaginado` y `findConsolidacionesCompleto`
(`:355-387`) llaman una vez a `consolidacionesConDinero(this.prisma, rows.map((r) => r.id))` y pasan el
resultado a `toConsolidacionDTO(r, conDinero.has(r.id))`, que rellena
`puedeDesmarcar: puedeDesmarcarse({ conciliado, conDinero, saldadaReglaAnterior })`.
`ClienteSaldosSatelites` (`:121`) amplía su `Pick` con los cinco delegados. La descarga no muestra el
campo: las columnas de `consolidaciones-satelite-descarga-columnas.ts` no cambian.

**`/cierres-admin`.** `toBodegaResumenRow` **no** cambia: lo comparten ocho lecturas y solo una monta
las acciones. `CierresBodegaAdminRepository.findCierreBodegaConDetalle` (`:358-413`) devuelve
`{ cierre, cierresDia, puedeDesmarcar }`, calculado con la misma función sobre `[id]`. La interfaz del
repositorio, el servicio y el DTO del detalle propagan el campo tal cual (el servicio no recalcula).

### 2.4 · El componente (R3, R5, R6, R7)

`components/shared/conciliacion/ConciliacionAcciones.tsx`:

- prop nueva `puedeDesmarcar?: boolean`, **por defecto `false`** (falla cerrado, R6, igual que
  `puedeConciliar`);
- el botón «Desmarcar» pasa de `estado !== "pendiente"` (`:217`) a
  `estado !== "pendiente" && puedeDesmarcar`;
- «Marcar recibido» y «Corregir» no cambian (R5);
- los avisos de `con_asientos` y `saldada_regla_anterior` (`:170-179`) **se conservan**: con una
  pantalla abierta desde antes de otra marca, el servidor sigue siendo la última palabra (R7);
- la cabecera (`:45-63`) se reescribe: «recibido → Desmarcar» pasa a «recibido sin dinero →
  Desmarcar».

Los dos sitios que lo montan pasan el campo del servidor:
`app/(app)/wallet/satelites/_components/ConciliacionSatelite.tsx:334` (`puedeDesmarcar={c.puedeDesmarcar}`) y
`app/(app)/cierres-admin/_components/CierresBodegaAdminModule.tsx:877` (`puedeDesmarcar={detalle.puedeDesmarcar}`).
El comentario de `CierresBodegaAdminModule.tsx:519-523` y `:853-855` se actualiza.

### 2.5 · La ayuda (R8)

`docs/ayuda/oficina/wallet-satelites.md`, sección «Una vez marcada, se corrige» (`:110-117`): se añade
la frase «**Desmarcar** solo aparece en una consolidación que todavía no movió dinero en la caja.» La
frase existente sobre «Ya entró a la caja…» se mantiene (sigue siendo cierta si la pantalla está
desactualizada) y su test (`tests/unit/docs/ayuda-wallet-satelites-498.test.ts:26`) no cambia. Se
mantiene el voseo de esa página (m5 de la 498 es otra ficha).

### 2.6 · Índices

Las lecturas nuevas filtran los tres libros por `(origen_tipo, origen_id)`. T1.1 comprueba en
`db/schema.prisma` que cada libro tiene un índice o único que empiece por esas columnas (la 498 se apoya
en «los únicos de origen» para la idempotencia). Si alguno no lo tiene, se anota en
`progress/impl_500.md` y se pregunta al leader; no se crea un índice sin medir.

---

## 3 · Bloques 3 y 4 — solo tests (R9, R10, R11)

El código ya hace lo que H5 pide (tabla de §0 de `requirements.md`). Se añaden:

- **R9** en `tests/integration/db/500-con-dinero-sql-real.test.ts` (el mismo archivo de R1-R4): una
  consolidación **sin cierres**, total general 100, marcada con 90 por el repositorio real → una fila
  de ajuste de 10 y un egreso de caja de 10, cero filas con origen `cierre_dia`. Revertir →
  `con_asientos`; la fila de `cierre_bodega`, la fila de ajuste, el movimiento y el historial, iguales
  byte a byte.
- **R10** y **R11** en `tests/integration/db/500-esperado-una-formula-sql-real.test.ts`: consolidación
  sembrada con `sembrarConsolidacion` (`tests/integration/db/498/_migraciones.ts:90-114`, que ya admite
  `rechazos`) con general 9000, pago 1500, rechazos 500 y sin cierres. Antes de marcar, el
  `faltaPorRecibir` que devuelve `SaldosSatelitesRepository.findConsolidacionesPaginado` es `7000.00`
  (R11). Se marca con `6900.00`: una fila de ajuste con `monto_esperado = 7000.00`,
  `monto_recibido = 6900.00`, `diferencia = 100.00`, y un `wallet_movimiento` `egreso` /
  `egreso_diferencia_satelite` de `100.00` (R10). R11 compara el `faltaPorRecibir` de la pantalla con
  el `monto_esperado` de la fila.

Contrapruebas: T6.3 y T6.4 de `tasks.md`.

---

## 4 · Bloque 6 — Rastro de los distritos (R12-R22)

### 4.1 · Migración `<prefijo>_historial_accion_zona_distrito_500`

Prefijo: el primero libre **posterior** al último de `dev` al implementar (hoy el último es
`20261103120300_satelite_498_regularizar`; la propuesta es `20261104120000`).

`migration.sql`, sola y aditiva (55P04: el valor no se usa en la misma transacción):

```sql
-- FICHA 500 (bloque 6 de H5) — el tipo de acción `zona_distrito_cambiado`.
ALTER TYPE "historial_accion_tipo" ADD VALUE IF NOT EXISTS 'zona_distrito_cambiado';
```

`down.sql` **dinámico**, calcado de `20260925120100_historial_accion_459/down.sql` (función
`pg_temp.quitar_valores_de_enum_500`): lee la lista vigente de `pg_enum`, aborta con `RAISE` si alguna
fila usa el valor y quita solo ese (R22). No se tocan los `down.sql` anteriores (memoria «Enum nuevo y
los down.sql previos»).

Se declara en `posteriores` de `tests/integration/db/orden-traspaso-migration.test.ts` (tras `:217`),
con un comentario «Ficha 500: un valor de `historial_accion_tipo`; no toca `orden_traspaso_mensajero`».

### 4.2 · Prisma y catálogos (R20)

- `db/schema.prisma`, enum `HistorialAccionTipo`: `zona_distrito_cambiado` con `///` que explique
  por qué mueve dinero (el distrito decide la zona y la zona la tarifa), qué llevan los valores y que
  solo la edición lo escribe.
- `lib/types/historial-accion.ts`: `HISTORIAL_ACCION_TIPOS` (`:56`) con el comentario de productor
  `// zonas.actualizarZona -> ZonaRepository.update`; `CATEGORIA_POR_ACCION` (`:402`) →
  `"mueve_dinero"`; `ACCION_LABELS` (`:492`) → `"Cambió los distritos de una zona"`.
- Los `Record<HistorialAccionTipo, …>` no compilan sin la entrada nueva: eso fuerza los tres.

### 4.3 · La escritura (R12-R19)

En `ZonaRepository.update`, dentro del callback de la `$transaction`, **después** del reemplazo de la
N:M (`:476-481`) y antes del `return` (`:688`). Los distritos previos ya se leen en `:457-460`.

```ts
// ⭑ FICHA 500 (R12-R17): el rastro de los DISTRITOS. Lote PROPIO (R13), el cuarto de este guardado.
const cambio = diferenciaDeDistritos(distritosPrevios.map((d) => d.distritoId), data.distritoIds);
if (cambio.anadidos.length + cambio.quitados.length > 0) {
  const nombres = await tx.distrito.findMany({
    where: { id: { in: [...cambio.anadidos, ...cambio.quitados] } },
    select: { id: true, nombre: true, canton: { select: { nombre: true } } },
  });
  const actorDeDistritos = await resolverActorCongelado(tx, actorUsuarioId);
  await appendAccion(
    tx,
    filasDeCambioDeDistritos({ id, nombre: zona.nombre }, cambio, nombres, actorDeDistritos),
    randomUUID(),
  );
}
```

Dos funciones puras de módulo, junto a `filasDeCambioDeMarca`:

- `diferenciaDeDistritos(previos, nuevos)` → `{ anadidos, quitados }` por diferencia de **conjuntos**
  (R17: orden y repetidos no cuentan).
- `filasDeCambioDeDistritos(zona, cambio, nombres, actor)` → una fila por distrito:
  `accion: "zona_distrito_cambiado"`, `entidadTipo: "zona"`, `entidadId: zona.id`,
  `entidadEtiqueta: etiquetaDeEntidad("zona", { nombre: zona.nombre })`, sin `monto` (R16);
  añadido → `valorAnterior: null`, `valorNuevo: texto`; quitado → al revés (R14).
  `texto = valorDeCatalogo(`${distrito} (${canton})`)` (`lib/types/historial-accion-etiquetas.ts:43-45`,
  recorta a 60, R15). Orden determinista: añadidos y luego quitados, cada grupo por texto y luego por id.
  Un id que no aparezca en `nombres` usa `ETIQUETA_DESCONOCIDA` (`:51`); nunca el uuid.

Por qué cumple el resto sin código extra:

- **R18.** Los tres rechazos (`not_found`, `sin_zona_central`, `distrito_en_otra_zona`) salen **antes**
  de la primera escritura (`:405`, `:411-413`, `:419-422`). Un error posterior (incluido el 23505 que
  traduce `esViolacionDistritoUnico`, `:699-701`) revierte la transacción entera, filas de historial
  incluidas, porque `appendAccion` recibe `tx`.
- **R19.** `create` (`:246-316`) y `hardDelete` (`:715-…`) no se tocan.
- **R13.** `randomUUID()` propio, como los otros tres bloques del mismo método (`:534`, `:626`, `:684`).

### 4.4 · Pantalla y descarga (R21)

`historial-acciones-columnas.ts:184` y `historial-acciones-descarga-columnas.ts:73` pintan
`valorAnterior`/`valorNuevo` de forma genérica (`valorLegible`, `:62-65`), y el filtro por categoría
sale de `accionesDeCategoria` (`lib/types/historial-accion.ts:603`), que deriva de
`CATEGORIA_POR_ACCION`. No hace falta código de pantalla: hace falta **probarlo** (T4.2 y T7.4).

### 4.5 · Guardias que fijan el catálogo

- `tests/unit/guards/historial-accion-escrituras-cubiertas.guardia.test.ts:986`: 65 → 66, y la entrada
  del censo con productor `ZonaRepository.update`. **Ojo** (memoria «La guardia mide por método»):
  `update` ya escribe tres tipos; quitar solo el bloque nuevo dejaría la guardia verde. La prueba real
  es el test de integración (T4.2) y la mutación T6.6.
- `tests/unit/guards/historial-accion-sin-datos-cliente.guardia.test.ts`: el valor nuevo es catálogo
  público (distrito y cantón de la DTA), mismo género que `nodo_geografico_renombrado`. Si la guardia
  exige declararlo, se declara.
- `tests/unit/historial-accion/catalogo-y-choke-point.test.ts` y
  `tests/unit/components/historial-acciones-filtros-def.test.ts`: se ajustan si fijan conteos.

---

## 5 · Bloque 7 — Textos definitivos (R23)

- `lib/constants/wallet-rotulos.ts:69-72`: el comentario pasa a decir que las dos etiquetas son
  definitivas (decididas en la 498 y confirmadas en su T7.1), sin «PROVISIONAL» ni «lo confirma T7.1».
- Guardia nueva `tests/unit/guards/textos-satelite-definitivos-500.guardia.test.ts`: lee los archivos
  donde viven esos textos y falla si alguno contiene `/provisional/i`. Lista cerrada, que T5.1 completa
  leyendo el código: `lib/constants/wallet-rotulos.ts`,
  `components/shared/conciliacion/conciliacion-labels.ts`, `app/(app)/wallet/_components/wallet-labels.ts`
  y el archivo de las pistas del bloque «Por cobrar a satélites» (R37 de la 498), más los tests de la 498
  que los fijan (`tests/components/CajaResumenCard498.test.tsx`, `tests/components/Conciliacion498.test.tsx`,
  `tests/components/WalletLedgerSatelite498.test.tsx`). Con autocomprobación: sembrar «provisional» en una
  copia en memoria de uno de ellos la pone roja.

---

## 6 · Bloque 8 — Retirar los respaldos (R24-R30), con puerta propia

### 6.1 · Medición previa en producción (solo lectura; P8.2)

La corre el leader con el MCP `supabase` (producción; confirmar con `get_project_url` antes) o el
humano. **Las cifras no se escriben en el repositorio.**

```sql
-- B8-1: filas de cada respaldo (la 498 existe en prod solo tras su release)
SELECT tabla, count(*) FROM respaldo.asientos_satelite_498 GROUP BY 1;
SELECT count(*) FROM respaldo.zona_distrito_499;

-- B8-2: todos los objetos del esquema `respaldo` (tablas, vistas, secuencias, funciones, tipos)
SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'respaldo' ORDER BY 1;
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'respaldo';
SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE n.nspname = 'respaldo' AND t.typrelid = 0 AND t.typcategory <> 'A';  -- tipos sueltos, no los de las tablas

-- B8-3 (H3 quedó bien): 0 filas de los tres libros con origen en un cierre satélite aprobado sin conciliar.
WITH s AS (
  SELECT c.id FROM cierre_dia c LEFT JOIN cierre_bodega b ON b.id = c.cierre_bodega_id
   WHERE c.destino_tipo::text = 'bodega_satelite' AND c.estado::text = 'aprobado'
     AND (c.cierre_bodega_id IS NULL OR b.conciliado_at IS NULL))
SELECT
  (SELECT count(*) FROM wallet_movimiento w JOIN s ON w.origen_id = s.id WHERE w.origen_tipo::text = 'cierre_dia') AS caja,
  (SELECT count(*) FROM wallet_tienda_movimiento t JOIN s ON t.origen_id = s.id WHERE t.origen_tipo::text = 'cierre_dia') AS tienda,
  (SELECT count(*) FROM pago_mensajero_movimiento p JOIN s ON p.origen_id = s.id
    WHERE p.origen_tipo::text = 'cierre_dia' AND p.categoria::text <> 'premio_ranking' AND p.premio_dia IS NULL) AS mensajero;

-- B8-4 (H4 quedó bien): 0 distritos en más de una zona, y el índice único existe.
SELECT count(*) FROM (SELECT distrito_id FROM zona_distrito GROUP BY 1 HAVING count(*) > 1) d;
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'zona_distrito_distrito_id_key';
```

El predicado de B8-3 es el de M3 de la 498 (`design.md` §3.3 de la 498) con `origen_id` contra el id
del cierre, igual que allí. **Puerta:** B8-3 = (0, 0, 0), B8-4 = 0 y una fila con el índice, y el humano
autoriza por escrito con las cifras de B8-1 y B8-2 delante. Si B8-2 lista algo que no sean las dos
tablas, se le enseña al humano antes de seguir (la migración no lo borraría, R25, pero el esquema
quedaría).

### 6.2 · Migración `<prefijo>_retirar_respaldos_500`

En la rama `fix/500-retirar-respaldos`, nacida de `dev` **después** de P8. Prefijo: el primero libre
posterior al último de `dev` en ese momento.

```sql
-- FICHA 500 (bloque 8 de H5) — RETIRA los respaldos de la 498 y la 499. IRREVERSIBLE.
-- Autorizado por escrito por el humano el <fecha> (P8). No toca ninguna tabla de `public` (R26).
DO $$
BEGIN
  DROP TABLE IF EXISTS respaldo.asientos_satelite_498;   -- R24, R27
  DROP TABLE IF EXISTS respaldo.zona_distrito_499;       -- R24, R27
  BEGIN
    DROP SCHEMA IF EXISTS respaldo;                       -- RESTRICT por defecto: solo si está vacío
  EXCEPTION WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'ficha 500: el esquema respaldo tiene otros objetos; se deja intacto';  -- R25
  END;
END $$;
```

Un solo `DO`: o se aplica entero o no se aplica (R24). El sub-bloque con `EXCEPTION` deshace solo el
`DROP SCHEMA` fallido; los `DROP TABLE` anteriores siguen en pie, que es lo buscado.

`down.sql` (R28):

```sql
-- DOWN (ficha 500, bloque 8) — NO recrea los respaldos, ni vacíos.
-- Los datos retirados por esta migración NO SE RECUPERAN: estaban solo en esas dos tablas.
DO $$ BEGIN
  RAISE NOTICE 'ficha 500: los respaldos de la 498 y la 499 no se recuperan; este down no hace nada';
END $$;
```

Se declara en `posteriores` de `orden-traspaso-migration.test.ts`.

### 6.3 · Q1 — los `down.sql` de la 498 (M3) y la 499 (limpieza)

- **Opción B (por defecto si no hay respuesta).** No se tocan. La cabecera de la migración de retiro y
  su `down.sql` dicen que, después de ella, revertir `20261103120200_satelite_498_retirar_asientos` o
  `20261102130000_zona_distrito_limpieza_499` falla con «la relación no existe» y que la vuelta atrás es
  manual. R29 y R30 no aplican.
- **Opción A.** Se editan esos dos `down.sql` en la misma rama del bloque 8. M3 de la 498: al principio,
  si `to_regclass('respaldo.asientos_satelite_498') IS NULL`, `RAISE EXCEPTION` con el texto «ficha 500
  (<nombre de la migración de retiro>) retiró el respaldo: los asientos retirados por la 498 no se
  pueden devolver» (R29). Limpieza de la 499: si `to_regclass('respaldo.zona_distrito_499') IS NULL`,
  `RAISE NOTICE` y no hace nada más (R30). Prisma no guarda checksum de `down.sql`, así que no hay
  drift; el coste es romper la costumbre de no tocar los `down.sql` ya aplicados.

### 6.4 · La base local

Aplicar la migración de retiro en local borra los respaldos de la base compartida. Los tests de
migración de la 498 y la 499 que ejecutan un `down.sql` sin haber ejecutado antes su `up` en la misma
transacción quedarían rojos (memoria «Base local compartida rompe gates ajenos»). T9.4 lo comprueba y,
si pasa, el arreglo va en esos tests (ejecutar el `up` antes del `down` dentro de su transacción), nunca
en las migraciones.

---

## 7 · Bloque 9 — No aplica

Ver la tabla de §0 de `requirements.md`. Si un test nuevo de esta ficha cae en uno de esos modos, se
aplica el criterio de H5 en ese test: `serializarEscriturasReales` como primera sentencia, aceptar
`23503` o `23001` en un `ON UPDATE RESTRICT`, no depender de estadísticas en un `EXPLAIN`, y orden total
al elegir geografía.

---

## 8 · Trazabilidad R → test

`[N]` = test nuevo contra Postgres; `[U]` = unitario o de componente; `[G]` = guardia.

| R | Test |
| --- | --- |
| R1 | `[N]` `tests/integration/db/500-con-dinero-sql-real.test.ts`: con cinco consolidaciones (A asientos de cierres, B solo ajuste, C conciliada sin nada, D saldada sin asientos, E pendiente) devuelve exactamente {A, B}; con `[]` no consulta. |
| R2, R9 | `[N]` el mismo archivo: revertir A y B → `con_asientos`; fila, ajustes, movimiento de diferencia, libros e historial iguales antes y después. |
| R3, R4 | `[N]` el mismo archivo: el `puedeDesmarcar` de `findConsolidacionesPaginado` y de `findCierreBodegaConDetalle` es `true` solo en C; y para cada consolidación conciliada, `puedeDesmarcar === (revertir → "updated")`, cada revertir en su propia transacción revertida. `[U]` `tests/unit/utils/conciliacion-satelite.test.ts`: tabla de verdad de `puedeDesmarcarse`. |
| R3, R5, R6, R7 | `[U]` `tests/components/ConciliacionAcciones500.test.tsx`: conciliada con `puedeDesmarcar` → hay «Desmarcar»; sin él o `false` → no hay; incompleta sin poder desmarcar → «Corregir» sí; con `puedeDesmarcar` y la acción respondiendo `con_asientos` / `saldada_regla_anterior` → el aviso de la 498 aparece y no se llama a `onCambio`. `[U]` en las suites de `ConciliacionSatelite` y `CierresBodegaAdminModule`: el valor del DTO llega al componente. |
| R8 | `[U]` `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`: un punto más con la frase de §2.5 (su autocomprobación ya cubre puntos nuevos). |
| R10, R11 | `[N]` `tests/integration/db/500-esperado-una-formula-sql-real.test.ts`. |
| R12-R16 | `[N]` `tests/integration/db/zona-distrito-rastro-500.test.ts` con `ZonaRepository` real: añadir 2 y quitar 1 → 3 filas, un solo `lote_id` distinto del de las demás acciones del guardado, valores y etiqueta exactos, `monto` nulo, actor. Un distrito con nombre de 80 caracteres → valor de 60. `[U]` unitarios de `diferenciaDeDistritos` y `filasDeCambioDeDistritos`. |
| R17 | `[N]` el mismo archivo: reenviar los mismos distritos en otro orden y con un repetido → 0 filas del tipo. |
| R18 | `[N]` el mismo archivo: los tres rechazos y un error forzado después del reemplazo → 0 filas del tipo y la N:M igual que antes. |
| R19 | `[N]` el mismo archivo: `create` con distritos y `hardDelete` → 0 filas del tipo. |
| R20 | `[U]` `tests/unit/historial-accion/catalogo-y-choke-point.test.ts`: categoría y etiqueta literales. `[G]` `historial-accion-escrituras-cubiertas.guardia.test.ts` (66 y productor). |
| R21 | `[N]` en `zona-distrito-rastro-500.test.ts`: el listado del repositorio del historial filtrado por categoría «mueve dinero» y por la acción devuelve las filas con sus valores. `[U]` columnas de pantalla y de descarga (`historial-acciones-columnas.ts`, `historial-acciones-descarga-columnas.ts`): la fila sale con su rótulo y sus dos valores. |
| R22 | `[N]` `tests/integration/db/historial-accion-zona-distrito-500-migration.test.ts`: up añade el valor; down lo quita y conserva un valor sembrado después; con una fila que lo usa, down aborta y no cambia nada; up es una sola sentencia. |
| R23 | `[G]` `tests/unit/guards/textos-satelite-definitivos-500.guardia.test.ts`, con autocomprobación. |
| R24-R28 | `[N]` `tests/integration/db/500-retirar-respaldos-migration.test.ts`: con las dos tablas → desaparecen tablas y esquema; con un objeto ajeno en `respaldo` → tablas fuera, esquema intacto, sin error; aplicar dos veces → sin error; lista de tablas de `public` y conteo de filas de los tres libros y de `zona_distrito` iguales antes y después; `down` → las tablas no existen y el archivo contiene «no se recuperan». |
| R29, R30 | `[N]` el mismo archivo, solo con la opción A de Q1: el `down` de M3 sin respaldo lanza con el texto exigido y los libros no cambian; el `down` de la limpieza 499 sin respaldo no lanza y `zona_distrito` no cambia. |

Todos los `[N]` corren dentro de `enTransaccionRevertida` con `serializarEscriturasReales` como primera
sentencia. Los de dinero (R1-R4, R9-R11) usan los fixtures de `tests/integration/db/498/`
(`_satelite.ts`, `_migraciones.ts`); si `consolidacionConDosCierres` es local de
`498-conciliar-asienta-sql-real.test.ts`, se mueve a `498/_satelite.ts` sin cambiar su cuerpo.

---

## 9 · Alternativas descartadas

1. **Bloque 2: que la pantalla decida con lo que ya trae** (estado, `montoRecibido`, `debe`). Daría un
   segundo criterio, distinto del servidor: una consolidación sin cierres con un ajuste no se distingue
   de una sin nada mirando solo esos campos. H5 pide expresamente el **mismo** criterio.
2. **Bloque 2: un solo `$queryRaw` con `EXISTS`.** Una ida a la base en vez de cinco. Se descarta por
   ahora: la versión Prisma es el predicado de `tieneAsientos` tal cual, por lotes, tipado y sin SQL
   nuevo que mantener. Si T1.1 mide un coste real en la página, se reconsidera.
3. **Bloque 2: quitar «Desmarcar» del todo.** La 498 mantiene revertir una conciliada sin dinero (R22 de
   la 498: recibido 0 con aporte ≤ 0, consolidación sin cierres). Quitarlo dejaría ese caso sin salida.
4. **Bloque 2: añadir el campo a `toBodegaResumenRow`.** Lo comparten ocho lecturas; siete no montan
   acciones y pagarían cinco consultas sin usarlas.
5. **Bloque 6: una sola fila por guardado con la lista de distritos.** No cabe en `VarChar(60)` y H5
   decide una fila por distrito.
6. **Bloque 6: reutilizar `orden_zona_reconciliada` o `zona_pago_mensajero_cambiado`.** Son otros
   hechos; el censo exige un tipo por significado y por productor.
7. **Bloque 8: en el mismo PR que los bloques 2-7.** Al mergear a `dev`, preview migra
   (`MIGRATE_ON_PREVIEW=true`) y borraría su respaldo, y la release lo llevaría a producción sin la
   puerta. Es irreversible: va aparte.
8. **Bloque 8: `DROP SCHEMA respaldo CASCADE`.** Borraría en silencio cualquier objeto ajeno del
   esquema. H5 pide dejarlo intacto y avisar.

---

## 10 · Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Pantalla abierta antes de que otra persona marque: muestra «Desmarcar» y el servidor rechaza. | R7: el aviso de la 498 se conserva y el diálogo explica qué hacer. |
| Cinco consultas más por página de consolidaciones. | Una vez por página, no por fila. T1.1 verifica los índices de origen. |
| La guardia del censo no ve que se borre solo el bloque nuevo de `update`. | Test de integración R12 y mutación T6.6. |
| El retiro se mergea sin autorización. | Rama propia; T9.0 bloquea con la puerta P8; el leader no la abre sin el texto del humano. |
| El retiro en local rompe tests de la 498/499. | T9.4 y §6.4. |

---

## 11 · Gate

`./init.sh --rapido` (nunca el completo). La rama de los bloques 2-7 toca una migración y
`db/schema.prisma`, así que el `--rapido` se amplía solo con toda `tests/integration/db`. Las guardias
que leen archivos con `fs` (las del historial y la nueva de textos) se corren a mano si el grafo no las
relaciona (memoria «Guardia estructural escapa al --rapido»).
