# Ficha 488 — frontend (frontend_dev) — bitácora

Rama `feat/488-ganancia-caja-sin-iva` (worktree `.claude/worktrees/f488`), sobre `19e984a1` (backend).
Búsqueda: el MCP `codebase-memory` no estaba en mi conjunto de herramientas; se usó `grep` y lectura
directa de cada archivo. Ni backend, ni schema, ni migraciones tocados: el contrato del backend bastó.

## Tareas (F.1–F.9)

| Tarea | Hecho |
| --- | --- |
| F.1 Textos | `wallet-labels.ts`: `gananciaPista` («…, sin el IVA»), `ivaCobrado`, `ivaPorPagar`, `ivaPorPagarPista`, `CAJA_COMPOSICION_LABEL.iva`, nombre accesible con « IVA por pagar: ₡X.», `solo_ordenex` (R17), nota de la diferencia con «el IVA» (R18), `DUENO_LABEL.iva`, `TIPO_EGRESO_MANUAL_LABEL`/`DESCRIPCION_EGRESO_*` con `pago_iva`. Textos literales de design §6. |
| F.2 Tarjeta | `CajaResumenCard.tsx`: línea `data-dato="iva-cobrado"` `text-xs` dentro de la región de la ganancia; tercer bolsillo `section[aria-label="IVA por pagar"][data-bolsillo="iva"]` (superficie neutra, insignia de `signoIvaPorPagar`, pista), rejilla `md:grid-cols-3`. Cero controles nuevos. |
| F.3 Barra | `BarraComposicionCaja.tsx`: segmento `iva`; `campo` por segmento (`porcentajeTiendas`/`porcentajeIva`); con `signoIvaPorPagar === "positivo"` los segmentos de design §2.3, si no los de antes (R16, árbol idéntico). Color `bg-chart-13` (no `bg-info`: 2,34:1 contra la pista en oscuro, medido en `TableroDiaComposicion.test.tsx`), exportado como `COLOR_IVA_POR_PAGAR` y reutilizado por el punto del libro. |
| F.4 Composición | Fuera los tres IVA de `INGRESO_ICONO`, el reverso de `NOMBRADO_ICONO` y de `EGRESO_NOMBRADO_LABEL`. |
| F.5 Diálogo | `wallet-conceptos-manuales.ts`: `pago_iva` tras `sueldo` (grupo «sale», destino egreso administrativo, «A quién» obligatorio por la clase), `FRASE_DEL_EFECTO.pago_iva`, `CONCEPTO_REGISTRO_DE.pago_iva`. `AsiQueda.tsx`: línea «IVA por pagar». |
| F.6 Libro/descarga/detalle | `WalletLedger.tsx` `DUENO_PUNTO.iva`; la descarga toma `DUENO_LABEL` (sin cambio de código); `DetalleMovimientoPanel.tsx`: fila «IVA por pagar» en «Cómo quedó». |
| F.7 Ayuda | `docs/ayuda/oficina/wallet-caja.md`: sección «El IVA por pagar», barra con tres bolsillos, once conceptos, Pago de IVA y su anulación, dueño «IVA por pagar», «Así queda»/«Cómo quedó»; el párrafo de la anulación del cobro por devolución ya no dice que la ganancia baja en el IVA. |
| F.8 Ver la app | Abajo. |
| F.9 Cierre | Gate abajo; commit. |

Typecheck: los 30 errores que dejó el backend, cerrados (fixtures de `CajaResumenDTO` con los cuatro
campos en cero = tarjeta y barra de antes; claves IVA fuera de los fixtures de composición).

## Literales de otras fichas reescritos (cada uno con «ficha 488» y su valor anterior en comentario)

