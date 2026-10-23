// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { BarraComposicionCaja } from "@/app/(app)/wallet/_components/BarraComposicionCaja";
import type { CajaResumenDTO, ModoComposicionCaja } from "@/lib/types/wallet";
import { MODO_COMPOSICION_CAJA_SEED } from "@/lib/types/wallet";

/**
 * Ficha 488 (T F.3, design §2.3/§6.2) — la barra de composición con el TERCER bolsillo, «IVA por
 * pagar» (R14–R16).
 *
 * Lo que se mide:
 *  - R14: con IVA por pagar positivo hay porción de IVA, y su ancho es el STRING `porcentajeIva` del
 *    DTO pegado tal cual; el navegador no compara ni convierte importes.
 *  - R15: el nombre accesible enuncia los tres bolsillos con su importe.
 *  - R16: con el IVA en cero o negativo, el árbol de la barra es EXACTAMENTE el de antes de la ficha.
 *
 * Los segmentos y anchos esperados van escritos a mano por modo (design §2.3), no derivados del
 * componente. Los porcentajes llevan dos decimales significativos (el CSSOM se come un cero final).
 */
const BASE: CajaResumenDTO = {
  entradas: "15000.00",
  salidas: "3000.00",
  enCaja: "12000.00",
  signoEnCaja: "positivo",
  ingresosPropios: "5000.00",
  egresosPropios: "3000.00",
  ganancia: "1500.00",
  signoGanancia: "positivo",
  deTerceros: "9000.00",
  periodoFiltrado: false,
  porcentajeTiendas: "75.25",
  ivaCobrado: "1600.00",
  ivaPorPagar: "1500.00",
  signoIvaPorPagar: "positivo",
  porcentajeIva: "12.55",
  modoComposicion: "dos_bolsillos",
  capital: "0.00",
  signoCapital: "cero",
  deOrdenex: "1500.00",
  signoDeTerceros: "positivo",
  deTercerosAbsoluto: "9000.00",
  estado: "saldo",
  flujoDesde: "2026-08-25",
};

function pintar(overrides: Partial<CajaResumenDTO> = {}) {
  return render(<BarraComposicionCaja resumen={{ ...BASE, ...overrides }} />);
}

/** Cada segmento como `clave:ancho` (ancho = `style.width` o la clase de medida). */
function forma(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>("[data-segmento]")].map((s) => {
    const clave = s.dataset.segmento;
    if (s.style.width) return `${clave}:${s.style.width}`;
    if (s.className.split(/\s+/).includes("flex-1")) return `${clave}:resto`;
    if (s.className.split(/\s+/).includes("w-full")) return `${clave}:todo`;
    return `${clave}:?`;
  });
}

afterEach(() => {
  cleanup();
});

describe("488 — la barra con IVA por pagar positivo (R14)", () => {
  // design §2.3, escrito a mano. Cada modo con SUS porcentajes del servidor.
  const CASOS: Record<ModoComposicionCaja, { overrides: Partial<CajaResumenDTO>; forma: string[] }> = {
    dos_bolsillos: {
      overrides: { porcentajeTiendas: "75.25", porcentajeIva: "12.55" },
      forma: ["tiendas:75.25%", "iva:12.55%", "ordenex:resto"],
    },
    solo_tiendas: {
      overrides: { porcentajeTiendas: "85.75", porcentajeIva: "14.25" },
      forma: ["tiendas:85.75%", "iva:resto"],
    },
    solo_ordenex: {
      overrides: { porcentajeTiendas: "0.00", porcentajeIva: "33.35" },
      forma: ["iva:33.35%", "ordenex:resto"],
    },
    sin_reparto: {
      overrides: { porcentajeTiendas: "0.00", porcentajeIva: "100.00" },
      forma: ["iva:100%"],
    },
  };

  it("control: la tabla cubre los cuatro modos del servidor", () => {
    expect(Object.keys(CASOS).sort()).toEqual([...MODO_COMPOSICION_CAJA_SEED].sort());
  });

  it.each(Object.entries(CASOS))("%s: segmentos, orden y anchos de design §2.3", (modo, caso) => {
    const { container } = pintar({ modoComposicion: modo as ModoComposicionCaja, ...caso.overrides });
    expect(forma(container)).toEqual(caso.forma);
  });

  it("el ancho del IVA es el STRING del DTO, sin redondear ni convertir", () => {
    const { container } = pintar({ porcentajeIva: "7.35" });
    const iva = container.querySelector<HTMLElement>('[data-segmento="iva"]');
    expect(iva?.style.width).toBe("7.35%");
  });

  it("el IVA lleva su propio color de token, distinto de tiendas y de Ordenex", () => {
    const { container } = pintar();
    const clases = (clave: string) =>
      container.querySelector<HTMLElement>(`[data-segmento="${clave}"]`)?.className ?? "";
    expect(clases("iva")).toContain("bg-chart-13");
    expect(clases("tiendas")).toContain("bg-warning");
    expect(clases("ordenex")).toContain("bg-muted-foreground");
  });

  it("la presencia de la porción la decide el SIGNO del servidor, no el importe", () => {
    // El porcentaje dice 12.55 pero el servidor dice «cero»: la barra obedece al signo.
    const { container } = pintar({ signoIvaPorPagar: "cero", porcentajeIva: "12.55" });
    expect(container.querySelector('[data-segmento="iva"]')).toBeNull();
  });
});

describe("488 — sin IVA por pagar, la barra de antes (R16)", () => {
  // La barra de la 231/459, escrita a mano: lo que pintaba antes de esta ficha.
  const ANTES: Record<ModoComposicionCaja, string[]> = {
    dos_bolsillos: ["tiendas:75.25%", "ordenex:resto"],
    solo_tiendas: ["tiendas:todo"],
    solo_ordenex: ["ordenex:todo"],
    sin_reparto: [],
  };

  it.each(
    MODO_COMPOSICION_CAJA_SEED.flatMap((modo) =>
      (["cero", "negativo"] as const).map((signo) => [modo, signo] as const),
    ),
  )("%s con IVA %s: mismo árbol que antes", (modo, signo) => {
    const { container } = pintar({
      modoComposicion: modo,
      signoIvaPorPagar: signo,
      ivaPorPagar: signo === "cero" ? "0.00" : "-250.00",
      porcentajeIva: "0.00",
    });
    expect(forma(container)).toEqual(ANTES[modo]);
    expect(container.querySelector('[data-segmento="iva"]')).toBeNull();
  });
});

describe("488 — el nombre accesible enuncia los tres bolsillos (R15)", () => {
  it("con su rótulo y su importe", () => {
    pintar({ deTerceros: "9000.00", deOrdenex: "1500.75", ivaPorPagar: "1499.25" });
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Reparto del dinero en caja. De las tiendas: ₡9.000. De Ordenex: ₡1.500,75 (ganancia y aportes). IVA por pagar: ₡1.499,25.",
    );
  });
});
