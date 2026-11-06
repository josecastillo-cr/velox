---
titulo: Wallet · Caja
modulo: wallet
pantalla: /wallet
roles: [maestro, admin]
actualizado: 2026-11-03
fuentes:
  - app/(app)/wallet/_components/WalletModule.tsx
  - app/(app)/wallet/_components/CajaResumenCard.tsx
  - app/(app)/wallet/_components/BarraComposicionCaja.tsx
  - app/(app)/wallet/_components/ComposicionGananciaCard.tsx
  - app/(app)/wallet/_components/WalletLedger.tsx
  - app/(app)/wallet/_components/wallet-filtros-input.ts
  - app/(app)/wallet/_components/LibroCajaBarra.tsx
  - app/(app)/wallet/_components/libro-caja-filtros.ts
  - components/shared/wallet/zonas-filtros-labels.ts
  - app/(app)/wallet/_components/a-quien-selector.ts
  - app/(app)/wallet/_components/libro-caja-labels.ts
  - lib/actions/wallet-filtros.ts
  - lib/actions/libro-caja-autoria.ts
  - app/(app)/wallet/_components/VerMovimientoCaja.tsx
  - components/shared/wallet/RegistrarMovimientoDialog.tsx
  - components/shared/wallet/AsiQueda.tsx
  - components/shared/wallet/DetalleMovimientoPanel.tsx
  - components/shared/wallet/AnularMovimientoDialog.tsx
  - components/shared/wallet/registrar-movimiento-labels.ts
  - app/(app)/wallet/_components/wallet-conceptos-manuales.ts
  - app/(app)/wallet/_components/wallet-labels.ts
  - app/(app)/wallet/_components/GastosFijosPlantillasPanel.tsx
  - app/(app)/wallet/tiendas/_components/desglose-tienda-labels.ts
  - lib/services/PagoPorCuentaTiendaService.ts
  - lib/services/AporteCapitalService.ts
  - lib/services/CobroTiendaService.ts
  - lib/services/CajaCobroTiendaFeedService.ts
  - lib/services/AjusteCajaService.ts
  - lib/services/AbonoTiendaService.ts
  - lib/services/RechazoTiendaCobroService.ts
  - lib/services/EgresoCajaAnulacionService.ts
  - lib/actions/wallet-anulacion.ts
  - lib/utils/descripcion-abono.ts
  - lib/actions/abono-tienda.ts
  - lib/utils/descripcion-pago-por-cuenta.ts
  - lib/utils/descripcion-cobro-tienda.ts
  - lib/utils/caja-tesoreria.ts
  - lib/utils/comprobante.ts
  - lib/types/wallet.ts
  - components/shared/conciliacion/MarcarRecibidoDialog.tsx
  - lib/repositories/asentar-cierre-dia.ts
---

# Wallet · Caja

**La caja de Velox Courier**: todo lo que entra y todo lo que sale. Es la pantalla del dinero de la empresa,
no del de las tiendas ni del de los mensajeros —esos tienen la suya—.

## Qué vas a ver

**El resumen de caja**, arriba: la cifra grande, lo que **entró** y lo que **salió**, la **ganancia de
Velox Courier** (sin el IVA) con el **IVA cobrado a las tiendas** debajo, el **saldo inicial y aportes**,
**lo que Velox Courier les debe a las tiendas**, el **IVA por pagar** y **Por cobrar a satélites**.

**Cómo se compone la ganancia**, desglosada por concepto, para ver de dónde sale de verdad el margen —
fletes, comisiones, lo que Velox Courier les cobra a las tiendas— y no solo el total. El IVA **no está** en
la composición: no es ganancia de Velox Courier (ver «El IVA por pagar», más abajo).

**El desglose de egresos**, del otro lado.

**El libro**: la lista de movimientos, uno por línea (ver «Las columnas del libro», más abajo). Cada
fila tiene un botón **Ver** que abre su detalle. Una fila anulada dice **Anulado** y se ve **tachada**.

## Las columnas del libro

| Columna | Qué dice |
| --- | --- |
| **Fecha** | El día del movimiento, en hora de Costa Rica |
| **Movimiento y motivo** | El concepto, dicho desde Velox Courier; debajo, de dónde nace (con la tienda, el mensajero o el cierre) y el motivo que se escribió |
| **A quién** | La tienda, el mensajero, la persona o el proveedor del movimiento. Si es una tienda o un mensajero, el nombre lleva a su estado de cuenta. **Velox** en un aporte, y **—** en un movimiento viejo que no lo anotaba |
| **Monto** | **Entra** o **Sale**, el importe y de quién es el dinero: **Velox**, **Tienda**, **Velox (capital)**, **IVA por pagar** o **Satélite** |
| **Registró** | Quién lo registró o, si no lo tecleó nadie, **Automático** y qué lo produjo: «Automático · Aprobación del cierre por Ana», «Automático · Plantilla de gasto fijo» |
| **Ver** | Abre el detalle del movimiento. En una fila anulada, al lado dice **Anulado** |

