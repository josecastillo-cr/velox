# 504 — Informe de implementación

Rama `fix/504-frase-saldo-cero`. Spec aprobado: P1 = `No se pudo leer quién le debe a quién. Recargá la página.`; P2 = entra la bodega.

`codebase-memory-mcp` no conectó en esta sesión: la búsqueda se hizo con Grep/Read.

## Archivos tocados

- `components/shared/estado-cuenta/estado-cuenta-labels.ts`: clave `sentidoNoReconocido`; `en_cero` exigido en las dos frases de «no se deben nada»; `empresa_debe` exigido en la frase de la bodega; comentarios. Sin cambios de firma.
- `tests/unit/components/frase-del-saldo-504.test.tsx`: nuevo, 38 tests, con literales escritos a mano.
- `specs/504-frase-saldo-cero/tasks.md`: T1 a T3 marcadas; T4 a falta de `--rapido`.
- `TarjetasEstadoCuenta.tsx` no se toca: su blob es el de `HEAD` (`cfc743f76`).

## Mapa R → test

Todos en `tests/unit/components/frase-del-saldo-504.test.tsx`.

| R | describe | Tests |
| --- | --- | --- |
| R1 | `504 — en cero, oficina (R1)` | 2 |
| R2 | `504 — en cero, la tienda (R2)` | 1 |
| R3 | `504 — no reconocido, oficina (R3)` | 12 (tienda y mensajero × 5 no reconocidos y `por_entregar`) |
| R4 | `504 — no reconocido, la tienda (R4)` | 6 |
| R5 | `504 — no reconocido, bodega (R5)` | 6 (5 no reconocidos y `cuenta_debe`) |
| R6 | `504 — frases conocidas, carácter por carácter (R6)` | 9 |
| R7 | `504 — la tarjeta con sentido no reconocido (R7)` | 2 (`render` en vista oficina y tienda) |

## Salida de los tests

| Qué | Resultado |
| --- | --- |
| T1, test contra el código sin cambiar | 26 rojos (R3 12, R4 6, R5 6, R7 2) y 12 verdes (R1 2, R2 1, R6 9), lo que pedía T1 |
| `frase-del-saldo-504.test.tsx` con el arreglo | 38 de 38 verdes |
| `pnpm typecheck` | exit 0, 0 errores |
| `pnpm lint` | exit 0, 0 errores, 236 avisos |
| `vitest related --run` sobre los dos archivos | exit 0, 37 archivos, 445 tests verdes |
| Los cuatro archivos de T4, las 6 guardias que leen `estado-cuenta/` con `fs` y el test nuevo | exit 0, 11 archivos, 153 tests verdes |

Las guardias se corrieron aparte porque el grafo de importación no las relaciona: `enlace-contraste-458`, `liquidacion-money-safe`, `wallet-barra-unica-467`, `wallet-conceptos-sin-seed`, `wallet-sin-campo-id` y `wallet-textos-458`.

**Sin correr:** `./init.sh --rapido`. Lo corre el leader, por instrucción de esta tarea.

## Mutaciones

Cada una se aplicó sola y corrió `frase-del-saldo-504.test.tsx` de verdad, leyendo el JSON de vitest. El arnés exigía base verde con 38 tests y que el patrón casara una sola vez. Tras cada mutación restauró y comparó el hash del archivo. M8 se corrió en las dos funciones.

| # | Previsto | Cayó | Fallan / 38 | Primer test rojo | Mensaje |
| --- | --- | --- | --- | --- | --- |
| Base | — | — | 0 | — | — |
| M1 | R3 | R3, R7 | 13 | `(R3) tienda sentido "ordenex_debe"` | `expected 'Velox Courier y Tania Tienda no se de…' to be 'No se pudo leer quién le debe a quién…'` |
| M2 | R4 | R4, R7 | 7 | `(R4) sentido "ordenex_debe"` | `expected 'Velox Courier y vos no se deben nada' to be 'No se pudo leer quién le debe a quién…'` |
| M3 | R1 | R1 | 2 | `(R1) una tienda y Velox no se deben nada` | `expected 'No se pudo leer quién le debe a quién…' to be 'Velox Courier y Tania Tienda no se de…'` |
| M4 | R2 | R2 | 1 | `(R2) la tienda lee la frase en segunda persona` | `expected 'No se pudo leer quién le debe a quién…' to be 'Velox Courier y vos no se deben nada'` |
| M5 | R5 | R5 | 6 | `(R5) sentido "ordenex_debe"` | `expected 'Bodega Norte entregó ₡9.000 de más' to be 'No se pudo leer quién le debe a quién…'` |
| M6 | R3, R4, R5, R7 | R3, R4, R5, R7 | 26 | `(R3) tienda sentido "ordenex_debe"` | `expected 'No se pudo ver quién le debe a quién.…' to be 'No se pudo leer quién le debe a quién…'` |
| M7 | R7 | R7 | 2 | `(R7) vista oficina` | `Unable to find an element with the text: No se pudo leer quién le debe a quién. Recargá la página.` |
| M8a, `fraseDelSaldo` | R6 | R6 | 4 | `(R6) oficina: tienda con empresa_debe` | `expected 'Tania Tienda le debe ₡9.000 a Velox C…' to be 'Velox Courier le debe ₡9.000 a Tania …'` |
| M8b, `fraseDelSaldoParaLaTienda` | R6 | R6 | 2 | `(R6) la tienda: empresa_debe` | `expected 'Le debés ₡9.000 a Velox Courier' to be 'Velox Courier te debe ₡9.000'` |

Las 9 mutaciones murieron. M1 y M2 tumban además R7, lo esperable porque el `render` pasa por esas funciones.

Tras la última: 38 de 38 verdes y hashes iguales en los dos archivos de producción.
