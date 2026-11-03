import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OrdenRepository } from "@/lib/repositories/OrdenRepository";
import { RecepcionBodegaCentralService } from "@/lib/services/RecepcionBodegaCentralService";
import type { FilaTableroDia } from "@/lib/types/tablero-dia";

import {
  FECHA_CR,
  VENTANA,
  crearOrden,
  instanteCR,
  repositorio,
  sembrarBase,
  sumaDeLosOcho,
  transicionDeRecoleccion,
  type BaseSembrada,
  type TxDeTest,
} from "./_semilla-tablero-dia";
import {
  HAY_BASE_DE_DATOS,
  clienteConTransaccionAnidada,
  crearPrismaDeTest,
  enTransaccionRevertida,
} from "./db/_postgres-real";

// FICHA 496 / T2 — R8, R9: Monitoreo (conteo del tablero por mensajero) tras la recepción central
// de una recolección. Sin código propio: el `WHERE mensajero_asignado_id IS NOT NULL` de `asignadas`
// ya saca la orden de todas las filas en cuanto la recepción libera al mensajero. Archivo aparte
// para no editar el de la 192/259. Identidad de ocho sumandos (R25 de la 192) en cada caso.
//
// Correr: `pnpm exec vitest run tests/integration/tablero-dia-recoleccion-496.test.ts`.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

let guia = 1_600_000_000 + Math.floor(Math.random() * 100_000_000);

/** Orden de recolección asignada HOY a `mensajero1`, recolectada por él y en ruta a la central. */
async function recoleccionEnRuta(tx: TxDeTest, base: BaseSembrada, clave: string): Promise<{ id: string; numGuia: number }> {
  const id = await crearOrden(tx, base, {
    clave,
    estatus: "en_ruta_bodega_central",
    mensajeroId: base.mensajero1,
    asignadoAt: null, // la 157 no lo estampa: entra por el historial
  });
  const numGuia = (guia += 1);
  await tx.orden.update({ where: { id }, data: { numGuia } });
  await transicionDeRecoleccion(tx, base, id, instanteCR(FECHA_CR, "08:00"));
  await tx.ordenHistorialEstado.create({
    data: {
      ordenId: id,
      estatusOrigenId: base.estatus.get("recolectando") as string,
      estatusDestinoId: base.estatus.get("en_ruta_bodega_central") as string,
      actorUsuarioId: base.mensajero1,
      origenTipo: "recoleccion_tienda",
      createdAt: instanteCR(FECHA_CR, "09:00"),
    },
  });
  return { id, numGuia };
}

describeSiHayBase("496 — Monitoreo tras la recepción central de una recolección (Postgres real)", () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function conteo(
    sembrar: (tx: TxDeTest, base: BaseSembrada) => Promise<void>,
  ): Promise<{ filas: readonly FilaTableroDia[]; m1: string }> {
    return enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      await sembrar(tx, base);
      const filas = await repositorio(tx).contarPorMensajero(VENTANA, { tipo: "global" });
      return { filas: filas.filter((f) => f.mensajeroNombre.endsWith("Prueba")), m1: base.mensajero1 };
    });
  }

  function identidad(filas: readonly FilaTableroDia[]): void {
    for (const f of filas) expect(f.asignadas).toBe(sumaDeLosOcho(f));
  }

  it("⭑ R8: recibida en central no cuenta en ninguna fila", async () => {
    const { filas } = await conteo(async (tx, base) => {
      const o = await recoleccionEnRuta(tx, base, "r8-recibida");
      const servicio = new RecepcionBodegaCentralService(new OrdenRepository(clienteConTransaccionAnidada(tx)));
      const r = await servicio.recibirEnBodegaCentral(o.numGuia, { usuarioId: base.maestro, rol: "maestro" });
      if (r.status !== "ok") throw new Error(`496/R8: la recepción no transicionó (${r.status})`);
    });
    expect(filas).toEqual([]);
    identidad(filas);
  });

  it("⭑ R9: aún en ruta a la central sigue contando en la fila de su mensajero (otros)", async () => {
    const { filas, m1 } = await conteo(async (tx, base) => {
      await recoleccionEnRuta(tx, base, "r9-en-ruta");
    });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ mensajeroId: m1, asignadas: 1, otros: 1 });
    identidad(filas);
  });
});
