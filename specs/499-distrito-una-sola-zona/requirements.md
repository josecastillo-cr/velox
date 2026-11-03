# Ficha 499: un distrito en una sola zona

**Zona:** fullstack. **SDD:** sí. **Complejidad:** media. **Depende de:** nada pendiente.
**Implementación:** backend_dev y después frontend_dev. **Rama:** `fix/499-distrito-una-sola-zona`, desde `dev`.
**Sale con:** la próxima release a `prod`. **Gate:** `./init.sh --rapido`. Hay migración y `db/schema.prisma`, así
que se amplía solo con `tests/integration/db`.

**Fuente:** `progress/prompt-hotfix-portable.md` §H4 y `progress/inventario_hotfix_H1_H4.md` §H4 (rutas
confirmadas en el código el 2026-11-02). El bloque 6 de H5 (el rastro de distritos en el histórico) **no**
entra aquí: es la ficha 500. El retiro del respaldo también es de la 500.

## El problema

En Configuración › Tarifas › «Costos por zona», el maestro añade distritos a una zona y guarda. Al
recargar, algunos salen desmarcados, y al volver a guardar se borran de verdad. La causa: nada impide que un
distrito quede en dos zonas.

- La N:M `zona_distrito` solo es única por `(zona_id, distrito_id)` (`db/schema.prisma:683-695`).
- `ZonaService.prepararDatos` no mira si el distrito ya tiene zona. `ZonaRepository.create` y
  `ZonaRepository.update` insertan sin validar.
- `GeoRepository.listArbol` colapsa a «sin zona» un distrito que está en dos zonas.
- «Editar» (`ZonasTarifasModule.abrirEditar`) preselecciona con `d.zonaId === zona.id`, así que ese
  distrito sale desmarcado en las dos zonas, y el siguiente guardado lo borra.
- El selector (`GeografiaSelector`) deja marcar un distrito que ya está en otra zona. «Editar» puede abrir
  con un árbol anterior al último guardado.

Un distrito en dos zonas, además, hace que el alta y la cotización de órdenes fallen con «no tiene zona
asignada».

## Decisiones del humano (2026-11-02, no se reabren)

- **No hay multiempresa.** La regla es global: un distrito, como mucho una zona. No hay requisitos de «otra
  empresa» ni de RLS por empresa.
- Un distrito que ya tiene otra zona queda **bloqueado**: no se puede elegir para otra zona. Si se intenta
  guardar con él, sale un aviso de error y **no se guarda nada**.
- **Datos existentes:** **(a)** un distrito en exactamente dos zonas, una central y otra no, se queda en la
  **no central**. **(b)** Cualquier otra combinación (dos no centrales, o tres zonas o más) queda **sin
  zona**, y lo asigna el maestro desde la pantalla. Esta limpieza se escribe aunque hoy no haya nada que
  limpiar.
- La migración **no toca órdenes**. Un distrito que se queda sin zona se queda así.
- El estado `varias_zonas` de `lib/utils/cobertura-distrito.ts` se conserva como defensa.
- **Limitación aceptada (no es un requisito):** la app entra a la base con un rol con acceso total, así que
  no se puede comprobar que el respaldo sea «inaccesible para la app». Ver design §3.4.

## Glosario

- **Asignación:** una fila de `zona_distrito` (una zona y un distrito).
- **Otra zona:** al **actualizar** la zona Z, cualquier zona distinta de Z. Al **crear**, cualquier zona.
- **Conflicto:** un distrito elegido en el guardado que ya tiene una asignación a otra zona.
- **Distrito seleccionable:** en el selector, un distrito que no tiene asignación a otra zona.
- **Mensaje de recarga:** «Alguno de los elegidos acaba de asignarse a otra zona. Recarga la página y vuelve
  a intentarlo.»
- **Escritura del guardado:** cualquier cambio en `zona`, `zona_distrito`, `tarifa_zona_mensajero`, la marca
  `es_central` (también la que se le quita a otra zona), el historial de acciones (`historial_accion`) o
  `orden.zona_id`.