Mientras se lee, **A quién** y **Registró** dicen «Cargando…»; si no se pudieron leer, dicen **«No se
pudo leer»** (no «—», que significaría que no hay dato).

## Los nombres: siempre desde Velox Courier, y diciendo quién le paga a quién

Cada concepto del libro se lee desde Velox Courier y dice quién le paga a quién. Los que más se ven:

| En la caja dice | Qué es |
| --- | --- |
| **Flete cobrado a la tienda**, **Comisión de contra-entrega cobrada a la tienda**, **IVA del flete cobrado a la tienda**… | El servicio, cobrado a cada tienda al aprobarse un cierre. Las líneas de IVA son dinero **IVA por pagar**, no ganancia |
| **Contra-entrega cobrado a los clientes de la tienda** | Lo que el mensajero cobró a los clientes en nombre de la tienda. Es dinero de la tienda |
| **Velox Courier le cobra a una tienda** | Un cobro que la oficina le hace a mano a una tienda. Es ganancia de Velox Courier |
| **Cobro a una tienda anulado** | La anulación de ese cobro |
| **Velox Courier le paga a una tienda** / **Pago a una tienda anulado** | Lo que se le paga a una tienda de su saldo, y su anulación |
| **Velox Courier paga un gasto de una tienda** / **Pago de un gasto de una tienda anulado** | Lo que Velox Courier le pagó a un tercero en nombre de la tienda, y su anulación |
| **Velox Courier le paga a un mensajero** | El pago al mensajero |
| **Sueldo**, **Gasto de Velox**, **Gasto fijo de Velox** | Lo que Velox Courier gasta |
| **Corrección de caja (suma)** / **Corrección de caja (resta)** | Una corrección hecha a mano para cuadrar la caja |
| **Aporte de dinero a la caja** / **Aporte de dinero a la caja anulado** | El saldo inicial o un aporte de Velox Courier, y su anulación |
| **Una tienda le paga a Velox Courier** / **Pago de una tienda a Velox Courier anulado** | Lo que una tienda con saldo en contra le paga a Velox Courier, y su anulación. Es dinero de la tienda: sube lo que Velox Courier les debe a las tiendas |
| **Flete por devolución a origen cobrado a la tienda** / **Flete por devolución a origen cobrado a la tienda anulado** | El flete que Velox Courier le cobra a una tienda cuando su cliente rechaza el pedido, y su anulación. El IVA va en su propia línea, con su propia anulación |
| **Pago de IVA** / **Pago de IVA anulado** | Lo que Velox Courier le paga a Hacienda del IVA cobrado a las tiendas, y su anulación. Baja (o, al anularlo, sube) el IVA por pagar; la ganancia no cambia |
| **Indemnización que Velox Courier paga por un incidente** | Lo que Velox Courier paga cuando un envío sufre un incidente. Si se anula, aparece una **Corrección de caja (suma)** por el mismo monto |
| **Diferencia de la satélite (faltó)** / **Diferencia de la satélite (sobró o pagó)** | Al conciliar una consolidación de una bodega satélite, lo que llegó de menos (sale) o de más (entra) respecto de lo que debía. El dueño es **Satélite** y mueve **Por cobrar a satélites**; nace de la **Conciliación de satélite** y no se registra a mano |

Debajo del concepto, en **Movimiento y motivo**, se dice de dónde nace cada línea con el mismo criterio: **Cierre del día**,
**Registrado a mano**, **Gasto o sueldo registrado a mano**, **Pago de Velox Courier a una tienda**, **Pago de
un gasto de una tienda**, **Cobro de Velox Courier a una tienda**, **Pago de una tienda a Velox Courier**,
**Conciliación de satélite**…

## La cifra grande: «Flujo de dinero registrado» o «Dinero en caja»

La cifra grande es siempre la misma cuenta —**lo que entró menos lo que salió**—, pero **cambia de
nombre** según lo que la app sabe:

| La tarjeta dice | Cuándo | Qué significa |
| --- | --- | --- |
| **Flujo de dinero registrado** | No hay un saldo inicial registrado | Lo que entró menos lo que salió **desde el primer movimiento de la caja**. La tarjeta dice desde qué día cuenta |
| **Dinero en caja** | Alguien registró un saldo inicial | El saldo inicial más lo que entró menos lo que salió desde entonces |
| **Movimiento neto del periodo** | Elegiste un **periodo** o un **A quién** en la barra del libro | Lo que entró menos lo que salió **en lo que elegiste**. No es el dinero que hay hoy. Entra/Sale, Concepto, el buscador y el orden no la cambian |

