# 490 — Páginas legales · revisión (reviewer, 2026-10-30)

Rama `feat/490-paginas-legales`, diff `5383a616..52f2d706` (e69ad13c queda fuera: solo
`progress/traspaso_meta_whatsapp.md`). Herramienta de búsqueda: el MCP `codebase-memory` NO conectó
(CONNECT_TIMEOUT); todo se verificó leyendo directamente los archivos reales y el diff.

Por orden del leader NO corrí gate, tests ni `./init.sh`: el gate COMPLETO corre en paralelo en este
árbol (`progress/gate_490_completo.log`, aún sin `INIT_EXIT` al escribir esto). Lo ejecutable de
este informe es lectura de código y de tests, no medida propia.

## Veredicto: RECHAZADA

Un bloqueante, de proceso y barato (B1). El código, la seguridad del middleware y la trazabilidad
están bien. Además el veredicto queda **condicionado** a que `gate_490_completo.log` termine en
`INIT_EXIT=0` con 0 rojos atribuibles a la 490 y los `skipped` revisados.

## Checklist

### Especificación
- [x] `requirements.md` con R1-R22 en EARS.
- [x] `design.md` con 5 alternativas descartadas y su porqué.
- [ ] **`tasks.md` con todas las tasks `[x]`: 0 de 17 marcadas** (B1).

### Trazabilidad (R → test, leídos uno a uno)
- [x] R1, R2, R3, R4 → `tests/unit/auth/middleware-paginas-legales.test.ts`: importa el `middleware`
  real, mockea solo `isSessionActive`; sin cookie y con cookie válida/inválida: 200, sin `location`,
  sin consulta; `/privacidad-admin`, `/eliminacion-datosx`, `/privacidadx`: 307 a `/login` con
  `redirect`. La mutación del implementador (quitar las rutas → 6 rojos) es coherente con el test.
- [x] R5 → `paginas-legales.test.tsx` (`renderToStaticMarkup` de cuerpos y de las `page.tsx` reales,
  sin `<script`) + guardia (sin `"use client"`).
- [x] R6 → `paginas-legales-estaticas.guardia.test.ts` (`force-static`, sin `next/headers`,
  `cookies(`, `@/lib/db`, `searchParams`), con autocomprobación de cada detector.
- [x] R7 → «page.tsx — metadata…» con `vi.doMock` de marca ficticia y `null`.
- [x] R8 → un `<h1>` en cada cuerpo.
- [x] R9, R10, R11 → literales del spec, no la fuente del componente.
- [x] R12 → finalidades por sección (`h2` + `h3` «Para qué se usan» + `li` literales).
- [x] R13, R14, R17, R19, R20 → datos ficticios `*-PRUEBA` y `null`; `dt`/`dd`; enlaces cruzados.
- [x] R15, R16, R21 → `mailto:` exacto, lista exacta de lo que incluir, sin `mailto:` con `null`.
- [x] R18 → guardia de literales (`Ordenex`/`Velox`/correo) + cuerpos sin `DATOS_LEGALES`.
- [x] R22 → `tests/components/LandingFooter.test.tsx` (enlaces y columna «Legal»).
- [x] `progress/impl_490.md` contiene el mapa R → test.

### Calidad de código
- [~] typecheck / lint / tests: el `--rapido` del implementador salió `INIT_EXIT=1` porque
  `middleware.ts` está en `RUTAS_GLOBALES` (`init.sh:212`) y exige el completo; los pasos sueltos
  del log dan typecheck 0, lint 0, 141 + 3.769 tests verdes, 0 skipped. **No verificado por mí**;
  depende del completo en curso.
- [n/a] E2E: no es flujo crítico, y el repo no tiene harness E2E.

### Datos y seguridad
- [n/a] Sin tablas, migraciones, webhooks ni Server Actions nuevas.
- [x] Sin secretos. Los datos legales son públicos y van como literal en un solo módulo
  (alternativa 1 del design, justificada).

