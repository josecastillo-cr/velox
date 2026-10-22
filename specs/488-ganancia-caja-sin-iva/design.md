# Ficha 488 — Diseño técnico

> **Búsqueda.** MCP `codebase-memory` (proyecto `R-job-singularis-projects-ordenex`) para trazar los
> consumidores (`trace_path derivarCaja` → 7 llamadores; `search_code NATURALEZA_POR_CATEGORIA` →
> 21 archivos de `lib/`) y **cada símbolo confirmado en el archivo real** el 2026-10-22 sobre `dev`
> (`9dcb9be3`). Las referencias `archivo:línea` son de esa lectura. Glob/ripgrep agotaron el tiempo varias
> veces sobre la raíz; los archivos se leyeron directamente.

## 0. En una frase

El IVA deja de ser `propio` y pasa a un **cuarto dueño, `iva`**, en el mismo `Record` total que ya decide de
quién es cada colón (`NATURALEZA_POR_CATEGORIA`). Con eso, la ganancia, «De Ordenex» y la composición lo
pierden **solas**; `derivarCaja` gana el bolsillo «IVA por pagar» y el «IVA cobrado»; la barra gana una
porción; y un egreso administrativo más, «Pago de IVA», con su anulación propia, lo baja.

**Principio rector:** arreglar lo evidenciado con las piezas que ya existen (la clasificación por categoría,
`derivarBalance`, el egreso administrativo de la 45 y su anulación con motivo de la 458-B, los `Record`
totales que obligan a decidir), no rediseñar la caja. La liquidez de ningún concepto cambia, así que la cifra
principal, «Entró», «Salió» y «De las tiendas» no se mueven (R8).

## 1. Lo medido

### 1.1 La clasificación hoy

- `lib/utils/caja-tesoreria.ts:62-105` — `NATURALEZA_POR_CATEGORIA`: los tres `ingreso_iva_*` (`:67-69`) y
  `egreso_reverso_iva_flete_devolucion` (`:104`) son `propio`.
- `:130-168` — `LIQUIDEZ_POR_CATEGORIA`: los tres IVA y su reverso son `cargo_a_tienda`. **No cambia.**
- `:195-234` — `acumular`: reparte por dueño `propio | terceros | capital` (rama `else` = capital).
- `:314-372` — `derivarCaja`: **cuatro** `derivarBalance` (caja, propio, terceros, capital);
  `deOrdenex = propio + capital` (`:346`); `derivarReparto(enCaja, deOrdenex, deTerceros)` (`:267-289`).
- `:483-528` — `derivarComposicionGanancia`: solo filas `propio`; ingresos por `WALLET_INGRESO_PROPIO_SEED`.
- `lib/types/wallet.ts:171-175` — `WALLET_INGRESO_PROPIO_SEED = [...WALLET_INGRESO_CONCEPTO_SEED,
  "ingreso_ajuste", "ingreso_cobro_tienda"]` (incluye los tres IVA por el spread). `:209-215` —
  `WALLET_EGRESO_NOMBRADO_SEED` incluye `egreso_reverso_iva_flete_devolucion`. `:276` —
  `NaturalezaMovimiento = "propio" | "terceros" | "capital"`.

### 1.2 Quién consume la ganancia o «De Ordenex»

| Consumidor (confirmado en disco) | Qué lee | Cambia solo al reclasificar |
| --- | --- | --- |
| `WalletService.verResumenCaja` (`WalletService.ts:419-441`) | `derivarCaja` + `derivarComposicionGanancia` sobre las **mismas** filas | sí |
| `efectoDeMovimiento` (`lib/utils/efecto-movimiento.ts:71-129`) → `PrevisualizarMovimientoService` → `components/shared/wallet/AsiQueda.tsx:150-152` | `ganancia`, `deTerceros`, `capital` | sí (le falta la línea IVA) |
| `ComoQuedoService.comoQuedo` (`ComoQuedoService.ts:52-62`) → `components/shared/wallet/DetalleMovimientoPanel.tsx` | `ganancia`, `deTiendas`, `capital` | sí (le falta la línea IVA) |
| `AnaliticaFinancieraService` (`:239` `ganancia_ordenex` vía `derivarCaja`; `:418`) → tablero `/analitica` (`IDS_FINANCIERAS_SERVIDAS` incluye `ganancia_ordenex`) y su exportación | `r.ganancia` | sí; el **catálogo** (`metrics.ts:741-782`) no |
| `derivarFinanzasDiarias` (`lib/utils/finanzas-diarias.ts:84`) | `esPropio` | sí |
| `CajaKardexService` (`LibroKardexService.ts:127-130`) | solo `enCaja` | no cambia nada |
| `cargar-kpis.ts:166` | `resumen.ganancia` | sí; `@sin-superficie` |
| `WalletMovimientoRepository.toDTO` (`:71`) → `WalletLedger.tsx:127-134`, `wallet-ledger-descarga-columnas.ts:75` | `dueno` | el `Record` `DUENO_LABEL` obliga |

