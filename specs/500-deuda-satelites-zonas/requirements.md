# Ficha 500 — La deuda de H3 y H4: satélites al conciliar y distritos de zonas

> **Origen.** H5 de `progress/prompt-hotfix-portable.md` (líneas 667-766 y checklist 825-828), bloques
> 2, 3, 4, 6, 7, 8 y 9. El bloque 1 ya es la ficha 495 (en producción) y el bloque 5 está **descartado**
> (no hay multiempresa). Inventario previo: `progress/inventario_hotfix_H2_H3_H5.md` §3.
>
> **Depende de:** 498 (mergeada en `dev`, PR #883, sin desplegar) y 499 (en producción).
>
> **Regla de esta ficha:** arreglar lo evidenciado, no rediseñar. Antes de escribir un requisito se midió
> en el código de `dev` (HEAD `0c18a7aa`) qué dejó hecho la 498. Solo se especifica lo que falta.
>
> **Búsqueda.** El grafo `codebase-memory` se usó como pista; cada símbolo citado se confirmó leyendo el
> archivo real en `dev`, porque la 498 entró hace horas y el índice puede no tenerla.

---

## 0 · Auditoría: qué de H5 ya está en `dev`

| Bloque H5 | Estado | Evidencia en `dev` |
| --- | --- | --- |
| **2.** «Desmarcar» solo cuando se puede | **Parcial** | El servidor ya rechaza: `revertirConciliacion` responde `con_asientos` (`lib/repositories/CierresBodegaAdminRepository.ts:648`) y `saldada_regla_anterior` (`:652-658`). Pero la pantalla ofrece «Desmarcar» en **toda** consolidación no pendiente (`components/shared/conciliacion/ConciliacionAcciones.tsx:217-230`), y el criterio vive en un método **privado** de una sola consolidación (`tieneAsientos`, `:885-895`). No existe la función compartida `consolidacionesConDinero(ids)` y ninguna lectura de pantalla trae el dato (`SaldosSatelitesRepository.ts:88-119`, `CierreBodegaRepository.ts:112-155`, `CierresBodegaAdminRepository.ts:358-413`). |
| **3.** Revertir no deja una diferencia huérfana | **Hecho en código por la 498; falta su test** | `tieneAsientos` mira primero la tabla de ajustes (`CierresBodegaAdminRepository.ts:886`) y después los tres libros. Pero el test de revertir (`tests/integration/db/498-conciliar-asienta-sql-real.test.ts:349-388`) solo cubre: consolidación con asientos de cierres, consolidación sin nada y saldada. Ningún caso tiene **solo** un ajuste, que es justo el defecto de H5. |
| **4.** Una sola fórmula del esperado | **Hecho en código por la 498; falta el test literal de H5** | El esperado del ajuste sale de `aporteDeConsolidacion` (`CierresBodegaAdminRepository.ts:843`), la misma que alimenta «Falta por recibir» (`CierreBodegaRepository.ts:116,144`; `SaldosSatelitesRepository.ts:89,101`), y esta delega en `paraLaCentral` (`lib/utils/conciliacion-satelite.ts:43-52`). Ningún test fija el caso de H5 (snapshot 9.000 / pago 1.500 / ganancia por rechazos 500 / recibido 6.900). |
| **5.** Aislamiento por empresa | **Descartado** | Decisión del humano: no hay multiempresa. |
| **6.** Rastro de distritos en el histórico | **Falta entero** | No existe `zona_distrito_cambiado` ni en el enum (`db/schema.prisma`, valores de zona en `:4048-4081`) ni en los catálogos (`lib/types/historial-accion.ts:56`, `:402`, `:492`). `ZonaRepository.update` reemplaza la N:M (`lib/repositories/ZonaRepository.ts:476-481`) y solo escribe `orden_zona_reconciliada` (`:589`), `zona_central_cambiada` (`:623`) y `zona_pago_mensajero_cambiado` (`:671`). Lo que la 499 dejó hecho y aquí se reutiliza: el rechazo de conflictos antes de escribir (`:419-422`) y el índice único (`db/schema.prisma:695`). |
| **7.** Textos definitivos | **Parcial** | Los textos de H3 ya son literales y tienen test (498: R37, R40, R43; `progress/impl_498.md:370-371` los da por confirmados). Queda **una** marca de provisional: el comentario de `lib/constants/wallet-rotulos.ts:69-72` («Texto PROVISIONAL del backend; lo confirma T7.1»). No hay marcas en tests. |
| **8.** Retirar los respaldos | **Falta; puerta propia, NO autorizado** | Hay dos tablas: `respaldo.zona_distrito_499` (`db/migrations/20261102130000_zona_distrito_limpieza_499/migration.sql:17-30`, **en producción**) y `respaldo.asientos_satelite_498` (`db/migrations/20261103120200_satelite_498_retirar_asientos/`, en local y en preview, **no** en producción: `progress/current.md:1-3`). Los dos `down.sql` leen su respaldo sin comprobar que exista (`…_499/down.sql:11-18`, `…_498_retirar_asientos/down.sql:10-23`). |
| **9.** Tests inestables | **No aplica** | Los tests de migración de la 498 y la 499 ya toman `serializarEscriturasReales` como primera sentencia (`tests/integration/db/_postgres-real.ts:263-274`). Las FK nuevas de la 498 son `ON DELETE RESTRICT ON UPDATE CASCADE` (`20261103120100_satelite_498_ajuste/migration.sql:32,34`): no hay ningún `ON UPDATE RESTRICT` que dé 23503 o 23001 según versión. Ningún test de la 498/499 hace `EXPLAIN`. La geografía de los tests de la 499 usa un cantón fijo (`FKS.cantonId`) y no hay país por empresa. |

Bloques 3 y 4: el código está entero y **no se toca**. Solo se añaden los tests que H5 pide con su
contraprueba (R9, R10, R11).

---

## Vocabulario

| Término | Qué significa aquí |
| --- | --- |
| **consolidación** | `cierre_bodega`: agrupa cierres satélite aprobados de una zona satélite. |
| **los tres libros** | `wallet_movimiento`, `wallet_tienda_movimiento` y `pago_mensajero_movimiento`. |
| **fila de ajuste** | Fila de `conciliacion_bodega_ajuste` (la diferencia escrita al marcar o al corregir; ficha 498). |
| **con dinero** | Consolidación con al menos una fila de ajuste, o con al menos una fila en alguno de los tres libros cuyo origen sea `cierre_dia` y uno de sus cierres. Es el mismo predicado que hoy usa `tieneAsientos`. |
| **saldada con la regla anterior** | Consolidación con `esperado_regla_anterior` no nulo (ficha 498, Q4). |
| **las dos pantallas de conciliación** | El desglose por bodega de `/wallet/satelites` y el detalle de una consolidación en `/cierres-admin`. Las dos montan `ConciliacionAcciones`. |
| **guardar la edición de una zona** | El camino de `actualizarZona` → `ZonaRepository.update`. Crear y borrar una zona no lo son. |
| **texto del distrito** | `<nombre del distrito> (<nombre de su cantón>)`, recortado a 60 caracteres (ver Q2). |

---

## A · «Desmarcar» solo cuando se puede (bloque 2)

**R1.** El sistema DEBE decidir si una consolidación tiene dinero con una única función compartida que,
dado un conjunto de consolidaciones, devuelve cuáles de ellas están con dinero.

**R2.** CUANDO se revierte una consolidación con dinero, el sistema DEBE responder `con_asientos` usando
la función de R1, sin cambiar la consolidación, ni las filas de ajuste, ni los tres libros, ni el
historial.

**R3.** CUANDO una de las dos pantallas de conciliación muestra una consolidación conciliada, el sistema
DEBE ofrecer «Desmarcar» solo si la consolidación no está con dinero y no está saldada con la regla
anterior.

**R4.** SI el sistema ofrece «Desmarcar» para una consolidación, ENTONCES revertirla en ese mismo estado
de la base DEBE tener éxito; y SI no lo ofrece para una consolidación conciliada, ENTONCES revertirla
DEBE responder `con_asientos` o `saldada_regla_anterior`.

**R5.** MIENTRAS la marca de una consolidación esté incompleta (recibido menor que lo que debe), el
sistema DEBE seguir ofreciendo «Corregir», tenga o no dinero.

**R6.** SI quien monta las acciones de conciliación no indica si la consolidación se puede desmarcar,
ENTONCES el sistema NO DEBE ofrecer «Desmarcar».

**R7.** CUANDO el servidor responde `con_asientos` o `saldada_regla_anterior` a un «Desmarcar» que se
ofreció con datos ya viejos, la pantalla DEBE seguir mostrando el aviso de la ficha 498 dentro del
diálogo, sin cambiar la marca.

**R8.** La ayuda de usuario de Wallet · Satélites DEBE decir que «Desmarcar» solo aparece en una
consolidación que todavía no movió dinero en la caja.

## B · Revertir con una diferencia escrita (bloque 3)

**R9.** SI una consolidación conciliada tiene al menos una fila de ajuste y ninguna fila de los tres
libros con origen en sus cierres, ENTONCES revertirla DEBE responder `con_asientos` sin cambiar la
consolidación, ni sus filas de ajuste, ni el movimiento de caja de la diferencia, ni el historial.

## C · Una sola fórmula del esperado (bloque 4)

**R10.** CUANDO se marca recibida, con 6.900,00, una consolidación cuyo snapshot tiene total general
9.000,00, pago a mensajeros 1.500,00 y ganancia por rechazos 500,00, el sistema DEBE escribir una fila
de ajuste con esperado 7.000,00, recibido 6.900,00 y diferencia 100,00, y un egreso de caja «diferencia
de la satélite» de 100,00.

**R11.** Para una misma consolidación, el «Falta por recibir» que muestran las pantallas antes de
marcarla DEBE ser igual al esperado que escribe la fila de ajuste al marcarla.

## D · Rastro de los distritos de una zona (bloque 6)

**R12.** CUANDO se guarda la edición de una zona y su conjunto de distritos cambia, el sistema DEBE
escribir en el historial de acciones una fila `zona_distrito_cambiado` por cada distrito añadido y una
por cada distrito quitado, en la misma transacción que el guardado.

**R13.** Todas las filas `zona_distrito_cambiado` de un mismo guardado DEBEN compartir un mismo lote, y
ese lote DEBE ser distinto del de cualquier otra acción escrita por ese guardado.

**R14.** En la fila de un distrito añadido, el valor anterior DEBE ir vacío y el valor nuevo DEBE ser el
texto del distrito; en la de un distrito quitado, al revés.

**R15.** El texto del distrito DEBE ser `<distrito> (<cantón>)` con los nombres de catálogo, y NO DEBE
pasar de 60 caracteres.

**R16.** Cada fila `zona_distrito_cambiado` DEBE identificar la zona (tipo de entidad zona, su id y su
nombre después del guardado) y a quien guardó, y NO DEBE llevar monto.

**R17.** SI el conjunto de distritos de la zona no cambia (aunque llegue en otro orden o con repetidos),
ENTONCES el sistema NO DEBE escribir ninguna fila `zona_distrito_cambiado`.

**R18.** SI el guardado se rechaza (zona inexistente, quitar la única zona central, distrito en otra zona)
o falla, ENTONCES el sistema NO DEBE dejar ninguna fila `zona_distrito_cambiado`.

**R19.** CUANDO se crea o se borra una zona, el sistema NO DEBE escribir ninguna fila
`zona_distrito_cambiado`.

**R20.** El sistema DEBE clasificar `zona_distrito_cambiado` en la categoría «mueve dinero» y rotularla
«Cambió los distritos de una zona».

**R21.** El historial de acciones DEBE mostrar las filas `zona_distrito_cambiado` con su valor anterior y
su valor nuevo, encontrarlas al filtrar por la categoría «mueve dinero» y por la propia acción, e
incluirlas en su descarga con los mismos valores.

**R22.** CUANDO se revierte la migración que añade el valor `zona_distrito_cambiado`, el sistema DEBE
quitar solo ese valor, conservando cualquier valor del tipo añadido por otra migración; y SI alguna fila
del historial lo usa, ENTONCES DEBE abortar sin borrar nada.

## E · Textos definitivos (bloque 7)

**R23.** Ningún archivo de `lib/`, `app/`, `components/` ni `tests/` DEBE marcar como provisional los
textos de la ficha 498: la nota de la conciliación, las pistas del bloque «Por cobrar a satélites», el
dueño «Satélite» y las etiquetas de las dos categorías de diferencia de la satélite.

## F · Retirar los respaldos (bloque 8) — puerta propia

> **Puerta P8 (no es un requisito de código; la cumple el leader con el humano).** Nada de esta sección
> se implementa en la rama de los bloques 2-7 ni se mergea a `dev` hasta que se cumplan, en este orden:
>
> 1. la 498 está desplegada en producción y su verificación posterior (T8.3 de la 498) está hecha;
> 2. se corrió en producción, en solo lectura, la medición de `design.md` §6.1 y **ninguna** de sus
>    comprobaciones de H3/H4 dio distinto de 0;
> 3. el humano leyó esas cifras y **autorizó por escrito** el retiro.
>
> Este spec **no** da esa autorización. Retirar los respaldos es irreversible.

**R24.** CUANDO se aplica la migración de retiro, el sistema DEBE borrar las tablas
`respaldo.asientos_satelite_498` y `respaldo.zona_distrito_499` si existen, todo en un solo bloque que
se aplica entero o no se aplica.

**R25.** CUANDO, tras borrar esas tablas, el esquema `respaldo` queda vacío, la migración de retiro DEBE
borrarlo; SI el esquema tiene otros objetos, ENTONCES DEBE dejarlo intacto, emitir un aviso y no fallar.

**R26.** La migración de retiro NO DEBE crear, cambiar ni borrar ninguna tabla, fila, tipo ni restricción
del esquema `public`.

**R27.** CUANDO se aplica la migración de retiro sobre una base donde las tablas de respaldo o el esquema
ya no existen, el sistema DEBE terminar sin error.

**R28.** CUANDO se revierte la migración de retiro, el sistema NO DEBE recrear los respaldos, ni vacíos, y
su `down.sql` DEBE decir por escrito que los datos retirados no se recuperan.

**R29.** DONDE la respuesta a Q1 sea la opción A, CUANDO se revierte la migración de retiro de asientos
de la 498 sin su tabla de respaldo, el sistema DEBE fallar con un mensaje que nombre la migración de
retiro de la 500 y diga que los asientos retirados no se pueden devolver, sin cambiar ningún libro.

**R30.** DONDE la respuesta a Q1 sea la opción A, CUANDO se revierte la limpieza de la 499 sin su tabla de
respaldo, el sistema NO DEBE fallar, NO DEBE tocar `zona_distrito` y DEBE emitir un aviso.

---

## Fuera de alcance

- Bloque 1 (fechas de cierre en hora de Costa Rica): ficha 495, ya en producción.
- Bloque 5 (aislamiento por empresa): descartado, no hay multiempresa.
- Bloque 9: no aplica (tabla de §0). Si un test de esta ficha cae en uno de esos modos, se arregla en el
  propio test, no en una ficha aparte.
- Reabrir decisiones de la 498 (etiquetas, deuda sobre todos los métodos, una conciliación con dinero no
  se revierte, saldadas con la regla anterior).
- Ofrecer «Corregir» sobre una consolidación recibida completa: hoy no se ofrece (ficha 473) y H5 no lo
  pide.
- El tono mezclado (tuteo y voseo) de la ayuda: hallazgo m5 de `progress/review_498.md`, ficha de textos
  aparte.
- Las cifras de producción de P8: se dicen en el chat y no se escriben en el repositorio.

---

## Preguntas abiertas

**Q1 — Los `down.sql` de la 498 (M3) y de la 499 (limpieza), después del retiro.** H5 pide cambiarlos
«solo si aún no se aplicaron en ningún entorno; si no, en migración nueva». Las dos ya se aplicaron (la
499 en producción; la 498 en local y en preview), y un `down.sql` no se puede cambiar desde una migración
nueva. Hoy, después del retiro, los dos fallarían con «la relación no existe». Opciones:
**(A)** editar esos dos `down.sql` para que se comporten como dice H5 (R29, R30). Prisma no guarda
checksum de `down.sql`, así que no produce drift, pero rompe la costumbre del repo de no tocar los
`down.sql` ya aplicados. **(B)** no tocarlos, y que la migración de retiro diga en su cabecera y en su
`down.sql` que después de ella esos dos `down` fallan y que la vuelta atrás es manual. En ese caso R29 y
R30 no aplican. ¿A o B? Si no hay respuesta, el spec sigue con **B**.

**Q2 — El texto del distrito en el histórico.** H5 escribe `«<distrito> (<cantón>)»`. ¿Las comillas
angulares van dentro del valor guardado (`«Carmen (San José)»`) o son solo la forma de citarlo en el
documento (`Carmen (San José)`)? El precedente del repo (`nodo_geografico_renombrado`) guarda el nombre
sin comillas. Si no hay respuesta, el spec sigue **sin comillas**.

## Respuestas del humano (2026-11-03, 19:00)

- **Spec APROBADO.**
- **Q1 → B.** Los `down.sql` de la 498 (M3) y de la 499 no se tocan; la migración de retiro lo declara en su cabecera y en su `down.sql`. R29 y R30 NO aplican.
- **Q2 → sin comillas.** Se guarda `Carmen (San José)`, como `nodo_geografico_renombrado`.
