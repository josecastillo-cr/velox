# 491 — WhatsApp: mensajes entrantes de clientes con nombre de usuario · requirements

> Ficha: `feature_list.json` id 491 (zona `backend`, `sdd: true`). **Ojo, leader:** la ficha apunta
> `spec_path: specs/491-whatsapp-usuario-sin-telefono` y este spec vive en
> `specs/491-whatsapp-entrantes-username/` (ruta que pidió el leader). Hay que alinear la ficha.
>
> Fuente sobre Meta: `progress/research_491_bsuid.md` (doc oficial de BSUID, 23-oct-2026). No se
> añade aquí comportamiento de Meta que no esté en ese documento.
>
> **El fallo medido (2026-10-31 05:46 UTC, producción):** un texto entrante llegó con
> `messages[].from_user_id`, `contacts[].user_id` y `contacts[].profile.username`, **sin**
> `messages[].from`. El borde zod exige `from` (`lib/types/whatsapp-webhook.ts:96`) y el parseo es
> del payload ENTERO (`whatsappWebhookPayloadSchema.parse`, `:506`), así que el lote completo —ese
> mensaje, cualquier otro mensaje y todos los `statuses` que viajaran con él— se descarta. El
> handler (`app/api/webhooks/whatsapp/route.ts:118-123`) imprime el error y responde 200; Meta no
> reintenta un 200.
>
> **Alcance: el arreglo mínimo de lo evidenciado.** Que un entrante sin teléfono no tumbe el lote y
> que su descarte quede visible. No se rediseña el modelo del chat: el hilo sigue siendo
> `(orden, teléfono)` y la orden se sigue resolviendo por `orden.telefono_dest`. Los requisitos
> asumen la opción recomendada de P1–P4; si el humano elige otra, cambian (ver cada pregunta).
>
> Términos:
> - **Entrante**: elemento de `entry[].changes[].value.messages[]` del webhook.
> - **Status**: elemento de `entry[].changes[].value.statuses[]`.
> - **Lote**: el cuerpo de un POST firmado al webhook.
> - **Entrante sin teléfono**: entrante que no trae `from` o lo trae vacío.
> - **BSUID**: identificador de usuario específico de la empresa de Meta (`from_user_id`,
>   `user_id`, `recipient_user_id`, `previous_user_id`, `parent_user_id`).
> - **Forma mínima de un entrante**: `id`, `timestamp` y `type` como texto no vacío.
> - **Forma mínima de un status**: `id`, `status` y `timestamp` como texto no vacío.
> - **Resumen**: el JSON de conteos que el webhook devuelve con el 200.

## Borde tipado: un elemento malo no tumba el lote

- **R1** — CUANDO llega un entrante con la forma mínima y sin teléfono, el sistema DEBE aceptarlo
  en el borde tipado como entrante sin teléfono, sin rechazar el lote.
- **R2** — SI un entrante de un lote no cumple la forma mínima, ENTONCES el sistema DEBE descartar
  solo ese entrante y DEBE procesar los demás entrantes y todos los status del mismo lote.
- **R3** — SI un status de un lote no cumple la forma mínima, ENTONCES el sistema DEBE descartar
  solo ese status y DEBE procesar los demás status y todos los entrantes del mismo lote.
- **R4** — CUANDO llega un status `sent`, `delivered`, `read` o `failed` sin `recipient_id` (con o
  sin `recipient_user_id` y con o sin `contacts`), el sistema DEBE aplicarlo al mensaje saliente
  cuyo identificador de Meta coincida, igual que un status con `recipient_id`.
- **R5** — CUANDO llega un entrante de tipo `system` sin teléfono, el sistema NO DEBE migrar el
  teléfono de ningún hilo y NO DEBE lanzar.

## Ingesta: el descarte se ve

- **R6** — CUANDO un entrante sin teléfono pasa el borde tipado, el sistema NO DEBE buscar orden
  para él, NO DEBE crear ni modificar ningún hilo ni mensaje de chat, y DEBE sumarlo al conteo
  `sinTelefono` del resumen. *(P1, opción A.)*
- **R7** — CUANDO el sistema descarta un entrante sin teléfono, DEBE emitir una línea de log de
  advertencia que empiece por `[whatsapp]` y contenga el motivo `sin_telefono`, el identificador de
  Meta del mensaje (`wa_message_id`) y su `type` de Meta.
- **R8** — CUANDO el sistema descarta un entrante o un status por no cumplir la forma mínima (R2,
  R3), DEBE emitir una línea de log de advertencia que empiece por `[whatsapp]` y contenga el
  motivo `forma_invalida`, la clase del elemento (`mensaje` o `status`), su `id` si es texto, y la
  ruta de cada campo que falló; y DEBE sumarlo al conteo `invalidos` del resumen.
