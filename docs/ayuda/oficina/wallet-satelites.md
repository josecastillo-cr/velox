---
titulo: Wallet · Satélites
modulo: wallet
pantalla: /wallet/satelites, /wallet/satelites/[zonaId]
roles: [maestro, admin]
actualizado: 2026-11-06
fuentes:
  - app/(app)/wallet/satelites/page.tsx
  - app/(app)/wallet/satelites/_components/SaldosSatelitesTable.tsx
  - app/(app)/wallet/satelites/[zonaId]/page.tsx
  - app/(app)/wallet/satelites/_components/EstadoCuentaSatelite.tsx
  - app/(app)/wallet/satelites/_components/ConciliacionSatelite.tsx
  - components/shared/estado-cuenta/EstadoCuenta.tsx
  - components/shared/estado-cuenta/estado-cuenta-labels.ts
  - components/shared/wallet/zonas-filtros-labels.ts
  - lib/services/EstadoCuentaService.ts
  - components/shared/conciliacion/ConciliacionAcciones.tsx
  - components/shared/conciliacion/MarcarRecibidoDialog.tsx
  - components/shared/conciliacion/conciliacion-labels.ts
  - lib/utils/conciliacion-satelite.ts
  - lib/repositories/deuda-satelite-sql.ts
  - lib/repositories/SaldosSatelitesRepository.ts
---

# Wallet · Satélites

**Lo que cada bodega satélite le debe a la central.** Cada satélite cobra con sus mensajeros, se queda
con lo suyo y le manda a la central el resto; esta pantalla lleva la cuenta de qué llegó y qué no.

> **El dinero de una satélite entra a la caja cuando marcás recibida su consolidación.** Aprobar el
> cierre de un mensajero de una satélite **no** mete nada en la caja de Velox Courier: ese dinero todavía
> está en manos de la bodega. Al marcar recibida la consolidación, entra a la caja todo lo de sus
> cierres —lo cobrado, los fletes, las comisiones, el pago a sus mensajeros— y, si llegó de menos o de
> más, la diferencia (ver **Wallet · Caja**, «Por cobrar a satélites»).

## Las tres cifras de arriba

**Pendiente de conciliar** — lo que las bodegas todavía deben, con cuántas consolidaciones y de cuántas
bodegas.

**Recibido este mes** — lo que sí llegó.

**Con diferencia** — cuando a alguna consolidación le llegó una cantidad distinta de la que debía.

## Lo que debe una bodega

Una consolidación incluye efectivo, SINPE y transferencias. **La bodega debe todo lo recaudado, por
cualquier método, menos lo que es suyo**: el pago a sus mensajeros y su ganancia por los rechazos. El
SINPE y la transferencia cuentan aunque no viajen en el bulto: si el cliente los consignó directo a la
cuenta de la central, la central los confirma al marcar recibido.

La deuda de una bodega suma también los **cierres ya aprobados que todavía no consolidó**.

## La tabla

Una fila por bodega: **Pendiente** (lo que debe), **Sin consolidar** (lo aprobado que todavía no entró en
ninguna consolidación y, debajo, cuántos cierres lo forman), **Más antigua sin conciliar** (cuánto lleva
esperando) y **Última recibida**. Con el conmutador **Con pendiente / Todas** te quedás solo con las que
deben algo. Cada fila lleva **Ver estado de cuenta**. La descarga trae las mismas columnas, con **Sin
consolidar** y **Cierres sin consolidar**.

## El estado de cuenta de una bodega

Es la cuenta de la bodega con la central, como un extracto. Arriba, lo que **tiene por entregar hoy**
con una frase («FGAM Puntarenas tiene ₡115.000 por entregar»), y las cifras del periodo: **Por entregar
al inicio**, **Declarado en el periodo**, **Recibido en el periodo** y **Por entregar al final del
periodo**.

El extracto, del más antiguo al más reciente, tiene tres clases de filas: **Consolidación declarada** (lo
que la bodega debe por esa consolidación, todos los métodos de pago), **Recibido en la central** (lo que
marcaste que llegó) y **Cierre del día sin consolidar** (un cierre ya aprobado que la bodega todavía no
consolidó), y después de cada una **lo que la bodega tiene por entregar** en ese momento. Cuando la bodega
consolida ese cierre, su fila suelta desaparece y su importe pasa a la consolidación; lo que tiene por
entregar no cambia. Se filtra con **una sola barra encima de la tabla**, en la misma fila que
**Descargar**: el orden **Más recientes / Más antiguas** (dos botones con flechas), un buscador
(descripción y quién registró, al menos 3 caracteres) y el botón **Filtros**, con dos casillas:
**Periodo** (se elige en el calendario y se aplica solo; es el único que cambia también las cifras de
arriba) y **Tipo de movimiento** (**Declarado · Recibido**; sin elegir ninguno, dice **Todo**). Marcar una
casilla pone su control en la barra; desmarcarla quita ese filtro, y **Limpiar todo** los quita todos sin
tocar el orden. Se puede **descargar** el periodo entero, con los filtros puestos.