### 1.3 Los egresos manuales y su anulación (para el Pago de IVA)

- `TIPO_EGRESO_MANUAL_SEED = ["gasto_variable", "sueldo"]` y `TIPO_EGRESO_MANUAL_A_CATEGORIA`
  (`lib/types/wallet.ts:757-766`); `registrarEgresoAdministrativoSchema` (`:774-780`).
- `WalletEgresoService.registrarEgreso` (`WalletEgresoService.ts:49-120`): una fila, origen `gasto`,
  `origen_id` NULL, historial `egreso_administrativo_registrado`, clave de idempotencia, comprobante opcional.
- La anulación con motivo: `EgresoCajaAnulacionService.anular` (`EgresoCajaAnulacionService.ts:74-114`)
  escribe **siempre** `ingreso_ajuste` (`:96`) — que es `propio`: anular un Pago de IVA por esa vía **subiría
  la ganancia**. El estado «anulado» del libro lo deriva `EgresoCajaDocumentosRepository.estadoDeDocumentos`
  (`:25-27`) buscando **solo** `ingreso_ajuste` con origen `gasto`.
- `WalletEgresoService.reversarEgreso` (`:122-165`) también escribe `ingreso_ajuste`; su Server Action está
  retirada (`lib/actions/wallet-egresos.ts:105-112`) y `trace_path` no le encuentra llamadores de producción;
  los tests la usan para sembrar reversos «de antes de la 458».

## 2. El modelo: un cuarto dueño, `iva`

### 2.1 Clasificación

| Concepto | Tipo | Dueño (antes → después) | Liquidez (no cambia) |
| --- | --- | --- | --- |
| `ingreso_iva_flete` | ingreso | propio → **iva** | cargo |
| `ingreso_iva_flete_devolucion` | ingreso | propio → **iva** | cargo |
| `ingreso_iva_comision_cod` | ingreso | propio → **iva** | cargo |
| `egreso_reverso_iva_flete_devolucion` | egreso | propio → **iva** | cargo (reverso de cargo) |
| **`egreso_pago_iva`** (nuevo) | egreso | **iva** | **efectivo** |
| **`ingreso_reverso_pago_iva`** (nuevo) | ingreso | **iva** | **efectivo** |

`NaturalezaMovimiento` pasa a `"propio" | "terceros" | "capital" | "iva"`. Todos los `Record` sobre ella
dejan de compilar hasta decidir (`DUENO_LABEL`, `DUENO_PUNTO` de `WalletLedger.tsx`), que es el mecanismo
querido.

### 2.2 La derivación (`lib/utils/caja-tesoreria.ts`), sin restas propias

1. `acumular` gana tres cubetas: `ingresosIva`, `egresosIva` (todo egreso de dueño `iva`) y
   `reversosIvaCobrado` (egreso de dueño `iva` **y** liquidez `cargo_a_tienda`: hoy solo
   `egreso_reverso_iva_flete_devolucion`). La rama de dueño deja de usar `else` para capital: se escribe
   `capital` e `iva` explícitos. Las cubetas de liquidez (`entradasEfectivo`, `salidas`, `cargosATiendas`,
   `reversosDeCargos`) **no cambian**: por eso R8.
2. `derivarCaja` pasa de cuatro a **seis** `derivarBalance` (la guardia `caja-derivaciones.guardia.test.ts:122-131`
   cambia su `4` por `6` y su comentario; la propiedad «no hay restas propias» sigue igual, sin `.sub(`):
   - `caja`, `propio`, `terceros`, `capital` — como hoy (el `propio` ya no contiene IVA);
   - **`iva = derivarBalance(ingresosIva, egresosIva)`** → `ivaPorPagar` (R4);
   - **`ivaCobrado = derivarBalance(ingresosIva, reversosIvaCobrado)`** → `ivaCobrado` (R5; P2).
