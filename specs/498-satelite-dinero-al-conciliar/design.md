# Ficha 498 — Diseño

> **Arreglo por capas, adoptado entero (H3).** No es un modelo nuevo de dinero. Se reutilizan los
> cinco escritores que ya existen: solo cambia **cuándo** corren para un cierre satélite (al conciliar,
> no al aprobar). La deuda pasa a la fórmula única que ya existía (`paraLaCentral`). Lo único nuevo es
> lo que H3 exige para registrar la diferencia: dos categorías, un origen, una tabla append-only y un
> dueño de la caja. Y lo que exigen las respuestas del humano del 2026-11-02: **una** columna nullable
> en `cierre_bodega` para regularizar lo conciliado antes (Q4, §3.5) y el recibido 0 cuando el aporte
> es ≤ 0 (Q5, §4.4 bis).
>
> **Ajuste del 2026-11-02.** Este diseño incorpora las respuestas del humano a Q3, Q4 y Q5 y al SINPE
> (ver la cabecera de `requirements.md`). Q1 y Q2 siguen abiertas.

Búsqueda hecha con el MCP `codebase-memory` (proyecto `R-job-singularis-projects-ordenex`). Cada
símbolo citado se confirmó leyendo el archivo real en `dev` (`f0833d64`) el 2026-11-02. Los números de
línea son de esa revisión, **antes** de la 497.

---

## 1 · Qué hay hoy, verificado en el archivo

| Pieza | Dónde | Estado |
| --- | --- | --- |
| Los cinco escritores de dinero | `lib/repositories/CierresAdminRepository.ts:1871-1933`, dentro de `res.count === 1 && nuevoEstado === "aprobado"` | Corren sin leer `destino_tipo`. Orden: caja (`walletFeedService` → `walletMovimientoRepo`), libro por tienda, COD a caja (`CAJA_COD_FEED`, constante de módulo en `:170`, solo si se acreditó `cod_recaudado`), libro del mensajero + `egresoCaja`, egreso de indemnización. |
| Captura de la indemnización | `CierresAdminRepository.ts:1859-1869` | Va **antes** de los feeds, porque el feed de indemnización lee lo que escribe. No es dinero: es un dato de la gestión. |
| Inyección | Constructor de `CierresAdminRepository` (`:940-962`), composition root `lib/actions/cierres-admin.ts:106` | Siete dependencias inyectadas. `CAJA_COD_FEED` no se inyecta. |
| Marca / corrección / reversión | `lib/repositories/CierresBodegaAdminRepository.ts:518-568` / `:656-717` / `:585-636` | `$transaction` propia, guarda en el `WHERE` y `appendAccion(tx, …)`. Los comentarios dicen «NO ESCRIBE EN NINGUN LIBRO DE DINERO» (`:515`, `:654`). |
| Composition roots de la conciliación | `lib/actions/conciliacion-satelites.ts:54-62` (`buildService`), `lib/actions/cierre-bodega.ts:81` | Las dos construyen `new CierresBodegaAdminRepository(prisma)`, **sin más argumentos**. |
| Servicio | `lib/services/ConciliacionSatelitesService.ts:126-182` | Hay control de rol (`esAccesoTotal`) antes de cada escritura. Desenlaces: `ok`, `conflict`, `no_encontrada`, `forbidden`. |
| Fórmula del aporte | `lib/utils/ingreso-ordenex.ts:679-688` (`paraLaCentral`) | La usan `CierreBodegaRepository.ts:125` (cabecera) y `CierresBodegaAdminService.ts:354`. |
| Fórmula del saldo | `lib/utils/conciliacion-satelite.ts:39-44` (`saldoDe`) | `efectivo − (recibido ?? 0)`. La usan `SaldosSatelitesRepository` (`:77`, `:179`, `:240`, `:334`), `CierreBodegaRepository.ts:136` y `EstadoCuentaService.ts:415`. |
| Saldos | `lib/repositories/SaldosSatelitesRepository.ts:132-193`, `:309-369` | `groupBy` sobre `cierre_bodega` no rechazadas con Σ`total_efectivo`. No ve cierres sin consolidar ni SINPE. |
| Estado de cuenta | `lib/repositories/EstadoCuentaRepository.ts:259-300` (`paginaDeBodega`), `:359-376` (`totalesDeBodega`), `:396-426` (`periodoDeBodega`) | Declarado = `total_efectivo` de cada consolidación. No tiene fila por cierre sin consolidar. |
| Caja por dueño | `lib/utils/caja-tesoreria.ts:62-111` (`NATURALEZA_POR_CATEGORIA`), `:136-179` (`LIQUIDEZ_POR_CATEGORIA`), `:241-266` (ramas `if/else if`), `:316-337` (`derivarReparto`), `:362-429` (`derivarCaja`) | Cuatro dueños: `propio`, `terceros`, `capital`, `iva`. Las ramas no tienen `never`. |
| Tipo del dueño | `lib/types/wallet.ts:294` (`NaturalezaMovimiento`) | La etiqueta sale de `DUENO_LABEL` (`app/(app)/wallet/_components/wallet-labels.ts:281`), un `Record` total que usan el libro (`WalletLedger.tsx:137`) y su descarga (`wallet-ledger-descarga-columnas.ts:75`). |
| Barra | `app/(app)/wallet/_components/BarraComposicionCaja.tsx:88-120` | Dos `Record` totales por modo, uno sin IVA y otro con IVA. **Ya tiene tres bolsillos** (Ordenex, tiendas, IVA, desde la 488). |
| CHECK tipo↔categoría vigente | `db/migrations/20261023120100_iva_por_pagar_488_checks/migration.sql` | La rama `ingreso` y la rama `egreso` son listas cerradas. |
| Enums | `db/schema.prisma:1682` (`WalletMovimientoCategoria`), `:1740` (`WalletOrigenTipo`, compartido por los tres libros) | No existen los tres valores de H3. |
| Pago contra un cierre | `LiquidacionPago.cierreId` → `liquidacion_pago.cierre_id` (`db/schema.prisma:2054`, `:2071`) | Existe. |
| Premios | `pago_mensajero_movimiento.categoria = 'premio_ranking'`, `premio_dia` (`db/schema.prisma:1962`, `:2000`) | No hay incentivos. |
| Fecha de los asientos | Los feeds no ponen `fechaMovimiento` (`CajaCodFeedService.ts:62`) → `DEFAULT now()` | Al asentar dentro de la transacción de la marca, la fecha **es** el instante de la conciliación (R13) sin hacer nada más. T1.3 lo comprueba en los cinco feeds. |
| Textos «informativa» | `docs/ayuda/oficina/wallet-satelites.md:28-32, 43-53, 94-97, 114-118`; `components/shared/conciliacion/conciliacion-labels.ts:83-90`; `components/shared/conciliacion/ConciliacionAcciones.tsx:41-51`; `app/(app)/cierres-admin/_components/CierresBodegaAdminModule.tsx:520, 851-856`; `app/(app)/wallet/satelites/_components/ConciliacionSatelite.tsx:356`; `ConciliacionSatelitesService.ts:43-44`; `CierresBodegaAdminRepository.ts:515, 654` | Todos se reescriben (R43). |
| Prefijo del diálogo | `components/shared/conciliacion/MarcarRecibidoDialog.tsx:67-70, 129-130` | Hoy prefija el `total_efectivo`. |

---

## 2 · La pregunta del leader: ¿algún camino vivo aprueba una consolidación sin conciliarla?

**No.** Se comprobó así:

- `aprobarCierreBodega` sigue exportada (`lib/actions/cierre-bodega.ts:391`, con `@sin-superficie`) y
  llama a `CierresBodegaAdminRepository.resolverCierreBodega` (`:445-493`). Esa función escribe
  `estado = 'aprobado'` **sin** `conciliado_at`, `conciliado_por` ni `monto_recibido`.
- El CHECK `cierre_bodega_conciliacion_coherente`
  (`db/migrations/20260919120100_cierre_bodega_conciliacion/migration.sql:98-104`) solo admite
  `aprobado` si las tres columnas de la marca están rellenas. Ese `UPDATE` **falla en la base**. El
  comentario de la acción cita la medición (`cierre-bodega-conciliacion.int.test.ts`, caso d).
- La única escritura viva de `aprobado` sobre `cierre_bodega` es `marcarConciliado`, que es donde esta
  ficha asienta. **Toda consolidación aprobada pasa por el asiento.**

**Lo que sí queda vivo** es `rechazarCierreBodega` (exportada y sin botón). Un rechazo deja los cierres
huérfanos: cuentan en la deuda como «sin consolidar», pero no se pueden reconsolidar ni conciliar, y su
dinero no entraría nunca a la caja. Es Q3 de `requirements.md`, **respondida por el humano el
2026-11-02: límite conocido aceptado** (no hay ninguna consolidación rechazada hoy), sin ficha. Esta
ficha no cambia ese camino.

**Test que lo fija (R8):** `498-conciliar-asienta-sql-real.test.ts` incluye el caso «`resolverCierreBodega`
con `aprobado` contra Postgres lanza la violación del CHECK y no deja filas en los tres libros». Si
alguien relaja el CHECK, el hueco se ve.

---

## 3 · Modelo de datos

Cuatro migraciones nuevas, todas en el mismo despliegue. Prefijos **posteriores a
`20261102150000`**, la última fecha que ocupan las fichas 496/497/499. T0.1 confirma el último prefijo
de `origin/dev` y, si hay uno mayor, se mueve la fecha **antes de aplicarla en ningún entorno**,
manteniendo el orden M1 < M2 < M3 < M4.

### 3.1 · M1 — `20261102160000_satelite_498_enums` (sola, R46)

