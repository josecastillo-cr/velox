-- DOWN (ficha 499, 2 de 2) — quita el indice unico sobre `zona_distrito.distrito_id`.
-- Va ANTES del `down.sql` de `20261102130000_zona_distrito_limpieza_499`.

DROP INDEX IF EXISTS "zona_distrito_distrito_id_key";