> **«Flujo de dinero registrado» no es el saldo del banco.** La app no sabe con cuánto dinero empezó
> Velox Courier: solo cuenta lo que se registró desde que se empezó a usar. Por eso, mientras no haya un
> saldo inicial, la tarjeta no usa las palabras «Dinero en caja» y no pinta la barra de reparto.

### Por qué el flujo puede salir negativo

Si la tarjeta dice **Flujo de dinero registrado** y la cifra es negativa, **no es un error**: parte de
los pagos se hicieron con dinero que Velox Courier ya tenía **antes** de usar la app, y ese dinero no está
registrado. La salida sí quedó anotada; la plata con la que se pagó, no. La tarjeta lo dice con una
línea debajo de la cifra.

Si en cambio la tarjeta dice **Dinero en caja** y sale negativa, **sí hay algo que revisar**: el dinero
en caja no puede ser negativo. Revisá el saldo inicial y los pagos registrados.

### Lo que Velox Courier les debe a las tiendas

Es la **suma de los saldos de todas las tiendas**, ya descontados el flete, la comisión, el impuesto y
**lo que Velox Courier les cobró**. Si sale negativa, la tarjeta lo dice en palabras: son **las tiendas las
que le deben a Velox Courier**, y cuánto. El detalle de cada tienda está en **Wallet · Tiendas** («Ver la
deuda de cada tienda»).

### El IVA por pagar

El IVA que Velox Courier les cobra a las tiendas (el del flete, el del flete por devolución a origen y el de
la comisión) **no es de Velox Courier**: se le debe a Hacienda. Por eso:

- La **ganancia de Velox Courier** no incluye el IVA: es lo que Velox Courier gana menos lo que gasta, **sin el
  IVA**. Lo mismo los **ingresos** y **gastos de Velox Courier** de la tarjeta.
- Debajo de la ganancia, en letra más pequeña, la tarjeta dice el **IVA cobrado a las tiendas**: lo que
  entró por IVA, ya descontadas las anulaciones del IVA de un cobro por devolución a origen. Pagar IVA
  a Hacienda no lo cambia.
- La tarjeta tiene un tercer bloque, **IVA por pagar**, junto a «De las tiendas» y «De Velox»: el IVA
  cobrado a las tiendas **menos lo ya pagado a Hacienda**. Puede salir negativo si se pagó más de lo
  cobrado en lo que estás mirando.
- La cifra grande **no cambia**: cuenta todo el dinero, también el IVA. Siempre se cumple que la cifra
  grande es «De Velox» más «De las tiendas» más el IVA por pagar, menos **Por cobrar a satélites** (ver
  abajo).

### Por cobrar a satélites

El cuarto bloque de la tarjeta, **siempre visible**, también en 0. Es la cuenta de las **diferencias al
conciliar** las consolidaciones de las bodegas satélite: cuando la central marca recibido por menos de lo
que la bodega debía, la diferencia sale de la caja como **Diferencia de la satélite (faltó)** y este
bloque sube; cuando llega de más, o la bodega paga lo que faltaba y se corrige el monto, entra como
**Diferencia de la satélite (sobró o pagó)** y el bloque baja. Debajo de la cifra, una pista:

- si es positivo: «Lo que las satélites entregaron de menos al conciliar y aún no han pagado.»;
- si es negativo: «La central les debe a las satélites.»;
- en 0, sin pista.

No es ganancia ni gasto de Velox Courier, ni dinero de las tiendas. En el libro, esas filas llevan el dueño
**Satélite**.

### La barra de reparto

Solo aparece cuando hay un saldo inicial registrado (la cifra dice **Dinero en caja**). Parte el
dinero en **De las tiendas**, **De Velox** (ganancia más aportes), el **IVA por pagar** y **Por cobrar a
satélites**. Si «De Velox Courier» o «De las tiendas» está en negativo, la barra no se parte entre esos dos
y en su lugar te dice qué pasa; el IVA por pagar y «Por cobrar a satélites» se pintan solo cuando son
positivos, cada uno con su propio color.

## De dónde entra el dinero solo

La mayoría de los movimientos **no los teclea nadie**: entran cuando se aprueba el cierre de un
mensajero de la central. En ese momento se registra lo recaudado, los fletes, las comisiones y lo que se
le paga al mensajero, todo de una vez.

**Los cierres de una bodega satélite son la excepción: su dinero entra al conciliar, no al aprobar.**
Aprobar el cierre de un mensajero de una satélite no mete nada en la caja, porque ese dinero todavía está
en la bodega. Entra cuando, en **Wallet · Satélites**, se marca recibida la consolidación que lo contiene:
ahí se registran las mismas líneas de cada cierre y, si llegó de menos o de más, la **Diferencia de la
satélite**.

Por eso la caja va al ritmo de los cierres (y, en las satélites, de las conciliaciones), no de las
entregas: una entrega de hoy aparece cuando su cierre se apruebe o, si es de una satélite, cuando se
concilie.

## Lo que sí se registra a mano

