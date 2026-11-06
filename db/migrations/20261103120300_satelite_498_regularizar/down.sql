-- DOWN (ficha 498, M4) — quita SOLO la marca de regularizacion (R54d). Perdida declarada: la marca.
-- Ningun otro dato depende de ella. Va PRIMERO en la reversion (M4 -> M3 -> M2 -> M1).

BEGIN;

ALTER TABLE "cierre_bodega" DROP CONSTRAINT "cierre_bodega_esperado_regla_anterior_check";
ALTER TABLE "cierre_bodega" DROP COLUMN "esperado_regla_anterior";

COMMIT;
