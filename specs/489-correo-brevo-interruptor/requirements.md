# 489 · Correo por Brevo: plantillas propias e interruptor de la recuperación — requisitos

> Zona: fullstack · Complejidad: media · Rama: `feat/489-correo-brevo-interruptor`
> Spec escrito sobre `dev` @ `dde63fd1` (2026-10-29).

## Contexto (medido, no supuesto)

- El correo saliente ya va por Brevo (SMTP). En Production están `SMTP_HOST/PORT/USER/PASSWORD`,
  `SMTP_FROM=no-reply@velox-courier.company` y `SMTP_FROM_NAME=Velox`; hubo una entrega real.
  `lib/config/email.ts` ya lee `SMTP_FROM_NAME` (por defecto `"Ordenex"`).
- Hoy la app envía UN solo correo: el código de 6 dígitos de `lib/services/email/plantillas/otp-codigo.ts`,
  con «Ordenex» escrito a fuego y sin tildes. Lo comparten dos flujos que no se distinguen:
  1. **Inicio de sesión con riesgo alto** (`AuthService` → `OtpChallengeIssuer.emitir`).
  2. **Recuperación de contraseña** (`PasswordResetService.solicitar` → `OtpChallengeIssuer.emitir`).
- Los dos están apagados desde 2026-09:
  - el código de inicio de sesión, con `AUTH_RISK_THRESHOLD=999` en Production (por defecto 50);
  - la recuperación, en la UI: `app/recuperar-contrasena/page.tsx` monta `RecuperacionDesactivadaAviso`
    en vez de `RecuperarContrasenaForm`, y `LoginForm.tsx` muestra un texto que manda al administrador
    en lugar del enlace. El formulario y las tres Server Actions de `lib/actions/password-reset.ts`
    llevan hoy la anotación `@sin-superficie` que exige la guardia
    `tests/unit/guards/superficie-de-uso.guardia.test.ts`.
- Plan del humano: desplegar con todo apagado (cero cambio visible) y encender el viernes 2026-10-30
  **solo la recuperación** con variables de entorno + redeploy, sin tocar código.
- Decisión del humano (2026-10-30): el código de inicio de sesión **sigue apagado de forma
  indefinida** (`AUTH_RISK_THRESHOLD=999` se mantiene) porque varios usuarios no tienen acceso a su
  correo (p. ej. `mensajero@ordenex.co` no existe): encenderlo los dejaría fuera de la app. Su
  plantilla se escribe igual, porque el flujo existe y la usaría si algún día se enciende.

Glosario de este documento: «código para entrar» = correo del código de inicio de sesión;
«código para cambiar la contraseña» = correo del código de recuperación; «interruptor» = la variable
`RECUPERACION_CONTRASENA_ACTIVA`; «encendido» = su valor es `true` o `1` (sin distinguir mayúsculas,
con espacios alrededor ignorados); cualquier otro valor, vacío o ausencia = «apagado».

## A · Plantillas de correo

- **R1** — El sistema DEBE componer cada correo de código sobre una base común que contenga, en este
  orden, una cabecera con la marca, un cuerpo y un pie; y DEBE entregar siempre, junto al HTML, una
  versión en texto plano que contenga la marca, el código, el vencimiento en minutos y el aviso de
  «si no fuiste tú» del correo correspondiente.
- **R2** — El sistema DEBE mostrar como marca, en el cuerpo y en el asunto de los correos de código, el
  nombre de remitente configurado (`SMTP_FROM_NAME`).
- **R3** — SI `SMTP_FROM_NAME` no está configurado o está vacío, ENTONCES el sistema DEBE usar como marca
  `Ordenex` (el valor por defecto vigente).
- **R4** — CUANDO se emite un código porque un inicio de sesión exige verificación, el sistema DEBE
  enviar el correo «código para entrar», que dice que el código sirve para entrar a la cuenta desde un
  dispositivo nuevo, muestra el código, cuántos minutos dura, que solo sirve una vez, y que si no fue
  la persona quien intentó entrar no comparta el código con nadie.
- **R5** — CUANDO se emite un código porque alguien pidió recuperar la contraseña, el sistema DEBE enviar
  el correo «código para cambiar la contraseña», que muestra el código, cuántos minutos dura, que solo
  sirve una vez, y el aviso «Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.».
- **R6** — El sistema DEBE usar un asunto distinto para cada uno de los dos correos, y ningún asunto
  DEBE contener el código (ver P1).
- **R7** — El sistema NO DEBE mostrar en el asunto, el HTML ni el texto plano de los correos de código
  las siglas `OTP` ni `SLA`; DEBE llamarlo «código».
- **R8** — El sistema DEBE escapar en el HTML todo valor interpolado (marca y código), de modo que un
  `<`, `>`, `&` o `"` en `SMTP_FROM_NAME` aparezca como texto y no como marcado.
- **R9** — El sistema NO DEBE escribir el código en claro en ningún log ni en la base de datos, para
  ninguno de los dos correos; en base solo se persiste su hash, como hoy.
- **R10** — CUANDO un correo de código se entrega al transporte sin error, el sistema DEBE registrar una
  línea de log que empiece por `[auth] OTP enviado` e incluya el destinatario, el propósito
  (`inicio_sesion` o `cambio_contrasena`) y los minutos de vencimiento, y nada más del mensaje.
