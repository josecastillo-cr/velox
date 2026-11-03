-- FICHA 498 (M1, 1 de 4) — los tres valores de enum del dinero de satelite al conciliar (design §3.1, R46).
--
--   wallet_movimiento_categoria  + egreso_diferencia_satelite   (la satelite entrego de menos al conciliar)
--                                + ingreso_diferencia_satelite  (entrego de mas, o pago lo que debia)
--   wallet_origen_tipo           + conciliacion_bodega_ajuste   (la fila de la tabla de ajustes de M2)
--
-- VA SOLA: Postgres prohibe USAR un valor de enum en la transaccion que lo añade (55P04) y Prisma corre
-- cada `migration.sql` en su propia transaccion. El CHECK tipo<->categoria que NOMBRA estos valores va en
-- M2 (`20261103120100_satelite_498_ajuste`).
--
-- ADITIVA: ni tablas, ni columnas, ni datos. `IF NOT EXISTS`: reaplicarla no falla.

ALTER TYPE "wallet_movimiento_categoria" ADD VALUE IF NOT EXISTS 'egreso_diferencia_satelite';
ALTER TYPE "wallet_movimiento_categoria" ADD VALUE IF NOT EXISTS 'ingreso_diferencia_satelite';
ALTER TYPE "wallet_origen_tipo"          ADD VALUE IF NOT EXISTS 'conciliacion_bodega_ajuste';
