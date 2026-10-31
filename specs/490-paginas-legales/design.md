# 490 — Páginas públicas de privacidad y eliminación de datos · design

> Herramienta de búsqueda: el MCP `codebase-memory` no conectó en esta sesión (timeout); todo lo
> citado se leyó directamente en los archivos con grep/Read.

## 1. Lo que ya existe y condiciona el diseño

- **No hay `proxy.ts`.** El guard de sesión es `middleware.ts` (raíz). Decide lo público con la
  lista `PUBLIC_ROUTES` y `matches()` = igualdad exacta **o** prefijo `ruta + "/"`. Una ruta de esa
  lista hace `NextResponse.next()` ANTES de leer la cookie, así que no consulta la base
  (`isSessionActive`) ni redirige a `/dashboard` (eso solo pasa para `/` exacto). El `matcher`
  deja fuera solo estáticos; `/privacidad` y `/eliminacion-datos` entran al middleware y hoy
  saldrían en 307 a `/login`.
- **La landing** (`app/page.tsx`) es un Server Component fuera del grupo `(app)`, con clase
  `tema-claro`, lienzo `bg-kraft-canvas` y tokens de marca de `globals.css`. Sus primitivas
  (`app/_landing/primitivas.tsx`: `Seccion`, `RotuloSeccion`, `TituloSeccion`, `SubtituloSeccion`,
  `Enfasis`) son Server Components puros, reutilizables.
- **`LandingNav`** monta `RastreoDialog` (isla cliente) y enlaza anclas `#servicios`… de la propia
  landing: fuera de `/` esas anclas no llevan a nada. No se reutiliza.
- **`LandingFooter`** pinta «Política de Privacidad» como `<span>` precisamente porque no había
  ruta («un `href="#"` muerto es peor…»). Esta ficha lo convierte en enlace.
- **`components/shared/Logo.tsx`** es un wordmark FIJO «Orden**ex**». Con la marca abierta (Velox
  Courier u Ordenex), las páginas legales no lo usan: pintan la marca como texto desde la config.
- **Sin `robots`/`noindex`** en `app/`: nada impide al rastreador indexar.

## 2. Rutas y archivos

| Archivo | Tipo | Qué hace |
|---|---|---|
| `middleware.ts` | edición | Añade `"/privacidad"` y `"/eliminacion-datos"` a `PUBLIC_ROUTES`, con comentario de la feature 490 (Meta las pide sin cookie). |
| `app/_legal/datos-legales.ts` | nuevo | **Única fuente** de los datos legales (§5). |
| `app/_legal/PaginaLegal.tsx` | nuevo | Armazón común: cabecera mínima (marca como texto + enlace a `/`), `<main>` con un `<h1>`, `LandingFooter` al pie. Server Component. |
| `app/_legal/DatoLegal.tsx` | nuevo | Pinta un dato legal o el marcador de pendiente (R19/R20). |
| `app/_legal/PoliticaPrivacidad.tsx` | nuevo | Cuerpo de la política. Recibe `datos: DatosLegales` por prop. |
| `app/_legal/InstruccionesEliminacion.tsx` | nuevo | Cuerpo de las instrucciones. Recibe `datos: DatosLegales` por prop. |
| `app/privacidad/page.tsx` | nuevo | `export const dynamic = "force-static"`; `metadata`; renderiza `<PoliticaPrivacidad datos={DATOS_LEGALES} />`. |
| `app/eliminacion-datos/page.tsx` | nuevo | Ídem con `<InstruccionesEliminacion …/>`. |
| `app/_landing/LandingFooter.tsx` | edición | Columna «Legal»: `Política de Privacidad` → `<Link href="/privacidad">`; nuevo `<Link href="/eliminacion-datos">Eliminación de datos</Link>`. El resto del pie no se toca (pregunta abierta 11). |

Las rutas viven en la raíz de `app/`, como `/login` y `/postulacion`: fuera de `(app)`, no heredan
Sidebar ni `resolveActorFromSession`.

**Contrato de los cuerpos**: `PoliticaPrivacidad` e `InstruccionesEliminacion` reciben los datos
por prop (no importan la config). Así el test los renderiza con datos `null` y con datos completos
(R19/R20) sin mockear módulos, y `page.tsx` es el único sitio que une config y cuerpo.

