# 491 — Investigación: nombres de usuario y BSUID de WhatsApp (2026-11-02)

Fuente principal: doc oficial de Meta «Identificadores de usuario específico de la empresa»
(https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids),
actualizada el 23-oct-2026, marcada por Meta como «sujeta a cambios». Contraste secundario:
docs de YCloud (https://docs.ycloud.com/reference/bsuid) y el issue 13837 de Chatwoot.

## Hechos (de la doc oficial)

1. **BSUID** = `user_id`. Formato `<ISO2>.<dígitos>` (p. ej. `US.13491208655302741918`). Aparece en
   TODOS los webhooks de mensajes desde abril de 2026, tenga o no el usuario nombre de usuario.
   Es por **portfolio**: solo un número de empresa del mismo portfolio puede escribirle.
   El portfolio de José es distinto del de Nuform, así que los BSUID que hubiera visto Nuform no sirven.
2. **Entrante** (`messages[]` y `contacts[]`):
   - `wa_id` / `messages[].from`: siempre si el usuario NO tiene nombre de usuario. Si lo tiene,
     solo si se cumple una condición de «Números de teléfono» (abajo); si no, se OMITEN.
   - `user_id` / `messages[].from_user_id`: siempre.
   - `profile.username`: solo si el usuario tiene nombre de usuario.
   - `parent_user_id` / `from_parent_user_id`: solo si se habilitan los BSUID principales (no es nuestro caso).
3. **Cuándo llega el teléfono aunque tenga nombre de usuario** (cualquiera de las 3, evaluadas POR
   número de empresa):
   - le enviamos mensaje o llamada a su teléfono en los últimos 30 días;
   - recibimos mensaje o llamada de su teléfono en los últimos 30 días;
   - está en la «libreta de contactos» (la aloja Meta y no requiere integración; solo guarda
     interacciones posteriores a su lanzamiento).
4. **Envío por BSUID**: `POST /<PHONE_NUMBER_ID>/messages` acepta `recipient: "<BSUID>"` en lugar de `to`.
   Vale para todos los tipos, plantillas incluidas. Si van los dos, gana `to`. Meta recomienda
   enviar al teléfono cuando se tenga, para seguir recibiendo el teléfono en los webhooks.
5. **Estados** (`statuses[]`): llevan `recipient_user_id` y `contacts[].user_id` en sent, delivered y read.
   En `failed` se omite `contacts`, y `recipient_user_id` se omite si se envió al teléfono.
6. **Cambio de BSUID** (llega por el campo `messages`, `type: "system"`):
   - `user_changed_number`: el usuario cambió de teléfono; trae `previous_user_id` y el nuevo `user_id`.
   - `user_changed_user_id`: cambió el BSUID sin teléfono compartible.
   En ambos, `from` y `wa_id` pueden venir omitidos.
7. **Pedir el teléfono**: el botón `REQUEST_CONTACT_INFO` (plantillas utility/marketing o mensaje
   interactivo). Si el usuario lo toca, llega un webhook de contactos con su teléfono.

## Lo medido en Ordenex/Velox

- 2026-10-31 05:46 UTC: el texto de prueba de Carlos (+57 300 802 9714) llegó con `from_user_id`,
  `contacts[].user_id` y `profile.username`, y SIN `from`. El zod falló con `messages.0.from: invalid_type`,
  el handler respondió 200 y el mensaje se perdió. Encaja con el punto 3: ese número de empresa
  (nuevo, de José) nunca había interactuado con él.
- 2026-11-02: entran con normalidad 70 mensajes al día del número nuevo.

## Implicaciones para el spec (a validar contra el código, no supuestas)

- Casi todo cliente real recibe antes la bienvenida (`listo_para_entrega_mensajero`) en su teléfono.
  Por la condición de 30 días, su respuesta debería traer `from`. El caso que se pierde es el del
  usuario con nombre de usuario que escribe SIN contacto previo en 30 días con este número.
- ABIERTO: si un payload con varios mensajes y uno sin `from` hace fallar TODO el lote
  (por el zod del array). Medirlo en el código.
- ABIERTO: cómo asociar un entrante sin teléfono a un hilo o una orden (hoy se casa por teléfono).
  Opciones: guardar el `user_id` en el hilo cuando llegue con teléfono y casar por él después;
  si no hay casamiento, hilo «sin orden»/descartar con log visible; pedir el teléfono con `REQUEST_CONTACT_INFO`.
- ABIERTO: responder por `recipient` cuando el hilo no tiene teléfono.
- Los webhooks `system` (`user_changed_number` / `user_changed_user_id`) hoy probablemente se descartan.
  Decidir si actualizan el BSUID guardado.
