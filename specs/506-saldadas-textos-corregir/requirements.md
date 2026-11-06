# Ficha 506 — Saldadas: los textos que aún prometen «Corregir» — Requisitos

> Origen: deuda de la 502 (Q2 = no ampliar, decisión del humano del 2026-11-04) y de la 503. Zona frontend, complejidad small.
> Se corrigen textos y se deja de montar una región vacía. **No se añade ningún botón y el servidor no cambia.**

## Glosario

| Término | Significado |
| --- | --- |
| **recibida exacta** | Consolidación conciliada con «Falta por recibir» en 0 (mismo término que en la 502). |
| **saldada sin corregir** | Recibida exacta con el rótulo «Saldada con la regla anterior» (mismo término que en la 503). |
| **la nota** | El texto al pie de la conciliación en `/wallet/satelites`. |
| **la sección de la ayuda** | El apartado de `docs/ayuda/oficina/wallet-satelites.md` que hoy se titula «Una vez marcada, se corrige», hasta el título siguiente. |
| **la región** | La sección con nombre accesible «Conciliación del cierre de bodega» del detalle de `/cierres-admin`. |
| **acción de conciliación** | Cualquiera de los botones «Marcar recibido», «Corregir» o «Desmarcar». |

## A · Los avisos del diálogo de «Desmarcar»

**R1.** SI el servidor responde a «Desmarcar» que la consolidación está saldada con la regla anterior, ENTONCES el
sistema DEBE mostrar dentro del diálogo, literal, «Esta consolidación está saldada con la regla anterior: no se puede
revertir.».

**R2.** SI el servidor responde a «Desmarcar» que la consolidación ya entró a la caja, ENTONCES el sistema DEBE mostrar
dentro del diálogo, literal, «Ya entró a la caja: no se puede revertir.».

## B · La nota

**R3.** MIENTRAS se muestre el desglose de conciliación de `/wallet/satelites`, el sistema DEBE mostrar al pie, literal,
«Marcar recibido asienta el dinero en la caja. Después no se puede desmarcar, y «Corregir» solo aparece si lo recibido
quedó por debajo o por encima de lo que debe: si coincide, no hay botón para cambiar el monto.».

## C · La ayuda

**R4.** La sección de la ayuda DEBE citar literalmente la nota de R3 y el aviso de R2.

**R5.** La sección de la ayuda DEBE decir que una consolidación recibida por el monto exacto que ya movió dinero en la
caja no ofrece ningún botón, ni «Corregir» ni «Desmarcar», y que su monto no se puede cambiar desde la pantalla.

**R6.** La sección de la ayuda NO DEBE titularse «Una vez marcada, se corrige» ni decir, sin condición, que un monto
incorrecto se arregla con «Corregir».

**R7.** La sección de la ayuda DEBE seguir diciendo que «Corregir» aparece en una consolidación recibida incompleta o
recibida de más, que la caja recibe solo la diferencia y que queda registrado quién corrigió y cuándo.

## D · Lo que la fila ofrece (no cambia; se fija porque los textos nuevos se apoyan en esto)

**R8.** MIENTRAS una consolidación sea una recibida exacta que no se pueda desmarcar, incluida una saldada sin corregir,
el sistema NO DEBE ofrecer ninguna acción de conciliación, aunque el actor pueda conciliar.

## E · La región de `/cierres-admin`

**R9.** MIENTRAS el actor pueda conciliar y la consolidación abierta no ofrezca ninguna acción de conciliación, el
detalle NO DEBE montar la región.

**R10.** MIENTRAS el actor pueda conciliar y la consolidación abierta ofrezca al menos una acción de conciliación, el
detalle DEBE montar la región con esa acción dentro.

**R11.** SI el actor no puede conciliar, ENTONCES el detalle NO DEBE montar la región, cualquiera que sea el estado de
la consolidación.

---

## Trazabilidad prevista

Literales escritos a mano en el test, nunca leídos de su constante. Mutaciones detalladas en `design.md` §6.

| R | Test |
| --- | --- |
| R1 | `tests/components/Conciliacion498.test.tsx` (caso «revisión m2») y `tests/components/ConciliacionAcciones500.test.tsx` (500/R7), con el literal nuevo |
| R2 | `tests/components/Conciliacion498.test.tsx` (`TEXTO_R21`) y `tests/components/ConciliacionAcciones500.test.tsx` (500/R7), con el literal nuevo |
| R3 | `tests/components/Conciliacion498.test.tsx` (caso «R43»), `tests/integration/wallet-satelites.test.tsx` (caso «R43») y `tests/unit/guards/aporte-satelite-fuente-unica-498.guardia.test.ts` (caso «R43») |
| R4 | `tests/unit/guards/aporte-satelite-fuente-unica-498.guardia.test.ts` (la ayuda la cita) y `tests/unit/docs/ayuda-wallet-satelites-498.test.ts` (filas de R44 y bloque nuevo «506») |
| R5, R6 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`, bloque nuevo «506», con autocomprobación |
| R7 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`, fila 502/R13 sin cambios y bloque nuevo «506» |
| R8 | `tests/components/ConciliacionAcciones502.test.tsx` (502/R6), `tests/components/ConciliacionAcciones500.test.tsx` (500/R3) y `tests/components/Conciliacion498.test.tsx` (503/R4), sin cambios |
| R9 | `tests/components/CierresBodegaAdminDebe498.test.tsx`, bloque nuevo «506»: saldada sin corregir y recibida exacta con dinero. Se adapta el caso 500/R3 «el detalle dice que no» |
| R10 | Mismo archivo, bloque «506»: una fila por cada acción (sin marcar, incompleta, de más, exacta desmarcable, saldada con falta) |
| R11 | Mismo archivo, bloque «506»: sin permiso y sin marcar |

## Fuera de alcance

- Añadir «Corregir» a una saldada o a una recibida exacta (Q2 de la 502).
- Cambiar el servidor: sigue admitiendo la corrección.
- La frase «Después no se puede desmarcar» de la nota, que no vale para una recibida sin dinero. La 502 ya la dejó al pie
  a propósito y la ayuda lo acota.
- La fila de `/wallet/satelites`: su celda de acciones no es una región con nombre y no se anuncia.
- La sección «Saldada con la regla anterior» de la ayuda, ya corregida por la 503.

## Preguntas abiertas

Ninguna. Las decisiones técnicas están en `design.md` §2.
