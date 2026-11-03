# Ficha 499 — bitácora del frontend (bloque F)

Rama `fix/499-distrito-una-sola-zona` (worktree `wt-499`), partiendo de `d334efb3` (bloque B en
`progress/impl_499_backend.md`). Búsqueda de código: MCP `codebase-memory` (proyecto
`R-job-singularis-projects-ordenex`) para localizar `GeografiaSelector`, `ZonasTarifasModule`,
`CrearZonaForm` y `mensajeDeError`; confirmación siempre en el archivo real del worktree.

## Lo hecho, por tarea

| Tarea | Commit | Qué |
|---|---|---|
| F.1 | `c36b7886` | `GeografiaSelector` gana `zonaPropiaId: string \| null` (obligatorio). `zonasAjenas(d)` = `d.zonas` sin la propia; si hay alguna, la casilla va `disabled`, la fila en gris con `cursor-not-allowed` y «(zona: …)» con esos nombres unidos por «, ». `provDistIds`/`cantDistIds` solo con seleccionables; casilla de grupo `disabled` si su lista queda vacía. `CrearZonaForm` le pasa `initial?.zonaId ?? null` (comentario §6.3: no se pasa `zonaIdGuardada`). Ajustados los dos llamadores de test (`geografia-selector-inactivos.test.tsx` con `"z-sur"`, `zona-guardado-conserva-inactivos.test.ts` con `zona.id`), sin tocar sus aserciones. |
| F.2 | `0fa353c5` | `ZonasTarifasModule`: `leerArbol()` (toast «No se pudo cargar la geografía. Inténtalo de nuevo.» y `null` si falla). `abrirCrear` pasa a `async` y no abre si falla; `abrirEditar` la mete en el `Promise.all` y la preselección sale de `d.zonas.some(z => z.id === full.id)` sobre el árbol recién leído. `onSaved` sigue con `void refetch()`. |
| F.3 | `4c1ec09e`, `93dfe614` | `mensajeDeDistritos` en `CrearZonaForm`: 1 mensaje tal cual; N > 1, el primero sin punto final + « (y N−1 más).». Va antes de `nombre`/`esCentral`. `conflict` → «Ya existe una zona con ese nombre.». Pregunta abierta 1 del requirements marcada como respondida. En `ZonaCentralConfirmacion.test.tsx` y `ZonaNombreNoImprimible.test.tsx` el caso «un validation_error de OTRO campo conserva el genérico» usaba `distritoIds` como «otro campo»; desde R23 ya no lo es y pasa a `tarifas` (lo medido no cambia). |
| F.4 | — | Ver la app (abajo). Sin cambios de código. |
| tasks | `e10c5603` | `[x]` en F.1-F.4. |
| F.5 | ver «Gate» | `./init.sh --rapido`. |

Nota de diseño: el design §6.2 dice que el módulo «le pasa a `CrearZonaForm` el `zonaPropiaId`». Se
deriva dentro del formulario de `initial.zonaId`, que es exactamente el valor que el módulo pone al
abrir «Editar» (y `undefined` al crear): mismo efecto, sin un prop nuevo que los 5 tests que montan
`CrearZonaForm` tendrían que pasar.

## Rojo antes del arreglo

- `GeografiaSelectorZonaUnica.test.tsx` contra el selector sin cambios: **7 de 8 rojos** (el único
  verde es «Merced … se desmarca y vuelve a marcar», que R18 ya cumplía).
- `ZonasTarifasDistritoUnico.test.tsx` contra el módulo y el formulario sin cambios: **9 de 9 rojos**.

## Mapa R → test (mitad frontend)

