# Inventario H2 / H3 / H5 del `prompt-hotfix-portable.md` (solo lectura)

Fecha: 2026-11-02 · rama `dev` (HEAD sin cambios) · sin tests, sin gate, sin base remota.
Alcance: H2, H3 y H5 (inventario de prerrequisitos). H1 y H4 fuera de alcance.
Localizado por comportamiento y confirmado en el archivo real (no solo en el grafo).

---

## 0. Datos de contexto

- **Última migración:** `db/migrations/20261023120100_iva_por_pagar_488_checks` (commit del
  2026-10-22). `origin/dev` tiene la misma como última. Una migración nueva debe llevar fecha
  > `20261023120100`.
- **Multiempresa: NO existe.** No hay `organizacion_id` (ni `empresa_id`/`tenant`) en
  `db/schema.prisma` (0 coincidencias) y no hay ninguna `CREATE POLICY` en `db/migrations` (0
  archivos). El patrón del repo es «RLS habilitada sin policies, solo service role»
  (p. ej. `db/schema.prisma:1424-1427`, comentario de `CierreDia`). Todo lo del documento sobre
  `organizacion_id`, RLS por empresa, trigger de misma empresa y tests con dos empresas **no
  aplica** aquí.
- **Nombre del estado:** `sin_gestionar` se renombró a `novedad_interna` en
  `db/migrations/20260924120000_order_status_nombre_unico/migration.sql:15` (ficha 455). El enum
  de historial conserva los nombres viejos (`corte_sin_gestionar`, `liberacion_sin_gestionar`,
  `db/schema.prisma:2650-2651`), y el código usa la variable `sinGestionarEstatusId`.

---

## 1. H2 — confirmación física también para las barridas

**Veredicto: EXISTE el mecanismo y el BUG ESTÁ PRESENTE.** Se puede seguir con H2 tras la medición
previa (puerta del documento).

### 1.1 El mecanismo previo (feature 238): existe

| Pieza | Evidencia |
|---|---|
| Punto único «qué vuelve a bodega» (`Record` exhaustivo por `GestionResultado`) | `lib/types/gestion-retorno.ts:33-39` (`RETORNA_A_BODEGA`), `:48-50` (`RESULTADOS_QUE_VUELVEN`), `:59-61` (`vuelveABodega`) |
| Validación de cobertura en servidor, ANTES de la tx | `lib/services/CierresAdminService.ts:966` (parámetro `confirmacionFisica`), `:978-983` (llamada), `:1282-1350` (`validarConfirmacionFisica`: falta/sobra/duplicada/guía distinta/sin guía/incidente) |
| Sin salida de emergencia | `lib/services/CierresAdminService.ts:1276-1280` (comentario D2) |
| Marca en la tx de aprobación con fallo cerrado | `lib/repositories/CierresAdminRepository.ts:2392-2413` (`updateMany … data: { confirmadaFisicaAt }`, `count !== ids.length` → `ConfirmacionFisicaNoAplicableError`) |
| Solo en `aprobado` | `lib/repositories/CierresAdminRepository.ts:1824-1825` |
| Botón bloqueado + contador de faltantes en la UI | `app/(app)/cierres-admin/_components/cierre-confirmacion-fisica.tsx:107-110` (`textoFaltan`), `:309-316` (`progresoDePaquetes`), `:361`, `:389-391`; `app/(app)/cierres-admin/_components/CierresAdminModule.tsx:611-624` |

**Columna de confirmación en gestiones:** `gestion_orden.confirmada_fisica_at`
(`confirmadaFisicaAt DateTime?`, `db/schema.prisma:1230`). Es el mismo nombre que pide el documento.
Hay una guardia que exige que nazca **sin lectores**:
`tests/unit/guards/confirmacion-sin-lectores.guardia.test.ts`. Si la columna nueva de la barrida
lleva el mismo nombre, hay que revisar si esa guardia la cubre o la confunde.

### 1.2 El barrido de no trabajadas: existe (con otra forma)

