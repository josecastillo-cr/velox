import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { GeoRepository } from "@/lib/repositories/GeoRepository";

// ⭑ FICHA 499 / B.8 — `DistritoArbolDTO.zonas` (R15) y el colapso que se queda (R16).
//
// Con el indice `zona_distrito_distrito_id_key` la base ya no admite un distrito en dos zonas, asi
// que el orden de la lista con DOS o mas zonas solo se puede probar con un doble de Prisma. La
// forma con una zona y con ninguna se mide contra Postgres en
// `tests/integration/db/zona-distrito-unico-499.test.ts`.

function zona(id: string, nombre: string) {
  return { zona: { id, nombre } };
}

function distrito(id: string, zonas: ReturnType<typeof zona>[]) {
  return { id, nombre: `D ${id}`, zonaEspecial: null, activo: true, zonas };
}

function repoConArbol(distritos: ReturnType<typeof distrito>[]) {
  const prisma = {
    provincia: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "p1",
          nombre: "P",
          activo: true,
          cantones: [{ id: "c1", nombre: "C", activo: true, distritos }],
        },
      ]),
    },
  };
  return { repo: new GeoRepository(prisma as unknown as PrismaClient), prisma };
}

describe("499/B.8 — GeoRepository.listArbol: la lista de zonas del distrito", () => {
  it("R15/R16: con varias zonas desordenadas, salen por nombre (español) y el colapso da null", async () => {
    const { repo } = repoConArbol([
      distrito("d1", [zona("z3", "Zapote"), zona("z1", "éste"), zona("z2", "Alajuela")]),
    ]);
    const [d] = (await repo.listArbol())[0].cantones[0].distritos;
    expect(d.zonas).toEqual([
      { id: "z2", nombre: "Alajuela" },
      { id: "z1", nombre: "éste" },
      { id: "z3", nombre: "Zapote" },
    ]);
    expect(d.zonaId).toBeNull();
    expect(d.zonaNombre).toBeNull();
  });

  it("R15/R16: con una zona, la lista la trae y el colapso la da; sin zona, lista vacia y null", async () => {
    const { repo } = repoConArbol([distrito("d1", [zona("z1", "Este")]), distrito("d2", [])]);
    const [uno, ninguno] = (await repo.listArbol())[0].cantones[0].distritos;
    expect(uno.zonas).toEqual([{ id: "z1", nombre: "Este" }]);
    expect(uno.zonaId).toBe("z1");
    expect(uno.zonaNombre).toBe("Este");
    expect(ninguno.zonas).toEqual([]);
    expect(ninguno.zonaId).toBeNull();
    expect(ninguno.zonaNombre).toBeNull();
  });

  it("R15: el `select` pide id y nombre de TODAS las zonas del distrito (sin `take`)", async () => {
    const { repo, prisma } = repoConArbol([]);
    await repo.listArbol();
    const arg = prisma.provincia.findMany.mock.calls[0][0] as {
      select: { cantones: { select: { distritos: { select: { zonas: unknown } } } } };
    };
    expect(arg.select.cantones.select.distritos.select.zonas).toEqual({
      select: { zona: { select: { id: true, nombre: true } } },
    });
  });
});
