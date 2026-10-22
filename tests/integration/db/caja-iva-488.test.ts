import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import { verResumenCajaAction } from "@/lib/actions/wallet";
import type { Actor } from "@/lib/interfaces/services/IOrdenService";
import type { CajaResumenDTO } from "@/lib/types/wallet";

import { HAY_BASE_DE_DATOS, crearPrismaDeTest, type TxDeTest } from "./_postgres-real";
import {
  cargarCatalogo459,
  enTransaccionRevertida459,
  menos,
  montarServicios459,
  sembrarEscenario459,
  type Servicios459,
} from "./_fixtures/caja-459";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// FICHA 488 — LA GANANCIA DE LA CAJA, SIN IVA (Postgres real, por las Server Actions reales).
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// El escenario de la fase 0 de la 459 (servicios reales: cierre con los tres IVA, cobro por
// devolucion a origen, pagos a tienda, egresos, ajustes, gasto fijo y premio) MAS un aporte de
// capital, y la anulacion del cobro por devolucion a origen (que deja el reverso del IVA de la
// 458-B). La base local es compartida: todo se mide POR DIFERENCIA dentro de UNA transaccion
// REPEATABLE READ que se revierte, igual que la fotografia de la 459.
//
// B.0 — CARACTERIZACION PREVIA (R8). Se escribio y se puso en verde sobre `dev` (4f87ca86) SIN
// tocar codigo. Sus literales son lo que la ficha 488 promete NO mover: la cifra principal,
// «Entro», «Salio», «De las tiendas» y el capital. No se tocan en el resto de la ficha.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const APORTE = "20000.00";

type Resumen = CajaResumenDTO;

interface Medida {
  antes: Resumen;
  base: Resumen;
}

async function resumen(s: Servicios459, actor: Actor, filtros: Record<string, unknown> = {}): Promise<Resumen> {
  const r = await verResumenCajaAction({ page: 1, pageSize: 10, ...filtros }, { getActor: async () => actor, service: s.wallet });
  if (r.status !== "ok") throw new Error(`verResumenCajaAction respondio ${JSON.stringify(r)}`);
  return r.resumen;
}

describeSiHayBase("⭑ 488 — la ganancia de la caja sin IVA (Postgres real)", () => {
  let prisma: PrismaClient;
  let medida: Medida | undefined;
  let fallo: unknown;

  /** La medida, o el error de la siembra: cada caso cae en ROJO con su nombre (nunca «skipped»). */
  function m(): Medida {
    if (fallo !== undefined) throw fallo;
    if (medida === undefined) throw new Error("la medida no llego a tomarse");
    return medida;
  }

  beforeAll(async () => {
    prisma = crearPrismaDeTest();
    const cat = await cargarCatalogo459(prisma);
    try {
      medida = await enTransaccionRevertida459(prisma, async (tx) => medir(tx, cat));
    } catch (error) {
      fallo = error;
    }
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function medir(tx: TxDeTest, cat: Awaited<ReturnType<typeof cargarCatalogo459>>): Promise<Medida> {
    const s = montarServicios459(tx);
    const lector: Actor = { usuarioId: "00000000-0000-4000-8000-000000000488", rol: "maestro" };
    const antes = await resumen(s, lector);

    const esc = await sembrarEscenario459(tx, cat);
    const actor = esc.maestro;
    const aporte = await s.aporteCapital.registrar(
      { claveIdempotencia: randomUUID(), clase: "aporte", monto: APORTE, fecha: "2026-09-01", motivo: "Aporte 488" },
      null,
      actor,
    );
    if (aporte.status !== "ok") throw new Error(`aporte: ${JSON.stringify(aporte)}`);
    const cobro = await tx.rechazoTiendaCobro.findFirstOrThrow({
      where: { tiendaId: esc.tiendaA, estado: "aprobado" },
      select: { id: true },
    });
    const anulado = await s.rechazoCobro.anular({ cobroId: cobro.id, motivo: "Fotografia 488" }, actor, new Date());
    if (anulado.status !== "ok") throw new Error(`anular rechazo: ${JSON.stringify(anulado)}`);
    const base = await resumen(s, actor);

    return { antes, base };
  }

  const d = (a: Resumen, b: Resumen, campo: keyof Resumen) => menos(b[campo] as string, a[campo] as string);

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // B.0 / R8 — lo que NO se mueve. Literales A MANO desde la fotografia de la 459 (+ 458-B):
  //   Entro  = 87 517,25 + aporte 20 000,00                     = 107 517,25
  //   Salio  = 161 845,77 (la anulacion del rechazo no saca dinero)
  //   cifra  = 107 517,25 − 161 845,77                          = −54 328,52
  //   De las tiendas = 14 175,82 (459 tras anular el rechazo: 13 045,82 + 1 130,00)
  //   capital = 20 000,00
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("B.0/R8: cifra principal, «Entro», «Salio», «De las tiendas» y capital (literales de antes de la 488)", () => {
    const { antes, base } = m();
    expect({
      entradas: d(antes, base, "entradas"),
      salidas: d(antes, base, "salidas"),
      enCaja: d(antes, base, "enCaja"),
      deTerceros: d(antes, base, "deTerceros"),
      capital: d(antes, base, "capital"),
    }).toEqual({
      entradas: "107517.25",
      salidas: "161845.77",
      enCaja: "-54328.52",
      deTerceros: "14175.82",
      capital: APORTE,
    });
  });
});
