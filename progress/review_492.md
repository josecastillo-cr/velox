# 492 — Marca Velox Courier: identidad visual · revisión (reviewer, 2026-11-02)

Rama `feat/492-marca-velox-identidad`, HEAD `0ddaa782` (merge de `origin/dev` `80b20f39` sobre
`61d9f15d`), diff `git diff origin/dev...HEAD` (64 archivos). Worktree `R:/job/singularis/projects/wt-492`.

Búsqueda: la revisión parte del diff y de los archivos reales; el MCP `codebase-memory` no hizo falta
(no hubo un «dónde está X» que el diff no contestara). Los barridos de «Ordenex» se hicieron con
`grep` sobre el árbol, que es texto plano.

## Veredicto: RECHAZADO

Dos bloqueantes, los dos baratos: B1 (proceso: tasks sin marcar) y B2 (la segunda mitad de R1 no
tiene test; dos mutaciones medidas sobreviven). El código en sí cumple R1–R23 tal como está hoy; lo
que falta es la red que lo sostenga y el cierre de `tasks.md`.

## Checklist

### Especificación
- [x] `requirements.md` con R1–R23 en EARS (R22 va después de R23 en el archivo; no falta ninguno).
- [x] `design.md` con 8 alternativas descartadas y su porqué (§5).
- [ ] **`tasks.md` con todas las tasks `[x]`: 0 de 18 marcadas** (B1).

### Trazabilidad (R → test, leídos uno a uno)
- [~] R1 → `tests/unit/marca/identidad.test.ts` (literales de contrato + `DATOS_LEGALES.marca`) y
  `marca-velox-identidad.guardia` (el layout lee `MARCA`). **La cláusula «todo archivo TS tocado lee de
  `MARCA`» solo está vigilada en `app/layout.tsx`** (B2, mutaciones X7/X8).
- [x] R2 → `marca-velox-identidad.guardia` (manifiesto, `offline.html`, `sw.js` contra `MARCA` y contra literal).
- [x] R3 → `marca-velox-archivos.guardia` (6 copias byte a byte).
- [x] R4 → `marca-velox-identidad.guardia` (literales) + `pwa-manifiesto-atajos.guardia` «diez claves».
- [x] R5 → `marca-velox-identidad.guardia` (id, start_url, scope, display, orientation, categories, sin shortcuts, `icons` con `toEqual`).
- [x] R6 → `marca-velox-identidad.guardia` (importa `metadata` y renderiza `RootLayout`; X14 rojo).
- [x] R7 → `marca-velox-sin-anterior.guardia` (hash de T0 + píxel `#011027` opaco en los 5 iconos).
- [x] R8 → `marca-velox-archivos.guardia` (`app/icon.png` no existe; solo `favicon.ico` + `icon.svg` en `app/`).
- [x] R9 → `marca-velox-sin-anterior.guardia` (RGBA tipo 6, visible = blanco, ≥ 5 %, hash; X16 rojo).
- [x] R10 → `pwa-push.guardia` (3 casos de reserva con literal; X13 rojo).
- [x] R11 → `marca-velox-identidad.guardia` (`<title>` literal + `theme-color`).
- [x] R12 → `tests/components/Logo.test.tsx` (3 variantes, nombre único, `src` literales, clases `dark:`).
- [x] R13 → `tests/components/Sidebar.test.tsx` caso 492 + `marca-velox-logo-por-fondo.guardia`.
- [x] R14 → `tests/components/LoginPage.test.tsx` caso 492 (render) + `marca-velox-logo-por-fondo.guardia` (las 4 páginas; X11 rojo).
- [x] R15 → `LandingPage.test.tsx` (enlace «Velox Courier — inicio»), `LandingFooter.test.tsx` (sin/con `marca`), guardia por fondo.
- [x] R16 → `tests/unit/pdf/etiquetas-rotulo-marca-492.test.ts` (literal, todas las hojas, Helvetica-Bold, sin `setTextColor`; X1 rojo). Ver m4.
- [x] R17 → los 5 tests previos SIN editar (`git diff` vacío en ellos); X9 (rótulo largo) los pone rojos.
- [x] R18 → `informe-transito-pdf.test.ts` y `picking-pdf.test.ts` (literales + «sin Ordenex» en el PDF real; X2, X12 rojos).
- [x] R19 → `email-marca.test.ts` (sin/en blanco + correo compuesto, cabecera y pie) + `email-config.test.ts` (X3 rojo).
- [x] R20 → `tests/unit/api/openapi-titulo-marca.test.ts` (GET real, `info.title`, YAML; X5 rojo).
- [x] R21 → `tests/unit/docs/guia-integracion-marca.test.ts` (4 piezas + logo resuelto a archivo existente; X6 rojo).
- [x] R22 → `marca-velox-sin-anterior.guardia` (hash de capturas; X15 rojo) + `tests/unit/pwa/manifest.test.ts`.
- [x] R23 → `push-config.test.ts` (sin y en blanco, literal en minúsculas; X4 rojo). `soporte@ordenex.co` no aparece en ningún archivo del diff.
- [x] `progress/impl_492.md` contiene el mapa R → test.

