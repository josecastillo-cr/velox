# 494 — Marca en identificadores internos: implementación

## T0.1 — Respuestas

P1-P5: valores por defecto, aceptados por el humano el 2026-11-04.

## T0.2 / T6.0 — Medición en producción (design §4), 2026-11-04

Corrida por el leader con el MCP `supabase`, confirmado con `get_project_url` que no es preview. Solo lectura. El detalle identificable no se versiona: el repo es público.

- **Q1 (catálogo):** 0 filas. Se sostiene la premisa de R13.
- **Q2 (filas):** `filas_con_valor` = 0 en todas las columnas. **Sin migración; R10 no aplica.**
  `filas_con_marca` > 0, todo dato que no se toca:

  | Tabla.columna | Filas con la marca |
  | --- | --- |
  | `chat_mensaje.cuerpo` | 12.943 |
  | `chat_mensaje.contactos_json` | 3 |
  | `login_attempt.email_usado` | 491 |
  | `historial_accion.actor_nombre` | 220 |
  | `whatsapp_envio_ejecucion.plantilla_nombre` | 89 |
  | `wallet_movimiento.descripcion` | 13 |
  | `wallet_anotacion.contraparte_nombre` | 9 |
  | `whatsapp_envio_entrega.destinatario_nombre` | 9 |
  | `liquidacion_pago.nota` | 3 |
  | `plantilla_mensaje.nombre` | 3 |
  | `usuario.email` | 3 |
  | `cobro_tienda_anulacion.motivo` | 2 |
  | `plantilla_mensaje.cuerpo` | 2 |
  | `webhook_suscripcion.url` | 1 |

  La URL del webhook apunta a un host de terceros: es de quien la registró, no se toca.
- **Q3 (plantillas):**
  - Activas: `alerta_transito_ordenex` (informe `transito`) y `picking_bodega_ordenex` (informe `picking`), ambas con documento y sin la marca en el cuerpo.
  - Borradas: `ordenex_en_camino` (2026-08-28) y «Plantilla APP vieja» (2026-09-01), con la marca en el cuerpo.
  - `prueba_envios_ordenex` no aparece.
- **Q4 (dependencias):**
  - 5 envíos encendidos: 1 de tránsito y 4 de picking, uno por tienda.
  - Ejecuciones, todas `completada`: 24 de tránsito (última 2026-11-04 11:00) y 65 de picking (última 2026-11-04 12:01).
  - **Las plantillas están en uso diario:** el cambio de `plantilla_mensaje.nombre` no puede dejar una ventana sin plantilla aprobada.
- **Q5 (cuentas):** 3 activas, 1 `@ordenex.co` (cuenta de pruebas de mensajero) y 2 de Gmail con «ordenex» en la dirección. Son credenciales de acceso: no se tocan (R30). Ninguna `@ordenex.test`.
