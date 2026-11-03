# Revisión — Ficha 497 (confirmación física incluye las barridas del cierre, H2 portado)

> Reviewer, 2026-11-03. Worktree `wt-497`, rama `fix/497-confirmacion-fisica-sin-gestion`, HEAD
> revisado `3f8dfa1f` (incluye merge de dev `1de1ef43`; `origin/dev` va 2 commits por delante, solo
> `feature_list.json` y `docs/api/CHANGELOG.md`, sin migraciones). Búsqueda: `grep` y `git diff`
> sobre el diff exacto de la rama, leyendo cada archivo real (el diff está acotado; el MCP
> `codebase-memory` no hizo falta). No edité código. Las mutaciones que apliqué las restauré con
> `git checkout`, y `git status` quedó sin cambios rastreados.

## Veredicto: **APROBADO**

No hay bloqueantes. Hay cinco hallazgos menores, documentales o de coherencia, y ninguno afecta a la
aprobación de cierres ni al dinero.

---

## Checklist

### Especificación
- [x] Existen `requirements.md` (EARS, R1-R41), `design.md` (con las alternativas A-G descartadas) y
  `tasks.md`.
- [~] Todas las tasks en `[x]` salvo **T3.7** y **T5.2**. El gate que piden ya está corrido
  (`gate_497_1.log`); lo que falta es el PR y `gh pr checks`, que son del leader (m1).

### Trazabilidad (R -> test con aserción real)
- [x] **R1-R4.** `tests/unit/types/gestion-retorno.test.ts`: literal escrito a mano,
  `@ts-expect-error` ante un tercer origen y `switch` sin `default`. La guardia
  `confirmacion-incidentes-excluidos` suma dos casos con autocomprobación en los dos sentidos.
- [x] **R5-R9.** Repo unit «497/R5-R9» e integración «A · la lectura» contra Postgres: dos cierres
  reales, guía viva cambiada, otra satélite, la central y un cierre inexistente.
- [x] **R10-R18, R20, R21.** Servicio «497/…». Cubre:
  - falta, sobra, duplicada y guía distinta de la congelada;
  - origen cruzado en los dos sentidos;
  - sin guía, con entrada y sin ella;
  - petición sin cuarto argumento;
  - casos mixtos y toda lista parcial;
  - actor `adminSatelite`.

  En todos se comprueba que `resolverCierre` no se llama.
- [x] **R19.** Servicio, integración, schema (forma byte a byte) y componente (el payload solo lleva
  `{ gestionId, numGuia }`).
- [x] **R22-R24, R27-R29.**
  - Repo unit: WHERE `{ cierreId, ordenId IN }` con testigo del `cierreId`; `data` con una sola
    clave; un `count` corto lanza; el rechazo y el cierre ya resuelto no escriben.
  - Integración: se marcan todas las barridas liberadas; los congelados no cambian; la segunda
    aprobación da `conflict` sin reescribir; un `count` corto con savepoint real revierte la
    aprobación, la liberación, las marcas y el dinero; el rechazo no deja marcas.
- [x] **R25, R41.** `497-cierre-sin-gestion-confirmacion-migration.test.ts`: la columna es nullable,
  sin default ni índice; la auditoría tiene autocomprobación; el `down.sql` real se ejecuta dos veces
  dentro de una transacción que se revierte.
- [x] **R26.** `[=]` `confirmacion-sin-lectores.guardia.test.ts`, en verde.
- [x] **R30-R38.** `tests/components/CierresAdminConfirmacionFisica.test.tsx`, bloques «497/…».
  - R35 afirma que el aviso precede a la primera fila (`compareDocumentPosition`).
  - R38: un cierre con solo `entregado` y una barrida abre la ventana y no llama a la action.
- [x] **R39.** Integración: huella de dinero y totales iguales con y sin barridas. Servicio
  «497/R29/R39»: los cinco feeds coinciden campo a campo, con el contrapunto de que sí mueven
  dinero.
- [x] **R40.** `git diff` vacío sobre `tests/unit/repositories/cierres-admin-caja-cod.test.ts`, y la
  suite en verde.
- [x] **Rojo previo documentado.** T1.1 y T1.2 en el backend; en la UI, 10 de 12 casos. Los 2 que
  pasaban ya eran la pareja de ausencia y R19, como se esperaba.
- [x] Los mapas R -> test están en `impl_497_backend.md` y `impl_497_frontend.md`.

### Puntos pedidos por el leader

