# Ficha 503 — Tareas

Implementa `frontend_dev`. Gate: `./init.sh --rapido`, nunca el completo. Las mutaciones no corren a la vez que un gate.

- [x] **T0** Puerta. El humano responde Q1 y aprueba el spec. **Hecho:** respuesta anotada bajo Q1; si es B, la frase del
  responsable está en R1 y en `design.md` §1.

- [x] **T1 [P]** (R1, R2, R3) Añadir el bloque «503» a `tests/unit/docs/ayuda-wallet-satelites-498.test.ts` (`design.md` §2), con literales
  a mano y autocomprobación. **Hecho:** rojos R1 y R2 contra la ayuda actual, y por la frase; R3 y la autocomprobación verdes. Depende de T0.

- [x] **T2 [P]** (R4) Añadir el caso «503/R4» a `tests/components/Conciliacion498.test.tsx`, con la fila de control. **Hecho:** verde
  contra el código actual: fija un comportamiento que no cambia. Depende de T0.

- [x] **T3** (R1, R2, R3) Cambiar la frase de `docs/ayuda/oficina/wallet-satelites.md:129-130` y `actualizado:` (`design.md` §1). **Hecho:** T1
  verde y el resto de `ayuda-wallet-satelites-498.test.ts` sin tocar y verde. Depende de T1.

- [x] **T4** (R1, R2, R4) Mutaciones, una a una, revertidas y anotadas en `progress/impl_503.md`. **Hecho:** cada una da el rojo previsto,
  y `git status` no muestra restos en `components/` ni `app/`. Depende de T2 y T3.
  - Reponer la frase vieja en la ayuda: rojo R1 y R2.
  - `esCorreccion = estado !== "pendiente"` en `ConciliacionAcciones.tsx:145`: rojo «503/R4» y `ConciliacionAcciones500.test.tsx:71-76`.
  - `puedeDesmarcar` a `true` en `ConciliacionSatelite.tsx:345`: rojo «503/R4».

- [x] **T5** (R5) Correr aislado `tests/integration/db/500-con-dinero-sql-real.test.ts` y `tests/components/ConciliacionAcciones500.test.tsx`, sin
  cambiarlos. **Hecho:** verdes y con el de Postgres ejecutado, no `skipped`. Depende de T2.

- [x] **T6** (R1, R4) Ver la app con Playwright sobre la base local, con un solo dev server. **Hecho:** en `progress/impl_503.md` constan
  la captura de la ayuda con la frase nueva y la de una fila saldada en `/wallet/satelites` con su rótulo y sin botones, más el
  detalle en `/cierres-admin`. Si la base local no tiene saldadas, se prepara una con `esperado_regla_anterior = monto_recibido` y se
  restaura; una consulta lo comprueba. Depende de T3.

- [x] **T7** Cierre. Mapa R → test en `progress/impl_503.md`, leído en los archivos reales, y `./init.sh --rapido` con `INIT_EXIT=$?` dentro del
  log, sin `tail`. **Hecho:** ningún R sin test y gate verde mirando los `skipped`. Un rojo se repite aislado. Depende de T4, T5 y T6.
