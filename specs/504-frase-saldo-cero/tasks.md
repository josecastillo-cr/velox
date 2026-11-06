# 504 — Tareas

Zona `frontend`. Sin pantalla nueva, así que no pasa por `/design`. Secuencial: ninguna tarea es `[P]`
porque todas tocan los mismos dos archivos y las mutaciones no pueden convivir con el gate.

**Requisito previo:** P1 y P2 cerradas en la aprobación del spec.

- [x] **T1 — Test primero.** Crear `tests/unit/components/frase-del-saldo-504.test.tsx` con la tabla de
  `design.md §3`, con literales escritos a mano, marca desde `NOMBRE_ESPERADO`, y sin importar
  `ESTADO_CUENTA_TEXTO`.
  - **Depende de:** P1 y P2.
  - **Hecho:** corrido contra el código sin cambiar, R3, R4, R5 y R7 salen rojos, y R1, R2 y R6 salen
    verdes (caracterización). Si R1, R2 o R6 sale rojo, se para: el literal no describe lo que hay.

- [x] **T2 — El arreglo.** En `estado-cuenta-labels.ts`: añadir `ESTADO_CUENTA_TEXTO.sentidoNoReconocido`,
  exigir `en_cero` en las dos frases de «no se deben nada» y, según P2, exigir `empresa_debe` en la de la
  bodega. Actualizar el comentario de las dos funciones. Sin cambios de firma ni en `TarjetasEstadoCuenta.tsx`.
  - **Depende de:** T1.
  - **Hecho:** todo `frase-del-saldo-504.test.tsx` verde, y `git diff --stat` muestra en producción solo
    `estado-cuenta-labels.ts`.

- [x] **T3 — Mutaciones.** Aplicar M1 a M8 de `design.md §3` una por una, a mano, corriendo solo
  `frase-del-saldo-504.test.tsx`, y restaurar tras cada una. Sin M5 si P2 queda fuera.
  - **Depende de:** T2.
  - **Hecho:** cada mutación tumba el R previsto, y se anota el test que falló y su mensaje. Un resultado
    sin test ejecutado no cuenta como superviviente ni como muerta. `git diff` final igual al de T2.

- [ ] **T4 — Gate y trazabilidad.** Correr los tests que ya afirman estas frases
  (`saldo-tienda-card.negativo.test.tsx`, `EstadoCuenta.test.tsx`, `mi-wallet-page.test.tsx`,
  `WalletRefrescoDirigido.test.tsx`) y `./init.sh --rapido`. Documentar en `progress/impl_504.md` el mapa
  R → test y el resultado de T3.
  - **Depende de:** T3, sin correr a la vez que las mutaciones.
  - **Hecho:** los cuatro archivos verdes, `--rapido` verde con el exit code en el log, y los `R1` a `R7`
    mapeados (sin `R5` si P2 queda fuera).

**Verificación en navegador:** no aplica como tarea. El caso no se alcanza con cliente y servidor de la
misma versión. Lo cubre el `render` de R7.
