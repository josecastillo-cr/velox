-- Ficha 496 (R14/R15/R17): libera el trio de asignacion (mensajero_asignado_id, asignado_at,
-- fecha_reparto) de las recolecciones YA recibidas en la bodega central antes del arreglo: orden no
-- borrada, en en_bodega_central, con mensajero, cuya ULTIMA fila de historial es una recepcion
-- central desde en_ruta_bodega_central. Solo datos: sin cambio de esquema.
-- No escribe historial ni toca updated_at. Desempate de "ultima fila": created_at DESC, id DESC.
-- Idempotente: tras aplicarse, las objetivo ya no tienen mensajero y salen de `candidatas`.
-- Sin cast explicito al enum: Postgres resuelve el literal al tipo de origen_tipo. (Un cast al final
-- de linea lo contaria como columna el censo de ayuda-tienda-migration.test.ts.)
WITH candidatas AS (
  SELECT o.id
  FROM orden o
  JOIN order_status s ON s.id = o.estatus_id AND s.value = 'en_bodega_central'
  WHERE o.deleted_at IS NULL
    AND o.mensajero_asignado_id IS NOT NULL
),
ult AS (
  SELECT DISTINCT ON (h.orden_id) h.orden_id, h.origen_tipo, h.estatus_origen_id
  FROM orden_historial_estado h
  WHERE h.orden_id IN (SELECT id FROM candidatas)
  ORDER BY h.orden_id, h.created_at DESC, h.id DESC
)
UPDATE orden o
SET mensajero_asignado_id = NULL,
    asignado_at           = NULL,
    fecha_reparto         = NULL
FROM ult u
JOIN order_status so ON so.id = u.estatus_origen_id
WHERE u.orden_id = o.id
  AND u.origen_tipo = 'recepcion_bodega_central'
  AND so.value = 'en_ruta_bodega_central';