- **R9** — CUANDO un lote contiene al menos un elemento descartado por forma inválida, el sistema
  DEBE volcar el cuerpo crudo del lote con la misma etiqueta de log que hoy usa cuando el lote no
  se puede parsear (`WP - type other (crudo)`).
- **R10** — Ninguna línea de log emitida por R7 ni por R8 DEBE contener el teléfono del cliente,
  ningún BSUID, el nombre de usuario ni el cuerpo del mensaje.
- **R11** — El volcado de diagnóstico de los status `failed` DEBE sustituir por `[redactado]` el
  valor de las claves `user_id`, `recipient_user_id`, `from_user_id`, `previous_user_id`,
  `parent_user_id` y `username` allí donde aparezcan, además de las que ya redacta hoy.
- **R12** — CUANDO llega un entrante con teléfono, el sistema DEBE resolver su orden, su hilo y su
  registro exactamente como hoy, traiga o no `from_user_id`, `contacts[].user_id` o
  `profile.username`.
- **R13** — CUANDO llega un lote con firma válida y estructura `entry[].changes[].value`, el
  webhook DEBE responder 200 con un resumen que incluya `mensajesRegistrados`,
  `statusesAplicados`, `sinResolver`, `hilosMigrados`, `sinTelefono` e `invalidos`.

## Fuera de alcance

- Enviar por `recipient` (BSUID). Hoy toda respuesta del hilo sale al teléfono de la orden
  (`orden.telefono_dest`, vía `OrdenEnvioReader`), que siempre existe; ningún hilo puede nacer sin
  teléfono porque la orden se resuelve por teléfono. Meta recomienda además enviar al teléfono
  cuando se tiene (research, punto 4).
- Guardar el BSUID en el hilo o en la orden y casar por él (P1, opción B).
- Pedir el teléfono con `REQUEST_CONTACT_INFO` (P2).
- Actualizar BSUID con los `system` `user_changed_number` / `user_changed_user_id` (P4).
- Pantallas: ninguna. No hay E2E.

## Preguntas para el humano

- **P1 — Qué se hace con un entrante sin teléfono.** Hoy se pierde entero. El hilo exige orden y la
  orden se encuentra por teléfono, así que sin teléfono no hay a dónde llevarlo.
  - **A (recomendada):** descartarlo con línea de log visible y conteo (R6/R7). Sin migración. Por
    la regla de 30 días de Meta (research, punto 3), un cliente que recibió nuestra bienvenida en su
    teléfono responde CON `from`; lo que se pierde es quien escribe sin contacto previo, que tampoco
    tiene orden asignada que casar. Medido: un solo caso, la prueba de Carlos.
  - **B:** guardar el BSUID en `chat_conversacion` cuando un entrante llegue con teléfono y BSUID, y
    casar por él los posteriores sin teléfono. Migración + `WHERE` nuevo + test contra Postgres.
    Solo ayuda si el cliente vuelve a escribir más de 30 días después del último contacto, con la
    orden aún viva y asignada.
  - **C:** guardarlo en una tabla de «entrantes sin casar» para revisarlo a mano. Tabla nueva y
    pantalla o consulta para verla.
- **P2 — ¿Se pide el teléfono con `REQUEST_CONTACT_INFO`?**
  - **A (recomendada):** no en esta ficha. Exige responder a un entrante que no casa con ninguna
    orden (por `recipient`, fuera de alcance) y un texto de producto; con un caso medido no compensa.
  - **B:** respuesta automática interactiva con el botón, por `recipient`, al entrante sin teléfono.
  - **C:** plantilla aprobada con el botón (requiere alta y aprobación en Meta).
- **P3 — Los `sinResolver` de hoy también son un descarte mudo.** Un entrante CON teléfono que no
  casa con ninguna orden viva y asignada solo suma en el JSON del 200, que nadie lee
  (`lib/services/ChatWhatsappService.ts:235-239`).
  - **A (recomendada):** emitir la misma línea de log (`motivo=sin_orden`, `wa_message_id`, `type`);
    es una línea más en el mismo bucle.
  - **B:** dejarlo como está; otra ficha.
- **P4 — Los `system` de cambio de BSUID** (`user_changed_number`, `user_changed_user_id`) pueden
  llegar sin teléfono (research, punto 6).
  - **A (recomendada):** tratarlos como cualquier entrante sin teléfono (R5 + R6/R7). Sin BSUID
    guardado (P1-A) no hay nada que actualizar.
  - **B:** solo con P1-B: actualizar el BSUID guardado del hilo con `previous_user_id` → `user_id`.