Postgres no deja usar un valor de enum en la misma transacción que lo añade. Por eso va sola.

```sql
ALTER TYPE "wallet_movimiento_categoria" ADD VALUE IF NOT EXISTS 'egreso_diferencia_satelite';
ALTER TYPE "wallet_movimiento_categoria" ADD VALUE IF NOT EXISTS 'ingreso_diferencia_satelite';
ALTER TYPE "wallet_origen_tipo"          ADD VALUE IF NOT EXISTS 'conciliacion_bodega_ajuste';
```

`down.sql`: la función `pg_temp.quitar_valores_de_enum_…` de
`20261023120000_iva_por_pagar_488_enums/down.sql`, **tal cual**, renombrada `_498`, aplicada a los dos
tipos. Lee la lista **vigente** de `pg_enum` y quita solo estos valores. Nunca recrea el tipo con una
lista fija (memoria «el `down.sql` borra los valores posteriores») y aborta si alguna fila los usa
(R53).

H3 pide que este `down` «borre antes las filas que los usan». Aquí ese borrado lo hace el `down` de M2,
que se revierte **antes** (§3.2). Al llegar a M1 no queda ninguna fila, y si quedara, la reversión
aborta en vez de borrar dinero en silencio.

### 3.2 · M2 — `20261102160100_satelite_498_ajuste` (R46, R47)

```sql
CREATE TABLE "conciliacion_bodega_ajuste" (
  "id"               TEXT          NOT NULL PRIMARY KEY,
  "cierre_bodega_id" TEXT          NOT NULL,
  "evento"           TEXT          NOT NULL,
  "monto_esperado"   DECIMAL(12,2) NOT NULL,
  "monto_recibido"   DECIMAL(12,2) NOT NULL,
  "diferencia"       DECIMAL(12,2) NOT NULL,
  "creado_por"       TEXT          NOT NULL,
  "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conciliacion_bodega_ajuste_evento_check"     CHECK ("evento" IN ('marca','correccion')),
  CONSTRAINT "conciliacion_bodega_ajuste_diferencia_check" CHECK ("diferencia" <> 0),
  CONSTRAINT "conciliacion_bodega_ajuste_cierre_bodega_fkey"
    FOREIGN KEY ("cierre_bodega_id") REFERENCES "cierre_bodega"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "conciliacion_bodega_ajuste_creado_por_fkey"
    FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "conciliacion_bodega_ajuste_cierre_bodega_id_idx" ON "conciliacion_bodega_ajuste"("cierre_bodega_id");
-- Como mucho UNA fila `marca` por consolidación: defensa en la base del «reintentar no duplica».
CREATE UNIQUE INDEX "conciliacion_bodega_ajuste_marca_uq"
  ON "conciliacion_bodega_ajuste"("cierre_bodega_id") WHERE "evento" = 'marca';
ALTER TABLE "conciliacion_bodega_ajuste" ENABLE ROW LEVEL SECURITY;  -- patrón del repo: sin policies

-- CHECK tipo↔categoría de la caja: la lista VIGENTE de la 488, más un valor al final de cada rama.
ALTER TABLE "wallet_movimiento" DROP CONSTRAINT "wallet_movimiento_tipo_categoria_check";
ALTER TABLE "wallet_movimiento" ADD CONSTRAINT "wallet_movimiento_tipo_categoria_check" CHECK (
  ("tipo" = 'ingreso' AND "categoria" IN (/* …las 14 de la 488… */, 'ingreso_diferencia_satelite'))
  OR
  ("tipo" = 'egreso'  AND "categoria" IN (/* …las 15 de la 488… */, 'egreso_diferencia_satelite'))
);
```

- Los tipos de `id`, `cierre_bodega.id` y `usuario.id` (`TEXT`) se comprueban en `db/schema.prisma`
  antes de escribir la migración. Si alguno es `uuid`, se usa ese.
- `evento` es `TEXT` con CHECK, como dice H3. No es un enum de Prisma, para no añadir un tercer tipo al
  `down` de M1.
- **Append-only:** sin `updated_at` ni `deleted_at`, y el repositorio no expone ni `update` ni
  `delete` sobre esta tabla (lo comprueba la guardia de T3.9).
- Modelo Prisma `ConciliacionBodegaAjuste` con la relación inversa `CierreBodega.ajustes`.

`down.sql`, **en este orden**:

1. `DELETE FROM "wallet_movimiento" WHERE "origen_tipo" = 'conciliacion_bodega_ajuste';` Es la pérdida
   declarada de la reversión: las diferencias escritas mientras la tabla existió.
2. Volver a poner el CHECK exactamente como lo deja la 488.
3. `DROP TABLE "conciliacion_bodega_ajuste";`

### 3.3 · M3 — `20261102160200_satelite_498_retirar_asientos` (R48–R52)

Todo el archivo va entre `BEGIN; … COMMIT;`, con un único bloque `DO` para la lógica. O se aplica
entero o no se aplica.

```sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS "respaldo";
CREATE TABLE "respaldo"."asientos_satelite_498" (
  "tabla"         TEXT         NOT NULL CHECK ("tabla" IN ('wallet_movimiento','wallet_tienda_movimiento','pago_mensajero_movimiento')),
  "fila"          JSONB        NOT NULL,
  "id"            TEXT         GENERATED ALWAYS AS ("fila"->>'id') STORED,
  "respaldado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("tabla", "id")
);

DO $$
DECLARE v_pagos bigint;
BEGIN
  -- S, por PREDICADO (nunca por ids):
  CREATE TEMP TABLE s_498 ON COMMIT DROP AS
    SELECT c.id FROM cierre_dia c LEFT JOIN cierre_bodega b ON b.id = c.cierre_bodega_id
     WHERE c.destino_tipo::text = 'bodega_satelite' AND c.estado::text = 'aprobado'
       AND (c.cierre_bodega_id IS NULL OR b.conciliado_at IS NULL);

  -- Guarda (R50): si hay pagos al mensajero contra S, se aborta con el conteo.
  SELECT count(*) INTO v_pagos FROM liquidacion_pago l JOIN s_498 s ON l.cierre_id = s.id;
  IF v_pagos > 0 THEN
    RAISE EXCEPTION 'ficha 498: % pagos al mensajero registrados contra cierres de S; no se cambia nada', v_pagos;
  END IF;

  -- Respaldo íntegro (R51):
  INSERT INTO respaldo.asientos_satelite_498 (tabla, fila)
    SELECT 'wallet_movimiento', to_jsonb(w) FROM wallet_movimiento w
      JOIN s_498 s ON w.origen_id = s.id WHERE w.origen_tipo::text = 'cierre_dia';
  INSERT … 'wallet_tienda_movimiento' … (mismo predicado);
  INSERT … 'pago_mensajero_movimiento' … AND p.categoria::text <> 'premio_ranking' AND p.premio_dia IS NULL;  -- R49

  -- Borrado SOLO de lo respaldado (R51):
  DELETE FROM wallet_movimiento w USING respaldo.asientos_satelite_498 r
   WHERE r.tabla = 'wallet_movimiento' AND w.id = r.id;
  DELETE … wallet_tienda_movimiento …;
  DELETE … pago_mensajero_movimiento …;
END $$;
COMMIT;
```

- **Quedan fuera** los cierres centrales y los cierres de consolidaciones conciliadas: no están en S
  (R49).
- Si un `DELETE` choca con una FK de otra tabla, falla todo el bloque. Se comprobó que ninguna de las
  tablas que cuelgan de los libros (`ajuste_caja_anulacion`, `wallet_anotacion`, `wallet_comprobante`,
  `gasto_fijo_cobro`, `cobro_tienda_anulacion`) apunta a filas con origen `cierre_dia`. T2.5 lo
  confirma en el esquema antes de escribir la migración.
- `origen_id` es `TEXT`. Si `cierre_dia.id` resultara ser `uuid`, se compara con `s.id::text` (molde
  del inventario §4).
- **El esquema `respaldo`.** Prisma no compara esquemas fuera de `public` (el `datasource` de
  `db/schema.prisma` no declara `schemas`), así que no genera drift. Que el rol de la app no tenga
  acceso es la limitación aceptada por el humano: el respaldo es solo eso.

`down.sql` (R52):

```sql
BEGIN;
INSERT INTO wallet_movimiento
  SELECT (jsonb_populate_record(NULL::wallet_movimiento, fila)).* FROM respaldo.asientos_satelite_498
   WHERE tabla = 'wallet_movimiento' ON CONFLICT DO NOTHING;
-- … igual para wallet_tienda_movimiento y pago_mensajero_movimiento …
DROP TABLE respaldo.asientos_satelite_498;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'respaldo')
  THEN DROP SCHEMA respaldo; END IF;
END $$;
COMMIT;
```

`ON CONFLICT DO NOTHING` sin destino absorbe dos casos: la PK y el único de origen. Si un cierre ya se
volvió a asentar al conciliar, la fila restaurada choca con la nueva y se descarta, así que **no hay
doble asiento**. El esquema solo se borra si queda vacío, porque otra migración (la de H4) puede
usarlo.

### 3.4 · Orden de reversión

M4 → M3 → M2 → M1. Revertir M1 antes que M2 aborta, porque las filas siguen usando los valores. Es la
protección buscada. M4 se revierte primero porque su predicado lee la tabla de M2.

### 3.5 · M4 — `20261102160300_satelite_498_regularizar` (Q4: R54a–R54d)

**Qué decidió el humano (2026-11-02).** Las consolidaciones conciliadas antes de esta ficha se
marcaron contra el efectivo. Con la fórmula nueva su deuda incluiría el SINPE y la transferencia menos
lo de la satélite, y ese hueco no es deuda: es el SINPE o la transferencia que ya se recibió por otra
vía. Se dan por **saldadas con la regla anterior**, sin escribir en la caja ni en ningún libro, y sin
tocar `monto_recibido` (lo realmente recibido no se falsea). Su deuda queda en 0.