### Calidad de código
- [x] typecheck, lint y tests relacionados: `progress/gate_492_1.log`, `INIT_EXIT=0`, 556 archivos /
  6995 tests (26 skipped preexistentes de Analítica), guardias 278 archivos, «0 rojos nuevos».
  Corrió sobre `61d9f15d`; el merge `0ddaa782` solo añade 5 archivos de docs/specs de la 491, así
  que sigue valiendo.
- [x] Medido por mí: los 27 archivos de la ficha (los nuevos, los actualizados, los 5 de R17, `pwa-*`,
  `manifest`, `html-lang`): **27/27 archivos, 389/389 tests en verde**, sin `skipped`.
- [n/a] E2E: no toca auth, pagos, recaudo, ingesta ni webhooks.
- [ ] Build: no verificable en el worktree (Turbopack rechaza el junction de `node_modules`). Abierto
  para el leader: `gh pr checks 876` antes de mergear.

### Datos y seguridad
- [n/a] Sin tablas, sin migraciones, sin webhooks.
- [x] Sin secretos. `mailto:battos.sa@gmail.com` es el contacto VAPID público que decidió el humano (P5).

### Capas / permisos / multi-país
- [x] Sin capas nuevas; `lib/marca/identidad.ts` es una constante sin dependencias.
- [x] Sin hardcode de país, moneda ni cuenta.

### Otros puntos pedidos por el leader
- [x] `app/globals.css` sin cambios (`git diff --stat origin/dev -- app/globals.css` vacío).
- [n/a] `./init.sh` completo: solo antes de una release a `prod`.
- [ ] `progress/history.md` sin entrada de la 492 (es del cierre del leader).

## Tabla de mutaciones (medidas por mí)

Arnés: `sed` sobre el archivo → comprueba con `git diff --numstat` que la mutación se aplicó (si no,
la descarta) → corre SOLO los tests indicados → `git checkout -- <archivo>` → comprueba con
`git status --porcelain` que quedó limpio. Las binarias (X15, X16) restauran el archivo de
`origin/dev` y se revierten igual. Al terminar, el árbol no tiene cambios fuera de los logs sin trackear.
Autocomprobación del arnés: 13 de 15 salen rojas, y las 2 verdes tienen la mutación aplicada (1 línea
en `numstat`).

| # | R | Mutación | Test(s) corridos | Resultado |
|---|---|---|---|---|
| X1 | R16 | `etiquetas-dibujo.ts` `ROTULO_GUIA = "ORDENEX · GUÍA"` | `etiquetas-rotulo-marca-492` | ROJO (5 de 6) |
| X2 | R18 | `transito/pdf.ts:205` `l.texto("Ordenex", …)` | `informe-transito-pdf` | ROJO (1 de 20) |
| X3 | R19 | `email.ts` `DEFAULT_FROM_NAME = "Ordenex"` | `email-marca` | ROJO (5 de 7) |
| X4 | R23 | `push.ts` `DEFAULT_SUBJECT = "mailto:soporte@ordenex.co"` | `push-config` | ROJO (2 de 12) |
| X5 | R20 | `openapi-spec.ts` `title: "Ordenex — API…"` | `openapi-titulo-marca` | ROJO (1 de 3) |
| X6 | R21 | guía `<meta name="author" content="Ordenex">` | `guia-integracion-marca` | ROJO (2 de 6) |
| **X7** | **R1** | `transito/pdf.ts:205` `l.texto("Velox Courier", …)` (literal en vez de `MARCA.nombre`) | `marca/identidad`, 4 guardias `marca-velox-*`, `informe-transito-pdf` | **VERDE 67/67: sobrevive** |
| **X8** | **R1** | `api-docs/route.ts:14` `<title>Velox Courier — API…` (literal en vez de `${MARCA.nombre}`) | `marca/identidad`, 4 guardias `marca-velox-*`, `openapi-titulo-marca` | **VERDE 50/50: sobrevive** |
| X9 | R17 | `ROTULO_GUIA = "VELOX COURIER · GUÍA DE ENVÍO NACIONAL"` | los 5 de R17 | ROJO (4: capacidad a4 y 3 de diseño-353) |
| X11 | R14 | `paquete/[numGuia]/page.tsx` `fondo="oscuro"` | `marca-velox-logo-por-fondo` | ROJO (1 de 9) |
| X12 | R18 | `picking/pdf.ts` sello `Ordenex · Picking …` | `picking-pdf` | ROJO (5 de 23) |
| X13 | R10 | `sw.js` `TITULO_RESERVA = "Ordenex"` | `pwa-push.guardia` | ROJO (3 de 20) |
| X14 | R6 | `layout.tsx` `apple-mobile-web-app-title` = `MARCA.nombre` | `marca-velox-identidad` | ROJO (2 de 8) |
| X15 | R22 | `inicio-wide.png` restaurado desde `origin/dev` | `marca-velox-sin-anterior` | ROJO (1 de 19) |
| X16 | R9 | `badge-72.png` restaurado desde `origin/dev` | `marca-velox-sin-anterior` | ROJO (1 de 19, solo por hash) |

