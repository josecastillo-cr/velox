import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import { CierresBodegaAdminRepository } from "@/lib/repositories/CierresBodegaAdminRepository";
import { SaldosSatelitesRepository } from "@/lib/repositories/SaldosSatelitesRepository";
import {
  consolidacionesConDinero,
  type ClienteConDinero,
} from "@/lib/repositories/consolidaciones-con-dinero";
import { HAY_BASE_DE_DATOS } from "./_postgres-real";
import { conEscenario, prepararMundo, type Escenario, type Mundo } from "./454/_escenario";
import { consolidacionConDosCierres, filasDeDiferencia } from "./498/_satelite";
import { sembrarConsolidacion } from "./498/_migraciones";

/**
 * FICHA 500 (T1.2; R1, R2, R3, R4, R9) — «DESMARCAR» SOLO CUANDO SE PUEDE, contra Postgres real y por
 * los repositorios reales.
 *
 * Cinco consolidaciones de la MISMA zona satelite:
 *   A · dos cierres asentados al marcar (dinero en los tres libros con origen `cierre_dia`);
 *   B · SIN cierres, marcada con 90 sobre 100 → SOLO una fila de ajuste + el egreso de 10 (R9: el
 *       defecto de H5 bloque 3; ninguna fila de los libros con origen en sus cierres);
 *   C · conciliada sin nada (general 0, recibido 0): la unica que se puede desmarcar;
 *   D · saldada con la regla anterior, sin asientos;
 *   E · pendiente (sin marcar).
 *
 * Todo corre en una transaccion que SIEMPRE se revierte (con `serializarEscriturasReales` primero,
 * dentro de `conEscenario`). Sin base, la suite se SALTA (visible).
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const adminDe = (e: Escenario) => new CierresBodegaAdminRepository(e.cliente as unknown as PrismaClient);
const saldosDe = (e: Escenario) => new SaldosSatelitesRepository(e.cliente as unknown as PrismaClient);

/**
 * Todo lo que un revertir rechazado NO debe cambiar, ACOTADO a las consolidaciones medidas (revision
 * B1): su fila de `cierre_bodega`, sus filas de ajuste, los movimientos de los tres libros con origen
 * en sus cierres o en sus ajustes, y el historial con `entidad_id` en ellas. Huella por tramo (conteo +
 * md5 del texto de cada fila). No mira tablas enteras: la base es compartida y otro test puede
 * commitear filas ajenas en medio.
 */
async function fotoDeTodo(e: Escenario, ids: string[]): Promise<string> {
  const tramos: [string, string][] = [
    ["cierre_bodega", `SELECT t::text AS f FROM cierre_bodega t WHERE t.id = ANY($1::text[])`],
    ["ajustes", `SELECT t::text AS f FROM conciliacion_bodega_ajuste t WHERE t.cierre_bodega_id = ANY($1::text[])`],
    ...(["wallet_movimiento", "wallet_tienda_movimiento", "pago_mensajero_movimiento"] as const).map(
      (libro): [string, string] => [
        libro,
        `SELECT t::text AS f FROM ${libro} t
          WHERE t.origen_id IN (SELECT c.id FROM cierre_dia c WHERE c.cierre_bodega_id = ANY($1::text[]))
             OR t.origen_id IN (SELECT a.id FROM conciliacion_bodega_ajuste a WHERE a.cierre_bodega_id = ANY($1::text[]))`,
      ],
    ),
    ["historial", `SELECT t::text AS f FROM historial_accion t WHERE t.entidad_id = ANY($1::text[])`],
  ];
  const partes: string[] = [];
  for (const [nombre, sql] of tramos) {
    const [fila] = await e.tx.$queryRawUnsafe<{ n: bigint; h: string | null }[]>(
      `SELECT count(*) AS n, md5(string_agg(f, '|' ORDER BY f)) AS h FROM (${sql}) s`,
      ids,
    );
    partes.push(`${nombre}=${Number(fila.n)}:${fila.h ?? "vacia"}`);
  }
  return partes.join(";");
}