**Sin datos ni mutaciones**: no hay modelo de datos nuevo, ni migración, ni RLS, ni Server Action,
ni formulario (la solicitud es por correo). No entra en la guardia `landing-sin-maqueta` porque no
hay `<form>`.

## 3. Inventario de datos personales (verificado en `db/schema.prisma`)

Es la fuente de R9-R12. Solo figura lo que hay en el esquema.

**Destinatarios**
| Dato | Dónde | Uso (R12) |
|---|---|---|
| nombre, teléfono | `Orden.destinatario`, `Orden.telefonoDest` | entregar el envío y contactar al destinatario |
| dirección + provincia/cantón/distrito | `Orden.direccion`, `provinciaId`, `cantonId`, `distritoId` | entregar el envío |
| ubicación geocodificada | `Orden.latitud/longitud` (de la dirección) | planificar la ruta de reparto |
| notas, producto, monto a cobrar | `Orden.notas`, `producto`, `montoCobrar` | entregar y cobrar contra entrega |
| conversación de WhatsApp | `ChatConversacion.telefonoE164`; `ChatMensaje.cuerpo`, `latitud/longitud` (ubicación compartida), `contactosJson`, `mediaId/mediaMime/mediaNombre` (solo referencia; el binario NO se guarda), reacciones, cambio de número | coordinar la entrega con el mensajero |
| fotos de evidencia | `GestionOrdenEvidencia`, `OrdenIncidenteEvidencia` (bucket privado) | probar la entrega o el incidente |

**Usuarios internos**
| Dato | Dónde | Uso |
|---|---|---|
| nombre, apellidos, cédula y tipo, correo, teléfono | `Usuario.*` | identificar la cuenta y comunicarse |
| vehículo, placa | `Usuario.vehiculoId`, `placa` | asignar repartos (mensajeros) |
| documentos de postulación | `MensajeroDocumento` (cédula anverso/reverso, propiedad anverso/reverso, foto de rostro; bucket privado) | verificar al mensajero |
| ubicación al registrar gestión | `GestionOrden.ubicacionLat/Lng` | respaldo de la gestión de entrega |
| seguridad de acceso | `LoginAttempt.ipAddress/userAgent/emailUsado`, `TrustedDevice.ipAddress/deviceHash` | proteger el ingreso |

La contraseña se guarda solo como hash (`passwordHash`); las suscripciones push
(`PushSuscripcion.endpoint/etiqueta`) son datos técnicos del navegador. Ninguna de las dos se lista
como categoría propia en R10; si el humano lo quiere, se añade (no es un dato que haya que inventar).

**Postulantes**: `PostulacionRecurso.nombre/telefono/correo/mensaje` — uso: responder la postulación.

**Lo que la página NO afirma** (abiertos 7-10): plazos de conservación o de respuesta, qué se
conserva tras una solicitud, terceros, norma aplicable.

## 4. Estilo

Reutiliza las primitivas de `app/_landing/primitivas.tsx` y los tokens de la landing
(`tema-claro`, `bg-kraft-canvas`, `text-asfalto-*`, `brand`); sin CSS suelto ni hex (DESIGN.md).
Texto en párrafos y listas `<ul>` semánticas, un `<h1>` y `<h2>` por sección. La cabecera es
`bg-navy-deep` con la marca en texto blanco y un enlace «Volver al inicio» a `/`. El pie es
`LandingFooter` tal cual. Si el humano pide `/design` (abierto 12), este apartado se sustituye por
su salida antes de implementar.

## 5. Módulo de datos legales

```ts
// app/_legal/datos-legales.ts
export interface DatosLegales {
  marca: string | null;              // abierto 5
  razonSocial: string | null;        // abierto 1
  cedulaJuridica: string | null;     // abierto 2
  correoPrivacidad: string | null;   // abierto 3
  ultimaActualizacion: string | null; // abierto 6, texto ya legible ("30 de octubre de 2026")
}
export const DATOS_LEGALES: DatosLegales = { marca: null, razonSocial: null, cedulaJuridica: null, correoPrivacidad: null, ultimaActualizacion: null };
export const MARCADOR_PENDIENTE = "[pendiente de definir]";
```

- Cambiar un dato = editar UNA línea de este archivo. Nada más del árbol de `_legal/`,
  `privacidad/` o `eliminacion-datos/` contiene esos valores ni la marca como literal (R18, lo vigila
  una guardia estática).
