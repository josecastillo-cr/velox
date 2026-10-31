# Traspaso de WhatsApp/Meta a José (opción B: NÚMERO NUEVO)

Fecha: 2026-10-30. Según la doc de Meta `account-model-evolution` (modelo nuevo desde
2026-09-23), un número NO se puede migrar a otro portafolio. Carlos eligió primero la opción A
(Nuform borra el número y José lo da de alta) y luego cambió a la B: José da de alta un número
NUEVO. El número de Nuform (1109739142232496) sigue en servicio hasta el cambio y se borra al
final.

## Estado

- [x] Dominio `velox-courier.company` verificado en el portafolio de José (TXT en el DNS de Vercel).
- [x] App `Velox` creada en developers.facebook.com.
- [x] 0.5 Inventario de plantillas (abajo).
- [x] 0.7 Token del webhook generado (fuera del repo, en el scratchpad de la sesión).
- [ ] 0.1-0.4 José: asistente cerrado sin número, usuario del sistema, clave secreta, 2.º admin.
- [ ] 0.6 Páginas `/privacidad` y `/eliminacion-datos`: faltan datos legales.
- [ ] 0.8 Hora del corte, número completo con código de país, titular de la SIM.

## IDs de José (2026-10-30)

- Cuenta de mensajes (`WHATSAPP_WABA_ID`): `2115650402656273` ("Velox Courier", USD, APPROVED).
- Número (`WHATSAPP_NUMERO_ID`): `1303474992859833` = +506 7264 7191, VERIFIED, CLOUD_API, TIER_250.
- App `Velox` id `2237577197641142`. Token de usuario del sistema válido y sin caducidad (en el scratchpad, fuera del repo).
- 2.1 Registro del número: `success: true`. El PIN está en el scratchpad (Meta ya no lo usa).
- 2.3 La copia de plantillas desde Nuform falla: "Caller is not authorized to access the source WABA".
  Se crearon con los mismos componentes que arma la app (cuerpos verificados por md5 contra prod):
  `listo_para_entrega_mensajero` 28252813871058704, `alerta_transito_ordenex` 1598724291390711,
  `picking_bodega_ordenex` 1152229794427597. Todas en PENDING al crearlas.

- Verificación del negocio enviada a Meta (con la certificación del Registro Nacional); se espera la respuesta. Configuración básica de la app hecha en parte.
- El redeploy del corte (4.2) incluye también `RECUPERACION_CONTRASENA_ACTIVA=true` (encendido de la 489) y la `ANTHROPIC_API_KEY` de José (decisión de Carlos, 2026-10-30).
- 2026-10-31, ~04:40 UTC, PREPARACIÓN DEL CORTE HECHA (sin corte): el `WHATSAPP_WEBHOOK_VERIFY_TOKEN` nuevo y `RECUPERACION_CONTRASENA_ACTIVA=true` (489 encendida) están en prod, con redeploy `dpl_Cs614XTZoiCh76joTyUDDzte1Men` READY. El webhook de la app Velox apunta a velox-courier.company y la verificación respondió 200. `messages` suscrito, `subscribed_apps` hecho y la app PUBLICADA (Live). La app sigue enviando por el número de Nuform.
- FALTA para el corte: plantillas APPROVED (siguen PENDING); luego José cambia las 4 `WHATSAPP_*` restantes (CLOUD_TOKEN, NUMERO_ID, WABA_ID, APP_SECRET) en Production y Preview, y la `ANTHROPIC_API_KEY` si ya la tiene. Después: redeploy y pruebas al +57 300 802 9714.
- CORTE HECHO el 2026-10-31 ~05:43 UTC (Carlos: «ya no están usando la app»). José puso las 4 `WHATSAPP_*` en Production y Preview, y también la `ANTHROPIC_API_KEY`. Redeploy `dpl_EPxz3tzH6aWjXDUNtRwmKxCDf3JQ` READY. Pruebas:
  - Entrada: el texto de +57 300 802 9714 llegó al webhook con firma válida, pero se descartó porque viene con `from_user_id` y sin `from` (ese usuario tiene nombre de usuario de WhatsApp) → ficha 491.
  - Salida: texto libre por la API al +57 302 420 6707, que confirmó haberlo recibido.
  - Pendiente: ver entrar al chat el mensaje de un cliente real con orden activa, y las plantillas siguen PENDING.
