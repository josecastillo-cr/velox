import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";

import { asentarCierreDia, type DependenciasAsiento } from "@/lib/repositories/asentar-cierre-dia";

/**
 * FICHA 498 (T3.2; R5, R7) — `asentarCierreDia`, con dobles que anotan CADA llamada en una traza.
 *
 *  · R5: el orden de las llamadas es el de la aprobacion de antes de la ficha (caja → tienda → COD →
 *    mensajero → egreso del mensajero → indemnizacion). La foto de las FILAS vive en
 *    `498-aprobacion-satelite-sql-real.test.ts` (T1.2); aqui se mide el ORDEN, que la foto no ve.
 *  · `cajaCodFeed` solo se consulta si el libro por tienda acredito `cod_recaudado`.
 *  · R7: lo que escribe sale SOLO de los cinco feeds; ninguno de ellos emite premios.
 */

const TX = {} as Prisma.TransactionClient;
const CIERRE = "c-498";

function montar(opts: { conCod?: boolean; egresoMensajero?: boolean; indemnizacion?: boolean } = {}) {
  const traza: string[] = [];
  const escrito: { libro: string; movs: unknown[] }[] = [];
  const deps: DependenciasAsiento = {
    walletFeedService: {
      construirMovimientosDeIngreso: vi.fn(async () => {
        traza.push("feed-caja");
        return [{ tipo: "ingreso", categoria: "ingreso_flete", monto: "10.00", origenTipo: "cierre_dia", origenId: CIERRE }];
      }),
    },
    walletMovimientoRepo: {
      crearMovimientos: vi.fn(async (_tx: unknown, movs: { categoria: string }[]) => {
        traza.push(`caja:${movs.map((m) => m.categoria).join(",")}`);
        escrito.push({ libro: "caja", movs });
        return movs.length;
      }),
    },
    walletTiendaFeedService: {
      construirMovimientosPorTienda: vi.fn(async () => {
        traza.push("feed-tienda");
        return opts.conCod === false
          ? [{ tipo: "debito", categoria: "flete", monto: "10.00", origenTipo: "cierre_dia", origenId: CIERRE, tiendaId: "t" }]
          : [
              { tipo: "credito", categoria: "cod_recaudado", monto: "100.00", origenTipo: "cierre_dia", origenId: CIERRE, tiendaId: "t" },
              { tipo: "debito", categoria: "flete", monto: "10.00", origenTipo: "cierre_dia", origenId: CIERRE, tiendaId: "t" },
            ];
      }),
    },
    walletTiendaMovimientoRepo: {
      crearMovimientos: vi.fn(async (_tx: unknown, movs: unknown[]) => {
        traza.push("tienda");
        escrito.push({ libro: "tienda", movs });
        return movs.length;
      }),
    },
    cajaCodFeed: {
      construirIngresoCod: vi.fn(async () => {
        traza.push("feed-cod");
        return [{ tipo: "ingreso", categoria: "ingreso_cod_recaudado", monto: "100.00", origenTipo: "cierre_dia", origenId: CIERRE }];
      }),
    },
    walletMensajeroFeedService: {
      construirMovimientosDePago: vi.fn(async () => {
        traza.push("feed-mensajero");
        return {
          libro: [{ tipo: "devengo", categoria: "pago_devengado", monto: "15.00", origenTipo: "cierre_dia", origenId: CIERRE, mensajeroId: "m" }],
          egresoCaja:
            opts.egresoMensajero === false
              ? []
              : [{ tipo: "egreso", categoria: "egreso_pago_mensajero", monto: "15.00", origenTipo: "cierre_dia", origenId: CIERRE }],
        };
      }),
    },
    pagoMensajeroMovimientoRepo: {
      crearMovimientos: vi.fn(async (_tx: unknown, movs: unknown[]) => {
        traza.push("mensajero");
        escrito.push({ libro: "mensajero", movs });
        return movs.length;
      }),
    },
    walletIndemnizacionFeedService: {
      construirEgresoIndemnizacion: vi.fn(async () => {
        traza.push("feed-indemnizacion");
        return opts.indemnizacion === true
          ? [{ tipo: "egreso", categoria: "egreso_indemnizacion", monto: "30.00", origenTipo: "cierre_dia", origenId: CIERRE }]
          : [];
      }),
    },
  } as unknown as DependenciasAsiento;
  return { deps, traza, escrito };
}

