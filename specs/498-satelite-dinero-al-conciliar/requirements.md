# Ficha 498 — El dinero de la bodega satélite entra a la caja de la central solo al conciliar

> **El defecto, en una frase.** Al aprobar un cierre del día con destino `bodega_satelite`, la
> transacción de aprobación escribe en la caja de la central, en el libro por tienda y en el libro del
> mensajero (COD, flete, comisión, IVA, egreso del pago al mensajero, indemnización) **sin mirar el
> destino**, aunque ese dinero todavía está en la satélite. Además, la deuda de cada satélite se
> calcula solo sobre el efectivo de sus consolidaciones, y no cuenta ni los cierres aprobados sin
> consolidar ni el SINPE o la transferencia.
>
> **Origen.** H3 de `progress/prompt-hotfix-portable.md` (adoptado ENTERO por el humano el
> 2026-11-02), con las rutas reales de `progress/inventario_hotfix_H2_H3_H5.md` §2.
>
> **Decisiones del humano del 2026-11-02 que este spec da por cerradas:**
>
> - Se **revoca** la decisión Q2 del 2026-09-16 (deuda solo sobre efectivo). La deuda usa
>   `paraLaCentral` sobre todos los métodos de pago. Una sola fórmula.
> - Se **revoca** el carácter informativo y reversible de la conciliación (fichas 431 y 473).
> - Sin multiempresa: sin `organizacion_id`, sin RLS por empresa y sin test de dos empresas.
> - El esquema `respaldo` es nuevo. Que sea «inaccesible para la app» es una limitación aceptada, no un
>   requisito, porque la app entra con un rol de acceso total.
> - No hay incentivos. El libro del mensajero excluye del retiro `premio_ranking` y las filas con
>   `premio_dia`.
> - La medición en producción está hecha y la migración de datos pasa sus guardas.
>
> **Depende de:** 497 (va antes y toca la misma transacción de aprobación). Este spec parte del estado
> posterior a la 497: la marca de las barridas vive en el bloque de la 238, después del dinero.

---

## Vocabulario

| Término | Qué significa aquí |
| --- | --- |
| **cierre** | `cierre_dia`: el cierre del día de un mensajero. |
| **cierre satélite** / **cierre central** | Cierre con `destino_tipo = bodega_satelite` / `bodega_central`. |
| **consolidación** | `cierre_bodega`: agrupa cierres satélite aprobados de una zona satélite. |
| **los tres libros** | `wallet_movimiento` (caja de la central), `wallet_tienda_movimiento` (libro por tienda) y `pago_mensajero_movimiento` (libro del mensajero). |
| **asentar un cierre** | Escribir en los tres libros lo que hoy escribe la aprobación: los cinco escritores de dinero (caja, libro por tienda, COD a caja, libro del mensajero con su egreso de caja, egreso de indemnización). |
| **aporte** | Lo que la satélite entrega a la central: `total_general − total_pago_mensajero − total_ingreso_bodega_rechazos`, con signo y sin recortar a cero. Es `paraLaCentral`. |
| **esperado** | El aporte de la consolidación, calculado desde su snapshot. |
| **diferencia asentada** | Suma con signo de las diferencias ya escritas para una consolidación (marca + correcciones). |
| **delta** | `(esperado − recibido) − diferencia asentada`. |
| **cierre que cuenta en la deuda** | Cierre satélite en `aprobado`, consolidado o no y sea cual sea el estado de su consolidación. |
| **sin consolidar** | Cierre que cuenta en la deuda y no pertenece a una consolidación no rechazada. |
| **con asientos** | Consolidación con alguna fila en los tres libros cuyo origen sea uno de sus cierres, o con alguna fila de ajuste. |
| **conjunto S** | Cierres satélite en `aprobado` sin consolidación, o con la consolidación sin conciliar (`conciliado_at IS NULL`). |
| **Por cobrar a satélites** | Bolsillo nuevo de la caja: lo que las satélites entregaron de menos al conciliar y aún no han pagado. |

---

## A · Aprobar un cierre del día