3. `deOrdenex = propio + capital` (fórmula sin cambio; el valor ya no lleva IVA, R6).
4. **Identidad R7, por construcción** (extiende la de la 461): con I = ingIva − egIva,
   G + T + C + I = (ingP + ingT + ingC + ingI − cargos) − (egP + egT + egC + egI − rev) = Entró − Salió,
   porque las cuatro particiones por dueño cubren todas las categorías y las de liquidez no cambian.

### 2.3 La barra con tres bolsillos (`derivarReparto`)

El **modo** (`modoComposicionCaja`, cuatro valores) **se sigue derivando igual**, de los signos de «De
Ordenex» (O) y «De las tiendas» (T): sigue gobernando el color del bloque de Ordenex y los mensajes
(`CajaResumenCard.tsx:118-127`, `wallet-labels.ts:229-240`). Lo nuevo:

- `S` = suma de los bolsillos **positivos** entre O, T e I (una suma por cubeta, `.gt(0)`; sin restas).
- `porcentajeTiendas` = T / S × 100 si T > 0, si no `"0.00"`; `porcentajeIva` = I / S × 100 si I > 0, si no
  `"0.00"`. Redondeo a dos decimales `ROUND_HALF_UP`, como hoy. Sin división cuando S = 0.
- Con I ≤ 0, S = O⁺ + T⁺ y `porcentajeTiendas` es **idéntico** al de hoy en los cuatro modos (en
  `dos_bolsillos` hoy es T/enCaja con enCaja = O + T; en `solo_tiendas`, 100.00; en los otros, 0.00): R16.

Segmentos por modo (`BarraComposicionCaja.tsx:70-78`, `Record` total). El último segmento de cada lista es
`resto` (`flex-1`), así que un redondeo no abre hueco; una porción `"0.00"` tiene ancho cero, así que el
navegador **no compara nada** (R14):

| Modo | Segmentos (en orden) |
| --- | --- |
| `dos_bolsillos` | tiendas (`porcentajeTiendas`) · iva (`porcentajeIva`) · ordenex (`resto`) |
| `solo_tiendas` | tiendas (`porcentajeTiendas`) · iva (`resto`) |
| `solo_ordenex` | iva (`porcentajeIva`) · ordenex (`resto`) |
| `sin_reparto` | iva (`porcentajeIva`) |

Comprobación de `solo_tiendas` con I = 0: `porcentajeTiendas` = T/T = 100.00 y el `resto` del IVA mide cero:
igual que el `todo` de hoy. `sin_reparto` con I > 0: S = I, `porcentajeIva` = 100.00.

### 2.4 La composición de la ganancia

- `WALLET_INGRESO_PROPIO_SEED` deja de ser un spread de `WALLET_INGRESO_CONCEPTO_SEED` y se escribe con sus
  cinco valores: `ingreso_flete`, `ingreso_flete_devolucion`, `ingreso_comision_cod`, `ingreso_ajuste`,
  `ingreso_cobro_tienda`. **`WALLET_INGRESO_CONCEPTO_SEED` no cambia** (son los seis del feed del cierre y
  `MAPEO_CONCEPTO_TIENDA` depende de él). La guardia `caja-composicion-exhaustiva.guardia.test.ts:211-215`
  sigue exigiendo «seed = ingresos propios según el `Record`», y eso obliga.
- `WALLET_EGRESO_NOMBRADO_SEED` pierde `egreso_reverso_iva_flete_devolucion` (ya no es egreso propio).
- `COMPOSICION_FILA_SEED` se recalcula solo: el detalle de una fila de IVA cae en `z.enum` →
  `validation_error` (R20).
- `derivarComposicionGanancia` no cambia de código: filtra por `propio` (`:493`).

## 3. Modelo de datos y migraciones

A mano (`db:migrate:create` falla con P3006). **Antes de fijar los timestamps, mirar `origin/dev`**
(colisión de ids entre sesiones); la última conocida es `20261021120000_devolucion_tienda_comprobante_419`.
Nombres propuestos:

1. `20261023120000_iva_por_pagar_488_enums`
2. `20261023120100_iva_por_pagar_488_checks`