/** Revierte `id` dentro de un SAVEPOINT que se deshace siempre: cada revertir ve la MISMA base. */
async function revertirYDeshacer(e: Escenario, id: string): Promise<string> {
  const punto = `sp_${randomUUID().replace(/-/g, "")}`;
  await e.tx.$executeRawUnsafe(`SAVEPOINT ${punto}`);
  try {
    return await adminDe(e).revertirConciliacion({ id, actorUsuarioId: e.maestroId });
  } finally {
    await e.tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${punto}`);
  }
}

describeSiHayBase("500 — consolidacionesConDinero y «Desmarcar» (Postgres real)", () => {
  let mundo: Mundo;
  let r: Awaited<ReturnType<typeof escenario>>;

  function escenario() {
    return conEscenario(mundo, async (e) => {
      // A — dos cierres consolidados y marcados por el aporte exacto: los libros con origen en ellos.
      const { cbId: A, aporte } = await consolidacionConDosCierres(e);
      const marcaA = await adminDe(e).marcarConciliado({
        id: A,
        montoRecibido: aporte.toFixed(2),
        nota: null,
        actorUsuarioId: e.maestroId,
      });
      // B — sin cierres; marcada con 90 sobre 100 POR EL REPOSITORIO REAL → fila de ajuste + egreso.
      const B = await sembrarConsolidacion(e.tx, { zonaId: e.zonaSateliteId, usuarioId: e.maestroId, general: "100" });
      const marcaB = await adminDe(e).marcarConciliado({
        id: B,
        montoRecibido: "90.00",
        nota: null,
        actorUsuarioId: e.maestroId,
      });
      // C — conciliada sin nada.
      const C = await sembrarConsolidacion(e.tx, { zonaId: e.zonaSateliteId, usuarioId: e.maestroId, general: "0" });
      const marcaC = await adminDe(e).marcarConciliado({
        id: C,
        montoRecibido: "0.00",
        nota: null,
        actorUsuarioId: e.maestroId,
      });
      // D — saldada con la regla anterior (lo que hace M4 de la 498), sin asientos.
      const D = await sembrarConsolidacion(e.tx, {
        zonaId: e.zonaSateliteId,
        usuarioId: e.maestroId,
        general: "300",
        recibido: "300",
      });
      await e.tx.$executeRawUnsafe(`UPDATE cierre_bodega SET esperado_regla_anterior = monto_recibido WHERE id = $1`, D);
      // E — pendiente.
      const E = await sembrarConsolidacion(e.tx, { zonaId: e.zonaSateliteId, usuarioId: e.maestroId, general: "50" });

      const ids = { A, B, C, D, E };

      // Anti-vacuidad de los datos: lo que cada consolidacion dice ser, medido en la base.
      const cierresDe = async (id: string) =>
        (await e.tx.cierreDia.findMany({ where: { cierreBodegaId: id }, select: { id: true } })).map((c) => c.id);
      const librosDeCierres = async (id: string) => {
        const cierres = await cierresDe(id);
        const w = { origenTipo: "cierre_dia" as const, origenId: { in: cierres } };
        return (
          (await e.tx.walletMovimiento.count({ where: w })) +
          (await e.tx.walletTiendaMovimiento.count({ where: w })) +
          (await e.tx.pagoMensajeroMovimiento.count({ where: w }))
        );
      };
      const ajustesDe = (id: string) => e.tx.conciliacionBodegaAjuste.count({ where: { cierreBodegaId: id } });
      const datos = {
        A: { libros: await librosDeCierres(A), ajustes: await ajustesDe(A) },
        B: { cierres: (await cierresDe(B)).length, libros: await librosDeCierres(B), ajustes: await ajustesDe(B) },
        C: { cierres: (await cierresDe(C)).length, ajustes: await ajustesDe(C) },
        diferenciaB: await filasDeDiferencia(e, B),
      };

      // R1 — la funcion compartida.
      const conDinero = await consolidacionesConDinero(e.tx, [A, B, C, D, E]);
      // R1 — con `[]` no consulta: un cliente cuyos delegados revientan si se tocan.
      const explota = new Proxy(
        {},
        {
          get() {
            throw new Error("consolidacionesConDinero consulto con ids vacios");
          },
        },
      ) as unknown as ClienteConDinero;
      const vacio = await consolidacionesConDinero(explota, []);

      // R3 — lo que llega a las dos pantallas.
      const pagina = await saldosDe(e).findConsolidacionesPaginado(e.zonaSateliteId, { skip: 0, take: 50 });
      const completo = await saldosDe(e).findConsolidacionesCompleto(e.zonaSateliteId);
      const satelites = Object.fromEntries(pagina.items.map((c) => [c.cierreBodegaId, c.puedeDesmarcar]));
      const satelitesCompleto = Object.fromEntries(completo.map((c) => [c.cierreBodegaId, c.puedeDesmarcar]));
      const cierresAdmin: Record<string, boolean> = {};
      for (const [, id] of Object.entries(ids)) {
        const d = await adminDe(e).findCierreBodegaConDetalle(id);
        if (d === null) throw new Error(`detalle nulo de ${id}`);
        cierresAdmin[id] = d.puedeDesmarcar;
      }

      // R4 — para cada conciliada, lo ofrecido contra lo que el servidor hace en ESE estado.
      const revertirEnSavepoint: Record<string, string> = {};
      for (const id of [A, B, C, D]) revertirEnSavepoint[id] = await revertirYDeshacer(e, id);

      // R2 / R9 — revertir A y B de verdad: con_asientos y NADA cambia.
      const antesA = await fotoDeTodo(e, [A]);
      const revA = await adminDe(e).revertirConciliacion({ id: A, actorUsuarioId: e.maestroId });
      const despuesA = await fotoDeTodo(e, [A]);
      const antesB = await fotoDeTodo(e, [B]);
      const revB = await adminDe(e).revertirConciliacion({ id: B, actorUsuarioId: e.maestroId });
      const despuesB = await fotoDeTodo(e, [B]);

      return {
        ids,
        marcas: [marcaA, marcaB, marcaC],
        datos,
        conDinero: [...conDinero].sort(),
        vacio,
        satelites,
        satelitesCompleto,
        cierresAdmin,
        revertirEnSavepoint,
        revA,
        revB,
        A: { antes: antesA, despues: despuesA },
        B: { antes: antesB, despues: despuesB },
      };
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    r = await escenario();
  }, 600_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  it("anti-vacuidad: las tres marcas se aplicaron y cada consolidacion es lo que dice ser", () => {
    expect(r.marcas).toEqual(["updated", "updated", "updated"]);
    expect(r.datos.A.libros).toBeGreaterThan(0); // A: dinero de cierres
    expect(r.datos.A.ajustes).toBe(0); // A: aporte exacto, sin diferencia
    expect(r.datos.B).toMatchObject({ cierres: 0, libros: 0, ajustes: 1 }); // B: SOLO ajuste (R9)
    expect(r.datos.C).toEqual({ cierres: 0, ajustes: 0 }); // C: nada
    // La fila de ajuste de B y su egreso de caja, escritos a mano.
    expect(r.datos.diferenciaB).toEqual([
      expect.objectContaining({
        tipo: "egreso",
        categoria: "egreso_diferencia_satelite",
        monto: "10.00",
        diferencia: "10.00",
        monto_esperado: "100.00",
        monto_recibido: "90.00",
      }),
    ]);
  });

  it("R1: de {A, B, C, D, E} estan con dinero exactamente {A, B}", () => {
    expect(r.conDinero).toEqual([r.ids.A, r.ids.B].sort());
  });

  it("R1: con ids vacios no consulta y devuelve el conjunto vacio", () => {
    expect(r.vacio.size).toBe(0);
  });

  it("anti-vacuidad (revision B1): la foto acotada ve la fila, el dinero y el historial de A y de B", () => {
    expect(r.A.antes).toMatch(/cierre_bodega=1:/);
    expect(r.A.antes).not.toMatch(/wallet_movimiento=0:/); // A: caja con origen en sus cierres
    expect(r.A.antes).not.toMatch(/historial=0:/);
    expect(r.B.antes).toMatch(/cierre_bodega=1:/);
    expect(r.B.antes).toMatch(/ajustes=1:/);
    expect(r.B.antes).toMatch(/wallet_movimiento=1:/); // B: el egreso de la diferencia
    expect(r.B.antes).not.toMatch(/historial=0:/);
  });

  it("R2: revertir A (asientos de cierres) responde con_asientos y no cambia nada", () => {
    // La foto PRIMERO (revision B1): si el corte faltara, la mutacion la tiene que ver cambiar.
    expect(r.A.despues).toBe(r.A.antes);
    expect(r.revA).toBe("con_asientos");
  });

  it("R9: revertir B (SOLO una fila de ajuste) responde con_asientos y no cambia consolidacion, ajuste, egreso ni historial", () => {
    // La foto PRIMERO (revision B1): si el corte faltara, la mutacion la tiene que ver cambiar.
    expect(r.B.despues).toBe(r.B.antes);
    expect(r.revB).toBe("con_asientos");
  });

  it("R3: /wallet/satelites (pagina y completo) ofrece «Desmarcar» solo en C", () => {
    const esperado = { [r.ids.A]: false, [r.ids.B]: false, [r.ids.C]: true, [r.ids.D]: false, [r.ids.E]: false };
    expect(r.satelites).toEqual(esperado);
    expect(r.satelitesCompleto).toEqual(esperado);
  });

  it("R3: el detalle de /cierres-admin ofrece «Desmarcar» solo en C", () => {
    expect(r.cierresAdmin).toEqual({
      [r.ids.A]: false,
      [r.ids.B]: false,
      [r.ids.C]: true,
      [r.ids.D]: false,
      [r.ids.E]: false,
    });
  });

  it("R4: en cada conciliada, ofrecer «Desmarcar» ⇔ revertir tiene exito en ese mismo estado", () => {
    for (const id of [r.ids.A, r.ids.B, r.ids.C, r.ids.D]) {
      const res = r.revertirEnSavepoint[id];
      expect(r.satelites[id]).toBe(res === "updated");
      expect(r.cierresAdmin[id]).toBe(res === "updated");
      if (res !== "updated") expect(["con_asientos", "saldada_regla_anterior"]).toContain(res);
    }
    // Literal: los cuatro desenlaces, escritos a mano.
    expect([r.ids.A, r.ids.B, r.ids.C, r.ids.D].map((id) => r.revertirEnSavepoint[id])).toEqual([
      "con_asientos",
      "con_asientos",
      "updated",
      "saldada_regla_anterior",
    ]);
  });
});
