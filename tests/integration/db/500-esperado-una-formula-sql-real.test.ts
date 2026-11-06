import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { CierresBodegaAdminRepository } from "@/lib/repositories/CierresBodegaAdminRepository";
import { SaldosSatelitesRepository } from "@/lib/repositories/SaldosSatelitesRepository";
import { HAY_BASE_DE_DATOS } from "./_postgres-real";
import { conEscenario, prepararMundo, type Mundo } from "./454/_escenario";
import { filasDeDiferencia } from "./498/_satelite";
import { sembrarConsolidacion } from "./498/_migraciones";

/**
 * FICHA 500 (T2.1; R10, R11) — UNA SOLA FORMULA DEL ESPERADO (bloque 4 de H5), con los numeros
 * LITERALES de H5: snapshot 9.000 / pago a mensajeros 1.500 / ganancia por rechazos 500 / recibido
 * 6.900. Los esperados se escriben A MANO (`7000.00`, `6900.00`, `100.00`): no se derivan de
 * `paraLaCentral` (memoria «Asercion contra su propia fuente»).
 *
 * Una transaccion que SIEMPRE se revierte. Sin base, la suite se SALTA (visible).
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase("500 — el esperado del ajuste es el «Falta por recibir» de la pantalla (Postgres real)", () => {
  let mundo: Mundo;
  let r: Awaited<ReturnType<typeof escenario>>;

  function escenario() {
    return conEscenario(mundo, async (e) => {
      const cliente = e.cliente as unknown as PrismaClient;
      const cbId = await sembrarConsolidacion(e.tx, {
        zonaId: e.zonaSateliteId,
        usuarioId: e.maestroId,
        general: "9000",
        pago: "1500",
        rechazos: "500",
      });
      // R11 — lo que la pantalla dice ANTES de marcar.
      const pagina = await new SaldosSatelitesRepository(cliente).findConsolidacionesPaginado(e.zonaSateliteId, {
        skip: 0,
        take: 50,
      });
      const antes = pagina.items.find((c) => c.cierreBodegaId === cbId);
      // R10 — marcar con 6.900 por el repositorio real.
      const marca = await new CierresBodegaAdminRepository(cliente).marcarConciliado({
        id: cbId,
        montoRecibido: "6900.00",
        nota: null,
        actorUsuarioId: e.maestroId,
      });
      return { antes, marca, diferencia: await filasDeDiferencia(e, cbId) };
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    r = await escenario();
  }, 600_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  it("anti-vacuidad: la pantalla trae la consolidacion y la marca se aplica", () => {
    expect(r.antes).toBeDefined();
    expect(r.marca).toBe("updated");
  });

  it("R10: una fila de ajuste 7000.00 / 6900.00 / 100.00 y un egreso «diferencia de la satelite» de 100.00", () => {
    expect(r.diferencia).toEqual([
      {
        tipo: "egreso",
        categoria: "egreso_diferencia_satelite",
        monto: "100.00",
        origen_tipo: expect.any(String),
        evento: "marca",
        diferencia: "100.00",
        monto_esperado: "7000.00",
        monto_recibido: "6900.00",
      },
    ]);
  });

  it("R11: el «Falta por recibir» de antes de marcar es 7000.00 e igual al esperado que escribe el ajuste", () => {
    expect(r.antes?.faltaPorRecibir).toBe("7000.00");
    expect(r.antes?.faltaPorRecibir).toBe(r.diferencia[0]?.monto_esperado);
  });
});
