import { describe, it, expect } from "vitest";

import { diferenciaDeDistritos, filasDeCambioDeDistritos } from "@/lib/repositories/ZonaRepository";

/**
 * FICHA 500 (T4.3; R14-R17) — las dos funciones puras del rastro de distritos. La escritura real se
 * mide contra Postgres en `tests/integration/db/zona-distrito-rastro-500.test.ts`.
 */

const ACTOR = { actorUsuarioId: "u1", actorNombre: "Ana Solis", actorRol: "maestro" as const };

describe("FICHA 500 — diferenciaDeDistritos (R17: por conjuntos)", () => {
  it("añadidos y quitados por conjunto", () => {
    expect(diferenciaDeDistritos(["a", "b", "c"], ["b", "d", "e"])).toEqual({ anadidos: ["d", "e"], quitados: ["a", "c"] });
  });

  it("el mismo conjunto en otro orden y con repetidos → sin cambios", () => {
    expect(diferenciaDeDistritos(["a", "b", "c"], ["c", "a", "b", "a", "c"])).toEqual({ anadidos: [], quitados: [] });
  });

  it("de vacio a algo y de algo a vacio", () => {
    expect(diferenciaDeDistritos([], ["x"])).toEqual({ anadidos: ["x"], quitados: [] });
    expect(diferenciaDeDistritos(["x"], [])).toEqual({ anadidos: [], quitados: ["x"] });
  });
});

describe("FICHA 500 — filasDeCambioDeDistritos (R14-R16)", () => {
  const nombres = [
    { id: "d1", nombre: "Carmen", canton: { nombre: "San José" } },
    { id: "d2", nombre: "Atenas", canton: { nombre: "Atenas" } },
    { id: "d3", nombre: "Merced", canton: { nombre: "San José" } },
  ];

  it("añadido: anterior vacio y nuevo el texto; quitado: al reves; sin comillas (Q2) y sin monto", () => {
    const filas = filasDeCambioDeDistritos({ id: "z1", nombre: "Zona Norte" }, { anadidos: ["d1", "d2"], quitados: ["d3"] }, nombres, ACTOR);
    expect(filas).toEqual([
      {
        accion: "zona_distrito_cambiado",
        entidadTipo: "zona",
        entidadId: "z1",
        entidadEtiqueta: "Zona Norte",
        valorAnterior: null,
        valorNuevo: "Atenas (Atenas)",
        ...ACTOR,
      },
      {
        accion: "zona_distrito_cambiado",
        entidadTipo: "zona",
        entidadId: "z1",
        entidadEtiqueta: "Zona Norte",
        valorAnterior: null,
        valorNuevo: "Carmen (San José)",
        ...ACTOR,
      },
      {
        accion: "zona_distrito_cambiado",
        entidadTipo: "zona",
        entidadId: "z1",
        entidadEtiqueta: "Zona Norte",
        valorAnterior: "Merced (San José)",
        valorNuevo: null,
        ...ACTOR,
      },
    ]);
    for (const f of filas) expect(f).not.toHaveProperty("monto");
  });

  it("R15: el texto no pasa de 60 caracteres", () => {
    const largo = "D".repeat(80);
    const [f] = filasDeCambioDeDistritos(
      { id: "z1", nombre: "Z" },
      { anadidos: ["dl"], quitados: [] },
      [{ id: "dl", nombre: largo, canton: { nombre: "Cantón" } }],
      ACTOR,
    );
    expect(f.valorNuevo).toBe("D".repeat(60));
  });

  it("un id sin nombre de catalogo usa la etiqueta desconocida, nunca el uuid", () => {
    const [f] = filasDeCambioDeDistritos({ id: "z1", nombre: "Z" }, { anadidos: ["uuid-perdido"], quitados: [] }, [], ACTOR);
    expect(f.valorNuevo).toBe("(sin identificar)");
  });

  it("sin cambios → sin filas", () => {
    expect(filasDeCambioDeDistritos({ id: "z1", nombre: "Z" }, { anadidos: [], quitados: [] }, nombres, ACTOR)).toEqual([]);
  });
});
