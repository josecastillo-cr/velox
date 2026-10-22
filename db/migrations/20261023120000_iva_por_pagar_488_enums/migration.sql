-- FICHA 488 (1 de 2) — los dos valores de enum del IVA POR PAGAR (design §3.1).
--
--   wallet_movimiento_categoria  + egreso_pago_iva           (el pago a Hacienda: egreso de dueño `iva`, efectivo)
--                                + ingreso_reverso_pago_iva  (la anulacion de ese pago: ingreso de dueño `iva`, efectivo)
--
-- Ni `wallet_origen_tipo` (el pago usa `gasto`, como el sueldo; su anulacion, `gasto` con `origen_id` = el
-- pago, como el contra-asiento de la 458-B) ni `historial_accion_tipo` (`egreso_administrativo_registrado` y
-- `egreso_caja_anulado` ya existen) ganan valores.
--
-- VA SOLA: Postgres prohibe USAR un valor de enum en la transaccion que lo añade (55P04) y Prisma corre
-- cada `migration.sql` en su propia transaccion. El CHECK tipo<->categoria que NOMBRA estos valores va en
-- la migracion 2 (`20261023120100_iva_por_pagar_488_checks`).
--
-- ADITIVA: ni tablas, ni columnas, ni datos, ni backfill (la clasificacion vive en el codigo,
-- `NATURALEZA_POR_CATEGORIA`). `IF NOT EXISTS`: reaplicarla no falla. A mano: `db:migrate:create` falla
-- con P3006 en este repo.

ALTER TYPE "wallet_movimiento_categoria" ADD VALUE IF NOT EXISTS 'egreso_pago_iva';
ALTER TYPE "wallet_movimiento_categoria" ADD VALUE IF NOT EXISTS 'ingreso_reverso_pago_iva';
