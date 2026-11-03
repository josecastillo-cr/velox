import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";

import { SaldosSatelitesRepository } from "@/lib/repositories/SaldosSatelitesRepository";
import { HAY_BASE_DE_DATOS } from "./_postgres-real";
import { conEscenario, prepararMundo, type Mundo } from "./454/_escenario";
import {
  SNAPSHOT_SELECT,
  aporteAMano,
  cierreSateliteAprobado,
  consolidar,
  tarifaDeLaTienda,
} from "./498/_satelite";

/**
 * FICHA 498 (T1.4, T4.x; R23-R32, R41a, R54c) — LA DEUDA DE UNA SATELITE, contra Postgres real.
 *
 * Formula de R23, HECHA A MANO en el test (no se llama a `paraLaCentral`):
 *   deuda = Σ aportes de sus cierres aprobados (fuera de saldadas con la regla anterior)
 *         + Σ aporte reconocido de sus saldadas no rechazadas
 *         − Σ monto_recibido de sus consolidaciones no rechazadas.
 * El aporte incluye TODOS los metodos de pago.
 *
 * T1.4 es ROJO contra el codigo de antes de la ficha: alli la deuda era Σ efectivo de las
 * consolidaciones − Σ recibido (sin cierres sin consolidar y sin SINPE).
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase("498 — la deuda de una satelite (Postgres real)", () => {
  let mundo: Mundo;
  let base: Awaited<ReturnType<typeof deudaConSinConsolidarYSinpe>>;

  /** T1.4 — un cierre consolidado con SINPE y otro aprobado SIN consolidar. */
  function deudaConSinConsolidarYSinpe() {
    return conEscenario(mundo, async (e) => {
      await tarifaDeLaTienda(e);
      const a = await cierreSateliteAprobado(e, [{ monto: 6000 }, { monto: 4000, metodo: "SINPE" }]);
      await consolidar(e);
      const b = await cierreSateliteAprobado(e, [{ monto: 3000 }], e.actorMensajero2);

      const cierres = await e.tx.cierreDia.findMany({ where: { id: { in: [a, b] } }, select: SNAPSHOT_SELECT });
      const aportes = cierres.reduce((s, c) => s.plus(aporteAMano(c)), new Prisma.Decimal(0));
      const recibido = new Prisma.Decimal(0); // nada marcado
      const formula = aportes.minus(recibido);
      const aporteB = aporteAMano(
        await e.tx.cierreDia.findUniqueOrThrow({ where: { id: b }, select: SNAPSHOT_SELECT }),
      );

      const repo = new SaldosSatelitesRepository(e.cliente as unknown as PrismaClient);
      const filas = await repo.findSaldosCompleto();
      const fila = filas.find((f) => f.zonaId === e.zonaSateliteId) ?? null;
      return { formula: formula.toFixed(2), aporteB: aporteB.toFixed(2), fila };
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    base = await deudaConSinConsolidarYSinpe();
  }, 300_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  it("anti-vacuidad: la zona aparece en Saldos y la formula a mano es positiva", () => {
    expect(base.fila).not.toBeNull();
    expect(new Prisma.Decimal(base.formula).greaterThan(0)).toBe(true);
  });

  it("⭑ T1.4 / R23: la deuda de Saldos es la formula de R23 hecha a mano (todos los metodos, con los sin consolidar)", () => {
    expect(base.fila?.saldoSinConciliar).toBe(base.formula);
  });
});
