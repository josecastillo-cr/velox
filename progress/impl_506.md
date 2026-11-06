# Ficha 506 — Implementación

Rama `fix/506-saldadas-textos-corregir`, worktree `R:/w506`. Búsqueda con Grep/Read: `codebase-memory-mcp` no conectó.
Sin migración, sin cambio de servidor y sin botones nuevos.

## Archivos tocados

- `components/shared/conciliacion/conciliacion-labels.ts`: los dos avisos y la nota (`design.md` §3), y su comentario.
- `app/(app)/cierres-admin/_components/cierre-labels.ts`: `accionesConciliacionDe` y `hayAccionConciliacion`.
- `components/shared/conciliacion/ConciliacionAcciones.tsx`: deriva de ahí sus tres botones, `esCorreccion` y `montoActual`; comentarios.
- `app/(app)/cierres-admin/_components/CierresBodegaAdminModule.tsx`: condición de la región y comentarios.
- `lib/actions/conciliacion-satelites.ts`: solo el comentario que cita el aviso.
- `docs/ayuda/oficina/wallet-satelites.md`: sección «Una vez marcada». `actualizado:` ya decía 2026-11-06, la fecha de hoy, y no cambia. LF.
- `tests/components/CierresBodegaAdminDebe498.test.tsx`: `abrirDetalle` espera el detalle cargado y recibe el permiso; caso 500/R3 adaptado `[S]`; bloque «506».
- `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`: patrones de las filas de R44, `seccionDe` y bloques «506» y «506 — AUTOCOMPROBACION».
- Literal nuevo a mano: `tests/components/Conciliacion498.test.tsx`, `tests/components/ConciliacionAcciones500.test.tsx`, `tests/integration/wallet-satelites.test.tsx`, `tests/unit/guards/aporte-satelite-fuente-unica-498.guardia.test.ts`.
- `specs/506-saldadas-textos-corregir/tasks.md`: marcado, con T4.3 abierta.

## Mapa R → test

