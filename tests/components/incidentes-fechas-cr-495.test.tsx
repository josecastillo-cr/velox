// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";

import {
  IncidentesAdminModule,
  TITULO_HISTORICO,
  TITULO_PENDIENTES,
} from "@/app/(app)/incidentes/_components/IncidentesAdminModule";
import {
  verIncidente,
  listarHistoricoIncidentesPaginado,
  listarPendientesIncidentesPaginado,
} from "@/lib/actions/incidentes";
import { paginaInicial } from "@/tests/fixtures/pagina-inicial";
import type { IncidenteAdminDTO } from "@/lib/interfaces/services/IIncidenteAdminService";

// =================================================================================================
// FICHA 495 (R10, R12) — las fechas de los incidentes se pintan en el día de COSTA RICA.
// =================================================================================================
//
// `2026-11-01T05:03:00Z` son las 23:03 del 31 de octubre en Costa Rica. Antes de la ficha, el
// recorte del ISO en UTC lo pintaba «2026-11-01». El literal esperado es el MISMO que afirma la
// descarga (`tests/unit/descarga/cierres-fechas-cr-495.test.ts`, bloque R11).

vi.mock("@/lib/actions/incidentes", () => ({
  verIncidente: vi.fn(),
  aprobarIncidente: vi.fn(),
  rechazarIncidente: vi.fn(),
  retractarIncidente: vi.fn(),
  listarIncidentes: vi.fn(),
  reportarIncidente: vi.fn(),
  listarHistoricoIncidentesPaginado: vi.fn(),
  listarPendientesIncidentesPaginado: vi.fn(),
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const INSTANTE = "2026-11-01T05:03:00Z";
const DIA_CR = "2026-10-31";
const DIA_UTC = "2026-11-01";

function incidente(over: Partial<IncidenteAdminDTO> = {}): IncidenteAdminDTO {
  return {
    incidenteId: "i1",
    ordenId: "o-i1",
    numGuia: 1001,
    numRemision: "REM-001",
    destinatario: "Beto Ruiz",
    zonaNombre: "GAM",
    estatusValue: "incidente",
    causa: "danado",
    motivo: "Caja aplastada en el estante 3",
    estado: "solicitado",
    indemnizacion: null,
    reportadoPorNombre: "Ana Admin",
    resueltoPorNombre: null,
    resueltoAt: null,
    motivoRechazo: null,
    createdAt: INSTANTE,
    evidenciaUrls: [],
    esPropio: false,
    ...over,
  };
}

const RESUELTO = incidente({
  incidenteId: "i2",
  numRemision: "REM-002",
  estado: "aprobado",
  indemnizacion: "12500.00",
  resueltoPorNombre: "Carla Admin",
  resueltoAt: INSTANTE,
});

function montar(pendientes: IncidenteAdminDTO[], historico: IncidenteAdminDTO[]) {
  const cola = paginaInicial(pendientes);
  const pagina = paginaInicial(historico);
  vi.mocked(listarPendientesIncidentesPaginado).mockResolvedValue({
    status: "ok",
    page: 1,
    ...cola,
  });
  vi.mocked(listarHistoricoIncidentesPaginado).mockResolvedValue({
    status: "ok",
    page: 1,
    ...pagina,
  });
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <IncidentesAdminModule pendientes={cola} historico={pagina} sinZona={false} />
    </SWRConfig>,
  );
}

/** La fila de la tabla `nombre` que contiene `remision`. */
function fila(nombre: string, remision: string): HTMLElement {
  const tabla = screen.getByRole("table", { name: nombre });
  const celda = within(tabla).getByText(remision);
  const tr = celda.closest("tr");
  if (!tr) throw new Error(`sin fila para ${remision}`);
  return tr;
}

/** El texto del `<p>` «label: valor» del detalle. */
function dato(label: string): string | null {
  const datos = screen.getByRole("region", { name: "Datos del incidente" });
  return within(datos).getByText(`${label}:`, { exact: false }).parentElement?.textContent ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("Ficha 495 — R10: incidentes en el día de Costa Rica", () => {
  it("la columna «Fecha» de la cola de pendientes", () => {
    montar([incidente()], []);
    const tr = fila(TITULO_PENDIENTES, "REM-001");
    expect(tr.textContent).toContain(DIA_CR);
    expect(tr.textContent).not.toContain(DIA_UTC);
  });

  it("la columna «Fecha resuelta» del histórico", () => {
    montar([], [RESUELTO]);
    const tr = fila(TITULO_HISTORICO, "REM-002");
    expect(tr.textContent).toContain(DIA_CR);
    expect(tr.textContent).not.toContain(DIA_UTC);
  });

  it("«Reportado el» y «Resuelto por … · fecha» del detalle", async () => {
    const user = userEvent.setup();
    montar([], [RESUELTO]);
    vi.mocked(verIncidente).mockResolvedValue({ status: "ok", incidente: RESUELTO });
    await user.click(
      screen.getByRole("button", { name: "Ver el incidente de la orden REM-002" }),
    );
    await screen.findByText("Detalle del incidente");
    expect(dato("Reportado el")).toBe(`Reportado el: ${DIA_CR}`);
    expect(dato("Resuelto por")).toBe(`Resuelto por: Carla Admin · ${DIA_CR}`);
  });
});

describe("Ficha 495 — R12: sin fecha de resolución, como hoy", () => {
  it("el histórico pinta «—» en «Fecha resuelta» y nunca NaN ni Invalid Date", () => {
    montar([], [{ ...RESUELTO, resueltoAt: null }]);
    const tabla = screen.getByRole("table", { name: TITULO_HISTORICO });
    // La celda se localiza por el ÍNDICE de su encabezado: otras columnas también pintan «—»
    // (motivo de rechazo nulo), y buscar «—» en toda la fila pasaría con esta celda rota.
    const encabezados = within(tabla)
      .getAllByRole("columnheader")
      .map((th) => th.textContent?.trim());
    const indice = encabezados.indexOf("Fecha resuelta");
    expect(indice).toBeGreaterThanOrEqual(0);
    const tr = fila(TITULO_HISTORICO, "REM-002");
    expect(tr.querySelectorAll("td")[indice]?.textContent).toBe("—");
    expect(tr.textContent).not.toMatch(/NaN|Invalid Date/);
  });

  it("el detalle omite la pieza «· fecha»", async () => {
    const user = userEvent.setup();
    const sinFecha = { ...RESUELTO, resueltoAt: null };
    montar([], [sinFecha]);
    vi.mocked(verIncidente).mockResolvedValue({ status: "ok", incidente: sinFecha });
    await user.click(
      screen.getByRole("button", { name: "Ver el incidente de la orden REM-002" }),
    );
    await screen.findByText("Detalle del incidente");
    expect(dato("Resuelto por")).toBe("Resuelto por: Carla Admin");
  });
});
