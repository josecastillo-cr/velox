// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import type { ReactElement } from "react";

import type { CierreBodegaResumen } from "@/lib/interfaces/services/ICierreBodegaService";
import type { FiltrosCierresBodega } from "@/lib/types/filtros-cierres";
import { marcaSinConciliar } from "@/tests/fixtures/marca-conciliacion";

/**
 * Ficha 510 — la barra de filtros de /cierres-admin recortaba la pestaña de Pendientes (maestro)
 * y la de «A consolidar» (satélite), pero «Cierres de bodega resueltos» y «Cierres de bodega
 * solicitados» pedían su página SIN `filtros` y además servían la página pre-cargada del Server
 * Component —la del conjunto SIN filtrar—. El maestro filtraba por una bodega y seguía viendo
 * todas.
 *
 * Lo que se afirma, por listado: con un filtro de bodega puesto, (1) la action recibe los
 * `filtros`, (2) la página pre-cargada NO se pinta ni un instante y (3) la lista enseña solo lo
 * que devolvió la action. Y, en Resueltos, que cambiar de filtro devuelve a la página 1.
 */

vi.mock("@/lib/actions/cierre-bodega", () => ({
  listarCierresBodegaSolicitadosPaginado: vi.fn(),
  listarCierresBodegaSolicitadosCompleto: vi.fn(),
  listarHistoricoCierresBodegaPaginado: vi.fn(),
  listarHistoricoCierresBodegaCompleto: vi.fn(),
}));

import {
  listarCierresBodegaSolicitadosPaginado,
  listarHistoricoCierresBodegaPaginado,
} from "@/lib/actions/cierre-bodega";
import { CierresBodegaResueltosLista } from "@/app/(app)/cierres-admin/_components/CierresBodegaResueltosLista";
import { CierresBodegaSolicitadosLista } from "@/app/(app)/cierres-admin/_components/CierresBodegaSolicitadosLista";

const ZONA_LIMON = "33333333-3333-4333-8333-333333333333";
const ZONA_HEREDIA = "44444444-4444-4444-8444-444444444444";

function cierreBodega(over: Partial<CierreBodegaResumen>): CierreBodegaResumen {
  return {
    cierreBodegaId: "b1b1b1b1-1111-4111-8111-b1b1b1b1b1b1",
    zonaId: ZONA_LIMON,
    zonaNombre: "Limón",
    solicitadoPorId: "u1",
    solicitadoPorNombre: "Sara Satélite",
    estado: "solicitado",
    totales: { efectivo: "100.00", simpe: "0.00", transferencia: "0.00", general: "100.00" },
    totalPagoMensajero: "10.00",
    totalIngresoBodegaRechazos: "0.00",
    cantidadCierres: 1,
    solicitadoAt: "2026-09-01T10:00:00.000Z",
    resueltoAt: null,
    motivoRechazo: null,
    paraLaCentral: "90.00",
    efectivoCubreDescuentos: true,
    ...marcaSinConciliar("100.00"),
    ...over,
  };
}

const LIMON = cierreBodega({});
const HEREDIA = cierreBodega({
  cierreBodegaId: "c2c2c2c2-2222-4222-8222-c2c2c2c2c2c2",
  zonaId: ZONA_HEREDIA,
  zonaNombre: "Heredia",
});

/** Lo que el Server Component pre-cargó: el conjunto SIN filtrar (las dos bodegas). */
const PRECARGADA = { items: [LIMON, HEREDIA], total: 2, pageSize: 10 };
/** Lo que el servidor devuelve con el filtro de Limón puesto. */
const RESPUESTA_FILTRADA = {
  status: "ok" as const,
  page: 1,
  items: [LIMON],
  total: 1,
  pageSize: 10,
};
const SOLO_LIMON: FiltrosCierresBodega = { destinoZonaIds: [ZONA_LIMON] };

function envolver(ui: ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>,
  );
}

const verDetalles = (zona: string) => `Ver detalles del cierre de bodega de ${zona}`;

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("Ficha 510 — Cierres de bodega resueltos respeta la barra de filtros", () => {
  it("con un filtro de bodega, pide la página CON filtros y enseña solo lo devuelto", async () => {
    vi.mocked(listarHistoricoCierresBodegaPaginado).mockResolvedValue(RESPUESTA_FILTRADA);

    envolver(
      <CierresBodegaResueltosLista initialData={PRECARGADA} onAbrir={() => {}} filtros={SOLO_LIMON} />,
    );

    // La página pre-cargada es la del conjunto SIN filtrar: no se sirve ni un instante.
    expect(screen.queryByRole("button", { name: verDetalles("Heredia") })).toBeNull();

    expect(await screen.findByRole("button", { name: verDetalles("Limón") })).toBeInTheDocument();
    expect(listarHistoricoCierresBodegaPaginado).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      filtros: SOLO_LIMON,
    });
    expect(screen.queryByRole("button", { name: verDetalles("Heredia") })).toBeNull();
  });

  it("cambiar de filtro devuelve el listado a su página 1", async () => {
    vi.mocked(listarHistoricoCierresBodegaPaginado).mockImplementation(async (input) => {
      const { page } = input as { page: number };
      return { status: "ok", page, items: [LIMON], total: 30, pageSize: 10 };
    });
    const user = userEvent.setup();
    const sinFiltros: FiltrosCierresBodega = {};
    const { rerender } = envolver(
      <CierresBodegaResueltosLista
        initialData={{ items: [LIMON], total: 30, pageSize: 10 }}
        onAbrir={() => {}}
        filtros={sinFiltros}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Página siguiente" }));
    await waitFor(() =>
      expect(listarHistoricoCierresBodegaPaginado).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        filtros: sinFiltros,
      }),
    );

    rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CierresBodegaResueltosLista
          initialData={{ items: [LIMON], total: 30, pageSize: 10 }}
          onAbrir={() => {}}
          filtros={SOLO_LIMON}
        />
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(listarHistoricoCierresBodegaPaginado).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        filtros: SOLO_LIMON,
      }),
    );
    expect(listarHistoricoCierresBodegaPaginado).not.toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      filtros: SOLO_LIMON,
    });
  });
});

describe("Ficha 510 — Cierres de bodega solicitados respeta la barra de filtros", () => {
  it("con un filtro de bodega, pide la página CON filtros y enseña solo lo devuelto", async () => {
    vi.mocked(listarCierresBodegaSolicitadosPaginado).mockResolvedValue(RESPUESTA_FILTRADA);

    envolver(<CierresBodegaSolicitadosLista initialData={PRECARGADA} filtros={SOLO_LIMON} />);

    expect(screen.queryByRole("button", { name: verDetalles("Heredia") })).toBeNull();

    expect(await screen.findByRole("button", { name: verDetalles("Limón") })).toBeInTheDocument();
    expect(listarCierresBodegaSolicitadosPaginado).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      filtros: SOLO_LIMON,
    });
    expect(screen.queryByRole("button", { name: verDetalles("Heredia") })).toBeNull();
  });
});
