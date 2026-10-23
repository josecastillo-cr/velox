# Ficha 488 — La ganancia de la caja, sin IVA

**Zona:** fullstack. **SDD:** sí. **Complejidad:** media. **Depende de:** nada pendiente (se apoya en la
231, 343, 459, 461, 457 y 458-B, todas en `dev`). **Implementación:** backend_dev → frontend_dev.

## El encargo (2026-10-22)

Hoy la caja (`/wallet`) cuenta el IVA cobrado a las tiendas como **ganancia de Ordenex**:
`NATURALEZA_POR_CATEGORIA` (`lib/utils/caja-tesoreria.ts:67-69`) clasifica `ingreso_iva_flete`,
`ingreso_iva_flete_devolucion` e `ingreso_iva_comision_cod` como `propio`, y por eso entran en la ganancia,
en «De Ordenex» y en la tarjeta «Composición de la ganancia» (`ComposicionGananciaCard.tsx:102-104`). La
anulación del IVA de un cobro por devolución a origen (`egreso_reverso_iva_flete_devolucion`,
`caja-tesoreria.ts:104`) es también `propio` y baja la ganancia. El IVA no es de Ordenex: se le debe a
Hacienda.

## Decisiones del humano (no se reabren)

- **Pedido.** El KPI grande «Ganancia de Ordenex» muestra la ganancia **sin IVA**; en el **mismo** KPI,
  debajo y más pequeño, se muestra **cuánto entró por IVA**; el IVA **deja de aparecer** en la composición
  de la ganancia.
- **1a.** El IVA sale del bolsillo «De Ordenex» (ganancia más aportes) a un **tercer bolsillo, «IVA por
  pagar»**, en la barra de composición de la caja. El efectivo total (la cifra principal) **no cambia**.
- **2a.** Un egreso **nuevo, «Pago de IVA»** (pago a Hacienda), baja el IVA por pagar **sin tocar la
  ganancia**. Se registra desde el diálogo de registrar movimiento manual de la caja.
- Los reversos de IVA netean contra el IVA, no contra la ganancia. El único reverso de IVA que existe en el
  libro de la caja es `egreso_reverso_iva_flete_devolucion` (458-B); la anulación de un Pago de IVA es el
  segundo, y lo crea esta ficha (design §3.3).

## Glosario

- **Movimientos de IVA:** las líneas de la caja con concepto «IVA del flete cobrado a la tienda», «IVA del
  flete por devolución a origen cobrado a la tienda», «IVA de la comisión cobrado a la tienda», la anulación
  del IVA del flete por devolución a origen, «Pago de IVA» y «Pago de IVA anulado».
- **IVA cobrado:** la suma de los tres conceptos de IVA cobrados a las tiendas menos las anulaciones del IVA
  del flete por devolución a origen, sobre el conjunto que se está mirando.
- **IVA por pagar:** el IVA cobrado menos los Pagos de IVA más las anulaciones de Pagos de IVA, sobre el
  conjunto que se está mirando.
- **Acceso total:** los roles de `esAccesoTotal` (maestro y admin), los únicos que ven la caja.

## Requisitos

### A. Qué es ganancia y qué es IVA

- **R1** — El sistema DEBE clasificar cada movimiento de IVA como dinero «IVA por pagar», distinto de la
  ganancia de Ordenex, del dinero de las tiendas y del saldo inicial y aportes.
- **R2** — El sistema DEBE calcular «Ganancia de Ordenex» como los ingresos de Ordenex menos los gastos de
  Ordenex, sin ningún movimiento de IVA.
- **R3** — El sistema DEBE calcular «Ingresos de Ordenex» y «Gastos de Ordenex» de la tarjeta de la caja sin
  ningún movimiento de IVA.
- **R4** — El sistema DEBE calcular «IVA por pagar» según el glosario.
- **R5** — El sistema DEBE calcular «IVA cobrado» según el glosario; los Pagos de IVA y sus anulaciones NO
  DEBEN cambiar el IVA cobrado.
- **R6** — El sistema DEBE calcular «De Ordenex» como la ganancia de R2 más el saldo inicial y aportes, sin
  ningún movimiento de IVA.
- **R7** — El sistema DEBE cumplir, sobre cualquier conjunto de movimientos (con filtros o sin ellos), que la
  cifra principal de la caja es exactamente «De Ordenex» + «De las tiendas» + «IVA por pagar», al céntimo.
- **R8** — CUANDO se calcula la caja sobre un conjunto que no contiene Pagos de IVA ni sus anulaciones, el
  sistema DEBE devolver la misma cifra principal, «Entró», «Salió», «De las tiendas» y saldo inicial y
  aportes que antes de esta ficha para ese mismo conjunto.
- **R9** — CUANDO la persona pone filtros (periodo, tipo, concepto o «A quién») en la caja, el sistema DEBE
  calcular la ganancia, el IVA cobrado, el IVA por pagar y la composición de la ganancia sobre el mismo
  conjunto filtrado que el libro.
