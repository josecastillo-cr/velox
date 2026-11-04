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