### Capas / permisos / multi-país
- [x] Sin capas de servidor nuevas. Los cuerpos reciben datos por prop; `page.tsx` es el único sitio
  que une config y cuerpo.
- [x] Páginas públicas a propósito; no leen `cookies()` ni datos de nadie.
- [~] Literales «Costa Rica» y «Ley 8968» en el texto: es contenido legal del responsable, no
  contexto de negocio configurable. Aceptable para Ordenex; ver m7 (SaaS derivado).

## Revisión dirigida (los 5 puntos del leader)

**(1) Trazabilidad.** Completa: los 22 R tienen al menos un test que de verdad lo comprueba
(arriba). Ningún test es vacuo. R20 se prueba con valores ficticios y no con los reales, y R9-R16
contra literales, como pide el design §8.

**(2) Middleware: público y nada más.** Correcto. Las dos entradas pasan por `matches()` (igualdad o
prefijo `ruta + "/"`), así que `/privacidad-admin` y `/eliminacion-datosx` siguen privadas, y el
test R4 lo fija. Las rutas viven en la raíz de `app/`, fuera de `(app)`, sin layout que resuelva
sesión, y la raíz `app/layout.tsx` no lee `cookies`/`headers`. Las páginas no importan ninguna
Server Action (solo `LandingFooter`, `Link`, `VolverAlInicioLink` —Server Component— y las primitivas
de la landing), así que la ruta pública no da una puerta nueva a acciones. Lo único que queda abierto
es que cualquier `/privacidad/*` o `/eliminacion-datos/*` futura nacería pública (m6). Es el mismo
mecanismo que ya usan `/login` y `/postulacion`; hoy no hay subrutas.

**(3) Guardia de la 229 (`rastreo-sin-ruta-nueva`).** Cambio correcto y sin debilitar nada. Esa
guardia compara `PUBLIC_ROUTES` posicionalmente contra una lista FIRMADA, y la única forma legítima
de añadir una ruta pública es firmarla allí, que es lo que se hizo: las dos entradas, en el mismo
orden que en `middleware.ts`, con su motivo. No se tocaron la comparación por posición ni la
contraprueba (`/rastreo` plantado), ni el control de no-vacuidad, ni la regla de `/` por igualdad
exacta, ni las otras dos listas. Que no figure en el design §2 es un hueco del design (m4), no del
código. Detalle de estilo: el comentario de la línea 51 pasa de 100 columnas (lint verde según el
log).

**(4) Datos personales del gerente.** No aparecen. En lo que se publica (`app/_legal/**`,
`app/privacidad`, `app/eliminacion-datos`, `LandingFooter`) no hay nombre, cédula personal ni
teléfono del gerente. La única «José» del árbol publicado es «San José» (provincia). La cédula que
sale es la jurídica `3-102-965944`. El test «no publica datos personales del gerente» solo busca las
palabras `gerente`/`apoderado`, no el nombre ni la cédula personal: es una red débil (m5). Lo
verifiqué yo leyendo los archivos. Nota para el humano: el domicilio publicado
(«…casa a mano derecha con rótulo Tiendas Battos») es el domicilio social del Registro y lo decidió
él. Si esa casa es además vivienda de una persona física, conviene que lo confirme a sabiendas.

**(5) Lo que el texto afirma frente a `db/schema.prisma`.** Cada categoría listada existe en el
esquema: `Orden.destinatario/telefonoDest/direccion/provinciaId/cantonId/distritoId/latitud/longitud/notas/producto/montoCobrar`,
`ChatMensaje` (cuerpo, lat/lng, contactos, `media*` como referencia), `GestionOrdenEvidencia`,
`OrdenIncidenteEvidencia`, `Usuario.*`, `MensajeroDocumento` (5 tipos), `GestionOrden.ubicacionLat/Lng`,
`LoginAttempt.ipAddress/userAgent`, `TrustedDevice.ipAddress`, `PostulacionRecurso`. No hay ninguna
afirmación falsa que haga daño. Sí hay imprecisiones y omisiones, todas menores (m1-m3).

