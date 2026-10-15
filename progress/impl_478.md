# 478 — Detalle por guía y evidencias en el cierre de bodega · implementación

> Rama `feature/478-detalle-guia-evidencias-cierre-bodega`, desde `origin/dev` @ `6bdb9435`.
> Decisiones aprobadas: P1 solo lectura · P2 causa/indemnización/fulfillment en la fila · P3 sin
> descarga por sección en el modal · P4 `DetalleSecciones` NO se borra.
> Búsqueda de código: el MCP `codebase-memory` no estaba en el conjunto de herramientas de este
> agente; se leyó cada archivo citado por `design.md` directamente (grep/lectura) y se confirmó.

## Qué cambió

| Archivo | Cambio |
| --- | --- |
| `app/(app)/cierres-admin/_components/cierre-factura.tsx` | T2.1: `GestionesPorResultado` (exportado) extraído de `CierreFacturaDetalle`, con el estado de pestaña por instancia y la prop `contexto`. T2.2: tres `DatoFila` nuevos en `FilaGestion` (causa, indemnización o pendiente, fulfillment) + helper `indemnizacionDeFila`. |
| `app/(app)/cierres-admin/_components/CierresBodegaAdminModule.tsx` | T3: `GestionesPorResultado` en lugar de `DetalleSecciones`, con `onVerEvidencia={setEvidencia}` y `contexto={mensajeroNombre}`, sin callbacks de corrección. |
| `tests/unit/services/cierres-bodega-admin-service.test.ts` | T1: R13 (cinco resultados firmados) y R16 (sin acceso total: ni lectura ni firma). |
| `tests/components/CierreBodegaDetalleGestiones.test.tsx` (nuevo) | T4: R1-R12, R14, R15, R17. |
| `tests/components/CierreFacturaFilaIncidente.test.tsx` (nuevo) | T2.2: R19. |
| `tests/fixtures/gestion-detalle-478.ts` (nuevo) | Dobles del DTO con céntimos. |

### Desviación del design, anotada

`design.md §2.1` decía que la región interna conservaba `aria-label={RESULTADO_LABEL[tab]}` también
en la bodega. Con dos mensajeros eso deja dos regiones «Entregado» en el mismo modal, y lo caza la
guardia existente `CierreBodegaDesglosePorTienda.test.tsx` («396 · D3 — ninguna región del detalle
se anuncia igual que otra»), que se puso roja. Arreglo sin editar esa aserción: CON `contexto` la
región interna se llama `«<resultado> · <mensajero>»`; SIN `contexto` (comprobante de mensajero)
sigue siendo `RESULTADO_LABEL[tab]` (R18 intacto: ningún test del comprobante se editó).

## Mutaciones comprobadas (y revertidas)

- Filtrar `paths` a rechazos/incidentes en `CierresBodegaAdminService.verCierreBodegaDetalle` → rojo R13.
- Pasar `onCorregirPagos`/`onCorregirResultado` en T3 → rojo R14.
- Quitar `onVerEvidencia` en T3 → rojo R10 (los cinco resultados) y R12.
- Quitar la causa de la fila → rojo R19 (2 casos).

## Mapa R → test

| R | Test | Estado |
| --- | --- | --- |
| R1 | `tests/components/CierreBodegaDetalleGestiones.test.tsx` — «R1: pinta las cinco pestañas con su conteo…» | verde |
| R2 | idem — «R2: abre en la primera pestaña con gestiones» | verde |
| R3 | idem — «R3: una pestaña vacía muestra el texto de sección vacía del resultado» | verde |
| R4 | idem — «R4: cambiar de pestaña en un mensajero no cambia la del otro» | verde |
| R5 | idem — «R5: la fila compacta enseña guía, destinatario, remisión·producto, cobrado e ingreso total» | verde |
| R6 | idem — «R6: al desplegar una entregada…» y «R6: … reprogramada enseña la nueva fecha» | verde |
| R7 | idem — «R7: al desplegar una devolución por rechazo…» | verde |
| R8 | idem — «R8: … Desglose de ingreso y Cobros de esta gestión» | verde |
| R9 | idem — «R9: la misma gestión, desplegada en el detalle de bodega y en el comprobante de mensajero, enseña el mismo texto» (literales) | verde |
| R10 | idem — «R10: ofrece Ver evidencia en una gestión «X» con evidencia» (×5 resultados) | verde |
| R11 | idem — «R11: sin evidencia no hay botón Ver evidencia» | verde |
| R12 | idem — «R12: Ver evidencia abre el visor con la URL firmada de esa gestión» | verde |
| R13 | `tests/unit/services/cierres-bodega-admin-service.test.ts` — «478/R13: firma la evidencia de una ENTREGADA, una REPROGRAMADA y una NOVEDAD…» | verde |
| R14 | `CierreBodegaDetalleGestiones.test.tsx` — «R14: sin Corregir métodos de pago ni Corregir el resultado…» | verde |
| R15 | idem — «R15: ningún bloque de mensajero ofrece Aprobar ni Rechazar» | verde |
| R16 | `cierres-bodega-admin-service.test.ts` — «478/R16: sin acceso total, verCierreBodegaDetalle no lee el cierre NI firma ninguna evidencia» (+ el existente «R2: rol sin acceso total…») | verde |
| R17 | `CierreBodegaDetalleGestiones.test.tsx` — «cada bloque tiene una región de gestiones con el nombre de su mensajero, y no se repite» | verde |
| R18 | `CierresAdminModule.test.tsx`, `CierreDiaModule.test.tsx`, `CierreFacturaSinGestionar.test.tsx`, `CierreRechazosDeTienda.test.tsx`, `CierreDetalleIncidente.test.tsx`, `cierre-detalle-superficies.guardia.test.ts` — sin editar | verde |
| R19 | `tests/components/CierreFacturaFilaIncidente.test.tsx` (4 casos) | verde |
