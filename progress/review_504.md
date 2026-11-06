# 504 — Frase del saldo: «no se deben nada» solo con saldo en cero · revisión

> Reviewer, 2026-11-06. Worktree `R:/w504`, rama `fix/504-frase-saldo-cero`, HEAD revisado `7d7095ec1`,
> merge-base con `origin/dev` `11aea840b` (la punta de `origin/dev` al revisar). `codebase-memory-mcp` no
> conectó: la búsqueda se hizo con Grep/Read.

## Veredicto: **OK**, condicionado a marcar T4 en `tasks.md` antes del PR

Sin bloqueantes. El código y los tests cumplen R1 a R7. Queda T4 sin marcar (m1): sus condiciones se
cumplen y las comprobé, pero el checkpoint «todas las tasks `[x]`» no se cumple hasta marcarla. Mismo
tratamiento que `review_495.md` con T7. No la marco yo: el reviewer no edita el trabajo revisado.

## Checklist

### Trazabilidad (test leído en `tests/unit/components/frase-del-saldo-504.test.tsx`)

| R | Test | Comprobado |
| --- | --- | --- |
| R1 | `:39-49` | Tienda y mensajero con `en_cero`; `toBe` exacto. Lo tumba M3 del implementador. |
| R2 | `:51-55` | `en_cero` en segunda persona; `toBe` exacto. Lo tumba M4 del implementador. |
| R3 | `:57-63` | 12 casos: tienda y mensajero × `ordenex_debe`, `EN_CERO`, `""`, `undefined`, `null`, `por_entregar`. Lo tumban V2 y V3. |
| R4 | `:65-69` | 6 casos, misma tabla. Lo tumba V1. |
| R5 | `:71-75` | 6 casos con `cuenta_debe`. Lo tumban V4 y V5. |
| R6 | `:77-96` | 9 frases exactas. Lo tumba V9. Verdes contra las labels de `origin/dev`: ver abajo. |
| R7 | `:98-109` | `render` real en las dos vistas: frase neutra, `-₡15.000` y sin «no se deben». Lo tumba V6. Solo con el nombre antiguo (m2). |

M3 y M4 son datos de `impl_504.md`; no las repetí.

### Lo pedido en la revisión

- [x] **Sentidos conocidos, texto exacto.** Con el `estado-cuenta-labels.ts` de `origin/dev` y el test nuevo:
  26 rojos (R3 a R5 y R7) y 12 verdes (R1, R2, R6), los mismos números que T1 en `impl_504.md`. Esos 12 prueban
  que el texto no cambió. `saldo-tienda-card.negativo.test.tsx` y su literal siguen verdes.
- [x] **«no se deben nada» solo con `en_cero`.** `estado-cuenta-labels.ts:81` y `:94`, con `===`. Es el único
  sitio de producción con esa frase.
- [x] **Llamadores.** `TarjetasEstadoCuenta.tsx:54-57` es el único. Por él pasa `EstadoCuenta.tsx:712`, que
  usan `MiEstadoCuenta` (`vista="tienda"`) y `EstadoCuentaTienda`, `EstadoCuentaMensajero` y
  `EstadoCuentaSatelite` (por defecto, oficina). El único productor de `sentido` es
  `EstadoCuentaService.ts:301`, vía `sentidoDe` (`:650-655`): lo que emite coincide con R6, así que ningún
  flujo normal recibe la frase neutra. `TarjetasEstadoCuenta.tsx` conserva su blob (`cfc743f76`).
- [x] **Cruce de versiones.** Sonda propia con `render` (temporal, ya borrada): 87 de 87 verdes. Son tienda,
  mensajero y bodega × las dos vistas × `undefined`, `null`, `""`, `ordenex_debe`, `EN_CERO`, `0`, `1`, `true`,
  `false`, `{}`, `[]`, `"en_cero "`, `"toString"`, `"__proto__"`, más los valores de otro tipo de cuenta
  (tienda y mensajero con `por_entregar`, bodega con `cuenta_debe`). Siempre frase neutra y la tarjeta sigue
  pintada; en los 84 casos con saldo negativo se comprobó además la cifra `-₡15.000` y que no aparece ninguna
  afirmación de saldo.
- [x] **Encaje en la tarjeta (por lectura, no medido en navegador).** La frase va en un `<p>` de
  `TarjetasEstadoCuenta.tsx:64`, sin `truncate`, `nowrap` ni altura fija, así que parte línea igual que las
  demás. Tiene 57 caracteres; `Velox Courier y Mario Mensajero no se deben nada` tiene 48. El spec excluye la
  verificación en navegador porque el caso no se alcanza con cliente y servidor de la misma versión.
- [x] **Voseo.** Encaja en las dos vistas: «Le debés» en `/mi-wallet`; «Elegí… volvé» y «Actualizá la
  pantalla» en la oficina (`estado-cuenta-labels.ts:204`, `HiloNotasOrden.tsx:68`). El texto es el de P1.
- [x] **«Recargá la página» es cierto.** El service worker sirve las navegaciones con la red primero
  (`public/sw.js:343-360`), así que con conexión la recarga trae la versión nueva. Por lectura, no medido.