El reparto en dos es obligatorio: Postgres prohíbe usar un valor de enum en la transacción que lo añade
(55P04) y el CHECK lo nombra. Orden de reversión: 2 → 1. **Sin tablas nuevas, sin columnas, sin datos, sin
backfill:** la clasificación vive en el código (173 §10-B descarta guardar el dueño por fila).

### 3.1 Migración 1 — valores de enum

```sql
ALTER TYPE "wallet_movimiento_categoria" ADD VALUE IF NOT EXISTS 'egreso_pago_iva';
ALTER TYPE "wallet_movimiento_categoria" ADD VALUE IF NOT EXISTS 'ingreso_reverso_pago_iva';
```

Ni `wallet_origen_tipo` (el pago usa `gasto`, como el sueldo; su anulación, `gasto` con `origen_id` = el pago,
como el contra-asiento de la 458-B) ni `historial_accion_tipo` (`egreso_administrativo_registrado` y
`egreso_caja_anulado` ya existen) ganan valores.

**`down.sql`:** la función dinámica de `db/migrations/20260928120000_wallet_458_enums/down.sql:28-139`
copiada **tal cual** y renombrada `pg_temp.quitar_valores_de_enum_488`, aplicada a
`wallet_movimiento_categoria` con los dos valores. Lee la lista vigente de `pg_enum` (no recrea con una lista
fija: memoria «el down.sql borra los valores posteriores»), aborta con RAISE si una fila usa uno (R36) y
restaura CHECK, índices y DEFAULT. **Ningún `down.sql` previo se toca.**

### 3.2 Migración 2 — el CHECK tipo↔categoría

Se recrea `wallet_movimiento_tipo_categoria_check` como **ampliación** de la lista de la 458-B
(`20260928120100_wallet_458_tablas/migration.sql:110-126`): `'ingreso_reverso_pago_iva'` al final de la rama
`ingreso`, `'egreso_pago_iva'` al final de la rama `egreso`. Ninguna fila previa puede fallar (R35).

**`down.sql`:** `DO` que hace RAISE si alguna fila usa una de las dos categorías (mensaje que diga cuál), y
vuelve a crear el CHECK con la lista exacta de la 458-B.

**`db/schema.prisma`:** los dos valores en `enum WalletMovimientoCategoria`. Sin drift. Tocar migraciones y
`schema.prisma` amplía el `--rapido` con `tests/integration/db` (regla 5).

### 3.3 Por qué hace falta `ingreso_reverso_pago_iva`

La anulación de la 458-B escribe `ingreso_ajuste`, que es `propio`: anular un Pago de IVA subiría la ganancia
en vez de devolver el IVA por pagar (contra R25 y la regla «los reversos de IVA netean contra el IVA»). La
naturaleza es de la **categoría**, no de la fila, así que el contra-asiento necesita una categoría `iva`.

## 4. Servicios

### 4.1 Registro del Pago de IVA (reutiliza el egreso administrativo de la 45)

- `TIPO_EGRESO_MANUAL_SEED` → `["gasto_variable", "sueldo", "pago_iva"]`;
  `TIPO_EGRESO_MANUAL_A_CATEGORIA.pago_iva = "egreso_pago_iva"`. La regla «el gasto fijo no se registra a
  mano» no cambia (sigue fuera del enum).
- `WalletEgresoService.registrarEgreso` **no cambia de código**: mapea el tipo a la categoría, escribe una
  fila origen `gasto`, historial `egreso_administrativo_registrado`, clave de idempotencia (R28), comprobante
  opcional. Rol: `esAccesoTotal` primero (R27). No escribe en tienda ni mensajero (R23).
- `registrarEgresoAdministrativoAction` (`lib/actions/wallet-egresos.ts:80-103`): sin cambios; el `z.enum`
  amplio por el seed.

### 4.2 Anulación con motivo (amplía la 458-B)

Función pura nueva en `lib/utils/egreso-anulable.ts`:

```ts
/** La categoria del contra-asiento de un egreso anulable: el del Pago de IVA vuelve al IVA. */
export function categoriaDelContraAsiento(categoria: WalletMovimientoCategoria):
  "ingreso_ajuste" | "ingreso_reverso_pago_iva";
export const CATEGORIAS_DE_CONTRA_ASIENTO_DE_EGRESO: readonly ["ingreso_ajuste", "ingreso_reverso_pago_iva"];
```

