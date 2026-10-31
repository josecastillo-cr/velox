# 490 — Páginas públicas de privacidad y eliminación de datos · tasks

> Antes de T1: respuesta del humano a las preguntas abiertas 4 (texto propio o básico) y 12
> (`/design` sí/no). Las 1-3, 5-6 NO bloquean: el código nace con `null` y marcadores (R19), y
> rellenarlas es T8. Gate de cada task: `./init.sh --rapido`. Un commit por task
> (`feat(490): …` / `test(490): …`).

## T1 — Rutas públicas en el middleware
- [x] T1.1 Test `tests/unit/auth/middleware-paginas-legales.test.ts`: `/privacidad` y
  `/eliminacion-datos` sin cookie → 200 sin `location`, `isSessionActive` no llamado (R1, R2); con
  cookie → 200, sin redirect a `/dashboard` ni `/login`, sin consulta (R3); `/privacidad-admin` y
  `/eliminacion-datosx` sin cookie → 307 a `/login` (R4).
  **Hecho:** el test está rojo contra `dev` (R1-R3 fallan) por la razón esperada.
- [x] T1.2 Añadir las dos rutas a `PUBLIC_ROUTES` con comentario de la 490.
  **Hecho:** T1.1 verde; `tests/unit/auth/middleware.test.ts` sigue verde.

## T2 [P] — Módulo de datos legales
- [x] T2.1 Crear `app/_legal/datos-legales.ts` (interfaz `DatosLegales`, `DATOS_LEGALES` todo
  `null`, `MARCADOR_PENDIENTE`) según design §5.
  **Hecho:** typecheck verde; ningún valor relleno.

## T3 — Componentes comunes (depende de T2)
- [x] T3.1 `app/_legal/DatoLegal.tsx` (valor o marcador en `<span data-pendiente>`).
- [x] T3.2 `app/_legal/PaginaLegal.tsx` (cabecera con marca en texto + enlace a `/`, `<main>` con un
  `<h1>`, `LandingFooter`), con las primitivas de la landing (design §4).
  **Hecho:** sin `"use client"`, sin `Logo`, sin hex ni CSS suelto.

## T4 — Página de privacidad (depende de T3)
- [x] T4.1 Tests en `tests/components/paginas-legales.test.tsx` (bloque privacidad): categorías
  R9/R10/R11 como literales, finalidades R12, datos legales R13, enlace a `/eliminacion-datos`
  R14, un solo `<h1>` R8, marcadores con datos `null` R19, valores ficticios con datos rellenos
  R20, `metadata` con la marca R7.
  **Hecho:** rojo antes de T4.2.
- [x] T4.2 `app/_legal/PoliticaPrivacidad.tsx` + `app/privacidad/page.tsx`
  (`dynamic = "force-static"`, `metadata`). Contenido limitado al inventario de design §3; nada de
  plazos, terceros ni normas (abiertos 7-10).
  **Hecho:** T4.1 verde.

## T5 [P con T4] — Página de eliminación (depende de T3)
- [x] T5.1 Tests (bloque eliminación): solicitud por correo con `mailto:` R15, datos a incluir R16,
  marca/razón social/fecha y enlace a `/privacidad` R17, sin `mailto:` con correo `null` R21, un
  `<h1>` R8, `metadata` R7.
  **Hecho:** rojo antes de T5.2.
- [x] T5.2 `app/_legal/InstruccionesEliminacion.tsx` + `app/eliminacion-datos/page.tsx`.
  **Hecho:** T5.1 verde.

## T6 — Guardia estática (depende de T4 y T5)
- [x] T6.1 `tests/unit/guards/paginas-legales-estaticas.guardia.test.ts`: las dos `page.tsx`
  exportan `dynamic = "force-static"`; ningún archivo de `app/_legal/`, `app/privacidad/`,
  `app/eliminacion-datos/` tiene `"use client"`, `next/headers`, `cookies(`, `@/lib/db` ni
  `searchParams` (R6, R5); ninguno salvo `datos-legales.ts` contiene `Ordenex`, `Velox` ni un correo
  literal (R18). Autocomprobación: los detectores se ejercen contra fuente sintético sano y con la
  infracción plantada.
  **Hecho:** verde en el árbol; plantar `"use client"` o un literal `Velox` en un archivo de prueba
  la pone roja (anotarlo en `progress/impl_490.md`). Correrla a mano por nombre.

## T7 [P con T4-T6] — Pie de la landing (solo depende de T1 para que el enlace no lleve a /login)
- [x] T7.1 `tests/components/LandingFooter.test.tsx`: «Política de Privacidad» es enlace a
  `/privacidad` y existe «Eliminación de datos» enlazando a `/eliminacion-datos` (R22).
- [x] T7.2 Editar la columna «Legal» de `LandingFooter.tsx` (y su docstring). Nada más del pie.
  **Hecho:** T7.1 verde; las guardias de la landing siguen verdes.

## T8 — Datos legales reales (bloqueada por el humano: abiertos 1-3, 5-6)
- [x] T8.1 Rellenar `DATOS_LEGALES` con los valores que dé el humano. No se rellena ninguno por
  supuesto.
  **Hecho:** las páginas no muestran ningún `MARCADOR_PENDIENTE`; los tests siguen verdes (no
  dependen de los valores reales).

## T9 — Verificación (depende de T1-T7)
- [x] T9.1 `./init.sh --rapido` verde; revisar `skipped` además del código de salida.
  **Hecho (2026-10-30):** `--rapido` se niega porque el diff toca `middleware.ts` (`RUTAS_GLOBALES`)
  y el completo no se corre fuera de una release (regla 5). Sus pasos se corrieron a mano:
  `progress/gate_490.log` y, tras la revisión, `progress/gate_490_b.log` (0 skipped).
- [x] T9.2 Dev server: `curl -i` sin cookie y con `-A "facebookexternalhit/1.1"` a las dos rutas →
  200 y el texto en el HTML crudo. Captura del navegador de ambas páginas.
  **Hecho (2026-10-30):** las dos rutas 200, sin `location` ni `set-cookie`, texto legal en el HTML
  crudo (`progress/t92_490_curl.txt`, detalle en `progress/impl_490.md`). La captura del navegador
  no se hizo: la evidencia es el HTML crudo, que es lo que lee el rastreador.
- [x] T9.3 `progress/impl_490.md` con el mapa R → test (design §8) y el resultado de T6.1 y T9.2.
  **Hecho:** los 22 requisitos tienen test nombrado; nada sin commitear.
- [ ] T9.4 (tras merge) Mismo `curl` contra preview. La URL de producción se entrega a Meta solo
  cuando T8 esté hecha.
  **Diferida por escrito (leader, 2026-10-30):** se hace después del merge, contra el deploy de
  preview. La URL no se entrega a Meta sin ese curl.
