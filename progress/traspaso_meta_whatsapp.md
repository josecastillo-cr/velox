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
