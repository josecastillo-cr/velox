// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";

import { ToastProvider } from "@/providers/ToastProvider";
import { NOMBRE_ESPERADO } from "@/tests/fixtures/marca-esperada";
import { MARCA_RETIRADA } from "@/tests/fixtures/marca-retirada-nombre-493";

// FEATURE 493 (T10, R7) — las pantallas de configuración nombran a la empresa con la marca.
//
// L1: cada frase se afirma ENTERA y literal; la parte de la marca sale del fixture literal
// (`tests/fixtures/marca-esperada.ts`), nunca de `MARCA` (R16). Se renderiza lo que la persona ve:
// el vacío de API keys, la descripción de Envíos automáticos y la explicación de «Pagos por zona».

// --- API keys: el módulo con sus Server Actions mockeadas (como `ApiKeysModule.test.tsx`) ---
const listarApiKeysMock = vi.fn();
vi.mock("@/lib/actions/api-keys", () => ({
  listarApiKeys: (...a: unknown[]) => listarApiKeysMock(...a),
  generarApiKey: vi.fn(),
  rotarApiKey: vi.fn(),
  activarApiKey: vi.fn(),
  desactivarApiKey: vi.fn(),
}));
vi.mock("@/lib/actions/webhooks", () => ({
  obtenerWebhook: vi.fn(async () => ({ status: "ok", webhook: null })),
  registrarWebhook: vi.fn(),
  desactivarWebhook: vi.fn(),
  rotarSecretoWebhook: vi.fn(),
}));
vi.mock("@/lib/actions/usuarios-por-rol", () => ({
  listarAdminTiendas: vi.fn(async () => ({ status: "ok", usuarios: [] })),
  listarUsuariosPorRol: vi.fn(),
}));

// --- Envíos automáticos: la página de servidor (como `ConfiguracionEnviosWhatsappPage.test.tsx`) ---
vi.mock("@/app/_components/LogoutButton", () => ({
  LogoutButton: () => <button data-testid="logout-stub">Salir</button>,
}));
const resolveActorMock = vi.fn();
vi.mock("@/lib/auth/resolve-actor", () => ({
  resolveActorFromSession: () => resolveActorMock(),
}));
const listarEnviosMock = vi.fn();
vi.mock("@/lib/actions/envios-whatsapp", () => ({
  listarEnvios: (...a: unknown[]) => listarEnviosMock(...a),
}));
vi.mock("@/app/(app)/configuracion/envios-whatsapp/_components/EnviosModule", () => ({
  EnviosModule: () => <div data-testid="envios-module" />,
}));

import { ApiKeysModule } from "@/app/(app)/configuracion/api/_components/ApiKeysModule";
import { PAGO_ZONA_TEXTO } from "@/app/(app)/configuracion/tarifas/_components/tarifas-labels";
import { SINPE_CAMPO_NOMBRE } from "@/components/shared/sinpe-textos";

beforeEach(() => {
  vi.clearAllMocks();
  listarApiKeysMock.mockResolvedValue({ status: "ok", items: [], page: 1, pageSize: 25, total: 0 });
  resolveActorMock.mockResolvedValue({ usuarioId: "m", rol: "maestro" });
  listarEnviosMock.mockResolvedValue({ status: "ok", items: [] });
});

afterEach(() => cleanup());

describe("493/R7 — configuración con la marca", () => {
  it("API keys: el vacío invita a conectar sistemas externos con la marca", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ToastProvider>
          <ApiKeysModule initialData={{ items: [], total: 0, pageSize: 25 }} />
        </ToastProvider>
      </SWRConfig>,
    );
    expect(
      await screen.findByText(`Genera una API key para conectar sistemas externos con ${NOMBRE_ESPERADO}.`),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(MARCA_RETIRADA);
  });

  it("Envíos automáticos: la descripción de la página dice quién manda los mensajes", async () => {
    const pagina = (await import("@/app/(app)/configuracion/envios-whatsapp/page")).default;
    render(await pagina());
    expect(
      screen.getByText(
        `Mensajes de WhatsApp que ${NOMBRE_ESPERADO} manda solo, a una hora fija o cuando pasa algo`,
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(MARCA_RETIRADA);
  });

  it("Tarifas de zona: la explicación de «Pagos por zona» dice quién paga", () => {
    render(<p>{PAGO_ZONA_TEXTO.seccionAyuda}</p>);
    expect(
      screen.getByText(
        `Lo que ${NOMBRE_ESPERADO} paga por cada gestión en esta zona: la entrega se le paga al mensajero; ` +
          "una Devolución a origen por rechazo es ingreso de la bodega responsable del mensajero.",
      ),
    ).toBeInTheDocument();
  });

  it("P2: el ejemplo de razón social del titular SINPE es «Velox Courier S.A.»", () => {
    expect(SINPE_CAMPO_NOMBRE.placeholder).toBe(`Ej: ${NOMBRE_ESPERADO} S.A.`);
  });
});