1. **Trazabilidad y mutaciones.** Están documentadas las 8 del design y 3 extra del frontend. Repetí
   tres por mi cuenta, y las tres mueren:
   - **M1.** Servicio: omitir del barrido final las barridas sin guía. Esto permitiría aprobar con un
     paquete sin escanear. Rojo: «R16: barrida SIN guia congelada y SIN entrada» (1 rojo, ver m4).
   - **M2.** Repo: quitar `cierreId` del WHERE de `findBarridasDelCierre`. 4 rojos: 2 unit y 2 de
     Postgres.
   - **M3.** UI: mandar la barrida como `{ gestionId }`. 2 rojos en el componente.
2. **Servidor.**
   - La cobertura es exacta: gestiones que vuelven más **todas** las barridas. Las barridas se leen
     del registro persistido, con el alcance en el WHERE.
   - Se valida en `validarConfirmacionFisica`, **antes** de abrir la transacción.
   - El error va por fila: falta, sobra, duplicada, guía distinta, sin guía y origen cruzado. Cada
     entrada se busca solo en el mapa de su clave.
   - El atajo de R19 exige a la vez esperadas, barridas y entradas vacías.
   - La marca se escribe dentro de `res.count === 1 && aprobado`, después de los feeds y de la
     liberación.
   - Un `count` corto lanza `ConfirmacionFisicaNoAplicableError` y la `$transaction` revierte todo.
     Está medido contra Postgres.
   - No cambia ninguna línea de los escritores de dinero ni del bloque de liberación.
   - El rechazo no entra en el bloque de la marca.
   - `aprobarCierre` del servicio es la **única** ruta que aprueba un `cierre_dia`: un solo llamador
     en `app/` y una sola Server Action. `CierresBodegaAdminService` e `IncidenteAdminService`
     resuelven otras entidades.
3. **Desvío R16 del backend: correcto.** R16 exige que el error «nombre el motivo», y el borde no
   admite una entrada sin guía (`numGuia` tiene que ser un entero positivo). Con «falta confirmar»
   el motivo quedaría sin nombrar y bodega buscaría un escaneo imposible. Es la lectura literal de
   R16, no un desvío.

   La asimetría con las gestiones de la 238 ya existía: una gestión sin guía que **no se envía**
   sigue dando FALTANTE. No rompe nada, porque la UI pinta el motivo en la fila y en el aviso R35
   para los dos orígenes (m3).
4. **Punto único.**
   - `RETORNO_POR_ORIGEN` lleva `satisfies Record<OrigenDelPaquete, ...>`.
   - `vuelveABodegaElPaquete` usa un `switch` sin `default` con retorno `boolean`, así que un origen
     nuevo no compila.
   - `RETORNA_A_BODEGA` queda intacto.
   - El servicio y la ventana consultan el punto único y no tienen un `if` propio.
   - La guardia recorre `lib`, `app`, `components` y `hooks`. Prohíbe `barrida: true|false|"..."` y
     `vuelve.../retorna... = ...origen === "barrida"`, con autocomprobación en los dos sentidos.
5. **Migración `20261102170000_...`.**
   - Una sola sentencia: `ADD COLUMN "confirmada_fisica_at" TIMESTAMP(3)`, nullable, sin default y
     sin backfill.
   - `down.sql` con `DROP COLUMN IF EXISTS`.
   - Declarada en `posteriores` de `orden-traspaso-migration.test.ts`, en verde.
   - Es la última de la carpeta.
   - No crea tabla, así que no hay RLS nueva.
6. **UI.**
   - Sección propia y última, «Novedad interna (N)», con el nombre de
     `nombreDeEstado("novedad_interna")`.
   - Un solo contador (`progresoDePaquetes(filas)`).
   - Botón bloqueado y sin control de escape.
   - Aviso R35 encima de la lista.
   - Error en su fila por `clave` (claves de gestión y de barrida).
   - Cerrar la ventana no envía nada.
   - `pedirAprobacion` abre la ventana si `filas.length > 0` (R38).
   - El conjunto del cliente (`detalle.ordenesSinGestion`) sale de
     `cierreSinGestion.findMany({ where: { cierreId } })`: la misma tabla y el mismo cierre que lee
     el servidor. Pantalla y servidor no pueden pedir conjuntos distintos.
