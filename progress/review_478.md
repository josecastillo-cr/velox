# 478 — Detalle por guía y evidencias en el cierre de bodega · review

> Reviewer, 2026-10-15. Rama `feature/478-detalle-guia-evidencias-cierre-bodega` (PR #858),
> worktree `wt-478`, HEAD revisado `5601be04`. Base `origin/dev` @ `e595cbdd` (merge-base).
> Búsqueda de código: lectura directa del diff y de los archivos (no se usó el MCP
> `codebase-memory`: el diff es pequeño y acotado a 2 archivos de `app/` + tests).

## Veredicto: **OK**

Sin bloqueantes. Seis menores, ninguno impide el merge.

## Checklist

### Especificación
- [x] `requirements.md` con R1-R19 en EARS.
- [x] `design.md` con 4 alternativas descartadas y su porqué (§5).
- [x] `tasks.md`: T0.1, T0.2, T1, T2.1, T2.2, T3, T4, T5, T6 todas `[x]`.

### Trazabilidad (R -> test que muerde)
Mutaciones hechas por el reviewer en el worktree, con autocomprobación (una sola coincidencia del
texto a mutar, `git diff --stat` no vacío tras aplicar, línea `Tests` del run) y revertidas con
`git checkout`. Todas pusieron rojo el test esperado. `git status` limpio al terminar.

| R | Test | Mutación (aplicada y revertida) | Resultado |
| --- | --- | --- | --- |
| R1 | `CierreBodegaDetalleGestiones` «R1» | `count={0}` en `TabResultado` | rojo R1 (+R2, R4) |
| R2 | «R2» | pestaña inicial fija `"entregado"` | rojo R2 |
| R3 | «R3» | `RESULTADO_VACIO[tab]` -> `""` | rojo R3 |
| R4 | «R4» | indirecta (`count={0}` lo pone rojo); el estado por instancia es por construcción | rojo R4 |
| R5 | «R5» | `esMensajero` en el montaje de bodega | rojo R5 |
| R6 | «R6» x2 | idem | rojo R6 |
| R7 | «R7» | idem | rojo R7 |
| R8 | «R8» | sin mutación propia; los literales de R6/R9 incluyen los dos bloques | — |
| R9 | «R9» (literales, no contra la fuente) | idem `esMensajero` | rojo R9 |
| R10 | «R10» x5 resultados | quitar `onVerEvidencia` en bodega | rojo los 5 R10 + R12 |
| R11 | «R11» | negativo; sin `evidenciaUrl` la fila no pinta botón por construcción | — |
| R12 | «R12» | `onVerEvidencia` que abre otra URL | rojo R12 |
| R13 | `cierres-bodega-admin-service` «478/R13» | firmar solo rechazo/incidente en `verCierreBodegaDetalle` | rojo 478/R13 (+R12 previo) |
| R14 | «R14» | pasar `onCorregirPagos` / `onCorregirResultado` en bodega (2 mutaciones) | rojo R14 en ambas |
| R15 | «R15» | negativo de no-regresión: el bloque no tiene acción de decisión que retirar | — |
| R16 | «478/R16» + «R2» existente | mover `esAccesoTotal` detrás de `findCierreBodegaConDetalle` | rojo 478/R16, R2, R24 |
| R17 | «cada bloque tiene una región…» | quitar `contexto` (20 rojos); quitar el mensajero solo del panel interno | rojo en ambas |
| R18 | `CierresAdminModule`, `CierreDiaModule`, `CierreFacturaSinGestionar`, `CierreRechazosDeTienda`, `CierreDetalleIncidente`, `cierre-detalle-superficies.guardia` | — | **sin editar** (confirmado en el diff) y verdes en el gate |
| R19 | `CierreFacturaFilaIncidente` (4 casos) | quitar indemnización; fulfillment también al mensajero; causa fuera de incidente (3 mutaciones) | rojo en las 3 |

### Guardia editada (`tests/unit/guards/impresion-flujo.guardia.test.ts`)
- [x] Solo cambia el ANCLA (`aria-label={FACTURA_ORDENES_TITULO}` -> `{nombreOrdenes}`,
  `{RESULTADO_LABEL[tab]}` -> `{nombrePanelActivo}`); el criterio (sin `break-inside-avoid`) y el
  archivo leído (`cierre-factura.tsx`, donde vive ahora `GestionesPorResultado`) no cambian.
- [x] Mutaciones: `break-inside-avoid` en la sección de órdenes -> rojo el R20 de esa sección (+ la
  lista cerrada); en el panel activo -> rojo el R20 del panel (+ lista cerrada); renombrar la
  variable del ancla -> rojo por «no se localizo» (`length > 10`), no un verde vacío.
  **Sigue midiendo lo mismo.**

### Desviación de design §2.1 (región interna «<resultado> · <mensajero>»)
- [x] **Aceptable.** La impone la guardia existente 396·D3 (`CierreBodegaDesglosePorTienda`,
  «ninguna región del detalle se anuncia igual que otra»), que NO se editó. Sin `contexto` el
  nombre es el de siempre (`RESULTADO_LABEL[tab]`), así que el comprobante de mensajero y sus
  tests quedan intactos (R18). Va en la línea de R17. Anotada en `progress/impl_478.md`;
  `design.md` no se actualizó (m1).

### Alcance de aprobación y corrección
- [x] `git diff origin/dev...HEAD -- lib db` vacío: ni `CierresAdminService`, ni su alcance, ni
  ninguna acción de decisión cambian. Admin/maestro NO ganan aprobar/rechazar cierres de mensajero
  de satélite.
- [x] `GestionesPorResultado` se monta en bodega sin `onCorregirPagos`/`onCorregirResultado`; la
  fila decide los botones por presencia del callback. R14 (mutación) y T6 (0 botones con maestro
  y con admin) lo confirman. No se filtran botones de corrección.
- [x] `CierreFacturaDetalle` sigue pasando los mismos callbacks que antes (extracción pura).

### Checkpoints (`CHECKPOINTS.md`)
- [x] Specs (3 archivos, tasks `[x]`).
- [x] Trazabilidad: mapa R->test en `progress/impl_478.md`.
- [x] typecheck, lint, tests: verdes en el gate del reviewer (abajo).
- [n/a] E2E: no es flujo crítico (presentación de solo lectura); no hay harness E2E. El riesgo
  de pantalla lo cubre el recorrido Playwright T6 con capturas en `progress/478_t6/`.
- [n/a] RLS / migraciones / down.sql / webhooks: no hay tablas, migraciones ni webhooks nuevos.
- [x] Sin secretos: `DATABASE_URL` exportada en memoria; 0 apariciones de cadenas de conexión en
  el log; sin `.env` en el worktree.
- [x] Capas: cambio solo en componentes de `app/`; servicio y repo intactos.
- [x] Permisos: R16 de no-regresión, verificado por mutación.
- [x] Sin hardcode de país/moneda: `money()` y constantes existentes.
- [n/a] `./init.sh` completo: solo antes de release a `prod` (regla 5).
- [x] `progress/review_478.md` con veredicto OK (este archivo).
- [ ] Entrada en `progress/history.md`: no está en la rama (cierre del leader; m6).

### Verificación ejecutable (del reviewer)
- Baseline de los 5 archivos tocados/rozados: 161/161 verdes.
- `./init.sh --rapido` -> `progress/gate_review_478.log`, **INIT_EXIT=0**. Unit 274 archivos /
  3.764 tests; `integration/db` ampliado 446 archivos / 4.166 tests, **0 skipped**. Un rojo en
  paralelo, `tests/integration/db/busqueda-comportamiento.test.ts` (teléfono con guion), verde
  aislado (38/38): intermitente ajeno (búsqueda; nada de este diff lo toca).

## Hallazgos

- **m1 · menor** — `design.md §2.1` sigue diciendo que la región interna conserva
  `RESULTADO_LABEL[tab]` en la bodega. La desviación es correcta y está en `impl_478.md`, pero el
  design debería decir lo que hay (una línea).
- **m2 · menor** — Fulfillment pasa a verse en el comprobante de cierre de mensajero de la
  `adminSatelite` (hallazgo 1 de T6). P2 aprobado dice «también en el detalle de mensajero» y la
  satélite ya ve «Total Ordenex» y «Cobros de esta gestión», así que no abre un dato de otra
  naturaleza; aun así es nuevo para ese rol. Confirmarlo con el humano; si no lo quiere, la
  condición es `audiencia`, no la fila.
- **m3 · menor** — R6 enumera «Sin tarifa» y «motivo»; el test de bodega no los afirma (sí
  dirección, ubicación, recibido, tienda, flete, comisión, pago, nueva fecha, flete por
  devolución). La fila es la misma del comprobante: riesgo bajo.
- **m4 · menor** — T0.2 en producción no se midió (sin MCP `supabase` en el agente). No afecta a
  ningún R: era contexto para el recorrido, hecho con datos locales sembrados y borrados.
- **m5 · menor** — P4 dice «se registra una ficha de limpieza aparte» para `DetalleSecciones`; no
  existe en `feature_list.json`. Es del leader (los agentes no escriben `feature_list.json`).
- **m6 · menor** — Falta la entrada de `progress/history.md` (cierre del leader).

## Lo que vuelve al implementer
Nada bloqueante. m1 y m3 son opcionales en la misma rama (con `--rapido`). m2, m5 y m6 son del
leader / humano.
