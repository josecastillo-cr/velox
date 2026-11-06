import { describe, expect, it, vi } from "vitest";

import { CONCEPTO_REGISTRO_DE } from "@/app/(app)/wallet/_components/wallet-conceptos-manuales";
import { previsualizarMovimientoAction } from "@/lib/actions/efecto-movimiento";
import type { IPrevisualizarMovimientoService } from "@/lib/interfaces/services/IPrevisualizarMovimientoService";
import { CONCEPTO_REGISTRO_SEED, previsualizarMovimientoSchema } from "@/lib/types/efecto-movimiento";
import { EFECTO_POR_TIPO } from "@/lib/utils/efecto-movimiento";
import { CONCEPTOS_RETIRADOS_494 } from "@/tests/fixtures/marca-retirada-nombre-493";

// FEATURE 494 (R7, design §3.2) — los dos conceptos renombrados de la previsualización. El nombre anterior
// responde error de validación, sin lanzar y sin llegar al servicio; el nuevo pasa. Los conceptos van literales:
// son el contrato entre la página y el servidor, y compararlos con su propia fuente siempre daría verde.

const TIENDA_ID = "00000000-0000-4000-8000-0000000000a1";
const CATALOGO_LITERAL = [
  "gasto_empresa",
  "sueldo",
  "pago_iva",
  "pago_gasto_tienda",
  "correccion_resta",
  "pago_a_tienda",
  "pago_a_mensajero",
  "aporte",
  "correccion_suma",
  "tienda_paga_a_empresa",
  "cobro_a_tienda",
];

function montar() {
  const previsualizar = vi.fn(async () => ({ status: "no_encontrado" as const }));
  const service = { previsualizar } as unknown as IPrevisualizarMovimientoService;
  return { previsualizar, deps: { service, getActor: async () => ({ usuarioId: "m", rol: "maestro" as const }) } };
}

describe("R7 — el concepto con el nombre anterior no pasa", () => {
  it.each(CONCEPTOS_RETIRADOS_494)("%s: el esquema lo rechaza por el campo `concepto`", (viejo) => {
    const r = previsualizarMovimientoSchema.safeParse({ concepto: viejo, cuentaId: TIENDA_ID, monto: "10" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["concepto"]);
  });

  it.each(CONCEPTOS_RETIRADOS_494)("%s: la action responde `validation_error`, sin lanzar y sin llegar al servicio", async (viejo) => {
    const { previsualizar, deps } = montar();
    const r = await previsualizarMovimientoAction({ concepto: viejo, cuentaId: TIENDA_ID, monto: "10" }, deps);
    expect(r.status).toBe("validation_error");
    expect(previsualizar).not.toHaveBeenCalled();
  });

  it.each(["gasto_empresa", "tienda_paga_a_empresa"])("%s: el nombre nuevo sí llega al servicio", async (nuevo) => {
    const { previsualizar, deps } = montar();
    const r = await previsualizarMovimientoAction({ concepto: nuevo, cuentaId: TIENDA_ID, monto: "10" }, deps);
    expect(r.status).toBe("no_encontrado");
    expect(previsualizar).toHaveBeenCalledTimes(1);
    expect(previsualizar.mock.calls[0]).toEqual([{ concepto: nuevo, cuentaId: TIENDA_ID, monto: "10" }, expect.anything()]);
  });
});

describe("R7 — el catálogo y quien lo usa llevan el nombre nuevo", () => {
  it("el catálogo es la lista literal, en su orden", () => {
    expect([...CONCEPTO_REGISTRO_SEED]).toEqual(CATALOGO_LITERAL);
  });

  it("la tabla de efectos tiene una fila por concepto y ninguna con el nombre anterior", () => {
    expect(Object.keys(EFECTO_POR_TIPO).sort()).toEqual([...CATALOGO_LITERAL].sort());
  });

  it("el diálogo pide el «Así queda» del gasto y del abono con el nombre nuevo", () => {
    expect(CONCEPTO_REGISTRO_DE.gasto_variable).toBe("gasto_empresa");
    expect(CONCEPTO_REGISTRO_DE.abono_tienda).toBe("tienda_paga_a_empresa");
  });
});