- La tabla es `cierre_sin_gestion` (`model CierreSinGestion`, `db/schema.prisma:2843-2877`), con los
  datos congelados: `num_guia Int?` (nullable, sin unique), `num_remision`, `destinatario`,
  `producto`, `tienda_nombre`, `zona_nombre`, `estatus_origen_id`. Es inmutable, sin
  `updated_at`/`deleted_at`. Tiene `@@unique([cierreId, ordenId])`.
- **Quién la escribe:** el corte diario, **al crear el cierre** (no al vencer), en la misma
  transacción que mueve `en_reparto → sin_gestionar/novedad_interna`:
  `lib/repositories/CierreDiaRepository.ts:1095-1135` (`createMany` en `:1124`).
- Bandera de «lista irrecuperable» de los cierres anteriores a la 264:
  `cierre_dia.sin_gestion_registrado` (`db/schema.prisma:1457`). Si vale `false`, el cierre no tiene
  barridas que leer y, con H2, no exige nada.
- La aprobación las libera a bodega o a rechazo por tope de intentos dentro de la tx:
  `lib/repositories/CierresAdminRepository.ts:1940-…` (`liberacionSinGestionar`; lee
  `tx.cierreSinGestion.findMany` en `:1984`). `rechazo_tope_intentos`: `db/schema.prisma:2664`.

### 1.3 El bug: presente

- **Servidor:** el conjunto esperado sale SOLO de `gestion_orden`:
  `lib/repositories/CierresAdminRepository.ts:1010-1028` (`findGestionesRetornablesDelCierre`:
  `where { cierreId, resultado IN RESULTADOS_QUE_VUELVEN, anuladaAt: null }`). En
  `CierresAdminService.ts:1290-1291`, un cierre con barridas y sin gestiones que vuelvan devuelve
  `null`: se aprueba sin escanear nada.
- **Pantalla:** la lista sale de `retornablesDelCierre(detalle.grupos)` (gestiones) en
  `CierresAdminModule.tsx:611-612`. Las barridas se pintan en otra sección informativa, sin escaneo
  (`app/(app)/cierres-admin/_components/cierre-factura.tsx:2379-2386`).
- **Marca:** el `updateMany` de `:2392-2413` solo toca `gestion_orden`. `cierre_sin_gestion` no
  tiene columna de confirmación.
- **Rótulo vigente:** el producto ya usa «Novedad interna». El código lo declara así en
  `cierre-factura.tsx:1441-1442`: «“Sin gestionar” es el nombre RETIRADO de `novedad_interna`».

### 1.4 Tests que fijan el orden de llamadas en la tx de aprobación

Estos tests deben seguir verdes sin modificarse:

- `tests/unit/repositories/cierres-admin-caja-cod.test.ts`: aserción de orden medido en `:283` (el
  repo la cita en `CierresAdminRepository.ts:1888`, `:2180` y `:2386`).
- `tests/unit/guards/aprobacion-escrituras-cubiertas.guardia.test.ts`: censo de escrituras de la
  aprobación. Probablemente pida registrar el `updateMany` nuevo sobre `cierre_sin_gestion`.
- Relacionados con la confirmación:
  - `tests/unit/repositories/cierres-admin-confirmacion-fisica.test.ts`;
  - `tests/unit/services/cierres-admin-confirmacion-fisica.test.ts`;
  - `tests/unit/services/cierres-admin-service.aprobar.sin-gestion.test.ts`;
  - `tests/components/CierresAdminConfirmacionFisica.test.tsx`;
  - `tests/integration/db/confirmacion-fisica-migration.test.ts`;
  - `tests/integration/db/454/caracterizacion/confirmacion-fisica-238.test.ts`;
  - `tests/unit/types/cierres-admin-confirmacion-schema.test.ts`.

### 1.5 Diferencias de modelo (no bloquean)

- `ESTADOS_RESOLUBLES = ["solicitado"]` (`CierresAdminRepository.ts:133`). El estado `vencido`
  existe en el enum (`db/schema.prisma:1407`), pero hoy la aprobación no lo resuelve. En la puerta,
  «cola» significa en la práctica `solicitado` (más `vencido`/`rechazado` si los hubiera).