(X10 no existe: se descartó antes de correrla.)

Lectura: la afirmación del implementador («los literales de contrato atrapan la mutación») se
confirma en R6, R9, R10, R14 y R16–R23 (13 de 13 medidas). Ninguna de esas aserciones compara un
texto con la función que lo genera: todas usan literales escritos a mano, y las que además
comparan con `MARCA` (R2) lo hacen en un caso aparte. Lo que NO cubre nada es la cláusula de R1 que
prohíbe el literal (X7, X8): ahí la mutación escribe justo el literal correcto, así que ningún test
de valor puede verla. Hace falta una guardia de forma.

## Hallazgos

### BLOQUEANTE

- **B1 — `tasks.md` sin cerrar.** `specs/492-marca-velox-identidad/tasks.md:10-148`: las 18 tasks
  siguen en `[ ]` aunque `progress/impl_492.md:28-45` las da por hechas con su commit. Incumple
  `CHECKPOINTS.md` («todas las tasks marcadas `[x]`»). Mismo criterio que el B1 de `review_490.md`.
  **Qué falta:** marcar `[x]` las tasks hechas (T0–T16, T13a) y commitearlo en la rama.

- **B2 — R1, segunda cláusula, sin test.** R1 exige que «todo archivo TypeScript tocado por esta ficha
  DEBE leer esos valores de ese módulo en vez de escribirlos como literal». Solo `app/layout.tsx` está
  vigilado (`marca-velox-identidad.guardia.test.ts`, caso «R1: el layout lee las metas…»). Medido:
  escribir `"Velox Courier"` como literal en `lib/whatsapp-envios/informes/transito/pdf.ts:205` (X7)
  o en `app/api-docs/route.ts:14` (X8) deja todo en verde. Hoy el código cumple (el único «Velox» en
  esos archivos está en comentarios), pero nada impide la regresión.
  **Qué falta:** una guardia que, sobre los `.ts`/`.tsx` de código tocados por la ficha (`Sidebar.tsx`,
  `LandingNav.tsx`, `LandingFooter.tsx`, `api-docs/route.ts`, `layout.tsx`, `Logo.tsx`,
  `openapi-spec.ts`, `email.ts`, `picking/pdf.ts`, `transito/pdf.ts` y las 4 páginas del logo),
  quite los comentarios con `quitarComentarios` y falle si encuentra el valor de `MARCA.nombre`,
  `MARCA.descripcion` o `MARCA.colorTema`, o una ruta de `LOGO`, escritos como literal. Excepción
  cerrada: `ROTULO_GUIA` (decisión de design §3.7). Con autocomprobación: una fuente sintética con el
  literal tiene que dar un hallazgo. X7 y X8 la tienen que poner roja. Hay una alternativa que no
  decide el reviewer: que el humano cambie el spec y pase esa cláusula a la guardia de R1 de la 493
  (`specs/493-marca-velox-textos/design.md`, bloque 2).

### MAYOR