**Registrar un movimiento** abre un diálogo con **once conceptos en tres grupos**, a la izquierda; a la
derecha, los campos del concepto que elegiste. Al elegir uno, el diálogo dice con una frase qué le pasa
al dinero de Velox Courier, al saldo de la cuenta (si la toca) y a la ganancia, y con qué nombre va a salir en
cada libro.

| Grupo | Conceptos |
| --- | --- |
| **Sale dinero de Velox Courier** | Gasto de Velox · Sueldo · Pago de IVA · Velox Courier paga un gasto de una tienda · Corrección de caja (resta) · Velox Courier le paga a una tienda · Velox Courier le paga a un mensajero |
| **Llega dinero a la caja** | Aporte de dinero a la caja · Una tienda le paga a Velox Courier · Corrección de caja (suma) |
| **Se descuenta del saldo de una tienda** | Velox Courier le cobra a una tienda |

Los gastos fijos no están en la lista: se cobran solos desde sus plantillas, y el diálogo tiene un
enlace a ellas.

**Lo que se pide.** En **todos** los conceptos, **el monto**, **la fecha** y **el motivo**, y un
**comprobante opcional**. Además, cada concepto pide lo suyo:

- **Sueldo**, **Gasto de Velox** y **Pago de IVA**: **a quién se le pagó** —la persona o el proveedor, con su nombre libre—. **Es obligatorio.** En el Pago de IVA se escribe «Hacienda». La referencia es
  opcional.
- **Corrección de caja**: **a quién**, si lo sabés (opcional), y la referencia, también opcional.
- **Los conceptos de una tienda o de un mensajero**: la cuenta, que se elige **buscando por su nombre**
  (solo cuentas activas).
- **Los pagos** (a una tienda, a un mensajero, de una tienda a Velox Courier, y el pago de un gasto de una
  tienda): **el método** —Efectivo, SINPE o Transferencia—; **en SINPE y transferencia la referencia es
  obligatoria**.

**Velox Courier le paga a una tienda** le entrega a la tienda lo que tiene a su favor: sale dinero de la caja
y baja **lo que Velox Courier les debe a las tiendas**; la ganancia no cambia. Solo se admite **hasta lo que
Velox Courier le debe** a esa tienda. **Velox Courier le paga a un mensajero** reparte el importe entre sus cierres
pendientes y baja lo que Velox Courier le debe; la caja no cambia con él.

**Pago de IVA** registra lo que Velox Courier le paga a Hacienda del IVA cobrado a las tiendas: sale dinero de
la caja (**Salió** sube y la cifra grande baja) y **baja el IVA por pagar**; la **ganancia no cambia**,
ni lo que Velox Courier les debe a las tiendas. Se pide **a quién** (Hacienda), **el monto**, **la fecha**,
**el detalle del pago** y, si los tenés, la referencia y el comprobante. No se compara contra el IVA por
pagar: si pagás más, el IVA por pagar queda en negativo.

### «Así queda»: el antes y el después, antes de registrar

Debajo del formulario, en cuanto escribís el monto (y elegís la cuenta, si el concepto la lleva), el
recuadro **Así queda** te dice cómo van a quedar, **antes y después**: el saldo de la cuenta, la cifra
grande de la caja, la **ganancia de Velox Courier**, **lo que Velox Courier les debe a las tiendas**, el **saldo
inicial y aportes** y el **IVA por pagar**. Lo que el concepto no mueve dice **«no cambia»**. Las cifras las calcula el
servidor con la misma cuenta que la tarjeta de arriba.

- Si la tienda **queda con el saldo en contra**, el recuadro lo avisa en palabras, con el saldo y su
  signo, antes de que confirmes.
- Si el monto **supera lo que se puede pagar**, lo dice.
- Si no se pudo calcular, lo dice y **no enseña cifras**: podés registrar igual, el servidor revisa el
  movimiento antes de guardarlo.

Al registrar, el diálogo se cierra, el aviso te dice cómo quedó (el saldo que devolvió el servidor) y el
libro, las tarjetas y la composición se actualizan solos. Si algo no está bien, lo dice **bajo el campo**
y lo que escribiste se queda.

**Gastos fijos.** En vez de teclear el mismo gasto cada mes, se define una plantilla con **cada cuánto
se cobra**, y se puede **activar o desactivar** sin borrarla. Los que quedan pendientes de cobrar
aparecen en su propio panel, **«Cobros de gasto fijo por aprobar»**, y ahí **solo el maestro decide**:
el maestro ve en cada fila **Aprobar** y **Rechazar**; el **admin ve la misma lista, pero sin botones**,
y no puede aprobar ni rechazar ningún cobro de gasto fijo. Si sos admin y hay uno esperando, avisale
al maestro. Mientras nadie decida, ese dinero **no sale** de la caja.

**Cobros por devolución a origen de tienda** tienen también su panel de pendientes.

