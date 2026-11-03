-- DOWN (ficha 498, M3) — reinserta en los tres libros las filas respaldadas (design §3.3, R52).
--
-- `ON CONFLICT DO NOTHING` sin destino absorbe dos casos: la PK y el unico de origen. Si un cierre ya se
-- volvio a asentar al conciliar, la fila restaurada choca con la nueva y se descarta: NO hay doble
-- asiento. Borra SOLO su tabla de respaldo, y el esquema `respaldo` solo si queda vacio (la 499 y otras
-- fichas lo usan). Va despues del `down` de M4 y antes del de M2.

BEGIN;

INSERT INTO wallet_movimiento
  SELECT (jsonb_populate_record(NULL::wallet_movimiento, fila)).* FROM respaldo.asientos_satelite_498
   WHERE tabla = 'wallet_movimiento'
  ON CONFLICT DO NOTHING;
INSERT INTO wallet_tienda_movimiento
  SELECT (jsonb_populate_record(NULL::wallet_tienda_movimiento, fila)).* FROM respaldo.asientos_satelite_498
   WHERE tabla = 'wallet_tienda_movimiento'
  ON CONFLICT DO NOTHING;
INSERT INTO pago_mensajero_movimiento
  SELECT (jsonb_populate_record(NULL::pago_mensajero_movimiento, fila)).* FROM respaldo.asientos_satelite_498
   WHERE tabla = 'pago_mensajero_movimiento'
  ON CONFLICT DO NOTHING;

DROP TABLE respaldo.asientos_satelite_498;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'respaldo'
  ) THEN
    DROP SCHEMA respaldo;
  END IF;
END
$$;

COMMIT;
