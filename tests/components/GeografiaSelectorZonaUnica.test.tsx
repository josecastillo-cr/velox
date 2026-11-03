// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GeografiaSelector } from "@/app/(app)/configuracion/tarifas/_components/GeografiaSelector";
import type { ProvinciaArbolDTO } from "@/lib/types/geografia-nodo";

/**
 * ⭑ FICHA 499 (R17-R20) — UN DISTRITO DE OTRA ZONA NO SE PUEDE ELEGIR.
 *
 * Desde la 499 la base solo admite una zona por distrito (`zona_distrito_distrito_id_key`) y el
 * guardado que lo intente se rechaza entero. El selector lo dice ANTES: la casilla de un distrito de
 * otra zona sale deshabilitada y con «(zona: …)», y la cascada de cantón/provincia solo toca los
 * seleccionables. Si la cascada marcara también los bloqueados, un clic en una provincia mandaría
 * al servidor un guardado que siempre se rechaza.
 *
 * El árbol:
 *   San José
 *     Central  → Carmen (sin zona) · Merced (zona Este) · Hospital (zona Oeste)   ← cantón MIXTO
 *     Escazú   → San Rafael (zona Oeste)                                          ← todo BLOQUEADO
 */

type Distrito = ProvinciaArbolDTO["cantones"][number]["distritos"][number];

function distrito(id: string, nombre: string, zona: { id: string; nombre: string } | null): Distrito {
  return {
    id,
    nombre,
    zonaId: zona?.id ?? null,
    zonaNombre: zona?.nombre ?? null,
    zonas: zona ? [zona] : [],
    zonaEspecial: false,
    activo: true,
  };
}

const ESTE = { id: "z-este", nombre: "Este" };
const OESTE = { id: "z-oeste", nombre: "Oeste" };

const ARBOL: ProvinciaArbolDTO[] = [
  {
    id: "p-sj",
    nombre: "San José",
    activo: true,
    cantones: [
      {
        id: "c-central",
        nombre: "Central",
        activo: true,
        distritos: [
          distrito("d-carmen", "Carmen", null),
          distrito("d-merced", "Merced", ESTE),
          distrito("d-hospital", "Hospital", OESTE),
        ],
      },
      {
        id: "c-escazu",
        nombre: "Escazú",
        activo: true,
        distritos: [distrito("d-rafael", "San Rafael", OESTE)],
      },
    ],
  },
];

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** La casilla de un distrito, por prefijo (el `label` envuelve casilla, nombre y etiqueta). */
function casillaDistrito(nombre: string): HTMLElement {
  return screen.getByRole("checkbox", {
    name: new RegExp(String.raw`^Seleccionar distrito ${nombre}\b`),
  });
}

function casillaGrupo(nombre: string): HTMLElement {
  return screen.getByRole("checkbox", {
    name: `Seleccionar todos los distritos de ${nombre}`,
  });
}

function estaDeshabilitada(el: HTMLElement): boolean {
  return el.getAttribute("aria-disabled") === "true" || el.hasAttribute("disabled") ||
    el.hasAttribute("data-disabled");
}

/** Monta el selector y despliega todo el árbol escribiendo en el buscador. */
async function montar(
  zonaPropiaId: string | null,
  initialSelected: string[] = [],
  onSelectedChange: (ids: string[]) => void = () => {},
) {
  const user = userEvent.setup();
  render(
    <GeografiaSelector
      provincias={ARBOL}
      zonaPropiaId={zonaPropiaId}
      initialSelected={initialSelected}
      onSelectedChange={onSelectedChange}
    />,
  );
  await user.type(
    screen.getByRole("searchbox", { name: "Buscar en el catálogo geográfico" }),
    "san",
  );
  await screen.findByText("Hospital");
  return user;
}

function ultimoReportado(spy: ReturnType<typeof vi.fn>): string[] {
  const llamadas = spy.mock.calls;
  return [...(llamadas[llamadas.length - 1][0] as string[])].sort();
}

