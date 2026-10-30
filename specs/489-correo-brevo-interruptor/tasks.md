# 489 · Correo por Brevo: plantillas e interruptor — tareas

Orden: **backend (B) → frontend (F) → encendido (E)**. Zona fullstack: backend_dev hace B, frontend_dev
hace F sobre la rama con B ya commiteado. `[P]` = paralelizable con la hermana indicada.
Gate de cada tanda: `./init.sh --rapido` (no toca dinero ni datos: sin migraciones ni `lib/types/`).
La guardia `superficie-de-uso` se corre además a mano en F (lee `app/` con `fs`).

## B · Backend

- [ ] **B.1 `[P]` con B.2 — Marca y interruptor en config.**
  `lib/config/email.ts`: `nombreMarcaCorreo()` (SMTP_FROM_NAME → "Ordenex"), y `loadEmailConfig().fromName`
  la usa. Nuevo `lib/config/recuperacion-contrasena.ts` con `recuperacionContrasenaActiva()`.
  `.env.example`: `RECUPERACION_CONTRASENA_ACTIVA=` con comentario (vacío = apagado).
  **Hecho:** `tests/unit/config/email-marca.test.ts` (R2, R3) y
  `tests/unit/config/recuperacion-contrasena.test.ts` tabla `true`, `TRUE`, ` 1 `, `1` → true;
  `false`, `0`, `si`, `""`, ausente → false (R17). Verdes.

- [ ] **B.2 `[P]` con B.1 — Base común y dos plantillas.**
  `base-codigo.ts`, `codigo-inicio-sesion.ts`, `codigo-cambio-contrasena.ts` y el selector exhaustivo
  `plantillaCodigoPorProposito` según `design.md §3`. Textos literales de §3.2.
  **Hecho:** `tests/unit/services/email/plantillas-codigo.test.ts` con, al menos:
  - R1: el HTML trae cabecera, cuerpo y pie en ese orden (índices crecientes de marca, código, pie) y
    `text` no vacío contiene marca, código, «N minutos» y el aviso.
  - R2: con marca `Velox`, asunto y cuerpo dicen `Velox` y no `Ordenex`.
  - R4: la de entrar contiene «dispositivo nuevo», el código, «solo sirve una vez» y «no compartas».
  - R5: la de contraseña contiene literal «Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.».
  - R6: asuntos distintos entre sí y ninguno contiene el código.
  - R7: ningún campo (subject/html/text) casa `/\bOTP\b|\bSLA\b/i`.
  - R8: marca `A<b>&"` sale escapada en `html` y literal en `text`.
  Los literales se escriben en el test, no se recomponen con la base.

- [ ] **B.3 — El propósito atraviesa el flujo.** Depende de B.2.
  `PropositoCodigo` y `SendOtpCodeParams.proposito` en `IEmailProvider.ts`; `EmitirOtpParams.proposito`
  obligatorio y reenviado en `OtpChallengeIssuer`; `AuthService` pasa `"inicio_sesion"`,
  `PasswordResetService.solicitar` pasa `"cambio_contrasena"`.
  **Hecho:** typecheck verde; en `tests/unit/services/otp-challenge-issuer.test.ts`, que reenvía el
  propósito recibido y que sigue sin persistir ni loguear el código (R9, R11); en
  `tests/unit/services/auth-service.test.ts` la rama de riesgo alto llama a `emitir` con
  `proposito: "inicio_sesion"` (R4); en el test de `PasswordResetService` (el existente de la feature
  20) `solicitar` llama con `"cambio_contrasena"` y sigue devolviendo `{ status: "ok" }` (R5, R11).
  Ajustar `postulacion-login-regresion.test.ts` si su doble de `sendOtpCode` lo requiere.