- **R10** — CUANDO se anula un cobro por devolución a origen, el sistema DEBE restar la anulación del IVA del
  IVA por pagar y del IVA cobrado, y NO DEBE restarla de la ganancia; la anulación del flete DEBE seguir
  restándose de la ganancia.

### B. La tarjeta de la caja (`/wallet`)

- **R11** — El sistema DEBE mostrar como cifra principal del bloque «Ganancia de Ordenex» la ganancia de R2.
- **R12** — El sistema DEBE mostrar, dentro del mismo bloque «Ganancia de Ordenex», debajo de la cifra y con
  tipografía más pequeña que ella, el IVA cobrado de R5 con un rótulo que nombre el IVA.
- **R13** — El sistema DEBE mostrar un tercer bolsillo «IVA por pagar», hermano de «De las tiendas» y del de
  Ordenex, con el importe de R4, su signo y una pista que diga que no es ganancia de Ordenex, en los dos
  estados de la caja («flujo» y «saldo») y con o sin filtros.
- **R14** — MIENTRAS la caja está en estado «saldo», el sistema DEBE pintar la barra de composición con una
  porción de IVA por pagar cuyo ancho, como las demás porciones, lo decide el servidor; el navegador NO DEBE
  comparar ni convertir importes.
- **R15** — MIENTRAS la caja está en estado «saldo», el nombre accesible de la barra DEBE enunciar los tres
  bolsillos («De las tiendas», «De Ordenex», «IVA por pagar») con su importe.
- **R16** — SI el IVA por pagar es cero o negativo, ENTONCES la barra NO DEBE pintar porción de IVA, y las
  porciones de los otros dos bolsillos DEBEN ser las mismas que antes de esta ficha para esos importes.
- **R17** — El sistema DEBE dejar de afirmar en la tarjeta que «todo lo que hay en la caja es de Ordenex»
  cuando las tiendas le deben a Ordenex; el texto DEBE ser cierto también con IVA por pagar positivo.
- **R18** — La nota que explica la diferencia entre la cifra principal y la ganancia DEBE decir que la
  ganancia no incluye el IVA.

### C. La composición de la ganancia

- **R19** — El sistema NO DEBE mostrar en la tarjeta «Composición de la ganancia» ninguna fila de IVA ni la
  anulación del IVA del flete por devolución a origen; sus totales de ingresos y gastos DEBEN ser los de R3.
- **R20** — SI se pide el detalle de una fila de la composición con un concepto de IVA, ENTONCES el sistema
  DEBE responder `validation_error` sin leer movimientos.

### D. El Pago de IVA

- **R21** — El diálogo de registrar movimiento de la caja DEBE ofrecer el concepto «Pago de IVA» en el grupo
  «Sale dinero de Ordenex», con los mismos campos que «Gasto de Ordenex» (monto, fecha, descripción, «A
  quién», referencia y comprobante opcionales) y una frase de efecto de una línea.
- **R22** — CUANDO una persona con acceso total registra un Pago de IVA de monto M, el sistema DEBE escribir
  una única salida en el libro de la caja con concepto «Pago de IVA» por M, de forma que «Salió» sube M, la
  cifra principal baja M y el IVA por pagar baja M, y la ganancia, «De las tiendas» y el saldo inicial y
  aportes no cambian.
- **R23** — El Pago de IVA NO DEBE escribir en el libro de ninguna tienda ni de ningún mensajero.
- **R24** — CUANDO la persona elige «Pago de IVA» y teclea un monto, el «Así queda» del diálogo DEBE incluir
  la línea «IVA por pagar» con su valor antes y después, calculada en el servidor.
- **R25** — CUANDO una persona con acceso total anula un Pago de IVA con motivo desde el libro de la caja, el
  sistema DEBE escribir una entrada «Pago de IVA anulado» por el monto del pago original, de forma que el IVA
  por pagar y la cifra principal suben ese monto y la ganancia no cambia, y el pago original DEBE quedar
  marcado como anulado en el libro.
- **R26** — SI el Pago de IVA ya está anulado, ENTONCES el sistema DEBE responder `ya_anulado` sin escribir
  nada.
- **R27** — SI quien registra o anula un Pago de IVA no tiene acceso total, ENTONCES el sistema DEBE
  responder `forbidden` sin escribir nada.
- **R28** — CUANDO se registra dos veces un Pago de IVA con la misma clave de idempotencia, el sistema DEBE
  escribir una sola salida.

### E. Libro, descargas, detalle y analítica

- **R29** — El libro de la caja y su descarga Excel DEBEN rotular «IVA por pagar» como dueño de cada movimiento
  de IVA, y nombrar los dos conceptos nuevos «Pago de IVA» y «Pago de IVA anulado».
