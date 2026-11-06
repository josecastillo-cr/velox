-- FICHA 498 (M4, 4 de 4) — REGULARIZA lo conciliado antes de la ficha (design §3.5, Q4: decision del
-- humano del 2026-11-02; R54a-R54d).
--
-- Las consolidaciones conciliadas con la regla anterior se marcaron contra el EFECTIVO. Con la formula
-- nueva su deuda incluiria el SINPE/transferencia menos lo de la satelite, y ese hueco no es deuda: es
-- dinero que ya llego por otra via. Se dan por SALDADAS CON LA REGLA ANTERIOR fijando
-- `esperado_regla_anterior = monto_recibido`: su aporte reconocido. Deuda = recibido − recibido = 0.
--
--   · Predicado, nunca ids ni fechas (R54a): conciliada, no rechazada, sin ninguna fila de ajuste y aun
--     sin marcar. «Antes del despliegue» = «sin fila de ajuste»: reaplicar despues de conciliaciones
--     nuevas es determinista (una con delta ≠ 0 tiene su fila `marca`; una con delta 0 tiene
--     recibido = aporte, asi que marcarla no cambia ninguna cifra).
--   · NO toca libros, ni la tabla de ajustes, ni `monto_recibido`, ni ninguna otra columna existente
--     (R54b). `cierre_bodega` no tiene triggers (comprobado en T2.7): `updated_at` no se mueve; el
--     `@updatedAt` de Prisma no actua en SQL.
--   · Corre DESPUES de M2: su predicado lee `conciliacion_bodega_ajuste`.

ALTER TABLE "cierre_bodega" ADD COLUMN "esperado_regla_anterior" DECIMAL(12,2);
ALTER TABLE "cierre_bodega" ADD CONSTRAINT "cierre_bodega_esperado_regla_anterior_check"
  CHECK ("esperado_regla_anterior" IS NULL OR "conciliado_at" IS NOT NULL);

UPDATE "cierre_bodega" b
   SET "esperado_regla_anterior" = b."monto_recibido"
 WHERE b."conciliado_at" IS NOT NULL
   AND b."estado"::text <> 'rechazado'
   AND b."esperado_regla_anterior" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "conciliacion_bodega_ajuste" a WHERE a."cierre_bodega_id" = b."id");
