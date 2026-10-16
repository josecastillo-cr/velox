# Corrección manual de resultado de gestión — 2026-10-14 (producción)

Pedido de Carlos. El mensajero Henry Mauricio (`4590a971-…`) registró mal dos gestiones. No hay vía en la app:
el rechazo de un cierre solo permite re-solicitarlo tal cual (deshacer exige `cierre_id IS NULL`), y la
corrección de admin (398) solo hace `entregada -> rechazada`. Se corrigió por SQL vía MCP `supabase`
(ref scfnwxqbsgkzwsdntdvd), en UNA transacción con guardas (resultado previo, cierre `solicitado`, 1 fila c/u).

## Aplicada — guía 57708849 (Tania, Gameos)
- `gestion_orden` 9e6c3a31-…: `incidente` (causa `danado`) -> `reprogramado`, `causa_incidente` NULL,
  `fecha_reprogramacion` 2026-10-15. Motivo del mensajero conservado («Recibe el jueves…»).
- `orden_evento` a14aa94a-… (`gestion_registrada`): `resultado` -> `reprogramado`, `motivo` NULL,
  `familia_aplicacion` -> `gestion` (igual que un reprogramado nativo).
- Cierre 64b0ef6f-… sigue `solicitado`; sin dinero en juego (incidente y reprogramado pagan 0;
  `cierre_detail` es solo snapshot de tarifas). La transición de la orden la hace la aprobación.
- Se conserva la foto de evidencia (nombre `incidente-…jpg`) como rastro.
- ⚠️ Con esta gestión la orden llega a 3 intentos al aprobarse el cierre: al liberarse el 15/10 la
  asignación satélite la bloqueará por tope (`AsignacionSateliteService.ts:241`).

## NO aplicada — guía 90286248 (Darwin, Nuform)
Ya tenía 3 intentos (novedad 06/10, novedad 07/10, rechazo 13/10, cierre 94fd7df3-… aprobado y consolidado):
reprogramarla la dejaría atascada en bodega por el mismo tope. Decisión de Carlos: se queda como devolución.

## Deuda detectada
- No existe forma de que el mensajero (o la bodega) corrija gestiones de un cierre rechazado. Candidata a ficha.
