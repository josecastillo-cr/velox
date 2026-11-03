-- FICHA 498 (M3, 3 de 4) — RETIRA de los tres libros los asientos de los cierres satelite que aun no
-- han entrado a la caja (design §3.3, R48-R52).
--
-- Desde esta ficha el dinero de un cierre satelite se asienta AL CONCILIAR su consolidacion, no al
-- aprobarlo. Los cierres del CONJUNTO S —satelite, `aprobado`, sin consolidacion o con la consolidacion
-- sin conciliar— se aprobaron con la regla vieja y tienen sus filas en los libros. Se retiran aqui y se
-- vuelven a asentar al conciliar (R54; el asiento es idempotente por los unicos de origen).
--
--   · S se elige por PREDICADO, nunca por ids (R48).
--   · Fuera: cierres centrales, cierres de consolidaciones conciliadas, `premio_ranking` y filas con
--     `premio_dia` del libro del mensajero (R49).
--   · GUARDA (R50): si hay un pago al mensajero (`liquidacion_pago`) registrado contra un cierre de S, se
--     ABORTA con el conteo y no cambia nada.
--   · Cada fila retirada se copia INTEGRA (`to_jsonb`) a `respaldo.asientos_satelite_498`, con clave
--     `(tabla, id)`, y se borra de los libros SOLO lo que esta en el respaldo (R51).
--   · FKs entrantes a los tres libros (`cobro_tienda_anulacion`, `ajuste_caja_anulacion`,
--     `wallet_anotacion`, `wallet_comprobante`, `gasto_fijo_cobro`): ninguna apunta a filas con origen
--     `cierre_dia` (comprobado en `db/schema.prisma`, T2.5). Si alguna lo hiciera, el DELETE falla y la
--     migracion entera no se aplica.
--
-- Atomicidad: Prisma ejecuta el archivo en una sola transaccion implicita (ningun `migration.sql` del
-- repo lleva BEGIN/COMMIT) y toda la logica va en un unico bloque DO. O se aplica entero o no se aplica.
-- El esquema `respaldo` ya existe desde la 499 (`IF NOT EXISTS`); Prisma no compara esquemas fuera de
-- `public`, asi que no genera drift.

CREATE SCHEMA IF NOT EXISTS "respaldo";

CREATE TABLE IF NOT EXISTS "respaldo"."asientos_satelite_498" (
  "tabla"         TEXT         NOT NULL CHECK ("tabla" IN ('wallet_movimiento','wallet_tienda_movimiento','pago_mensajero_movimiento')),
  "fila"          JSONB        NOT NULL,
  "id"            TEXT         GENERATED ALWAYS AS ("fila"->>'id') STORED,
  "respaldado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("tabla", "id")
);

-- Sin politicas, como en la 499: cierra la Data API de Supabase. NO aisla nada del rol con el que entra
-- la app (limitacion aceptada por el humano el 2026-11-02).
ALTER TABLE "respaldo"."asientos_satelite_498" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "respaldo"."asientos_satelite_498" FROM PUBLIC;

DO $$
DECLARE
  v_pagos bigint;
BEGIN
  -- S, por PREDICADO (R48). El DROP previo hace el bloque reejecutable dentro de una misma sesion
  -- (los tests corren up -> down -> up en una sola transaccion; en el despliegue no cambia nada).
  DROP TABLE IF EXISTS pg_temp.s_498;
  CREATE TEMP TABLE s_498 ON COMMIT DROP AS
    SELECT c.id
      FROM cierre_dia c
      LEFT JOIN cierre_bodega b ON b.id = c.cierre_bodega_id
     WHERE c.destino_tipo::text = 'bodega_satelite'
       AND c.estado::text = 'aprobado'
       AND (c.cierre_bodega_id IS NULL OR b.conciliado_at IS NULL);

  -- Guarda (R50).
  SELECT count(*) INTO v_pagos FROM liquidacion_pago l JOIN s_498 s ON l.cierre_id = s.id;
  IF v_pagos > 0 THEN
    RAISE EXCEPTION 'ficha 498: % pagos al mensajero registrados contra cierres de S; no se cambia nada', v_pagos;
  END IF;

  -- Respaldo integro (R51).
  INSERT INTO respaldo.asientos_satelite_498 (tabla, fila)
    SELECT 'wallet_movimiento', to_jsonb(w)
      FROM wallet_movimiento w JOIN s_498 s ON w.origen_id = s.id
     WHERE w.origen_tipo::text = 'cierre_dia'
    ON CONFLICT DO NOTHING;
  INSERT INTO respaldo.asientos_satelite_498 (tabla, fila)
    SELECT 'wallet_tienda_movimiento', to_jsonb(t)
      FROM wallet_tienda_movimiento t JOIN s_498 s ON t.origen_id = s.id
     WHERE t.origen_tipo::text = 'cierre_dia'
    ON CONFLICT DO NOTHING;
  INSERT INTO respaldo.asientos_satelite_498 (tabla, fila)
    SELECT 'pago_mensajero_movimiento', to_jsonb(p)
      FROM pago_mensajero_movimiento p JOIN s_498 s ON p.origen_id = s.id
     WHERE p.origen_tipo::text = 'cierre_dia'
       AND p.categoria::text <> 'premio_ranking'
       AND p.premio_dia IS NULL  -- R49
    ON CONFLICT DO NOTHING;

  -- Borrado SOLO de lo respaldado (R51).
  DELETE FROM wallet_movimiento w USING respaldo.asientos_satelite_498 r
   WHERE r.tabla = 'wallet_movimiento' AND w.id = r.id;
  DELETE FROM wallet_tienda_movimiento t USING respaldo.asientos_satelite_498 r
   WHERE r.tabla = 'wallet_tienda_movimiento' AND t.id = r.id;
  DELETE FROM pago_mensajero_movimiento p USING respaldo.asientos_satelite_498 r
   WHERE r.tabla = 'pago_mensajero_movimiento' AND p.id = r.id;
END
$$;