- **R30** — El detalle de un movimiento («Cómo quedó») DEBE incluir el IVA por pagar tras el movimiento.
- **R31** — La métrica «Ganancia de Ordenex» de la analítica financiera (tablero y exportación) DEBE valer lo
  mismo que la ganancia de R2 sobre el mismo conjunto, y su descripción DEBE declarar que desde la ficha 488
  no incluye el IVA.
- **R32** — La métrica «Dinero en caja» de la analítica DEBE declarar los dos conceptos nuevos; la métrica
  «Egresos» DEBE contar el Pago de IVA y descontar su anulación, y su descripción DEBE declararlo; la métrica
  «Ingreso por IVA» NO DEBE cambiar.
- **R33** — La serie diaria de finanzas DEBE calcular la ganancia de cada día sin movimientos de IVA y contar
  el Pago de IVA en las salidas del día.

### F. Dinero, base de datos y ayuda

- **R34** — Todos los importes nuevos (IVA cobrado, IVA por pagar, porciones de la barra, líneas de «Así
  queda» y «Cómo quedó») DEBEN viajar del servidor al navegador como texto con dos decimales, nunca como
  número.
- **R35** — La base DEBE aceptar los dos conceptos nuevos solo con su tipo (el pago como salida, su anulación
  como entrada) y rechazar cualquier otra combinación.
- **R36** — La reversión de la migración DEBE quitar los dos conceptos nuevos sin tocar ningún otro valor del
  catálogo, y SI alguna fila los usa, ENTONCES DEBE abortar sin borrar nada.
- **R37** — La ayuda de la caja (`docs/ayuda/oficina/wallet-caja.md`) DEBE explicar el IVA por pagar, que la
  ganancia no incluye el IVA, el Pago de IVA y su anulación, y NO DEBE decir que anular un cobro por
  devolución a origen baja la ganancia en el IVA.
- **R38** — Los textos nuevos de pantalla DEBEN estar en español claro, sin siglas salvo «IVA», y vivir en los
  diccionarios de textos, fuera del JSX.

## Fuera de alcance (con motivo)

- **Ganancia del cierre** (`/cierres-admin`, detalle y factura del cierre; `CierresAdminService`
  `gananciaOrdenex`): es la ganancia **de un cierre**, otra cifra con otra derivación, no la de la caja. El
  pedido nombra `/wallet`. Ver P1.
- **`/mi-wallet` y `/wallet/tiendas`:** el IVA sigue siendo un cargo a la tienda; los saldos de las tiendas y
  «De las tiendas» no cambian (R8).
- **KPIs financieros y barras diarias de `/analitica` (`cargar-kpis.ts`, `FinanzasDiarioBarras.tsx`):**
  `@sin-superficie` desde el 2026-08-18 (sección comentada). Sus números cambian solos (salen de
  `derivarCaja` y `derivarFinanzasDiarias`); no se toca su UI.
- **Kardex y descarga por guía del libro (468):** solo usan la cifra principal, que no cambia (R8).
- **Tope del Pago de IVA** contra el IVA por pagar, una métrica nueva de «IVA por pagar» en la analítica, y
  plantillas de gasto fijo para el IVA: no pedidos. Ver P3.

## Preguntas abiertas

- **P1 — Ganancia del cierre.** El detalle y la factura del cierre (`/cierres-admin`) muestran una
  «ganancia» por cierre que hoy parece incluir el IVA (`gananciaOrdenex(totalesIngreso.total, …)`,
  `CierresAdminService.ts:835`). ¿Debe quitarse también el IVA ahí? Supuesto de este spec: **no**, queda
  fuera.
- **P2 — «Cuánto entró por IVA»: neto o bruto.** El spec usa el **neto de anulaciones** (los tres IVA cobrados
  menos las anulaciones del IVA del flete por devolución a origen), igual que la métrica «Ingreso por IVA» de
  la analítica. ¿O se quiere el bruto, sin restar anulaciones? Ninguna de las dos resta los Pagos de IVA.
- **P3 — Tope del Pago de IVA.** ¿Se puede registrar un Pago de IVA mayor que el IVA por pagar? Supuesto:
  **sí, sin tope** (como un gasto); el IVA por pagar queda negativo y la tarjeta lo muestra con su signo.
- **P4 — «A quién» en el Pago de IVA.** Supuesto: **obligatorio**, igual que «Gasto de Ordenex» y «Sueldo» (se
  escribe «Hacienda»). ¿Debe ser opcional o no pedirse?
- **P5 — Textos exactos.** Los textos de design §6 (rótulo bajo el KPI «IVA cobrado a las tiendas», pista del
  bolsillo, frase de efecto, nombre del concepto «Pago de IVA») son una propuesta; el humano puede ajustarlos
  línea a línea antes de aprobar.
- **P6 — «Egresos» de la analítica.** El spec cuenta el Pago de IVA en «Egresos» y descuenta su anulación
  (R32), siguiendo la regla de la 183 para los egresos administrativos. ¿Se prefiere dejarlo fuera?