describe("498/T3.2 — asentarCierreDia (R5, R7)", () => {
  it("⭑ R5: el ORDEN de la aprobacion de antes, literal", async () => {
    const { deps, traza } = montar({ indemnizacion: true });
    await asentarCierreDia(TX, CIERRE, deps);
    expect(traza).toEqual([
      "feed-caja",
      "caja:ingreso_flete",
      "feed-tienda",
      "tienda",
      "feed-cod", // DESPUES de escribir el libro por tienda: el feed del COD lo lee (R12 de la 173)
      "caja:ingreso_cod_recaudado",
      "feed-mensajero",
      "mensajero",
      "caja:egreso_pago_mensajero",
      "feed-indemnizacion",
      "caja:egreso_indemnizacion",
    ]);
  });

  it("todas las llamadas reciben la `tx` y el id del cierre del llamador", async () => {
    const { deps } = montar();
    await asentarCierreDia(TX, CIERRE, deps);
    expect(deps.walletFeedService.construirMovimientosDeIngreso).toHaveBeenCalledWith(CIERRE, TX);
    expect(deps.walletTiendaFeedService.construirMovimientosPorTienda).toHaveBeenCalledWith(CIERRE, TX);
    expect(deps.cajaCodFeed.construirIngresoCod).toHaveBeenCalledWith(CIERRE, TX);
    expect(deps.walletMensajeroFeedService.construirMovimientosDePago).toHaveBeenCalledWith(CIERRE, TX);
    expect(deps.walletIndemnizacionFeedService.construirEgresoIndemnizacion).toHaveBeenCalledWith(CIERRE, TX);
    for (const repo of [deps.walletMovimientoRepo, deps.walletTiendaMovimientoRepo, deps.pagoMensajeroMovimientoRepo]) {
      for (const llamada of vi.mocked(repo.crearMovimientos).mock.calls) expect(llamada[0]).toBe(TX);
    }
  });

  it("`acreditoCod`: sin credito `cod_recaudado` en el libro por tienda, el feed del COD NI SE CONSULTA", async () => {
    const { deps, traza } = montar({ conCod: false });
    await asentarCierreDia(TX, CIERRE, deps);
    expect(deps.cajaCodFeed.construirIngresoCod).not.toHaveBeenCalled();
    expect(traza).not.toContain("feed-cod");
  });

  it("sin egreso del mensajero ni indemnizacion, la caja no recibe listas vacias", async () => {
    const { deps, traza } = montar({ egresoMensajero: false, indemnizacion: false });
    await asentarCierreDia(TX, CIERRE, deps);
    expect(traza.filter((t) => t.startsWith("caja:"))).toEqual(["caja:ingreso_flete", "caja:ingreso_cod_recaudado"]);
  });

  it("⭑ R7: no escribe premios del ranking ni filas con `premio_dia`: solo lo que emiten los cinco feeds", async () => {
    const { deps, escrito } = montar({ indemnizacion: true });
    await asentarCierreDia(TX, CIERRE, deps);
    const todo = JSON.stringify(escrito);
    expect(todo).not.toContain("premio_ranking");
    expect(todo).not.toContain("premioDia");
    // Y la fuente no nombra premios: el procedimiento no tiene un camino propio que los escriba.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const fuente = fs.readFileSync(path.join(process.cwd(), "lib/repositories/asentar-cierre-dia.ts"), "utf8");
    expect(fuente.replace(/\/\/[^\n]*/g, "")).not.toMatch(/premio_ranking|premioDia|premio_dia/);
  });
});
