# 489 · Correo por Brevo: plantillas e interruptor — diseño

Arreglo mínimo: sin tablas, sin migraciones, sin rutas nuevas, sin cambios de RLS. Todo es
TypeScript de borde (config y plantillas) más dos páginas que ya existen.

## 1 · Modelo de datos

Ninguno. `email_otp_challenge` no gana columna de propósito: el propósito solo decide el TEXTO
del correo y viaja en memoria del emisor al proveedor. Persistirlo no lo pide ningún requisito
(ver alternativa D-ALT-2).

## 2 · El propósito del código (backend)

Tipo nuevo, junto al contrato del proveedor (`lib/interfaces/external/IEmailProvider.ts`):

```ts
export type PropositoCodigo = "inicio_sesion" | "cambio_contrasena";

export interface SendOtpCodeParams {
  to: string;
  code: string;
  expiresInMinutes: number;
  proposito: PropositoCodigo;   // NUEVO, obligatorio
}
```

`EmitirOtpParams` (`lib/services/OtpChallengeIssuer.ts`) gana `proposito: PropositoCodigo`,
**obligatorio**, y `emitir` lo reenvía tal cual a `sendOtpCode`. Obligatorio a propósito: el
typecheck señala a cada llamador, y no existe un «por defecto» que deje un flujo con el texto del
otro sin que nadie se entere.

| Llamador | Propósito |
| --- | --- |
| `AuthService` (rama de riesgo alto, hoy línea ~132) | `"inicio_sesion"` |
| `PasswordResetService.solicitar` | `"cambio_contrasena"` |

Nada más cambia en `emitir`: generación (`generarCodigoOtp`), `bcrypt.hash`, TTL, `otpRepo.create`
y el orden crear-desafío → enviar quedan iguales (R11). El código en claro sigue existiendo solo en
memoria y en el cuerpo del correo (R9).

## 3 · Plantillas (funciones puras)

```
lib/services/email/plantillas/
  base-codigo.ts               componerCorreoCodigo(...)  -> { html, text }
  codigo-inicio-sesion.ts      plantillaCodigoInicioSesion(params, marca) -> EmailMessage
  codigo-cambio-contrasena.ts  plantillaCodigoCambioContrasena(params, marca) -> EmailMessage
  index.ts (opcional)          plantillaCodigoPorProposito(params, marca) -> EmailMessage
  otp-codigo.ts                SE BORRA (y su describe en email-notificacion.test.ts migra)
```

### 3.1 Base común (`base-codigo.ts`)

Entrada:

```ts
interface CorreoCodigoPiezas {
  marca: string;            // ya resuelta (R2/R3)
  titulo: string;           // «Tu código para entrar», …
  introduccion: string;     // párrafo antes del código
  codigo: string;
  expiresInMinutes: number;
  avisoSiNoFuisteTu: string;
}
```

Salida `{ html, text }`:

- **HTML**: documento con `<meta charset="utf-8">`, tabla de ancho fijo (~560 px) con estilos inline
  (los clientes de correo ignoran `<style>` y clases). Tres bloques en orden (R1):
  1. cabecera: la marca como texto (P6), fondo `#0b2545` (navy de la app) y texto blanco;
  2. cuerpo: título, introducción, el código grande (`#f26419`, `letter-spacing`), «Vence en N
     minutos y solo sirve una vez.», y el aviso;
  3. pie: «Este correo lo envió {marca} de forma automática; no respondas a este mensaje.»
- **Texto plano**: mismas piezas en el mismo orden, separadas por líneas en blanco (R1). Es la
  versión que leen los filtros antispam y los clientes sin HTML.
- Todo valor interpolado en HTML pasa por `escaparHtml` (se mueve aquí desde `otp-codigo.ts`), marca
  incluida (R8). En texto plano no se escapa.
- Español con tildes; nunca «OTP» ni «SLA» (R7).

### 3.2 Las dos plantillas

| | «código para entrar» (R4) | «código para cambiar la contraseña» (R5) |
| --- | --- | --- |
| Asunto (R6) | `Tu código para entrar a {marca}` | `Tu código para cambiar la contraseña de {marca}` |
| Título | Tu código para entrar | Tu código para cambiar la contraseña |
| Introducción | Alguien está entrando a tu cuenta de {marca} desde un dispositivo nuevo. Para confirmar que eres tú, escribe este código: | Pediste cambiar la contraseña de tu cuenta de {marca}. Escribe este código para continuar: |
| Aviso | Si no fuiste tú, no compartas este código con nadie. (P2) | Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual. |

El asunto no lleva el código (R6, abierta en P1). Los textos exactos son los de esta tabla; el
implementer no los reescribe sin volver al spec.

### 3.3 La marca (R2/R3)

`loadEmailConfig()` exige `SMTP_USER`/`SMTP_PASSWORD` y lanza sin ellos, así que no sirve para el
caso «sin SMTP» (dev, CI, emisor de consola). Se añade en `lib/config/email.ts`:

```ts
/** Marca visible de los correos: SMTP_FROM_NAME o "Ordenex". No exige credenciales. */
export function nombreMarcaCorreo(): string
```

que reutiliza `leerTexto("SMTP_FROM_NAME") ?? DEFAULT_FROM_NAME`, y `loadEmailConfig().fromName` pasa a
llamarla (una sola fuente; el `From` visible y la marca del cuerpo no pueden divergir).

### 3.4 El proveedor

`EmailNotificacionProvider` recibe la marca por constructor (inyectable en tests):

```ts
constructor(private readonly sender: IEmailSender, private readonly marca: string)

async sendOtpCode(params) {
  await this.sender.enviar(plantillaCodigoPorProposito(params, this.marca));
  console.info(`[auth] OTP enviado a ${params.to} (${params.proposito}), expira en ${params.expiresInMinutes} min`);
}
```

- El prefijo `[auth] OTP enviado` se conserva literal: es lo que mide el procedimiento de encendido
  en los logs de Vercel (R10). Es log interno, no texto de usuario, así que la sigla se queda.
- El log va DESPUÉS de `enviar`: si el transporte lanza, no hay línea y el error se propaga (R11).
- `crearEmailProvider()` pasa `nombreMarcaCorreo()`.
- `StubEmailProvider` solo ajusta la firma; su log puede llevar el propósito, sin código.
- `plantillaCodigoPorProposito` es un `switch` exhaustivo sobre `PropositoCodigo` (con `never` en el
  `default`), para que un tercer propósito futuro rompa el typecheck en vez de caer en una plantilla.

## 4 · El interruptor (config backend)

Archivo nuevo `lib/config/recuperacion-contrasena.ts`:

```ts
/** RECUPERACION_CONTRASENA_ACTIVA: "true"/"1" (sin mayúsculas, trim) => true; todo lo demás => false. */
export function recuperacionContrasenaActiva(): boolean
```

- Función y no constante de módulo: se evalúa en cada render, así los tests cambian `process.env`
  entre casos sin `vi.resetModules`, y nada queda congelado en un módulo cacheado.
- Sin prefijo `NEXT_PUBLIC_` (R18): Next no la incrusta en el bundle del cliente. Las dos páginas ya son
  dinámicas (leen `cookies()`), así que la lectura ocurre en servidor por petición; en Vercel cambiar
  la variable exige redeploy de todas formas.
- Se documenta en `.env.example` junto a la sección SMTP, vacía (= apagado).

## 5 · Frontend

### 5.1 `app/recuperar-contrasena/page.tsx` (Server Component)

```tsx
const activa = recuperacionContrasenaActiva();
…
<p …>{activa ? "Recupera el acceso a tu cuenta de forma segura" : "Te ayudamos a volver a entrar a tu cuenta."}</p>
…
{activa ? <RecuperarContrasenaForm /> : <RecuperacionDesactivadaAviso />}
```

La redirección por sesión válida va antes y no depende del interruptor (R14).

### 5.2 Login

- `app/login/page.tsx` (servidor) lee `recuperacionContrasenaActiva()` y lo pasa:
  `<LoginForm redirectParam={…} recuperacionActiva={activa} />`.
- `LoginFormProps` gana `recuperacionActiva?: boolean` con **default `false`**. Opcional a propósito:
  los ~50 renders de `tests/components/LoginForm.test.tsx` siguen describiendo el estado apagado sin
  tocarlos, y el único llamador de producción lo pasa explícito.
- En el hueco de hoy: `recuperacionActiva ? <div className="text-center"><Link href="/recuperar-contrasena" …>¿Olvidaste tu contraseña?</Link></div> : <p …>¿Olvidaste tu contraseña? Pídele a un administrador que te la restablezca.</p>`.
  El bloque JSX comentado que guarda el original se sustituye por esta rama (se conserva su clase).
  Nunca conviven (R15/R16).
- El `<p>` sigue sin `role`: la suite de LoginForm exige cero regiones vivas en credenciales.

### 5.3 Guardia `superficie-de-uso` (R19)

La guardia es ESTÁTICA: en cuanto `page.tsx` importe `RecuperarContrasenaForm` (aunque sea en una rama
del ternario), el formulario y las tres acciones de `lib/actions/password-reset.ts` pasan a ser
alcanzables y la guardia **exige** borrar sus cuatro `@sin-superficie` (anotación caducada). Se borran
en el mismo commit que el import. `RecuperacionDesactivadaAviso` sigue importado, luego alcanzable.

### 5.4 Cabeceras-documento

Las cabeceras de `page.tsx`, `RecuperacionDesactivadaAviso.tsx`, `RecuperarContrasenaForm.tsx` y el
comentario de `LoginForm.tsx` explican cómo se reenciende «editando código». Se reescriben para decir
que se enciende con `RECUPERACION_CONTRASENA_ACTIVA` y redeploy, conservando la historia de la causa
(Gmail 535, 2026-09-04) en una línea. Las referencias a Gmail en `lib/config/email.ts` (host por
defecto y comentarios) no se tocan: el host por defecto no es parte de esta feature.