**Mecanismo mínimo: una columna nullable en `cierre_bodega`.**

```sql
ALTER TABLE "cierre_bodega" ADD COLUMN "esperado_regla_anterior" DECIMAL(12,2);  -- mismo tipo que monto_recibido
ALTER TABLE "cierre_bodega" ADD CONSTRAINT "cierre_bodega_esperado_regla_anterior_check"
  CHECK ("esperado_regla_anterior" IS NULL OR "conciliado_at" IS NOT NULL);

UPDATE "cierre_bodega" b
   SET "esperado_regla_anterior" = b."monto_recibido"
 WHERE b."conciliado_at" IS NOT NULL
   AND b."estado"::text <> 'rechazado'
   AND b."esperado_regla_anterior" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "conciliacion_bodega_ajuste" a WHERE a."cierre_bodega_id" = b."id");
```

- **Semántica.** `esperado_regla_anterior IS NOT NULL` = saldada con la regla anterior. Su valor es el
  **aporte reconocido** (vocabulario de `requirements.md`): sustituye al aporte en la deuda (§6), en el
  estado de cuenta (§7), en «Falta por recibir» (§5.1) y en el esperado de «Corregir» (§4.5). Como
  vale `monto_recibido`, la deuda de la consolidación es `monto_recibido − monto_recibido = 0` (R54c).
- **Por qué un decimal y no un booleano.** Con un booleano la deuda daría 0, pero «Corregir» no tendría
  esperado: tendría que usar el aporte nuevo y escribiría en la caja, de golpe, todo el hueco del SINPE
  en la primera corrección. Con el decimal, corregir una regularizada de X a X − 10 escribe una
  diferencia de 10 y nada más, que es lo que significa «llegó menos de lo que se dio por saldado».
- **El predicado (R54a)** no usa ids ni fechas escritas. «Antes del despliegue» se expresa como
  «conciliada y sin ninguna fila de ajuste». Es seguro también al **reaplicar** M4 después de que el
  código nuevo haya conciliado: una conciliación nueva con delta ≠ 0 tiene fila `marca` y queda fuera;
  una con delta = 0 y sin correcciones tiene `monto_recibido = aporte`, así que marcarla deja su
  aporte reconocido igual a su aporte y no cambia ninguna cifra. Por eso up → down → up es
  determinista (R54d).
- **No toca libros (R54b).** Es un único `UPDATE` sobre una columna nueva. Ni `monto_recibido`, ni
  `updated_at` a mano (el `@updatedAt` de Prisma no actúa en SQL), ni ninguna otra tabla.
- **Corre después de M2** (su predicado lee la tabla de ajustes) y en el mismo `migrate deploy` del
  build: no hay ventana en la que el código nuevo concilie antes de M4.
- Prisma: `esperadoReglaAnterior Decimal? @map("esperado_regla_anterior") @db.Decimal(12, 2)` en
  `CierreBodega`, con comentario que cite la ficha y la decisión del humano. Ningún camino de la app
  escribe esta columna: solo la migración (lo comprueba la guardia de §11).

`down.sql`:

```sql
ALTER TABLE "cierre_bodega" DROP CONSTRAINT "cierre_bodega_esperado_regla_anterior_check";
ALTER TABLE "cierre_bodega" DROP COLUMN "esperado_regla_anterior";
```

Pérdida declarada del `down`: la marca. Ningún otro dato depende de ella.

**Medición previa en producción, con puerta (T8.4).** Solo lectura, la corre el leader con el MCP de
producción o el humano, y **sus cifras no se escriben en el repositorio**: se dicen en el chat. Cuenta:
(a) consolidaciones que cumplen el predicado (sin la tabla de ajustes, que en producción aún no
existe: conciliadas y no rechazadas) y la Σ de su `monto_recibido`; (b) cuántas de ellas tienen hueco
entre aporte y recibido; (c) consolidaciones rechazadas; (d) consolidaciones conciliadas con
`monto_recibido` nulo. **Puerta:** (c) y (d) deben ser 0 (el CHECK de la 431 ya impide (d)); si (c) no
es 0, la decisión Q3 se revisa con el humano antes de desplegar. (a) se guarda para la verificación
posterior (T8.3): el número de regularizadas y la Σ de su `monto_recibido` y de su
`esperado_regla_anterior` deben coincidir con (a), salvo las conciliadas entre la medición y el
despliegue, que se cuentan aparte por `conciliado_at`; y la deuda de cada regularizada debe ser 0.

---

## 4 · Repositorio

### 4.1 · `asentarCierreDia` — `lib/repositories/asentar-cierre-dia.ts` (nuevo, R5–R7)

```ts
export interface DependenciasAsiento {
  walletMovimientoRepo: IWalletMovimientoRepository;
  walletFeedService: IWalletFeedService;
  walletTiendaMovimientoRepo: IWalletTiendaMovimientoRepository;
  walletTiendaFeedService: IWalletTiendaFeedService;
  pagoMensajeroMovimientoRepo: IPagoMensajeroMovimientoRepository;
  walletMensajeroFeedService: IWalletMensajeroFeedService;
  walletIndemnizacionFeedService: IWalletIndemnizacionFeedService;
  cajaCodFeed: ICajaCodFeedService;
}

/** Las implementaciones REALES. Un llamador que no inyecta no queda mudo (R6). */
export function dependenciasRealesDeAsiento(prisma: …): DependenciasAsiento;

/**
 * Los cinco escritores de dinero de la aprobación, SIN CAMBIOS y EN EL MISMO ORDEN (R5).
 * Idempotente por los únicos de origen de los tres libros.
 */
export async function asentarCierreDia(tx: Prisma.TransactionClient, cierreId: string, deps: DependenciasAsiento): Promise<void>;
```

- Su cuerpo es **un movimiento literal** de `CierresAdminRepository.ts:1871-1933`, con `this.` → `deps.`
  y `CAJA_COD_FEED` → `deps.cajaCodFeed`. Se conservan los comentarios de orden (el COD lee lo que
  acaba de escribir el libro por tienda) y la condición `acreditoCod`.
- **No** incluye la captura de la indemnización (`:1859-1869`). Esa captura no es dinero y sigue en la
  aprobación (R2). Cuando un cierre satélite se asienta al conciliar, el feed de indemnización lee el
  monto que la aprobación dejó persistido.
- La firma recibe `deps` obligatorio. El valor por defecto lo pone **quien construye** el repositorio
  (§4.2 y §4.3), para que la función siga siendo pura respecto a su entrada.

### 4.2 · Aprobación — `CierresAdminRepository.resolverCierre` (R1–R4)

El constructor sigue recibiendo las siete dependencias de hoy, en el mismo orden. Así
`lib/actions/cierres-admin.ts` y las ~25 suites que lo construyen no cambian. Por dentro compone
`this.depsAsiento = { …las siete…, cajaCodFeed: new CajaCodFeedService() }`.

```ts
// dentro de `if (res.count === 1 && nuevoEstado === "aprobado")`, tras el bloque de indemnizaciones:
const { destinoTipo } = await tx.cierreDia.findUniqueOrThrow({
  where: { id: cierreId },
  select: { destinoTipo: true },
});
switch (destinoTipo) {
  case "bodega_central":
    await asentarCierreDia(tx, cierreId, this.depsAsiento); // R3: mismas filas, mismo orden
    break;
  case "bodega_satelite":
    break; // FICHA 498 (R1): el dinero espera a la conciliación
  default: {
    const _exhaustivo: never = destinoTipo;
    throw new DestinoDeCierreDesconocidoError(cierreId); // R4: nunca una rama por defecto
  }
}
// … liberación, devoluciones, aplicación de gestiones, marca 238/497, historial: SIN CAMBIOS (R2)
```

- **R4, a propósito:** el destino se lee **dentro** de la transacción, después de la transición. No se
  usa el `alcance` del actor, que no es el destino del cierre.
- `DestinoDeCierreDesconocidoError`: el mensaje solo lleva el id del cierre (patrón
  `IndemnizacionNoAplicableError`). En runtime cubre el caso de un doble de test que no traiga
  `destinoTipo`: falla con nombre en vez de saltarse el dinero en silencio.
- **Encaje con la 497:** su marca de barridas vive en el bloque de la 238, **después** de este. Esta
  ficha no toca ese bloque y la 497 no toca este. Si la 497 no ha mergeado cuando se implemente esta,
  T0.1 lo detecta y se espera (`depends_on: 497`).

### 4.3 · `CierresBodegaAdminRepository` — dependencias por defecto (R6)

```ts
constructor(
  private readonly prisma: CierresBodegaAdminPrismaClient,
  private readonly depsAsiento: DependenciasAsiento = dependenciasRealesDeAsiento(prisma),
) {}
```

Los dos composition roots (`conciliacion-satelites.ts:60`, `cierre-bodega.ts:81`) **no cambian**:
construyen con `prisma` y reciben las dependencias reales. El tipo `CierresBodegaAdminPrismaClient`
(`:60-71`) amplía su `Pick` con lo que el asiento y la diferencia necesitan (`walletMovimiento`,
`walletTiendaMovimiento`, `pagoMensajeroMovimiento`, `conciliacionBodegaAjuste`, …), o se tipa el `tx`
como `Prisma.TransactionClient`, lo que compile sin `any`.

### 4.4 · Marcar recibida (R8–R15)

Dentro de la `$transaction` de hoy, **después** del `updateMany` guardado (`count !== 1 → null`, así R15
sale del guard existente) y **antes** del `appendAccion`:

```ts
const cierres = await tx.cierreDia.findMany({
  where: { cierreBodegaId: id, estado: "aprobado", destinoTipo: "bodega_satelite" },
  select: { id: true },
  orderBy: [{ solicitadoAt: "asc" }, { id: "asc" }],
});
for (const c of cierres) await asentarCierreDia(tx, c.id, this.depsAsiento); // R8
await this.escribirDiferencia(tx, { cierreBodegaId: id, evento: "marca", recibido: monto, actor: actorUsuarioId });
```

`escribirDiferencia` es un método privado que comparten marcar y corregir:

1. Lee el snapshot de la consolidación (`totalGeneral`, `totalPagoMensajero`,
   `totalIngresoBodegaRechazos`) y `esperadoReglaAnterior`.
2. `esperado = aporteDeConsolidacion(row)` (§5.1): el aporte reconocido. Al marcar,
   `esperadoReglaAnterior` es siempre nulo (solo lo tienen consolidaciones ya conciliadas), así que
   da `paraLaCentral(…)`, la misma función que «Para la central» (R9). Al corregir una regularizada da
   el valor de la regularización (R17).
3. `asentada = Σ diferencia` de `conciliacion_bodega_ajuste` de esa consolidación, leída en `tx`.
4. `delta = esperado − recibido − asentada`, con `Prisma.Decimal`.
5. Si `delta` es cero, termina (R11, R18).
6. Si no, crea la fila de ajuste (`evento`, `montoEsperado`, `montoRecibido`, `diferencia = delta`,
   `creadoPor`).
7. Escribe **un** movimiento con `deps.walletMovimientoRepo.crearMovimientos(tx, [mov])`: `tipo`
   `egreso` / `categoria` `egreso_diferencia_satelite` / `monto = delta` si `delta > 0`; `ingreso` /
   `ingreso_diferencia_satelite` / `monto = |delta|` si `delta < 0`. `origenTipo` es
   `conciliacion_bodega_ajuste` y `origenId` es el id de la fila de ajuste. Sin `fechaMovimiento`, así
   que toma el instante de la transacción (R13).

- **R12:** una sola fila de diferencia. Los cierres se asientan completos.
- **R14:** cualquier fallo (feed, CHECK, único) sale por la `$transaction` y revierte la marca, los
  asientos y el ajuste.
- **Reintento:** si la transacción se aplicó, un segundo intento ve `conciliado_at` puesto y responde
  `conflict` (R15). Si se revirtió, el reintento empieza de cero. El único parcial de M2 es la red en la
  base.

### 4.4 bis · Recibido 0 (Q5: R15a, R15b)

**Borde.** `marcarConsolidacionRecibidaSchema` (`lib/types/conciliacion-satelites.ts:254-260`), que
comparten marcar y corregir (`lib/actions/conciliacion-satelites.ts:185, 205`), pasa de
`montoPositivoSchema` a `z.union([montoPositivoSchema, montoCeroSchema])`, donde `montoCeroSchema`
admite solo el cero escrito como `"0"`, `"0.0"` o `"0.00"`. **`montoPositivoSchema` no se toca**: lo
usan otros consumidores (liquidación, gastos fijos, efectos, cierres admin) que no deben aceptar 0. El
comentario de `:246-250` («si el humano quiere admitir 0, se cambia la pieza compartida») se reescribe:
el humano admitió el 0 **solo** en la conciliación y **solo** con aporte ≤ 0, que es una regla de dato,
no de formato; por eso el borde admite el cero literal y la decisión vive en el repositorio. El
negativo y los tres decimales siguen muriendo en el borde (R15b).

**Repositorio.** En `marcarConciliado` y en `corregirConciliacion`, dentro de la `$transaction` y
**antes** del `updateMany` guardado: si `monto` es cero, se lee la consolidación y se calcula
`aporteDeConsolidacion(row)`; si es positivo, la transacción termina con el desenlace
`"recibido_cero_con_aporte"` sin escribir nada (ni marca, ni historial, ni libros). Si es cero o
negativo, sigue el camino normal: con aporte 0 el delta da 0 (R11); con aporte negativo el delta es
negativo y se escribe el ingreso de diferencia por su valor absoluto (R10), igual que con cualquier
otro recibido.

- Tipos: `MarcaConciliacionResult` gana `"recibido_cero_con_aporte"`; el servicio y las acciones lo
  propagan como `{ status: "recibido_cero_con_aporte" }`. El control de rol del servicio sigue antes
  (R45).
- Texto en pantalla, en `conciliacion-labels.ts`: «Esta consolidación tiene dinero por entregar: el
  monto recibido no puede ser 0.»
- **Por qué en el repositorio y no en el servicio:** el aporte se lee del snapshot dentro de la misma
  transacción que la marca, como el esperado de §4.4. Leerlo fuera sería un segundo camino que lee la
  fila.

### 4.5 · Corregir (R17–R19)

Después del compare-and-swap de hoy (`count !== 1 → null`) y antes del `appendAccion`:
`escribirDiferencia(tx, { evento: "correccion", recibido: monto, … })`. **No** llama a
`asentarCierreDia`. Como `asentada` incluye la marca y las correcciones previas, la fila nueva lleva
solo la variación. No modifica ni borra nada (R19). El CAS existente serializa dos correcciones
concurrentes.

### 4.6 · Revertir (R20–R22)

Dentro de la `$transaction`, **antes** del `updateMany`:

```ts
if (await this.tieneAsientos(tx, id)) return "con_asientos";
```

`tieneAsientos` comprueba si existe alguna fila de `conciliacion_bodega_ajuste` de la consolidación, o
alguna fila de los tres libros con `origenTipo = 'cierre_dia'` y `origenId` igual a uno de sus cierres.

- El desenlace sale de la transacción sin escribir nada: ni marca, ni historial.
- Tipos: `RevertirConciliacionResult = MarcaConciliacionResult | "con_asientos"` en
  `ICierresBodegaAdminRepository`, y `{ status: "con_asientos" }` en el resultado del servicio y de
  `revertirConciliacionAction`.
- Las consolidaciones conciliadas **antes** de esta ficha tienen asientos de la aprobación antigua, así
  que tampoco se pueden revertir. Quedan saldadas con la regla anterior por M4 (§3.5) y, si su monto
  no era el correcto, se corrigen con «Corregir» contra su aporte reconocido.

### 4.7 · Contratos y comentarios que mienten

Se reescriben los comentarios «NO ESCRIBE EN NINGUN LIBRO DE DINERO» (`CierresBodegaAdminRepository.ts:515,
654`; `ConciliacionSatelitesService.ts:43-44`; y los JSDoc equivalentes de
`ICierresBodegaAdminRepository` y `IConciliacionSatelitesService`, si los hay). El texto nuevo dice qué
escribe y por qué ya no es reversible (R43).

---

## 5 · Una sola fórmula (R26, R28, R32)

### 5.1 · TypeScript — `lib/utils/conciliacion-satelite.ts`

- `saldoDe(efectivo, recibido)` **se retira**. La sustituye
  `faltaPorRecibir(aporte: Prisma.Decimal, recibido: Prisma.Decimal | null) = aporte − (recibido ?? 0)`.
- `aporteDeConsolidacion(row)` = el **aporte reconocido**: `row.esperadoReglaAnterior` si no es nulo
  (§3.5); si no, `new Prisma.Decimal(paraLaCentral(totalGeneral, totalPagoMensajero,
  totalIngresoBodegaRechazos))`. Delega en `paraLaCentral` y no copia la resta. Es la única función
  que lee `esperadoReglaAnterior` en TypeScript.
- `deudaDeZona(aportes, recibido) = aportes − recibido`. La usan Saldos y el Estado de cuenta.
- Consumidores que cambian: `SaldosSatelitesRepository` (cuatro usos), `CierreBodegaRepository.ts:136`
  (`faltaPorRecibir` de la cabecera: así R27 sale por construcción) y `EstadoCuentaService.ts:415`.

### 5.2 · SQL — `lib/repositories/deuda-satelite-sql.ts` (nuevo)

```ts
/** El aporte de un cierre, en SQL. Equivale a `paraLaCentral` (lo mide T4.1 contra Postgres). */
export const aporteCierreSql = (c: string) => Prisma.raw(`(${c}.total_general - ${c}.total_pago_mensajero - ${c}.total_ingreso_bodega_rechazos)`);
/** «Cuenta en la deuda» (R23). */
export const cuentaEnLaDeudaSql = (c: string) => Prisma.raw(`(${c}.estado::text = 'aprobado' AND ${c}.destino_tipo::text = 'bodega_satelite')`);
/** «Sin consolidar» (R24/R30): sin consolidación o con la consolidación rechazada. Requiere LEFT JOIN cierre_bodega. */
export const sinConsolidarSql = (c: string, cb: string) => Prisma.raw(`(${c}.cierre_bodega_id IS NULL OR ${cb}.estado::text = 'rechazado')`);
/** «Saldada con la regla anterior» (Q4, §3.5). */
export const saldadaReglaAnteriorSql = (cb: string) => Prisma.raw(`(${cb}.esperado_regla_anterior IS NOT NULL)`);
```

El aporte reconocido en SQL no es una tercera expresión: es `cb.esperado_regla_anterior` para las
saldadas y `Σ aporteCierreSql` de sus cierres para las demás. Las consultas de §6 y §7 lo componen con
estas cuatro piezas.

- Los alias son constantes del propio código, nunca entrada de usuario. Por eso se usa `Prisma.raw`.
- **R28:** la expresión SQL es la gemela declarada de `paraLaCentral`. Una prueba contra Postgres
  compara las dos con casos de signo positivo, cero y negativo, y una guardia prohíbe una tercera copia
  de la resta en `lib/` (§11).