## Requisitos

### A. La base de datos

- **R1.** El sistema DEBE rechazar en la base de datos toda asignación cuyo distrito ya tenga otra
  asignación, también cuando la fila se inserta directamente, sin pasar por la app.
- **R2.** CUANDO se aplica la migración de limpieza, SI un distrito tiene exactamente dos asignaciones y una
  de ellas es a la zona central, ENTONCES el sistema DEBE conservar solo la asignación a la zona no central.
- **R3.** CUANDO se aplica la migración de limpieza, SI un distrito tiene dos asignaciones a zonas no
  centrales, o tres o más asignaciones, ENTONCES el sistema DEBE quitar todas sus asignaciones.
- **R4.** CUANDO la migración de limpieza quita una asignación, el sistema DEBE haberla copiado antes al
  respaldo con su `id`, `zona_id`, `distrito_id` y el instante del respaldo. NO DEBE borrar ninguna
  asignación que no esté en el respaldo.
- **R5.** SI ningún distrito tiene más de una asignación, ENTONCES la migración de limpieza NO DEBE borrar
  ninguna asignación y el respaldo DEBE quedar vacío.
- **R6.** La migración de limpieza NO DEBE modificar ninguna fila de `orden`, `zona`, `distrito`,
  `tarifa_zona_mensajero` ni `historial_accion`.
- **R7.** SI al aplicar la migración del índice queda algún distrito con más de una asignación, ENTONCES esa
  migración DEBE fallar sin crear el índice.
- **R8.** CUANDO se revierte la ficha (los `down.sql`, en orden inverso), el sistema DEBE quitar el índice
  de R1, restaurar las asignaciones respaldadas cuya zona y cuyo distrito sigan existiendo, borrar solo la
  tabla de respaldo de esta ficha y borrar el esquema de respaldo solo si queda vacío. Volver a aplicar las
  dos migraciones tras revertirlas DEBE dar el mismo estado que la primera aplicación.

### B. El guardado de una zona

- **R9.** CUANDO el maestro crea una zona con algún conflicto, el sistema DEBE rechazar el guardado sin
  hacer ninguna escritura del guardado. Tampoco DEBE quitar la marca de central a la zona que la tenga.
- **R10.** CUANDO el maestro actualiza una zona que existe con algún conflicto, el sistema DEBE rechazar el
  guardado sin hacer ninguna escritura del guardado: ni el nombre, ni los distritos, ni las tarifas, ni la
  marca, ni la reconciliación de órdenes, ni el historial.
- **R11.** CUANDO se rechaza un guardado por R9 o R10, el sistema DEBE responder `validation_error` con
  `fieldErrors.distritoIds`: un mensaje por conflicto, con el texto «`<distrito>` ya está en la zona
  `<zona>`.», en orden alfabético español del nombre del distrito.
- **R12.** CUANDO el maestro actualiza una zona con distritos sin conflicto (los suyos sin cambios, menos de
  los suyos, o con distritos libres añadidos), el sistema DEBE guardar y responder `ok`, igual que antes de
  esta ficha.
- **R13.** SI la base rechaza un guardado por el índice de R1 (un guardado simultáneo asignó el mismo
  distrito a otra zona), ENTONCES el sistema DEBE responder `validation_error` con
  `fieldErrors.distritoIds` igual a solo el mensaje de recarga, sin hacer ninguna escritura del guardado y
  sin responder nunca un error interno.
- **R14.** SI la zona que se actualiza no existe, ENTONCES el sistema DEBE responder `not_found` aunque
  algún distrito elegido esté en otra zona.

### C. El árbol geográfico

- **R15.** El sistema DEBE devolver, para cada distrito del árbol geográfico, la lista de las zonas a las que
  está asignado (`id` y `nombre`), en orden alfabético español del nombre. La lista va vacía si el distrito
  no tiene zona.
