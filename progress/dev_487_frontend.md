# 487 — «Producto» en el detalle por guía de todos los libros (frontend)

Rama `feat/487-producto-detalle-guia-libros`, desde d447932a. Zona frontend, sdd:false.

## Comprobación previa del backend (sin tocarlo)
- Tienda y mensajero (`CuentaKardexService.kardexConDetalle`) y Mi wallet (`miKardexConDetalle`) arman
  sus bloques en `conDetalle` → `agruparPorGuia` (`lib/utils/detalle-por-guia.ts`), igual que la caja.
- `DetalleEnLoteService.detallar` rellena `producto: fila.producto` SIN condicionarlo a la superficie
  (a diferencia de `tiendaNombre`/`mensajeroNombre`). Las tres superficies reciben `bloque.producto`.

## Cambio
- `components/shared/wallet/libro-kardex-descarga.ts`: `filaCabeceraDeGuia` emite `producto`. Las cuatro
  `filaCabeceraGuia*` la usan; la caja deja de sobreescribirla.
- Tienda, mensajero y Mi wallet declaran `COLUMNA_LIBRO.producto` justo tras «Remisión». No entra en
  `FIJAS_DETALLE_POR_GUIA` (desmarcable); la preferencia es lista de exclusión, así que sale marcada
  también con preferencia guardada.
- Comentarios «SOLO en la caja» de la 485 actualizados (labels y archivo de la caja).
- Fuera de alcance, sin tocar: la hoja «Movimientos» de cada libro.

## Tests
- `tests/unit/descarga/libro-kardex-468.test.ts`: R30/R31/R32 (encabezados y claves) con «Producto» tras
  «Remisión», literales a mano. El bloque 485 «SOLO en la caja» se reescribe como 485/487: cabecera de
  cada superficie con el producto de SU bloque; filas de concepto y total vacías; desmarcable en las 4;
  preferencia anterior a la columna (escrita a mano por hoja) la saca marcada tras «Remisión» en las 4;
  la hoja «Movimientos» sigue sin la columna.
- `tests/components/EstadoCuenta468.test.tsx`: encabezados de tienda y mensajero, índices de columnas
  (+1 tras «Remisión») y producto en la cabecera / vacío en concepto para tienda, mensajero y Mi wallet.

## Verificación
`./init.sh --rapido` → `progress/gate_487.log` (no commiteado). Resultado en el informe de entrega.

Resultado: INIT_EXIT=0. Modo ampliado (relacionados 595 + guardias 3757 + integration/db 4235 =
8587 passed, 0 skipped). Primer intento rojo en typecheck por un cliente Prisma sin generar en el
worktree recién instalado (entorno, no código): `pnpm exec prisma generate` y repetido.
