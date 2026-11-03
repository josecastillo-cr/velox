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
> **Respuestas del humano del 2026-11-02 a las preguntas de este spec (Q3, Q4, Q5) y al SINPE:**
>
> - **SINPE y transferencia**, literal: «No importa a cuál cuenta sea, lo que pasa en la conciliación
>   es que la central debe recibir en caso de que la tenga la satélite o debe confirmar el recibido si
>   fue consignado directo a ellos». El monto recibido es el **total** que llegó a la central: lo que
>   entrega la satélite más lo que la central confirma que le llegó directo a su cuenta (R16a, R16b).
> - **Q4:** las consolidaciones conciliadas antes de esta ficha se regularizan con una migración que
>   las da por saldadas con la regla anterior, sin escribir en la caja ni en ningún libro y sin tocar
>   `monto_recibido`. Su deuda queda en 0 con la fórmula nueva (R54a–R54d). Va en el mismo despliegue.
> - **Q5:** se permite recibido 0 solo cuando el aporte es cero o negativo (R15a, R15b).
> - **Q3:** la consolidación rechazada es un límite conocido y aceptado. No hay ninguna hoy. Sin ficha.
> - **Q1 y Q2** (las del origen) siguen abiertas.
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
| **aporte** | Lo que la satélite entrega a la central: `total_general − total_pago_mensajero − total_ingreso_bodega_rechazos`, con signo y sin recortar a cero. Es `paraLaCentral`. Incluye todos los métodos de pago. |
| **saldada con la regla anterior** | Consolidación que la migración de regularización (R54a) dio por saldada tal como se marcó antes de esta ficha. |
| **aporte reconocido** | De una consolidación: si está saldada con la regla anterior, el valor que fijó la regularización (su `monto_recibido` en ese momento); si no, su aporte. |
| **recibido** | El `monto_recibido` de la consolidación: el **total** que llegó a la central por ella, sea cual sea el método y la cuenta (lo que entregó la satélite más lo consignado directo a la central). |
| **esperado** | El aporte reconocido de la consolidación. Al marcar coincide con su aporte, calculado desde su snapshot. |
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
escribir una fila de ajuste (evento `marca`, esperado, recibido total y diferencia igual al delta) y
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

**R15a.** SI se marca recibida o se corrige una consolidación con un recibido de 0 y su aporte
reconocido es positivo, ENTONCES el sistema DEBE rechazarlo con un desenlace propio, sin cambiar la
consolidación, sin historial y sin escribir ninguna fila.

**R15b.** CUANDO se marca recibida o se corrige una consolidación con un recibido de 0 y su aporte
reconocido es cero o negativo, el sistema DEBE aceptarlo y aplicar R10/R11 (al marcar) o R17/R18 (al
corregir). Un recibido negativo o con más de dos decimales DEBE seguir rechazándose en el borde, como
hoy.

**R16.** CUANDO se abre el diálogo de marcar recibido, el sistema DEBE proponer como monto el aporte de
la consolidación si es positivo, y 0 si es cero o negativo; nunca su efectivo.

**R16a.** El diálogo de marcar recibido y el de corregir DEBEN mostrar lo recaudado por método
(efectivo, SINPE, transferencia) y el texto literal: «Escribe todo lo que recibió la central por esta
consolidación: lo que entregó la satélite más el SINPE o la transferencia que llegó directo a la cuenta
de la central.»

**R16b.** El sistema DEBE registrar lo recibido de una consolidación como un único monto total, sea
cual sea el método y la cuenta por la que llegó, y NO DEBE pedir su desglose por método.

## C · Corregir el monto recibido

**R17.** CUANDO se corrige el monto recibido de una consolidación conciliada, el sistema DEBE calcular
el delta con el esperado igual a su aporte reconocido y, si es distinto de cero, escribir una fila de
ajuste con evento `correccion` y un movimiento de diferencia solo por esa variación, sin volver a
asentar los cierres.

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

**R23.** El sistema DEBE calcular la deuda de una zona satélite como Σ aportes de sus cierres que
cuentan en la deuda y no pertenecen a una consolidación saldada con la regla anterior + Σ aportes
reconocidos de sus consolidaciones saldadas con la regla anterior no rechazadas − Σ `monto_recibido`
de sus consolidaciones no rechazadas. El aporte incluye todos los métodos de pago.

**R24.** El sistema DEBE mostrar por zona, aparte, cuánto está sin consolidar y cuántos cierres lo
forman.

**R25.** El sistema DEBE calcular la cabecera de saldos y la descarga con la misma fórmula que las
filas, y la suma de las deudas de las filas DEBE ser igual al pendiente de la cabecera.

**R26.** El sistema DEBE derivar «Falta por recibir» de una consolidación como
`aporte reconocido − (recibido ?? 0)` desde una sola función, y usarla en todas las pantallas y
descargas que la muestran.

**R27.** La tarjeta de conciliación del cierre de bodega DEBE cumplir «Recibido + Falta por recibir =
Para la central», salvo en una consolidación saldada con la regla anterior, donde DEBE cumplir
«Recibido + Falta por recibir = aporte reconocido».

**R28.** El sistema DEBE tener una sola definición del aporte y una sola del aporte reconocido. SI la
deuda se agrega en SQL, ENTONCES cada expresión SQL DEBE dar el mismo resultado que su función, con
signo, sobre los mismos datos.

## F · Estado de cuenta de la bodega

**R29.** El estado de cuenta de una bodega DEBE tomar como «declarado» de cada consolidación no
rechazada su aporte reconocido: la suma de los aportes de sus cierres o, si está saldada con la regla
anterior, el valor que fijó la regularización. Nunca su efectivo.

**R30.** El estado de cuenta DEBE incluir una fila por cada cierre sin consolidar de la zona.