`ComposicionGananciaCard.test.tsx` (sin los tres IVA: total de ingresos 5.709,75 → 5.140; ganancia
3.519 → 2.949,25; seed 8 → 5; filas IVA fuera), `DetalleFilaComposicion.test.tsx` (18 → 14 controles),
`CajaComposicionBarra.test.tsx` (nombre accesible, `solo_ordenex`), `CajaResumenCard.test.tsx` (nota R18,
«sin siglas salvo IVA», `₡0` del R64), `wallet-labels.test.ts` (27 → 29 conceptos, tipos de egreso,
filas nombradas), `wallet-conceptos-manuales.test.ts` (10 → 11; la lista de categorías administrativas
gana `egreso_pago_iva`), `wallet-registrar-movimiento-dialog.test.tsx` (10 → 11 radios, grupo «sale»),
`rechazo-nombre-466-app.test.ts`, `libro-kardex-468.test.ts` (`DUENO_LABEL` + `iva`),
`contexto-457/458/461.test.ts` (ayuda: once conceptos y la lista de «sale»).

## Mapa R → test (frontend)

| R | Test |
| --- | --- |
| R11, R12, R13 | `tests/components/CajaResumenCard488.test.tsx` |
| R14, R15, R16 | `tests/components/BarraComposicionCaja488.test.tsx` (4 modos con IVA, 4 × {cero, negativo} = árbol de antes, color, signo manda) |
| R17, R18, R38 | `tests/unit/components/wallet-labels.test.ts` (bloque «488», con detector de siglas autocomprobado) |
| R19 | `tests/components/ComposicionGananciaCard.test.tsx` (bloque «Ficha 488») |
| R21 | `wallet-conceptos-manuales.test.ts` («FICHA 488») + `wallet-registrar-movimiento-dialog.test.tsx` («488 — el Pago de IVA»: grupo, «A quién» obligatorio, `tipoEgreso: "pago_iva"`, frase y libro) |
| R24 | `wallet-registrar-movimiento-dialog.test.tsx` (R24: pide `pago_iva`, pinta «IVA por pagar» antes/después) |
| R29 | `tests/components/WalletLedgerIva488.test.tsx` (celda de dueño, conceptos, `filaBaseCaja` de la descarga) + `libro-kardex-468.test.ts` |
| R30 | `tests/components/DetalleMovimientoPanel.test.tsx` («Cómo quedó» con «IVA por pagar») |
| R34 | `tests/integration/wallet-page.test.tsx` (el barrido «todo STRING» vuelve a compilar con los campos nuevos) |
| R37 | `tests/unit/docs/ayuda-wallet-caja-488.test.ts` |

## F.8 — la pantalla

Dev server propio en `:3488` (no había otro), apagado al terminar. Para entrar roté las contraseñas de
las CUATRO cuentas QA de la base LOCAL (`seed-usuarios-qa.ts`, `localhost:5432` confirmado): si otra
sesión las usaba, su login dejó de valer. `/wallet` como `admin.qa`, estado «flujo», sin filtros:

- Cifra principal ₡13.483.932,72 = De Ordenex (ganancia ₡13.331.231,72 + capital ₡0) + De las tiendas
  ₡147.670,10 + IVA por pagar ₡5.030,90 (R7 a ojo, al céntimo).
- Bloque de la ganancia: «Lo que Ordenex gana menos lo que gasta, sin el IVA» y debajo, más pequeño,
  «IVA cobrado a las tiendas: ₡5.030,90».
- Tercer bolsillo «IVA por pagar · Positivo · ₡5.030,90» con su pista; nota de la diferencia con «el IVA».
- Sin barra (no hay saldo inicial en local). No registré ni anulé un Pago de IVA en la app (eso queda
  cubierto por `caja-iva-488.test.ts` §4–§6 del backend contra Postgres).

## Verificación — `./init.sh --rapido` (salida en `progress/gate_488_frontend.log`, sin commitear)

Primera vuelta: `INIT_EXIT=1` por un rojo NUEVO y mío (`libro-kardex-468.test.ts`, el `DUENO_LABEL` sin
`iva`) → arreglado y aislado 36/36 verde. Segunda vuelta (la del log):

