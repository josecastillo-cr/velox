// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";

import type { CierreBodegaResumen } from "@/lib/interfaces/services/ICierreBodegaService";
import { marcaSinConciliar } from "@/tests/fixtures/marca-conciliacion";
import { paginaInicial } from "@/tests/fixtures/pagina-inicial";

/**
 * Ficha 510 — `refrescarListas` del módulo de cierres de bodega del maestro revalidaba solo la
 * cola de Pendientes. Las dos pestañas siguen MONTADAS (`PanelConmutado` solo las oculta), así que
 * un cierre que salía de la cola no aparecía en «Resueltos» hasta que la ventana recuperaba el
 * foco.
 *
 * Se dispara `refrescarListas` por su camino más corto —abrir un cierre que el servidor ya no
 * encuentra— y se afirma que Resueltos vuelve a pedir su página y pinta la fila nueva.
 */

vi.mock("@/lib/actions/cierre-bodega", () => ({
  verCierreBodegaDetalle: vi.fn(),
  aprobarCierreBodega: vi.fn(),
  rechazarCierreBodega: vi.fn(),
  listarPendientesCierresBodegaPaginado: vi.fn(),
  listarPendientesCierresBodegaCompleto: vi.fn(),
  listarHistoricoCierresBodegaPaginado: vi.fn(),
  listarHistoricoCierresBodegaCompleto: vi.fn(),
  listarGestionesCierresBodegaCompleto: vi.fn(),
}));
vi.mock("@/lib/actions/conciliacion-satelites", () => ({
  marcarConsolidacionRecibidaAction: vi.fn(),
  corregirConsolidacionRecibidaAction: vi.fn(),
  revertirConciliacionAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/cierres-admin",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import {
  listarHistoricoCierresBodegaPaginado,
  listarPendientesCierresBodegaPaginado,
  verCierreBodegaDetalle,
} from "@/lib/actions/cierre-bodega";
import { CierresBodegaAdminModule } from "@/app/(app)/cierres-admin/_components/CierresBodegaAdminModule";

const LIMON: CierreBodegaResumen = {
  cierreBodegaId: "b5100000-1111-4111-8111-b1b1b1b1b1b1",
  zonaId: "33333333-3333-4333-8333-333333333333",
  zonaNombre: "Limón",
  solicitadoPorId: "u1",
  solicitadoPorNombre: "Sara Satélite",
  estado: "solicitado",
  totales: { efectivo: "100.00", simpe: "0.00", transferencia: "0.00", general: "100.00" },
  totalPagoMensajero: "10.00",
  totalIngresoBodegaRechazos: "0.00",
  cantidadCierres: 1,
  solicitadoAt: "2026-10-20T14:00:00.000Z",
  resueltoAt: null,
  motivoRechazo: null,
  paraLaCentral: "90.00",
  efectivoCubreDescuentos: true,
  ...marcaSinConciliar("100.00"),
};
const LIMON_RESUELTO: CierreBodegaResumen = {
  ...LIMON,
  estado: "aprobado",
  resueltoAt: "2026-10-20T15:00:00.000Z",
};

/** El botón de la fila en «Resueltos». La pestaña está oculta, no desmontada: de ahí `hidden`. */
const VER_RESUELTO = { name: "Ver el cierre de bodega resuelto de Limón", hidden: true };

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("Ficha 510 — refrescarListas revalida también «Resueltos»", () => {
  it("tras refrescar, Resueltos vuelve a pedir su página y pinta la fila resuelta", async () => {
    vi.mocked(listarPendientesCierresBodegaPaginado).mockResolvedValue({
      status: "ok",
      page: 1,
      ...paginaInicial([LIMON]),
    });
    vi.mocked(listarHistoricoCierresBodegaPaginado).mockResolvedValue({
      status: "ok",
      page: 1,
      ...paginaInicial([]),
    });
    vi.mocked(verCierreBodegaDetalle).mockResolvedValue({ status: "no_encontrada" } as never);

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CierresBodegaAdminModule
          pendientes={paginaInicial([LIMON])}
          historico={paginaInicial([])}
          puedeConciliar
        />
      </SWRConfig>,
    );
    // La revalidación de montaje tiene que haber terminado ANTES de cambiar el doble: si no, su
    // respuesta tardía pintaría la fila nueva y el test pasaría sin el arreglo.
    await waitFor(() => expect(listarHistoricoCierresBodegaPaginado).toHaveBeenCalled());
    const llamadasAntes = vi.mocked(listarHistoricoCierresBodegaPaginado).mock.calls.length;
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("button", VER_RESUELTO)).toBeNull();

    // Para el servidor, el cierre ya se resolvió: sale de la cola y entra en el histórico.
    vi.mocked(listarHistoricoCierresBodegaPaginado).mockResolvedValue({
      status: "ok",
      page: 1,
      ...paginaInicial([LIMON_RESUELTO]),
    });

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Ver / decidir el cierre de bodega de Limón" }),
    );

    expect(await screen.findByRole("button", VER_RESUELTO)).toBeInTheDocument();
    expect(
      vi.mocked(listarHistoricoCierresBodegaPaginado).mock.calls.length,
    ).toBeGreaterThan(llamadasAntes);
  });
});
