# Ficha 497 — La confirmación física también exige las órdenes en novedad interna del cierre

> **El defecto, en una frase.** Al aprobar un cierre del día, la confirmación física de la feature
> 238 pide escanear solo los paquetes de las **gestiones** cuyo resultado vuelve a bodega. Las
> órdenes que el corte diario barrió a `novedad_interna` (antes «sin gestionar») al crear el cierre
> quedan registradas en `cierre_sin_gestion` con su guía congelada, y la aprobación las libera a
> bodega o a rechazo **dentro de la misma transacción**, pero nadie las escanea. El sistema las da
> por recibidas sin prueba.
>
> **Origen.** H2 de `progress/prompt-hotfix-portable.md`, con las rutas reales de
> `progress/inventario_hotfix_H2_H3_H5.md` §1. Es un **arreglo mínimo**: extiende el conjunto que la
> ventana de la 238 pone delante, y el que el servidor exige, a un segundo origen cuyos datos ya
> están persistidos. No hay pantalla nueva ni modelo nuevo.
>
> **Depende de:** 238 (confirmación física), 264 (`cierre_sin_gestion`), 109/276 (liberación al
> aprobar), 455 (nombre vigente `novedad_interna`). **Va antes de:** 498, que toca la misma
> transacción de aprobación.

---

## Vocabulario

| Término | Qué significa aquí |
| --- | --- |
| **cierre** | `cierre_dia`: el cierre del día de UN mensajero. El de bodega (`cierre_bodega`) queda fuera. |
| **gestión** | Fila de `gestion_orden` vinculada al cierre. Tiene `resultado`. |
| **barrida** | Orden que el corte diario pasó a `novedad_interna` al **crear** el cierre y que quedó registrada en `cierre_sin_gestion` con sus datos congelados. No tiene gestión ni resultado. |
| **guía congelada** | `cierre_sin_gestion.num_guia`: la guía copiada al barrer. Puede ser nula. |
| **origen del paquete** | De dónde sale una fila que hay que confirmar: `gestion` o `barrida`. |
| **conjunto esperado** | Lo que bodega tiene que confirmar de un cierre: las gestiones que vuelven **más todas** las barridas del cierre. |
| **cobertura exacta** | Que lo confirmado sea igual al conjunto esperado: ni falta ni sobra ni se repite. |
| **punto único** | El único sitio del código que declara qué vuelve físicamente a bodega. |

---

## A · El conjunto esperado

**R1.** El sistema DEBE declarar en un **punto único** qué paquetes de un cierre vuelven
físicamente a bodega, para los dos orígenes: gestiones y barridas.

**R2.** El sistema DEBE conservar la declaración de qué **resultados de gestión** vuelven como
exhaustiva, de modo que un resultado nuevo NO compile hasta que se declare si su paquete vuelve.

**R3.** CUANDO el vocabulario de orígenes de paquete gane un valor nuevo, el sistema NO DEBE
compilar hasta que se declare si ese origen vuelve a bodega.

**R4.** El sistema NO DEBE declarar «qué vuelve a bodega» en ningún otro punto del código de
producción: ni una segunda lista de resultados ni una segunda regla sobre orígenes.

**R5.** El sistema DEBE incluir en el conjunto esperado de un cierre **toda** barrida registrada
para ese cierre.

**R6.** El sistema DEBE obtener las barridas del cierre, con su guía congelada, del **registro
persistido** del cierre, y NO del estado actual de las órdenes.

**R7.** El sistema DEBE resolver las barridas dentro del alcance del actor; SI el cierre está
fuera de su alcance, ENTONCES el sistema DEBE devolver un conjunto vacío sin revelar nada de ese
cierre.

**R8.** El sistema NO DEBE incluir en el conjunto esperado de un cierre una barrida registrada para
otro cierre.

**R9.** SI un cierre no tiene barridas registradas, ENTONCES el sistema NO DEBE exigir ninguna
confirmación por ese concepto.

---

## B · El bloqueo en el servidor

**R10.** CUANDO un actor pide aprobar un cierre con barridas registradas, el sistema DEBE exigir la
confirmación física de **todas** ellas, junto con la de las gestiones que vuelven.

**R11.** SI la confirmación recibida no cubre exactamente el conjunto esperado, ENTONCES el sistema
DEBE rechazar la aprobación con un error **por fila**, dejar el cierre en su estado y no producir
movimiento de dinero, transición de orden, liberación ni marca de confirmación.

**R12.** SI falta la confirmación de una barrida del conjunto esperado, ENTONCES el sistema DEBE
devolver un error asociado a **esa** barrida.