- [ ] **B.4 — El proveedor elige la plantilla y registra el propósito.** Depende de B.1, B.3.
  `EmailNotificacionProvider(sender, marca)` según `design.md §3.4`; `crearEmailProvider` pasa
  `nombreMarcaCorreo()`; `StubEmailProvider` con la firma nueva. Borrar `otp-codigo.ts` y migrar su
  `describe("plantillaOtpCodigo")` de `tests/unit/services/email-notificacion.test.ts` a B.2.
  **Hecho:** en `email-notificacion.test.ts`:
  - con `inicio_sesion` el emisor falso recibe el asunto de entrar; con `cambio_contrasena`, el de
    contraseña (R4, R5);
  - la línea de log empieza por `[auth] OTP enviado`, incluye destinatario, propósito y minutos, y no
    contiene el código (R9, R10);
  - si el transporte lanza, se propaga y no hay línea `[auth] OTP enviado` (R11).
  Mutación de control: cambiar el `switch` para devolver siempre la de entrar pone rojo el test de
  `cambio_contrasena` (anotarlo en `progress/impl_489.md`).

- [ ] **B.5 — Umbral de riesgo documentado, no cambiado.** `[P]` con B.4.
  **Hecho:** test en `tests/unit/config/` (o el existente de `authConfig` si ya lo cubre: citarlo) que
  sin `AUTH_RISK_THRESHOLD` el umbral es 50 y con `999` es 999 (R20). `lib/config/auth.ts` sin diff de
  lógica.

- [ ] **B.6 — Gate backend.** `./init.sh --rapido` verde; commit `feat(489): plantillas de correo por propósito e interruptor de recuperación (backend)`.

## F · Frontend (depende de B.1 commiteado)

- [ ] **F.1 — `/recuperar-contrasena` obedece al interruptor.**
  `page.tsx` según `design.md §5.1`; reescribir su cabecera (§5.4).
  **Hecho:** `tests/integration/recuperar-contrasena-page.test.tsx` parametrizado:
  - apagado (env ausente) → aviso del administrador + subtítulo actual, sin campo de correo (R12);
  - encendido (`true`) → formulario (campo de correo del paso 1) + subtítulo «Recupera el acceso…»,
    sin el aviso (R13);
  - sesión válida → `redirect("/dashboard")` en los dos estados (R14).
  El `process.env` se restaura en `afterEach`.

- [ ] **F.2 — Login obedece al interruptor.** `[P]` con F.1.
  `app/login/page.tsx` lee y pasa `recuperacionActiva`; `LoginForm` según `design.md §5.2`; el bloque
  comentado se sustituye por la rama.
  **Hecho:** `tests/integration/login-form-reset-link.test.tsx` con dos `describe`:
  - sin prop / `false` → texto del administrador y cero `a[href="/recuperar-contrasena"]` (R15);
  - `true` → enlace «¿Olvidaste tu contraseña?» con `href="/recuperar-contrasena"` y sin el texto del
    administrador (R16);
  y un test de `app/login/page.tsx` (con los mocks del de recuperar) que con la env encendida el
  enlace aparece y apagada no (R16, lectura en servidor). El bloque de `LoginForm.test.tsx` ~l.497
  sigue verde sin cambios (es el estado apagado).

- [ ] **F.3 — Guardia de superficie.** Depende de F.1.
  Borrar las cuatro `@sin-superficie`: `RecuperarContrasenaForm` y `solicitarRecuperacion`,
  `verificarCodigoRecuperacion`, `restablecerContrasena`; reescribir sus cabeceras (§5.4).
  **Hecho:** `pnpm exec vitest run superficie-de-uso` verde (R19). Mutación: dejar una de las
  anotaciones la pone roja («la excepción caducó»); anotarlo en `progress/impl_489.md`.

- [ ] **F.4 — Sin variable pública.** `[P]` con F.3.
  **Hecho:** test en `tests/unit/config/recuperacion-contrasena.test.ts` (o guardia mínima) que ningún
  archivo de `app/`, `components/`, `lib/` contiene `NEXT_PUBLIC_RECUPERACION` y que `LoginForm.tsx`
  no lee `process.env` (R18).