## 6 · Contratos de entrada/salida

| Pieza | Entrada | Salida |
| --- | --- | --- |
| `componerCorreoCodigo` | `CorreoCodigoPiezas` | `{ html: string; text: string }` |
| `plantillaCodigoInicioSesion` / `…CambioContrasena` | `SendOtpCodeParams`, `marca` | `EmailMessage { to, subject, text, html }` |
| `nombreMarcaCorreo` | env | `string` no vacío |
| `recuperacionContrasenaActiva` | env | `boolean` |
| `OtpChallengeIssuer.emitir` | `EmitirOtpParams` + `proposito` | `{ challengeId }` (igual) |

## 7 · Integraciones

Brevo por SMTP vía nodemailer, sin cambios en el transporte (`NodemailerEmailSender`). Brevo no
requiere nada nuevo para HTML+texto. Vercel: dos variables (§8).

## 8 · Despliegue y encendido

1. Se despliega con `RECUPERACION_CONTRASENA_ACTIVA` sin definir y `AUTH_RISK_THRESHOLD=999`: la UI es la
   de hoy (R12/R15) y no se envía ningún correo nuevo. Lo único que cambia en prod es el texto de un
   correo que hoy no sale.
2. El viernes: en Vercel → Production, crear `RECUPERACION_CONTRASENA_ACTIVA=true`; redeploy; prueba
   real SOLO del correo de recuperación, midiendo `[auth] OTP enviado … (cambio_contrasena)` en los
   logs. Procedimiento completo en `docs/release.md` (tarea E.1).
   **`AUTH_RISK_THRESHOLD=999` NO se borra** (decisión del humano, 2026-10-30): varios usuarios no
   tienen acceso a su correo (p. ej. `mensajero@ordenex.co` no existe), y exigirles un código por
   correo los dejaría sin poder entrar. La plantilla «código para entrar» se implementa y se prueba en
   unitarios, pero no en producción.
3. Vuelta atrás: borrar `RECUPERACION_CONTRASENA_ACTIVA`; redeploy. Sin código.

## 9 · Alternativas descartadas

- **D-ALT-1 · Plantilla única con un parámetro de texto (`asunto`, `aviso`) pasado por cada flujo.**
  Descartada: deja el texto del correo repartido entre `AuthService` y `PasswordResetService`, que no
  deben saber de redacción, y no permite afirmar en un test unitario «el correo de recuperación dice
  que la contraseña sigue igual» sin montar el servicio. Dos funciones puras sobre una base común se
  prueban solas y el flujo solo dice QUÉ es (propósito), no CÓMO se escribe.
- **D-ALT-2 · Guardar el propósito en `email_otp_challenge` y que el proveedor lo lea de ahí.**
  Descartada: exige migración y backfill para un dato que solo vive mientras se compone el correo.
  Tenerlo en base invitaría además a validar que un código de entrar no sirva para cambiar la
  contraseña (hoy `PasswordResetService` busca el desafío activo por usuario, sin distinguir el
  propósito); eso es rediseñar el modelo de auth, fuera de alcance. Si el humano lo quiere, es ficha
  aparte.
- **D-ALT-3 · Interruptor con `NEXT_PUBLIC_RECUPERACION_CONTRASENA_ACTIVA` leído en el cliente.**
  Descartada: Next lo congela en el bundle en el build, así que «cambiar env + redeploy» funcionaría
  igual pero el valor quedaría expuesto y duplicado en cada chunk, y el Server Component de
  `/recuperar-contrasena` igualmente necesitaría leerlo. Una sola lectura en servidor, pasada por prop.
- **D-ALT-4 · Un `middleware` que redirija `/recuperar-contrasena` cuando esté apagado.**
  Descartada: hoy la ruta es pública a propósito y muestra a quién acudir; redirigir a `/login` sin
  explicación es el callejón que la desactivación del 2026-09-04 evitó.

## 10 · Riesgos

- **Tests que hoy afirman lo apagado** (`tests/integration/recuperar-contrasena-page.test.tsx`,
  `tests/integration/login-form-reset-link.test.tsx`, el bloque de `LoginForm.test.tsx` ~l.497) siguen
  valiendo para el estado apagado; se parametrizan con el interruptor, no se borran (memoria «el test
  que vive dentro de lo que borras»).
- **Literal contra su propia fuente**: los tests de plantilla afirman los textos literales de §3.2, no
  los recomponen llamando a la base.
- **Alcanzabilidad estática**: si el implementer olvida borrar las anotaciones, la guardia sale roja;
  correrla a mano (`pnpm exec vitest run superficie-de-uso`) porque lee `app/` con `fs` y el grafo del
  `--rapido` puede no relacionarla.