**R1.** CUANDO se aprueba un cierre satélite, el sistema NO DEBE escribir ninguna fila en ninguno de
los tres libros.

**R2.** CUANDO se aprueba un cierre satélite, el sistema DEBE hacer en la misma transacción todo lo que
no es dinero, igual que antes: la transición de estado, el monto de indemnización capturado en la
gestión, la liberación de las órdenes en novedad interna, las devoluciones, la aplicación de
gestiones, la marca de confirmación física y el historial.

**R3.** CUANDO se aprueba un cierre central, el sistema DEBE escribir en los tres libros exactamente
las mismas filas que antes de esta ficha (categoría, tipo, monto, origen y número de filas) y en el
mismo orden.

**R4.** El sistema DEBE decidir si asienta al aprobar a partir del destino del cierre leído **dentro**
de la transacción de aprobación. SI el destino no es uno de los conocidos, ENTONCES el sistema DEBE
revertir la aprobación en vez de elegir una rama por defecto.

**R5.** El sistema DEBE asentar un cierre con un único procedimiento compartido por la aprobación y la
conciliación. Ese procedimiento escribe las mismas filas y en el mismo orden que la aprobación escribía
antes, y es idempotente: ejecutarlo dos veces sobre el mismo cierre no añade filas.

**R6.** DONDE un llamador construya el escritor de la conciliación sin inyectar los escritores de
dinero, el sistema DEBE usar los escritores reales, de modo que la marca escriba filas en los libros.

**R7.** El procedimiento de asiento NO DEBE escribir premios del ranking ni ninguna fila con
`premio_dia`.

## B · Marcar recibida una consolidación

**R8.** CUANDO se marca recibida una consolidación, el sistema DEBE asentar, en la misma transacción
que la marca, cada cierre satélite aprobado que pertenezca a esa consolidación.

**R9.** CUANDO se marca recibida una consolidación, el sistema DEBE calcular el esperado con la misma
función que da «Para la central», sobre el snapshot de la consolidación, conservando el signo.

**R10.** CUANDO se marca recibida una consolidación y el delta es distinto de cero, el sistema DEBE
escribir una fila de ajuste (evento `marca`, esperado, recibido y diferencia igual al delta) y
**exactamente un** movimiento de caja con origen en esa fila: un egreso «diferencia de la satélite»
por el delta si el delta es positivo, o un ingreso «diferencia de la satélite» por su valor absoluto si
es negativo.

**R11.** SI el delta es cero, ENTONCES el sistema NO DEBE escribir ni fila de ajuste ni movimiento de
diferencia.

**R12.** El sistema NO DEBE prorratear la diferencia: los asientos de los cierres entran completos y la
diferencia va en una sola fila de caja.

**R13.** El sistema DEBE fechar los asientos y la diferencia escritos al marcar con el instante de la
conciliación, no con el de la aprobación del cierre.

**R14.** SI falla cualquier escritura del asiento o de la diferencia, ENTONCES el sistema DEBE revertir
la marca entera: la consolidación queda sin conciliar y no queda ninguna fila nueva en los tres libros
ni en la tabla de ajustes.

**R15.** CUANDO se intenta marcar una consolidación ya marcada, el sistema DEBE responder conflicto sin
escribir ninguna fila.

**R16.** CUANDO se abre el diálogo de marcar recibido, el sistema DEBE proponer como monto lo que la
satélite debe por esa consolidación (su aporte), no su efectivo.

## C · Corregir el monto recibido

**R17.** CUANDO se corrige el monto recibido de una consolidación conciliada, el sistema DEBE calcular
el delta con la misma fórmula de R10 y, si es distinto de cero, escribir una fila de ajuste con evento
`correccion` y un movimiento de diferencia solo por esa variación, sin volver a asentar los cierres.

**R18.** SI al corregir el delta es cero, ENTONCES el sistema NO DEBE escribir ni fila de ajuste ni
movimiento de caja.

**R19.** El sistema NO DEBE modificar ni borrar ningún movimiento ni ninguna fila de ajuste anterior
al corregir.

