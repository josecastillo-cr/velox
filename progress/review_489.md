# 489 · Correo por Brevo: plantillas e interruptor — revisión

Revisor: reviewer (Opus), 2026-10-29. Rama `feat/489-correo-brevo-interruptor`, HEAD revisado `ed5a9a23`,
base del diff `a1dc0b26` (`dev`). Worktree `R:/w489`.
Búsqueda: revisión guiada por el diff (`git diff a1dc0b26..HEAD`) y lectura directa de los archivos;
no se usó el MCP `codebase-memory` (el diff ya acotaba los símbolos; los llamadores de
`emitir`/`sendOtpCode` se comprobaron por mutación, ver abajo).

## Checklist

### Especificación
- [x] `requirements.md` con R1–R20 en EARS; decisiones del humano anotadas (P1, P2, P4).
- [x] `design.md` con alternativas descartadas (§9, cuatro con su porqué).
- [ ] `tasks.md` todas `[x]`: faltan **B.6, F.6** (gate+commit: los commits existen y el leader corrió
      el completo, solo falta marcarlas), **F.5** (ver la app, asignada al leader, NO hecha) y
      **E.2** (encendido del viernes; por construcción solo después de la release a `prod`).

### Trazabilidad (R → test, comprobado leyendo cada test)

| R | Test | Estado |
| --- | --- | --- |
| R1 | `plantillas-codigo.test.ts` › base común (orden marca, código, pie en HTML y texto; texto con marca, código, minutos, aviso) | OK |
| R2 | `plantillas-codigo.test.ts` › marca; `email-marca.test.ts`; `email-notificacion.test.ts` › crearEmailProvider R2 | OK |
| R3 | `email-marca.test.ts` (ausente, vacío, en blanco → Ordenex) | OK |
| R4 | `plantillas-codigo.test.ts` › R4 (literales); `email-notificacion.test.ts` › R4; `auth-service.test.ts` (proposito inicio_sesion) | OK, mutación roja |
| R5 | `plantillas-codigo.test.ts` › R5 (aviso literal); `email-notificacion.test.ts` › R5; `password-reset-service.test.ts` (cambio_contrasena, status ok) | OK, mutación roja |
| R6 | `plantillas-codigo.test.ts` › asuntos (distintos, sin código) | OK |
| R7 | `plantillas-codigo.test.ts` › sin siglas (regex OTP/SLA en subject, html y text) | OK |
| R8 | `plantillas-codigo.test.ts` › escapado (marca con marcado y código con script) | OK, mutación roja |
| R9 | `otp-challenge-issuer.test.ts` (persistido sin código, hash bcrypt); `email-notificacion.test.ts` › R9/R10 (info, log y warn sin el código) | OK |
| R10 | `email-notificacion.test.ts` › R9/R10 (línea exacta por propósito) | OK |
| R11 | `otp-challenge-issuer.test.ts`; `email-notificacion.test.ts` › R11 (propaga, sin línea); `password-reset-service.test.ts` | OK |
| R12 | `recuperar-contrasena-page.test.tsx` › apagado (ausente, false, vacío, si) | OK |
| R13 | `recuperar-contrasena-page.test.tsx` › encendido (true, 1) | OK |
| R14 | `recuperar-contrasena-page.test.tsx` › sesión activa (apagado y encendido) | OK |
| R15 | `login-form-reset-link.test.tsx` › apagado; `login-page-recuperacion.test.tsx` (ausente, false) | OK |
| R16 | `login-form-reset-link.test.tsx` › encendido; `login-page-recuperacion.test.tsx` (env true → enlace, página real) | OK |
| R17 | `recuperacion-contrasena.test.ts` (tabla) + casos de la página | OK |
| R18 | `recuperacion-contrasena.test.ts` › R18 (sin NEXT_PUBLIC_RECUPERACION, con control de no-vacuidad; LoginForm.tsx sin process.env) | OK |
| R19 | `superficie-de-uso.guardia.test.ts` (mutación del implementer: reponer una anotación sin-superficie → rojo) | OK |
| R20 | `auth-config.test.ts` › R20 (50 y 999); `auth-service.test.ts` › umbral real (RiskEngine real: 999 no emite, 50 sí) | OK |

- [x] `progress/impl_489.md` contiene el mapa R → test (backend y frontend).

### Puntos pedidos por el leader

1. **Trazabilidad R1–R20:** completa (tabla de arriba); ningún test vacío encontrado.
2. **Código en claro fuera de logs/DB y del asunto:** `OtpChallengeIssuer` solo persiste `codeHash`;
   `EmailNotificacionProvider` loguea destinatario, propósito y minutos; los asuntos ya no llevan el
   código. A favor: antes el asunto (`Tu codigo de verificacion: 123456`) llegaba al log de
   `ConsoleEmailSender` (campo asunto) cuando no había SMTP; con la 489 esa fuga desaparece.
   El cuerpo solo se imprime con `AUTH_OTP_DEBUG_LOG=1` (preexistente, documentado).