## Hallazgos

### BLOQUEANTE
- **B1 — `tasks.md` sin marcar y T9.2 sin resolver.** CHECKPOINTS exige todas las tasks `[x]`. Hay
  17 `[ ]` y ningún `[x]`, cuando según `impl_490.md` T1-T8, T9.1 y T9.3 están hechas. Además
  **T9.2** (`curl -i` sin cookie y con `-A "facebookexternalhit/1.1"` a las dos rutas, más la
  captura) no se hizo. Es la única prueba de que el servidor Next real (middleware + `force-static`
  + build) entrega 200 y el texto al rastreador de Meta, que es el motivo de la ficha. Los tests
  unitarios cubren el middleware y el render por separado, no la cadena entera. Para cumplirlo:
  marcar `[x]` lo hecho; para T9.2, o se hace (dev server, o build más start, sin pisar otro dev
  server), o el leader la mueve EXPLÍCITAMENTE a tras-merge junto con T9.4 (curl contra preview),
  dejando la decisión escrita en `tasks.md`. En los dos casos la URL no se entrega a Meta sin ese
  curl.

### menor
- **m1 — «navegador de… los dispositivos de confianza».** `TrustedDevice` no guarda el navegador en
  claro: guarda `deviceHash` (hash de UA + atributos, «nunca PII cruda») e `ipAddress`. Afirma de más,
  no de menos, y repite el texto de R10. Mejor: «dirección IP y navegador de los intentos de ingreso,
  y una huella cifrada del dispositivo de confianza».
- **m2 — Lista de terceros incompleta.** Falta **Anthropic**: `/api/asistente` →
  `lib/clients/anthropic-asistente.ts` envía a `api.anthropic.com` las preguntas que escriben los
  usuarios internos. Brevo se nombra y la 489 está desplegada apagada. El canal es SMTP
  configurable (`lib/config/email.ts`, por defecto Gmail), así que el proveedor real depende de la
  variable de entorno. Conviene confirmarlo con el humano (Brevo o Google). Las suscripciones Web
  Push pasan por el servicio push del navegador; es técnico y es opcional nombrarlo.
- **m3 — Categorías no listadas.** El texto se presenta como «qué datos personales guarda la
  aplicación», pero no menciona registros ligados a personas que el esquema sí guarda: movimientos
  de dinero y pagos a mensajeros y tiendas (`PagoMensajeroMovimiento`, `WalletTiendaMovimiento`,
  comprobantes en `WalletComprobante`), evidencias de devolución a tienda (`DevolucionTiendaEvidencia`),
  el historial de acciones de cada usuario (`HistorialAccion`) y la IP del reto OTP
  (`EmailOtpChallenge`). No es una afirmación falsa, pero sí una omisión en un texto legal. Decide el
  humano o el spec_author (encaja con el abierto 8, conservación).
- **m4 — Spec por detrás del código (pendiente del spec_author, no de este rechazo).** El humano
  decidió después del spec: razón social y cédula 3-102-965944 S.R.L., marca Velox Courier, correo
  battos.sa@gmail.com, domicilio en Aserrí, plazo de 30 días, terceros nombrados, Ley 8968 y el pie de
  la landing leyendo los mismos datos. Hay que reflejarlo en:
  `requirements.md` (cerrar los abiertos 1-3, 5-7, 9-11 y crear R<n> para domicilio, plazo, terceros,
  marco legal y la línea de copyright del pie, que hoy solo prueban tests con rótulo «T8» y sin R),
  `design.md` §2 (`metadata-legal.ts`, el cambio en la guardia 229, la línea de copyright del pie,
  que contradice «el resto del pie no se toca»), §3 («Lo que la página NO afirma») y §5 (campos
  `domicilio` y `plazoRespuesta`).