- **R16.** El sistema DEBE seguir devolviendo en el árbol `zonaId` y `zonaNombre` con el colapso actual: la
  zona si hay exactamente una y `null` si no hay ninguna o hay más de una.

### D. La pantalla «Costos por zona»

- **R17.** MIENTRAS el formulario de zona está abierto, el selector DEBE deshabilitar la casilla de cada
  distrito con asignación a otra zona y mostrar junto a él «(zona: `<nombre>`)».
- **R18.** MIENTRAS se edita una zona, el selector DEBE dejar marcar y desmarcar los distritos de esa misma
  zona.
- **R19.** CUANDO el maestro marca o desmarca un cantón o una provincia, el selector DEBE marcar o desmarcar
  solo los distritos seleccionables de ese grupo.
- **R20.** El selector DEBE calcular el estado de un cantón o una provincia (marcado, indeterminado o vacío)
  solo sobre sus distritos seleccionables. SI un grupo no tiene ninguno, ENTONCES DEBE deshabilitar su
  casilla.
- **R21.** CUANDO el maestro pulsa «Crear zona» o «Editar», el sistema DEBE volver a leer el árbol
  geográfico antes de abrir el formulario. SI esa lectura falla, ENTONCES NO DEBE abrir el formulario y DEBE
  mostrar un toast de error.
- **R22.** CUANDO se abre «Editar» de una zona Z, el selector DEBE preseleccionar exactamente los distritos
  cuya lista de zonas (R15) contiene Z, también justo después de guardar otra zona sin recargar la página.
- **R23.** CUANDO un guardado responde `validation_error` con `fieldErrors.distritoIds`, la pantalla DEBE
  mostrar todos esos mensajes bajo el selector y un toast con el primero. SI hay N > 1 mensajes, ENTONCES el
  toast DEBE decir además cuántos más hay, N−1 (el texto exacto está en design §6.4).
- **R24.** CUANDO un guardado de zona responde `conflict`, el toast NO DEBE mencionar distritos.

### E. La defensa que se conserva

- **R25.** SI un distrito llega a la clasificación de cobertura con más de una zona, ENTONCES el sistema DEBE
  seguir clasificándolo como `varias_zonas` y sin cobertura.

## Trazabilidad prevista

Las tareas están en `tasks.md` y las mutaciones en design §9.

| Req | Test |
|---|---|
| R1, R7 | `tests/integration/db/zona-distrito-499-migration.test.ts` (insert directo rechazado; índice sobre duplicados aborta) |
| R2-R6, R8 | `tests/integration/db/zona-distrito-499-migration.test.ts` |
| R9-R12, R14 | `tests/integration/db/zona-distrito-unico-499.test.ts` (repositorio y service contra Postgres) |
| R11 (orden), R13 (texto) | `tests/unit/services/zona-service-499.test.ts` |
| R13 | `tests/integration/db/zona-distrito-unico-499.test.ts` (carrera real con dos conexiones) |
| R15, R16 | `tests/unit/repositories/geo-repository-arbol-499.test.ts` y un caso en `zona-distrito-unico-499.test.ts` |
| R17-R20 | `tests/components/GeografiaSelectorZonaUnica.test.tsx` |
| R21-R24 | `tests/components/ZonasTarifasDistritoUnico.test.tsx` |
| R25 | `tests/unit/utils/cobertura-distrito.test.ts` (ya existe; debe seguir verde sin cambios en sus casos de `varias_zonas`) |

## Preguntas abiertas

1. **Texto del toast de R23 con varios conflictos.** El documento dice «el primero más " y N más."». El
   primer mensaje ya termina en punto, así que pegarlo tal cual da «San Pedro ya está en la zona Este. y 2
   más.». Mientras no se diga otra cosa, el design §6.4 fija **«San Pedro ya está en la zona Este (y 2
   más).»** (se quita el punto final del primero). ¿Vale ese texto?
