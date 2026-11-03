-- DOWN (ficha 499, 1 de 2) — devuelve las asignaciones respaldadas y retira el respaldo.
--
-- ⚠️ ORDEN: corre DESPUES del `down.sql` de `20261102130100_zona_distrito_unico_499`, que quita el
-- indice unico sobre `distrito_id`. Con el indice puesto, devolver un distrito a su segunda zona
-- choca con el (23505). Es el orden normal de reversion: de la ultima migracion hacia atras.
--
-- Solo vuelve lo que todavia tiene a donde volver: si la zona o el distrito ya no existen, esa fila
-- se pierde con el respaldo. `ON CONFLICT DO NOTHING`: una fila que ya esta no se duplica.
-- Borra SOLO la tabla de esta ficha, y el esquema `respaldo` solo si queda vacio (R8).

INSERT INTO zona_distrito (id, zona_id, distrito_id)
SELECT r.id, r.zona_id, r.distrito_id
FROM respaldo.zona_distrito_499 r
WHERE EXISTS (SELECT 1 FROM zona z WHERE z.id = r.zona_id)
  AND EXISTS (SELECT 1 FROM distrito d WHERE d.id = r.distrito_id)
ON CONFLICT DO NOTHING;

DROP TABLE respaldo.zona_distrito_499;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'respaldo') THEN
    DROP SCHEMA respaldo;
  END IF;
END $$;