- La guía congelada (`cierre_sin_gestion.num_guia`) es `Int?`. La de la gestión se lee de
  `orden.num_guia` en vivo (`CierresAdminRepository.ts:1021-1025`). El documento pide comparar la
  barrida contra la congelada: es coherente.

---

## 2. H3 — el dinero de la satélite entra a la caja de la central solo al conciliar

**Veredicto: los prerrequisitos EXISTEN y el bug de la aprobación ESTÁ PRESENTE. Pero hay
decisiones humanas vigentes que contradicen reglas «cerradas» del documento. Hay que PARAR y
PREGUNTAR (§5).**

### 2.1 Inventario de prerrequisitos

| Prerrequisito | ¿Existe? | Evidencia |
|---|---|---|
| Cierres del día con destino `bodega_satelite` | Sí | `enum CierreDestinoTipo` en `db/schema.prisma:1415-1420`; `cierre_dia.destino_tipo` en `:1432` |
| Consolidación de la satélite (cierre de bodega que agrupa cierres del día) | Sí | `model CierreBodega` en `db/schema.prisma:1484-…`; `cierre_dia.cierre_bodega_id` (NULL = sin consolidar), ~`:1446` |
| Marca «recibido» (conciliar) | Sí | `CierresBodegaAdminRepository.marcarConciliado`, `lib/repositories/CierresBodegaAdminRepository.ts:518-574`. Columnas `conciliado_at`/`conciliado_por`/`monto_recibido`/`conciliado_nota`: `db/schema.prisma:1503-1506` |
| «Corregir» | Sí (ficha 473) | `CierresBodegaAdminRepository.ts:656-…` |
| «Revertir» / Desmarcar | Sí (ficha 431) | `CierresBodegaAdminRepository.ts:585-640` |
| Llamadores | Sí | `lib/services/ConciliacionSatelitesService.ts:132/150/173`; `lib/actions/conciliacion-satelites.ts:225` |
| Caja de la central con su libro | Sí | `wallet_movimiento`: `db/schema.prisma:1782`; único `(origen_tipo, origen_id, categoria)` en `db/migrations/20260712160000_wallet_movimiento/migration.sql:66-72` |
| Libro por tienda | Sí | `wallet_tienda_movimiento`: `db/schema.prisma:1898` |
| Libro del pago al mensajero | Sí | `pago_mensajero_movimiento`: `db/schema.prisma:1975-2010` |

**Diferencia de modelo en la consolidación.** «Marcar recibido» es a la vez la transición de estado:
`solicitado → aprobado`, guardada por `estado = solicitado AND conciliado_at IS NULL`
(`CierresBodegaAdminRepository.ts:528-540`). «Desmarcar» la devuelve a `solicitado`
(`:599-611`). Rechazar una consolidación está **retirado** de la pantalla
(`CierresBodegaAdminModule.tsx:857-858`). Aun así, `resolverCierreBodega` sigue vivo en
`CierresBodegaAdminService.ts:454/480`.

### 2.2 ¿La aprobación escribe dinero sin mirar el destino? Sí: bug presente

En `CierresAdminRepository.resolverCierre` (`lib/repositories/CierresAdminRepository.ts:1805-…`),
dentro de `res.count === 1 && nuevoEstado === "aprobado"`, los cinco escritores corren **sin leer
`destino_tipo`**:

1. caja: `walletFeedService.construirMovimientosDeIngreso` → `walletMovimientoRepo.crearMovimientos`
   (~`:1872-1873`);
2. libro por tienda (`:1875-1879`);
3. COD a caja (`CAJA_COD_FEED.construirIngresoCod`, `:1895-1905`);
4. libro del mensajero y egreso `egreso_pago_mensajero` (`:1912-1922`);
5. egreso de indemnización (~`:1929-1936`).

Los cinco feeds escriben con `origenTipo: "cierre_dia"`:

- `lib/services/WalletFeedService.ts:100`;
- `WalletTiendaFeedService.ts:174`;
- `WalletMensajeroFeedService.ts:55/68/84`;
- `WalletIndemnizacionFeedService.ts:58`;
- `CajaCodFeedService.ts:39/69`.

El único uso de `destinoTipo` en esa rama es para la liberación de órdenes (`:2121`, `:2339`), no
para el dinero.