- **R11** — El sistema DEBE mantener sin cambios, para los dos propósitos, la generación del código
  (6 dígitos), su vencimiento (`AUTH_OTP_TTL_MINUTES`), su persistencia hasheada, la propagación de un
  fallo del transporte y la respuesta genérica `ok` del paso 1 de la recuperación.

## B · Interruptor de la recuperación de contraseña

- **R12** — MIENTRAS el interruptor esté apagado, cuando no haya sesión válida `/recuperar-contrasena`
  DEBE mostrar exactamente lo de hoy: el aviso que manda a pedir el restablecimiento a un administrador
  y el subtítulo «Te ayudamos a volver a entrar a tu cuenta.», y NO DEBE mostrar el formulario.
- **R13** — MIENTRAS el interruptor esté encendido, cuando no haya sesión válida `/recuperar-contrasena`
  DEBE mostrar el formulario de recuperación de tres pasos y el subtítulo «Recupera el acceso a tu
  cuenta de forma segura», y NO DEBE mostrar el aviso del administrador.
- **R14** — CUANDO se abre `/recuperar-contrasena` con una sesión válida, el sistema DEBE redirigir a
  `/dashboard`, esté el interruptor encendido o apagado.
- **R15** — MIENTRAS el interruptor esté apagado, la pantalla de inicio de sesión DEBE mostrar el texto
  «¿Olvidaste tu contraseña? Pídele a un administrador que te la restablezca.» y NO DEBE contener
  ningún enlace hacia `/recuperar-contrasena`.
- **R16** — MIENTRAS el interruptor esté encendido, la pantalla de inicio de sesión DEBE mostrar un enlace
  «¿Olvidaste tu contraseña?» hacia `/recuperar-contrasena` y NO DEBE mostrar el texto que manda al
  administrador.
- **R17** — SI el interruptor tiene un valor distinto de `true`/`1` (incluidos `false`, `0`, `si`,
  vacío o ausente), ENTONCES el sistema DEBE comportarse como apagado.
- **R18** — El sistema DEBE leer el interruptor solo en el servidor; NO DEBE exponerlo al navegador como
  variable pública (`NEXT_PUBLIC_*`).
- **R19** — El sistema DEBE mantener verde la guardia `superficie-de-uso`: con la página capaz de montar
  el formulario, ni `RecuperarContrasenaForm` ni las acciones `solicitarRecuperacion`,
  `verificarCodigoRecuperacion` y `restablecerContrasena` conservan la anotación `@sin-superficie`, y
  `RecuperacionDesactivadaAviso` sigue alcanzable.

## C · Código de inicio de sesión (sigue apagado; solo se documenta)

- **R20** — El sistema DEBE conservar la regla vigente del umbral de riesgo: SI `AUTH_RISK_THRESHOLD` vale
  `999`, ENTONCES ningún inicio de sesión exige código; y SI no está configurado, ENTONCES el umbral es
  50. Esta feature no cambia cómo se calcula el riesgo ni cuándo se exige el código, y en Production
  `AUTH_RISK_THRESHOLD=999` se mantiene (decisión del humano, 2026-10-30).

## Fuera de alcance

- Correos nuevos (p. ej. «tu contraseña cambió», «nuevo inicio de sesión»): ver P3.
- Cambios al modelo de autenticación, al cálculo de riesgo o a los límites de solicitudes.
- Encender el código de inicio de sesión: queda apagado indefinidamente (`AUTH_RISK_THRESHOLD=999`).
  Su interruptor ya existe (borrar la variable) y no se toca; su correo no se prueba en producción.
- El procedimiento de encendido del viernes no es un requisito testeable: vive como tarea final en
  `tasks.md` y en `docs/release.md`.

## Preguntas abiertas

- **P1 — ¿El código va en el asunto?** El correo de hoy lo lleva (`Tu codigo de verificacion: 123456`).
  Este spec lo saca (R6) porque el asunto se ve en la notificación del teléfono con la pantalla
  bloqueada. Si el humano prefiere tenerlo en el asunto (comodidad para copiarlo), R6 se invierte; es
  una línea en cada plantilla.
- **P2 — Aviso «si no fuiste tú» del correo para entrar.** R4 solo dice «no compartas el código». Si
  alguien recibe ese correo sin haber intentado entrar, es que tiene su contraseña; recomendar
  «cámbiala» depende de que la recuperación esté encendida, y el texto no puede saber eso. ¿Se añade
  «avisa a la oficina»? Decisión del humano; no se inventa.
- **P3 — Correo «tu contraseña cambió».** Útil como alarma de un cambio no pedido. Queda fuera por
  instrucción; si el humano lo quiere, es una ficha aparte.
- **P4 — Ayuda y asistente.** `docs/ayuda/publico/entrar-y-recuperar-contrasena.md` ya describe el
  flujo ENCENDIDO (pedir código, escribirlo, nueva contraseña) también hoy, con la recuperación
  apagada. Es contenido estático y no puede seguir al interruptor. ¿Se deja así (será correcto desde
  el viernes) o se añade una línea condicional? Este spec no lo toca.
- ~~**P5 — Buzón del usuario activo `@ordenex.co`**~~ **Resuelta (2026-10-30):** el humano decidió no
  encender el código de inicio de sesión porque varios usuarios no tienen buzón real; con eso nadie
  queda bloqueado en el login por su correo. La recuperación solo envía a quien la pide.
- **P6 — Logo en la cabecera.** La base usa la marca como texto. Un logo por imagen exigiría una URL
  pública por marca que hoy no está en la config. Se deja como texto salvo que el humano dé la URL.
