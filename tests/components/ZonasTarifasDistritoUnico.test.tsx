// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ProvinciaArbolDTO } from "@/lib/actions/geografia";
import type { ZonaDTO } from "@/lib/types/zona";
import { tecleaSinpeDeLaZona } from "../fixtures/sinpe-en-formulario-zona";

/**
 * ⭑ FICHA 499 (R21-R24) — «COSTOS POR ZONA» CON UN DISTRITO EN UNA SOLA ZONA.
 *
 * R21/R22: «Crear zona» y «Editar» vuelven a leer el árbol ANTES de abrir, y la preselección de
 * «Editar» sale de `d.zonas` de ESE árbol. Hasta la 499 salía de `d.zonaId` del árbol en estado,
 * que tras guardar otra zona podía ser el de antes del guardado (el `refetch` de `onSaved` no se
 * espera) y que con un distrito en dos zonas colapsaba a `null`: el distrito salía desmarcado en
 * las dos zonas y el siguiente guardado lo BORRABA.
 *
 * R23/R24: los mensajes de conflicto del servidor se pintan TODOS bajo el selector, y el toast
 * lleva el primero (más cuántos quedan). Un `conflict` ya no habla de distritos.
 *
 * Los textos se afirman como LITERALES: son el contrato con quien los lee.
 */

const { listarArbolMock, listarZonasMock, obtenerZonaMock, crearZonaMock, actualizarZonaMock } =
  vi.hoisted(() => ({
    listarArbolMock: vi.fn(),
    listarZonasMock: vi.fn(),
    obtenerZonaMock: vi.fn(),
    crearZonaMock: vi.fn(),
    actualizarZonaMock: vi.fn(),
  }));

vi.mock("@/lib/actions/zonas", () => ({
  listarZonas: (...a: unknown[]) => listarZonasMock(...a),
  obtenerZona: (...a: unknown[]) => obtenerZonaMock(...a),
  borrarZona: vi.fn(),
  crearZona: (...a: unknown[]) => crearZonaMock(...a),
  actualizarZona: (...a: unknown[]) => actualizarZonaMock(...a),
  impactoZonaCentral: vi.fn().mockResolvedValue({ status: "ok", impacto: [] }),
}));

vi.mock("@/lib/actions/tarifas", () => ({
  listarTarifas: vi.fn().mockResolvedValue({
    status: "ok",
    items: [],
    page: 1,
    pageSize: 100,
    total: 0,
  }),
  borrarTarifa: vi.fn(),
  crearTarifa: vi.fn(),
  actualizarTarifa: vi.fn(),
}));

vi.mock("@/lib/actions/usuarios-por-rol", () => ({
  listarAdminTiendas: vi.fn().mockResolvedValue({ status: "ok", usuarios: [] }),
  listarUsuariosPorRol: vi.fn().mockResolvedValue({ status: "ok", usuarios: [] }),
}));

vi.mock("@/lib/actions/geografia", () => ({
  listarArbolGeografico: (...a: unknown[]) => listarArbolMock(...a),
  actualizarDistritosEspeciales: vi.fn().mockResolvedValue({ status: "ok" }),
}));

