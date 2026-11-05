// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Ningun camino de este archivo debe construir el Storage real.
const almacenCtor = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/SupabaseAlmacenDescargas", () => ({
  SupabaseAlmacenDescargas: class {
    constructor(...args: unknown[]) {
      almacenCtor(...args);
    }
  },
}));
vi.mock("@/components/shared/descargar-blob", () => ({ descargarBlob: vi.fn() }));
const { errorMock } = vi.hoisted(() => ({ errorMock: vi.fn() }));
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: errorMock, warning: vi.fn(), info: vi.fn(), show: vi.fn(), dismiss: vi.fn() }),
}));

import { DataTable } from "@/components/shared/DataTable";
import { DescargaTransporteError, descargarDatos } from "@/components/shared/descarga-datos";
import { descargarBlob } from "@/components/shared/descargar-blob";
import { NOMBRES_DESCARGA } from "@/lib/actions/_shared/registro-descargas";
import { prepararDescargaAction } from "@/lib/actions/descargas";
import type { IEntregaDescargaService } from "@/lib/interfaces/services/IEntregaDescargaService";

// FEATURE 494 (design §3.2) — LA PESTAÑA VIEJA NO GUARDA UN ARCHIVO SIN CIFRAS.
//
// Una pestaña de la version anterior lee en el navegador los campos con su nombre viejo. Si recibe la
// forma nueva, la descarga detallada de cierres deja vacias seis columnas de dinero y el libro de caja
// pone «—» en «A quien», sin error, y un archivo guardado no se corrige recargando. Por eso estas cuatro
// claves cambian de nombre, sin alias: la pestaña vieja manda la clave de antes y recibe un rechazo.
//
// Literales a proposito: si alguien vuelve a la clave vieja o la admite como alias, tiene que salir rojo.
// Aqui corren la accion real, el registro real, `descargarDatos` real y el boton real.

const CLAVES_VIEJAS = [
  "listarGestionesCierresAdminCompleto",
  "listarGestionesCierresBodegaCompleto",
  "libroCajaKardex",
  "libroCajaKardexConDetalle",
] as const;

const CLAVES_NUEVAS = [
  "listarGestionesCierresAdminCompletoV2",
  "listarGestionesCierresBodegaCompletoV2",
  "libroCajaKardexV2",
  "libroCajaKardexConDetalleV2",
] as const;

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("494 — las claves de descarga con campos renombrados", () => {
  it("el registro tiene las nuevas y ninguna de las viejas", () => {
    for (const c of CLAVES_NUEVAS) expect(NOMBRES_DESCARGA, c).toContain(c);
    for (const c of CLAVES_VIEJAS) expect(NOMBRES_DESCARGA, c).not.toContain(c);
  });

  it.each(CLAVES_VIEJAS)("%s, contra el servidor nuevo: validation_error, sin ejecutar nada ni generar sobre", async (vieja) => {
    const accion = vi.fn(async () => ({ status: "ok", items: [] }));
    const entregar = vi.fn(async (r: unknown) => ({ modo: "directo" as const, resultado: r }));
    // Aunque el registro inyectado tuviera la clave vieja, el borde la rechaza antes de mirarlo.
    const r = await prepararDescargaAction(vieja, {}, {
      registro: { [vieja]: accion },
      entrega: { entregar } as unknown as IEntregaDescargaService,
    });
    expect(r).toEqual({ status: "validation_error", fieldErrors: { nombre: ["Descarga desconocida"] } });
    expect(accion).not.toHaveBeenCalled();
    expect(entregar).not.toHaveBeenCalled();
  });

  it.each(CLAVES_VIEJAS)("%s, con el registro real y por `descargarDatos`: lanza, no devuelve filas", async (vieja) => {
    await expect(descargarDatos(vieja as never, {} as never)).rejects.toBeInstanceOf(DescargaTransporteError);
    expect(almacenCtor).not.toHaveBeenCalled();
  });

  it.each(CLAVES_VIEJAS)("%s, desde el boton: avisa con el error y no sale ningun archivo", async (vieja) => {
    const user = userEvent.setup();
    render(
      <DataTable<{ id: string; nombre: string }>
        columns={[{ id: "nombre", value: "Nombre" }]}
        data={[{ id: "a", nombre: "Ana" }]}
        ariaLabel="Tabla de prueba"
        descarga={{
          titulo: "Gestiones",
          columnas: [{ clave: "nombre", encabezado: "Nombre" }],
          // Lo que hace la pestaña vieja: pedir con la clave de antes y pasar el resultado a filas.
          obtenerFilas: async () => {
            await descargarDatos(vieja as never, {} as never);
            return { status: "ok" as const, filas: [{ nombre: "no debe salir" }] };
          },
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /descargar gestiones/i }));
    await waitFor(() => expect(errorMock).toHaveBeenCalledTimes(1));
    expect(errorMock.mock.calls[0][0]).toBe("No se pudo generar el archivo. Vuelve a intentarlo; el listado no cambió.");
    expect(descargarBlob).not.toHaveBeenCalled();
  });
});
