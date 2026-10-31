# 490 — Páginas públicas de privacidad y eliminación de datos · requirements

> Zona: `frontend` · SDD · complejidad `small` · rama `feat/490-paginas-legales`.
> Motivo: Meta exige una URL de política de privacidad y una de instrucciones de eliminación de
> datos para pasar la app de WhatsApp Cloud API a modo Live (fase 0.6 de
> `progress/traspaso_meta_whatsapp.md`). El rastreador de Meta las pide SIN sesión y lee el HTML
> que devuelve el servidor.

## Glosario

- **Página de privacidad**: la ruta `/privacidad`.
- **Página de eliminación**: la ruta `/eliminacion-datos`.
- **Páginas legales**: las dos anteriores.
- **Datos legales**: marca, razón social, cédula jurídica, correo de contacto de privacidad y fecha
  de última actualización. Sus valores están ABIERTOS (ver «Preguntas abiertas»).
- **Marcador de pendiente**: el texto visible que ocupa el lugar de un dato legal sin definir.
- **Destinatario**: el cliente final de un envío (quien recibe el paquete).
- **Usuario interno**: toda cuenta con login (maestro, admin, mensajero, tienda, satélite, API key).
- **Postulante**: quien deja sus datos en el formulario público de postulación de recurso.

## Acceso público

- **R1** — CUANDO llega una petición `GET /privacidad` sin cookie de sesión, el sistema DEBE
  responder 200 con la página de privacidad, sin redirigir y sin consultar la base de datos.
- **R2** — CUANDO llega una petición `GET /eliminacion-datos` sin cookie de sesión, el sistema DEBE
  responder 200 con la página de eliminación, sin redirigir y sin consultar la base de datos.
- **R3** — CUANDO llega una petición a cualquiera de las páginas legales con una cookie de sesión
  (válida o no), el sistema DEBE servir la página igual que sin cookie, sin redirigir a
  `/dashboard` ni a `/login` y sin consultar la base de datos.
- **R4** — SI la ruta pedida solo comparte prefijo de texto con una página legal sin ser ella ni
  colgar de ella (p. ej. `/privacidad-admin`, `/eliminacion-datosx`), ENTONCES el sistema DEBE
  tratarla como ruta privada (307 a `/login` sin sesión).

## Legible por el rastreador

- **R5** — El sistema DEBE entregar el texto completo de cada página legal en el HTML de la
  respuesta del servidor, sin depender de JavaScript del navegador para mostrarlo.
- **R6** — El sistema DEBE generar las páginas legales de forma estática (sin leer cookies,
  cabeceras, parámetros de búsqueda ni la base de datos al servir la petición).
- **R7** — Cada página legal DEBE declarar un título de documento y una descripción que incluyan
  la marca tomada de los datos legales.
- **R8** — Cada página legal DEBE tener exactamente un encabezado de nivel 1.

## Contenido de la página de privacidad

- **R9** — La página de privacidad DEBE enumerar los datos que se guardan de los destinatarios:
  nombre, teléfono, dirección de entrega (con provincia, cantón y distrito), ubicación
  geocodificada de esa dirección, notas y contenido del envío, monto a cobrar, mensajes de WhatsApp
  intercambiados (texto, ubicaciones compartidas, contactos compartidos y referencias a archivos
  adjuntos) y fotografías de evidencia de la entrega.
- **R10** — La página de privacidad DEBE enumerar los datos que se guardan de los usuarios
  internos: nombre y apellidos, número y tipo de identificación, correo electrónico, teléfono,
  vehículo y placa (mensajeros), documentos de postulación de mensajeros (fotografías de la
  identificación, de la propiedad del vehículo y del rostro), ubicación al registrar una gestión de
  entrega, y datos de seguridad de acceso (dirección IP y navegador de los intentos de ingreso y de
  los dispositivos de confianza).
- **R11** — La página de privacidad DEBE enumerar los datos que se guardan de los postulantes:
  nombre, teléfono, correo electrónico y el mensaje que escriben.
- **R12** — La página de privacidad DEBE indicar, para cada grupo de R9-R11, para qué se usan esos
  datos, limitándose a las funciones que la aplicación realiza (ver `design.md` §3).
