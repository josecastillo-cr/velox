-- FICHA 499 (1 de 2) — LIMPIEZA: un distrito queda, como mucho, en una zona.
--
-- Va SIEMPRE antes de `20261102130100_zona_distrito_unico_499`, que crea el indice unico sobre
-- `zona_distrito.distrito_id`. Si esta limpieza dejara algun duplicado, aquella migracion falla y
-- aborta el despliegue (R7).
--
-- Reglas (decision del humano, 2026-11-02):
--   (a) un distrito en EXACTAMENTE dos zonas, una central y otra no: se queda en la NO central.
--   (b) cualquier otra combinacion con mas de una asignacion (dos no centrales, tres o mas): el
--       distrito queda SIN zona y lo asigna el maestro desde la pantalla.
--
-- Lo que se quita se copia ANTES a `respaldo.zona_distrito_499` y el `DELETE` borra por los ids del
-- respaldo, sin volver a evaluar la regla: no puede borrar nada que no este respaldado (R4).
-- No toca `orden`, `zona`, `distrito`, `tarifa_zona_mensajero` ni `historial_accion` (R6).
-- Idempotente: `IF NOT EXISTS` y `ON CONFLICT DO NOTHING`.

CREATE SCHEMA IF NOT EXISTS respaldo;

CREATE TABLE IF NOT EXISTS respaldo.zona_distrito_499 (
  id            TEXT        PRIMARY KEY,   -- el id de la fila de zona_distrito
  zona_id       TEXT        NOT NULL,
  distrito_id   TEXT        NOT NULL,
  respaldado_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sin politicas, como `zona_distrito`: cierra la Data API de Supabase. NO aisla nada del rol con el
-- que entra la app (limitacion aceptada, design §2.4).
ALTER TABLE respaldo.zona_distrito_499 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA respaldo FROM PUBLIC;
REVOKE ALL ON respaldo.zona_distrito_499 FROM PUBLIC;

-- `anon` y `authenticated` solo existen en Supabase: la misma migracion corre en la base local.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA respaldo FROM %I', r);
      EXECUTE format('REVOKE ALL ON respaldo.zona_distrito_499 FROM %I', r);
    END IF;
  END LOOP;
END $$;

WITH g AS (
  SELECT zd.id, zd.zona_id, zd.distrito_id, z.es_central,
         count(*)                              OVER (PARTITION BY zd.distrito_id) AS n,
         count(*) FILTER (WHERE z.es_central)  OVER (PARTITION BY zd.distrito_id) AS centrales
  FROM zona_distrito zd JOIN zona z ON z.id = zd.zona_id
)
INSERT INTO respaldo.zona_distrito_499 (id, zona_id, distrito_id)
SELECT id, zona_id, distrito_id FROM g
WHERE n > 1
  AND NOT (n = 2 AND centrales = 1 AND es_central = false)   -- regla (a): se queda la no central
ON CONFLICT (id) DO NOTHING;

DELETE FROM zona_distrito zd
USING respaldo.zona_distrito_499 r
WHERE zd.id = r.id;