- [ ] **F.5 — Ver la app.** Depende de F.1, F.2.
  Dev server con la env apagada y encendida: `/login` y `/recuperar-contrasena` en escritorio y móvil;
  con encendida, pedir un código de recuperación con `AUTH_OTP_DEBUG_LOG=1` y sin SMTP, y comprobar en
  la consola el asunto de «cambiar la contraseña» y la marca. Limpiar lo que deje en la base local.
  **Hecho:** capturas o descripción con números en `progress/impl_489.md`.

- [ ] **F.6 — Gate frontend.** `./init.sh --rapido` verde + guardia de F.3 a mano; commit
  `feat(489): la recuperación y su enlace se encienden con RECUPERACION_CONTRASENA_ACTIVA`.
  `progress/impl_489.md` con el mapa R1–R20 → test.

## E · Encendido (depende de F.6 y de la release a `prod`)

- [ ] **E.1 — Procedimiento escrito en `docs/release.md`** (sección «489 · encendido de recuperación y
  código de entrada»):
  1. Precondición: la 489 en `prod` con la UI de hoy (comprobar `/login` sin enlace).
  2. Vercel (team Velox, proyecto `velox`) → Environment Variables → **Production solamente**:
     crear `RECUPERACION_CONTRASENA_ACTIVA=true`; **borrar** `AUTH_RISK_THRESHOLD` (vuelve al 50).
     Confirmar que `SMTP_HOST/PORT/USER/PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME=Velox` siguen ahí.
  3. Redeploy de producción y esperar READY.
  4. Prueba real 1 — recuperación: `/login` muestra «¿Olvidaste tu contraseña?»; pedir el código para
     una cuenta real con buzón accesible; medir en los logs de Vercel
     `[auth] OTP enviado a … (cambio_contrasena)`; recibir el correo (asunto, marca Velox, aviso
     «tu contraseña sigue igual»), completar el cambio y entrar con la contraseña nueva.
  5. Prueba real 2 — código para entrar: entrar desde un navegador/dispositivo nunca usado (ventana
     privada de otro equipo); medir `[auth] OTP enviado a … (inicio_sesion)`; recibir el correo y
     entrar con el código. Si no se pide código, anotar el score del intento (`login_attempt.risk_score`)
     en vez de concluir que falla.
  6. Vuelta atrás: borrar `RECUPERACION_CONTRASENA_ACTIVA`, poner `AUTH_RISK_THRESHOLD=999`, redeploy.
  **Hecho:** sección commiteada en `docs/release.md`.

- [ ] **E.2 — Ejecutar el encendido el viernes** (humano o leader con su OK). Antes: P5 (buzón del
  usuario activo `@ordenex.co` tras el cambio de dominio).
  **Hecho:** resultado de los pasos 4 y 5 con las líneas de log y la hora, en `docs/release.md`.

## Mapa R → test

| R | Test |
| --- | --- |
| R1, R2, R4–R8 | `tests/unit/services/email/plantillas-codigo.test.ts` (B.2) |
| R2, R3 | `tests/unit/config/email-marca.test.ts` (B.1) |
| R4, R5 | `email-notificacion.test.ts` (B.4) + `auth-service.test.ts` / test de `PasswordResetService` (B.3) |
| R9 | `otp-challenge-issuer.test.ts` (B.3) + `email-notificacion.test.ts` (B.4) |
| R10 | `email-notificacion.test.ts` (B.4) |
| R11 | `otp-challenge-issuer.test.ts`, test de `PasswordResetService` (B.3), `email-notificacion.test.ts` (B.4) |
| R12–R14 | `tests/integration/recuperar-contrasena-page.test.tsx` (F.1) |
| R15, R16 | `tests/integration/login-form-reset-link.test.tsx` + test de `app/login/page.tsx` (F.2) |
| R17 | `tests/unit/config/recuperacion-contrasena.test.ts` (B.1) |
| R18 | `tests/unit/config/recuperacion-contrasena.test.ts` (F.4) |
| R19 | `tests/unit/guards/superficie-de-uso.guardia.test.ts` (F.3) |
| R20 | test de `authConfig` (B.5) |