7. **Dobles ajenos.**
   - 11 archivos de `tests/unit/services`: solo `findBarridasDelCierre: vi.fn(async () => [])`.
   - `cierres-admin-service.test.ts` y `devolucion-rechazadas-flow.test.ts`:
     `cierreSinGestion.findMany` devuelve `[]`.
   - `cierres-admin-service.aprobar.sin-gestion.test.ts`: cambia el `updateMany` del doble de
     `cierreSinGestion`, que antes ningún código de producción llamaba, y añade un parámetro con
     default `[]`.
   - `454/_escenario.ts`: `confirmacionDe` incluye las barridas.
   - No se cambió ni se borró **ninguna** aserción. Solo hay líneas borradas en 3 archivos, y son
     firmas o comentarios: el helper `conGrupos` del componente, `confirmacionDe` y la línea del
     doble.

### Calidad de código y verificación (corrida por mí, aislada)
- [x] `pnpm exec tsc --noEmit`: exit 0.
- [x] `eslint` sobre los 6 archivos de producción tocados: 0 errores y 1 warning anterior a esta
  ficha (`money` sin uso en `CierresAdminModule.tsx:76`).
- [x] 16 archivos clave: **348/348**, 0 skipped. Son los types, las guardias de §8, el repo y el
  servicio de confirmación, `caja-cod`, `sin-gestion`, `service.test`, el componente, la integración
  y la migración de la 497, y `orden-traspaso`.
- [x] `tests/integration/db/454` + `devolucion-rechazadas-flow` + `cierre-sin-gestion-sql-real`:
  **50 archivos, 269/269**, 0 skipped.
- [x] Gate del frontend `progress/gate_497_1.log`: `INIT_EXIT=0`, tres pasadas (377, 281 y 464
  archivos), sin rojos y sin `skipped` en `integration/db`. No corrí `./init.sh`, por instrucción.

### Datos, seguridad y capas
- [x] Ninguna tabla nueva, así que no hay RLS que añadir. Sin webhooks, sin secretos y sin contexto
  hardcodeado (país o moneda).
- [x] Capas: el borde (zod) valida la forma, el servicio la cobertura y el repositorio hace las
  consultas y la escritura guardada. Las interfaces están en `lib/interfaces/`.
- [x] E2E: no aplica, porque el repo no tiene harness. Cubren el riesgo la integración contra
  Postgres y la verificación en la app con Playwright (T4.4, con capturas y limpieza documentadas).
- [ ] Entrada en `progress/history.md`: falta (m2).

---

## Hallazgos

- **m1 (menor).** T3.7 y T5.2 siguen `[ ]` en `tasks.md`. Su verificación está hecha; lo que queda
  (el PR y `gh pr checks`) le toca al leader. Hay que marcarlas al abrir el PR para cumplir
  CHECKPOINTS.
- **m2 (menor).** Falta la entrada de la 497 en `progress/history.md`. Se añade al cerrar la ficha.
- **m3 (menor, coherencia).** Los mensajes de «sin guía» son asimétricos entre orígenes:
  - una barrida sin guía que no se envía da «no tiene número de guía», lo correcto por R16;
  - una **gestión** sin guía que no se envía sigue dando «Falta confirmar», como en la 238, que no
    cambia aquí.

  No bloquea nada, porque la UI avisa del motivo en los dos orígenes. Si se quiere alinear, es una
  ficha aparte de una línea.
- **m4 (menor, red de tests).** La regla que impide aprobar con una barrida sin guía (la mutación M1)
  la mata **un solo** test unitario del servicio. En la integración no hay ningún caso de barrida con
  `num_guia` NULL contra Postgres. No es un defecto del código, pero es una red fina justo para el
  caso que deja un cierre inaprobable. Conviene un caso de integración en la 498 o en un
  seguimiento.
- **m5 (menor, texto).** El mensaje «ajena» de una barrida dice «Esta gestión no pertenece...». Está
  aceptado por el design («no hay mensaje nuevo»), y la UI legítima nunca lo provoca, porque solo
  envía barridas del cierre.

## Riesgo operativo para el despliegue de esta noche (no es hallazgo de código)

Tras desplegar, todo cierre en cola con barridas exige escanearlas. Un cierre con alguna barrida de
`num_guia` NULL queda **inaprobable por diseño**: no hay salida de emergencia, y como sus barridas
quedan fijas desde que nace, re-solicitarlo no lo desbloquea. La puerta está resuelta por el humano y
bodega está avisada. Aun así, antes de promover a `prod` conviene medir esa audiencia en solo
lectura:

    select count(*)
    from cierre_sin_gestion s
    join cierre_dia c on c.id = s.cierre_id
    where s.num_guia is null
      and c.estado in ('solicitado', 'vencido', 'rechazado');

Si da 0, no hay nada que decidir. Si da más de 0, el humano debe saber qué cierres son antes de que
bodega se los encuentre bloqueados.
