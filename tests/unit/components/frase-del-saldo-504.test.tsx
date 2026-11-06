// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import { TarjetasEstadoCuenta } from "@/components/shared/estado-cuenta/TarjetasEstadoCuenta";
import { fraseDelSaldo, fraseDelSaldoParaLaTienda } from "@/components/shared/estado-cuenta/estado-cuenta-labels";
import type { SentidoDelSaldo, TipoDeCuenta } from "@/lib/types/estado-cuenta";
import { estado } from "@/tests/fixtures/estado-cuenta";
import { NOMBRE_ESPERADO } from "@/tests/fixtures/marca-esperada";

// FICHA 504 (design §3) — «no se deben nada» solo con el saldo en cero. Cada frase exige su sentido, y
// lo que la pantalla no reconoce dice la frase neutra en vez de afirmar algo sobre el dinero.
//
// Los textos se escriben a mano a propósito: comparar contra `ESTADO_CUENTA_TEXTO` o `MARCA` seguiría
// verde aunque el texto cambiara. La marca sale de `NOMBRE_ESPERADO`, literal independiente de `MARCA`.

const FRASE_NEUTRA = "No se pudo leer quién le debe a quién. Recargá la página.";

/** El sentido llega del servidor en tiempo de ejecución: el tipo no lo protege. */
const sentido = (valor: unknown) => valor as unknown as SentidoDelSaldo;

const NO_RECONOCIDOS = ["ordenex_debe", "EN_CERO", "", undefined, null] as const;
const TIENDA = "Tania Tienda";
const MENSAJERO = "Mario Mensajero";
const BODEGA = "Bodega Norte";
const OFICINA: ReadonlyArray<readonly [TipoDeCuenta, string]> = [
  ["tienda", TIENDA],
  ["mensajero", MENSAJERO],
];

afterEach(() => {
  cleanup();
});

describe("504 — en cero, oficina (R1)", () => {
  it("una tienda y Velox no se deben nada", () => {
    expect(fraseDelSaldo("tienda", "en_cero", TIENDA, "₡0")).toBe(`${NOMBRE_ESPERADO} y Tania Tienda no se deben nada`);
  });

  it("un mensajero y Velox no se deben nada", () => {
    expect(fraseDelSaldo("mensajero", "en_cero", MENSAJERO, "₡0")).toBe(
      `${NOMBRE_ESPERADO} y Mario Mensajero no se deben nada`,
    );
  });
});

describe("504 — en cero, la tienda (R2)", () => {
  it("la tienda lee la frase en segunda persona", () => {
    expect(fraseDelSaldoParaLaTienda("en_cero", "₡0")).toBe(`${NOMBRE_ESPERADO} y vos no se deben nada`);
  });
});

describe("504 — no reconocido, oficina (R3)", () => {
  describe.each(OFICINA)("%s", (tipo, nombre) => {
    it.each([...NO_RECONOCIDOS, "por_entregar"])("sentido %j dice la frase neutra", (valor) => {
      expect(fraseDelSaldo(tipo, sentido(valor), nombre, "₡9.000")).toBe(FRASE_NEUTRA);
    });
  });
});

describe("504 — no reconocido, la tienda (R4)", () => {
  it.each([...NO_RECONOCIDOS, "por_entregar"])("sentido %j dice la frase neutra", (valor) => {
    expect(fraseDelSaldoParaLaTienda(sentido(valor), "₡9.000")).toBe(FRASE_NEUTRA);
  });
});

describe("504 — no reconocido, bodega (R5)", () => {
  it.each([...NO_RECONOCIDOS, "cuenta_debe"])("sentido %j dice la frase neutra", (valor) => {
    expect(fraseDelSaldo("bodega", sentido(valor), BODEGA, "₡9.000")).toBe(FRASE_NEUTRA);
  });
});

describe("504 — frases conocidas, carácter por carácter (R6)", () => {
  it.each([
    ["tienda", "empresa_debe", TIENDA, "₡9.000", `${NOMBRE_ESPERADO} le debe ₡9.000 a Tania Tienda`],
    ["tienda", "cuenta_debe", TIENDA, "₡9.000", `Tania Tienda le debe ₡9.000 a ${NOMBRE_ESPERADO}`],
    ["mensajero", "empresa_debe", MENSAJERO, "₡9.000", `${NOMBRE_ESPERADO} le debe ₡9.000 a Mario Mensajero`],
    ["mensajero", "cuenta_debe", MENSAJERO, "₡9.000", `Mario Mensajero le debe ₡9.000 a ${NOMBRE_ESPERADO}`],
    ["bodega", "por_entregar", BODEGA, "₡9.000", "Bodega Norte tiene ₡9.000 por entregar"],
    ["bodega", "en_cero", BODEGA, "₡0", "Bodega Norte no tiene nada por entregar"],
    ["bodega", "empresa_debe", BODEGA, "₡9.000", "Bodega Norte entregó ₡9.000 de más"],
  ] as const)("oficina: %s con %s", (tipo, valor, nombre, monto, esperado) => {
    expect(fraseDelSaldo(tipo, valor, nombre, monto)).toBe(esperado);
  });

  it.each([
    ["empresa_debe", `${NOMBRE_ESPERADO} te debe ₡9.000`],
    ["cuenta_debe", `Le debés ₡9.000 a ${NOMBRE_ESPERADO}`],
  ] as const)("la tienda: %s", (valor, esperado) => {
    expect(fraseDelSaldoParaLaTienda(valor, "₡9.000")).toBe(esperado);
  });
});

describe("504 — la tarjeta con sentido no reconocido (R7)", () => {
  it.each(["oficina", "tienda"] as const)("vista %s: frase neutra junto a la cifra con su signo", (vista) => {
    const dto = estado({ saldoActual: "-15000.00", signo: "negativo", sentido: sentido("ordenex_debe") });

    render(<TarjetasEstadoCuenta estado={dto} vista={vista} />);

    const tarjetas = screen.getByRole("region", { name: "Saldo de Tania Tienda" });
    expect(within(tarjetas).getByText(FRASE_NEUTRA)).toBeInTheDocument();
    expect(within(tarjetas).getByText("-₡15.000")).toBeInTheDocument();
    expect(tarjetas.textContent ?? "").not.toContain("no se deben");
  });
});