| Bloque | Resultado |
| --- | --- |
| typecheck / lint | pasa / pasa |
| relacionados (`--changed origin/dev`) | 729 archivos · 9498 passed · 0 failed · 17 skipped (los `.skip` deliberados de `AnaliticaPage.test.tsx`) |
| guardias | 273 archivos · 3760 passed · 0 skipped |
| `tests/integration/db` (ampliado) | 4262 passed · 5 failed · 0 skipped; los 4 archivos rojos, repetidos AISLADOS: 58/58 verdes → intermitentes |
| **INIT_EXIT** | **0** |

Intermitentes (rojo en paralelo, verde aislado; ninguno toca la caja): `cierre-sin-gestion-tope-sql-real`,
`correccion-dia-reparto.int`, `notificacion-evento-geocodificacion-caida-migration`,
`push-destinatarios-equivalencia`. Los tres que vio el backend no cayeron esta vez (en la primera vuelta,
integración 4267/4267).

## Veredicto

Frontend de la 488 hecho (F.1–F.9), con los 30 errores de typecheck y los rojos de UI cerrados, la
pantalla vista con números que cuadran y `./init.sh --rapido` en verde (`INIT_EXIT=0`).

## F.8 tras revisión (2026-10-22, sobre `d38265d9`)

Corrige el BLOQUEANTE 2 de `progress/review_488.md`. Dev server propio en `:3488` (no había otro),
Playwright headless, `admin.qa@ordenex.test`. Base LOCAL: `prisma migrate status` → `localhost:5432`, al
día. Apagado al terminar y `.next/dev` borrado. Capturas y el Excel en `progress/capturas_488/` (sin
commitear).

**Aviso (m5):** la contraseña con la que roté las cuentas QA la primera vez no quedó anotada y no
coincidía con `QA_PASSWORD` del `.env`. Volví a correr `seed-usuarios-qa.ts` en la base LOCAL con el
`QA_PASSWORD` del `.env`: las CUATRO cuentas QA locales quedan con esa clave. Al entrar a `/wallet` sale
el modal «Confirmá el SINPE de GAM»; se cierra con «Ahora no».

**Siembra (por la app):** «Aporte de dinero a la caja» → «Saldo inicial», ₡1.000.000, 2026-08-11. Su
«Así queda»: cifra ₡13.483.932,72 → ₡14.483.932,72; saldo inicial y aportes ₡0 → ₡1.000.000; ganancia,
tiendas e IVA por pagar «no cambia». La tarjeta pasa de «Flujo de dinero registrado» a «Dinero en caja».

| Momento | Cifra | Ganancia | IVA cobrado | IVA por pagar | De las tiendas | Capital | Ingresos / Gastos | Movs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inicial (flujo) | 13.483.932,72 | 13.331.231,72 | 5.030,90 | 5.030,90 | 147.670,10 | 0 | 13.372.032,22 / 40.800,50 | 36 |
| Tras saldo inicial | 14.483.932,72 | 13.331.231,72 | 5.030,90 | 5.030,90 | 147.670,10 | 1.000.000 | igual | 37 |
| Tras Pago de IVA ₡1.000 | 14.482.932,72 | 13.331.231,72 | 5.030,90 | **4.030,90** | 147.670,10 | 1.000.000 | igual | 38 |
| Tras anularlo | 14.483.932,72 | 13.331.231,72 | 5.030,90 | **5.030,90** | 147.670,10 | 1.000.000 | igual | 39 |

R7 en cada fila, al céntimo: 13.331.231,72 + 1.000.000 + 147.670,10 + 5.030,90 = 14.483.932,72.