describe("499/R17 — al crear, un distrito con zona sale bloqueado y dice cuál", () => {
  it("Merced y Hospital deshabilitados con «(zona: …)»; Carmen, libre, habilitado", async () => {
    await montar(null);

    expect(estaDeshabilitada(casillaDistrito("Merced"))).toBe(true);
    expect(estaDeshabilitada(casillaDistrito("Hospital"))).toBe(true);
    expect(estaDeshabilitada(casillaDistrito("Carmen"))).toBe(false);
    expect(screen.getByText("(zona: Este)")).toBeInTheDocument();
    expect(screen.getAllByText("(zona: Oeste)")).toHaveLength(2);
  });

  it("el clic en un distrito bloqueado no lo marca ni lo reporta", async () => {
    const onSel = vi.fn();
    const user = await montar(null, [], onSel);

    await user.click(casillaDistrito("Hospital"));

    expect(casillaDistrito("Hospital")).not.toBeChecked();
    expect(ultimoReportado(onSel)).toEqual([]);
  });
});

describe("499/R17-R18 — al editar Este, los suyos se tocan y los de otra zona no", () => {
  it("Merced (de Este) está habilitado, marcado y se desmarca y vuelve a marcar", async () => {
    const onSel = vi.fn();
    const user = await montar(ESTE.id, ["d-merced"], onSel);

    const merced = casillaDistrito("Merced");
    expect(estaDeshabilitada(merced)).toBe(false);
    expect(merced).toBeChecked();

    await user.click(merced);
    expect(casillaDistrito("Merced")).not.toBeChecked();
    expect(ultimoReportado(onSel)).toEqual([]);

    await user.click(casillaDistrito("Merced"));
    expect(casillaDistrito("Merced")).toBeChecked();
    expect(ultimoReportado(onSel)).toEqual(["d-merced"]);
  });

  it("Hospital (de Oeste) sigue bloqueado con «(zona: Oeste)»; la zona propia no se etiqueta", async () => {
    await montar(ESTE.id, ["d-merced"]);

    expect(estaDeshabilitada(casillaDistrito("Hospital"))).toBe(true);
    expect(screen.getAllByText("(zona: Oeste)")).toHaveLength(2);
    expect(screen.queryByText("(zona: Este)")).toBeNull();
  });
});

describe("499/R19 — la cascada de cantón y provincia solo toca los seleccionables", () => {
  it("el cantón mixto marca Carmen y Merced, nunca Hospital", async () => {
    const onSel = vi.fn();
    const user = await montar(ESTE.id, [], onSel);

    await user.click(casillaGrupo("Central"));
    expect(ultimoReportado(onSel)).toEqual(["d-carmen", "d-merced"]);
    expect(casillaDistrito("Hospital")).not.toBeChecked();

    await user.click(casillaGrupo("Central"));
    expect(ultimoReportado(onSel)).toEqual([]);
  });

  it("la provincia marca solo los seleccionables de todos sus cantones", async () => {
    const onSel = vi.fn();
    const user = await montar(ESTE.id, [], onSel);

    await user.click(casillaGrupo("San José"));
    expect(ultimoReportado(onSel)).toEqual(["d-carmen", "d-merced"]);
    expect(casillaDistrito("San Rafael")).not.toBeChecked();
  });
});

describe("499/R20 — el estado del grupo se calcula sobre sus seleccionables", () => {
  it("con todos los seleccionables marcados, cantón y provincia salen marcados (no a medias)", async () => {
    await montar(ESTE.id, ["d-carmen", "d-merced"]);

    for (const grupo of ["Central", "San José"]) {
      const casilla = casillaGrupo(grupo);
      // `aria-checked` primero: a medias vale «mixed», y es justo el defecto que se mide.
      expect(casilla.getAttribute("aria-checked")).toBe("true");
      expect(casilla).toBeChecked();
    }
  });

  it("un cantón sin ningún seleccionable tiene su casilla deshabilitada", async () => {
    await montar(ESTE.id);

    expect(estaDeshabilitada(casillaGrupo("Escazú"))).toBe(true);
    expect(estaDeshabilitada(casillaGrupo("Central"))).toBe(false);
  });
});