| Req | Test |
|---|---|
| R17 | `tests/components/GeografiaSelectorZonaUnica.test.tsx` «499/R17 — Merced y Hospital deshabilitados con «(zona: …)»…», «el clic en un distrito bloqueado no lo marca ni lo reporta», «Hospital (de Oeste) sigue bloqueado…; la zona propia no se etiqueta» |
| R18 | idem «Merced (de Este) está habilitado, marcado y se desmarca y vuelve a marcar» |
| R19 | idem «el cantón mixto marca Carmen y Merced, nunca Hospital», «la provincia marca solo los seleccionables…» |
| R20 | idem «con todos los seleccionables marcados, cantón y provincia salen marcados (no a medias)», «un cantón sin ningún seleccionable tiene su casilla deshabilitada» |
| R21 | `tests/components/ZonasTarifasDistritoUnico.test.tsx` ««Crear zona» con la lectura fallida…», ««Editar» con la lectura fallida…», ««Crear zona» abre con el árbol RECIÉN LEÍDO…» |
| R22 | idem «tras guardar otra zona SIN recargar, «Editar» de Oeste marca su distrito», «un distrito con DOS zonas sale marcado al editar cualquiera de ellas» |
| R23 | idem «con 3 mensajes: los 3 bajo el selector y el toast «… (y 2 más).»», «con 1 mensaje: el toast es el mensaje tal cual», «el mensaje de recarga (R13) llega tal cual…» |
| R24 | idem «el toast es «Ya existe una zona con ese nombre.»» (y ningún toast contiene «distrito») |

R1-R16 y R25: ver `progress/impl_499_backend.md`.

## Mutaciones (aplicar, ver rojo, restaurar con `git checkout`, `git diff --stat` vacío)

| Mutación | Test que la mata |
|---|---|
| M6: quitar `disabled={bloqueado}` del `Checkbox` del distrito | R17 ×3 (los dos de «al crear» y «Hospital … sigue bloqueado») |
| M7: volver a `d.zonaId === full.id` en la preselección | R22 «un distrito con DOS zonas…» |
| M8: `cantDistIds` con todos los distritos (sin el filtro de seleccionables) | R19 ×2 y R20 ×2 |
| Extra: preselección sobre `provincias` (estado) en vez del árbol recién leído | R22 ×2 |
| Extra: `abrirCrear` sin `leerArbol()` | R21 ×2 y R22 «tras guardar otra zona…» |
| Extra: toast con el punto del primer mensaje («…Este. (y 2 más).») | R23 «con 3 mensajes» |
| Extra: quitar la rama `distritoIds` de `mensajeDeError` | R23 ×3 |
| Extra: casilla de grupo sin `disabled` con la lista vacía | R20 «un cantón sin ningún seleccionable…» |
| Extra: volver al texto viejo de `conflict` (con «distrito») | R24 |

M7 sola solo la mata el caso de dos zonas: en el árbol recién leído, con una sola zona, `zonaId`
coincide con `zonas[0].id`. Ese caso es el estado que el índice ya no admite pero que `zonas` sigue
describiendo (R15); es el defecto original de la ficha.

## Ver la app (F.4)

Dev server propio `next dev --webpack -p 3499` en el worktree, Playwright headless, base local
(`localhost:5432/ordenex`, comprobado por el script antes de tocar nada). Usuario: un `maestro` QA
creado para esto con `scripts/seed-maestro.ts` (`seed-usuarios-qa.ts` no siembra maestro y la
pantalla es solo de maestro). El servidor se levantó con `AUTH_RISK_THRESHOLD=999` en el entorno del
proceso (el `.env` no se tocó): sin eso pedía OTP y el código ya no se escribe en el log. El aviso
«Confirmá el SINPE de GAM» se cerró con «Ahora no» (solo `sessionStorage`). Cantón de prueba:
Cartago › Paraíso (Birrisito, Cachí, Orosi libres; Llanos de Santa Lucía, Paraíso y Santiago en GAM).