## Velox Courier le cobra a una tienda: se descuenta de su saldo y es ganancia

Cuando Velox Courier le cobra algo a una tienda —material de despacho entregado en la bodega, por ejemplo—
ese cobro **se descuenta del saldo a favor de la tienda** y pasa a ser **ganancia de Velox Courier**.
**No llega dinero nuevo** a la caja: el dinero ya estaba ahí, guardado para la tienda, y cambia de
dueño. Por eso:

- La **ganancia de Velox Courier** sube en el monto.
- **Lo que Velox Courier les debe a las tiendas** baja en el monto, y el saldo de esa tienda también.
- **Entró**, **Salió** y la cifra grande **no cambian**.
- Si la tienda no tiene saldo a favor, **su saldo queda en contra**: le debe ese dinero a Velox Courier, y
  se cobra cuando la gestión le vuelva a generar dinero a favor. El cobro no se compara contra ningún
  saldo disponible.

En el libro de la caja sale como **Velox Courier le cobra a una tienda**, con **Entra**, dueño
**Velox** y origen **Cobro de Velox Courier a una tienda · la tienda · el motivo**. En **Wallet · Tiendas**
sale como **Velox Courier le cobra a la tienda**, y la tienda lo lee en su **Mi wallet** como **Velox Courier te
cobró**.

Se pide **la tienda** (solo tiendas activas), **el monto**, **la fecha** y **el motivo del cobro**. Al
registrarlo, el aviso te dice en cuánto quedó el saldo de la tienda y, si quedó en contra, que la
tienda le debe ese dinero a Velox Courier.

Algunos cobros antiguos no tenían su línea en la caja: se les añadió al corregir, con el origen
**Cobro de Velox Courier a una tienda (línea de caja completada al corregir)**. Se leen y se anulan igual
que los demás.

## Una tienda le paga a Velox Courier: llega dinero de la tienda y su saldo sube

Cuando una tienda está **en contra** —los cargos y los cobros de Velox Courier superaron lo que se le
recaudó— y le paga a Velox Courier lo que debe, se registra con **Una tienda le paga a Velox Courier**. Ese dinero
entra a la caja por el mismo bolsillo por el que habría entrado su contra-entrega: es dinero de la
tienda. Por eso:

- **Entró** y la cifra grande suben en el monto.
- **Lo que Velox Courier les debe a las tiendas** sube en el monto: la deuda de esa tienda baja.
- La **ganancia de Velox Courier no cambia**: lo que la tienda debía ya se contó como ganancia al aprobar cada cierre.
- Solo se admite si la tienda tiene **saldo en contra**, y **hasta lo que debe**. Si no debe nada, o si
  el monto supera lo que debe, el diálogo te lo dice bajo el campo y no registra nada.

Se pide **la tienda que paga**, **el monto**, **la fecha real del pago** (puede ser de hace meses; no
puede ser posterior a hoy), **el motivo del pago**, **el método de pago** —Efectivo, SINPE o
Transferencia; **en SINPE y transferencia la referencia es obligatoria**— y, si lo tenés, **un
comprobante** (opcional). Al registrarlo, el aviso te dice en cuánto quedó el saldo de la tienda y, si
sigue en contra, que la tienda todavía le debe ese dinero a Velox Courier.

En el libro de la caja sale como **Una tienda le paga a Velox Courier**, con **Entra**, dueño
**Tienda** y origen **Pago de una tienda a Velox Courier · la tienda · el motivo · el método**. En **Wallet ·
Tiendas** sale como «La tienda le paga a Velox Courier», y la tienda lo lee en su **Mi wallet** como «Le
pagaste a Velox Courier».

También se registra desde el desglose de la tienda en **Wallet · Tiendas**, con **Registrar pago de la
tienda a Velox Courier**: es el mismo formulario, con la tienda ya elegida. Solo aparece cuando la tienda
está en contra.

## Velox Courier paga un gasto de una tienda, u Velox Courier le cobra a una tienda: no son lo mismo

> **Elegir el equivocado descuadra la caja.** Los dos bajan el saldo de la tienda, pero solo uno
> registra que salió dinero. Ya pasó: pagos hechos en nombre de una tienda se anotaron como cobros,
> y la caja quedó mostrando dinero que ya se había ido.

La pregunta que decide es una sola: **¿salió dinero de Velox Courier hacia otra persona?**

| | Velox Courier paga un gasto de una tienda | Velox Courier le cobra a una tienda |
| --- | --- | --- |
| **Cuándo se usa** | Velox Courier **le pagó a un tercero en nombre de la tienda**: su proveedor, su publicidad, su personal | Velox Courier **le cobra algo** a la tienda y no le paga nada a nadie |
| **La caja** | **Baja: sale dinero** | **No cambia el dinero: pasa del saldo de la tienda a la ganancia de Velox Courier** |
| **El saldo de la tienda** | Baja en el monto | Baja en el monto |
| **La ganancia de Velox Courier** | No cambia | **Sube** en el monto |
| **En el libro de la tienda sale como** | «Velox Courier paga un gasto de la tienda» | «Velox Courier le cobra a la tienda» |
| **En la caja sale como** | «Velox Courier paga un gasto de una tienda», con dueño **Tienda** | «Velox Courier le cobra a una tienda», con dueño **Velox** |

