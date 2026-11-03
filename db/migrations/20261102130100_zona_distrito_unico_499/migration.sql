-- FICHA 499 (2 de 2) — un distrito, como mucho, en una zona (R1).
--
-- Migracion propia a proposito: si la limpieza de `20261102130000_zona_distrito_limpieza_499` dejara
-- algun distrito con mas de una asignacion, este `CREATE` falla y aborta el despliegue (R7).
--
-- El nombre es el que Prisma deriva de `@@unique([distritoId])` y es CONTRATO: lo busca
-- `esViolacionDistritoUnico` (`lib/repositories/_shared/prisma-unique.ts`) para traducir la carrera
-- de dos guardados simultaneos al mensaje de recarga (R13), y lo lee la consulta posterior al
-- despliegue (design §8).
--
-- `@@unique([zonaId, distritoId])` y `@@index([distritoId])` se quedan (design §2.1).

-- CreateIndex
CREATE UNIQUE INDEX "zona_distrito_distrito_id_key" ON "zona_distrito"("distrito_id");