## Pendiente para la próxima sesión (cierre del 2026-10-31 ~06:10 UTC)

1. Plantillas: consultar `GET /2115650402656273/message_templates`. Cuando estén APPROVED, EDITAR el cuerpo, cambiando "Ordenex" por "Velox Courier" (mismas variables y mismo orden; los nombres se quedan), y actualizar `plantilla_mensaje.cuerpo` en prod. Decisión de Carlos del 2026-10-31. Si alguna sale REJECTED, ver el motivo.
2. Envíos automáticos con plantilla fallidos durante la espera: medirlos en la base y reenviarlos si hace falta.
3. Primer entrante real de un cliente con orden activa: confirmar que entra en `chat_mensaje`.
4. Respuesta de Meta a la verificación del negocio.
5. Integradores de la API: darles `https://velox-courier.company` (Nuform es uno).
6. Nuform, en unos días: quitar su webhook, revocar sus tokens y borrar el número viejo `1109739142232496`; revocar su clave de Anthropic; cerrar el GCP `rapidisimo-app-496106`; quitar sus tarjetas; comprobar que no es miembro del team Velox de Vercel. Después, quitar `ordenex.vercel.app` del proyecto.
7. Cambio de marca Ordenex → Velox Courier en la app (landing, `apple-mobile-web-app-title`, `SMTP_FROM_NAME`, push `soporte@ordenex.co`, guía de integración).
8. Ficha 491 (entrantes con nombre de usuario), unos 450 jobs de geocodificación fallidos, ficha para el envío por el ID de la cuenta de WhatsApp de Meta, actualizar el spec de la 490, y el teléfono y la cédula de relleno del maestro de José.
- El SMTP de Preview se borra (decisión de Carlos); no se migra.
- OJO: el token de José (`meta_token.txt`) y el del webhook estaban en el scratchpad de ESTA sesión, que no se hereda. Para la API de Meta, Carlos tiene que volver a dejar el token en el scratchpad de la sesión nueva.
- 6.1 Aviso a clientes: NO se hace (decisión de Carlos, 2026-10-30). El número viejo no está publicado en ningún sitio.

## 0.5 Inventario de plantillas (prod, `plantilla_mensaje` vigentes, leído el 2026-10-30)

Las 3 son `activo`, idioma `es`, y están en Meta en la cuenta de Nuform `1007158822023912`.
La app envía por `nombre` + `template_idioma`; `template_id` es solo traza y la sincronización lo
reescribe. Hay que crearlas en la cuenta de mensajes de José con el MISMO nombre e idioma.

| nombre | uso | cabecera | template_id (Nuform) | variables |
|---|---|---|---|---|
| `listo_para_entrega_mensajero` | bienvenida al recoger (`welcome_message`) | ninguna | 1059818823188946 | cliente, mensajero, sinpe, sinpe_nombre, guia, producto, total |
| `alerta_transito_ordenex` | informe `transito` | DOCUMENT (PDF) | 2673685363091895 | destinatario_nombre, fecha, total_en_alerta, vencidos, por_vencer, parados, en_alerta_gam, en_alerta_fuera_gam, por_cobrar |
| `picking_bodega_ordenex` | informe `picking` | DOCUMENT (PDF) | 1104833645371748 | destinatario_nombre, tienda, fecha, hora, ordenes, unidades, productos, remision_desde, remision_hasta, atrasadas, dias_atraso |

Los cuerpos completos están en `plantilla_mensaje.cuerpo` (prod). Los tres mencionan "Ordenex"
en el texto y dos lo llevan en el nombre: cambiar la marca obliga a otra aprobación de Meta.

Si la API de migración de plantillas no funciona entre portafolios, se crean de nuevo con el
payload que arma `lib/clients/whatsapp-cloud.ts` (CRUD contra `/{wabaId}/message_templates`).
