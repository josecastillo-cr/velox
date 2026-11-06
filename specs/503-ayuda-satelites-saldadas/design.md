# Ficha 503 — Diseño

> Búsqueda: `codebase-memory` no conectó en esta sesión; se usó Grep/Read y cada línea citada se leyó en el archivo real
> sobre `dev` en `b1cd8e853`. Nada de este documento se ha ejecutado.

Sin migración, tablas, RLS, rutas ni contratos. El único archivo que cambia fuera de `tests/` es
`docs/ayuda/oficina/wallet-satelites.md`.

## 1. La frase

Lo que hace hoy la fila, leído en el código:

| Pieza | Hecho |
| --- | --- |
| Falta de una saldada | `esperado_regla_anterior = monto_recibido`, así que la falta es 0 (`aporteDeConsolidacion`, `faltaPorRecibir` en `lib/utils/conciliacion-satelite.ts`) |
| Estado | `estadoConciliacionDe` da «recibido» con falta 0 |
| «Corregir» | `esCorreccion` exige «incompleto» o «recibido» con falta negativa (`ConciliacionAcciones.tsx:145-146`): no sale |
| «Marcar recibido» | Solo con estado «pendiente» (`:214`): no sale |
| «Desmarcar» | `puedeDesmarcar`, y `puedeDesmarcarse` lo niega en una saldada (`conciliacion-satelite.ts:100`): no sale |
| Las dos pantallas | Montan el mismo componente (`ConciliacionSatelite.tsx:334`, `CierresBodegaAdminModule.tsx:886`) con el valor del servidor |
| Otra vía en la app | Ninguna: `ConciliacionAcciones.tsx:151` es el único llamador de la action de corregir |

En `wallet-satelites.md:129-130`, en voseo como el resto de la página, se sustituye «Si alguna se marcó por un monto
equivocado, se arregla con **Corregir**.» por:

> Esa fila no ofrece ningún botón, ni **Corregir** ni **Desmarcar**: su monto no se puede cambiar desde la pantalla.

Se actualiza `actualizado:` en la cabecera al día de la implementación. `fuentes:` ya lista los archivos que respaldan la
frase. Si Q1 se responde B, se añade la frase del responsable que dé el humano.

**Caso límite que la frase no cubre, a propósito.** Si alguien llamara a la action a mano, la saldada quedaría con falta
distinta de 0 y la pantalla ofrecería «Corregir» (la corrección se mide contra lo reconocido: test `:549`). Desde la app no
se llega a ese estado, por eso R4 y R5 hablan de la saldada **sin corregir**.

## 2. Los tests: qué ancla cada uno

Comparar la ayuda con un literal solo prueba que la ayuda dice lo que dice el test; no que sea verdad. Por eso van dos
anclas distintas:

**Texto (R1-R3), en `ayuda-wallet-satelites-498.test.ts`.** Literales a mano, sin importar nada de `components/` ni leer
la frase de otra fuente. Un ayudante local recorta **la sección** entre `## Saldada con la regla anterior` y el siguiente
`## `, para que un «Corregir» de otra sección no cuente. Los patrones usan `\s+` entre palabras porque el Markdown parte líneas:

- R1: `/Esa\s+fila\s+no\s+ofrece\s+ningún\s+botón,\s+ni\s+\*\*Corregir\*\*\s+ni\s+\*\*Desmarcar\*\*:\s+su\s+monto\s+no\s+se\s+puede\s+cambiar\s+desde\s+la\s+pantalla/`.
- R2: la sección no casa con `/se\s+arregla/i` ni con `/(usa|con)\s+[«*]*Corregir/`.
- R3: rótulo, `/su\s+\*\*Debe\*\*\s+es\s+lo\s+que\s+se\s+marcó\s+entonces/` y `/no\s+deben\s+nada/`.
- Autocomprobación, como la del archivo: sembrar la frase vieja en la sección pone rojo R2, y quitar la nueva pone rojo R1.
  También comprueba que la sección recortada no esté vacía.

**Verdad (R4, R5), contra la pantalla y el servidor.** Es lo que se pondrá rojo si un día la fila gana un botón, y obliga a
revisar la frase.

- R4, caso nuevo en `Conciliacion498.test.tsx`, con su `montar` y `consolidacion`. Dos filas: la saldada (fixture de R41a, con
  `puedeDesmarcar: false`) y una de control «Recibido incompleto» con otra fecha y otro `cierreBodegaId`. La fila se busca desde el
  rótulo con `closest("tr")`, y `within(fila).queryAllByRole("button")` debe tener 0 elementos. El alcance es la fila porque la
  región tiene otros botones, como la descarga. El control debe ofrecer «Corregir»: sin él, un «0 botones» pasaría también
  con `puedeConciliar` caído.
- `puedeDesmarcar: false` en ese fixture es una afirmación del test. Su respaldo real es `500-con-dinero-sql-real.test.ts:257` y
  `:275-276`, contra Postgres.
- R5 se apoya en tests existentes (ver trazabilidad), sin caso nuevo: mismo componente, mismas props.

## 3. Alternativas descartadas

**A1. Añadir el botón a la fila.** Es lo que el servidor admite, y el cambio sería de una condición. El humano ya decidió
no ampliar (Q2 de la 502).

**A2. Borrar la frase sin poner otra.** Es lo mínimo y ya no sería falsa, pero el párrafo general (`:112-114`) sigue diciendo que
un monto incorrecto se cambia con «Corregir», y el lector lo aplicaría a la saldada. Hay que decir la excepción.

**A3. Una guardia que derive el texto de la ayuda de las condiciones del componente.** Atar Markdown a código exige leer
`ConciliacionAcciones.tsx` con `fs` o compartir una constante, y un texto comparado con su propia fuente siempre está verde.
El test del DOM mide lo mismo, sin ese acoplamiento.
