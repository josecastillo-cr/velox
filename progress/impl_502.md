# Ficha 502 — Bitácora de implementación

## Parte backend (T1-T3)

Solo tests contra Postgres. `lib/` no cambia. Rama `fix/502-conciliacion-satelite-menores-500`, desde `be662423`.

Búsqueda de código: `codebase-memory` no conectó (timeout); se usó Grep/Read sobre los archivos reales.

### Archivos

| Archivo | Cambio |
| --- | --- |
| `tests/integration/db/zona-distrito-rastro-500.test.ts` | `raizDistintaDeTx` y caso «502/R4/R5» |
| `tests/integration/db/502-corregir-de-mas-sql-real.test.ts` | Nuevo: las 7 filas de `design.md` §3.1 y el caso con cierres reales |
| `specs/502-menores-conciliacion-satelite/tasks.md` | T1-T3 marcadas |

### Mapa R → test (backend)

| R | Test |
| --- | --- |
| R4 | `zona-distrito-rastro-500.test.ts`, «502/R4/R5», `expect(r.desdeOtraConexion).toBe(0)` |
| R5 | El mismo caso, `expect(trasRevertir).toBe(0)` |
| R11 | `502-corregir-de-mas-sql-real.test.ts`: cada fila de la tabla (variación); «la fila de la marca y su movimiento quedan byte a byte iguales»; «cada correccion deja una fila de historial»; «con cierres reales» (`filasDeLosLibros` igual) |
| R12 | El mismo archivo: `faltaPorRecibir` de cada fila leída con `findConsolidacionesPaginado`; «corregir a 0 lo que debe un positivo se rechaza sin cambiar nada» |

R1-R3, R6-R10 y R13 son de `frontend_dev` (T4 en adelante).

### T3: la tabla de `design.md` §3.1 contra Postgres

**Coincide en las siete filas.** Medido con literales a mano, sin importar la fórmula, por `marcarConciliado`,
`corregirConciliacion` y el lector de la pantalla. Las columnas de ajuste y movimiento salen de `filasDeDiferencia`.

| Debe | Marcada por | Corregir a | Resultado | Ajuste nuevo | Movimiento | Falta | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 90 | 0 | `updated` | +90 | egreso 90 | 0.00 | recibido |
| 800 | 1000 | 800 | `updated` | +200 | egreso 200 | 0.00 | recibido |
| 800 | 1000 | 700 | `updated` | +300 | egreso 300 | 100.00 | incompleto |
| 800 | 1000 | 900 | `updated` | +100 | egreso 100 | −100.00 | recibido |
| 800 | 1000 | 1100 | `updated` | −100 | ingreso 100 | −300.00 | recibido |
| 800 | 1000 | 0 | `recibido_cero_con_aporte` | ninguno | ninguno | −200.00 | recibido |
| −100 | 0 | 30 | `updated` | −30 | ingreso 30 | −130.00 | recibido |

También medido:

- En las siete, la fila de ajuste de la marca y su movimiento quedan byte a byte iguales (`to_jsonb`).
- Las seis corregidas añaden una sola fila de historial, con el par anterior/nuevo.
- La rechazada deja igual la fila entera de `cierre_bodega`, los ajustes y el historial.
- Con cierres reales (marca por aporte + 200, corregida al aporte): `filasDeLosLibros` igual antes y después, con filas
  en los tres libros, y falta 0.00.

**Límite de la medición.** La columna «Estado» se obtiene con `estadoConciliacionDe` sobre la salida del lector real,
que es la función del badge. No se ha visto en pantalla: eso es T9.

### Mutaciones

**T2 / T6.10: `lib/repositories/ZonaRepository.ts:775`, `tx` → `this.prisma`.** Corrió el archivo entero
(`progress/mutacion_502_t2.log`):

```
 × ... > 502/R4/R5: las filas del rastro existen dentro de la tx, no se ven desde otra conexion y no sobreviven al revertir
   → expected 2 to be +0 // Object.is equality
 ❯ tests/integration/db/zona-distrito-rastro-500.test.ts:354:33
    354|     expect(r.desdeOtraConexion).toBe(0); // R4
 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
VITEST_EXIT=1
```

- Rojo exacto: el caso nuevo, con `2` frente a `0` en la lectura desde la otra conexión.
- Los otros 7 casos siguen verdes con la mutación aplicada: es la limitación de `clienteConSavepoint` que motivó el
  caso, y prueba que el rojo no viene de otra cosa. El `git diff` de la mutación está al principio del log.