- `EgresoCajaAnulacionService.anular` (`:93-104`): `categoria: categoriaDelContraAsiento(egreso.categoria)` en
  vez del literal; descripción «Anulación de: …» igual. Constancia, historial `egreso_caja_anulado`,
  idempotencia por el índice `(origen_tipo, origen_id, categoria)` y la constancia: sin cambios (R26).
- `EgresoCajaDocumentosRepository.estadoDeDocumentos` (`:25-27`): `categoria: { in:
  [...CATEGORIAS_DE_CONTRA_ASIENTO_DE_EGRESO] }`. **Es un WHERE**: se prueba contra Postgres (memoria «probar
  el WHERE donde vive»), no con dobles.
- `WalletEgresoService.reversarEgreso` (`:149-162`): usa la misma función, para que un reverso sembrado por
  los tests sobre un Pago de IVA no suba la ganancia.
- `nombreDelEgresoAnulable` (`egreso-anulable.ts:12-18`): `egreso_pago_iva: "Pago de IVA"`.
- `WalletAnulacionService.rutaDeCaja` y `WalletService.tipoDeDocumentoOriginal`: sin cambio (un egreso origen
  `gasto` ya es `egreso_caja`).

### 4.3 «Así queda» y «Cómo quedó»

- `lib/types/efecto-movimiento.ts`: `CONCEPTO_REGISTRO_SEED` + `"pago_iva"` (en el tramo «Sale»);
  `EfectoMovimientoDTO.lineas` + `ivaPorPagar: LineaEfectoDTO`.
- `lib/utils/efecto-movimiento.ts`: `EFECTO_POR_TIPO.pago_iva = { cuenta: null, caja: [{ tipo: "egreso",
  categoria: "egreso_pago_iva" }], enCuenta: null }`; `lineas.ivaPorPagar = linea(antes.ivaPorPagar,
  despues.ivaPorPagar)`. Sin derivaciones nuevas (R24).
- `lib/types/como-quedo.ts` y `ComoQuedoService` (`:56-62`): `caja.ivaPorPagar = resumen.ivaPorPagar` (R30).

### 4.4 Otros `Record` que el compilador obliga

- `LIQUIDEZ_POR_CATEGORIA`: los dos nuevos `efectivo`.
- `lib/utils/aporte-por-orden.ts` `FUENTE_CAJA`: los dos nuevos `{ tipo: "sin_reparto", motivo:
  "no_nace_de_un_cierre" }` (como `egreso_reverso_iva_flete_devolucion`, `:96`).
- `lib/constants/wallet-rotulos.ts` `CATEGORIA_LABEL`: §6.
- `lib/utils/invariante-tiendas.ts`: no tiene `Record` sobre categorías de caja nuevas; la invariante R8 de la
  459 («De las tiendas» = Σ saldos) no se mueve porque ningún concepto cambia de liquidez ni toca la tienda.

## 5. Contratos I/O

### 5.1 `CajaResumenDTO` (`lib/types/wallet.ts:388-429`) — gana cuatro campos, todos STRING

| Campo | Valor |
| --- | --- |
| `ivaCobrado` | `derivarBalance(ingresosIva, reversosIvaCobrado).balance` (R5) |
| `ivaPorPagar` | `derivarBalance(ingresosIva, egresosIva).balance` (R4) |
| `signoIvaPorPagar` | su `signo` |
| `porcentajeIva` | §2.3 |

Cambian de **valor** (no de forma): `ingresosPropios`, `egresosPropios`, `ganancia`, `signoGanancia`,
`deOrdenex`, y `porcentajeTiendas` solo cuando I > 0. El barrido de `tests/integration/wallet-page.test.tsx`
(«todo STRING salvo `periodoFiltrado`») sigue valiendo: ningún campo nuevo es número ni arreglo (R34).

### 5.2 Otros

- `ComposicionGananciaDTO`: misma forma; `ingresos` pierde las tres claves IVA y `egresos` la del reverso
  (por los seeds).
- `EfectoMovimientoDTO.lineas.ivaPorPagar`, `ComoQuedoDTO.caja.ivaPorPagar`: STRING escala 2.
- `previsualizarMovimientoSchema`: `concepto` admite `"pago_iva"` (por el seed).
- Server Actions: **ninguna nueva**. Registrar: `registrarEgresoAdministrativoAction` con `tipoEgreso:
  "pago_iva"`. Anular: `anularMovimientoAction` → `anularEgresoCajaAction` (sin cambios de contrato).

