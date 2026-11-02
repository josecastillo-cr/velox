# 491 — WhatsApp: mensajes entrantes de clientes con nombre de usuario · design

> Asume P1-A, P2-A, P3-A y P4-A (`requirements.md`). Si el humano elige P1-B, §7 describe lo que
> cambia. Búsqueda de código: grafo `codebase-memory` (`R-job-singularis-projects-ordenex`) y cada
> símbolo confirmado en el archivo real.

## 1. Lo medido en el código (origen de cada decisión)

| # | Pregunta | Respuesta (archivo real) |
|---|----------|--------------------------|
| 1 | Ruta y schema | `app/api/webhooks/whatsapp/route.ts` → `handlePost` → `parseWebhookEventos` (`lib/types/whatsapp-webhook.ts:505`). `metaMessageSchema` exige `from: z.string().min(1)` (`:96`). |
| 1b | ¿Un mensaje inválido tumba el lote? | **Sí, entero.** `whatsappWebhookPayloadSchema.parse(raw)` (`:506`) valida `entry[].changes[].value.messages[]` y `statuses[]` como arrays tipados: un elemento inválido lanza para todo el payload. `handlePost` lo captura (`route.ts:118-123`), hace `console.log` del error y del crudo, y responde 200 **sin llamar al service**: se pierden los demás entrantes y todos los `statuses` (incluido `EntregaEstadoService`, ficha 474). |
| 2 | Casamiento entrante → orden/hilo | `ChatWhatsappService.ingerirEventos` (`lib/services/ChatWhatsappService.ts:198`) llama a `ChatConversacionRepository.resolverOrdenActivaPorNumero` (`lib/repositories/ChatConversacionRepository.ts:65`): SQL crudo por `orden.telefono_dest` normalizado, orden viva y asignada, la más reciente. Luego `upsertParaOrden` keyea el hilo por `(orden_id, telefono_e164)`. |
| 2b | Columnas del hilo | `ChatConversacion` (`db/schema.prisma:341`): `id`, `telefono_e164`, `orden_id` (NOT NULL), `mensajero_id` (NOT NULL), `ultimo_entrante_at`, `mensajero_leido_at`, `created_at`, `updated_at`. Único `(orden_id, telefono_e164)`. **No hay columna de BSUID** ni hilo posible sin orden. Ningún modelo del esquema guarda `user_id`/`username` de WhatsApp. |
| 3 | Envío de respuestas | `WhatsappCloudClient.enviar{Texto,Plantilla,Media}` (`lib/clients/whatsapp-cloud.ts:107-170`) siempre mandan `to: destino`. El destino de las respuestas del chat es el teléfono de la orden (`EnviarTextoChatInput.telefonoE164`, «lo aporta el `OrdenEnvioReader`») o `hilo.telefonoE164`. Pasar `recipient` es posible en Meta (research, punto 4) pero **no hace falta**: todo hilo nace con teléfono. |
| 4a | `type: "system"` hoy | Se mapea a `sistema`; `normalizarSistema` (`:484`) solo reconoce `user_changed_number`/`customer_changed_number`/`customer_identity_changed` y busca el número nuevo en `system.wa_id ?? new_wa_id ?? customer`; si no, degrada a `otro`. Usa `m.from` como número anterior. `user_changed_user_id` cae en `otro`. **Sin `from` el lote entero muere antes** (1b). |
| 4b | `statuses` sin teléfono | `metaStatusSchema` (`:158`) solo pide `id`, `status`, `timestamp`; no lee `recipient_id`. Un status con solo `recipient_user_id` ya pasa; se aplica por `wa_message_id` (`actualizarEstadoPorWaMessageId`). Hoy solo se pierde si viaja en el mismo lote que un entrante sin `from` (1b). |
| 5 | Visibilidad del descarte | `sinResolver` solo se cuenta y vuelve en el JSON del 200 (`ChatWhatsappService.ts:235-239`): nadie lo ve. El volcado `volcarStatusesFallidos` (`lib/services/whatsapp/chat-logger.ts:113`) redacta `CLAVES_PII` = `recipient_id, recipient, from, wa_id, phone_number, to`: **no** incluye las claves de BSUID ni `username`. |

## 2. Decisiones

### D1 — `from` opcional en el borde; el dominio lleva `telefonoE164: string | null`

`metaMessageSchema.from` pasa a `z.string().optional().catch(undefined)`. `parseWebhookEventos`
normaliza `from` ausente o vacío (tras `trim`) a `null`. `WebhookMensajeEntrante.telefonoE164`
pasa a `string | null`. No se declara `from_user_id` ni `contacts[]` de nivel `value`: el strip de
zod los descarta, y con P1-A no se usan (no entra ningún BSUID en el dominio ni en un log; R10).

`normalizarSistema` usa `m.from ?? ""` para el número anterior → `telefonoAnterior: null` cuando
falta, y el service ya no migra con anterior `null` (`ChatWhatsappService.ts:220`). Eso cubre R5
sin tocar el service en esa rama.

### D2 — Aislamiento por elemento (R2/R3)