## D · Revertir (Desmarcar)

**R20.** SI la consolidación tiene asientos, ENTONCES el sistema DEBE responder a «revertir» con un
desenlace propio, `con_asientos`, sin cambiar nada: ni la marca, ni el historial, ni los libros.

**R21.** CUANDO el desenlace de revertir es `con_asientos`, la pantalla DEBE mostrar: «Ya entró a la
caja: corrige el monto en vez de revertir».

**R22.** MIENTRAS una consolidación conciliada no tenga asientos, el sistema DEBE revertirla como hoy.

## E · Deuda de las satélites

**R23.** El sistema DEBE calcular la deuda de una zona satélite como Σ aportes de todos sus cierres que
cuentan en la deuda − Σ `monto_recibido` de sus consolidaciones no rechazadas. El aporte incluye todos
los métodos de pago.

**R24.** El sistema DEBE mostrar por zona, aparte, cuánto está sin consolidar y cuántos cierres lo
forman.

**R25.** El sistema DEBE calcular la cabecera de saldos y la descarga con la misma fórmula que las
filas, y la suma de las deudas de las filas DEBE ser igual al pendiente de la cabecera.

**R26.** El sistema DEBE derivar «Falta por recibir» de una consolidación como
`aporte(consolidación) − (recibido ?? 0)` desde una sola función, y usarla en todas las pantallas y
descargas que la muestran.

**R27.** La tarjeta de conciliación del cierre de bodega DEBE cumplir «Recibido + Falta por recibir =
Para la central».

**R28.** El sistema DEBE tener una sola definición del aporte. SI la deuda se agrega en SQL, ENTONCES
la expresión SQL DEBE dar el mismo resultado que la función, con signo, sobre los mismos datos.

## F · Estado de cuenta de la bodega

**R29.** El estado de cuenta de una bodega DEBE tomar como «declarado» de cada consolidación no
rechazada la suma de los aportes de sus cierres, no su efectivo.

**R30.** El estado de cuenta DEBE incluir una fila por cada cierre sin consolidar de la zona.

**R31.** Sin filtros, el pendiente final del estado de cuenta DEBE ser igual a la deuda de esa zona en
la pantalla de saldos. Para cualquier periodo, «Por entregar al inicio» + declarado − recibido DEBE ser
igual a «Por entregar al final».

**R32.** El estado de cuenta y la pantalla de saldos DEBEN usar el mismo predicado de «cierre que
cuenta en la deuda» y la misma expresión del aporte, declarados en un solo sitio.

## G · La caja de la central

**R33.** El sistema DEBE clasificar las dos categorías de diferencia de la satélite con un dueño nuevo,
«Por cobrar a satélites», y con liquidez efectivo.

**R34.** CUANDO el vocabulario de dueños de la caja gane un valor, el sistema NO DEBE compilar hasta que
cada rama que reparte por dueño lo trate explícitamente.

**R35.** El sistema DEBE cumplir la identidad `Entró − Salió = ganancia + IVA por pagar + capital + De
las tiendas − Por cobrar a satélites`, con una diferencia positiva, con una negativa y sin diferencia.

**R36.** El sistema DEBE seguir cumpliendo «De las tiendas» = Σ saldos de las tiendas, con una
diferencia positiva, con una negativa y sin diferencia.

**R37.** La caja DEBE mostrar siempre el bloque «Por cobrar a satélites», también con 0. SI el bolsillo
es positivo, ENTONCES su pista DEBE decir «Lo que las satélites entregaron de menos al conciliar y aún
no han pagado.». SI es negativo, ENTONCES DEBE decir «La central les debe a las satélites.».

**R38.** MIENTRAS el bolsillo «Por cobrar a satélites» sea positivo, la barra de composición DEBE
pintarlo como un tramo propio, sin descontarlo del tramo de la empresa. Cada tramo DEBE quedar entre 0 %
y 100 % y los tramos DEBEN sumar 100 %, sin división por cero.

**R39.** MIENTRAS el bolsillo «Por cobrar a satélites» sea cero o negativo, la barra DEBE quedar
exactamente como antes de esta ficha: mismos segmentos, mismas medidas y mismo orden.