## 6. Pantalla y textos (frontend_dev)

Textos en diccionarios (`wallet-labels.ts`, `wallet-conceptos-manuales.ts`, `lib/constants/wallet-rotulos.ts`),
fijados por test como literales. Propuesta (P5):

| Dónde | Texto |
| --- | --- |
| `CAJA_RESUMEN_LABEL.gananciaPista` | «Lo que Ordenex gana menos lo que gasta, sin el IVA» |
| `CAJA_RESUMEN_LABEL.ivaCobrado` (bajo la cifra de la ganancia) | «IVA cobrado a las tiendas» → se pinta «IVA cobrado a las tiendas: ₡X» |
| `CAJA_RESUMEN_LABEL.ivaPorPagar` (rótulo del bolsillo) | «IVA por pagar» |
| `CAJA_RESUMEN_LABEL.ivaPorPagarPista` | «El IVA cobrado a las tiendas menos lo ya pagado a Hacienda. No es ganancia de Ordenex.» |
| `CAJA_COMPOSICION_LABEL.iva` | «IVA por pagar» |
| `composicionCajaNombreAccesible` | añade « IVA por pagar: ₡X.» tras «De Ordenex» |
| `CAJA_COMPOSICION_MENSAJE.solo_ordenex` (R17) | «Las tiendas le deben a Ordenex, así que en la caja no hay dinero de las tiendas y además hay dinero por cobrarles.» |
| `CAJA_RESUMEN_NOTA_DIFERENCIA` (R18) | «… no incluye el dinero de las tiendas, el IVA ni el saldo inicial o los aportes.» |
| `DUENO_LABEL.iva` (libro y descarga) | «IVA por pagar» |
| `CATEGORIA_LABEL.egreso_pago_iva` / `ingreso_reverso_pago_iva` | «Pago de IVA» / «Pago de IVA anulado» |
| Concepto del diálogo `pago_iva` | label «Pago de IVA»; descripción «Detalle del pago»; ejemplo «Ej. IVA de septiembre declarado a Hacienda» |
| `FRASE_DEL_EFECTO.pago_iva` | «Sale dinero de la caja para pagarle a Hacienda el IVA cobrado y baja el IVA por pagar; la ganancia no cambia.» |
| Línea de «Así queda» / «Cómo quedó» | «IVA por pagar» (= `CAJA_RESUMEN_LABEL.ivaPorPagar`) |

### 6.1 `CajaResumenCard.tsx`

- Bloque de Ordenex (`:293-309`): tras `CAJA_RESUMEN_LABEL.ganancia` y su pista, una línea `text-xs` con
  `data-dato="iva-cobrado"`: rótulo + `money(resumen.ivaCobrado)` (R12). La cifra grande sigue siendo
  `resumen.ganancia` (R11).
- Rejilla de bolsillos (`:247`): `md:grid-cols-3`; el tercero, `<section aria-label="IVA por pagar"
  data-bolsillo="iva">`, superficie neutra (`SUPERFICIE_NEUTRA`), cifra `CIFRA_BOLSILLO`, insignia
  `SIGNO_BADGE[resumen.signoIvaPorPagar]`, pista (R13). Siempre visible, sin depender de `estado`.
- Cero elementos interactivos (R8 de la 231) y regiones disjuntas: se conservan.

### 6.2 `BarraComposicionCaja.tsx`

- `Segmento.clave` gana `"iva"`; `Medida` sigue `porcentaje | resto | todo`, y `porcentaje` lee el campo del
  segmento (`porcentajeTiendas` o `porcentajeIva`) en vez de fijo. `SEGMENTOS_POR_MODO` según §2.3. Color del
  IVA: un token semántico de `DESIGN.md` distinto de `bg-warning` y `bg-muted-foreground` (lo elige
  frontend_dev con `/design`; ni hex ni paleta ad-hoc, R39 de la 231).

### 6.3 Otros

- `ComposicionGananciaCard.tsx` `INGRESO_ICONO` (`:98-104`) pierde las tres entradas IVA;
  `DesgloseEgresosLista.tsx` `NOMBRADO_ICONO`, la del reverso del IVA. Lo obliga el compilador.
