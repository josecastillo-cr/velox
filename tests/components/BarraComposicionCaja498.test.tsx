// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  BarraComposicionCaja,
  COLOR_IVA_POR_PAGAR,
  COLOR_POR_COBRAR_SATELITES,
} from "@/app/(app)/wallet/_components/BarraComposicionCaja";
import type { CajaResumenDTO, ModoComposicionCaja } from "@/lib/types/wallet";
import { MODO_COMPOSICION_CAJA_SEED } from "@/lib/types/wallet";
import { NOMBRE_CORTO_ESPERADO } from "@/tests/fixtures/marca-esperada";

import { contraste, token } from "../fixtures/contraste";

/**
 * Ficha 498 (T7.1, design §8.2) — la barra con el CUARTO bolsillo, «Por cobrar a satélites».
 *
 *  - R38: con el bolsillo POSITIVO, un tramo propio insertado ANTES DEL ÚLTIMO, cuyo ancho es el
 *    STRING `porcentajePorCobrar` del DTO; el último sigue ocupando el resto (el tramo de la empresa
 *    no se descuenta: no tiene ancho propio que se le pueda restar).
 *  - R39: con el bolsillo en cero o negativo, el árbol de la barra es EXACTAMENTE el de antes, con y
 *    sin IVA.
 *  - El color: token propio de `chart-*`, ≥ 3:1 contra la pista `--muted` en los DOS temas.
 *
 * Las formas esperadas van escritas a mano por modo (design §8.2), no derivadas del componente.
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
  porcentajeTiendas: "60.25",
  ivaCobrado: "0.00",
  ivaPorPagar: "0.00",
  signoIvaPorPagar: "cero",
  porcentajeIva: "0.00",
  porCobrarSatelites: "2000.00",
  signoPorCobrarSatelites: "positivo",
  porcentajePorCobrar: "13.35",
  modoComposicion: "dos_bolsillos",
  capital: "0.00",
  signoCapital: "cero",
  deEmpresa: "1500.00",
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

describe("498 — «Por cobrar a satélites» positivo, sin IVA (R38)", () => {
  const CASOS: Record<ModoComposicionCaja, { overrides: Partial<CajaResumenDTO>; forma: string[] }> = {
    dos_bolsillos: {
      overrides: { porcentajeTiendas: "60.25", porcentajePorCobrar: "13.35" },
      forma: ["tiendas:60.25%", "por_cobrar:13.35%", "empresa:resto"],
    },
    solo_tiendas: {
      overrides: { porcentajeTiendas: "80.15", porcentajePorCobrar: "19.85" },
      forma: ["por_cobrar:19.85%", "tiendas:resto"],
    },
    solo_empresa: {
      overrides: { porcentajeTiendas: "0.00", porcentajePorCobrar: "25.45" },
      forma: ["por_cobrar:25.45%", "empresa:resto"],
    },
    sin_reparto: {
      overrides: { porcentajeTiendas: "0.00", porcentajePorCobrar: "100.00" },
      forma: ["por_cobrar:todo"],
    },
  };

  it("control: la tabla cubre los cuatro modos del servidor", () => {
    expect(Object.keys(CASOS).sort()).toEqual([...MODO_COMPOSICION_CAJA_SEED].sort());
  });

  it.each(Object.entries(CASOS))("%s: segmentos, orden y anchos de design §8.2", (modo, caso) => {
    const { container } = pintar({ modoComposicion: modo as ModoComposicionCaja, ...caso.overrides });
    expect(forma(container)).toEqual(caso.forma);
  });
});

describe("498 — «Por cobrar a satélites» Y el IVA positivos (R38)", () => {
  const CON_IVA = { ivaPorPagar: "1500.00", signoIvaPorPagar: "positivo" as const };
  const CASOS: Record<ModoComposicionCaja, { overrides: Partial<CajaResumenDTO>; forma: string[] }> = {
    dos_bolsillos: {
      overrides: { porcentajeTiendas: "60.25", porcentajeIva: "10.05", porcentajePorCobrar: "13.35" },
      forma: ["tiendas:60.25%", "iva:10.05%", "por_cobrar:13.35%", "empresa:resto"],
    },
    solo_tiendas: {
      overrides: { porcentajeTiendas: "70.15", porcentajeIva: "9.95", porcentajePorCobrar: "19.85" },
      forma: ["tiendas:70.15%", "por_cobrar:19.85%", "iva:resto"],
    },
    solo_empresa: {
      overrides: { porcentajeTiendas: "0.00", porcentajeIva: "33.35", porcentajePorCobrar: "25.45" },
      forma: ["iva:33.35%", "por_cobrar:25.45%", "empresa:resto"],
    },
    sin_reparto: {
      overrides: { porcentajeTiendas: "0.00", porcentajeIva: "40.35", porcentajePorCobrar: "59.65" },
      forma: ["por_cobrar:59.65%", "iva:resto"],
    },
  };

  it("control: la tabla cubre los cuatro modos del servidor", () => {
    expect(Object.keys(CASOS).sort()).toEqual([...MODO_COMPOSICION_CAJA_SEED].sort());
  });

  it.each(Object.entries(CASOS))("%s: segmentos, orden y anchos de design §8.2", (modo, caso) => {
    const { container } = pintar({
      modoComposicion: modo as ModoComposicionCaja,
      ...CON_IVA,
      ...caso.overrides,
    });
    expect(forma(container)).toEqual(caso.forma);
  });

  it("el último segmento ocupa SIEMPRE el resto (o la barra entera): ningún redondeo abre hueco", () => {
    for (const modo of MODO_COMPOSICION_CAJA_SEED) {
      for (const iva of ["positivo", "cero"] as const) {
        const { container } = pintar({ modoComposicion: modo, signoIvaPorPagar: iva });
        const ultimo = [...container.querySelectorAll<HTMLElement>("[data-segmento]")].at(-1);
        const clases = ultimo?.className.split(/\s+/) ?? [];
        expect(clases.includes("flex-1") || clases.includes("w-full"), `${modo}/${iva}`).toBe(true);
        cleanup();
      }
    }
  });
});

describe("498 — el tramo es el STRING del servidor y lo decide su SIGNO", () => {
  it("el ancho es `porcentajePorCobrar` tal cual, sin redondear ni convertir", () => {
    const { container } = pintar({ porcentajePorCobrar: "7.35" });
    expect(container.querySelector<HTMLElement>('[data-segmento="por_cobrar"]')?.style.width).toBe("7.35%");
  });

  it("con el porcentaje en 12.55 pero el signo «cero», no hay tramo", () => {
    const { container } = pintar({ signoPorCobrarSatelites: "cero", porcentajePorCobrar: "12.55" });
    expect(container.querySelector('[data-segmento="por_cobrar"]')).toBeNull();
  });
});

describe("498 — en cero o negativo, la barra de antes (R39)", () => {
  // La barra de la 231/459/488, escrita a mano: lo que pintaba antes de esta ficha.
  const ANTES_SIN_IVA: Record<ModoComposicionCaja, string[]> = {
    dos_bolsillos: ["tiendas:60.25%", "empresa:resto"],
    solo_tiendas: ["tiendas:todo"],
    solo_empresa: ["empresa:todo"],
    sin_reparto: [],
  };
  const ANTES_CON_IVA: Record<ModoComposicionCaja, string[]> = {
    dos_bolsillos: ["tiendas:60.25%", "iva:12.55%", "empresa:resto"],
    solo_tiendas: ["tiendas:60.25%", "iva:resto"],
    solo_empresa: ["iva:12.55%", "empresa:resto"],
    sin_reparto: ["iva:12.55%"],
  };

  it.each(
    MODO_COMPOSICION_CAJA_SEED.flatMap((modo) =>
      (["cero", "negativo"] as const).flatMap((signo) =>
        ([false, true] as const).map((conIva) => [modo, signo, conIva] as const),
      ),
    ),
  )("%s con «Por cobrar» %s (IVA positivo: %s): mismo árbol que antes", (modo, signo, conIva) => {
    const { container } = pintar({
      modoComposicion: modo,
      porCobrarSatelites: signo === "cero" ? "0.00" : "-300.00",
      signoPorCobrarSatelites: signo,
      porcentajePorCobrar: "0.00",
      ...(conIva
        ? { ivaPorPagar: "1500.00", signoIvaPorPagar: "positivo" as const, porcentajeIva: "12.55" }
        : {}),
    });
    expect(forma(container)).toEqual((conIva ? ANTES_CON_IVA : ANTES_SIN_IVA)[modo]);
    expect(container.querySelector('[data-segmento="por_cobrar"]')).toBeNull();
  });
});

describe("498 — el nombre accesible", () => {
  it("con el bolsillo positivo, lo enuncia con su importe al final", () => {
    pintar({ deTerceros: "9000.00", deEmpresa: "1500.75", ivaPorPagar: "0.00", porCobrarSatelites: "2000.50" });
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      `Reparto del dinero en caja. De las tiendas: ₡9.000. De ${NOMBRE_CORTO_ESPERADO}: ₡1.500,75 (ganancia y aportes). IVA por pagar: ₡0. Por cobrar a satélites: ₡2.000,50.`,
    );
  });

  it("en cero o negativo, el nombre de antes (sin el cuarto bolsillo)", () => {
    for (const signo of ["cero", "negativo"] as const) {
      pintar({ signoPorCobrarSatelites: signo, porCobrarSatelites: signo === "cero" ? "0.00" : "-5.00" });
      expect(screen.getByRole("img").getAttribute("aria-label")).not.toContain("satélites");
      cleanup();
    }
  });
});

describe("498 — el color del tramo (design §8.2)", () => {
  /** Umbral de WCAG 2.1 §1.4.11 para un objeto gráfico no textual. */
  const UMBRAL_GRAFICO = 3;
  const nombre = COLOR_POR_COBRAR_SATELITES.replace(/^bg-/, "");

  it("es un token propio de `chart-*`, distinto de los que ya pinta la barra y del capital del libro", () => {
    expect(COLOR_POR_COBRAR_SATELITES).toMatch(/^bg-chart-\d+$/);
    for (const otro of ["bg-warning", "bg-muted-foreground", COLOR_IVA_POR_PAGAR, "bg-info"]) {
      expect(COLOR_POR_COBRAR_SATELITES).not.toBe(otro);
    }
  });

  it("el segmento pintado lleva ese token", () => {
    const { container } = pintar();
    expect(container.querySelector<HTMLElement>('[data-segmento="por_cobrar"]')?.className).toContain(
      COLOR_POR_COBRAR_SATELITES,
    );
  });

  // MEDIDO al elegirlo (T7.1): bg-chart-16 → 6.45 claro · 7.84 oscuro contra `--muted`.
  it.each(["claro", "oscuro"] as const)("en tema %s supera el 3:1 contra la pista `bg-muted`", (tema) => {
    const razon = contraste(token(tema, nombre), token(tema, "muted"));
    expect(razon, `${COLOR_POR_COBRAR_SATELITES} da ${razon.toFixed(2)}:1 en tema ${tema}`).toBeGreaterThanOrEqual(
      UMBRAL_GRAFICO,
    );
  });

  it("la medición NO es vacía: `chart-4` (que da 2.30 en claro) SÍ falla", () => {
    expect(contraste(token("claro", "chart-4"), token("claro", "muted"))).toBeLessThan(UMBRAL_GRAFICO);
  });
});