**R40.** El libro de caja y su descarga DEBEN rotular «Satélite» el dueño de las filas de diferencia.

## H · Pantallas y textos

**R41.** La conciliación DEBE mostrar, por consolidación: lo recaudado por método (efectivo, SINPE,
transferencia) y su total; lo que pertenece a la satélite (el pago a sus mensajeros y su ganancia por
rechazos); y lo que debe, lo recibido y lo que falta.

**R42.** La tabla de saldos de satélites y su descarga DEBEN incluir la columna «Sin consolidar».

**R43.** Ningún texto de la aplicación, de sus contratos ni de la ayuda de usuario DEBE decir que la
marca de conciliación es informativa, que desmarcar no mueve dinero o que la marca no escribe en ningún
libro. La nota de la conciliación DEBE decir, literalmente: «Marcar recibido asienta el dinero en la
caja. Después no se puede desmarcar: si el monto no es el correcto, usa «Corregir»».

**R44.** La ayuda de usuario de Wallet · Satélites y la de Wallet · Caja DEBEN describir el
comportamiento nuevo: el dinero de un cierre satélite entra a la caja al conciliar, la deuda cuenta
todos los métodos de pago menos lo que pertenece a la satélite, la columna «Sin consolidar», el
desenlace de revertir con asientos y el bolsillo «Por cobrar a satélites».

## I · Autorización

**R45.** El sistema DEBE reservar marcar, corregir y revertir a quien hoy tiene ese permiso, con el
control de rol antes de tocar cualquier repositorio, también en los caminos nuevos (asiento,
diferencia y `con_asientos`).

## J · Esquema y migración de datos

**R46.** El sistema DEBE añadir las categorías de caja `egreso_diferencia_satelite` e
`ingreso_diferencia_satelite` y el origen `conciliacion_bodega_ajuste` en una migración propia, y el
CHECK tipo↔categoría de la caja DEBE admitir el egreso solo como `egreso` y el ingreso solo como
`ingreso`, partiendo de su definición vigente.

**R47.** El sistema DEBE registrar cada evento que mueve la diferencia en una tabla de ajustes
append-only. Cada fila DEBE apuntar a su consolidación sin permitir borrarla, guardar evento (`marca` o
`correccion`), esperado, recibido y diferencia en decimal de dos posiciones con diferencia distinta de
cero, quién lo hizo y cuándo, y admitir como mucho una fila `marca` por consolidación. La tabla DEBE
tener RLS habilitada con el patrón del repositorio.

**R48.** CUANDO se aplica la migración de datos, el sistema DEBE retirar de los tres libros las filas
con origen en un cierre del conjunto S, seleccionadas por predicado y nunca por ids escritos en la
migración.

**R49.** La migración de datos NO DEBE retirar filas de premio del ranking ni filas con `premio_dia`,
ni ninguna fila de cierres centrales ni de cierres cuya consolidación esté conciliada.

**R50.** SI algún cierre del conjunto S tiene un pago al mensajero registrado contra él, ENTONCES la
migración de datos DEBE abortar con un error que dé el conteo, sin cambiar nada.

**R51.** La migración de datos DEBE copiar íntegra cada fila retirada a una tabla de respaldo fuera del
esquema `public`, con clave `(tabla, id)`, y borrar de los libros solo las filas presentes en ese
respaldo, todo en un único bloque que se aplica entero o no se aplica.

**R52.** CUANDO se revierte la migración de datos, el sistema DEBE reinsertar las filas desde el
respaldo sin duplicar, borrar solo su tabla de respaldo y borrar el esquema solo si queda vacío.
Aplicar, revertir y volver a aplicar DEBE dejar los tres libros igual que la primera aplicación.

**R53.** CUANDO se revierten las migraciones de esta ficha en orden inverso, la base DEBE quedar sin la
tabla de ajustes, sin los tres valores de enum y sin filas que los usen, y sin perder ningún valor de
enum añadido por otra migración.

