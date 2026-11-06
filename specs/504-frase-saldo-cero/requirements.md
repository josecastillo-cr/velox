# 504 — Frase del saldo: «no se deben nada» solo con saldo en cero

Hallazgo m6 de `progress/review_494_t3.md`. Hoy esa frase se dice por descarte: cualquier sentido
del saldo que la pantalla no reconoce acaba afirmando que nadie le debe a nadie, aunque la cifra de
encima diga otra cosa.

## Glosario

- **Sentido:** el campo que dice quién le debe a quién. El servidor solo emite `empresa_debe`,
  `cuenta_debe`, `por_entregar` y `en_cero`.
- **Sentido no reconocido:** cualquier otro contenido del campo, incluido un nombre antiguo
  (`ordenex_debe`), el campo ausente o vacío, y un valor conocido que no corresponde a esa cuenta
  (la lista exacta está en R3, R4 y R5).
- **Frase neutra:** el texto de P1. Mientras P1 no se cierre, los requisitos usan el texto propuesto:
  `No se pudo leer quién le debe a quién. Recargá la página.`

## Requisitos

- **R1** (condicional) — SI el sentido es `en_cero` y la cuenta es una tienda o un mensajero vistos
  desde la oficina, ENTONCES el sistema DEBE mostrar exactamente `«marca» y «nombre» no se deben nada`.
- **R2** (condicional) — SI el sentido es `en_cero` y la tienda mira su propia cuenta, ENTONCES el
  sistema DEBE mostrar exactamente `«marca» y vos no se deben nada`.
- **R3** (condicional) — SI la cuenta es una tienda o un mensajero vistos desde la oficina y el sentido
  no es `empresa_debe`, `cuenta_debe` ni `en_cero`, ENTONCES el sistema DEBE mostrar la frase neutra.
- **R4** (condicional) — SI la tienda mira su propia cuenta y el sentido no es `empresa_debe`,
  `cuenta_debe` ni `en_cero`, ENTONCES el sistema DEBE mostrar la frase neutra.
- **R5** (condicional, sujeto a P2) — SI la cuenta es una bodega y el sentido no es `por_entregar`,
  `en_cero` ni `empresa_debe`, ENTONCES el sistema DEBE mostrar la frase neutra.
- **R6** (ubicuo) — El sistema DEBE mostrar, para las combinaciones que el servidor emite, las mismas
  frases que antes de esta ficha, carácter por carácter (tabla en `design.md §3`).
- **R7** (condicional) — SI la tarjeta del saldo recibe un sentido no reconocido, ENTONCES el sistema
  DEBE mostrar la frase neutra junto a la cifra del saldo actual con su signo, sin dejar de pintar la
  tarjeta.

## Fuera de alcance

- Las pestañas con la versión ya desplegada: el arreglo solo actúa desde el cliente que lo lleve
  (m6 lo dice expresamente).
- Skew Protection y los demás fallos del cruce de versiones (`CajaResumenCard`), que m6 y la revisión
  de la 494 dejan aparte.
- Cambiar qué sentido emite el servidor o cómo lo calcula.

## Preguntas abiertas

- **P1 — ¿Qué dice la frase cuando no se reconoce el sentido?** No se deduce del código ni de `docs/`.
  **Recomendación:** `No se pudo leer quién le debe a quién. Recargá la página.` Sigue el patrón
  «No se pudo…» de la misma pantalla, usa el voseo de esa pantalla, no afirma nada sobre el dinero y
  dice lo único que lo cura. Sirve igual para las dos vistas y para la bodega.
  **Alternativa:** no mostrar ninguna frase, solo la cifra. No añade texto nuevo, pero deja la cifra sin
  explicación y obliga a cambiar el componente y el tipo que devuelven estas funciones.
- **P2 — ¿Entra la frase de la bodega?** La ficha solo nombra «no se deben nada», pero la bodega tiene
  el mismo defecto con otras palabras: un sentido no reconocido acaba en `«nombre» entregó ₡X de más`.
  **Recomendación:** incluirla (R5), porque es una línea en la misma función y es la misma afirmación
  falsa. Si no se aprueba, se quitan R5, su test y su mutación; lo demás no cambia.

## Decisiones del humano (2026-11-06)

- **P1:** `No se pudo leer quién le debe a quién. Recargá la página.`
- **P2:** entra la frase de la bodega; R5, su test y M5 se mantienen. Spec aprobado.