### 2.3 Pendiente de satélites y estado de cuenta de la bodega: cómo se calculan hoy

- **Saldos de satélites:** `lib/repositories/SaldosSatelitesRepository.ts:132-180`.
  - `groupBy zonaId` sobre `cierre_bodega` no rechazadas: Σ`total_efectivo` − Σ`monto_recibido`.
  - La fórmula es `saldoDe(efectivo, recibido) = efectivo − (recibido ?? 0)`
    (`lib/utils/conciliacion-satelite.ts:39-44`).
  - **No cuenta los cierres del día aprobados sin consolidar, ni el SINPE o la transferencia.**
    Coincide con la causa raíz 2 del documento.
- **Pero el uso de solo efectivo es una DECISIÓN HUMANA vigente:** «decisión del humano sobre Q2
  (2026-09-16), medida contra producción. El SINPE —26,3 % del consolidado— entra directo a una
  cuenta y NO viaja en el bulto» (`SaldosSatelitesRepository.ts:23-26`;
  `conciliacion-satelite.ts:24-27`).
- **Estado de cuenta de la bodega:** `lib/repositories/EstadoCuentaRepository.ts:254-280`
  (`paginaDeBodega`, UNION sobre `cierre_bodega`: declarado = `total_efectivo`, recibido =
  `monto_recibido`), `:359-375` (`totalesDeBodega`) y `:396-420` (`periodoDeBodega`). Mismo criterio
  (efectivo). No incluye una fila por cierre sin consolidar.

### 2.4 ¿Existe una función única de «lo que la satélite entrega a la central»? Sí

`paraLaCentral(totalGeneral, pagoMensajero, ganaBodegaSatelite)` en
`lib/utils/ingreso-ordenex.ts:679-688` (feature 393). Es exactamente la fórmula de aporte de H3:
`total_general − total_pago_mensajero − total_ingreso_bodega_rechazos`, con signo y sin recortar.

- Se usa en `lib/repositories/CierreBodegaRepository.ts:125` (mapper único de la cabecera) y en
  `lib/services/CierresBodegaAdminService.ts:354`.
- Hoy **no** la usan ni Saldos ni el Estado de cuenta, que van por `saldoDe` sobre efectivo. Son dos
  fórmulas distintas para la misma consolidación.

### 2.5 `total_ingreso_bodega_rechazos`: existe

En `cierre_dia` (`db/schema.prisma:1439`) y en `cierre_bodega` (`:1494`), los dos `Decimal(12,2)`
snapshot (feature 56).

### 2.6 ¿La caja reparte por «dueño»? Sí, cuatro dueños

- `NATURALEZA_POR_CATEGORIA: Record<WalletMovimientoCategoria, NaturalezaMovimiento>` en
  `lib/utils/caja-tesoreria.ts:62` (`propio | terceros | capital | iva`).
- `LIQUIDEZ_POR_CATEGORIA` en `:136` (`efectivo | cargo_a_tienda`).
- Las ramas están en `:238-262` y son un `if / else if` explícito por dueño (ficha 488). **No hay
  `never` exhaustivo**: un dueño nuevo hoy no rompería la compilación en esas ramas, aunque el
  `Record` sí obliga a clasificar cada categoría.
- Composición: `derivarCaja` (`:362`) y `derivarComposicionGanancia` (`:540`). La identidad ya
  incluye IVA desde la 488.
- **Las categorías de diferencia no existen todavía.** `enum WalletMovimientoCategoria`
  (`db/schema.prisma:1682-1716`) no tiene `egreso_/ingreso_diferencia_satelite`, y
  `enum WalletOrigenTipo` (`:1740-…`) no tiene `conciliacion_bodega_ajuste`.
- El CHECK tipo↔categoría vigente es el de
  `db/migrations/20261023120100_iva_por_pagar_488_checks`.

### 2.7 ¿Hay una regla vigente de «la conciliación es informativa»? Sí, y en tres sitios

- **Ayuda de usuario:** `docs/ayuda/oficina/wallet-satelites.md:94-97`: «## Desmarcar no mueve
  dinero. La marca es informativa: dice si el efectivo llegó, **no lo contabiliza**».
