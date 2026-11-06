# Ficha 502 — Conciliación satélite: menores de la 500 — Requisitos

> Origen: menores m1, m4 y m5 de `progress/review_500.md`. Zona fullstack, backend → frontend.
> Arreglo mínimo: sin migración, sin tablas nuevas y sin cambiar el servidor de la conciliación.

**Aprobado por el humano el 2026-11-04: Q1 = salida A; Q2 = no ampliar.** R14 y R15 (salida B) se borraron; los
números no se reasignan.

## Glosario

| Término | Significado |
| --- | --- |
| **diálogo de Desmarcar** | La confirmación que abre el botón «Desmarcar» de las acciones de conciliación. |
| **nota de la conciliación** | El texto literal de 498/R43: «Marcar recibido asienta el dinero en la caja. Después no se puede desmarcar: si el monto no es el correcto, usa «Corregir»». |
| **recibida de más** | Consolidación conciliada cuyo monto recibido es mayor que lo que debe. Incluye la que debe un monto negativo y se marcó por 0 (0 es mayor que −100). |
| **recibida exacta** | Consolidación conciliada cuyo monto recibido es igual a lo que debe. |
| **con dinero** | El predicado de 500/R1: tiene una fila de ajuste o una fila de los tres libros con origen en uno de sus cierres. |
| **las dos pantallas** | El desglose de `/wallet/satelites` y el detalle de `/cierres-admin`. |

---

## A · La nota dentro del diálogo de Desmarcar (m4)

**R1.** CUANDO se abre el diálogo de Desmarcar, el sistema NO DEBE mostrar la nota de la conciliación ni
ninguna frase que diga que después no se puede desmarcar.

**R2.** CUANDO se abre el diálogo de Desmarcar de una consolidación con monto recibido, el sistema DEBE
seguir diciendo el importe que consta como recibido.

**R3.** El sistema DEBE seguir mostrando la nota de la conciliación, con su texto literal sin cambios, al
pie de la conciliación de `/wallet/satelites` y en la ayuda de Wallet · Satélites.

## B · El rastro de los distritos va en la transacción (m1)

**R4.** MIENTRAS la transacción que guarda un cambio de distritos de una zona no haya terminado, el sistema
NO DEBE dejar visibles desde otra conexión de Postgres las filas de `zona_distrito_cambiado` de ese
guardado, y dentro de esa transacción DEBEN estar escritas.

**R5.** SI la transacción que guarda un cambio de distritos de una zona se revierte, ENTONCES el sistema NO
DEBE conservar ninguna fila de `zona_distrito_cambiado` de ese guardado.

## C · Lo que no cambia, salga lo que salga Q1

**R6.** MIENTRAS una consolidación esté recibida exacta y no se pueda desmarcar, el sistema NO DEBE ofrecer
ninguna acción. (Se borra si Q2 se responde ampliando.)

## C-A · Salida A de Q1: se ofrece «Corregir» en una recibida de más

**R7.** MIENTRAS una consolidación esté recibida de más, las dos pantallas DEBEN ofrecer «Corregir», tenga
o no dinero, a quien pueda conciliar.

**R8.** MIENTRAS una consolidación esté sin marcar, el sistema NO DEBE ofrecer «Corregir», aunque deba un
monto negativo.

**R9.** CUANDO se confirma «Corregir» sobre una recibida de más, el sistema DEBE enviarlo como corrección y
NO DEBE enviarlo como marca.

**R10.** CUANDO se abre «Corregir» sobre una recibida de más, el diálogo DEBE titularse «Corregir el monto
recibido» y partir del monto ya marcado y de su nota; y CUANDO el servidor confirma, la pantalla DEBE
anunciar «Monto recibido corregido a» seguido del monto que quedó.

**R11.** CUANDO se corrige una recibida de más, el sistema DEBE escribir en la caja solo la variación (una
fila de ajuste y un movimiento por la diferencia entre lo nuevo y lo anterior), NO DEBE volver a asentar sus
cierres, NO DEBE cambiar ninguna fila anterior de los libros ni de ajustes, y DEBE dejar una fila de historial
con el monto anterior y el nuevo.

**R12.** CUANDO se corrige una recibida de más, lo que falta por recibir DEBE quedar como lo que debe menos
el monto nuevo; y SI el monto nuevo es 0 y lo que debe es positivo, ENTONCES el sistema DEBE rechazarlo con
`recibido_cero_con_aporte` sin cambiar nada.

**R13.** La ayuda de Wallet · Satélites DEBE decir que «Corregir» aparece en una consolidación recibida
incompleta o recibida de más.


---

## Trazabilidad prevista