- Revertida con `git restore`. `git status --short -- lib/` sale vacío.
- Residuos, consulta directa sobre `localhost` antes y después de la mutación:
  `{"host":"localhost","etiquetaDeTest":0,"sinZona":0,"totalAccion":0}` (`etiquetaDeTest`: filas con etiqueta
  `500 A 500-%`; `sinZona`: filas cuya zona no existe; `totalAccion`: todas las `zona_distrito_cambiado`). La limpieza
  previa a los `expect` funcionó.

**T2b: la aserción de R5 también muerde** (no lo pedía la tarea). R4 se detiene antes en el rojo anterior, así que no
demostraba nada de R5. Con la misma mutación y la línea de R4 quitada temporalmente (`progress/mutacion_502_t2b.log`):

```
AssertionError: expected 2 to be +0 // Object.is equality
 ❯ tests/integration/db/zona-distrito-rastro-500.test.ts:355:26
      Tests  1 failed | 7 skipped (8)
```

La línea 355 es `expect(trasRevertir).toBe(0)`. Mismos residuos: 0. Test y `lib/` restaurados (`cmp` contra la copia).
Un primer intento de esta variante no ejecutó nada: Git Bash reescribió el `//` de un argumento y el archivo no parseó
(`Tests no tests`). No cuenta; el resultado de arriba es el de la repetición.

**T3: `lib/repositories/CierresBodegaAdminRepository.ts:865`, sin `.minus(asentada)`.** Corrió el archivo entero
(`progress/mutacion_502_t3.log`):

```
 Test Files  1 failed (1)
      Tests  7 failed | 7 passed (14)
VITEST_EXIT=1
```

Rojas: las seis filas corregidas y «corregir hasta lo que debe escribe solo la variacion». Verde, como debe: la fila
rechazada, que no llega a `escribirDiferencia`. Revertida; `git status --short -- lib/` vacío.

### Salidas

```
pnpm typecheck                                     TYPECHECK_EXIT=0
pnpm lint                                          235 problems (0 errors, 235 warnings), LINT_EXIT=0
pnpm exec eslint <los dos archivos de test>        sin salida, exit 0
pnpm exec vitest run tests/integration/db/502-corregir-de-mas-sql-real.test.ts tests/integration/db/zona-distrito-rastro-500.test.ts
 Test Files  2 passed (2)
      Tests  22 passed (22)                        VITEST_EXIT=0, sin skipped
```

Base medida: `localhost:5432/ordenex`, esquema al día (`prisma migrate status`). Sin vacuidad: los casos afirman premisas
(`soloOk`, 2 filas dentro de la `tx`, la zona sin commitear invisible desde la otra conexión, las siete filas medidas,
filas en los tres libros), y las mutaciones de arriba muestran que los casos corren y se ponen rojos.

No se corrió `./init.sh` ni la suite completa: el gate es del leader.

**Veredicto (backend):** T1-T3 hechas; la tabla que sostiene Q1 coincide con Postgres y las mutaciones mueren.

## Parte frontend (T4-T9)

Búsqueda de código: `codebase-memory` no conectó (timeout); se usó Grep/Read sobre los archivos reales.

### Archivos

| Archivo | Cambio |
| --- | --- |
| `components/shared/conciliacion/ConciliacionAcciones.tsx` | Fuera la nota del diálogo de Desmarcar; `esCorreccion` incluye la recibida de más y decide botón y envío |
| `components/shared/conciliacion/conciliacion-labels.ts` | Solo comentarios: el valor de la nota no cambia |
| `app/(app)/cierres-admin/_components/cierre-labels.ts` | `llegoDeMas` |
| `docs/ayuda/oficina/wallet-satelites.md` | «Llegó completo o de más» y la frase de R13 |
| `tests/components/ConciliacionAcciones502.test.tsx` | Nuevo |
| `tests/components/Conciliacion498.test.tsx`, `tests/integration/wallet-satelites.test.tsx` | R1 invertido; `NOTA_R43` sigue a mano; caso de R7 en la primera |
| `tests/components/CierresBodegaAdminDebe498.test.tsx` | Caso de R7 |
| `tests/unit/docs/ayuda-wallet-satelites-498.test.ts` | Dos puntos «(502/R13)» |

### Mapa R → test (completo)