`metaValueSchema` declara `messages` y `statuses` como `z.array(z.unknown()).optional().catch(undefined)`.
`parseWebhookEventos` valida cada elemento con `metaMessageSchema.safeParse` / `metaStatusSchema.safeParse`:

- éxito → se normaliza como hoy;
- fallo → se añade a `descartados` (contrato §3) con `clase`, `id` (si el elemento crudo trae `id`
  string; si no, `null`) y `campos` = `issue.path.join(".")` de cada issue de zod. **Nunca** el
  valor ni el `message` del issue (este puede citar lo recibido).

`whatsappWebhookPayloadSchema.parse` sigue lanzando si falta `entry` o `changes` (estructura del
lote): esa rama del route no cambia.

### D3 — La decisión de descartar vive en el service (R6/R7/R8)

`ingerirEventos`:

1. Por cada `eventos.descartados`: `logger.warn` (R8) y `invalidos += 1`.
2. Por cada entrante con `telefonoE164 === null`: `logger.warn` (R7), `sinTelefono += 1`,
   `continue` **antes** de `migrarTelefono` y de `resolverOrdenActivaPorNumero` (R5/R6).
3. Con P3-A: en la rama `resolucion === null` existente, además del conteo, `logger.warn` con
   `motivo=sin_orden`.

El service ya recibe `logger?: ChatLogger` y el route inyecta `consoleLogger`
(`route.ts:60`). Se usa `this.deps.logger?.warn`; la presencia en producción la prueba el test del
route (T5), no el del service.

Formato exacto de las líneas (contrato para los tests, R7/R8/R10):

```
[whatsapp] entrante descartado: motivo=sin_telefono wa_message_id=<id> tipo=<type de Meta>
[whatsapp] evento descartado: motivo=forma_invalida clase=<mensaje|status> id=<id|-> campos=<a,b>
[whatsapp] entrante descartado: motivo=sin_orden wa_message_id=<id> tipo=<type de Meta>   (P3-A)
```

Para tener el `type` crudo de Meta en el service, `WebhookMensajeEntrante` gana `tipoMeta: string`
(el `type` tal como llegó; hoy solo se conserva el enum de dominio, que convierte todo lo
desconocido en `otro`). No es PII.

### D4 — Paridad del volcado crudo (R9)

Hoy un lote con un elemento malformado se vuelca crudo con `WP - type other (crudo)`, y esa es la
única pista ante un cambio de forma de Meta. Con D2 el parse ya no lanza, así que `handlePost`
vuelca `raw` con esa misma etiqueta cuando `eventos.descartados.length > 0`. Un entrante sin
teléfono **no** es un descarte de forma (pasa el borde) y no dispara el volcado: su forma ya es
conocida y el crudo lleva teléfono, BSUID y nombre de usuario.

### D5 — Redacción de BSUID en el volcado de `failed` (R11)

`CLAVES_PII` (`chat-logger.ts:21`) gana `user_id`, `recipient_user_id`, `from_user_id`,
`previous_user_id`, `parent_user_id`, `username`. Una línea; aplica también a `cuerpoParaLog`, que
comparte el conjunto (sin efecto hoy: nunca enviamos BSUID).

### D6 — Envío: sin cambios

`WhatsappCloudClient` no gana `recipient`. Razón en §1, fila 3.

## 3. Contratos

```ts
// lib/types/whatsapp-webhook.ts
export interface WebhookMensajeEntrante {
  waMessageId: string;
  /** null = Meta omitió `from` (cliente con nombre de usuario sin contacto previo, 491). */
  telefonoE164: string | null;
  /** `type` crudo de Meta, solo para diagnóstico en logs. */
  tipoMeta: string;
  // ...resto sin cambios
}

export interface WebhookDescarte {
  clase: "mensaje" | "status";
  /** `id` del elemento crudo si era texto; null si no. */
  id: string | null;
  /** Rutas de los campos que fallaron en zod (sin valores). */
  campos: string[];
}

export interface WebhookEventos {
  mensajes: WebhookMensajeEntrante[];
  statuses: WebhookStatus[];
  descartados: WebhookDescarte[];
}

// lib/services/ChatWhatsappService.ts
export interface IngestaResumen {
  mensajesRegistrados: number;
  statusesAplicados: number;
  sinResolver: number;
  hilosMigrados: number;
  sinTelefono: number; // R6
  invalidos: number;   // R8
}
```

Respuesta del webhook (R13): `200 { ok: true, ...IngestaResumen }`, como hoy, con las dos claves
nuevas.

## 4. Modelo de datos

Ninguna migración, ninguna tabla, ninguna RLS. (Con P1-B, ver §7.)

## 5. Alternativas descartadas

1. **Solo hacer `from` opcional, sin aislar elementos (D2).** Arregla el caso medido con una línea,
   pero deja intacta la causa del daño colateral: el próximo campo que Meta omita o cambie vuelve a
   tirar el lote entero, con sus `statuses` y los estados de entregas de la 474. El daño evidenciado
   no es solo el mensaje sin `from`, es todo lo que viajaba con él. Descartada.