---

## 6 · Saldos de satélites (R23–R25, R42)

`SaldosSatelitesRepository` gana `$queryRaw` en su `Pick`. `componerSaldos` sustituye el `groupBy` del
dinero por dos agregaciones:

1. **Aportes por zona**, sobre `cierre_dia c LEFT JOIN cierre_bodega cb ON cb.id = c.cierre_bodega_id`,
   filtrando con `cuentaEnLaDeudaSql('c')`, `NOT COALESCE(saldadaReglaAnteriorSql('cb'), false)` y
   `c.destino_zona_id = ANY(zonas)`. Por zona saca Σ`aporteCierreSql('c')`, Σ del aporte con
   `FILTER (WHERE sinConsolidarSql)` y el conteo de cierres con ese mismo `FILTER`.
2. **Recibido y aporte reconocido de las saldadas por zona**: sobre las consolidaciones no rechazadas,
   Σ`monto_recibido` y Σ`esperado_regla_anterior` (este último solo suma las saldadas; las demás son
   nulas). Es el `groupBy` de hoy con `montoRecibido` y `esperadoReglaAnterior`.

`deuda = deudaDeZona(aportes + Σ esperado_regla_anterior, recibido)` (R23). Una saldada aporta
`monto_recibido` por los dos lados y suma 0 (R54c). Sus cierres nunca son «sin consolidar» (están en
una consolidación no rechazada), así que la columna «Sin consolidar» no cambia por M4. La cola, la antigüedad y la última recibida no cambian de
población. La última recibida pasa a `declarado = aporte` y `faltaPorRecibir` (§5.1).

**DTO** (`lib/types/conciliacion-satelites.ts`):

- `SaldoSateliteDTO.saldoSinConciliar` conserva el nombre y pasa a significar la deuda (su JSDoc se
  reescribe).
- Gana `sinConsolidar: string` y `cierresSinConsolidar: number`.
- `ConsolidacionSateliteDTO` gana `totalPagoMensajero`, `totalIngresoBodegaRechazos` y `paraLaCentral`,
  todos `string` (R41); `debe: string` (el aporte reconocido), `debePositivo: boolean` (§8.4) y
  `saldadaReglaAnterior: boolean` (R41a). Su `faltaPorRecibir` pasa a la fórmula nueva.

**Cabecera** (`findResumen`): `pendienteTotal` = Σ de las deudas por zona, calculadas con **las mismas
dos agregaciones** sobre todas las zonas satélite (R25). `bodegasConPendiente` sale de ese mismo mapa.
`diferenciaTotal` y `consolidacionesConDiferencia` usan `faltaPorRecibir` por consolidación conciliada.
La descarga (`findSaldosCompleto`) y la página comparten `componerSaldos`, así que salen de la misma
fórmula.

---

## 7 · Estado de cuenta de la bodega (R29–R31)

`EstadoCuentaRepository`:

- **`paginaDeBodega`**: el CTE `mov` pasa a tener tres ramas.
  1. **Declarado por consolidación**: el `monto` es su aporte reconocido:
     `COALESCE(cb.esperado_regla_anterior, Σ aporteCierreSql('c'))` sobre sus cierres que cuentan en
     la deuda, agrupados por `cb.id`, sobre las consolidaciones no rechazadas (R29). La fecha es
     `cb.solicitado_at`. En una saldada, declarado = recibido y la fila no mueve el corrido (R54c).
  2. **Recibido**: igual que hoy.
  3. **Cierre sin consolidar**: una fila por cierre con `cuentaEnLaDeudaSql AND sinConsolidarSql`.
     `tipo` y `categoria` son `'declarado'`, `origen_tipo` es `'cierre_dia'`, `origen_id` es `c.id` y
     `monto` es su aporte. La fecha es `c.resuelto_at`, el instante de aprobación, que es desde cuando
     cuenta en la deuda. El rótulo «Cierre del día sin consolidar» sale del `origen_tipo`, en las
     etiquetas del estado de cuenta.
- **`totalesDeBodega`** devuelve `{ declarado, recibido }` en vez de `{ efectivo, recibido }`, con los
  mismos tres predicados y el corte `antesDe` sobre la fecha de cada rama.
- **`periodoDeBodega`**: las mismas tres ramas, recortadas al periodo.
- `EstadoCuentaService.ts:415` pasa a `deudaDeZona(declarado, recibido)`.

Así, sin filtros, el pendiente final = Σ aportes de los cierres que cuentan − Σ recibido = la deuda de
la zona (R31). Un cierre está una sola vez: en su consolidación no rechazada o como fila suelta.

**Consecuencia declarada:** el extracto es una **derivación**, no un libro. Cuando un cierre sin
consolidar se consolida, su fila suelta desaparece y su aporte pasa al declarado de la consolidación
(con otra fecha). El pendiente final no cambia. La forma del histórico sí.

---

## 8 · La caja de la central

### 8.1 · Clasificación (R33–R36)

- `lib/types/wallet.ts:294`:
  `NaturalezaMovimiento = "propio" | "terceros" | "capital" | "iva" | "por_cobrar_satelite"`.
- Los seeds de categoría y de origen (`WALLET_MOVIMIENTO_CATEGORIA_SEED`, `WALLET_ORIGEN_TIPO_SEED`)
  ganan los tres valores. Sus `_Ensure…Exhaustive` lo exigen.
- `NATURALEZA_POR_CATEGORIA`: las dos categorías nuevas van a `"por_cobrar_satelite"`.
  `LIQUIDEZ_POR_CATEGORIA`: las dos van a `"efectivo"`.
- `acumular` sustituye las cadenas `if / else if` por un `switch (dueno)` con un `case` por dueño y
  `default: { const _n: never = dueno; … }`, en la rama de ingreso y en la de egreso (R34). El
  `Acumulado` gana `ingresosPorCobrar` y `egresosPorCobrar`.
- `derivarCaja` deriva el bolsillo con `derivarBalance(acc.egresosPorCobrar, acc.ingresosPorCobrar)`.
  El orden de los argumentos va invertido a propósito: el bolsillo **sube** con el egreso (llegó
  menos) y **baja** con el ingreso (pagó o llegó de más). Es la séptima llamada a `derivarBalance`.
- **Identidad (R35), por construcción:** las cinco particiones por dueño cubren todas las categorías y
  las diferencias son efectivo. Entonces `Entró − Salió = (G + C) + T + I + (ingP − egP) = deOrdenex +
  T + I − P`.
- **R36:** las diferencias no son `terceros` ni escriben en el libro por tienda, así que «De las
  tiendas» y Σ saldos de las tiendas no cambian con ellas.
- `CajaResumenDTO` gana `porCobrarSatelites: string`, `signoPorCobrarSatelites` y
  `porcentajePorCobrar: string`.

### 8.2 · La barra (R38, R39)

**Aquí hay un bolsillo más que en el origen.** H3 habla de un «tercer tramo» porque allí la barra
tenía dos. Aquí la 488 ya añadió el IVA, así que «Por cobrar a satélites» es el **cuarto**. La regla es
la misma: es un tramo propio y no se descuenta de la empresa.

- `derivarReparto(deOrdenex, deTerceros, ivaPorPagar, porCobrar)`: `positivos` (S) suma también
  `porCobrar` si es > 0. Se añade `porcentajePorCobrar = porcion(porCobrar, S)`. El **modo** se sigue
  derivando solo de G y T. Si `porCobrar ≤ 0`, S y las porciones son idénticas a las de hoy (R39).
  `deOrdenex` no cambia, así que el tramo de la empresa no se descuenta (R38). Sin división por cero:
  `porcion` ya devuelve `"0.00"` si el bolsillo no es positivo, y S > 0 siempre que algún bolsillo lo
  sea.
- `BarraComposicionCaja.tsx`: si `signoPorCobrarSatelites` es positivo, la lista de segmentos es la que
  correspondería sin el bolsillo, con un segmento `por_cobrar` (`medida: "porcentaje"`, `campo:
  "porcentajePorCobrar"`) insertado **antes del último**. El último sigue ocupando el resto. Si la
  lista era un único segmento `todo`, pasa a ser `[por_cobrar(porcentaje), ese segmento(resto)]`. En
  `sin_reparto` sin IVA, el único segmento es `por_cobrar(todo)`. Se escribe como `Record` total por
  modo, igual que los dos que ya hay, para que un modo nuevo no compile sin decidir su forma.
- El color sale de un token propio de `chart-*`, distinto de los tres que ya se usan, con contraste
  ≥ 3:1 en los dos temas (molde `COLOR_IVA_POR_PAGAR`). Lo elige el frontend y lo mide su test.

### 8.3 · Pantalla de caja (R37, R40)

- `CajaResumenCard.tsx` muestra el bloque «Por cobrar a satélites» **siempre**, también con `0,00`. La
  pista sale de `signoPorCobrarSatelites`:
  - positivo: «Lo que las satélites entregaron de menos al conciliar y aún no han pagado.»;
  - negativo: «La central les debe a las satélites.»;
  - cero: sin pista. H3 solo fija las otras dos. Sin pista es lo que hace hoy el bloque de IVA en cero.
- `DUENO_LABEL.por_cobrar_satelite = "Satélite"` y `DUENO_PUNTO` con el mismo token de la barra. Como
  son `Record` totales, el libro y la descarga lo rotulan sin más cambios (R40).
- Las etiquetas de categoría son «Diferencia de la satélite» para las dos (el tipo ya dice si entra o
  sale). La etiqueta del origen `conciliacion_bodega_ajuste` es «Conciliación de satélite», en el
  `Record` de orígenes si existe.
- Las dos categorías **no** entran en los conceptos que una persona registra a mano
  (`wallet-conceptos-manuales.ts`): solo las escribe la conciliación.

