# Ficha 498 — bitácora de implementación (backend, T0–T6)

Agente: backend_dev. Worktree `R:/w498`, rama `fix/498-satelite-dinero-al-conciliar`.
Búsqueda de código: MCP `codebase-memory` (proyecto `R-job-singularis-projects-ordenex`) para
localizar símbolos; confirmado cada uno en el archivo real del worktree.

## T0.1 — Base de la rama

- **SHA base:** `13fd57fc9564fab2873f95839149c92f029662a9` (`origin/dev` al crear la rama). Al medir,
  `origin/dev` estaba en `8c32dbf6`, que solo añade una línea a `progress/current.md` (arranque de la
  498); ninguna diferencia de código.
- **(a) La 497 está en la base:** sí. Su bloque de barridas está en `resolverCierre`
  (`CierresAdminRepository.ts:2442`, «FICHA 497 (T3.3 …) — LA MARCA DE LAS BARRIDAS») y la migración
  `20261102170000_cierre_sin_gestion_confirmacion_fisica` existe.
- **(b) Último prefijo de `db/migrations`:** `20261102170000` (la 497), que es ≥ `20261102160000`.
  Las cuatro fechas de design §3 se mueven por encima, manteniendo M1 < M2 < M3 < M4:
  - M1 `20261103120000_satelite_498_enums`
  - M2 `20261103120100_satelite_498_ajuste`
  - M3 `20261103120200_satelite_498_retirar_asientos`
  - M4 `20261103120300_satelite_498_regularizar`
- **(c) Números de línea de design §1 tras la 497** (solo cambia `CierresAdminRepository.ts`, +17 en el
  bloque de la aprobación):
  - `CAJA_COD_FEED`: `:170` → `:171`.
  - Constructor: `:940-962` → `:941-963`.
  - Captura de la indemnización: `:1859-1869` → `:1876-1886`.
  - Los cinco escritores: `:1871-1933` → `:1888-1950`.
  - `CierresBodegaAdminRepository.ts` (`:515`, `:518-568`, `:585-636`, `:654`, `:656-717`, tipo
    `:60-71`): sin cambios.

## T0.2 — Respuestas del humano (2026-11-02), copiadas de la cabecera de `requirements.md`

| Pregunta | Respuesta | Requisito |
| --- | --- | --- |
| SINPE / transferencia | «No importa a cuál cuenta sea, lo que pasa en la conciliación es que la central debe recibir en caso de que la tenga la satélite o debe confirmar el recibido si fue consignado directo a ellos». El recibido es el **total** que llegó a la central. | R16a, R16b |
| Q3 | Consolidación rechazada: límite conocido aceptado. No hay ninguna hoy. Sin ficha. | (fuera de alcance) |
| Q4 | Regularización por migración (M4, design §3.5): las conciliadas antes se dan por saldadas con la regla anterior, sin escribir en ningún libro y sin tocar `monto_recibido`. Deuda 0. | R54a–R54d, R41a |
| Q5 | Recibido 0 solo con aporte reconocido ≤ 0 (design §4.4 bis). | R15a, R15b, R16 |
| Q1, Q2 | Siguen abiertas; no se tocan. | — |

## T1 — Rojos contra el código de hoy (base `13fd57fc`, sin ningún cambio de `lib/`)

Comando: `pnpm exec vitest run tests/integration/db/498-aprobacion-satelite-sql-real.test.ts
tests/integration/db/498-conciliar-asienta-sql-real.test.ts tests/integration/db/498-deuda-satelite-sql-real.test.ts`
→ `Test Files 3 failed (3) · Tests 4 failed | 6 passed (10)`, **0 skipped** (base local alcanzable).

| Tarea | Caso | Resultado hoy | Salida |
| --- | --- | --- | --- |
| T1.1 | aprobar un cierre satélite → cero filas en los tres libros | **ROJO** | `expected [ …(13) ] to deeply equal []` (13 filas: devengo/pago del mensajero, egreso pago mensajero, COD, flete, comisión, IVA en caja y tienda) |
| T1.2 | aprobar un cierre central = foto | **VERDE** | 18 filas, literal `FOTO_CENTRAL` |
| T1.3 | antes de marcar, los cierres no tienen filas | **ROJO** | `expected [ …(26) ] to deeply equal []` |
| T1.3 | una fila `egreso_diferencia_satelite` de 500 | **ROJO** | `expected [] to deeply equal [ { tipo: 'egreso', …(7) } ]` |
| T1.3 | los cinco feeds no ponen `fechaMovimiento` (R13) | verde (ya es así hoy) | — |
| T1.4 | deuda de Saldos = fórmula R23 a mano | **ROJO** | `expected '6000.00' to be '8500.00'` (hoy: solo el efectivo de la consolidación) |

**Origen del literal `FOTO_CENTRAL` (T1.2).** Se tomó ejecutando el caso contra el código de `dev`
en `13fd57fc` (antes de tocar `lib/`): cierre central con entrega en efectivo 10 000, entrega SINPE
5 000, un rechazo y un incidente con indemnización 3 000; tarifa de la tienda 2 000/1 000, comisión
5 %, IVA 13 %; tarifa del mensajero de la central 1 500/164. Ese literal **es** el contrato de R3: no
se sustituye por su propia fuente.

**Límite de R13 en integración.** Los tests corren dentro de UNA transacción revertida, así que
`now()` es el mismo instante para la aprobación y para la marca: comparar `fecha_movimiento` contra
`conciliado_at` no distingue nada. R13 se fija mirando que ninguno de los cinco feeds (ni la fila de
diferencia) ponga `fechaMovimiento`: la fecha la pone el `DEFAULT now()` de la transacción que
escribe, que en producción es la de la marca.