const { successMock, errorMock } = vi.hoisted(() => ({
  successMock: vi.fn(),
  errorMock: vi.fn(),
}));
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({
    success: successMock,
    error: errorMock,
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

const { ZonasTarifasModule } = await import(
  "@/app/(app)/configuracion/tarifas/_components/ZonasTarifasModule"
);

const TEXTO_ARBOL_FALLIDO = "No se pudo cargar la geografía. Inténtalo de nuevo.";

const ZONA_A: ZonaDTO = {
  id: "z-a",
  nombre: "Este",
  cobroVehiculo: false,
  distritosCount: 0,
  esCentral: false,
};
const ZONA_B: ZonaDTO = {
  id: "z-b",
  nombre: "Oeste",
  cobroVehiculo: false,
  distritosCount: 1,
  esCentral: false,
};

type Zona = { id: string; nombre: string };

/** Árbol de un cantón con tres distritos; `zonasDe` dice a qué zonas va cada uno. */
function arbol(zonasDe: Record<string, Zona[]> = {}): ProvinciaArbolDTO[] {
  const d = (id: string, nombre: string) => {
    const zonas = zonasDe[id] ?? [];
    return {
      id,
      nombre,
      // El colapso de siempre (R16): la zona si hay exactamente una, `null` si no.
      zonaId: zonas.length === 1 ? zonas[0].id : null,
      zonaNombre: zonas.length === 1 ? zonas[0].nombre : null,
      zonas,
      zonaEspecial: false,
      activo: true,
    };
  };
  return [
    {
      id: "p-sj",
      nombre: "San José",
      activo: true,
      cantones: [
        {
          id: "c-central",
          nombre: "Central",
          activo: true,
          distritos: [d("d-carmen", "Carmen"), d("d-merced", "Merced"), d("d-uruca", "Uruca")],
        },
      ],
    },
  ];
}

function renderModulo(provincias: ProvinciaArbolDTO[] = arbol()) {
  return render(
    <ZonasTarifasModule
      initialZonas={[ZONA_A, ZONA_B]}
      provincias={provincias}
      vehiculos={[]}
    />,
  );
}

function botonEditar(nombreZona: string): HTMLElement {
  const fila = screen.getByText(nombreZona).closest("li");
  expect(fila).not.toBeNull();
  return within(fila as HTMLElement).getByRole("button", { name: "Editar" });
}

function casillaDistrito(nombre: string): HTMLElement {
  return screen.getByRole("checkbox", {
    name: new RegExp(String.raw`^Seleccionar distrito ${nombre}\b`),
  });
}

/** Despliega el árbol del selector escribiendo en su buscador. */
async function desplegar(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole("searchbox", { name: "Buscar en el catálogo geográfico" }),
    "san",
  );
  await screen.findByText("Merced");
}

/** Abre «Crear zona», teclea nombre y SINPE, marca Carmen y guarda. */
async function crearConCarmen(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Crear zona" }));
  await screen.findByText("Nueva zona");
  await user.type(screen.getByPlaceholderText("Ej: San José centro"), "Norte");
  await tecleaSinpeDeLaZona(user);
  await desplegar(user);
  await user.click(casillaDistrito("Carmen"));
  await user.click(screen.getByRole("button", { name: "Guardar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  listarZonasMock.mockResolvedValue({
    status: "ok",
    items: [ZONA_A, ZONA_B],
    page: 1,
    pageSize: 100,
    total: 2,
  });
  listarArbolMock.mockResolvedValue({ status: "ok", provincias: arbol() });
  obtenerZonaMock.mockImplementation(async (id: string) => ({
    status: "ok",
    zona: { ...(id === ZONA_A.id ? ZONA_A : ZONA_B), tarifas: [] },
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("499/R21 — el árbol se vuelve a leer al abrir; si falla, no se abre", () => {
  it("«Crear zona» con la lectura fallida: toast y el formulario no se abre", async () => {
    listarArbolMock.mockResolvedValue({ status: "error" });
    const user = userEvent.setup();
    renderModulo();

    await user.click(screen.getByRole("button", { name: "Crear zona" }));

    await waitFor(() => expect(errorMock).toHaveBeenCalledWith(TEXTO_ARBOL_FALLIDO));
    expect(screen.queryByText("Nueva zona")).toBeNull();
  });

  it("«Editar» con la lectura fallida: toast y el formulario no se abre", async () => {
    listarArbolMock.mockResolvedValue({ status: "error" });
    const user = userEvent.setup();
    renderModulo();

    await user.click(botonEditar("Oeste"));

    await waitFor(() => expect(errorMock).toHaveBeenCalledWith(TEXTO_ARBOL_FALLIDO));
    expect(screen.queryByText("Editar zona")).toBeNull();
  });

  it("«Crear zona» abre con el árbol RECIÉN LEÍDO, no con el de la carga de la página", async () => {
    // La página trae Merced libre; la lectura al abrir dice que ya es de Oeste.
    listarArbolMock.mockResolvedValue({ status: "ok", provincias: arbol({ "d-merced": [ZONA_B] }) });
    const user = userEvent.setup();
    renderModulo(arbol());

    await user.click(screen.getByRole("button", { name: "Crear zona" }));
    await screen.findByText("Nueva zona");
    await desplegar(user);

    expect(listarArbolMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("(zona: Oeste)")).toBeInTheDocument();
    expect(casillaDistrito("Merced").getAttribute("aria-disabled")).toBe("true");
  });
});

describe("499/R22 — «Editar» preselecciona por `d.zonas` del árbol recién leído", () => {
  it("tras guardar otra zona SIN recargar, «Editar» de Oeste marca su distrito", async () => {
    const user = userEvent.setup();
    // La página trae Merced SIN zona (foto vieja). Crear «Norte» lee el árbol (1); el `refetch`
    // de `onSaved` (2) se queda colgado, como un `void refetch()` que todavía no llegó; y la
    // lectura de «Editar» (3) ya dice que Merced es de Oeste.
    listarArbolMock
      .mockResolvedValueOnce({ status: "ok", provincias: arbol() })
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValue({ status: "ok", provincias: arbol({ "d-merced": [ZONA_B] }) });
    crearZonaMock.mockResolvedValue({
      status: "ok",
      zona: { id: "z-n", nombre: "Norte", cobroVehiculo: false, distritosCount: 1, esCentral: false },
    });
    renderModulo(arbol());

    await crearConCarmen(user);
    await waitFor(() => expect(successMock).toHaveBeenCalledWith("Zona creada"));

    await user.click(botonEditar("Oeste"));
    await screen.findByText("Editar zona");
    await desplegar(user);

    expect(casillaDistrito("Merced")).toBeChecked();
    expect(casillaDistrito("Merced").getAttribute("aria-disabled")).not.toBe("true");
    expect(casillaDistrito("Carmen")).not.toBeChecked();
  });

  it("un distrito con DOS zonas sale marcado al editar cualquiera de ellas (no colapsa a ninguna)", async () => {
    // Estado que el índice ya no admite, pero que `zonas` sigue describiendo (R15): con el
    // `zonaId === zona` de antes salía desmarcado en las dos y el guardado lo borraba.
    listarArbolMock.mockResolvedValue({
      status: "ok",
      provincias: arbol({ "d-uruca": [ZONA_A, ZONA_B] }),
    });
    const user = userEvent.setup();
    renderModulo();

    await user.click(botonEditar("Oeste"));
    await screen.findByText("Editar zona");
    await desplegar(user);

    expect(casillaDistrito("Uruca")).toBeChecked();
  });
});

describe("499/R23 — los conflictos se pintan todos bajo el selector y el toast lleva el primero", () => {
  const TRES = [
    "San Pedro ya está en la zona Este.",
    "Tibás ya está en la zona Norte.",
    "Zapote ya está en la zona Sur.",
  ];

  it("con 3 mensajes: los 3 bajo el selector y el toast «… (y 2 más).»", async () => {
    crearZonaMock.mockResolvedValue({
      status: "validation_error",
      fieldErrors: { distritoIds: TRES },
    });
    const user = userEvent.setup();
    renderModulo();

    await crearConCarmen(user);

    await waitFor(() =>
      expect(errorMock).toHaveBeenCalledWith("San Pedro ya está en la zona Este (y 2 más)."),
    );
    for (const m of TRES) expect(screen.getByText(m)).toBeInTheDocument();
    expect(successMock).not.toHaveBeenCalled();
  });

  it("con 1 mensaje: el toast es el mensaje tal cual", async () => {
    crearZonaMock.mockResolvedValue({
      status: "validation_error",
      fieldErrors: { distritoIds: [TRES[0]] },
    });
    const user = userEvent.setup();
    renderModulo();

    await crearConCarmen(user);

    await waitFor(() => expect(errorMock).toHaveBeenCalledWith(TRES[0]));
    expect(screen.getByText(TRES[0])).toBeInTheDocument();
  });

  it("el mensaje de recarga (R13) llega tal cual al toast y bajo el selector", async () => {
    const RECARGA =
      "Alguno de los elegidos acaba de asignarse a otra zona. Recarga la página y vuelve a intentarlo.";
    crearZonaMock.mockResolvedValue({
      status: "validation_error",
      fieldErrors: { distritoIds: [RECARGA] },
    });
    const user = userEvent.setup();
    renderModulo();

    await crearConCarmen(user);

    await waitFor(() => expect(errorMock).toHaveBeenCalledWith(RECARGA));
    expect(screen.getByText(RECARGA)).toBeInTheDocument();
  });
});

describe("499/R24 — un `conflict` no habla de distritos", () => {
  it("el toast es «Ya existe una zona con ese nombre.»", async () => {
    crearZonaMock.mockResolvedValue({ status: "conflict" });
    const user = userEvent.setup();
    renderModulo();

    await crearConCarmen(user);

    await waitFor(() => expect(errorMock).toHaveBeenCalledWith("Ya existe una zona con ese nombre."));
    for (const [texto] of errorMock.mock.calls) {
      expect(String(texto).toLowerCase()).not.toContain("distrito");
    }
  });
});