- **UI:** `app/(app)/cierres-admin/_components/CierresBodegaAdminModule.tsx:851-856`: «es REVERSIBLE
  («Desmarcar»): una marca informativa … deshacerla no mueve un colon».
- **Repositorio:**
  - `CierresBodegaAdminRepository.ts:514`: «NO ESCRIBE EN NINGUN LIBRO DE DINERO (R14)»;
  - `CierresBodegaAdminRepository.ts:654`: corregir «NO ESCRIBE EN NINGUN LIBRO DE DINERO (R12)».

### 2.8 `liquidacion_pago.cierre_id`: existe

`LiquidacionPago.cierreId` → columna `cierre_id`, FK `cierre_dia`, `onDelete: Restrict`
(`db/schema.prisma:2054` y `:2071`). La relación inversa `CierreDia.liquidacionPagos` está en
`:1469`. Hay además `reparto_id` (`liquidacion_reparto`, feature 205, `:2061`). Los pagos por
reparto también llevan `cierre_id`.

### 2.9 Premios e incentivos en el libro del mensajero

- **Premio de ranking:** `categoria = 'premio_ranking'` (`db/schema.prisma:1962`) con
  `premio_dia` (`:2000`).
- **Reverso del premio:** `categoria = 'ajuste_pago' AND premio_dia IS NOT NULL` (índices parciales
  descritos en `:1987-1996`).
- **«Incentivo»: NO existe ningún concepto** (0 coincidencias en el esquema).
- Criterio de exclusión adaptado: `categoria <> 'premio_ranking' AND premio_dia IS NULL`.
- Los premios no tienen `origen_tipo = 'cierre_dia'`, salvo que se compruebe lo contrario (ver la
  consulta M-H3-3b).

### 2.10 ¿Existe el esquema `respaldo` o uno similar? No

La única `CREATE SCHEMA` del repo es `extensions`
(`db/migrations/20260731160000_orden_busqueda_trgm/migration.sql`). Habría que crearlo, y el
requisito «inaccesible para el rol de la app» depende de con qué rol conecta Prisma (ver §5).

---

## 3. H5 — qué bloques aplican aquí

| Bloque | ¿Aplica? | Evidencia / motivo |
|---|---|---|
| 1. Fecha del cierre en UTC | **Sí, y es independiente de H3** | La utilidad ya existe: `fechaCalendarioCR` en `lib/utils/fecha-cr.ts:47-53`. Hay `slice(0, 10)` en las pantallas de cierres: `app/(app)/cierres-admin/_components/cierre-factura.tsx:307` (`fecha(iso)` del comprobante) y `app/(app)/cierre-dia/_components/CierreDiaModule.tsx:935` y `:1026` (`solicitadoAt.slice(0, 10)`). Otras pantallas ya lo corrigieron (`CierresBodegaAdminModule.tsx:24`, `DescargarGestionesDialog.tsx:274`). Falta revisar las columnas de fecha de las descargas de cierres. No existe una guardia «sin `slice(0,10)` en cierres»; las de fecha que hay son `tests/unit/guards/wallet-fecha-cr-459.guardia.test.ts` y otras dos ajenas. `lib/utils/jornada-cierre.ts:113,123,134` corta un `Date` de medianoche UTC (día calendario), no una pantalla. |
| 2. «Desmarcar» solo cuando se puede | Solo tras H3 | Hoy «Desmarcar» siempre se ofrece, porque la marca es informativa (§2.7). |
| 3. Revertir sin diferencia huérfana | Solo tras H3 | No existe la tabla de ajustes. |
| 4. Una sola fórmula del esperado | Solo tras H3 | La función candidata ya existe: `paraLaCentral` (§2.4). |
| 5. Aislamiento por empresa | **No aplica** | No hay multiempresa (§0). |
| 6. Rastro de distritos en el histórico | Depende de H4 (fuera de alcance) | Los catálogos existen: `enum HistorialAccionTipo` (`db/schema.prisma:3955`), con acciones de zona como `orden_zona_reconciliada` y `zona_central_cambiada`. Tipo, categoría y etiqueta viven en `lib/types/historial-accion.ts` (`CATEGORIAS_ACCION` en `:393`, con la categoría `mueve_dinero`, y el mapa en `:403-…`). `zona_distrito` solo tiene `@@unique([zonaId, distritoId])` (`db/schema.prisma:683-694`). No hay `zona_distrito_cambiado`. |
| 7. Textos definitivos | Solo tras H3 | — |
| 8. Retirar los respaldos | Solo tras H3/H4 | Hoy no hay esquema `respaldo`. |
| 9. Tests inestables | Sin inventariar a fondo | Hay tests que mencionan `40P01`/`23001` (p. ej. `tests/integration/db/abono-tienda-457-migration.test.ts`, `cobro-tienda-461-migration.test.ts`, `habilitacion-api-migration.test.ts`). Habría que compararlos uno a uno con los del origen. |