- **M1 — La vista previa de la etiqueta sigue diciendo «ORDENEX · GUÍA».**
  `app/(app)/ordenes/_components/EtiquetaGuia.tsx:131` pinta `Ordenex · Guía` con `uppercase` en el
  modal de etiquetas (`EtiquetasGuiaModal.tsx:26`), mientras el PDF ya imprime «VELOX · GUÍA». Está
  fuera de la letra de R16 (que dice «etiqueta PDF»), pero la ficha 493 lo da por cubierto aquí:
  `specs/493-marca-velox-textos/requirements.md:105` («Lo que cubre la 492: … rótulo de la etiqueta
  (`EtiquetaGuia`, `ROTULO_GUIA`)»). Queda huérfano entre las dos fichas, y es la 492 la que abre la
  diferencia entre lo que se ve y lo que se imprime. La guardia R15 de la 493 lo cazaría, pero solo
  cuando se implemente. Recomendado: usar `ROTULO_GUIA` en la vista previa en esta misma rama (una
  línea + un caso de test), o dejarlo anotado de forma explícita en la 493.

### MENOR

- **m1 — Leyendas de las capturas del manifiesto.** `public/manifest.json:20-22` (`label`: «Pantalla
  de inicio de Ordenex», «Inicio de sesión en Ordenex», «Ordenex en escritorio»). Se ven en el diálogo
  de instalación junto a las capturas nuevas con Velox. **Fuera de la letra de R1–R23**: R4 enumera
  los campos que cambian, R5 no protege `label` y R22 pide «mismos nombres, tamaños y `form_factor`».
  El implementador acierta al decir que no están en R1–R23. Pero la intro del requirements dice que el
  manifiesto es de la 492, y `specs/493-marca-velox-textos/design.md:185` dice lo mismo; solo la
  guardia R15 de la 493 (barre `public/**/*.json`) lo recogería. Son 3 cadenas: mejor arreglarlas aquí.
- **m2 — `<meta name="description">` de la guía.** `docs/api/guia-integracion/guia-integracion.html:7`
  («…canal por API key de Ordenex…»). **Fuera de alcance de la 492**: R21 es una lista cerrada
  (`<title>`, autor, título de portada, pie, logo) y P7 manda la prosa de la guía a la 493, cuyo R9 y
  cuya guardia R15 barren ese HTML entero. No sale en el PDF.
- **m3 — Comentario de cabecera del YAML.** `docs/api/api-key-openapi.yaml:1` («(Ordenex)»). **Fuera de
  alcance**: es un comentario y ningún usuario lo ve (lo que se sirve sale de `openapi-spec.ts`). La
  guardia R15 de la 493 barre el YAML como texto y lo recogerá.
- **m4 — «NO DEBE dibujar un logo gráfico» (R16) sin aserción directa.**
  `tests/unit/pdf/etiquetas-rotulo-marca-492.test.ts:45-57` comprueba que el rótulo es texto Helvetica
  y no embebido, pero no cuenta las imágenes de la cabecera: ningún test se pone rojo si se añade un
  `addImage` de logo. No medido. Riesgo bajo: R17 (capacidad) probablemente lo cazaría si el logo
  ocupa alto.
- **m5 — Build sin verificar en local.** `progress/impl_492.md:99-105`: Turbopack no arranca en el
  worktree y `next build --webpack` cae en un tipo de `.next/types` ajeno. Mirar `gh pr checks 876`
  antes de mergear.
- **m6 — `progress/history.md` sin entrada 492.** Le toca al leader al cerrar.

## Qué tiene que hacer el implementer para pasar

1. B1: marcar `[x]` las 18 tasks de `tasks.md` y commitear.
2. B2: guardia de «sin literal de marca fuera de `lib/marca/identidad.ts`» sobre los archivos tocados,
   con autocomprobación; demostrar que X7 y X8 la ponen roja y anotarlo en `progress/impl_492.md`.
3. Recomendado en la misma vuelta: M1 (`EtiquetaGuia.tsx:131` → `ROTULO_GUIA`) y m1 (las 3 `label`
   del manifiesto), con sus aserciones.

---

## Ronda 2 (reviewer, 2026-11-02)

HEAD `33a8e360` (confirmado con `git log --oneline -1`). Diff revisado `4990cde6..33a8e360`: 7 archivos
(`EtiquetaGuia.tsx`, `manifest.json`, `tasks.md`, `impl_492.md`, la guardia nueva y 2 tests).
Solo se verifican B1, B2, M1 y m1.

### Veredicto final: APROBADO

Los dos bloqueantes, el mayor y m1 están corregidos y medidos. Quedan 2 menores nuevos que no bloquean.

### Verificación