2. **Guardar el BSUID en el hilo y casar por él (P1-B).** Columna + `WHERE` nuevo + backfill
   imposible (los BSUID del portfolio de Nuform no valen, research punto 1) para cubrir un caso que
   la regla de 30 días de Meta hace raro: quien tiene orden asignada recibió la bienvenida en su
   teléfono y responde con `from`. Rediseño del casamiento sin evidencia de pérdida real.
   Queda como P1-B.
3. **Responder por `recipient` / hilo sin orden.** El hilo exige `orden_id` y `mensajero_id` NOT
   NULL; un hilo huérfano es rediseñar el modelo del chat y una bandeja nueva. Descartada.
4. **Emitir los logs en el route en vez del service.** El route ya vuelca crudos, pero decidir que
   un entrante sin teléfono no se casa es lógica de negocio (`docs/architecture.md`, capas) y debe
   ser testeable sin HTTP. Descartada; el route solo conserva el volcado crudo de D4.
5. **`safeParse` del payload entero y, si falla, reintentar sin los elementos malos.** Doble
   parseo y lógica de poda frágil frente a D2, que es directo. Descartada.

## 6. Pruebas y trazabilidad

Sin E2E. Sin cambio de `WHERE` (P1-A) → no hace falta test nuevo contra Postgres; el gate
`--rapido` se amplía solo con `tests/integration/db` por tocar `lib/types/`, y ahí corre
`chat-entrante-telefono-cr.test.ts` (casamiento por teléfono, R12).

| R | Test |
|---|------|
| R1, R5 | `tests/unit/types/whatsapp-webhook.test.ts` — entrante sin `from` con `from_user_id` → `telefonoE164: null`, `tipoMeta: "text"`; `system` sin `from` → `sistema.telefonoAnterior` null o degradado, sin lanzar. |
| R2, R3 | mismo archivo — lote con 1 entrante sin `id` + 1 válido + 1 status válido + 1 status sin `timestamp` → 1 mensaje, 1 status, 2 `descartados` con `clase`, `id` y `campos` correctos; ningún `campos` contiene un valor del payload. |
| R4 | mismo archivo — status `delivered` con `recipient_user_id` y `contacts[].user_id`, sin `recipient_id` → status normalizado. `tests/unit/services/chat-whatsapp-service.test.ts` — se llama `actualizarEstadoPorWaMessageId` con su id. |
| R5, R6, R7, R10 | `tests/unit/services/chat-whatsapp-service.test.ts` — entrante con `telefonoE164: null`: `resolverOrdenActivaPorNumero`, `migrarTelefono`, `upsertParaOrden` e `insertarEntranteIdempotente` NO llamados; `sinTelefono: 1`; una línea de log con el formato literal de D3; la línea no contiene el BSUID, el `username` ni el cuerpo del fixture. |
| R8 | mismo archivo — `descartados` con 2 elementos → 2 líneas `forma_invalida` literales y `invalidos: 2`. |
| R9 | `tests/integration/api/webhook-whatsapp.route.test.ts` — lote con un elemento malformado → `console.log("WP - type other (crudo)", raw)`; lote con solo un entrante sin teléfono → no se vuelca crudo. |
| R11 | `tests/unit/services/whatsapp-fallo-saliente.test.ts` — `redactarPII` sobre un status `failed` con las seis claves → todas `[redactado]`. |
| R12 | `tests/unit/services/chat-whatsapp-service.test.ts` — entrante con teléfono y fixture con `from_user_id`/`username` → mismo flujo que hoy. `tests/integration/db/chat-entrante-telefono-cr.test.ts` sigue verde. |
| R13 | `tests/integration/api/webhook-whatsapp.route.test.ts` — con el service REAL sobre dobles de repo (o el fake que devuelva el resumen completo) y el lote del caso medido (sintético) → 200 y el cuerpo contiene `sinTelefono: 1` e `invalidos: 0`; con un status en el mismo lote, el service recibe el status. |

**Fixture del caso medido:** sintético, con la forma del research (`from_user_id`,
`contacts[].user_id`, `contacts[].profile.username`, sin `from`). Ningún teléfono, BSUID ni nombre
real (el de Carlos no entra en el repo).

**Literales de contrato que cambian:** los tests que comparan con `toEqual` el `IngestaResumen` o
el cuerpo del 200 ganan `sinTelefono: 0, invalidos: 0`. Se actualizan a mano con el literal, nunca
calculándolo desde el código (memoria «Literal: contrato o polizón»).

## 7. Si el humano elige P1-B (no implementar sin su respuesta)

- Migración `chat_conversacion.usuario_wa_id text NULL` + índice; `down.sql` con `DROP COLUMN`.
- Borde: declarar `from_user_id` y llevarlo al dominio; `upsertParaOrden` lo guarda cuando llega
  junto al teléfono.
- Casamiento nuevo por `usuario_wa_id` para entrantes sin teléfono: `WHERE` nuevo → test en
  `tests/integration/db/` contra Postgres real (no dobles), con mutación del `WHERE` que lo ponga
  rojo.
- R6 cambia: «sin teléfono **y** sin hilo con ese BSUID».
- P4-B pasa a ser posible.