**R13.** SI la confirmación incluye una entrada de barrida que no pertenece a las barridas del
cierre, o una entrada que dice ser de un origen y apunta a una clave del otro, ENTONCES el sistema
DEBE tratarla como ajena y devolver un error asociado a esa entrada.

**R14.** SI la confirmación incluye dos veces la misma barrida, ENTONCES el sistema DEBE devolver un
error asociado a esa entrada.

**R15.** SI la guía informada para una barrida no coincide con su **guía congelada**, ENTONCES el
sistema DEBE devolver un error asociado a esa entrada.

**R16.** SI una barrida del conjunto esperado no tiene guía congelada, ENTONCES el sistema DEBE
devolver un error asociado a esa barrida que nombre el motivo, y NO DEBE omitirla del conjunto
esperado.

**R17.** El sistema DEBE verificar la cobertura exacta en la lógica de negocio, contra el registro
real del cierre, **antes** de abrir la transacción de aprobación.

**R18.** SI la petición de aprobación no trae entradas de barrida, ENTONCES el sistema DEBE tratarla
como una lista vacía y aplicarle R11 sin excepción.

**R19.** SI un cierre no tiene gestiones que vuelvan ni barridas, ENTONCES el sistema DEBE aprobarlo
con el mismo comportamiento y el mismo contenido de petición que antes de esta ficha.

**R20.** El sistema NO DEBE ofrecer ninguna vía de aprobar un cierre con una fila del conjunto
esperado sin confirmar: ni marcar como faltante, ni aprobar parcialmente, ni omitir una fila del
cómputo.

**R21.** El sistema DEBE aplicar R10-R20 con el mismo criterio a cualquier actor con permiso para
aprobar el cierre, incluido el administrador de bodega satélite.

---

## C · Lo que se persiste

**R22.** CUANDO la aprobación se aplica, el sistema DEBE registrar el instante de confirmación de
**cada** barrida confirmada, dentro de la **misma transacción** que aprueba el cierre.

**R23.** SI el registro de la confirmación no se aplica exactamente sobre las barridas confirmadas,
ENTONCES el sistema DEBE revertir la aprobación completa, sin efectos parciales.

**R24.** CUANDO se registra la confirmación de una barrida, el sistema NO DEBE alterar ningún monto,
NO DEBE emitir, modificar ni suprimir movimientos de dinero, y NO DEBE alterar los datos congelados
de la barrida.

**R25.** El sistema DEBE permitir distinguir una barrida confirmada de una barrida sin confirmación,
y NO DEBE asignar confirmación a las barridas existentes antes de esta ficha.

**R26.** El sistema NO DEBE derivar de la marca de confirmación ningún plazo, vencimiento, importe ni
orden de prelación.

**R27.** CUANDO se intente aprobar de nuevo un cierre ya aprobado, el sistema NO DEBE reescribir la
marca de sus barridas.

**R28.** CUANDO un cierre se rechaza o se reabre, el sistema NO DEBE escribir marca de confirmación
de sus barridas ni pedir su confirmación física.

**R29.** CUANDO una aprobación libera barridas, a bodega o a rechazo, toda barrida liberada DEBE
quedar con su marca de confirmación escrita por esa misma aprobación.

---

## D · Lo que bodega ve

**R30.** MIENTRAS la ventana de confirmación esté abierta, el sistema DEBE mostrar las barridas en la
**misma lista** y con el mismo peso visual que las gestiones que vuelven, en su propia sección
rotulada con el nombre vigente del estado, **«Novedad interna»**, y NO DEBE usar el nombre retirado
«sin gestionar».

**R31.** MIENTRAS la ventana de confirmación esté abierta, el sistema DEBE mostrar por cada barrida
su guía congelada, su remisión, su destinatario y si está pendiente o confirmada.

**R32.** El sistema DEBE contar las barridas en el **mismo** contador de progreso y de faltantes que
bloquea el botón de aprobar, sin un segundo contador.

**R33.** CUANDO se lee la guía congelada de una barrida pendiente del cierre abierto, el sistema DEBE
confirmarla.

**R34.** SI la guía leída no pertenece a ninguna gestión ni a ninguna barrida del cierre abierto,
ENTONCES el sistema DEBE avisar que no es de este cierre y NO DEBE marcar ninguna fila.

**R35.** SI alguna fila del conjunto esperado no tiene guía, ENTONCES el sistema DEBE avisarlo
**antes** de la lista, diciendo cuántas son y que el cierre no se podrá aprobar.

**R36.** SI el servidor devuelve un error asociado a una barrida, ENTONCES el sistema DEBE pintarlo
en esa fila y DEBE dejar la ventana abierta.

**R37.** CUANDO el actor cierra la ventana de confirmación sin completarla, el sistema NO DEBE enviar
ni persistir nada y DEBE dejar el cierre en su estado.