**R31.** Sin filtros, el pendiente final del estado de cuenta DEBE ser igual a la deuda de esa zona en
la pantalla de saldos. Para cualquier periodo, «Por entregar al inicio» + declarado − recibido DEBE ser
igual a «Por entregar al final».

**R32.** El estado de cuenta y la pantalla de saldos DEBEN usar el mismo predicado de «cierre que
cuenta en la deuda» y la misma expresión del aporte y del aporte reconocido, declarados en un solo
sitio.

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

**R41a.** MIENTRAS una consolidación esté saldada con la regla anterior, la conciliación DEBE rotularla
«Saldada con la regla anterior» y mostrar como lo que debe su aporte reconocido.

**R42.** La tabla de saldos de satélites y su descarga DEBEN incluir la columna «Sin consolidar».

**R43.** Ningún texto de la aplicación, de sus contratos ni de la ayuda de usuario DEBE decir que la
marca de conciliación es informativa, que desmarcar no mueve dinero o que la marca no escribe en ningún
libro. La nota de la conciliación DEBE decir, literalmente: «Marcar recibido asienta el dinero en la
caja. Después no se puede desmarcar: si el monto no es el correcto, usa «Corregir»».

**R44.** La ayuda de usuario de Wallet · Satélites y la de Wallet · Caja DEBEN describir el
comportamiento nuevo: el dinero de un cierre satélite entra a la caja al conciliar, la deuda cuenta
todos los métodos de pago menos lo que pertenece a la satélite, el monto recibido es el total que llegó
a la central (también el SINPE o la transferencia consignados directo a ella), el recibido 0 solo
cuando no hay nada que entregar, la columna «Sin consolidar», las consolidaciones saldadas con la regla
anterior, el desenlace de revertir con asientos y el bolsillo «Por cobrar a satélites».

## I · Autorización

**R45.** El sistema DEBE reservar marcar, corregir y revertir a quien hoy tiene ese permiso, con el
control de rol antes de tocar cualquier repositorio, también en los caminos nuevos (asiento,
diferencia, recibido 0 y `con_asientos`).

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
tabla de ajustes, sin los tres valores de enum y sin filas que los usen, sin la marca de regularización
y sin perder ningún valor de enum añadido por otra migración.

**R54.** CUANDO se concilia una consolidación que contiene un cierre retirado por la migración de
datos, el sistema DEBE volver a asentar ese cierre.

**R54a.** CUANDO se aplica la migración de regularización, el sistema DEBE marcar como saldada con la
regla anterior cada consolidación conciliada, no rechazada y sin ninguna fila en la tabla de ajustes,
fijando su aporte reconocido igual a su `monto_recibido`, seleccionadas por predicado y nunca por ids
escritos en la migración.

**R54b.** La migración de regularización NO DEBE escribir, cambiar ni borrar ninguna fila de los tres
libros ni de la tabla de ajustes, NO DEBE cambiar `monto_recibido` ni ninguna otra columna existente de
la consolidación, y NO DEBE marcar ninguna consolidación sin conciliar ni rechazada.

**R54c.** MIENTRAS una consolidación esté saldada con la regla anterior y no se haya corregido, su
contribución a la deuda de la zona, al pendiente del estado de cuenta y a «Falta por recibir» DEBE ser
0.

**R54d.** CUANDO se revierte la migración de regularización, el sistema DEBE quitar solo la marca, sin
tocar ningún otro dato. Aplicar, revertir y volver a aplicar DEBE dejar marcadas las mismas
consolidaciones con los mismos valores que la primera aplicación.

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
- Desglose por método de lo recibido (R16b): no se registra a qué cuenta ni por qué método llegó.
- Consolidaciones rechazadas (Q3): límite conocido aceptado por el humano el 2026-11-02. Sin ficha.
- Cifras de producción: la medición la hace el humano (o el leader con su autorización) y no va al
  repositorio.

---

## Preguntas abiertas

**Q1 (del origen, abierta, no bloquea, no se resuelve aquí).** La ganancia de la satélite no se
registra como egreso de la caja.

**Q2 (del origen, abierta, no bloquea, no se resuelve aquí).** En un cierre todo SINPE, el libro del
mensajero lo deja con una cuenta por pagar aunque la satélite ya descontó su pago.

**Q3 — RESPONDIDA por el humano el 2026-11-02.** Consolidaciones rechazadas. Se acepta como límite
conocido: no hay ninguna hoy y la acción `rechazarCierreBodega` no tiene botón. Sin ficha aparte.
Contexto del análisis: `rechazarCierreBodega` sigue exportada; una consolidación rechazada deja sus
cierres con `cierre_bodega_id` apuntándola, no pueden reconsolidarse (`consolidablesWhere` exige
`cierre_bodega_id IS NULL`) ni conciliarse; con esta ficha cuentan en la deuda como «sin consolidar»
(R23/R24), pero su dinero no entraría nunca a la caja.

**Q4 — RESPONDIDA por el humano el 2026-11-02.** Consolidaciones conciliadas antes de esta ficha. Se
regularizan con una migración que las da por saldadas con la regla anterior, sin escribir en la caja
ni en ningún libro y sin tocar `monto_recibido`. Su deuda queda en 0 con la fórmula nueva. Va en el
mismo despliegue, con medición previa en producción de solo lectura y puerta. Requisitos R54a–R54d y
R41a. Siguen sin poder desmarcarse (tienen asientos de la aprobación antigua, R20).

**Q5 — RESPONDIDA por el humano el 2026-11-02.** Aporte cero o negativo. Se permite marcar (y corregir)
con recibido 0 solo cuando el aporte reconocido es cero o negativo. Cambia la validación de la ficha
431 en ese caso. Requisitos R15a, R15b y R16.
