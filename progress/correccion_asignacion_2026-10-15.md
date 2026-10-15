# Asignación manual en tope de intentos — 2026-10-15 (producción)

Pedido de Carlos. La orden 57708849 (`af2e2b64-c0e2-4f19-8c10-935d36d2e943`, zona FGAM Limon Abajo,
`en_bodega_satelite`) tenía 3 intentos vigentes (novedad 06-oct, reprogramado 12-oct y 14-oct, todos en
cierres aprobados) = tope `REINTENTOS_MIN_INTENTOS`, así que `AsignacionSateliteService` la bloqueaba.

Los intentos son derivados (`whereIntentosVigentes`), no una columna: ponerlos en 0 exigiría anular gestiones
de cierres aprobados, que ~30 lecturas excluyen (cierres, ranking, analítica, dinero). Descartado.

Hecho por SQL vía MCP `supabase` (ref scfnwxqbsgkzwsdntdvd), una sentencia con guardas, espejo de
`OrdenRepository.asignarSateliteLote`: mensajero Henry Mauricio Hernandez Obando
(`4590a971-7150-4bd8-b74c-7adc595affa3`, activo, misma zona), `asignado_at=now()`, `fecha_reparto=2026-10-15`
(CR), estado `mensajero_recogiendo_en_bodega`, `prioridad=false`; fila de historial `asignacion_satelite`
con actor NULL y motivo explicativo. Tienda sin webhook activo: no se encola nada. Resultado: 1 orden, 1 historial.

Sigue con 3 intentos: solo admite entregada, devolución a origen por rechazo o incidente.
Pendiente decidir: ficha «reiniciar intentos» (admin/maestro, con rastro) para no repetir esto por SQL.