### 8.4 · El diálogo de marcar y el de corregir (R16, R16a, R16b)

`MarcarRecibidoDialog` recibe `debe` (el aporte reconocido de la consolidación, `string` del servidor)
en vez de `declarado = total_efectivo`. Si `debePositivo`, prefija el campo con `debe`. Si no, lo
prefija con `0` (Q5 respondida: el 0 se admite justo en ese caso) y la banda «Debe» muestra el aporte
tal cual. La comparación «es positivo» la decide el servidor con el booleano del DTO, no el navegador.

**Lo recibido es un total, y el diálogo lo dice (respuesta del humano sobre el SINPE).** La central
recibe de la satélite lo que la satélite tiene, y **confirma** lo que se consignó directo a su cuenta.
Las dos cosas son lo recibido. El diálogo de marcar y el de corregir (si el de corregir es otra pieza,
las dos) muestran, encima del campo:

- lo recaudado por método: efectivo, SINPE y transferencia, con los importes del DTO (los mismos de
  R41);
- el texto literal de R16a: «Escribe todo lo que recibió la central por esta consolidación: lo que
  entregó la satélite más el SINPE o la transferencia que llegó directo a la cuenta de la central.»

**Decisión: un solo monto, sin desglose de entrada por método (R16b).** Basta con un monto total y el
texto, por tres razones medibles en el diseño:

1. El delta (§4.4) y la deuda (§6) solo usan el total recibido. Un desglose no cambia ninguna escritura
   ni ninguna cifra.
2. La caja no tiene hoy un bolsillo por cuenta ni por método donde escribir el desglose: guardarlo
   exigiría columnas nuevas (`recibido_efectivo`, `recibido_sinpe`, `recibido_transferencia`) en
   `cierre_bodega` y en la tabla de ajustes, más su CHECK de suma, sin ningún lector.
3. El humano dijo «no importa a cuál cuenta sea». La información que importa (cuánto había por cada
   método) ya se muestra al lado del campo.

Ver la alternativa descartada I (§12).

---

## 9 · Pantallas de la conciliación (R21, R41, R42)

No son pantallas nuevas: cambian el cuerpo de pantallas que ya existen. No pasan por `/design`.

- **`app/(app)/wallet/satelites/_components/ConciliacionSatelite.tsx`**: cada consolidación muestra tres
  bloques, todos con importes del DTO pintados tal cual:
  1. Recaudado: efectivo, SINPE, transferencia y total.
  2. De la satélite: pago a sus mensajeros y su ganancia por rechazos.
  3. Debe, Recibido y Falta. «Debe» es el aporte reconocido.
  Si `saldadaReglaAnterior`, la consolidación lleva el rótulo «Saldada con la regla anterior» (R41a).
  Si una acción responde `recibido_cero_con_aporte`, se muestra el texto de §4.4 bis y no cambia nada.
- **`SaldosSatelitesTable.tsx`** y su descarga: columna «Sin consolidar» con el importe y, debajo,
  «N cierres».
- **`ConciliacionAcciones.tsx`**: si la acción de revertir responde `con_asientos`, aparece el aviso
  «Ya entró a la caja: corrige el monto en vez de revertir» (R21) y la marca queda tal cual. El diálogo
  de confirmación de «Desmarcar» pierde su texto «ninguna mueve un colón».
- **`conciliacion-labels.ts`**: `DESMARCAR_NO_MUEVE_DINERO_*` se sustituye por la nota literal de R43.
  Se pinta donde hoy se pinta la nota (`ConciliacionSatelite.tsx:356`).
- **`CierresBodegaAdminModule.tsx:851-856`** y el comentario de `:520` se reescriben. La tarjeta de
  `cierre-factura.tsx` (`:632-641`) no cambia de código: su `faltaPorRecibir` ya llega con la fórmula
  nueva (R27).

## 10 · La ayuda de usuario (R44)

- **`docs/ayuda/oficina/wallet-satelites.md`**:
  - Se retira el aviso «El saldo NO es un movimiento de caja… Ya está contado» (`:28-32`): hoy es
    falso.
  - Se retira «Por qué la cifra es solo el EFECTIVO» (`:43-53`), **con sus cifras de producción**, que
    no deben vivir en el repositorio.
  - Se reescriben «Marcar que llegó»: el monto propuesto es lo que debe, el monto es el **total** que
    llegó a la central (también el SINPE o la transferencia consignados directo a ella), el 0 solo se
    admite si no hay nada que entregar, y marcar asienta en la caja.
  - Se explica «Saldada con la regla anterior»: conciliadas antes del cambio, dadas por saldadas tal
    como se marcaron, sin tocar lo recibido.
  - «Desmarcar no mueve dinero» pasa a «Una vez marcada, se corrige», con la nota literal y el aviso
    `con_asientos`.
  - Se reescribe «Lo que esta pantalla NO hace».
  - Se añaden la columna «Sin consolidar» y las filas «Cierre del día sin consolidar» del extracto.
  - Se actualizan `actualizado` y `fuentes`, que pasan a incluir `lib/utils/ingreso-ordenex.ts` y
    `lib/repositories/deuda-satelite-sql.ts`.
- **`docs/ayuda/oficina/wallet-caja.md`**: el bloque «Por cobrar a satélites», sus dos pistas, el dueño
  «Satélite» en el libro y que el dinero de los cierres satélite entra al conciliar.
- Se corren las guardias de ayuda (`ayuda-*.guardia.test.ts`, `marca-fuente-unica-493`,
  `nombres-wallet-461`).

---

## 11 · Guardias y suites existentes afectadas

| Archivo | Efecto | Acción |
| --- | --- | --- |
| `tests/unit/guards/aprobacion-escrituras-cubiertas.guardia.test.ts` | `ESCRITURAS_POR_REPO_INYECTADO` busca `this.walletMovimientoRepo.crearMovimientos` y otras en `CierresAdminRepository.ts`. Con la extracción ya no están ahí. | Las tres entradas pasan a buscarse en `lib/repositories/asentar-cierre-dia.ts` (`deps.…`), con sus mismas suites. Caso nuevo: `CierresAdminRepository.ts` llama a `asentarCierreDia` dentro de la rama `bodega_central`. Autocomprobación: la guardia se pone roja si se borra esa llamada. La 497 edita otro bloque del archivo (`ESCRITURAS_DE_LA_APROBACION`). |
| La guardia que cuenta las llamadas a `derivarBalance` en `caja-tesoreria.ts` (el comentario de `:277` la nombra `caja-derivaciones.guardia.test.ts`; T5.1 la localiza) | Pasan de seis llamadas a siete. | Se actualiza el número con el motivo, en la misma línea. |
| `tests/unit/guards/caja-clasificacion-459.guardia.test.ts` | Las diferencias son `efectivo` y no son `propio`. | Debe seguir verde sin cambios. |
| `tests/unit/guards/caja-composicion-exhaustiva.guardia.test.ts` | La composición solo mira `propio`. | Debe seguir verde sin cambios. |
| `tests/unit/guards/wallet-barra-unica-467.guardia.test.ts` | La barra. | Debe seguir verde. Si censa segmentos, el cambio es aditivo. |
| `tests/integration/db/marca-conciliacion.int.test.ts:336` («R14: marcar y revertir NO escriben en NINGUN libro») | **Contradice la regla nueva**, revocada por el humano el 2026-11-02. | Se **sustituye** por su inverso: con cierres, marcar sí escribe en los tres libros; revertir con asientos no cambia nada. No se borra sin red. |
| `tests/integration/db/corregir-conciliacion.int.test.ts:304` («R12: corregir no escribe…») | Igual. | Se sustituye: corregir escribe solo la diferencia por la variación y ningún asiento de cierre. |
| Suites de `resolverCierre` con dobles (`cierres-admin-caja-cod.test.ts`, `cierres-admin-repository.test.ts`, `cierres-admin-indemnizacion.test.ts`, …) | Su `cierreDia.findUnique` no devuelve `destinoTipo`, y la aprobación lanzaría `DestinoDeCierreDesconocidoError`. | Cambio **solo de fixture**: el doble devuelve `destinoTipo: "bodega_central"`. **Ninguna aserción cambia.** Una aserción que haya que tocar es una regresión. |
| `tests/unit/utils/caja-tesoreria.test.ts`, `tests/unit/repositories/cierres-bodega-admin-marca.test.ts`, `tests/unit/services/conciliacion-satelites-service.test.ts`, suites de Saldos y del Estado de cuenta | Fórmula y desenlaces nuevos. | Se extienden (§14). |

**Guardia nueva**, `tests/unit/guards/aporte-satelite-fuente-unica-498.guardia.test.ts`:

- en `lib/`, la resta `total_general - total_pago_mensajero` (en SQL) solo puede aparecer en
  `deuda-satelite-sql.ts`;
- `saldoDe(` no aparece en ningún archivo de `lib/` ni de `app/`;
- el repositorio no escribe `conciliacionBodegaAjuste.update`, `.updateMany`, `.delete` ni
  `.deleteMany`;
- `esperadoReglaAnterior` / `esperado_regla_anterior` solo se lee en `conciliacion-satelite.ts`
  (`aporteDeConsolidacion`), en `deuda-satelite-sql.ts` y en las consultas de Saldos y del Estado de
  cuenta, y ningún archivo de `lib/` ni de `app/` lo escribe (solo M4);
- `marcarConsolidacionRecibidaSchema` no usa un esquema de monto que admita negativos.

Lleva autocomprobación. Estas guardias leen archivos con `fs` y el grafo no las relaciona con el diff:
se corren **a mano**.

---

## 12 · Alternativas descartadas

