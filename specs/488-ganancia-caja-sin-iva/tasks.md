# Ficha 488 — Tareas

Orden: **backend_dev (B) → frontend_dev (F)**; F empieza cuando B está mergeado en la rama de la ficha (el
DTO y los seeds son su contrato). `[P]` = paralelizable con la tarea anterior del mismo bloque. Gate de cada
bloque: `./init.sh --rapido`; como hay migración y `db/schema.prisma`, se amplía solo con
`tests/integration/db` (regla 5). Nadie corre el completo. Las guardias que leen `lib/` con `fs` no las
relaciona el grafo: correr a mano las de §B.9.

## B — backend_dev

- [ ] **B.0 Caracterización previa (antes de tocar nada).** Test de integración contra Postgres
  `tests/integration/db/caja-iva-488.test.ts`, bloque «antes»: siembra por los caminos reales (feed del
  cierre o inserción directa en `wallet_movimiento` respetando el CHECK) un conjunto con los tres IVA, un
  reverso de IVA de un cobro por devolución a origen, flete, comisión, contra-entrega, pago a tienda y un
  aporte; fija como **literales** la cifra principal, «Entró», «Salió», «De las tiendas» y capital que da
  `verResumenCaja`. *Hecho:* verde en `dev` sin cambios; esos literales no se tocan en el resto de la ficha (R8).
- [ ] **B.1 Migraciones** (§3). Mirar `origin/dev` y fijar timestamps; `…_488_enums` (+`down.sql` con
  `quitar_valores_de_enum_488` copiada de la 458-B) y `…_488_checks` (+`down.sql` con RAISE y lista de la
  458-B); `db/schema.prisma` con los dos valores; `prisma generate`. *Hecho:* `prisma migrate status` limpio
  en la base local; ningún `down.sql` previo modificado (`git diff --stat db/migrations` solo muestra las dos
  carpetas nuevas). Depende de B.0.
- [ ] **B.2 Test de migración** `tests/integration/db/iva-488-migration.test.ts`: el CHECK acepta
  `egreso`/`egreso_pago_iva` e `ingreso`/`ingreso_reverso_pago_iva` y rechaza los cruces; reaplicar el up no
  falla; el down con una fila que use un valor aborta sin borrar; el down sin filas quita los dos y conserva
  los demás valores del enum. *Hecho:* verde; la mutación «down con lista fija» lo pone rojo. Depende de B.1.
  (R35, R36)
- [ ] **B.3 Tipos y clasificación.** `NaturalezaMovimiento` + `"iva"`; seeds de categoría con los dos nuevos;
  `NATURALEZA_POR_CATEGORIA` (§2.1) y `LIQUIDEZ_POR_CATEGORIA` (dos `efectivo`);
  `WALLET_INGRESO_PROPIO_SEED` escrito con sus cinco valores; `WALLET_EGRESO_NOMBRADO_SEED` sin el reverso
  del IVA; `TIPO_EGRESO_MANUAL_SEED` + `"pago_iva"` y su mapa; `FUENTE_CAJA`; `CATEGORIA_LABEL`
  (`lib/constants/wallet-rotulos.ts`); `nombreDelEgresoAnulable`. *Hecho:* `tsc` verde. Depende de B.1. (R1)
- [ ] **B.4 Derivación** (§2.2, §2.3) en `lib/utils/caja-tesoreria.ts`: cubetas `ingresosIva`, `egresosIva`,
  `reversosIvaCobrado`; seis `derivarBalance`; `CajaResumenDTO` + `ivaCobrado`, `ivaPorPagar`,
  `signoIvaPorPagar`, `porcentajeIva`; `derivarReparto` con S sobre los bolsillos positivos. Tests unitarios en
  `tests/unit/utils/caja-tesoreria.test.ts`: (a) ganancia sin IVA; (b) IVA cobrado neto de reversos y sin
  pagos; (c) IVA por pagar; (d) identidad R7 sobre los conjuntos de la suite y con filtros; (e) tabla de la
  barra: los cuatro modos con I > 0 y con I ≤ 0, este último igual que hoy; (f) sin `.sub(`. *Hecho:* verdes;
  mutaciones m1, m4, m5 de design §13 rojas. Depende de B.3. (R2–R7, R14, R16, R34)