Capturas en `C:\Users\ArqDev\AppData\Local\Temp\claude\R--job-singularis-projects-ordenex\cad10efb-563f-42a2-b6cd-d333f35d10a8\scratchpad\499-visual\`
(`1-crear-bloqueado-y-cascada.png`, `2-editar-B-sin-recargar.png`, `3-editar-A.png`, `4-conflicto.png`).

| Comprobación | Lo visto (texto leído de la página) |
|---|---|
| Distrito de otra zona bloqueado | Tras crear «QA499 A» con Birrisito, «Crear zona» sin recargar: Birrisito `aria-disabled=true`, fila «Birrisito (zona: QA499 A)»; Santiago «(zona: GAM)» bloqueado; Cachí y Orosi habilitados sin etiqueta. |
| Cantón/provincia solo marcan seleccionables | Clic en el cantón Paraíso: cantón `aria-checked=true`, «Distritos seleccionados: 2.», marcados Cachí y Orosi; Birrisito y Santiago sin marcar. |
| Editar preselecciona tras guardar otra zona sin recargar | Crear «QA499 B» con Cachí y, sin recargar, «Editar» QA499 B: Cachí marcado y habilitado, sin etiqueta; Birrisito bloqueado «(zona: QA499 A)». «Editar» QA499 A: Birrisito marcado y habilitado, se desmarca con un clic; Cachí bloqueado «(zona: QA499 B)». |
| Conflicto forzado (dos pestañas) | Pestaña 1 abre «Crear» («QA499 C») con Orosi marcado; pestaña 2 crea «QA499 D» con Orosi; pestaña 1 guarda: toast «Orosi ya está en la zona QA499 D.» y el mismo texto bajo el selector. «QA499 C» no se creó. |

Observaciones (no son defectos de la ficha):
- Tras el rechazo por conflicto, el árbol del formulario abierto sigue siendo el de cuando se abrió:
  Orosi sigue marcado y sin «(zona: …)». El aviso nombra el distrito y la zona, así que se sabe qué
  desmarcar; para verlo bloqueado hay que cancelar y volver a abrir. Es lo que pide el spec (R21 lee
  al abrir; nada pide releer tras un rechazo).
- `fieldErrors.distritoIds` también lo usa `ZonaService.prepararDatos` con el texto técnico
  «uno o mas distritoIds no existen». Desde R23 ese texto sale también en el toast (antes salía solo
  bajo el selector). Solo pasa si un distrito se borra con el formulario abierto. Sin tocar: fuera
  de alcance.

Limpieza: zonas QA499 A, B y D borradas (con sus `zona_distrito` y `tarifa_zona_mensajero`) y el
maestro QA borrado con sus `login_attempt`, `trusted_device` y `email_otp_challenge`. Conteos antes y
después iguales: `zona` 50, `zona_distrito` 297, `tarifa_zona_mensajero` 39, `historial_accion` 949,
`tarifas` 2, `usuario` 237. Dev server parado y `.next/dev` borrado antes del typecheck final.

## Verificación

- `pnpm exec tsc --noEmit`: 0 errores (`TSC_EXIT=0`), tras borrar `.next/dev`.
- `pnpm exec eslint` sobre los 9 archivos tocados: sin problemas.
- `tests/components/` entero (431 archivos) antes de ajustar los dos tests de F.3: 2 rojos (los dos
  «OTRO campo», ya corregidos), 5944 verdes, 26 skipped. Tras el ajuste, los tres archivos de zona
  28/28.
- Los nuevos, aislados: `GeografiaSelectorZonaUnica` 8/8, `ZonasTarifasDistritoUnico` 9/9;
  `geografia-selector-inactivos`, `zona-guardado-conserva-inactivos` (contra Postgres, no saltado),
  `ZonaDistritoEspecial`, `ZonaCentralConfirmacion`, `CrearZonaFormReconciliacion`,
  `ZonaNombreNoImprimible`: verdes.

GATE_PLACEHOLDER

## Abiertos

1. El texto técnico «uno o mas distritoIds no existen» llega ahora también al toast (arriba).
2. Tras un rechazo por conflicto, el formulario abierto no relee el árbol (arriba).
3. Lo del backend sigue en pie: base local compartida con el índice ya aplicado, `db:rollback` que no
   revierte dos migraciones seguidas, `origin/dev` adelantado 2 commits y sin rebase, R.2 (pasos
   posteriores al despliegue) para la nota de la release.