3. **UI según el interruptor:** apagado, el JSX es el de hoy (mismo párrafo y clase en el login; mismo
   subtítulo; `RecuperacionDesactivadaAviso` sin cambios de JSX, solo cabecera). Encendido monta
   `RecuperarContrasenaForm` + subtítulo «Recupera el acceso…» y el enlace del login. El flag se lee
   en `app/login/page.tsx` y `app/recuperar-contrasena/page.tsx` (Server Components que llaman a
   `cookies()`, por tanto dinámicos: no se congela en el build) y viaja como prop; `LoginForm` no lee env.
4. **Propósito desde los servicios — mutaciones (todas restauradas, árbol limpio):**
   - `AuthService` con cambio_contrasena y `PasswordResetService` con inicio_sesion: **3 rojos**
     (`password-reset-service` R2/R4, `auth-service` R17 y R20 con umbral 50).
   - `OtpChallengeIssuer` reenviando siempre inicio_sesion: **1 rojo** (`otp-challenge-issuer`).
   - Del implementer: el switch del selector devolviendo siempre la de entrar → 3 rojos (en impl).
5. **Guardia `html-lang`:** censo 4→5 con `base-codigo.ts` y su porqué. Mutación de lang es→en
   en la base → **rojo** («los cinco documentos completos y su censo»). `superficie-de-uso` verde.
6. **Escapado HTML:** `escaparHtml` cubre ampersand, menor, mayor y comillas dobles, y se aplica a
   marca, título, introducción (que lleva la marca), código, vencimiento, aviso y pie. Mutación
   quitando el escapado de la marca de la cabecera → **2 rojos** (R8 en las dos plantillas). El
   asunto lleva la marca sin escapar, correcto (cabecera de texto, no HTML).
7. **`docs/release.md`:** la sección «489 · encendido» crea solo `RECUPERACION_CONTRASENA_ACTIVA=true`
   en Production; el paso 3 dice explícitamente que `AUTH_RISK_THRESHOLD=999` se mantiene; la prueba
   real comprueba que el login no pidió código; vuelta atrás = borrar la variable + redeploy.

### Calidad de código
- [x] typecheck / lint: verdes según bitácora y el gate completo del leader.
- [x] Tests corridos por mí: 15 archivos (los de la feature + `LoginForm`/`LoginPage` + guardias
      `html-lang` y `superficie-de-uso`): **15/15 archivos, 159/159 tests**, 0 saltados.
- [n/a] E2E Playwright: toca auth, pero el repo no tiene harness E2E; el riesgo de UI lo cubren los
      tests de página reales y F.5 (ver la app).

### Datos y seguridad
- [n/a] Sin tablas nuevas ni migraciones.
- [x] Sin secretos; la variable nueva va en `.env.example` vacía y sin prefijo `NEXT_PUBLIC_`.
- [n/a] Sin webhooks.

### Capas / permisos / multi-país
- [x] Config en `lib/config/`, tipo en `lib/interfaces/external/`, plantillas puras en
      `lib/services/email/plantillas/`; los servicios no conocen HTTP.
- [x] Las páginas leen el flag en servidor; el componente de cliente lo recibe por props.
- [x] La marca sale de `SMTP_FROM_NAME` (`Ordenex` solo como valor por defecto).

### Verificación final
- `./init.sh --rapido` sobre `ed5a9a23`: se **niega** (`INIT_EXIT=1`) porque el diff toca
  `.env.example`, cuyo radio es todo el repo, y exige el completo. Ese completo ya lo corrió el leader
  sobre `ed5a9a23` (`progress/gate_489_completo.log`): 2512/2513 archivos, 34.253 verdes, 26 saltados
  (no se saltó `integration/db`), 1 rojo `ranking-snapshot-migration` (bloque C, deadlock 40P01,
  ajeno a la 489), que aislado pasa 49/49 (`progress/rerun_489_ranking.log`). Se acepta como flake
  conocido; no se repitió el completo.
- [ ] Entrada en `progress/history.md`: pendiente del cierre.

## Hallazgos

1. `menor` — **F.5 (ver la app) sin hacer.** Nadie levantó el dev server con la variable apagada y
   encendida. Riesgo bajo (apagado es el JSX de hoy; encendido es el bloque previo restaurado y lo
   cubren tests de página reales), pero es tarea del spec. **Condición antes del merge** (leader).
2. `menor` — **B.6 y F.6 sin marcar** en `tasks.md`, aunque los commits existen y el gate completo
   está corrido. Marcar al cerrar.
3. `menor` — **E.2** abierta por diseño hasta el encendido del viernes; la ficha no pasa a `done`
   hasta anotar el resultado en `docs/release.md`.
4. `menor` — R9 de extremo a extremo con `ConsoleEmailSender` real + plantilla real no tiene test
   propio (el de `crearEmailProvider` mockea `enviar`); queda cubierto por R6 (asunto sin código) +
   el test del emisor de consola sin flag. No exige cambio.

Ningún hallazgo bloqueante en el código.

## Veredicto

**OK** (código y trazabilidad). Antes de mergear: hacer F.5 y marcar B.6/F.6. E.2 tras la release.