---

## 4. Consultas de medición en producción, adaptadas (solo SQL; NO ejecutadas)

Las tablas de wallet usan `origen_id TEXT`, por eso se compara con `c.id::text`.

### H2 — puerta antes del deploy

```sql
-- M-H2-1: cierres en cola, por estado
SELECT estado::text, count(*) FROM cierre_dia
WHERE estado::text IN ('solicitado','vencido','rechazado') GROUP BY 1;

-- M-H2-2: barridas que arrastran y cuántas tienen la guía congelada en NULL
SELECT c.estado::text, count(s.id) AS barridas,
       count(*) FILTER (WHERE s.num_guia IS NULL) AS barridas_sin_guia,
       count(DISTINCT c.id) AS cierres_con_barridas
FROM cierre_dia c JOIN cierre_sin_gestion s ON s.cierre_id = c.id
WHERE c.estado::text IN ('solicitado','vencido','rechazado') GROUP BY 1;

-- M-H2-3 (exposición del bug): cierres ya aprobados con barridas
SELECT count(DISTINCT c.id) AS cierres, count(s.id) AS barridas
FROM cierre_dia c JOIN cierre_sin_gestion s ON s.cierre_id = c.id
WHERE c.estado::text = 'aprobado';
```

### H3 — conjunto S y puerta de la migración de datos

```sql
-- S: satélite aprobado, sin consolidar o con la consolidación sin conciliar
WITH s AS (
  SELECT c.id FROM cierre_dia c
  LEFT JOIN cierre_bodega b ON b.id = c.cierre_bodega_id
  WHERE c.destino_tipo::text = 'bodega_satelite' AND c.estado::text = 'aprobado'
    AND (c.cierre_bodega_id IS NULL OR b.conciliado_at IS NULL))
SELECT count(*) AS tam_s,
       count(*) FILTER (WHERE c.cierre_bodega_id IS NULL) AS sin_consolidar
FROM s JOIN cierre_dia c ON c.id = s.id;

-- M-H3-1: filas de la caja por categoría
WITH s AS (...mismo CTE...)
SELECT w.categoria::text, count(*), sum(w.monto)
FROM wallet_movimiento w JOIN s ON w.origen_id = s.id::text
WHERE w.origen_tipo::text = 'cierre_dia' GROUP BY 1;

-- M-H3-2: libro por tienda
WITH s AS (...)
SELECT t.categoria::text, count(*), count(DISTINCT t.tienda_id) AS tiendas
FROM wallet_tienda_movimiento t JOIN s ON t.origen_id = s.id::text
WHERE t.origen_tipo::text = 'cierre_dia' GROUP BY 1;

-- M-H3-3: libro del mensajero, excluyendo premios y sus reversos
WITH s AS (...)
SELECT p.categoria::text, count(*)
FROM pago_mensajero_movimiento p JOIN s ON p.origen_id = s.id::text
WHERE p.origen_tipo::text = 'cierre_dia'
  AND p.categoria::text <> 'premio_ranking' AND p.premio_dia IS NULL
GROUP BY 1;
-- M-H3-3b (control): ¿alguna fila de premio cuelga de un cierre de S? Debería ser 0.
WITH s AS (...)
SELECT count(*) FROM pago_mensajero_movimiento p JOIN s ON p.origen_id = s.id::text
WHERE p.categoria::text = 'premio_ranking' OR p.premio_dia IS NOT NULL;

-- M-H3-4: guarda — pagos al mensajero contra S (si es > 0, la migración aborta)
WITH s AS (...)
SELECT count(*) FROM liquidacion_pago l JOIN s ON l.cierre_id = s.id;

-- M-H3-5: tiendas afectadas a las que ya se les pagó DESPUÉS del crédito de S
WITH s AS (...), afect AS (
  SELECT t.tienda_id, min(t.fecha_movimiento) AS desde
  FROM wallet_tienda_movimiento t JOIN s ON t.origen_id = s.id::text
  WHERE t.origen_tipo::text = 'cierre_dia' GROUP BY 1)
SELECT count(DISTINCT a.tienda_id)
FROM afect a JOIN wallet_tienda_movimiento p
  ON p.tienda_id = a.tienda_id AND p.categoria::text = 'pago_tienda' AND p.fecha_movimiento >= a.desde;
```