**Un ejemplo.** Velox Courier le paga **₡50.000 a Facebook** por la publicidad de una tienda, con dinero de
Velox Courier.

- Bien registrado, como **Velox Courier paga un gasto de una tienda**: la caja baja ₡50.000 (esa plata se fue
  a Facebook) y el saldo de la tienda baja ₡50.000 (se lo descontás). Todo cuadra.
- Mal registrado, como **Velox Courier le cobra a una tienda**: el saldo de la tienda baja igual, pero la caja
  **no registra la salida** y la ganancia sube ₡50.000 que Velox Courier no ganó. La caja queda mostrando
  ₡50.000 que ya no están.

Y al revés: si le entregaste a la tienda material de despacho en la bodega y se lo cobrás, **no salió
dinero hacia nadie** y ese dinero **es de Velox Courier**. Eso es **Velox Courier le cobra a una tienda**.

### Qué pide el pago de un gasto de una tienda

- **La tienda** por la que se paga (solo tiendas activas).
- **A quién se le pagó**: un nombre libre —Facebook, Jet Cargo, el nombre de una persona—.
- **El monto**, **la fecha** y **el motivo del pago**.
- **El método de pago**: Efectivo, SINPE o Transferencia. **En SINPE y transferencia la referencia es
  obligatoria.**
- **Un comprobante**, si lo tenés. Es opcional.

Si la tienda no tiene saldo suficiente, **el pago se registra igual y su saldo queda en contra**: la
tienda le debe ese dinero a Velox Courier. Al registrarlo, el aviso te dice en cuánto quedó su saldo y si
quedó en contra.

## Aporte de dinero a la caja

Es **dinero de Velox Courier que entra a la caja y no es ganancia**. Es opcional: si nadie lo registra, la
cifra grande sigue siendo el **Flujo de dinero registrado**. Dentro del concepto se elige qué es:

- **Saldo inicial**: el dinero que Velox Courier tenía al empezar a usar la app. **Solo puede haber uno.** Su
  fecha no puede ser posterior al día del primer movimiento de la caja. Si hay que cambiarlo, se anula
  el vigente y se registra otro.
- **Aporte**: dinero de Velox Courier que entra después.

Se piden **qué es** (saldo inicial o aporte), **el monto**, **la fecha**, **el motivo** y, si lo tenés,
**un comprobante**.

> **La app nunca propone una cifra.** El monto lo escribe una persona que sabe cuánto había. El campo
> arranca vacío y no trae ni un ejemplo de importe: si no sabés la cifra real, no lo registres.

Al registrar un saldo inicial, la cifra grande pasa a llamarse **Dinero en caja** y aparece la barra de
reparto. Si se anula, vuelve a **Flujo de dinero registrado**. La ganancia no cambia en ningún caso.

## Ver un movimiento

**Ver**, en cada fila del libro, abre su detalle a un costado: **a quién** (la tienda, el mensajero, la
persona o el proveedor), **por qué** (el motivo), **de dónde sale**, **cómo** se pagó (el método y la
referencia, si los tiene), el **comprobante**, **quién lo registró** —o **Automático** y qué lo produjo,
como «Aprobación del cierre»— y **cuándo**: el día y la hora de Costa Rica en que se tecleó («Ana · el
2026-09-26 a las 21:30»), que puede no ser la fecha del movimiento (un sueldo del 1 registrado el 26), su **estado** (**Vigente**, o **Anulado** con el día, quién lo anuló, el
motivo y cómo se anuló) y **Cómo quedó**: la cifra grande, la ganancia, lo que Velox Courier les debe a las tiendas, el
saldo inicial y aportes y el IVA por pagar **justo después** de ese movimiento, y el saldo de la cuenta que tocó.

Un **cobro por devolución a origen** dice además en palabras que es un cargo a la tienda: la ganancia sube y el saldo
de la tienda baja, sin dinero nuevo en la caja.

## Anular: con motivo, y sin borrar nada

Un **sueldo**, un **gasto de Velox Courier**, un **pago de IVA**, un **gasto fijo cobrado**, un **pago de un gasto de una tienda**,
un **aporte de dinero a la caja**, un **cobro de Velox Courier a una tienda**, un **pago de una tienda a
Velox Courier** o una **corrección de caja** no se editan. Tampoco un **cobro por devolución a origen a una tienda** ni una
**indemnización por un incidente**. Ni un **pago de Velox Courier a una tienda** o un **premio del ranking**. Si hubo un error, se anulan desde el detalle de su fila: **Ver** y
luego **Anular…**. Es la misma forma para todos:

- **El motivo es obligatorio.** Queda guardado junto a la anulación.
- Se registra **hoy** un **movimiento contrario** por el mismo monto. El registro original, su
  comprobante y su historial **quedan intactos**: no se borra nada.
- La fila original pasa a decir **Anulado** y sale tachada. Una anulación no se deshace.
- Al anular un pago de un gasto de una tienda, la caja y el saldo de la tienda **vuelven a subir** en el
  monto. En el libro de la tienda aparece «Pago de un gasto de la tienda anulado».
- Al anular un cobro de Velox Courier a una tienda, la **ganancia baja** en el monto, **lo que Velox Courier les
  debe a las tiendas** y el saldo de la tienda **vuelven a subir**, y **Entró**, **Salió** y la cifra
  grande no cambian. En la caja aparece **Cobro a una tienda anulado**; en el libro de la tienda,
  «Cobro de Velox Courier a la tienda anulado».
- Al anular un pago de una tienda a Velox Courier, **Salió** sube en el monto, la cifra grande y **lo que
  Velox Courier les debe a las tiendas** bajan en el monto —la tienda vuelve a deber— y la ganancia no
  cambia. En la caja aparece **Pago de una tienda a Velox Courier anulado**; en el libro de la tienda, «Pago
  de la tienda a Velox Courier anulado».
- Al anular una corrección de caja, aparece la corrección contraria por el mismo monto.
- Un **cobro por devolución a origen** tiene dos líneas en la caja, el flete y su IVA: se anula desde **cualquiera de
  las dos** y se anulan **las dos juntas**. La **ganancia baja** en el flete y el **IVA por pagar** (y el
  IVA cobrado) en el IVA; **lo que Velox Courier les debe a las tiendas** y el saldo de la tienda **vuelven a
  subir** en el flete más el IVA (si al cobrarlo se le descontó a la tienda), y **Entró**, **Salió** y la
  cifra grande no cambian. En la caja aparecen
  **Flete por devolución a origen cobrado a la tienda anulado** y **IVA del flete por devolución a origen cobrado a la tienda
  anulado**. En **Analítica**, «Ingreso por flete» e «Ingreso por IVA» descuentan la anulación: el
  **neto** vuelve a ser el de antes del cobro.
- Al anular una **indemnización**, aparece una **Corrección de caja (suma)** por el mismo monto: la
  caja y la ganancia vuelven a subir.

Si te dice **«Ya estaba anulado; no se registró nada más»**, alguien se te adelantó. Si te dice **«Este
movimiento no se puede anular: …»** sobre un cobro, es uno de los cobros antiguos que ya se corrigieron como pago
de un gasto de la tienda, o uno sin su línea en la caja: se explica en el propio aviso.

Al anular un **gasto de Velox Courier**, un **sueldo** o un **gasto fijo cobrado**, se registra una **Corrección
de caja (suma)** por el mismo monto: la caja y la ganancia vuelven a subir. Los que se revirtieron antes,
sin motivo, se ven **Anulado · motivo no registrado**.

Al anular un **Pago de IVA**, se registra **Pago de IVA anulado** por el mismo monto: la cifra grande y
el **IVA por pagar** vuelven a subir, y la **ganancia no cambia**.

Lo que nace de un cierre, una anulación y las salidas de los cobros reclasificados **no ofrecen
Anular…**: el detalle no tiene el botón.

## El comprobante

- **Opcional.** Imagen JPEG, PNG o WebP, o un PDF, de hasta 4 MB. Un cobro a una tienda no lleva
  comprobante. El pago de una tienda a Velox Courier sí puede llevarlo.
- Se puede adjuntar **en todos los conceptos** al registrarlos.
- Se guarda **privado**: no tiene un enlace público. **Ver comprobante**, en el detalle de la fila
  (**Ver**), lo abre con un enlace que dura poco. Se nombra por lo que es —«Comprobante de «Sueldo» del
  2026-09-12»—, nunca por el nombre del archivo.
- Si un movimiento no tiene comprobante, en su detalle aparece **Adjuntar comprobante**, **una sola
  vez**: no se reemplaza ni se borra. Un movimiento anulado ya no admite uno.
- Si el comprobante no se pudo guardar, **no se registra nada**: probá de nuevo.

## Las fechas, en hora de Costa Rica

Todas las fechas de esta pantalla son días de Costa Rica: el «desde» de la cifra grande, la fecha de
un pago, de un cobro o de un aporte (**no puede ser posterior a hoy** en Costa Rica) y la de una
anulación, que se fecha **el día en que se anula**. Los movimientos a mano tienen además un límite hacia
atrás: si te pasás, la app te dice el primer día admitido. El aporte y el pago de una tienda a
Velox Courier no tienen ese límite: llevan la fecha real. Al filtrar por **Periodo**, el primer y el último
día son días completos de Costa Rica.

