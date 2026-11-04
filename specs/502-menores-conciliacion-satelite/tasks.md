# Ficha 502 — Tareas

Orden: backend (`backend_dev`) → frontend (`frontend_dev`). `[P]` = se puede hacer en paralelo con la otra `[P]` del
mismo bloque. Las mutaciones nunca corren a la vez que un gate. Gate: `./init.sh --rapido`, nunca el completo.

Q1 = salida A (humano, 2026-11-04): las tareas de la salida B ya están borradas.

## T0 · Puerta

- [x] **T0.1** El humano responde Q1, y Q2 si quiere ampliar. **Hecho:** los bloques de la salida descartada están
  borrados en los tres archivos, y la respuesta está anotada bajo Q1.
- [x] **T0.2** El humano aprueba el spec. **Hecho:** aprobación anotada por el leader. Depende de T0.1.

## T1-T3 · Backend (solo tests; no cambia `lib/`)

- [x] **T1 [P]** (R4, R5) Añadir a `tests/integration/db/zona-distrito-rastro-500.test.ts` el caso «502/R4/R5» y
  `raizDistintaDeTx` (`design.md` §2). Anti-vacuidad: `soloOk` del guardado y 2 filas dentro de la `tx`. La limpieza va
  antes de los `expect`. **Hecho:** el archivo está verde aislado. Depende de T0.2.

- [x] **T2** (R4, R5) Mutación T6.10. Cambiar `tx` por `this.prisma` en `lib/repositories/ZonaRepository.ts:775` y correr
  solo ese archivo. **Hecho:** en `progress/impl_502.md` constan:
  - el rojo exacto, que debe ser el caso nuevo y con `2` frente a `0` en la lectura desde la otra conexión;
  - que el resto del archivo sigue verde (prueba de que la mutación se aplicó y el rojo no viene de otra cosa);
  - la mutación revertida, `git status` limpio en `lib/`;
  - una consulta que confirme 0 filas `zona_distrito_cambiado` residuales de esa zona en la base local.
  Depende de T1.

- [x] **T3 [P]** (R11, R12) Crear `tests/integration/db/502-corregir-de-mas-sql-real.test.ts` con las siete filas de
  `design.md` §3.1, con literales a mano, más un caso con cierres reales (`consolidacionConDosCierres`) que afirme
  `filasDeLosLibros` igual antes y después, y filas de marca byte a byte iguales. **Hecho:** verde aislado contra el código
  actual. Si una fila no da lo calculado, **parar y avisar**: la recomendación de Q1 se apoyaba en esa tabla.
  Mutación: quitar `.minus(asentada)` de `CierresBodegaAdminRepository.ts:865` pone rojo el archivo; revertida y anotada.
  Depende de T0.2.

## T4-T5 · Frontend, m4

- [x] **T4** (R1, R2, R3) Reescribir los dos tests de `design.md` §1: `Conciliacion498.test.tsx:278-285` y
  `wallet-satelites.test.tsx:553` (con marca `[S]`). Literal a mano, sin importar la constante. **Hecho:** los dos rojos contra
  el código actual, y solo por la nota. Depende de T1-T3.

- [x] **T5** (R1, R2, R3) Quitar la nota de `ConciliacionAcciones.tsx` (:26, :288-289), y corregir los comentarios de :61-62 y
  `conciliacion-labels.ts:116`. **Hecho:** T4 verde, y sin cambios en el pie, la guardia :156-165 ni el test de la ayuda.
  Mutación: reponer la línea pone rojo T4; revertida y anotada. Depende de T4.

## T6-T8 · Frontend, m5

- [x] **T6-A** (R6, R7, R8, R9, R10) Crear `tests/components/ConciliacionAcciones502.test.tsx`, con textos a mano. Casos:
  - `-90.00` conciliada sin poder desmarcar: un solo botón, «Corregir»;
  - `-90.00` pudiendo desmarcar: los dos;
  - `-450.00` sin marcar: «Marcar recibido» y ningún «Corregir»;
  - `-0.00` conciliada: 0 botones;
  - al confirmar: se llama a la action de corregir una vez y a la de marcar cero veces;
  - título, monto de partida, nota y aviso de R10.
  Un caso en `Conciliacion498.test.tsx` y otro en `CierresBodegaAdminDebe498.test.tsx` para las dos pantallas.
  **Hecho:** rojos contra el código actual, salvo los de ausencia, y `ConciliacionAcciones500.test.tsx` sin tocar. Depende de T5.

- [x] **T7-A** (R7, R8, R9, R10) Añadir `llegoDeMas` y cambiar `ConciliacionAcciones.tsx:139` y :218 (`design.md` §3.2).
  **Hecho:** T6-A verde. Mutaciones, revertidas y anotadas: dejar :139 como estaba con el botón nuevo pone rojo R9; quitar
  `estado === "recibido" &&` pone rojo R8. Depende de T6-A.

- [x] **T8-A** (R13) Añadir el punto «(502/R13)» a `tests/unit/docs/ayuda-wallet-satelites-498.test.ts` y la frase y la fila a la
  ayuda. **Hecho:** rojo antes y verde después. Depende de T7-A.


## T9 · Ver la app (m4 y m5)

- [x] **T9** (R1, R3 y R7-R10) Recorrer la app con Playwright sobre la base local, con un solo dev server. Antes de nada,
  confirmar en pantalla la premisa: la fila está de verdad en «Recibido» con la falta negativa.
  - **m4, `/wallet/satelites`:** abrir «Desmarcar» en una conciliada sin dinero. Sale el importe y no sale la nota; la nota sigue
    al pie.
  - **m4, `/cierres-admin`:** el mismo diálogo, sin la nota.
  - **m5, las dos pantallas:** marcar una pendiente por más de lo que debe, con el monto anotado.
    - Salida A: sale «Corregir» y no «Desmarcar»; corregir al monto debido; el aviso sale y se comprueba con la respuesta de la
      action, no mirando tarde el toast; la fila queda en «Recibido» sin botones; una consulta muestra el ajuste y el egreso esperados.
    - Salida B: la fila no tiene botones.

  **Hecho:** capturas y números en `progress/impl_502.md`. La base local queda como estaba, comprobado con consulta (ajustes,
  movimientos, historial y marca). Depende de T8.

## T10 · Cierre

- [x] **T10.1** Mapa R → test en `progress/impl_502.md`, con cada R que quede tras T0.1 apuntando a un test real leído. **Hecho:**
  ningún R sin test. Depende de T9.
- [x] **T10.2** `./init.sh --rapido` con `INIT_EXIT=$?` dentro del log, sin `tail`. Mirar los `skipped`: si `integration/db` salió
  saltada, no vale. Un rojo se repite aislado. **Hecho:** verde, y T1 y T3 constan como ejecutados, no saltados. Depende de T10.1.