Notas:

- Las columnas `tienda_id` y `fecha_movimiento` de `wallet_tienda_movimiento` hay que confirmarlas
  en `db/schema.prisma:1898-1935` antes de correr la consulta. `fecha_movimiento` existe en
  `pago_mensajero_movimiento`.
- Para la verificación global posterior al deploy, la consulta del documento vale tal cual (los
  nombres coinciden: `wallet_movimiento`, `cierre_dia`, `cierre_bodega`, `destino_tipo`, `estado`,
  `conciliado_at`).

---

## 5. Preguntas para el humano

**H3 (bloqueantes):**

1. **Deuda de la satélite: solo efectivo o todos los métodos.** Aquí rige la decisión Q2 del
   2026-09-16: la deuda se calcula sobre `total_efectivo` porque el SINPE «no viaja en el bulto»
   (`SaldosSatelitesRepository.ts:23-26`). H3 decide «todos los métodos − pago a mensajeros −
   ganancia», o sea `paraLaCentral`. ¿H3 revoca Q2?
2. **La conciliación deja de ser informativa.** Fichas 431 y 473: la marca no escribe en ningún
   libro y es reversible. La ayuda de usuario lo dice textualmente
   (`docs/ayuda/oficina/wallet-satelites.md:94-97`). ¿Se confirma la revocación aquí? Implica
   reescribir esa ayuda y el texto de la UI.
3. **Estado de la consolidación.** Aquí «Marcar recibido» es también la transición
   `solicitado → aprobado`, y «Desmarcar» vuelve a `solicitado`. `resolverCierreBodega`
   (aprobar/rechazar del maestro) sigue en el servicio aunque «Rechazar» se retiró de la pantalla.
   ¿Hay algún camino vivo que apruebe una consolidación sin conciliarla? H3 asienta al marcar, así
   que una aprobación sin marca dejaría dinero sin asentar.
4. **Esquema `respaldo` inaccesible para el rol de la app.** No existe, y el repo no tiene policies
   (todo va por service role). ¿Con qué rol conecta Prisma en producción? Si es el dueño de las
   tablas, «sin acceso para el rol de la app» no se puede cumplir. ¿Se acepta como respaldo
   solamente?
5. **Incentivos.** Aquí no existen. ¿Basta con excluir `premio_ranking` y los reversos con
   `premio_dia`?
6. **Medición previa (M-H3-1…5).** ¿La autorizas o la corres tú? Es necesaria antes de proponer la
   migración que retira asientos ya hechos en producción.

**H2 (puerta, no bloquea el desarrollo):**

7. ¿Autorizas M-H2-1/2/3 en solo lectura? Con los números decides si se avisa a bodega o se drena
   la cola antes del deploy.

**H5:**

8. **Bloque 1** (fechas en UTC) es independiente de H3 y el bug está presente
   (`cierre-factura.tsx:307`, `CierreDiaModule.tsx:935/1026`). ¿Se adelanta como arreglo propio o
   espera a H3/H4, como pide el documento?
9. **Bloque 5** no aplica (no hay multiempresa). ¿Se da por descartado?