- **m5 — Red débil del «sin gerente».** El test busca `gerente`/`apoderado`. No cazaría el nombre ni
  la cédula personal. Si se quiere red de verdad, que busque el patrón de cédula física (un número,
  guion, cuatro números, guion, cuatro números) en el HTML de las `page.tsx` reales.
- **m6 — Subrutas nacen públicas.** Por `matches()`, todo lo que cuelgue de `/privacidad/` o de
  `/eliminacion-datos/` es público. Hoy no hay nada. Si se quiere cerrar, basta un comentario en
  `PUBLIC_ROUTES` o una línea en la guardia 490 que exija que esos directorios solo tengan `page.tsx`.
- **m7 — Marca mixta en la página.** La cabecera dice «Velox Courier» y el pie (`LandingFooter`)
  sigue pintando el wordmark `Logo` «Ordenex». El revisor de Meta verá las dos marcas. El
  implementador ya lo anotó como fuera de alcance. «Ley 8968» y «Costa Rica» son literales: en el SaaS
  derivado multi-país habrá que pasarlos a la fuente única.
- **m8 — `feature_list.json` 490 `status_note` rancio.** Sigue listando como abiertos razón social,
  cédula, correo, marca y texto propio/básico, que ya están cerrados.
- **m9 — Guardia 490 fuera del grafo.** Lee con `fs`; hay que correrla a mano por nombre
  (`pnpm exec vitest run paginas-legales`) en cada cambio a `app/_legal/`. Ya está documentado en el
  design §9 y en `impl_490.md`.

## Qué falta para OK
1. B1: `tasks.md` al día y T9.2 hecha o diferida explícitamente por el leader.
2. `progress/gate_490_completo.log` con `INIT_EXIT=0` y los `skipped` revisados.

Recomendado antes de entregar la URL a Meta, sin bloquear: m2 (Anthropic, confirmar el proveedor de
correo) y m1.

---

## Re-revisión (2026-10-30) — diff `d16a343d..07e57246`

No corrí gate ni tests (orden del leader). Evidencia leída: `progress/gate_490_b.log` (pasos del
`--rapido` a mano: typecheck 0 tras `rm -rf .next/dev`, lint 0, 11/151 + 5/78 + guardias 274/3.769
verdes, 0 skipped), `progress/gate_490_completo.log` (`INIT_EXIT=0`, commit anterior) y
`progress/t92_490_curl.txt`.

### Veredicto: OK (APROBADA)

B1 resuelto: `tasks.md` con T1-T9.3 en `[x]`, T9.2 hecha (las dos rutas 200 sin cookie y con UA
`facebookexternalhit/1.1`, sin `location` ni `set-cookie`, texto legal y `<title>` con la marca en el
HTML crudo) y T9.4 diferida por escrito a tras-merge con la condición de no entregar la URL a Meta
sin ese curl. La captura del navegador no se hizo; lo acepto, porque el rastreador lee el HTML
crudo y eso es lo que se midió.

### (1) `ConservacionLegal` frente al esquema y al código: cierto
- «Movimientos de dinero… y sus comprobantes… la aplicación no modifica ni borra». `WalletMovimiento`,
  `WalletTiendaMovimiento` y `PagoMensajeroMovimiento` no tienen `updatedAt`/`deletedAt` (comentario
  «INMUTABLE (R3)» en el esquema). En `lib/`, `app/` y `scripts/` no hay ningún
  `update`/`updateMany`/`delete`/`deleteMany`/`upsert` de esas tres tablas ni de `walletComprobante`,
  ningún SQL crudo `UPDATE`/`DELETE FROM` sobre ellas, y ningún borrado de archivo de comprobante en
  storage. `WalletComprobante` cuelga de los movimientos con FK `Restrict`.
