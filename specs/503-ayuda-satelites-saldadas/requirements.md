# Ficha 503 — Ayuda de Wallet · Satélites: la frase de las saldadas — Requisitos

> Origen: deuda de la 502 (Q2 = no ampliar, decisión del humano del 2026-11-04). Zona frontend, complejidad small.
> Se corrige la frase de la ayuda. **La pantalla no cambia y no se añade ningún botón.**

## Glosario

| Término | Significado |
| --- | --- |
| **saldada sin corregir** | Consolidación con el rótulo «Saldada con la regla anterior» a la que nadie ha cambiado el monto: conciliada y con «Falta por recibir» en 0 (498/R54c). |
| **la sección** | El apartado «Saldada con la regla anterior» de `docs/ayuda/oficina/wallet-satelites.md`, desde su título hasta el título siguiente. |

## A · Lo que dice la ayuda

**R1.** La sección DEBE decir que la fila de una saldada no ofrece ningún botón, ni «Corregir» ni «Desmarcar», y
que su monto no se puede cambiar desde la pantalla.

**R2.** La sección NO DEBE decir que una saldada se arregla o se cambia con «Corregir».

**R3.** La sección DEBE seguir diciendo que esas consolidaciones llevan el rótulo «Saldada con la regla anterior»,
que su «Debe» es lo que se marcó entonces y que no deben nada.

## B · Lo que hace la pantalla (no cambia; se fija porque la frase nueva se apoya en esto)

**R4.** MIENTRAS una consolidación sea una saldada sin corregir, el desglose de `/wallet/satelites` DEBE mostrar su
rótulo y NO DEBE ofrecer ningún botón en su fila, aunque el actor pueda conciliar.

**R5.** MIENTRAS una consolidación sea una saldada sin corregir, el detalle de `/cierres-admin` NO DEBE ofrecer
ningún botón de conciliación, aunque el actor pueda conciliar.

---

## Trazabilidad prevista

| R | Test |
| --- | --- |
| R1, R2, R3 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`, bloque nuevo «503», contra el texto de **la sección** y con su autocomprobación |
| R4 | `tests/components/Conciliacion498.test.tsx`, caso nuevo «503/R4», contra el DOM de la fila y con una fila de control |
| R5 | `tests/components/ConciliacionAcciones500.test.tsx:71-76` (componente) y `tests/integration/db/500-con-dinero-sql-real.test.ts:257` y `:275-276` (valor real del servidor para la saldada), sin cambios |

## Fuera de alcance

- Añadir «Corregir» a una saldada o a una recibida exacta (Q2 de la 502).
- Cambiar el servidor: sigue admitiendo la corrección (`tests/integration/db/498-conciliar-asienta-sql-real.test.ts:549`).
- Cambiar la nota literal de 498/R43 ni el párrafo general de `wallet-satelites.md:112-117`. Prometen «Corregir» también
  a una recibida exacta con dinero, hueco conocido de Q2 de la 502; `wallet-satelites.md:119` ya acota cuándo aparece.
- Cambiar `CONCILIACION_RESPUESTA.saldadaReglaAnterior` («…si el monto no es el correcto, corrígelo.»). Tiene la misma
  promesa, pero solo sale en el diálogo de Desmarcar, que desde la 500 no se ofrece en una saldada, y dos tests fijan su
  literal. Queda anotado como deuda menor.

## Preguntas abiertas

### Q1 — ¿La ayuda indica algún paso a quien encuentre una saldada mal marcada? (decidir al aprobar)

**Lo que se averiguó en el código.** La fila no ofrece ninguna acción, en ninguna de las dos pantallas. El único
llamador de `corregirConsolidacionRecibidaAction` es `ConciliacionAcciones`, y no la ofrece con falta 0, así que no hay
otra vía en la app. La ayuda se dirige a maestro y admin, que son quienes concilian: no hay un rol superior al que
remitirlos. **Ningún documento define a quién se le pide un arreglo así, y eso no se puede averiguar en el repo.**

**Recomendación: A.**

- **A. Decir solo el hecho** (R1, texto de `design.md` §1). Es lo único comprobado y lo que este spec da por defecto.
  Precio: quien encuentre una mal marcada sabe que no puede arreglarla, pero no a quién acudir.
- **B. A y además nombrar un responsable.** Solo si el humano lo nombra; se añade su frase a R1. No hay que inventarlo.
- **C. Remitir a «Corrección de caja».** No la recomiendo: la marca antigua no escribió en la caja (`specs/498-satelite-dinero-al-conciliar/design.md:239`)
  y ese movimiento no cambia ni el monto ni el «Debe» de la consolidación. Descuadraría la caja sin arreglar la fila.

## Decisiones del humano (2026-11-06)

- **Q1 = A:** la ayuda dice solo el hecho, sin nombrar responsable. Spec aprobado.