| R | Test |
| --- | --- |
| R1 | `Conciliacion498.test.tsx`, «502/R1 — el diálogo de «Desmarcar» NO lleva la nota…»; `wallet-satelites.test.tsx`, «⭑ «Desmarcar» dice el importe…», `not.toHaveTextContent("Marcar recibido asienta el dinero en la caja.")` |
| R2 | `wallet-satelites.test.tsx`, el mismo caso: «Ahora mismo consta recibida por» y «₡485.000» |
| R3 | `Conciliacion498.test.tsx`, «R43 — la nota del pie es LITERAL»; `wallet-satelites.test.tsx`, «R43 — la nota de la conciliación va al pie…»; `aporte-satelite-fuente-unica-498.guardia.test.ts`, valor de la constante y ayuda; `ayuda-wallet-satelites-498.test.ts`, «la nota literal de R43». Ninguno cambió; el literal sigue escrito a mano |
| R4 | `zona-distrito-rastro-500.test.ts`, «502/R4/R5», `expect(r.desdeOtraConexion).toBe(0)` |
| R5 | El mismo caso, `expect(trasRevertir).toBe(0)` |
| R6 | `ConciliacionAcciones500.test.tsx`, «recibida con `puedeDesmarcar={false}`…» (sin tocar); `ConciliacionAcciones502.test.tsx`, «502/R6», con `0.00`, `-0.00`, `-0` y `0` |
| R7 | `ConciliacionAcciones502.test.tsx`, «502/R7»; `Conciliacion498.test.tsx`, «502/R7» (`/wallet/satelites`); `CierresBodegaAdminDebe498.test.tsx`, «502 (R7)» (`/cierres-admin`) |
| R8 | `ConciliacionAcciones502.test.tsx`, «502/R8» (botón y action) |
| R9 | `ConciliacionAcciones502.test.tsx`, «502/R9» (corregir 1 vez, marcar 0) |
| R10 | `ConciliacionAcciones502.test.tsx`, «502/R10» (título, monto y nota de partida, aviso literal «Monto recibido corregido a ₡800.») |
| R11 | `502-corregir-de-mas-sql-real.test.ts`: cada fila de la tabla; «la fila de la marca y su movimiento quedan byte a byte iguales»; «cada correccion deja una fila de historial»; «con cierres reales» |
| R12 | El mismo archivo: `faltaPorRecibir` de cada fila con `findConsolidacionesPaginado`; «corregir a 0 lo que debe un positivo se rechaza sin cambiar nada» |
| R13 | `ayuda-wallet-satelites-498.test.ts`, ««Corregir» aparece en una recibida incompleta o de más (502/R13)» y ««Recibido» incluye lo que llegó de más (502/R13)» |

Ningún R queda sin test.

### Rojos y mutaciones (todas revertidas)

| Paso | Qué | Resultado |
| --- | --- | --- |
| T4 | Los dos tests de R1 contra el código viejo | 2 rojos, solo por la nota; 60 verdes |
| T5 | Quitar la nota | Verde, 101 tests en 5 archivos: los dos de T4, la guardia de la 498, el de la ayuda y `textos-satelite-definitivos-500` |
| Mutación T5 | Reponer la línea de la nota | Los mismos 2 rojos (`progress/mutacion_502_t5.log`) |
| T6-A | Tests de R7-R10 contra el código viejo | 21 rojos; verdes los de ausencia (R6, y R8 botón) y `ConciliacionAcciones500` sin tocar |
| T7-A | `llegoDeMas` y `esCorreccion` | 64 verdes en 4 archivos |
| Mutación R9 | Botón nuevo con `esCorreccion` viejo | Rojos R9 y el aviso de R10 (`progress/mutacion_502_r9.log`) |
| Mutación R8 | Quitar `estado === "recibido" &&` | Rojos los dos casos de R8 (`progress/mutacion_502_r8.log`) |
| T8-A | Puntos de R13 antes de tocar la ayuda | 2 rojos; verdes después |

El rojo exacto de la mutación R9: `expected "vi.fn()" to be called 1 times, but got 0 times` sobre la action de corregir.

### T9: ver la app

Dev server único de este worktree, `next dev --webpack -p 3502`, con `admin.qa@ordenex.test` sobre `localhost:5432`. Sembré
una zona propia, `T9 502 Bodega`, con cuatro consolidaciones sin cierres. Las respuestas son las de la server action,
capturadas en el navegador, y el aviso se sondeó desde antes del clic.

**m4, `/wallet/satelites/<zona>`.** Diálogo, literal:
`Desmarcar / Consolidación de T9 502 Bodega del 1 oct. / Ahora mismo consta recibida por ₡500. / Cancelar / Desmarcar`.
Sale el importe y no sale la nota. El pie sigue diciendo, literal: «Marcar recibido asienta el dinero en la caja. Después no
se puede desmarcar: si el monto no es el correcto, usa «Corregir»».

**m4, `/cierres-admin`.** El mismo diálogo, sin la nota:
`Consolidación de T9 502 Bodega del 2026-10-01. / Ahora mismo consta recibida por ₡500.`

**m5.** Debe y marcada por, con el resultado:

| Pantalla | Debe | Marcada | Premisa en pantalla | Diálogo | Corregida a | Action y aviso | Tras corregir |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/wallet/satelites` | 800 | 890 | «Recibido», «Falta por recibir −₡90», un solo botón: «Corregir» | «Corregir el monto recibido», campo `890.00` | 800 | `ok`; aviso a 483 ms | «Recibido», falta ₡0, 0 botones |
| `/cierres-admin` | 700 | 750 | Botón «Corregir» y no «Desmarcar» | «Corregir el monto recibido», campo `750.00` | 700 | `ok`; aviso literal «Monto recibido corregido a ₡700.» a 248 ms | 0 botones |

Consulta tras cada una, la variación exacta y nada más:

| Consolidación | Ajustes (evento, diferencia) | Movimientos | Historial (anterior → nuevo) |
| --- | --- | --- | --- |
| Debe 800 | marca −90.00; correccion +90.00 | ingreso 90.00; egreso 90.00 (`*_diferencia_satelite`) | marca; 890.00 → 800.00 |
| Debe 700 | marca −50.00; correccion +50.00 | ingreso 50.00; egreso 50.00 (`*_diferencia_satelite`) | marca; 750.00 → 700.00 |

Además, una de más sin dinero sembrada por SQL (debe 600, marcada 650): la tarjeta de `/cierres-admin` dice «Recibido» y el
detalle ofrece «Corregir» y «Desmarcar», los dos, como pide R7.

**Límite de la medición.** En `/cierres-admin` el `−₡50` no se vio en pantalla: ni la tarjeta ni el detalle abierto lo enseñan. El desplegable «Ver detalles» sí pinta la falta (`cierre-factura.tsx:645-650`; corregido por m2 de la revisión), pero no se abrió en T9. Se vio el badge «Recibido», y el monto sale de la base (`750.00` sobre `700.00`). La falta negativa en pantalla
se vio solo en `/wallet/satelites`.

**Lo que T9 me enseñó y no es de esta ficha.**

- El modal «Confirmá el SINPE de GAM» tapa la pantalla al admin QA y deja el resto `aria-hidden`. Lo descarté con «Ahora no», sin
  confirmar.
- Con filas sembradas sin cierres, el estado de cuenta dice «Por entregar hoy −₡500», con «Declarado ₡0» en cada
  consolidación. Lo atribuyo a sembrar sin `cierre_dia`, porque el declarado sale de los cierres; no lo medí aparte.

**Limpieza, comprobada con consulta.** Borrados 4 movimientos, 4 ajustes, 4 filas de historial, 4 consolidaciones y la zona.
Después: `cierre_bodega` 0, `conciliacion_bodega_ajuste` 0, `wallet_movimiento` 29 y `zona` 70, los mismos que antes;
`jobs` 263 en todo momento. Ningún movimiento `*_diferencia_satelite` ni historial con ids de esta prueba.
`historial_accion` queda en 1007 frente a 1005 al empezar: esas dos filas son de `cobro_*_aprobado`, con actores
`QA Maestro 362` y `maestro 454`. Aparecieron durante T9, sin que ningún flujo de T9 escriba esas acciones, y hay otro agente
sobre la base compartida: no las toqué.

Dev server parado, `.next/dev` borrado, y su log (que registra la contraseña del login), fuera del repo y borrado. Las
capturas no se commitean: quedan en el scratchpad de la sesión (`t9_m4_*.png`, `t9_m5_*.png`), y el texto citado arriba es
la evidencia.

### Salidas

```
pnpm typecheck                                  TYPECHECK_EXIT=0
pnpm lint                                       235 problems (0 errors, 235 warnings), LINT_EXIT=0 (el mismo número que en la parte backend)
pnpm exec eslint <archivos tocados>             sin salida, exit 0
pnpm exec vitest related --run <archivos>       192 archivos, 2805 tests, VITEST_EXIT=0
pnpm exec vitest run <8 archivos>               8 archivos, 144 tests, VITEST_EXIT=0
```

Los 8: los cuatro que nombra el spec (`Conciliacion498`, `wallet-satelites`, `ayuda-wallet-satelites-498`,
`aporte-satelite-fuente-unica-498.guardia`), más `ConciliacionAcciones500`, `ConciliacionAcciones502`,
`CierresBodegaAdminDebe498` y `textos-satelite-definitivos-500`. Las guardias leen con `fs`, y `related` puede no alcanzarlas:
por eso esa corrida va aparte.

No se corrió `./init.sh` ni la suite completa: T10.2 es del leader.

**Veredicto (frontend):** T4-T9 y T10.1 hechas; R1-R13 con test; la app hace lo que dice el spec en las dos pantallas.

## T10.2: gate del leader

`./init.sh --rapido` sobre 81a0dab1: `INIT_EXIT=0`, ampliado con `integration/db`. Intermitentes, verdes aislados: `CierresAdminFiltros`, `liquidacion-reparto-migration`, `454/caracterizacion/corte-concurrencia`. Después solo entró el informe de revisión.
