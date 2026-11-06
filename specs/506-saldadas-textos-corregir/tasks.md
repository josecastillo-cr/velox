# Ficha 506 — Tareas

Implementa `frontend_dev`. `[P]` = paralelizable con las otras `[P]` de su bloque. Los textos exactos están en `design.md` §3.

## 1. Región de `/cierres-admin`

- [ ] **T1.1** Tests primero en `tests/components/CierresBodegaAdminDebe498.test.tsx`: `abrirDetalle` deja de esperar la región y
      espera el detalle cargado, gana el parámetro de permiso; bloque «506» con los 8 casos de `design.md` §6; caso 500/R3 de `:206`
      adaptado, marcado `[S]` con el motivo. **Hecho:** los dos casos R9 fallan porque la región sigue montada; los R10 y R11 pasan.
- [ ] **T1.2** (tras T1.1) `accionesConciliacionDe` y `hayAccionConciliacion` en `cierre-labels.ts`; `ConciliacionAcciones` deriva de
      ahí sus botones y `esCorreccion`. **Hecho:** `ConciliacionAcciones500`, `ConciliacionAcciones502` y `Conciliacion498` verdes sin
      editar sus aserciones de botones.
- [ ] **T1.3** (tras T1.2) Condición de `CierresBodegaAdminModule.tsx:881` y comentario de `:878-880`. **Hecho:** T1.1 verde entero.

## 2. Textos

- [ ] **T2.1** [P] Literales nuevos a mano en `Conciliacion498.test.tsx:46,48,303`, `ConciliacionAcciones500.test.tsx:113,116`,
      `tests/integration/wallet-satelites.test.tsx:461`, `aporte-satelite-fuente-unica-498.guardia.test.ts:83`. **Hecho:** rojos contra los textos
      viejos; ningún test importa la constante.
- [ ] **T2.2** (tras T2.1) Los tres textos de `conciliacion-labels.ts`. **Hecho:** T2.1 verde salvo la parte de la ayuda de la guardia, que
      espera a T3.2.
- [ ] **T2.3** [P] Comentarios de `design.md` §7. **Hecho:** solo cambian comentarios; `lib/actions/conciliacion-satelites.ts` sin cambio de código.

## 3. Ayuda

- [ ] **T3.1** [P] `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`: patrones de `:26` y `:32`, y bloque «506» con su autocomprobación
      (`design.md` §6). **Hecho:** rojo contra la ayuda actual; la autocomprobación, verde.
- [ ] **T3.2** (tras T3.1) Sección de `docs/ayuda/oficina/wallet-satelites.md` según `design.md` §3 y `actualizado:`. LF, sin CRLF. **Hecho:** T3.1 y
      la guardia de la 498 verdes; las secciones 503 y siguientes no aparecen en el diff.

## 4. Verificación

- [ ] **T4.1** (tras todo) Mutaciones de `design.md` §6, una a una y revirtiendo cada una, sobre los archivos relacionados. **Hecho:** tabla en
      `progress/impl_506.md`, cada una roja con el nombre del caso que la mata y el arnés demostrando que ejecutó tests. Si una sobrevive, se
      refuerza el test, no se quita la mutación.
- [ ] **T4.2** (tras T4.1, sin mutaciones en el árbol) Correr a mano las guardias que leen archivos, que el `--rapido` puede no relacionar:
      `aporte-satelite-fuente-unica-498.guardia`, `textos-satelite-definitivos-500.guardia`, `cierre-bodega-vocabulario.guardia`. **Hecho:** verdes.
- [ ] **T4.3** (tras T4.2) `./init.sh --rapido`, sin el completo. **Hecho:** `INIT_EXIT=0` escrito en el log y `skipped` revisados.
- [ ] **T4.4** (tras T4.3) Ver la app en local, con una saldada insertada y borrada en un `finally` si la base no tiene: en `/cierres-admin`,
      su detalle sin la región y con la región en una fila con botones; en `/wallet/satelites`, la nota nueva; en `/ayuda/oficina/wallet-satelites`,
      la sección nueva. **Hecho:** anotado en `progress/impl_506.md` con lo leído en pantalla, base limpia al terminar y sin datos identificables de producción.
- [ ] **T4.5** Mapa `R<n>` → test en `progress/impl_506.md`. **Hecho:** R1 a R11 con archivo y línea reales.