- [x] **B1** — `tasks.md`: 18 de 18 tasks en `[x]` y 0 en `[ ]`.
- [x] **B2** — `tests/unit/guards/marca-velox-sin-literal.guardia.test.ts`:
  - recorre una lista cerrada de 15 archivos: los 9 que leen `MARCA` tienen que importar
    `@/lib/marca/identidad`, y ninguno de los 15 puede llevar `velox` (sin distinguir caja),
    `#011027`, `/marca/logo-` ni el arranque de la descripción una vez quitados los comentarios;
  - tiene autocomprobación positiva y negativa (comentario `//`, `/* */`, `{/* */}` y CRLF).
  - En el árbol limpio está verde.
- [x] **M1** — `EtiquetaGuia.tsx:133` pinta `{ROTULO_GUIA}` importado. Hay un caso nuevo en
  `tests/components/EtiquetaGuia.test.tsx` que compara con el literal «VELOX · GUÍA» y además con
  la constante; las dos aserciones van por separado, así que la de la constante no es la única.
- [x] **m1** — las 3 `label` de `manifest.json:20-22` dicen «Velox Courier». Hay un caso nuevo en
  `tests/unit/pwa/manifest.test.ts` con `toEqual` literal de `[src, label]`.
- [x] Medido por mí: guardia nueva + `EtiquetaGuia` + `manifest` + `marca-velox-identidad`, 4/4 archivos y 65/65 tests en verde.
  Gate: `progress/gate_492_2.log` con `INIT_EXIT=0` y «0 rojos sobre 822»; no lo repetí.

### Mutaciones de la ronda 2 (mismo arnés: aplicar, `numstat` = 1, correr, `git checkout --`, árbol limpio)

| # | Mutación | Test(s) | Resultado |
|---|---|---|---|
| X7 | `transito/pdf.ts:205` `l.texto("Velox Courier", …)` | guardia `sin-literal` | ROJO (1 de 26) |
| X8 | `api-docs/route.ts:14` `<title>Velox Courier — API…` | guardia `sin-literal` | ROJO (1 de 26) |
| X17 | `EtiquetaGuia.tsx` `{ROTULO_GUIA}` → `Ordenex · Guía` | guardia + `EtiquetaGuia.test` | ROJO (2 de 35) |
| X18 | `EtiquetaGuia.tsx` `{ROTULO_GUIA}` → `VELOX · GUÍA` a mano | guardia + `EtiquetaGuia.test` | ROJO (2 de 35) |
| X19 | `manifest.json` `label` «Ordenex en escritorio» | `manifest.test` | ROJO (1 de 22) |
| E1 | `transito/pdf.ts:205` `"Vel" + "ox Courier"` (concatenación) | guardia `sin-literal` | **VERDE: se salta** |
| E2 | `transito/pdf.ts:205` `` `${"Velox"} Courier` `` (template literal) | guardia `sin-literal` | ROJO (1 de 26) |
| E3 | `layout.tsx` `content="#01102"+"7"` (color partido) | guardia `sin-literal` | **VERDE: se salta** |
| E4 | `layout.tsx` `content="rgb(1,16,39)"` (otra notación) | guardia `sin-literal` | **VERDE: se salta** (pero R6 lo caza: `marca-velox-identidad` exige `content={MARCA.colorTema}` y `#011027` en el `<head>` pintado) |

### Hallazgos nuevos

- **menor r2-1 — La guardia se salta partiendo el literal.** Una concatenación (`"Vel" + "ox Courier"`,
  E1) o un color partido o en otra notación (E3, E4) pasan. Escribirlo así es ofuscar a propósito,
  no la regresión natural (copiar «Velox Courier» a mano), que sí se caza. E4 lo cubre R6 por otro
  lado. Aceptable; se anota para que nadie crea que la guardia es una prueba total.
- **menor r2-2 — Falso positivo previsible con la 493.**
  `marca-velox-sin-literal.guardia.test.ts:57` prohíbe `/velox/gi` en `lib/api/openapi-spec.ts`. La 493 (R18)
  va a cambiar `openapi-spec.ts:1166` (`https://app.ordenex.co/…`) por `https://velox-courier.company/…`,
  y eso pondrá roja esta guardia aunque el cambio sea correcto. Hoy no hay ningún falso positivo
  (verde en el árbol limpio). Lo que tiene que hacer la 493: añadir una excepción cerrada para el
  dominio `velox-courier.company`, sin aflojar el patrón. Hay que anotarlo en su spec o en su arranque.
- Sin cambios: m2 y m3 se quedan para la 493 por decisión del leader; m4, m5 y m6 siguen como estaban
  (m5 resuelto según el leader: el build de Vercel del PR #876 salió verde).
