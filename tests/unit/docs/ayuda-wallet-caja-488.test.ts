import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NOMBRE_CORTO_ESPERADO, NOMBRE_ESPERADO } from "@/tests/fixtures/marca-esperada";

// Ficha 488 (T F.7, R37) — la ayuda de la caja explica el IVA por pagar, que la ganancia no incluye el
// IVA, el Pago de IVA y su anulación, y ya no dice que anular un cobro por devolución a origen baja la
// ganancia en el IVA. Literales escritos a mano.
const AYUDA = readFileSync(path.join(process.cwd(), "docs/ayuda/oficina/wallet-caja.md"), "utf8");

describe("488 — la ayuda de la caja (R37)", () => {
  it("nombra el IVA por pagar, el Pago de IVA y su anulación", () => {
    expect(AYUDA).toContain("IVA por pagar");
    expect(AYUDA).toContain("Pago de IVA");
    expect(AYUDA).toContain("Pago de IVA anulado");
    expect(AYUDA).toContain("IVA cobrado a las tiendas");
  });

  it("dice que la ganancia no incluye el IVA", () => {
    expect(AYUDA).toMatch(new RegExp(`ganancia de ${NOMBRE_ESPERADO}\\*\\* no incluye el IVA`));
  });

  it("ya no dice que anular un cobro por devolución a origen baja la ganancia en el IVA", () => {
    expect(AYUDA).not.toContain("La **ganancia baja** en el flete más el IVA");
    expect(AYUDA).not.toMatch(/ganancia baja\*?\*? en el flete más el IVA/);
    // Control: el párrafo sigue existiendo, con la regla nueva.
    expect(AYUDA).toContain("La **ganancia baja** en el flete y el **IVA por pagar**");
  });

  it(`el diálogo tiene once conceptos y «Pago de IVA» está en «Sale dinero de ${NOMBRE_ESPERADO}»`, () => {
    expect(AYUDA).toContain("**once conceptos en tres grupos**");
    expect(AYUDA).toMatch(new RegExp(`\\| \\*\\*Sale dinero de ${NOMBRE_ESPERADO}\\*\\* \\| Gasto de ${NOMBRE_CORTO_ESPERADO} · Sueldo · Pago de IVA ·`));
  });
});