- **R13** — La página de privacidad DEBE mostrar los datos legales (marca, razón social, cédula
  jurídica, correo de contacto de privacidad y fecha de última actualización).
- **R14** — La página de privacidad DEBE incluir un enlace a la página de eliminación.

## Contenido de la página de eliminación

- **R15** — La página de eliminación DEBE explicar que la eliminación se solicita por correo
  electrónico y mostrar el correo de contacto de privacidad como enlace `mailto:`.
- **R16** — La página de eliminación DEBE indicar qué datos debe incluir la solicitud para
  identificar a la persona: nombre, teléfono con el que se relaciona y, si es destinatario, el
  número de guía cuando lo tenga.
- **R17** — La página de eliminación DEBE mostrar la marca, la razón social y la fecha de última
  actualización tomadas de los datos legales, y un enlace a la página de privacidad.

## Datos legales en un solo sitio

- **R18** — El sistema DEBE tomar todos los datos legales que muestran las páginas legales de un
  único módulo de configuración; ningún otro archivo de las páginas legales DEBE contener esos
  valores ni la marca como literal.
- **R19** — MIENTRAS un dato legal no esté definido, las páginas legales DEBEN mostrar en su lugar
  el marcador de pendiente, de forma visible, y NO DEBEN mostrar un valor sustituto.
- **R20** — CUANDO un dato legal esté definido en el módulo de configuración, las páginas legales
  DEBEN mostrar ese valor y no el marcador de pendiente.
- **R21** — SI el correo de contacto de privacidad no está definido, ENTONCES la página de
  eliminación NO DEBE pintar un enlace `mailto:` (muestra el marcador de pendiente como texto).

## Enlace desde la landing

- **R22** — El pie de la landing pública DEBE enlazar «Política de Privacidad» a `/privacidad` y
  ofrecer un enlace «Eliminación de datos» a `/eliminacion-datos`.

## Preguntas abiertas

Ninguna se rellena en el spec ni en el código: mientras no se respondan, su valor es `null` en el
módulo de datos legales y la página muestra el marcador de pendiente (R19).

1. **Razón social** de quien trata los datos.
2. **Cédula jurídica**.
3. **Correo de contacto de privacidad** (destino de las solicitudes de eliminación).
4. **¿Hay texto legal propio del dueño?** Si lo hay, sustituye al texto básico de este spec y
   R9-R12/R15-R16 se reescriben sobre él; si no, se publica el texto básico.
5. **Marca a mostrar**: «Velox Courier» u «Ordenex». El dominio ya es `velox-courier.company`.
   Nota: el `Logo` compartido es un wordmark fijo «Ordenex»; por eso las páginas legales NO lo usan
   (ver design §4).
6. **Fecha de última actualización** que se publica (por defecto, la del día en que se cierren los
   datos 1-5; la decide el humano).
7. **Plazo de respuesta** a una solicitud de eliminación: no está en `docs/` ni en el código. Sin
   dato, la página no promete ningún plazo.
8. **Qué se conserva pese a la solicitud.** El esquema guarda historial de órdenes, movimientos de
   dinero y evidencias con FK `RESTRICT` («la autoría es evidencia y no se pierde»). Hay que decidir
   si la página dice que ciertos registros se conservan por obligación legal/contable, y cuáles. Sin
   decisión, la página no afirma ni que todo se borra ni que algo se conserva.
9. **Terceros que procesan datos** (p. ej. Meta/WhatsApp, el proveedor de base de datos, el de
   alojamiento, el de geocodificación, el de correo). ¿Se nombran? Sin decisión, la página no
   nombra ninguno.
10. **Marco legal a citar** (p. ej. la ley costarricense de protección de datos). Sin decisión, no
    se cita ninguna norma.
11. **Pie de la landing**: muestra «© 2026 · Ordenex S.A.» y el wordmark Ordenex fijos. ¿Debe leer
    también la marca/razón social del módulo de datos legales? Queda FUERA de esta ficha salvo que
    el humano lo pida (R22 solo toca los enlaces).
12. **/design**: las dos pantallas son nuevas. ¿Pasan por `/design` antes de implementar, o basta
    con reutilizar las primitivas de la landing (design §4)? Lo decide el humano.