**A · Asentar al aprobar y escribir un contra-asiento al conciliar.** Así no se tocaría la
transacción de aprobación. Pero la caja enseñaría dinero que no ha llegado durante días, que es el
defecto, y doblaría las filas. Contradice la regla decidida «Nada entra al aprobar».

**B · Un parámetro `destino` en `ResolverCierreInput`, decidido por el servicio.** El servicio no ve la
fila bajo la transacción, y H3 pide leer el destino dentro de ella. Además añadiría un campo
obligatorio a un contrato que la 497 cuidó de no cambiar (su §5.4). Se descarta: el destino ya está en
la fila.

**C · Inyectar `DependenciasAsiento` en el composition root de la conciliación, sin valor por
defecto.** Es la forma «limpia» de inyección, pero es justo el fallo de la memoria «el composition root
que no inyecta»: un tercer constructor que olvide pasarlas dejaría la marca muda con la suite verde. H3
exige las reales por defecto. El test de composition root mira las **filas**, no el import.

**D · Guardar la diferencia en columnas de `cierre_bodega` (`diferencia_asentada`).** No admite el
historial de correcciones como movimientos separados. Además el único `(origen_tipo, origen_id,
categoria)` de la caja impide dos diferencias con origen en la misma consolidación. H3 trae la tabla de
ajustes justo por eso.

**E · Dejar la deuda sobre el efectivo (decisión Q2 del 2026-09-16).** Revocada por el humano el
2026-11-02.

**F · Calcular la deuda en TypeScript, leyendo todas las filas de `cierre_dia`.** Así no habría
gemelo SQL. Pero el estado de cuenta calcula el corrido con una ventana en SQL y necesita la expresión
en SQL de todas formas. Con dos lenguajes, se declara **una** expresión por lenguaje, en un sitio cada
una, y se mide su equivalencia (R28).

**G · Recrear los enums con lista fija en el `down` de M1.** Es lo que sugiere el texto de H3. Aquí
borraría en silencio los valores que otra rama añada después. Se usa la función de la 488, que lee la
lista vigente.

**H · Regularizar lo conciliado antes de la ficha escribiendo diferencias en la caja, o pidiendo
«Corregir» una a una (la propuesta original de Q4).** Lo primero escribiría en producción diferencias
calculadas sobre un recibido que se tecleó con otra regla, y el humano pidió expresamente no escribir
en la caja ni en ningún libro. Lo segundo obliga a teclear de nuevo cada consolidación, y corregir al
aporte cambiaría `monto_recibido`, que el humano pidió no falsear. Se adopta la migración de §3.5.

**H2 · Regularizar con un booleano `saldada_regla_anterior`, o excluyendo esas consolidaciones de la
deuda por fecha.** El booleano deja «Corregir» sin esperado (§3.5). La exclusión por fecha necesita
un ancla («antes del despliegue») que no está en ninguna fila; una fecha escrita en la migración es
un id disfrazado y una fecha de otra tabla es mutable (memoria «arreglar lo evidenciado»). El
predicado «conciliada y sin fila de ajuste» no necesita ancla.

**I · Desglose de entrada por método al marcar (efectivo / SINPE / transferencia recibidos).**
Descartado como arreglo no mínimo (§8.4): tres columnas nuevas en `cierre_bodega` y en la tabla de
ajustes, un CHECK de suma y validación por campo, sin ningún lector, porque el delta y la deuda solo
usan el total. El humano dijo que no importa a qué cuenta llegó. Si un día la caja separa bolsillos
por cuenta bancaria, se pide entonces.

**J · Relajar `montoPositivoSchema` a ≥ 0 (Q5).** Lo comparten la liquidación, los gastos fijos, los
efectos y los cierres admin, que no deben aceptar 0. El humano admitió el 0 solo en la conciliación y
solo con aporte ≤ 0: el borde de la conciliación admite el cero literal y el repositorio decide con el
dato (§4.4 bis).

---

## 13 · Riesgos y límites

| Riesgo | Decisión |
| --- | --- |
| **Ventana del despliegue.** Las migraciones corren en el build. Si el código viejo concilia un cierre de S después de M3 y antes del cambio de código, la marca queda sin asientos y nada los repone: corregir no asienta. | Se pide no conciliar durante el despliegue. Después se corre la consulta de verificación de T8.3 (solo lectura), que debe dar **cero**. Si no da cero, el remedio se decide con el humano. |
| Un cierre satélite aprobado por el código viejo dentro de la misma ventana queda asentado al aprobar. | Al conciliar, el asiento es idempotente y no se duplica. Solo cambia su fecha. |
| La analítica que lee los libros por fecha mueve el ingreso de los cierres satélite a la fecha de conciliación, y deja de verlo hasta entonces. | Es efecto buscado («Nada entra al aprobar»). Va en la nota de la release. |
| Saldos de tienda: retirar el crédito de S puede dejar en negativo, hasta conciliar, a una tienda a la que ya se pagó con ese COD. | El humano lo midió antes de decidir. La migración no puede detectarlo, y así se declara. |
| La base local es compartida entre worktrees. | M1–M3 ponen rojo el gate de otras fichas. Se aplican en el worktree propio y se avisa al leader. |
| Q3: los cierres de consolidaciones rechazadas no se asientan nunca. | Límite conocido **aceptado por el humano el 2026-11-02**. No hay ninguna hoy y la acción no tiene botón. La medición previa (T8.4) lo vuelve a contar. |
| Q4: una consolidación conciliada por el código viejo **después** de M4 y antes del cambio de código queda sin regularizar (y, si sus cierres estaban en S, sin asientos). | Cubierto por «no conciliar durante el despliegue». La verificación de T8.3 la detecta: una conciliada sin `esperado_regla_anterior`, sin fila de ajuste y con `conciliado_at` en la ventana. Remedio con el humano. |
| Q4: una regularizada tiene asientos de la aprobación antigua y su recibido se tecleó contra el efectivo. «Por cobrar a satélites» no la ve. | Es lo que decidió el humano: se da por saldada. Si su recibido estaba mal, «Corregir» escribe la diferencia contra su aporte reconocido. |

---

## 14 · Trazabilidad `R<n> → test`

`[N]` archivo nuevo · `[E]` suite existente que se extiende · `[S]` caso existente que se **sustituye**
por decisión del humano · `[=]` debe quedar verde sin modificar aserciones.