| R | Test |
| --- | --- |
| R1 | `tests/components/Conciliacion498.test.tsx:293` (revisión m2); `tests/components/ConciliacionAcciones500.test.tsx:111` (500/R7, fila `saldada_regla_anterior`) |
| R2 | `tests/components/Conciliacion498.test.tsx:261` (`TEXTO_R21`); `tests/components/ConciliacionAcciones500.test.tsx:111` (500/R7, fila `con_asientos`) |
| R3 | `tests/components/Conciliacion498.test.tsx:410`; `tests/integration/wallet-satelites.test.tsx:455`; `tests/unit/guards/aporte-satelite-fuente-unica-498.guardia.test.ts:156` |
| R4 | `tests/unit/guards/aporte-satelite-fuente-unica-498.guardia.test.ts:156`; `tests/unit/docs/ayuda-wallet-satelites-498.test.ts:26`, `:32` y `:188` |
| R5 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts:193` |
| R6 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts:197` y `:201` |
| R7 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts:205` y `:30` (502/R13, sin cambios) |
| R8 | `tests/components/ConciliacionAcciones502.test.tsx:124` (502/R6); `tests/components/ConciliacionAcciones500.test.tsx:65` (500/R3); `tests/components/Conciliacion498.test.tsx:467` (503/R4). Aserciones sin cambios |
| R9 | `tests/components/CierresBodegaAdminDebe498.test.tsx:258`; adaptado: `:213` |
| R10 | `tests/components/CierresBodegaAdminDebe498.test.tsx:270` (cinco filas) |
| R11 | `tests/components/CierresBodegaAdminDebe498.test.tsx:276` |

Autocomprobación del bloque de la ayuda: la sección vieja, sembrada como literal, enciende cada patrón de R6; el voseo «usá **Corregir**» enciende el suyo; la sección nueva sin la frase de R5 lo apaga; el recorte no pasa del título siguiente y da lo mismo con CRLF.

## Salida de los tests

Con `DATABASE_URL` exportada a `localhost:5432/ordenex`. **Ningún test `skipped` en ninguna tanda.**

| Tanda | Resultado |
| --- | --- |
| Tests primero, contra el código viejo | 146 tests, 20 rojos: los esperados de T1.1, T2.1 y T3.1, y uno ajeno (abajo). R10 y R11 en verde |
| Archivos del spec, con las tres guardias | 213 de 213, 9 archivos |
| `pnpm exec vitest related --run` sobre los 5 fuentes tocados | 3441 de 3441, 240 archivos, `VITEST_EXIT=0` |
| T4.2: las 3 guardias más todo test que nombra un archivo tocado o `docs/ayuda`, tras las mutaciones | 733 de 733, 43 archivos, `VITEST_EXIT=0` |
| `pnpm typecheck` / `pnpm lint` | exit 0 / exit 0, sin avisos en los archivos tocados |

**Intermitente, anotado y no perseguido.** En la tanda de tests primero cayó «⭑ R28: la resta SQL del aporte solo vive en `deuda-satelite-sql.ts`» de la guardia de la 498, por tiempo (30,7 s). Barre `lib/` y `app/` con `fs`. La misma guardia pasó en todas las tandas siguientes, sin cambios que le afecten.

**El gate no se corrió:** lo corre el leader (T4.3).

## Mutaciones

Arnés en el scratchpad de la sesión: exige un patrón único, usa el reporte JSON de vitest, escribe los bytes originales en un `finally` y compara el SHA-256 de cada archivo. Línea base: 172 de 172, 0 `skipped`. Tras las 14, `git diff` idéntico byte a byte al de antes de empezar.

| R | Mutación | Tests corridos | Rojos | Casos que la matan |
| --- | --- | --- | --- | --- |
| R1 | Aviso viejo de la saldada | 34 | 2 | `Conciliacion498` «revisión m2»; `ConciliacionAcciones500` «`saldada_regla_anterior` →» |
| R2 | Restaurar `conAsientos` | 34 | 2 | `Conciliacion498` «con `con_asientos`»; `ConciliacionAcciones500` «`con_asientos` →» |
| R3 | Restaurar la constante de la nota | 78 | 3 | `Conciliacion498` «R43»; `wallet-satelites` «R43»; guardia «⭑ R43: la nota» |
| R4 | Cita vieja de la nota en la ayuda | 60 | 5 | Guardia «⭑ R43: la nota»; ayuda «la nota literal de R43», «R4» y dos de «R6» |
| R5 | Borrar la frase de la recibida exacta | 46 | 2 | Ayuda «R5»; autocomprobación «sin la frase de R5» |
| R6 | Añadir «Si hay un error, usá **Corregir**.» | 46 | 1 | Ayuda «R6», patrón `(usa\|usá\|con)` |
| R7 | Borrar «quién corrigió y cuándo» | 46 | 1 | Ayuda «R7», ese patrón |
| R8 | `corregir` sin `llegoDeMas` | 60 | 6 | 502/R6 (las 4 filas de falta 0), 500/R3 y 503/R4 |
| R9 | Condición solo `puedeConciliar` | 13 | 2 | «R9 — saldada sin corregir»; «R9 — recibida exacta con dinero» |
| R9, R10 | Condición `!saldadaReglaAnterior` | 13 | 2 | «R9 — recibida exacta con dinero»; «R10 — saldada con falta» |
| R10 | `hayAccionConciliacion` sin `desmarcar` | 13 | 2 | «R10 — exacta que se puede desmarcar»; 500/R3 «el detalle dice que se puede» |
| R10 | `hayAccionConciliacion` sin `corregir` | 13 | 4 | «R10 — incompleta», «de más» y «saldada con falta»; 502/R7 |
| R10 | `hayAccionConciliacion` sin `marcar` | 13 | 3 | «R10 — sin marcar»; los dos de 498/R16 |
| R11 | Quitar `puedeConciliar &&` | 13 | 1 | «R11 — sin permiso» |

14 de 14 rojas. **El arnés imprimió «VIVA» en R8, y era un fallo del arnés:** buscaba 502/R6 y 500/R3 en el título del caso, y esos códigos están en el `describe`. El `fullName` del JSON confirma los 6 rojos de la tabla.

## Ver la app (T4.4)

Se hizo antes del gate, porque el gate lo corre el leader. Playwright contra un solo dev server, `next dev --webpack` en el puerto 3506, con `admin.qa@empresa.test`. El entorno se heredó de un wrapper con `process.loadEnvFile`, sin copiar el `.env` y sin imprimir valores. Sin seeds; la contraseña coincidió.

**Filas.** `cierre_bodega` estaba vacía. Se insertaron 3 filas de prueba, en tres satélites, y se borraron por id en un `finally`.

| Pantalla | Fila | Lo que dio el DOM |
| --- | --- | --- |
| `/cierres-admin`, Bodega → Resueltos → detalle | Saldada sin corregir (`monto_recibido` = esperado = 64000) | Región: **0**. Botones del diálogo: solo «Cerrar» |
| Igual | Control: saldada con falta (recibido 60000, esperado 64000) | Región: **1**, con «Corregir el monto recibido de … del 2026-11-06» |
| `/cierres-admin`, Bodega → Pendientes → detalle | Control: sin marcar | Región: **1**, con «Marcar recibido la consolidación de … del 2026-11-06» |
| `/wallet/satelites/[zonaId]`, con «Todas» | La saldada | Botones en la fila: `[]`. `role=note`: la nota de R3, literal |
| `/ayuda/oficina/wallet-satelites` | — | Título «Una vez marcada», con la sección de `design.md` §3 y el aviso «Ya entró a la caja: no se puede revertir.». Título viejo: 0 |

Sin respuestas 5xx. Una primera pasada se descartó por la sonda, no por la app: el nombre del botón casaba con dos zonas que solo difieren en mayúsculas, y la pestaña «Pendientes» lleva cifra. Las dos pasadas se limpiaron igual.

**Lo que no se vio en el navegador:** una recibida exacta con dinero no saldada, el botón «Desmarcar» y los dos avisos del diálogo. Exigen asientos de caja o llamar al servidor; los cubren los tests de la tabla R → test.

**La base quedó restaurada.**

- Con una consulta aparte al terminar: `cierre_bodega` en 0, igual que al empezar; `Session` y `login_attempt` en 1073 y 1154; `usuario.updated_at` de la cuenta en 2026-11-05.
- En el `finally` de la sonda: conteo de todas las tablas de `public`, antes y después de cada pasada, sin diferencias; `zona.sinpe_*` sin cambios; las sesiones e intentos del login propio, borrados por id.
- Lo que NO se comparó: el resto de columnas de filas ya existentes. Se comprobaron conteos, no contenido.

**Capturas**, fuera del repo, en el scratchpad de la sesión, carpeta `v506/capturas/`.

**Dev server.** Parado, sin nada escuchando en el 3506, y `.next/dev` borrado. `pnpm typecheck` volvió a dar exit 0 después.

## Sin ejecutar

- **`./init.sh --rapido` (T4.3):** lo corre el leader.