## Los cobros que eran pagos de un gasto

Algunos cobros antiguos se registraron como cobro cuando en realidad eran pagos hechos en nombre de
una tienda. Se corrigieron añadiendo su salida en la caja: en el libro aparecen como **Velox Courier paga un
gasto de una tienda** con el origen **Cobro reclasificado como pago de un gasto de la tienda**. Esas
salidas no se anulan desde acá, y la tienda los sigue viendo igual que antes en su libro.

## Buscar en el libro: los filtros

Los filtros están en **una sola barra, encima del libro**, en la misma fila que **Descargar**: el orden,
el buscador y el botón **Filtros**.

- **Más recientes / Más antiguas**: los dos botones con flechas del principio de la barra; el nombre de
  cada uno aparece al pasar el ratón. Se entra en **Más recientes**: lo último, arriba.
- **El buscador**: busca en la descripción, en el nombre o la referencia anotados y en quién registró
  el movimiento, sin distinguir mayúsculas. Escribí **al menos 3 caracteres**; con menos, el campo te
  dice cuántos faltan y no busca.
- **Filtros**: abre una lista de casillas —**Periodo**, **A quién**, **Entra/Sale** y **Concepto**—.
  Marcar una casilla pone su control en la barra, delante del buscador (marcarla sola no filtra nada);
  desmarcarla quita ese filtro.

Lo que hace cada casilla:

- **Periodo**: se eligen el primer y el último día en el calendario (días de Costa Rica) y se aplica
  solo, sin botón. Un solo día también vale.
- **A quién**: se elige de una lista de **las tiendas, los mensajeros y los nombres anotados a mano**
  (el de un sueldo, un gasto o una corrección) que tienen movimientos en el periodo, cada uno con qué es
  y cuántos movimientos tiene: «Tania Tienda · Tienda · 2 movimientos». Podés **buscar por el nombre de
  la tienda, del mensajero o de la persona**, sin mayúsculas ni tildes. Se aplica **al elegirlo**;
  **Todos** lo quita. Si la lista es muy larga, te pide que escribas parte del nombre.
- **Entra/Sale**: lo que entró a la caja o lo que salió. Sin elegir ninguno, dice **Todo**.
- **Concepto**: solo los conceptos con movimientos en el periodo y el «A quién» elegidos (y en Entra o
  Sale, si elegiste uno), cada uno con su número. Sin elegir ninguno, dice **Todos**.

**Periodo** y **A quién** mueven **toda la pantalla**: **las tarjetas de arriba, la composición de la
ganancia, el desglose de egresos, el detalle de cada fila de la composición y el libro cuentan solo el
periodo y el «A quién» elegidos**. Si elegís una tienda en **A quién**, lo que entró y lo que salió son
los movimientos cuyo **A quién** es esa tienda y la cifra grande pasa a llamarse **Movimiento neto del
periodo**. Ojo: el contra-entrega que cobró el mensajero a los clientes de esa tienda nace del cierre y
su **A quién** es el **mensajero**, no la tienda; para verlo, elegí al mensajero.

**Entra/Sale**, **Concepto**, el buscador y el orden **no cambian ninguna cifra**: solo qué filas del
libro se ven y en qué orden. Cualquier cambio vuelve a la primera página. **Limpiar todo** quita el texto
buscado, todos los filtros y todas las casillas (también el periodo y «A quién»); no toca el orden.

Si una lectura falla, la pantalla te lo dice y **se queda con lo que mostraba**: las cifras, el libro y
los filtros que ya estaban puestos, con sus casillas.

Si elegís un **nombre anotado** y alguno de sus sueldos, gastos o correcciones se **anuló**, aparecen las
dos filas —el anulado y su anulación, que también dice ese nombre en **A quién**— y se compensan: un
sueldo anulado no cuenta como dinero que salió.

Y se puede **descargar** el libro, con todos los filtros puestos, el texto buscado y el orden que estás
mirando, y las mismas columnas que la tabla (**A quién** y **Registró** incluidas), para cuadrar fuera.

## Lo que esta pantalla NO hace

- **No muestra lo que le debés a cada tienda.** Eso es **Wallet · Tiendas**.
- **No muestra lo que le debés a cada mensajero.** Eso es **Wallet · Mensajeros**.
- **No es el saldo del banco**, salvo que alguien haya registrado el saldo inicial real.
- **No se editan movimientos.** Un sueldo, un gasto, un pago de IVA, un pago de un gasto, un aporte, un cobro a una
  tienda, un pago de una tienda a Velox Courier, una corrección, un cobro por devolución a origen o una indemnización se
  anulan con motivo; los demás son inmutables.
- **No se corrigen cifras de entregas.** Un movimiento que nació de un cierre se arregla en el cierre,
  no acá.