- [ ] **B.5 Composición** — `tests/unit/utils/caja-tesoreria.test.ts` y `caja-composicion-exhaustiva.guardia`:
  `derivarComposicionGanancia` sin claves de IVA, `totalIngresos = ingresosPropios`; el detalle de una fila
  con token de IVA → `validation_error` en `tests/unit/actions/wallet-actions.test.ts`. *Hecho:* verde.
  `[P]` con B.4. (R19, R20)
- [ ] **B.6 Anulación del Pago de IVA** (§4.2): `categoriaDelContraAsiento` y
  `CATEGORIAS_DE_CONTRA_ASIENTO_DE_EGRESO` en `lib/utils/egreso-anulable.ts`; usarlas en
  `EgresoCajaAnulacionService.anular`, `WalletEgresoService.reversarEgreso` y
  `EgresoCajaDocumentosRepository.estadoDeDocumentos`. Tests unitarios del servicio (categoría del
  contra-asiento por concepto, `ya_anulado`, `forbidden` antes de leer). *Hecho:* verdes; m2 roja. `[P]` con B.4.
  (R25–R27)
- [ ] **B.7 «Así queda» y «Cómo quedó»** (§4.3): `CONCEPTO_REGISTRO_SEED` + `pago_iva`, `EFECTO_POR_TIPO`,
  `lineas.ivaPorPagar`, `ComoQuedoDTO.caja.ivaPorPagar`. Tests: `tests/unit/utils/efecto-movimiento.test.ts`
  (pago de M: IVA por pagar −M, ganancia y De las tiendas `cambia: false`) y el de `ComoQuedoService`.
  *Hecho:* verdes. Depende de B.4. (R24, R30)
- [ ] **B.8 Analítica y finanzas diarias** (§7, §8): `metrics.ts` (`ganancia_ordenex` 14 y descripción,
  `dinero_en_caja` 29, `egresos` 12 y descripción); actualizar `metrics-caja-naturaleza.guardia.test.ts`
  (literales y un predicado con autocomprobación «la descripción de `ganancia_ordenex` declara la 488»);
  `tests/unit/analytics/finanzas-diario.test.ts` gana un caso con IVA y Pago de IVA. *Hecho:* verdes; volver a
  poner `ingreso_iva_flete` en la lista de `ganancia_ordenex` pone roja la guardia. `[P]` con B.6.
  (R31–R33)
- [ ] **B.9 Guardias** (correr a mano, no las ve el grafo): `caja-derivaciones` (4 → 6), `caja-clasificacion-459`
  («cargo = propio o iva»; un cargo `terceros` sigue rojo), `caja-composicion-exhaustiva`,
  `caja-173-alcance`, `metrics-caja-naturaleza`, y las de censo de escritores de la caja que fallen.
  *Hecho:* todas verdes **sin relajar** lo que protegían: cada cambio de literal lleva su comentario «ficha 488»
  y su mutación roja. Depende de B.4–B.8.
- [ ] **B.10 Integración contra Postgres** — completar `tests/integration/db/caja-iva-488.test.ts`, todo por
  las Server Actions reales (`verResumenCajaAction`, `registrarEgresoAdministrativoAction`,
  `anularMovimientoAction`/`anularEgresoCajaAction`, `previsualizarMovimientoAction`, `consultarMetricaFinanciera`):
  1. ganancia, ingresos y gastos de Ordenex sin IVA; IVA cobrado; IVA por pagar; «De Ordenex»; identidad R7;
     y los literales de B.0 intactos (R2–R8);
  2. lo mismo con filtro de periodo y con filtro de concepto (R9);
  3. anulación de un cobro por devolución a origen: el IVA baja IVA por pagar e IVA cobrado, el flete baja la
     ganancia (R10);
  4. registrar Pago de IVA M: una fila `egreso_pago_iva` origen `gasto`, efectos de R22; ninguna fila en
     `wallet_tienda_movimiento` ni `pago_mensajero_movimiento` (R23); dos envíos con la misma clave → una fila
     (R28); un rol sin acceso total → `forbidden` y cero filas (R27);
  5. anular ese pago con motivo: fila `ingreso_reverso_pago_iva`, IVA por pagar +M, ganancia igual, el libro
     lo marca `documento.anulado = true` (el WHERE de §4.2); anular otra vez → `ya_anulado` (R25, R26);
  6. «Así queda» del Pago de IVA con la línea IVA por pagar (R24);
  7. la métrica `ganancia_ordenex` del tablero = `verResumenCaja().resumen.ganancia` sobre el mismo periodo;
     `egresos` cuenta el pago y descuenta su anulación (R31, R32);
  8. `derivarFinanzasDiarias` sobre las filas del repositorio real: ganancia del día sin IVA y el pago en
     salidas (R33).
  *Hecho:* verde; mutaciones m1, m2, m3 rojas (anotadas en `progress/impl_488.md`). Depende de B.9.
