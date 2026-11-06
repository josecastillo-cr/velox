// @vitest-environment jsdom
//
// FICHA 500 (T7.4, R21; design §4.4) — las filas `zona_distrito_cambiado` en el registro de acciones:
// la pantalla y la descarga las pintan con su rótulo y sus dos valores, y el filtro por categoría
// «Mueve dinero» las encuentra. No hay código de pantalla nuevo (las columnas son genéricas): esto
// fija que lo genérico las cubre. Literales escritos a mano.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { columnasHistorialAcciones } from "@/app/(app)/historico/acciones/_components/historial-acciones-columnas";
import { filaDescargaHistorialAccion } from "@/app/(app)/historico/acciones/_components/historial-acciones-descarga-columnas";
import { accionesDeCategoria, type HistorialAccionDTO } from "@/lib/types/historial-accion";

afterEach(() => cleanup());

/** Un guardado de zona que AÑADE «Carmen (San José)»: sin valor anterior, sin monto. */
function anadido(extra: Partial<HistorialAccionDTO> = {}): HistorialAccionDTO {
  return {
    id: "5a1d0c62-6b7e-4a51-9f3d-2a1b4c5d6e7f",
    fecha: "2026-11-03T18:30:00.000Z",
    accion: "zona_distrito_cambiado",
    accionLabel: "Cambió los distritos de una zona",
    categoria: "mueve_dinero",
    entidadTipo: "zona",
    entidadEtiqueta: "GAM Norte",
    actorNombre: "Ana Mora",
    actorRol: "maestro",
    monto: null,
    valorAnterior: null,
    valorNuevo: "Carmen (San José)",
    loteId: "9c8b7a65-4321-4d0e-8f1a-0b1c2d3e4f50",
    ...extra,
  };
}

/** El mismo guardado QUITA «Merced (San José)». */
const QUITADO = anadido({ valorAnterior: "Merced (San José)", valorNuevo: null });

/** El texto de la celda de UNA columna tal como la monta `DataTable` (su `render`). */
function celda(id: string, f: HistorialAccionDTO): string {
  const col = columnasHistorialAcciones.find((c) => c.id === id);
  if (typeof col?.render !== "function") throw new Error(`la columna «${id}» no pinta con una función`);
  const { container } = render(<div>{col.render(f)}</div>);
  const texto = container.textContent ?? "";
  cleanup();
  return texto;
}

describe("500/R21 — pantalla del registro de acciones", () => {
  it("distrito añadido: rótulo, categoría, tipo, zona, «—» antes y el distrito después", () => {
    const f = anadido();
    expect(celda("categoria", f)).toBe("Mueve dinero");
    expect(celda("accion", f)).toBe("Cambió los distritos de una zona");
    expect(celda("entidadTipo", f)).toBe("Zona");
    expect(celda("entidad", f)).toBe("GAM Norte");
    expect(celda("anterior", f)).toBe("—");
    expect(celda("nuevo", f)).toBe("Carmen (San José)");
  });

  it("distrito quitado: el distrito antes y «—» después", () => {
    expect(celda("anterior", QUITADO)).toBe("Merced (San José)");
    expect(celda("nuevo", QUITADO)).toBe("—");
  });
});

describe("500/R21 — descarga del registro de acciones", () => {
  it("las dos filas salen con los mismos valores que la pantalla, sin monto", () => {
    expect(filaDescargaHistorialAccion(anadido())).toMatchObject({
      categoria: "Mueve dinero",
      accion: "Cambió los distritos de una zona",
      entidadTipo: "Zona",
      entidad: "GAM Norte",
      monto: null,
      anterior: null,
      nuevo: "Carmen (San José)",
    });
    expect(filaDescargaHistorialAccion(QUITADO)).toMatchObject({
      anterior: "Merced (San José)",
      nuevo: null,
    });
  });
});

describe("500/R21 — el filtro por categoría «Mueve dinero» la encuentra", () => {
  it("`zona_distrito_cambiado` está entre las acciones de `mueve_dinero`", () => {
    expect(accionesDeCategoria("mueve_dinero")).toContain("zona_distrito_cambiado");
  });
});
