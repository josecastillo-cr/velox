-- Ficha 496 (R16): revierte migration.sql. Repone mensajero_asignado_id con el actor de la ULTIMA
-- recoleccion_tienda de cada orden no borrada en en_bodega_central, sin mensajero, cuya ULTIMA fila
-- de historial sea una recepcion central desde en_ruta_bodega_central (simetrico al up).
-- NO repone asignado_at ni fecha_reparto: la recoleccion no los estampa (157/R38).
-- Sin recoleccion_tienda (p. ej. llego por reversion de incidente) -> sigue sin mensajero.
-- Tambien repone las que la recepcion NUEVA libero tras el deploy: coherente con revertir la ficha
-- entera (codigo + datos).
WITH candidatas AS (
  SELECT o.id
  FROM orden o
  JOIN order_status s ON s.id = o.estatus_id AND s.value = 'en_bodega_central'
  WHERE o.deleted_at IS NULL
    AND o.mensajero_asignado_id IS NULL
),
ult AS (
  SELECT DISTINCT ON (h.orden_id) h.orden_id, h.origen_tipo, h.estatus_origen_id
  FROM orden_historial_estado h
  WHERE h.orden_id IN (SELECT id FROM candidatas)
  ORDER BY h.orden_id, h.created_at DESC, h.id DESC
),
rec AS (
  SELECT DISTINCT ON (h.orden_id) h.orden_id, h.actor_usuario_id
  FROM orden_historial_estado h
  WHERE h.orden_id IN (SELECT id FROM candidatas)
    AND h.origen_tipo = 'recoleccion_tienda'
  ORDER BY h.orden_id, h.created_at DESC, h.id DESC
)
UPDATE orden o
SET mensajero_asignado_id = r.actor_usuario_id
FROM ult u
JOIN order_status so ON so.id = u.estatus_origen_id
JOIN rec r ON r.orden_id = u.orden_id
WHERE u.orden_id = o.id
  AND u.origen_tipo = 'recepcion_bodega_central'
  AND so.value = 'en_ruta_bodega_central'
  AND r.actor_usuario_id IS NOT NULL;