- `WalletLedger.tsx` `DUENO_PUNTO.iva` (mismo token que la barra) y `DUENO_LABEL.iva`.
- `wallet-conceptos-manuales.ts`: `CONCEPTO_MANUAL_IDS` + `"pago_iva"` justo tras `"sueldo"` (tramo «sale»
  consecutivo); `CONCEPTOS_MANUALES` + `{ id: "pago_iva", destino: { clase: "egreso_administrativo",
  tipoEgreso: "pago_iva", categoria: TIPO_EGRESO_MANUAL_A_CATEGORIA.pago_iva }, grupo: "sale" }`;
  `FRASE_DEL_EFECTO`, `CONCEPTO_REGISTRO_DE.pago_iva = "pago_iva"`. `aQuienDelConcepto` devuelve
  «obligatorio» por la clase (P4). `DESCRIPCION_EGRESO_LABEL` / `PLACEHOLDER` / `TIPO_EGRESO_MANUAL_LABEL`
  ganan `pago_iva` (son `Record<TipoEgresoManual>`).
- `components/shared/wallet/AsiQueda.tsx` (`:150-152`) y `DetalleMovimientoPanel.tsx` (`:159`): una línea
  «IVA por pagar» tras la de capital.

## 7. Analítica (`lib/analytics/metrics.ts`)

- `ganancia_ordenex` (`:741-782`): `definicion.categorias` pierde los cuatro IVA (de 18 a **14**);
  `descripcion` gana «DESDE LA FICHA 488 NO incluye el IVA cobrado a las tiendas ni su anulación: es IVA por
  pagar a Hacienda, no ganancia; la cifra baja a partir de esa fecha sin que su id ni su nombre cambien»
  (R31). La guardia `metrics-caja-naturaleza.guardia.test.ts:463-483` ya la compara con el `Record`: su
  `toHaveLength(18)` pasa a 14 y la diferencia de `:485-502` gana las seis de dueño `iva`.
- `dinero_en_caja` (`:686-740`): + `egreso_pago_iva`, `ingreso_reverso_pago_iva` (27 → **29**; la guardia
  `:445-461` lo exige contra el seed).
- `egresos` (`:622-673`): + `egreso_pago_iva` y + `ingreso_reverso_pago_iva` al final, y la descripción lo
  declara («DESDE LA FICHA 488 incluye el Pago de IVA; su anulación se descuenta», P6). La guardia
  `:161-197` cambia sus literales (10 → 12; la lista de no-`egreso_` gana el reverso).
- `ingreso_iva` (`:598-621`): **sin cambio** (R32).
- `AnaliticaFinancieraService`: sin cambio de código (la ganancia sale de `derivarCaja`).

## 8. Finanzas diarias

`derivarFinanzasDiarias` (`finanzas-diarias.ts:84-101`): sin cambio de código; `esPropio` deja fuera el IVA
y el Pago de IVA cae en `salidas` por ser `efectivo` (R33). Se fija con un test.

## 9. Ayuda (`docs/ayuda/oficina/wallet-caja.md`)

La sección de la tarjeta explica el tercer bolsillo, que la ganancia no incluye el IVA y la línea «IVA
cobrado a las tiendas»; la tabla de conceptos gana «Pago de IVA» y «Pago de IVA anulado»; `:364-369` («La
ganancia baja en el flete más el IVA») pasa a «la ganancia baja en el flete y el IVA por pagar en el IVA»
(R37). La lista de componentes del encabezado (`:11`) no cambia de archivos.

## 10. Superficies que muestran o descargan la ganancia o «De Ordenex»

