import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";

import { WalletComprobanteRepository } from "@/lib/repositories/WalletComprobanteRepository";

import { HAY_BASE_DE_DATOS, crearPrismaDeTest } from "./_postgres-real";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// FICHA 488 — revision m2: `WalletComprobanteRepository.estaAnulado("egreso_caja", id)` reconoce
// como anulado un egreso cuyo contra-asiento es CUALQUIERA de `CATEGORIAS_DE_CONTRA_ASIENTO_DE_EGRESO`.
// Antes buscaba solo `ingreso_ajuste`, y un Pago de IVA con su `ingreso_reverso_pago_iva` (sin la
// constancia `ajuste_caja_anulacion`) se leia vigente. Contra Postgres: el WHERE vive en el
// repositorio, y un doble no lo ve. Las filas se siembran a mano dentro de una transaccion que se
// revierte; NO se escribe constancia, para que la unica senal sea el contra-asiento.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

class Revertir extends Error {
  constructor(readonly valor: Record<string, boolean>) {
    super("rollback");
  }
}

describeSiHayBase("488/m2 — estaAnulado del egreso de caja usa la lista de contra-asientos (Postgres real)", () => {
  let prisma: PrismaClient;
  let medida: Record<string, boolean> | undefined;

  beforeAll(async () => {
    prisma = crearPrismaDeTest();
    try {
      await prisma.$transaction(async (tx) => {
        const repo = new WalletComprobanteRepository(tx as never);
        const sembrar = (tipo: "ingreso" | "egreso", categoria: string, origenId: string | null) =>
          tx.walletMovimiento.create({
            data: { tipo, categoria: categoria as never, monto: new Prisma.Decimal("10.00"), origenTipo: "gasto", origenId },
            select: { id: true },
          });

        const pagoIvaAnulado = await sembrar("egreso", "egreso_pago_iva", null);
        await sembrar("ingreso", "ingreso_reverso_pago_iva", pagoIvaAnulado.id);
        const gastoAnulado = await sembrar("egreso", "egreso_gasto_variable", null);
        await sembrar("ingreso", "ingreso_ajuste", gastoAnulado.id);
        const pagoIvaVigente = await sembrar("egreso", "egreso_pago_iva", null);

        throw new Revertir({
          pagoIvaAnulado: await repo.estaAnulado("egreso_caja", pagoIvaAnulado.id),
          gastoAnulado: await repo.estaAnulado("egreso_caja", gastoAnulado.id),
          pagoIvaVigente: await repo.estaAnulado("egreso_caja", pagoIvaVigente.id),
        });
      });
    } catch (e) {
      if (!(e instanceof Revertir)) throw e;
      medida = e.valor;
    }
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("un Pago de IVA con su `ingreso_reverso_pago_iva` (sin constancia) se lee anulado", () => {
    expect(medida).toBeDefined();
    expect(medida!.pagoIvaAnulado).toBe(true);
  });

  it("control: un gasto con `ingreso_ajuste` sigue anulado y un Pago de IVA sin contra-asiento sigue vigente", () => {
    expect(medida).toEqual({ pagoIvaAnulado: true, gastoAnulado: true, pagoIvaVigente: false });
  });
});