- [ ] **B.11 Cierre backend.** `./init.sh --rapido` verde (con `tests/integration/db`, mirar que no haya
  `skipped`); `progress/impl_488.md` con la tabla R→test del backend y el resultado de las mutaciones;
  **commit** y verificar el blob en la rama. Depende de B.10.

## F — frontend_dev (empieza con B.11 en la rama)

- [ ] **F.1 Textos** (design §6) en `wallet-labels.ts`, `wallet-conceptos-manuales.ts`: `gananciaPista`,
  `ivaCobrado`, `ivaPorPagar`, `ivaPorPagarPista`, `CAJA_COMPOSICION_LABEL.iva`,
  `composicionCajaNombreAccesible`, `CAJA_COMPOSICION_MENSAJE.solo_ordenex`, `CAJA_RESUMEN_NOTA_DIFERENCIA`,
  `DUENO_LABEL.iva`, `TIPO_EGRESO_MANUAL_LABEL`/`DESCRIPCION_EGRESO_*`. Test
  `tests/unit/components/wallet-labels.test.ts`: literales, y que ningún texto nuevo contiene una sigla salvo
  «IVA». *Hecho:* verde. (R17, R18, R38)
- [ ] **F.2 Tarjeta de la caja** (`CajaResumenCard.tsx`, §6.1). Test `tests/components/CajaResumenCard488.test.tsx`:
  la cifra grande del bloque de la ganancia es `ganancia`; debajo, dentro de la misma región, «IVA cobrado a
  las tiendas: ₡X» con clase de tipografía menor que la cifra; tercer bolsillo con importe, insignia y pista en
  «flujo» y en «saldo», con y sin filtros; cero controles interactivos. *Hecho:* verde. Depende de F.1.
  (R11–R13)
- [ ] **F.3 Barra** (`BarraComposicionCaja.tsx`, §6.2). Test `tests/components/BarraComposicionCaja488.test.tsx`:
  los cuatro modos con `porcentajeIva` > 0 y = "0.00" (segmentos, orden, `style.width` = STRING del DTO, el
  último `flex-1`); el nombre accesible enuncia los tres bolsillos; sin IVA, el árbol es el de hoy.
  *Hecho:* verde. `[P]` con F.2. (R14–R16)
- [ ] **F.4 Composición sin IVA** (`ComposicionGananciaCard.tsx`, `DesgloseEgresosLista.tsx`). Test
  `tests/components/ComposicionGananciaCard.test.tsx` actualizado: ninguna fila «IVA …» ni su anulación; los
  totales son los del DTO. *Hecho:* verde. `[P]` con F.2. (R19)
- [ ] **F.5 Diálogo y «Así queda»** (`wallet-conceptos-manuales.ts`, `AsiQueda.tsx`). Tests: el catálogo tiene
  «Pago de IVA» en el tramo «Sale dinero de Ordenex», su frase, su libro («Se registra en el libro como «Pago
  de IVA».»), su `CONCEPTO_REGISTRO_DE`, y envía `tipoEgreso: "pago_iva"` a `registrarEgresoAdministrativoAction`
  con comprobante opcional; `AsiQueda` pinta la línea «IVA por pagar». *Hecho:* verdes. `[P]` con F.2.
  (R21, R24)