| Superficie | ¿Entra? | Motivo |
| --- | --- | --- |
| Tarjeta de la caja `/wallet` (`CajaResumenCard`) | **Sí** | Es el pedido: KPI sin IVA, IVA cobrado debajo, tercer bolsillo (R11–R13, R17, R18) |
| Barra de composición (`BarraComposicionCaja`) | **Sí** | Decisión 1a: tercer bolsillo (R14–R16) |
| Composición de la ganancia y su detalle por fila (`ComposicionGananciaCard`, `DetalleFilaComposicion`) | **Sí** | El IVA sale de la composición (R19, R20) |
| Libro de la caja y su descarga Excel (`WalletLedger`, `wallet-ledger-descarga-columnas`) | **Sí** | Columna de dueño (`Record` obliga) y conceptos nuevos (R29) |
| Diálogo de registrar movimiento y «Así queda» (`RegistrarMovimientoCajaDialog`, `AsiQueda`) | **Sí** | Decisión 2a: Pago de IVA (R21, R24) |
| Detalle de movimiento «Cómo quedó» (`DetalleMovimientoPanel`) | **Sí** | Muestra ganancia y bolsillos; sin la línea IVA una anulación de IVA no se vería (R30) |
| Analítica: tablero financiero y su exportación (`ganancia_ordenex`, `egresos`, `dinero_en_caja`) | **Sí** (catálogo) | El valor cambia solo; la definición y la descripción deben decirlo (R31, R32) |
| Analítica: KPIs financieros y barras diarias (`cargar-kpis`, `FinanzasDiarioBarras`) | No (UI) | `@sin-superficie` desde 2026-08-18; su cifra cambia sola y R33 la fija |
| Kardex y descarga por guía del libro (468) | No | Solo usan la cifra principal, que no cambia (R8) |
| Ganancia del cierre (`/cierres-admin`, detalle y factura) | No | Otra cifra (por cierre, `CierresAdminService.ts:835`); el pedido nombra `/wallet` (P1) |
| `/wallet/tiendas` y `/mi-wallet` | No | El IVA sigue siendo cargo a la tienda; saldos sin cambio |
| Ayuda de la caja | **Sí** | R37 |

## 11. Efecto sobre los datos existentes

No hay migración de datos: al desplegar, la ganancia de producción **baja exactamente** el IVA neto ya
registrado (Σ de los tres `ingreso_iva_*` − Σ `egreso_reverso_iva_flete_devolucion`), «De Ordenex» baja lo
mismo y «IVA por pagar» nace con ese valor; la cifra principal, «Entró», «Salió» y «De las tiendas» quedan
iguales (R7, R8). El leader lo mide antes de desplegar con un `SELECT` de solo lectura (tasks.md, sección L).

## 12. Alternativas descartadas

- **A1 — Restar el IVA dentro de `derivarCaja` dejando las categorías como `propio`.** Abre una segunda
  definición de la ganancia (la del `Record` y la de la resta especial); la composición, las finanzas
  diarias, la analítica y la columna de dueño seguirían viendo IVA como propio. Es exactamente el error que la
  173 prohibió («dos definiciones de la ganancia acaban dando dos ganancias»).
- **A2 — Anular el Pago de IVA con el `ingreso_ajuste` de siempre.** Sube la ganancia al anular (§3.3).
  Clasificar por origen en vez de por categoría la arreglaría, pero es la columna por fila que 173 §10-B
  descarta.
- **A3 — Un servicio y una Server Action propios para el Pago de IVA** (molde del aporte de capital, con
  origen y documento nuevos). Más tablas, más enums y otra anulación, para algo que el egreso administrativo
  de la 45 ya hace (fila única, comprobante, idempotencia, anulación con motivo). Se descarta por coste.
- **A4 — Mandar los segmentos de la barra como un arreglo `[{ bolsillo, porcentaje }]`.** Más general, pero
  rompe el barrido «todo STRING» de `CajaResumenDTO` (`wallet-page.test.tsx`) y obliga a rediseñar la barra.
  Los dos porcentajes STRING con los cuatro modos de siempre bastan.
- **A5 — Un quinto modo de composición para «solo IVA».** Cambia el `Record` de mensajes y colores sin
  necesidad: con `sin_reparto` + porción de IVA el mensaje vigente sigue siendo cierto.
- **A6 — Dejar el IVA dentro de «De Ordenex» y mostrarlo solo como texto.** Contradice la decisión 1a.

## 13. Riesgos y cómo se cubren

- **Una guardia de «cargo = propio»** (`caja-clasificacion-459.guardia.test.ts:139-156`) se pondrá roja: pasa a
  «todo cargo es `propio` o `iva`», con la mutación de que un cargo `terceros` sigue rojo.
- **El WHERE del estado «anulado»** (§4.2) y el cálculo de la ganancia se prueban contra Postgres, por la
  Server Action real (memoria «el composition root que no inyecta»).
- **Mutaciones mínimas que la suite debe matar** (las corre backend_dev y anota el resultado): (m1) devolver
  `ingreso_iva_flete` a `propio`; (m2) contra-asiento del Pago de IVA como `ingreso_ajuste`; (m3) quitar
  `ingreso_reverso_pago_iva` del `in` del repositorio de documentos; (m4) `egreso_pago_iva` como
  `cargo_a_tienda`; (m5) `porcentajeIva` sobre `enCaja` en vez de S.