## Marcar que llegó

Debajo del estado de cuenta de la bodega están sus consolidaciones. Cada una enseña tres bloques:

- **Recaudado**: efectivo, SINPE, transferencia y el total.
- **De la satélite**: el pago a sus mensajeros y su ganancia por rechazos.
- **Debe y recibido**: lo que **debe**, el **monto recibido** y lo que **falta por recibir**.

| Estado | Qué significa |
| --- | --- |
| **Pendiente de conciliar** | La bodega lo envió; todavía no confirmaste que llegó |
| **Recibido** | Llegó completo o de más |
| **Recibido incompleto** | Llegó, pero por menos de lo que debía |

**Marcar recibido** abre un diálogo con el monto ya puesto: **lo que debe** la consolidación. Encima del
campo ves lo recaudado por método y el aviso «Escribe todo lo que recibió la central por esta
consolidación: lo que entregó la satélite más el SINPE o la transferencia que llegó directo a la cuenta
de la central.». **El monto es el total** que llegó a la central, por cualquier método y a cualquier
cuenta: no se reparte por método. Si llegó lo mismo, confirmás y listo. **Si llegó otra cosa, cambiás el
número**: la diferencia queda anotada, sigue contando como pendiente de esa bodega y entra a la caja como
«Por cobrar a satélites». Al marcar, el estado de cuenta de esa bodega y su fila de la tabla se
actualizan solos.

**El 0 solo cuando no hay nada que entregar.** Si la consolidación no debe nada (lo de la satélite se
comió todo lo recaudado), el campo viene en 0 y podés marcarla así. Si debe algo, la app no admite un
recibido de 0 y te dice «Esta consolidación tiene dinero por entregar: el monto recibido no puede ser
0.»; no cambia nada.

## Una vez marcada, se corrige

> Marcar recibido asienta el dinero en la caja. Después no se puede desmarcar: si el monto no es el correcto, usa «Corregir»

Si el monto que marcaste no era el correcto, **Corregir** lo cambia: la caja recibe solo la diferencia
entre lo de antes y lo nuevo, y queda registrado **quién corrigió y cuándo**. Si intentás **Desmarcar**
una consolidación que ya entró a la caja, la app no deshace nada y te dice «Ya entró a la caja: corrige el
monto en vez de revertir».

**Corregir** aparece en una consolidación recibida incompleta o recibida de más.

**Desmarcar** solo aparece en una consolidación que todavía no movió dinero en la caja. Si lo ves en una
que sí lo movió es porque la pantalla se cargó antes de que alguien corrigiera el monto: la app te avisa y
no cambia nada.

## Saldada con la regla anterior

Las consolidaciones que se marcaron **antes de este cambio** se dan por **saldadas tal como se marcaron**,
sin tocar lo que se anotó como recibido. Llevan el rótulo **Saldada con la regla anterior** y su **Debe**
es lo que se marcó entonces, así que no deben nada. Esa fila no ofrece ningún botón, ni **Corregir** ni
**Desmarcar**: su monto no se puede cambiar desde la pantalla.

## Qué ve la bodega

La satélite **ve su propia marca y su diferencia** donde ya mira, pero **no puede marcar, corregir ni
desmarcar**. Es a propósito: si recibiste menos de lo que debía, la bodega tiene que enterarse ahí mismo y
no semanas después cuando alguien se lo reclame.

## Un cambio que conviene saber

Antes, mientras la central no aprobaba el cierre de una bodega, **esa bodega no podía asignar trabajo
nuevo**. Eso se quitó: ahora la satélite cierra sola y esta pantalla es de **seguimiento**, no de
permiso. Nadie se queda parado esperando una firma.

A cambio, **nada obliga a la bodega a cuadrar** salvo que alguien mire. Por eso la tabla enseña cuánto
lleva esperando la consolidación más antigua: esa columna es el sustituto del freno.

## Lo que esta pantalla NO hace

- **No aprueba cierres.** Los cierres de mensajero se aprueban en **Cierres**; aprobar el de una satélite
  no mete dinero en la caja.
- **No es la caja de Velox Courier.** Eso es **Wallet · Caja**: ahí se ve lo que entró al marcar y el
  bloque «Por cobrar a satélites».
- **No reparte lo recibido por método ni por cuenta.** Lo recibido es un solo total.