| R | Test |
| --- | --- |
| R1, R2, R4 | `[N]` `tests/integration/db/498-aprobacion-satelite-sql-real.test.ts`: aprobar un cierre satélite real deja **cero** filas nuevas en los tres libros (conteo por `origen_id`) y, en la misma transacción, la transición, la indemnización persistida, la liberación de las órdenes en novedad interna, la marca de confirmación física (238/497) y el historial. **Rojo antes del arreglo.** Más un caso unitario en `[E]` `tests/unit/repositories/cierres-admin-repository.test.ts`: un `destinoTipo` desconocido lanza `DestinoDeCierreDesconocidoError` y no llama a ningún feed. |
| R3, R55 | `[N]` el mismo archivo: aprobar un cierre central escribe en los tres libros el mismo multiconjunto `(tabla, tipo, categoria, monto, origen_tipo, origen_id)` que una **foto** tomada con el código de antes (T1.2). `[=]` `cierres-admin-caja-cod.test.ts`, que mide el orden de las llamadas (solo cambia el fixture `destinoTipo`). |
| R5, R7 | `[N]` `tests/unit/repositories/asentar-cierre-dia.test.ts`: orden de las llamadas idéntico al de la aprobación de hoy; `cajaCodFeed` solo si hay `cod_recaudado`; nunca escribe `premio_ranking` ni `premio_dia`. Idempotencia contra Postgres en `498-conciliar-asienta-sql-real.test.ts` (dos llamadas, mismas filas). |
| R6 | `[N]` `tests/integration/db/498-composition-root-asiento.int.test.ts`: llama a `marcarConsolidacionRecibidaAction` **inyectando solo `getActor`**, así que corre el `buildService` real. Después cuenta las **filas** en los tres libros con origen en los cierres de la consolidación (> 0) y la fila de diferencia. Los datos se siembran confirmados y se limpian en `afterAll`. Mutación: el constructor sin dependencias por defecto lo pone rojo. |
| R8–R15, R54 | `[N]` `tests/integration/db/498-conciliar-asienta-sql-real.test.ts`: marcar asienta cada cierre (y solo los de la consolidación); diferencia positiva → un egreso; negativa → un ingreso por el valor absoluto; cero → ninguna fila; una sola fila de diferencia con varios cierres; `fecha_movimiento` ≥ el instante de la marca y > `resuelto_at` del cierre; un fallo inyectado (el feed lanza) deja `conciliado_at` en NULL y cero filas nuevas; un segundo marcar → `conflict` sin filas; un cierre retirado por M3 se vuelve a asentar; `resolverCierreBodega('aprobado')` choca con el CHECK (§2). **Rojo antes del arreglo** (hoy marcar no escribe). |
| R15a, R15b | `[N]` en `498-conciliar-asienta-sql-real.test.ts`: marcar con `"0"` una consolidación de aporte positivo → `recibido_cero_con_aporte`, `conciliado_at` NULL, sin historial y cero filas nuevas; con aporte 0 → marcada y sin fila de diferencia; con aporte negativo → marcada y **un** ingreso de diferencia por el valor absoluto; corregir a `"0"` sigue la misma regla. `[E]` la suite del schema (`tests/unit/types/` o la que cubra `marcarConsolidacionRecibidaSchema`): acepta `"0"`, `"0.00"`; rechaza `"-1"`, `"0.001"`, `""`; `montoPositivoSchema` sigue rechazando `"0"` (red de sus otros consumidores). `[E]` `conciliacion-satelites-service.test.ts`: propaga el desenlace; con `adminSatelite`, `forbidden` antes del repositorio. |
| R16 | `[E]` `tests/components/MarcarRecibidoDialog*.test.tsx` (o la suite del diálogo): prefijo = `debe` si `debePositivo`; `0` si no. |
| R16a, R16b | `[E]` la misma suite del diálogo, en marcar y en corregir: muestra efectivo, SINPE y transferencia del DTO; el texto literal de R16a; **un solo** campo de monto (ningún input por método). |
| R17–R19 | `[N]` el mismo archivo de integración: marcar con faltante y luego corregir dos veces escribe dos filas `correccion` con la variación exacta; corregir al mismo monto no escribe nada; ninguna fila anterior cambia (comparación de las filas previas byte a byte); ningún asiento de cierre nuevo; corregir una **saldada con la regla anterior** de X a X − 10 escribe una sola diferencia de 10 (esperado = aporte reconocido, no el aporte). `[S]` `corregir-conciliacion.int.test.ts:304`. |
| R20, R22 | `[N]` el mismo archivo: revertir con asientos → `con_asientos` y ni `cierre_bodega` ni `historial_accion` cambian; revertir una conciliada sin asientos (consolidación sin dinero) funciona como hoy. `[S]` `marca-conciliacion.int.test.ts:336`. `[E]` `tests/unit/services/conciliacion-satelites-service.test.ts`: propaga `con_asientos`. |
| R21 | `[E]` `tests/components/` de `ConciliacionAcciones`: con `con_asientos`, el texto literal aparece y la marca no cambia. |
| R23–R25, R42 | `[N]` `tests/integration/db/498-deuda-satelite-sql-real.test.ts`: una zona con un cierre sin consolidar, uno con SINPE, uno en una consolidación rechazada, uno conciliado con faltante y una consolidación saldada con la regla anterior con hueco SINPE. La deuda es igual a la fórmula hecha a mano (la saldada suma 0); el «sin consolidar» y su conteo; Σ filas = `pendienteTotal`; la descarga es igual a la página. **Rojo antes del arreglo.** `[E]` `SaldosSatelitesTable` y su descarga: la columna «Sin consolidar». |
| R26, R27 | `[E]` `tests/unit/utils/conciliacion-satelite.test.ts`: `faltaPorRecibir` con recibido nulo, igual, menor y mayor; `aporteDeConsolidacion` devuelve `esperadoReglaAnterior` si no es nulo y `paraLaCentral` si lo es. `[E]` la suite del mapper de `CierreBodegaRepository`: recibido + falta = `paraLaCentral`; en una saldada, recibido + falta = aporte reconocido y falta = 0. |
| R28, R32 | `[N]` en `498-deuda-satelite-sql-real.test.ts`: `aporteCierreSql` es igual a `paraLaCentral` en casos positivo, cero y negativo, sobre filas reales; el declarado SQL de una saldada es igual a `aporteDeConsolidacion` de esa fila. `[N]` `aporte-satelite-fuente-unica-498.guardia.test.ts`. |
| R29–R31 | `[N]` en `498-deuda-satelite-sql-real.test.ts`: el declarado de cada consolidación es Σ aportes de sus cierres, y el de una saldada es su `esperado_regla_anterior`; hay una fila por cierre sin consolidar; el pendiente final sin filtros es igual a la deuda de Saldos; para un periodo, inicio + declarado − recibido = final. |
| R33–R36 | `[E]` `tests/unit/utils/caja-tesoreria.test.ts`: clasificación de las dos categorías; identidad y «De las tiendas» = Σ saldos con diferencia positiva, negativa y cero; un `@ts-expect-error` con un dueño ficticio en el `switch`. |
| R37 | `[E]` la suite de `CajaResumenCard`: bloque visible con 0; las dos pistas literales según el signo. |
| R38, R39 | `[E]` `tests/unit/utils/caja-tesoreria.test.ts` (`derivarReparto`): porciones en [0,100] que suman 100 en los límites (P > 0 con G, T e I en cero; P > 0 y S = P; P ≤ 0 → porciones idénticas a las de hoy, con `toEqual` contra un literal). `[E]` la suite de `BarraComposicionCaja`: con P ≤ 0, mismos segmentos que hoy; con P > 0, el tramo propio antes del último. |
| R40 | `[E]` las suites de `WalletLedger` y de su descarga: dueño «Satélite» en las filas de diferencia. |
| R41 | `[E]` la suite de `ConciliacionSatelite`: los tres bloques con los importes del DTO. |
| R41a | `[E]` la misma suite: con `saldadaReglaAnterior`, el rótulo literal «Saldada con la regla anterior» y «Debe» = `debe`; sin él, no hay rótulo. `[N]` en `498-deuda-satelite-sql-real.test.ts`: el DTO de una saldada trae `saldadaReglaAnterior: true`, `debe` = su `esperado_regla_anterior` y `faltaPorRecibir` = 0. |
| R43 | `[N]` en la guardia de la 498: ningún archivo de `app/`, `components/`, `lib/` ni `docs/ayuda/` contiene «informativa» junto a «marca», «no mueve dinero», «no mueve un col» ni «NINGUN LIBRO DE DINERO» en los archivos de la conciliación. Más la nota literal en `conciliacion-labels.ts`. Lleva autocomprobación. |
| R44 | `[=]` las guardias de ayuda. Revisión del reviewer contra la lista de §10. |
| R45 | `[E]` `tests/unit/services/conciliacion-satelites-service.test.ts`: con `adminSatelite`, marcar, corregir y revertir devuelven `forbidden` y el doble del repositorio **no se llama**. |
| R46, R47, R53 | `[N]` `tests/integration/db/498-satelite-migraciones.test.ts`: los tres valores existen; el CHECK admite egreso/egreso y rechaza egreso/ingreso con la categoría cruzada; la tabla tiene sus CHECK, la FK RESTRICT (borrar la consolidación falla), el único parcial de `marca` y RLS habilitada; M2 down → M1 down deja la base sin los valores y conserva un valor posterior sembrado a propósito; M1 down con filas vivas aborta. |
| R48–R52 | `[N]` `tests/integration/db/498-retirar-asientos-migration.test.ts`: retira solo lo de S; conserva `premio_ranking` y las filas con `premio_dia`; no toca cierres centrales ni conciliados; con un `liquidacion_pago` contra S aborta con el conteo y cero cambios; respaldo con clave `(tabla, id)`; up → down → up deja los tres libros iguales que el primer up; el `down` no duplica si el cierre ya se volvió a asentar; el esquema se conserva si tiene otra tabla. |
| R53 (M4), R54a–R54d | `[N]` `tests/integration/db/498-regularizar-migration.test.ts`. Siembra: una conciliada con hueco SINPE, una conciliada con aporte ≤ 0, una conciliada con fila `marca` en la tabla de ajustes, una sin conciliar y una rechazada. Up: marca **solo** las dos primeras, con `esperado_regla_anterior = monto_recibido`; las otras tres quedan en NULL. Conteo y suma por tabla de los tres libros y de `conciliacion_bodega_ajuste`, y `monto_recibido`, `estado`, `conciliado_*` y `updated_at` de todas las consolidaciones, **iguales** antes y después (R54b). La deuda de Saldos y el pendiente del estado de cuenta de la zona de las saldadas, sin otros cierres, dan 0 (R54c). Down: la columna y el CHECK desaparecen y ningún otro dato cambia. Up → down → up: mismas consolidaciones marcadas con los mismos valores (R54d). Reaplicar con una conciliación nueva de delta 0 la marca sin cambiar su deuda. El CHECK rechaza `esperado_regla_anterior` en una sin conciliar. Antes de creerlo, matarlo con la mutación 14. |

**Test rojo antes del arreglo** (T1): el caso «aprobar satélite no escribe en los libros», el caso
«marcar asienta», el de la deuda con un cierre sin consolidar y SINPE, y la foto de los cierres
centrales (que debe salir **verde** antes y después: es la red de R3).

**Contraprueba por mutación** (T9). Cada mutación debe poner rojo al menos un test nombrado arriba, y
el diff debe quedar vacío al restaurar:

1. en la aprobación, llamar a `asentarCierreDia` también en `bodega_satelite`;
2. quitar la llamada en `bodega_central`;
3. invertir el orden de dos escritores dentro de `asentarCierreDia`;
4. quitar el valor por defecto de `depsAsiento`;
5. no asentar los cierres en `marcarConciliado`;
6. quitar `− asentada` del delta;
7. cambiar `egreso` ↔ `ingreso` según el signo;
8. en `tieneAsientos`, dejar solo la tabla de ajustes;
9. volver a `total_efectivo` en `aporteCierreSql` o en `faltaPorRecibir`;
10. quitar `sinConsolidarSql` de la rama de cierres sueltos del estado de cuenta;
11. clasificar las diferencias como `propio`;
12. en M3, quitar `AND p.premio_dia IS NULL`;
13. en M3, quitar `b.conciliado_at IS NULL` de S;
14. en M4, quitar `NOT EXISTS (… conciliacion_bodega_ajuste …)` o `estado <> 'rechazado'` del predicado;
15. en `aporteDeConsolidacion` o en la rama 1 del estado de cuenta, ignorar `esperado_regla_anterior`;
16. en el repositorio, aceptar el recibido 0 sin mirar el aporte.

---

## 15 · Gate

El diff toca dinero, migraciones, `db/schema.prisma` y `lib/types/`. Por eso `./init.sh --rapido` **se
amplía solo** con toda `tests/integration/db`. No hace falta el completo. Además se corren a mano las
guardias de §11 y las de ayuda. Hay que mirar los `skipped` de `integration/db`, no solo el exit code
(memoria «gate sin `.env`»).