**R54.** CUANDO se concilia una consolidación que contiene un cierre retirado por la migración de
datos, el sistema DEBE volver a asentar ese cierre.

## K · Lo que no cambia

**R55.** El sistema NO DEBE cambiar ninguna escritura ni lectura de los cierres centrales, salvo que el
asiento pasa por el procedimiento compartido de R5.

---

## Fuera de alcance

- Multiempresa (decisión del humano): sin `organizacion_id`, sin RLS por empresa y sin test de dos
  empresas.
- Lo que H5 pide «después de H3»: ofrecer «Desmarcar» solo cuando se puede, revertir sin diferencia
  huérfana, retirar los respaldos y los textos finales de H5. Aquí «Desmarcar» se sigue ofreciendo y el
  servidor responde `con_asientos` (R20/R21).
- Registrar la ganancia de la satélite como egreso de la caja y el libro del mensajero en un cierre todo
  SINPE: son las preguntas abiertas del origen (Q1 y Q2). No se resuelven aquí.
- Cifras de producción: la medición la hizo el humano y no va al repositorio.

---

## Preguntas abiertas

**Q1 (del origen, no bloquea, no se resuelve aquí).** La ganancia de la satélite no se registra como
egreso de la caja.

**Q2 (del origen, no bloquea, no se resuelve aquí).** En un cierre todo SINPE, el libro del mensajero
lo deja con una cuenta por pagar aunque la satélite ya descontó su pago.

**Q3 (no bloquea). Consolidaciones rechazadas.** Leyendo el código, **no hay ningún camino vivo que
apruebe una consolidación sin conciliarla.** `aprobarCierreBodega` sigue exportada como Server Action
(`lib/actions/cierre-bodega.ts:391`) y su servicio llama a `resolverCierreBodega`, pero el CHECK
`cierre_bodega_conciliacion_coherente` (`db/migrations/20260919120100_cierre_bodega_conciliacion/migration.sql:98-104`)
rechaza cualquier `aprobado` sin `conciliado_at`, `conciliado_por` y `monto_recibido`. Esa vía falla en
la base. Lo que **sí** sigue vivo es `rechazarCierreBodega` (Server Action exportada, sin botón). Una
consolidación rechazada deja sus cierres con `cierre_bodega_id` apuntándola. Esos cierres no pueden
volver a consolidarse, porque `consolidablesWhere` exige `cierre_bodega_id IS NULL`, ni conciliarse,
porque la marca exige `solicitado`. Con esta ficha cuentan en la deuda como «sin consolidar» (R23/R24),
pero su dinero **no entrará nunca a la caja**. ¿Se acepta como límite conocido (sin botón no hay
camino de uso) o se pide una ficha aparte que, al rechazar, desvincule los cierres o retire la acción?
Esta ficha no lo cambia.

**Q4 (no bloquea). Consolidaciones conciliadas antes de esta ficha.** Se marcaron contra el efectivo.
Con la fórmula nueva, su deuda pasa a incluir el SINPE y la transferencia menos lo que pertenece a la
satélite. Esa diferencia aparece en la pantalla de saldos, pero no en «Por cobrar a satélites», porque
no tienen fila de ajuste. Además no se pueden desmarcar: tienen asientos de la aprobación antigua (R20).
Propuesta: aceptarlo y regularizarlas con «Corregir». Si se corrige al aporte, el delta da cero y no se
escribe nada en la caja (R18). ¿De acuerdo, o se quiere una regularización por migración?

**Q5 (no bloquea). Aporte cero o negativo.** El borde exige un monto recibido mayor que cero
(`montoPositivoSchema`, ficha 431), pero una consolidación con aporte ≤ 0 no tiene nada que entregar.
Hoy se puede marcar con un monto positivo, y eso escribe una diferencia de ingreso. ¿Se permite marcar
con 0 cuando el aporte es ≤ 0? La base ya lo admite (`monto_recibido >= 0`). Esta ficha no cambia el
borde. El diálogo propone el aporte solo si es positivo; si no, el campo arranca vacío (design §8.2).