- `DatoLegal` pinta el valor, o `MARCADOR_PENDIENTE` dentro de un `<span data-pendiente>` si es
  `null` (R19). Con `correoPrivacidad === null` no hay `mailto:` (R21).
- `metadata` de cada `page.tsx` usa `DATOS_LEGALES.marca ?? MARCADOR_PENDIENTE` (R7).

## 6. Render estático (R5/R6)

`export const dynamic = "force-static"` en las dos `page.tsx`: Next las prerenderiza en el build y
sirve HTML completo. Ningún archivo de `_legal/`, `privacidad/` o `eliminacion-datos/` lleva
`"use client"` ni importa `next/headers`, `cookies`, Prisma o `searchParams`. `LandingFooter` es
Server Component (ya lo es) y no lee datos.

## 7. Alternativas descartadas

1. **Variables de entorno (`NEXT_PUBLIC_RAZON_SOCIAL`, …)** — Descartada. Son datos públicos sin
   secreto, así que no ganan nada por estar fuera del repo; se hornean igual en el build estático
   (cambiarlas exige redeploy de todos modos); y se configuran por entorno en Vercel, donde ya se
   midió que una variable en el entorno equivocado apunta mal sin avisar. En el repo el cambio pasa
   por PR y queda en el historial.
2. **Tabla en la base editable desde un panel** — Descartada. Volvería la página dinámica y
   dependiente de Postgres: si la base falla, el rastreador de Meta recibe un 500 y la app no pasa a
   Live. Además es modelo nuevo + migración + RLS + UI para cinco cadenas que cambian una vez.
3. **Un solo `page.tsx` dinámico `app/[legal]/page.tsx`** — Descartada: capturaría cualquier slug
   de la raíz y obligaría a un `PUBLIC_ROUTES` por prefijo amplio, justo lo que el middleware evita
   (`/` se resuelve por igualdad exacta por ese motivo).
4. **Reutilizar `LandingNav`** — Descartada: sus anclas `#servicios`… no existen fuera de `/`, y
   arrastra la isla cliente `RastreoDialog`, innecesaria aquí.
5. **Texto legal en MDX** — Descartada: añade dependencia y pipeline para dos páginas; JSX con las
   primitivas existentes basta.

## 8. Mapa de trazabilidad (R → test)

| Test | Requisitos |
|---|---|
| `tests/unit/auth/middleware-paginas-legales.test.ts` (importa el `middleware` real; mockea solo `isSessionActive`, como `middleware.test.ts`) | R1, R2, R3, R4 |
| `tests/components/paginas-legales.test.tsx` (`renderToStaticMarkup` de los cuerpos y de las `page.tsx`) | R5, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16, R17, R19, R20, R21 |
| `tests/unit/guards/paginas-legales-estaticas.guardia.test.ts` (lectura estática de archivos: `dynamic === "force-static"`, sin `"use client"`, sin `next/headers`/`cookies`/`@/lib/db`/`searchParams`; y fuente única: sin literales `Ordenex`/`Velox`/`@` de correo fuera de `datos-legales.ts`; con autocomprobación contra fuente sintético) | R6, R18 (y refuerza R5) |
| `tests/components/LandingFooter.test.tsx` | R22 |

Las aserciones de contenido (R9-R11, R15-R16) comparan contra LITERALES del spec, no contra
`DATOS_LEGALES` ni contra el propio componente (evita la aserción contra su propia fuente). R20 se
prueba con un `DatosLegales` de prueba con valores ficticios evidentes (`"RAZON-PRUEBA"`), nunca
con los reales.

## 9. Verificación

- Gate: `./init.sh --rapido` (no toca dinero ni datos; no se amplía con `integration/db`).
- La guardia nueva lee archivos con `fs` y el grafo puede no relacionarla: correrla a mano por
  nombre (`pnpm exec vitest run paginas-legales`).
- Ver la app: con el dev server, `curl -i http://localhost:3000/privacidad` y
  `/eliminacion-datos` **sin cookie** y con `-A "facebookexternalhit/1.1"` → 200 y el texto
  (p. ej. «Eliminación de datos», los marcadores de pendiente) presente en el HTML crudo.
- Tras desplegar en preview: el mismo `curl` contra la URL de preview.
