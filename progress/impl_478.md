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

## T0 — Medición previa

- **T0.2 (local, solo lectura):** la base local tenía **0** `cierre_dia` con `cierre_bodega_id IS NOT
  NULL`, así que no había conteos de evidencia que dar por resultado (Q1). **Producción NO se midió:** el
  MCP `supabase` no estaba entre las herramientas de este agente. Sí había `cierre_dia` con gestiones
  y evidencia en los cinco resultados (`entregado` 31/19 con evidencia, `reprogramado` 16/9, `novedad`
  10/9, `devolucion_a_origen_por_rechazo` 13/11, `incidente` 3/2).
  Datos para T6 (respuesta a Q1): un `cierre_bodega` `solicitado` de la zona QUEPOS con dos
  `cierre_dia` existentes colgados (`7fb47e8d…` de Rita Recorrido, los cinco resultados, y `50ffdfa2…`
  de Quino QUEPOS) y tres usuarios `t478.{maestro,admin,sat}@ordenex.test`. Todo **borrado al
  terminar** (`cierre_bodega` 0, usuarios 0 y sus filas de `login_attempt`/`trusted_device`,
  `cierre_bodega_id` de nuevo en NULL y `updated_at` restaurado). `prisma migrate status`: local,
  `localhost:5432`, al día.
- **T0.1 (antes, maestro):** con los dos archivos de UI de `6bdb9435` puestos temporalmente.
  `progress/478_t6/antes_maestro_bloque_rita.png`: el bloque de Rita pinta las cinco `DataTable` anchas.
  **5 botones «Ver evidencia» y todos de Devolución por rechazo (4) e Incidente (1); Entregadas: 0.**
  5 botones «Descargar …» por sección.

## T6 — Verlo en la app (después)

Un dev server propio (puerto 3478, entorno del `.env` raíz cargado en memoria), apagado al terminar.
Capturas y datos en `progress/478_t6/` (`despues_<rol>_*.png`, `*_datos.json`).

| Comprobación | maestro | admin |
| --- | --- | --- |
| (1) Pestañas con conteo, Rita | Entregado 5 · Reprogramado 2 · Novedad 2 · Devolución 4 · Incidente 1 | igual |
| (1) Pestañas con conteo, Quino | Entregado 1 · 0 · 0 · Devolución 1 · 0 | igual |
| (2) Entregada desplegada | dirección, «GAM · San José · Escazú · San Rafael», «Recibido: ₡7.500 · Efectivo», Tienda, Flete + IVA ₡2.260, Comisión + IVA ₡296,63, Pago al mensajero ₡1.700, Fulfillment ₡800, «Desglose de ingreso», «Cobros de esta gestión» | igual |
| (3) Ver evidencia, entregada | la imagen carga: 200 `image/jpeg`, URL firmada de Supabase | igual |
| (2)-(3) Devolución por rechazo | Ingreso de bodega ₡1.000, marca «Manual», evidencia 200 `image/jpeg` | igual |
| «Ver evidencia» por pestaña (Rita) | Entregado 5/5 · Reprogramado 0/2 (no tienen evidencia en la base) · Novedad 2/2 · Devolución 4/4 · Incidente 1/1 | igual |
| (4) Corregir / Aprobar / Rechazar en los bloques | 0 y 0 | 0 y 0 |
| (5) Pestaña de Rita → Devolución; la de Quino | sigue «Entregado» | igual |
| Descargas por sección en el modal (P3) | 0 (antes eran 5) | 0 |
| Incidente desplegado (R19) | «Causa: Paquete dañado», «Indemnización: ₡3.000», Fulfillment ₡800 | igual |
| R18: detalle de mensajero central | mismas pestañas (7/3/3/2/1), mismos 9 botones Ver evidencia/Corregir que en el «antes»; lo único nuevo es «Fulfillment: ₡800» (R19) | igual |
| Errores de página | ninguno | ninguno |

`adminSatelite` (`t478.sat`, QUEPOS): 0 botones «Ver / decidir el cierre de bodega» (no llega a
`verCierreBodegaDetalle`, R16). Su detalle de cierre de mensajero (Quino, resuelto) se ve con las
mismas pestañas, la fila desplegable y «Ver evidencia»; sin botones de corregir (como antes).

### Hallazgos de T6 (para la revisión, sin cambio de código)

1. **Fulfillment ahora también en la vista de la `adminSatelite`.** R19 lo pinta en toda vista que no
   sea la del mensajero, y el detalle de cierre de mensajero de la satélite usa la vista de admin. Ese
   detalle ya le enseñaba «Total Ordenex» y el «Desglose de ingreso», así que no le abre un dato de
   otra naturaleza, pero es nuevo para ese rol. Si no se quiere, la condición es `audiencia`, no la fila.
2. **Fulfillment aparece también en filas de devolución e incidente** (₡800 en los dos), porque es un
   dato de la tarifa congelada y no del resultado. Es lo mismo que hacía la tabla vieja (su columna
   Fulfillment estaba en las cinco secciones), así que la información es la misma de antes.
3. Las imágenes de evidencia de la base local miden 64 px de ancho (son de prueba); el visor las abre
   y la petición responde 200 `image/jpeg`.
4. Al entrar, maestro y admin ven el aviso «Confirmá el SINPE de GAM» (ajeno a esta ficha); el
   recorrido lo cierra con Escape.
5. El log del dev server no se commitea: podía llevar líneas sensibles y se borró.

## T5 — Gate

`progress/gate_478.log`: `./init.sh --rapido`, **INIT_EXIT=0**, con `tests/integration/db` en modo
ampliado (274 archivos, 3.764 tests, 0 saltados). Un intermitente de la base compartida:
`tests/integration/db/traspaso-mensajero.int.test.ts` (rojo en paralelo, verde aislado). El primer
gate (`progress/gate_478_a.log`, INIT_EXIT=1) se puso rojo por `impresion-flujo.guardia.test.ts`
(ancla de texto), arreglado en `582015cf`.

### Gate final, después de mergear `origin/dev` (480, PR #856)

Merge limpio (`9d31f43f`, sin conflictos: la 480 tocó `motivoRechazoVisible` y sus usos; la 478, la
lista de gestiones). Gate con `DATABASE_URL` exportada desde el `.env` raíz sin copiarlo
(autorización del humano vía coordinador); la copia de `.env` que se hizo antes en el worktree se
borró. `progress/gate_478.log`: **INIT_EXIT=0**, `integration/db` ampliado (446 archivos). Tres
intermitentes de la base compartida, rojos en paralelo y verdes aislados:
`cierre-bloqueo-nv-sql-real`, `liquidacion-reparto-migration`, `ranking-snapshot-migration`. 9
`skipped` en `liquidacion-reparto-migration.test.ts`, ajenos a la 478.