- [ ] **F.6 Libro, descarga y detalle** (`WalletLedger.tsx` `DUENO_PUNTO`, descarga, `DetalleMovimientoPanel.tsx`).
  Tests: la celda de dueño y la columna «Es dinero de» de la descarga dicen «IVA por pagar» en una fila de IVA;
  «Pago de IVA» y «Pago de IVA anulado» con su nombre; «Cómo quedó» muestra IVA por pagar. *Hecho:* verdes.
  `[P]` con F.2. (R29, R30)
- [ ] **F.7 Ayuda** `docs/ayuda/oficina/wallet-caja.md` (§9). *Hecho:* una prueba de texto
  (`tests/unit/docs/ayuda-wallet-caja-488.test.ts`) afirma que nombra «IVA por pagar» y «Pago de IVA» y que ya
  no contiene «La ganancia baja en el flete más el IVA»; las guardias de ayuda existentes verdes. `[P]` con F.6.
  (R37)
- [ ] **F.8 Ver la app.** Con el dev server del agente (uno solo), maestro: `/wallet` sin filtros y con un
  periodo; registrar un Pago de IVA y anularlo; mirar el «Así queda», la barra en «saldo», el libro y la
  descarga. Capturas y números en `progress/impl_488.md` comparados con lo que da `verResumenCaja`.
  *Hecho:* anotado. Depende de F.2–F.7.
- [ ] **F.9 Cierre frontend.** `./init.sh --rapido` verde; tabla R→test completa en `progress/impl_488.md`;
  commit y blob verificado. Depende de F.8.

## L — leader (antes de desplegar, no lo hace ningún dev)

- [ ] **L.1 Medir en producción** (solo lectura, MCP `supabase`, confirmar el proyecto antes): Σ de los tres
  `ingreso_iva_*`, Σ `egreso_reverso_iva_flete_devolucion` y la ganancia actual; anotar en
  `progress/contraste_488.md` cuánto bajará la ganancia y con cuánto nace «IVA por pagar» (design §11).

## Trazabilidad R → test

| R | Test |
| --- | --- |
| R1 | `caja-tesoreria.test.ts` (B.4) + `metrics-caja-naturaleza.guardia` (B.8) |
| R2, R3, R4, R5, R6, R7 | `caja-tesoreria.test.ts` (B.4) + `caja-iva-488.test.ts` §1 (B.10) |
| R8 | `caja-iva-488.test.ts` B.0 + §1 (literales) |
| R9 | `caja-iva-488.test.ts` §2 |
| R10 | `caja-iva-488.test.ts` §3 |
| R11, R12, R13 | `CajaResumenCard488.test.tsx` (F.2) |
| R14, R15, R16 | `caja-tesoreria.test.ts` (e) (B.4) + `BarraComposicionCaja488.test.tsx` (F.3) |
| R17, R18 | `wallet-labels.test.ts` (F.1) |
| R19 | `caja-tesoreria.test.ts` (B.5) + `ComposicionGananciaCard.test.tsx` (F.4) |
| R20 | `wallet-actions.test.ts` (B.5) |
| R21 | `wallet-conceptos-manuales` test (F.5) |
| R22, R23, R27, R28 | `caja-iva-488.test.ts` §4 |
| R24 | `efecto-movimiento.test.ts` (B.7) + `caja-iva-488.test.ts` §6 + `AsiQueda` test (F.5) |
| R25, R26 | `caja-iva-488.test.ts` §5 + test de `EgresoCajaAnulacionService` (B.6) |
| R29 | tests de `WalletLedger` y de la descarga (F.6) |
| R30 | test de `ComoQuedoService` (B.7) + `DetalleMovimientoPanel` (F.6) |
| R31, R32 | `metrics-caja-naturaleza.guardia` (B.8) + `caja-iva-488.test.ts` §7 |
| R33 | `finanzas-diario.test.ts` (B.8) + `caja-iva-488.test.ts` §8 |
| R34 | barrido STRING de `tests/integration/wallet-page.test.tsx` + `caja-tesoreria.test.ts` |
| R35, R36 | `iva-488-migration.test.ts` (B.2) |
| R37 | `ayuda-wallet-caja-488.test.ts` (F.7) |
| R38 | `wallet-labels.test.ts` (F.1) |