| R | Test |
| --- | --- |
| R1 | `tests/components/Conciliacion498.test.tsx`, el caso de :278 reescrito; `tests/integration/wallet-satelites.test.tsx`, el caso de :540, línea :553 invertida |
| R2 | `tests/integration/wallet-satelites.test.tsx` :550-551 (sin cambios) |
| R3 | `Conciliacion498.test.tsx` :404-407, `wallet-satelites.test.tsx` :455-464, `aporte-satelite-fuente-unica-498.guardia.test.ts` :156-165, `ayuda-wallet-satelites-498.test.ts` :29 (todos sin cambios) |
| R4, R5 | `tests/integration/db/zona-distrito-rastro-500.test.ts`, caso nuevo «502/R4/R5», contra Postgres |
| R6 | `tests/components/ConciliacionAcciones500.test.tsx` :71-76 (sin cambios) |
| R7 | `tests/components/ConciliacionAcciones502.test.tsx` (nuevo); `Conciliacion498.test.tsx` y `CierresBodegaAdminDebe498.test.tsx`, un caso nuevo en cada uno (las dos pantallas) |
| R8-R10 | `ConciliacionAcciones502.test.tsx` |
| R11, R12 | `tests/integration/db/502-corregir-de-mas-sql-real.test.ts` (nuevo), contra Postgres |
| R13 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`, punto nuevo «(502/R13)» |

## Fuera de alcance

- Cambiar el texto de la nota de la conciliación (498/R43).
- Cambiar `corregirConciliacion`, `escribirDiferencia` o el servidor de la conciliación.
- Reescribir `clienteConSavepoint`, o cazar `this.prisma` en las otras tres escrituras de historial de
  `ZonaRepository.update`. Esta ficha cubre el rastro de distritos.
- Un rótulo o un estado nuevo para «recibida de más»: el badge sigue diciendo «Recibido».

---

## Preguntas resueltas (2026-11-04)

Respuesta del humano: Q1 = A (se ofrece «Corregir»); Q2 = no ampliar. Se conserva el razonamiento.

### Q1 — ¿Se ofrece «Corregir» en una consolidación recibida de más? (bloquea la implementación)

**Recomendación: salida A, ofrecerlo.** Razones, leídas en el código (`design.md` §3.1 trae la tabla con
los números). No se ha ejecutado nada todavía; `T3` lo mide contra Postgres antes de tocar la pantalla.

- El servidor ya lo sabe hacer. `corregirConciliacion` no mira si la marca está incompleta: exige estar
  conciliada y el monto leído. El ejemplo de la revisión (debe ₡0, marcada ₡90) corregido a ₡0 escribe un
  ajuste de +90 y un egreso de ₡90, y la diferencia queda en cero. Ese caso ya está medido con otros montos
  en `498-conciliar-asienta-sql-real.test.ts:263-264` y :523-529.
- No vuelve a asentar los cierres ni toca filas anteriores (498/R19, medido en el mismo archivo, :542-547).
- Sin ella, la pantalla promete lo que no hay: la nota del pie y la ayuda (`wallet-satelites.md:112-114`)
  dicen «usa Corregir» y la fila no tiene botones. Es la misma contradicción que m4.

**Lo que se acepta con A:**

- Corregir reescribe `conciliado_at` y `resuelto_at` (473, D3). La consolidación pasa a contar en «Recibido
  este mes» del mes de la corrección. Hoy ya pasa con «Recibido incompleto».
- Las que deben un monto negativo y se marcaron por 0 también son «de más» y también ganan «Corregir».
- Corregir una de más hasta el monto exacto la deja sin botones (ver Q2).

**Dato que falta:** cuántas hay en producción. No lo medí. Si quieres el número antes de decidir, se saca en
solo lectura contando las filas conciliadas donde `monto_recibido > COALESCE(esperado_regla_anterior,
total_general - total_pago_mensajero - total_ingreso_bodega_rechazos)`.

**Salidas:** A = borrar el bloque C-B. B = borrar el bloque C-A. Si eliges B, la consolidación sigue sin
ninguna forma de corregirse desde la pantalla, y la ayuda lo dirá.

### Q2 — ¿Y una recibida exacta con dinero? (no bloquea)

Al medir m5 salió que el hueco es más ancho que «de más». Una recibida exacta y con dinero tampoco tiene
ningún botón, y es el caso más frecuente, porque el diálogo nace precargado con lo que debe. Tres textos
prometen «Corregir» ahí: la nota del pie, el aviso `con_asientos` y la ayuda, que para las saldadas con la regla
anterior dice «se arregla con Corregir» (`wallet-satelites.md:127-128`). Una saldada tiene falta 0.00, así que
tampoco lo ofrece. El servidor sí lo admite (`498-conciliar-asienta-sql-real.test.ts:549`).

**Recomendación: no ampliar en esta ficha.** 500 lo dejó fuera a propósito (§Fuera de alcance) y no hay un
caso reportado. Si lo quieres, el cambio es una condición: se borra R6, se invierte
`ConciliacionAcciones500.test.tsx:71-76` y R7 pasa a decir «toda conciliada». La frase falsa de la ayuda sobre
las saldadas queda como deuda conocida hasta entonces.
