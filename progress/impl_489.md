# 489 · Correo por Brevo: plantillas e interruptor — bitácora de implementación

## Backend (B.1–B.5) — backend_dev, 2026-10-29

Rama `feat/489-correo-brevo-interruptor` sobre `408ecc4a`. Sin migraciones, sin `lib/types/`, sin UI.
Búsqueda de código: MCP `codebase-memory` (proyecto `R-job-singularis-projects-ordenex`) para
llamadores de `emitir`/`sendOtpCode`; `grep` para confirmar en el árbol real.

### Archivos

Creados:
- `lib/config/recuperacion-contrasena.ts` — `recuperacionContrasenaActiva()` (B.1).
- `lib/services/email/plantillas/base-codigo.ts` — `componerCorreoCodigo`, `escaparHtml` (B.2).
- `lib/services/email/plantillas/codigo-inicio-sesion.ts` — «código para entrar» (B.2).
- `lib/services/email/plantillas/codigo-cambio-contrasena.ts` — «código para cambiar la contraseña» (B.2).
- `lib/services/email/plantillas/index.ts` — `plantillaCodigoPorProposito`, switch exhaustivo con `never` (B.2).
- `tests/unit/config/email-marca.test.ts`, `tests/unit/config/recuperacion-contrasena.test.ts`,
  `tests/unit/services/email/plantillas-codigo.test.ts`.

Modificados:
- `lib/config/email.ts` — `nombreMarcaCorreo()`; `loadEmailConfig().fromName` la usa (una sola fuente).
- `.env.example` — `RECUPERACION_CONTRASENA_ACTIVA=` documentada (vacía = apagado).
- `lib/interfaces/external/IEmailProvider.ts` — `PropositoCodigo`; `SendOtpCodeParams.proposito` obligatorio.
- `lib/services/OtpChallengeIssuer.ts` — `EmitirOtpParams.proposito` obligatorio, reenviado tal cual.
- `lib/services/AuthService.ts` — `proposito: "inicio_sesion"`.
- `lib/services/PasswordResetService.ts` — `proposito: "cambio_contrasena"`.
- `lib/services/EmailProvider.ts` — `EmailNotificacionProvider(sender, marca)`, plantilla por propósito,
  log `[auth] OTP enviado a <to> (<proposito>), expira en N min` DESPUÉS de enviar; `crearEmailProvider`
  pasa `nombreMarcaCorreo()`; `StubEmailProvider` con la firma nueva (log con propósito, sin código).
- Tests: `email-notificacion.test.ts` (describe `plantillaOtpCodigo` migrado a plantillas-codigo),
  `otp-challenge-issuer.test.ts`, `auth-service.test.ts`, `password-reset-service.test.ts`,
  `tests/unit/config/auth-config.test.ts`.
- `tests/unit/guards/html-lang.guardia.test.ts` — el censo de documentos HTML completos pasa de 4 a 5:
  la base del correo es un documento con `<html lang="es">`. La guardia se puso roja al aparecer, que
  es lo que su cabecera promete; se añade al censo con su porqué.

Borrado: `lib/services/email/plantillas/otp-codigo.ts` (no quedan referencias fuera de specs/).

`lib/config/auth.ts` y `lib/services/RiskEngine.ts`: sin diff (B.5).
`postulacion-login-regresion.test.ts`: no necesitó cambios (su doble es `{ sendOtpCode: vi.fn() }`).

### Mapa R → test (parte backend)

| R | Test |
| --- | --- |
| R1 | `plantillas-codigo.test.ts` › «base común (R1)» (orden marca < código < pie en HTML y en texto; texto con marca, código, minutos, aviso) |
| R2 | `plantillas-codigo.test.ts` › «marca (R2)»; `email-marca.test.ts` › R2; `email-notificacion.test.ts` › crearEmailProvider R2 |
| R3 | `email-marca.test.ts` › R3 (ausente, vacío, en blanco → Ordenex) |
| R4 | `plantillas-codigo.test.ts` › R4; `email-notificacion.test.ts` › R4; `auth-service.test.ts` › R17 (`proposito: "inicio_sesion"`) |
| R5 | `plantillas-codigo.test.ts` › R5 (aviso literal); `email-notificacion.test.ts` › R5; `password-reset-service.test.ts` › R2/R4 (`proposito: "cambio_contrasena"`, `{ status: "ok" }`) |
| R6 | `plantillas-codigo.test.ts` › «asuntos (R6)» |
| R7 | `plantillas-codigo.test.ts` › «sin siglas (R7)» |
| R8 | `plantillas-codigo.test.ts` › «escapado (R8)» (marca `A<b>&"` y código) |
| R9 | `otp-challenge-issuer.test.ts` (persistido sin `code` ni `proposito`, hash bcrypt válido; consola sin código); `email-notificacion.test.ts` › R9/R10 |
| R10 | `email-notificacion.test.ts` › R9/R10 (línea exacta por propósito) |
| R11 | `otp-challenge-issuer.test.ts` (6 dígitos, TTL de config, hash; propaga fallo del proveedor); `email-notificacion.test.ts` › R11 (propaga y no loguea); `password-reset-service.test.ts` (`ok`) |
| R17 | `recuperacion-contrasena.test.ts` (true/TRUE/" 1 "/1 → true; false/0/si/""/blanco/ausente → false) |
| R20 | `auth-config.test.ts` › R20 (50 por defecto, 999); `auth-service.test.ts` › «umbral de riesgo real» (RiskEngine real: 999 no emite, 50 exige código para entrar) |

R12–R16, R18, R19: frontend (F.*), pendientes.

### Mutación de control (B.4)

`plantillaCodigoPorProposito` con `case "cambio_contrasena"` devolviendo la de entrar →
3 rojos: `email-notificacion.test.ts` › R5, › crearEmailProvider R2, y
`plantillas-codigo.test.ts` › «cambio_contrasena elige el correo de la contraseña». Restaurado → 29/29 verdes.

### Verificación (salida real)

- `pnpm typecheck` → `tsc --noEmit`, exit 0.
- `pnpm lint` → exit 0, `0 errors, 235 warnings` (preexistentes; `eslint` sobre los archivos tocados: «No issues found»).
- `pnpm exec vitest related --run <17 archivos tocados>` → `Test Files 64 passed (64) · Tests 688 passed | 26 skipped (714)`.
  Los 9 archivos de test propios/editados, en verbose: `Tests 85 passed (85)`, cero saltados.
- `pnpm exec vitest run tests/unit/guards` (las guardias leen `lib/` con `fs` y el grafo no las relaciona):
  primera pasada 1 rojo (`html-lang`, censo 4→5, ver arriba); tras actualizar el censo, `html-lang` 3/3.
  `superficie-de-uso` verde.
- No se corrió `./init.sh` (B.6 queda para el leader).

**Veredicto backend:** B.1–B.5 hechas y en verde (typecheck, lint, related, guardias); B.6 (gate `--rapido`) pendiente del leader.