- [x] **Literales de contrato.** El test no importa `ESTADO_CUENTA_TEXTO` ni `MARCA`. `FRASE_NEUTRA` está
  escrita a mano y `NOMBRE_ESPERADO` es un literal independiente. `MARCA_RETIRADA` solo construye la ENTRADA
  `ordenex_debe`, nunca lo esperado. El design pedía ese valor literal, pero la guardia R16 de la 493 lo prohíbe
  (894565429): desviación justificada.

### Mutaciones propias (distintas de M1 a M8)

Cada una corrió de verdad el test real, con la autocomprobación de base en 38 de 38 verdes y patrón con una sola
coincidencia.

| # | Mutación | Resultado | Fallan / 38 |
| --- | --- | --- | --- |
| V1 | Vista tienda: `!sentido` cuenta como cero | Muerta, R4 (`""`, `undefined`, `null`) | 3 |
| V2 | Oficina: `por_entregar` cuenta como cero | Muerta, R3 | 2 |
| V3 | Oficina: comparar sin distinguir mayúsculas | Muerta, R3 (`EN_CERO`) | 2 |
| V4 | Bodega: `cuenta_debe` dice «de más» | Muerta, R5 | 1 |
| V5 | Bodega: `!sentido` dice «nada por entregar» | Muerta, R5 | 3 |
| V6 | Tarjeta: la cifra pierde el signo | Muerta, R7 | 2 |
| V7 | Tarjeta, vista tienda: `estado.sentido ?? "en_cero"` | **Sobrevive** (m2) | 0 |
| V8 | Tarjeta, vista oficina: `estado.sentido ?? "en_cero"` | **Sobrevive** (m2) | 0 |
| V9 | «Le debés» pierde la tilde | Muerta, R6 | 1 |

Tras revertir: `estado-cuenta-labels.ts` con blob `8fa12b363` y `TarjetasEstadoCuenta.tsx` con `cfc743f76`, iguales
a `HEAD`, y árbol limpio.

### `CHECKPOINTS.md`

- [x] `requirements.md` con EARS numerados y decisiones P1 y P2 anotadas; `design.md` con 4 alternativas descartadas.
- [ ] **Todas las tasks `[x]`: no se cumple, T4 sigue sin marcar** (m1).
- [x] Cada `R<n>` mapea a un test; el mapa está en `impl_504.md`.
- [x] Typecheck, lint y tests: `--rapido` del leader, `INIT_EXIT=0` en `progress/gate_504_2.log`, sobre
  `c94ffbc1c`. De ahí a `HEAD` solo cambia `progress/impl_504.md`. Dos rojos en la corrida global, verdes al
  repetirlos aislados según el log. No corrí el gate, por instrucción y por la regla 5.
- [x] E2E: no aplica en este repo (instrucción de la revisión).
- [x] Datos, webhooks y capas: sin tablas, migraciones ni webhooks (`lib`, `app` y `db` idénticos a `origin/dev`).
  Sin secretos ni contexto de país; la marca sale de `MARCA` y el texto va fuera del JSX.
- [x] `./init.sh` completo: no procede fuera de una release (regla 5).
- [x] Este informe. `progress/history.md` se escribe tras el merge (F2.6 de `AGENTS.md`).

### Verificación ejecutada por el reviewer

- `frase-del-saldo-504.test.tsx`: 38 de 38 verdes; con `saldo-tienda-card.negativo.test.tsx`, 46 de 46.
- Archivos de T4 y dos guardias (`EstadoCuenta`, `WalletRefrescoDirigido`, `mi-wallet-page`,
  `saldo-tienda-card.negativo`, `marca-fuente-unica-493` y `wallet-textos-458`): 6 archivos, 101 tests verdes.
  `marca-fuente-unica-493` es una de las dos que dio rojo en el gate.
- No repetí `asistente-sin-datos.guardia.test.ts`, el otro rojo: para ese me baso en el log del gate.

## Hallazgos

Sin bloqueantes.

- **m1 — `menor` (condición del OK): T4 sin marcar en `specs/504-frase-saldo-cero/tasks.md:28`.** El commit
  7d7095ec1 anotó el gate, pero no marcó la casilla. Sus condiciones están cumplidas: cuatro archivos verdes,
  `INIT_EXIT=0` en el log, R1 a R7 mapeados y T3 documentado. De paso, `impl_504.md:11` y `:41` aún dicen que
  falta `--rapido`, lo que contradice su propia sección «Gate del leader».
- **m2 — `menor`: la tarjeta no prueba el campo ausente.** R7 pasa solo el nombre antiguo por el `render`, que
  es lo que pide la tabla del design, pero el glosario incluye el campo ausente o vacío. V7 y V8 sobreviven: un
  `?? "en_cero"` futuro en `TarjetasEstadoCuenta` volvería a decir «no se deben nada» junto a `-₡15.000` con la
  suite de esta ficha en verde. Hoy el código es correcto (sonda 87 de 87). Basta con añadir `undefined` y `null`
  a los casos del `it.each` de R7.

## Veredicto final: OK

Condicionado a m1. m2 no bloquea; se puede resolver en la misma rama.