**R38.** CUANDO el actor pide aprobar un cierre cuyo conjunto esperado solo contiene barridas, el
sistema DEBE abrir la ventana de confirmación en lugar de aprobar directamente.

---

## E · No regresión

**R39.** El sistema NO DEBE cambiar qué dinero mueve la aprobación de un cierre, ni cuánto, ni
cuándo.

**R40.** Las suites que miden el orden de las llamadas dentro de la transacción de aprobación DEBEN
quedar verdes sin modificarse.

**R41.** Toda migración de esta ficha DEBE tener su reversión, y la base revertida DEBE poder ser
leída por el código anterior.

---

## Reglas de negocio adoptadas (decisión del humano, 2026-11-02)

Se adoptan las de H2 tal cual, sin reabrirlas:

- Las barridas se escanean igual que reprogramadas, devoluciones y rechazos. Mientras falte una, el
  cierre no se aprueba.
- **Sin salida de emergencia.** Si un paquete no llegó, la salida es rechazar el cierre con motivo.
- Marca por barrida en una columna `confirmada_fisica_at`, con el mismo nombre que en
  `gestion_orden`, nullable, sin default y **sin backfill**.
- Se compara contra la **guía congelada**, no contra la viva de la orden.
- Rótulo visible: **«Novedad interna»**.
- Sin multiempresa en este repo: no aplica `organizacion_id` ni RLS por empresa.
- La puerta de despliegue está resuelta: bodega está avisada de que el cierre en cola deberá
  escanear sus paquetes.

## Diferencia de modelo con el repo de origen

Aquí las barridas **no** se escriben al vencer un cierre existente: las escribe el corte diario **al
crear** el cierre (estado `vencido`), en la misma transacción que mueve las órdenes a
`novedad_interna`. El conjunto de barridas de un cierre queda fijo desde su nacimiento. Para
aprobarlo, el cierre tiene que pasar antes a `solicitado` (la aprobación solo resuelve
`solicitado`). Los requisitos no dependen del momento de la escritura, pero los tests y el design
siguen este modelo.

## Límite declarado

El servidor verifica **cobertura**, no el acto físico. Un cliente manipulado puede enviar el
conjunto completo sin escanear nada. Esto es un control de proceso. Lo que sí se garantiza (R17) es
que la cobertura se valida en el servidor contra el registro real del cierre.

## Fuera de alcance

- Cambiar a dónde van las barridas al aprobar (109/276) o cuándo se barre.
- Los rechazos de tienda del cierre (425): su paquete no viaja con el mensajero.
- El cierre de bodega (nivel 2).
- Backfill de cierres ya aprobados.
- El dinero de la satélite (ficha 498).

---

## Preguntas abiertas

**Q1 · La ficha 451 es el mismo defecto. [humano]**
`feature_list.json` tiene la 451 («las ordenes sin gestionar de un cierre vencido no se piden
escanear para recibirlo») en `pending`, con spec completo en
`specs/451-confirmacion-fisica-sin-gestionar/`. Esta 497 la sustituye: mismas reglas, pero con el
rótulo vigente («Novedad interna»; la 451 es anterior a la 455 y dice «Sin gestionar», que hoy
prohíbe la guardia `nombres-estado-retirados`), el gate vigente y un contrato de repositorio que no
obliga a modificar `cierres-admin-caja-cod.test.ts`. ¿Se cierra la 451 como sustituida por la 497?
Si quedan las dos abiertas, otra sesión puede implementarla en paralelo sobre los mismos archivos.

**Q2 · La guardia `aprobacion-escrituras-cubiertas` no puede quedar intacta. [humano]**
La guardia es un **inventario cerrado**: censa toda escritura `tx.<modelo>.<método>` de
`CierresAdminRepository.ts`, y una escritura nueva sin entrada la pone en rojo. Está hecha para
eso. Escribir la marca de las barridas exige una escritura nueva (`tx.cierreSinGestion.updateMany`),
así que la guardia tiene que ganar **una entrada** en `ESCRITURAS_DE_LA_APROBACION` (y, por
simetría con la de la 238, un caso que compruebe que la suite citada la afirma de verdad). Esquivarla
con SQL crudo o con un repositorio inyectado sería engañarla: su censo de SQL crudo solo cuenta
`UPDATE "orden"`, así que la escritura quedaría fuera sin ninguna señal. Propuesta (design §8): el
cambio es **solo aditivo** (una entrada y un caso nuevos) y no altera ni quita ninguna aserción
existente. `cierres-admin-caja-cod.test.ts` sí queda intacto (design §5.4). ¿Se acepta?