- **a. Barra en «saldo»: OK.** `data-modo="dos_bolsillos"`, tres segmentos `tiendas` (1,02 %, `bg-warning`),
  `iva` (0,03 %, `bg-chart-13`) y `ordenex` (`flex-1`). Nombre accesible: «Reparto del dinero en caja. De
  las tiendas: ₡147.670,10. De Ordenex: ₡14.331.231,72 (ganancia y aportes). IVA por pagar: ₡5.030,90.»
  (14.331.231,72 = ganancia + capital). Tras el pago, el nombre dice «IVA por pagar: ₡4.030,90»; tras
  anularlo, «₡5.030,90». **Observación:** el ancho 0,03 % lo da el servidor (5.030,90 / 14.483.932,72), como
  pide R14. Medido en pantalla, el segmento tiene **0,31 px de 1.064 px**: a esta proporción no se ve. El spec
  no fija un ancho mínimo; no lo cambié. Captura `03a`.
- **b. Pago de IVA: OK.** El concepto está en «Sale dinero de Ordenex», tras «Sueldo». Sin «A quién», el
  diálogo no se envía: `aria-invalid="true"`, `aria-required="true"`, «Escribí a quién se le pagó.» (`05`).
  «Así queda» con ₡1.000 (`04`): cifra 14.483.932,72 → 14.482.932,72; «Ganancia de Ordenex ₡13.331.231,72 ·
  no cambia»; tiendas y capital «no cambia»; **«IVA por pagar» 5.030,90 → 4.030,90**. Registrado con «A quién»
  = Hacienda, 2026-10-22. Δ ganancia 0; Δ IVA por pagar −1.000,00 (exacto); Δ IVA cobrado 0.
- **c. Anulación: OK.** «Anular…» desde el detalle, con motivo. Δ ganancia 0; IVA por pagar 4.030,90 → 5.030,90
  (vuelve a su valor); Δ IVA cobrado 0; gastos de Ordenex 40.800,50 sin cambio.
- **d. Libro: OK.** Dos filas el 2026-10-22, las dos con dueño «IVA por pagar» y origen «Pago de IVA
  registrado a mano»:
  - «Pago de IVA · Pago de IVA registrado a mano · IVA de prueba… · Hacienda · Sale ₡1.000 · IVA por pagar ·
    Anulado»;
  - «Pago de IVA anulado · Pago de IVA registrado a mano · Anulación de: IVA de prueba… · — · Entra ₡1.000 ·
    IVA por pagar».
  Captura `10`.
- **e. «Cómo quedó»: OK.** Del pago: caja 14.482.932,72, ganancia 13.331.231,72, tiendas 147.670,10, capital
  1.000.000, **IVA por pagar 4.030,90**; estado «Anulado el 2026-10-22 … por Ana Admin · <motivo>». De la
  anulación: caja 14.483.932,72 e **IVA por pagar 5.030,90**. Capturas `07`, `11_*`.
- **f. Descarga: OK.** `libro-de-movimientos-2026-10-22.xlsx`, leído con `exceljs`. Cabecera con «Es dinero
  de». Las filas 40 («Pago de IVA», Hacienda, Sale 1000, saldo 14482932.72) y 41 («Pago de IVA anulado», Entra
  1000, saldo 14483932.72) llevan **«IVA por pagar»**. El saldo inicial lleva «Ordenex (capital)». En la hoja
  «Detalle por guía», las dos filas aparecen con su concepto.
- **Con periodo (resto del *Hecho* de F.8): OK.** Periodo 01–22 oct 2026: «Movimiento neto del periodo» ₡0,
  entró 1.000 y salió 1.000, 2 movimientos. Ganancia ₡0, IVA cobrado ₡0, IVA por pagar ₡0, y aparece el aviso
  de que con filtros la cifra no es el dinero de hoy. Captura `13_wallet_con_periodo_octubre`.

Los datos sembrados se quedan en la base local: el saldo inicial (es único y no se borra) y el Pago de IVA
con su anulación.

**m4 (ayuda):** la frase «Los que se revirtieron antes, sin motivo, se ven Anulado · motivo no registrado»
vuelve al párrafo de gastos, sueldos y gastos fijos de `docs/ayuda/oficina/wallet-caja.md`. Ningún test
fijaba su posición. Corrí los 22 archivos que leen esa ayuda: 22/22, 404 tests verdes.