- Matiz que no lo falsea: a nivel de base, `registrado_por` de los tres libros es
  `ON DELETE SET NULL`. Pero el único borrado físico de `usuario` del código
  (`ApiKeyRepository.ts:491`, cuenta sintética de una API key) se bloquea antes si la cuenta tiene
  `dependencias.dinero`. El texto dice «la aplicación», no «la base», y eso es exacto.
- «La base de datos no permite borrar a un usuario que tenga acciones registradas». Es cierto:
  `20260902120000_historial_accion/migration.sql` crea `historial_accion_actor_usuario_id_fkey ...
  ON DELETE RESTRICT` (explícito, no el `SET NULL` por defecto de una relación opcional), y ninguna
  migración posterior redefine esa constraint. «Con su nombre y su rol en ese momento» corresponde a
  `actor_nombre` y `actor_rol`, congelados en la fila.
- No promete plazos de conservación ni que el resto se borre de una forma concreta.

### (2) Tests que sustituyen a los «no afirma que se conserva»: siguen protegiendo, y mejor
Lo que importaba era que la página no afirmase sobre la conservación nada que nadie hubiera
decidido. Ahora lo fija una igualdad EXACTA (`toEqual(CONSERVADO)`) de los `li` de «Qué se conserva»
y de «Eliminación de tus datos». Un ítem de más, de menos o reescrito pone el test rojo, y
`CONSERVADO` es un literal del contrato, no la fuente del componente. Los filtros negativos que
quedan («conservamos durante», «días hábiles», «años», «se borra todo», «todos tus datos serán»)
son porosos: «se conservan por cinco ejercicios» pasaría. Pero solo pasaría FUERA de esas dos
secciones, y es un menor (r2). R16 quedó acotado a su sección, que es necesario porque la lista de
conservación añade `<li>` a la página.

### (3) Prop `marca` de `LandingFooter`: la landing no cambia
`marca?: ReactNode` es opcional, y su valor por defecto es `= {}`. Con `marca === undefined` se pinta
`<Logo className="text-white" />`, exactamente lo de antes. El único otro llamador, `app/page.tsx:72`,
sigue siendo `<LandingFooter />` sin prop. Lo cubren `LandingFooter.test.tsx` (sin prop, wordmark
«Ordenex»; con prop, ese texto y nada de «Ordenex») y, en las páginas legales, los tests (e) más la
mutación anotada en `impl_490.md` (volver a `<LandingFooter />` pone 4 rojos).

### Resto del diff
- m1: corregido. `TrustedDevice` figura como «dirección IP y una huella cifrada», hay test negativo
  del texto viejo, y se añadió la IP del reto OTP (`EmailOtpChallenge.ipAddress`, existe).
- m2: Anthropic añadido con lo que recibe, con test literal.
- m3: «Movimientos de dinero» e «Historial de las acciones», con sus finalidades. Ambas categorías
  existen en el esquema.

### Menores que quedan (no bloquean)
- **r1 — El abierto 8 lo cerró el código, no el humano.** Publicar «estos registros no se borran
  aunque se pida» es una postura legal, aunque sea cierta. Antes de entregar la URL a Meta, que Carlos
  lo vea y lo apruebe (una línea en `tasks.md` o en el spec basta).
- **r2 — Filtros negativos porosos** (ver punto 2). La igualdad exacta de las secciones es lo que
  carga el contrato.
- **r3 — «Ordenex» sigue en el `<head>`** (`apple-mobile-web-app-title` del layout raíz, 2 apariciones
  en el HTML crudo, no visibles). Anotado por el implementador para el cambio de marca posterior.
- **r4 — m4 sigue abierto:** el spec (requirements/design) no recoge T8, `ConservacionLegal`, el prop
  `marca` del pie ni el cierre del abierto 8. Es pendiente del spec_author, igual que el `status_note`
  rancio (m8).
- **r5 — Brevo** se nombra como proveedor de correo y la 489 está apagada hasta su encendido. Hay que
  confirmar que, el día que se entregue la URL, el correo sale por Brevo.
