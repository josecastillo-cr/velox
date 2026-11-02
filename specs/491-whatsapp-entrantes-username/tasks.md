# 491 — WhatsApp: mensajes entrantes de clientes con nombre de usuario · tasks

> Zona `backend`; implementa `backend_dev`. Asume P1-A, P2-A, P3-A, P4-A. **Bloqueada hasta la
> respuesta del humano a P1–P4**; si P3 sale B, T4 omite la línea `sin_orden`; si P1 sale B, este
> archivo se reescribe con design §7. Gate: `./init.sh --rapido` (se amplía solo con
> `tests/integration/db` por tocar `lib/types/`). Nunca el completo. Sin E2E. `[P]` = paralelizable
> con las demás `[P]` de su fase una vez cumplidas sus dependencias. Un commit por task:
> `feat(491): …` / `test(491): …`.

## Fase 0 — Antes de tocar nada

- [ ] **T0 — Arranque del worktree.** Nacido de `dev` (SHA dado por el leader, `checkout --detach` +
  merge-base como primer paso). Correr aislados `tests/unit/types/whatsapp-webhook.test.ts`,
  `tests/unit/services/chat-whatsapp-service.test.ts`, `tests/integration/api/webhook-whatsapp.route.test.ts`
  y `tests/unit/services/whatsapp-fallo-saliente.test.ts`.
  **Hecho:** los cuatro en verde y anotados con el SHA en `progress/impl_491.md`.

## Fase 1 — Borde tipado

- [ ] **T1 — Test rojo del caso medido** (depende de T0). En `tests/unit/types/whatsapp-webhook.test.ts`,
  fixture sintético del 2026-10-31 (design §6): `messages[0]` con `from_user_id`, `id`, `timestamp`,
  `type: "text"`, `text`, sin `from`; `value.contacts[0]` con `user_id` y `profile.username`; y un
  status `delivered` en el mismo `value`. Asertar: `parseWebhookEventos` no lanza, devuelve 1
  mensaje con `telefonoE164: null` y `tipoMeta: "text"`, y 1 status. → R1, R4.
  **Hecho:** test rojo contra el código actual (lanza `messages.0.from`), commiteado como `test(491)`.
- [ ] **T2 — `from` opcional + aislamiento por elemento** (depende de T1; design D1, D2, §3).
  `lib/types/whatsapp-webhook.ts`: `from` opcional; `telefonoE164: string | null`; `tipoMeta`;
  `messages`/`statuses` como `z.array(z.unknown())` con `safeParse` por elemento; `descartados`;
  `normalizarSistema` tolera `from` ausente. Tests en el mismo archivo: lote mixto de R2/R3
  (1 entrante sin `id`, 1 válido, 1 status sin `timestamp`, 1 válido) → conteos y `descartados`
  exactos (`clase`, `id`, `campos` como literales); `campos` sin ningún valor del payload; `system`
  sin `from` no lanza. → R1, R2, R3, R4, R5.
  **Hecho:** T1 y los nuevos en verde; los tests previos del archivo en verde; typecheck verde
  (los consumidores de `telefonoE164` compilan con `string | null`). Mutación: volver a
  `.parse` del array tipado pone rojo R2.

## Fase 2 — Ingesta y logs

- [ ] **T3 [P] — Redacción de BSUID** (depende de T0; design D5). Seis claves en `CLAVES_PII`
  (`lib/services/whatsapp/chat-logger.ts`). Test en `tests/unit/services/whatsapp-fallo-saliente.test.ts`:
  `redactarPII` y `volcarStatusesFallidos` sobre un `failed` con las seis claves → `[redactado]` en
  cada una (literal). → R11.
  **Hecho:** verde; quitar una clave del conjunto lo pone rojo.
- [ ] **T4 — Service: descarte visible** (depende de T2; design D3, §3).
  `ChatWhatsappService.ingerirEventos`: `invalidos` + log de `descartados`; `sinTelefono` + log +
  `continue` antes de `migrarTelefono`/`resolverOrdenActivaPorNumero`; P3-A: log `sin_orden` en la
  rama existente. `IngestaResumen` con las dos claves. Tests en
  `tests/unit/services/chat-whatsapp-service.test.ts` con logger falso: entrante sin teléfono → ningún
  repo de hilo/mensaje llamado, `sinTelefono: 1`, línea literal de D3, la línea NO contiene el
  BSUID / `username` / cuerpo del fixture; `descartados` ×2 → 2 líneas `forma_invalida`,
  `invalidos: 2`; entrante con teléfono y campos BSUID → flujo de hoy; status en el mismo lote
  aplicado. Actualizar a mano los `toEqual` de `IngestaResumen` existentes (literal
  `sinTelefono: 0, invalidos: 0`) en este archivo, `tests/unit/api/webhook-whatsapp-entregas.test.ts`,
  `tests/unit/services/whatsapp-fallo-saliente.test.ts` y `tests/integration/db/chat-entrante-telefono-cr.test.ts`
  si los comparan. → R4, R5, R6, R7, R8, R10, R12.
  **Hecho:** verde; mutaciones anotadas en `progress/impl_491.md`: quitar el `continue` pone rojo
  R6; quitar el `warn` pone rojo R7.
- [ ] **T5 — Route: volcado crudo y resumen** (depende de T4; design D4). `handlePost` vuelca `raw`
  con `WP - type other (crudo)` si `eventos.descartados.length > 0`. Tests en
  `tests/integration/api/webhook-whatsapp.route.test.ts` (firma real con `firmar`): lote del caso
  medido → 200, cuerpo con `sinTelefono: 1`, `invalidos: 0`, sin volcado crudo, y el service recibe
  también el status; lote con un elemento malformado → volcado crudo con esa etiqueta y 200; el
  `fakeService` existente devuelve el resumen completo. → R9, R13.
  **Hecho:** verde; quitar el volcado pone rojo R9.

## Fase 3 — Cierre

- [ ] **T6 — Gate y trazabilidad** (depende de T3, T5). `./init.sh --rapido` (confirmar en el log
  que corrió `tests/integration/db` y que no hay `skipped` por falta de `.env`; `INIT_EXIT=$?`
  dentro del log). Mapa R1–R13 → test concreto en `progress/impl_491.md`.
  **Hecho:** gate verde con `INIT_EXIT=0` en el log; los 13 requisitos mapeados; todo commiteado
  en la rama de la ficha (verificar el blob, no solo el árbol).
- [ ] **T7 — Verificación tras el despliegue** (depende de T6; la hace el leader, no el
  subagente; en el entorno al que apunte el webhook de Meta, que este spec no conoce). Pedir a Carlos que repita el texto de prueba desde su cuenta con nombre de usuario.
  **Hecho:** en los logs de Vercel aparece `[whatsapp] entrante descartado: motivo=sin_telefono`
  con su `wa_message_id`, y ningún `messages.0.from: invalid_type`. Si Meta ya manda `from` (por la
  regla de 30 días tras la conversación previa), anotarlo: el caso no es reproducible y vale el test
  sintético.
