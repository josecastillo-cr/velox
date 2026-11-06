import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { estadoConciliacionDe } from "@/app/(app)/cierres-admin/_components/cierre-labels";
import { CierresBodegaAdminRepository } from "@/lib/repositories/CierresBodegaAdminRepository";
import { SaldosSatelitesRepository } from "@/lib/repositories/SaldosSatelitesRepository";
import { HAY_BASE_DE_DATOS } from "./_postgres-real";
import { conEscenario, prepararMundo, type Escenario, type Mundo } from "./454/_escenario";
import { consolidacionConDosCierres, filasDeDiferencia, filasDeLosLibros } from "./498/_satelite";
import { sembrarConsolidacion } from "./498/_migraciones";

/**
 * FICHA 502 (T3; R11, R12) — «CORREGIR» SOBRE UNA CONSOLIDACION RECIBIDA DE MAS, contra Postgres real y
 * por los repositorios reales. La salida A de Q1 se decidio sobre la tabla de `design.md` §3.1, calculada
 * leyendo el codigo: este archivo la MIDE.
 *
 * Todos los esperados van con literales a mano (memoria «Asercion contra su propia fuente»). La falta se
 * lee con `findConsolidacionesPaginado`, el lector real de la pantalla.
 *
 * Una transaccion que SIEMPRE se revierte. Sin base, la suite se SALTA (visible).
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const INGRESO = ["ingreso", "ingreso_diferencia_satelite"] as const;
const EGRESO = ["egreso", "egreso_diferencia_satelite"] as const;

interface FilaDeLaTabla {
  nombre: string;
  general: string;
  pago?: string;
  marcadaPor: string;
  /** [evento, tipo, categoria, monto, diferencia, monto_esperado, monto_recibido] */
  ajusteDeLaMarca: readonly string[];
  corregirA: string;
  resultado: "updated" | "recibido_cero_con_aporte";
  ajusteNuevo: readonly string[] | null;
  recibidoQueda: string;
  faltaQueda: string;
  estadoQueda: "recibido" | "incompleto";
}

/** `design.md` §3.1, fila a fila y en su orden. */
const TABLA: readonly FilaDeLaTabla[] = [
  {
    nombre: "debe 0, marcada por 90, corregir a 0",
    general: "0",
    marcadaPor: "90.00",
    ajusteDeLaMarca: ["marca", ...INGRESO, "90.00", "-90.00", "0.00", "90.00"],
    corregirA: "0.00",
    resultado: "updated",
    ajusteNuevo: ["correccion", ...EGRESO, "90.00", "90.00", "0.00", "0.00"],
    recibidoQueda: "0.00",
    faltaQueda: "0.00",
    estadoQueda: "recibido",
  },
  {
    nombre: "debe 800, marcada por 1000, corregir a 800",
    general: "800",
    marcadaPor: "1000.00",
    ajusteDeLaMarca: ["marca", ...INGRESO, "200.00", "-200.00", "800.00", "1000.00"],
    corregirA: "800.00",
    resultado: "updated",
    ajusteNuevo: ["correccion", ...EGRESO, "200.00", "200.00", "800.00", "800.00"],
    recibidoQueda: "800.00",
    faltaQueda: "0.00",
    estadoQueda: "recibido",
  },
  {
    nombre: "debe 800, marcada por 1000, corregir a 700",
    general: "800",
    marcadaPor: "1000.00",
    ajusteDeLaMarca: ["marca", ...INGRESO, "200.00", "-200.00", "800.00", "1000.00"],
    corregirA: "700.00",
    resultado: "updated",
    ajusteNuevo: ["correccion", ...EGRESO, "300.00", "300.00", "800.00", "700.00"],
    recibidoQueda: "700.00",
    faltaQueda: "100.00",
    estadoQueda: "incompleto",
  },
  {
    nombre: "debe 800, marcada por 1000, corregir a 900",
    general: "800",
    marcadaPor: "1000.00",
    ajusteDeLaMarca: ["marca", ...INGRESO, "200.00", "-200.00", "800.00", "1000.00"],
    corregirA: "900.00",
    resultado: "updated",
    ajusteNuevo: ["correccion", ...EGRESO, "100.00", "100.00", "800.00", "900.00"],
    recibidoQueda: "900.00",
    faltaQueda: "-100.00",
    estadoQueda: "recibido",
  },
  {
    nombre: "debe 800, marcada por 1000, corregir a 1100",
    general: "800",
    marcadaPor: "1000.00",
    ajusteDeLaMarca: ["marca", ...INGRESO, "200.00", "-200.00", "800.00", "1000.00"],
    corregirA: "1100.00",
    resultado: "updated",
    ajusteNuevo: ["correccion", ...INGRESO, "100.00", "-100.00", "800.00", "1100.00"],
    recibidoQueda: "1100.00",
    faltaQueda: "-300.00",
    estadoQueda: "recibido",
  },
  {
    nombre: "debe 800, marcada por 1000, corregir a 0: rechazada",
    general: "800",
    marcadaPor: "1000.00",
    ajusteDeLaMarca: ["marca", ...INGRESO, "200.00", "-200.00", "800.00", "1000.00"],
    corregirA: "0.00",
    resultado: "recibido_cero_con_aporte",
    ajusteNuevo: null,
    recibidoQueda: "1000.00",
    faltaQueda: "-200.00",
    estadoQueda: "recibido",
  },
  {
    nombre: "debe -100, marcada por 0, corregir a 30",
    general: "100",
    pago: "200",
    marcadaPor: "0.00",
    ajusteDeLaMarca: ["marca", ...INGRESO, "100.00", "-100.00", "-100.00", "0.00"],
    corregirA: "30.00",
    resultado: "updated",
    ajusteNuevo: ["correccion", ...INGRESO, "30.00", "-30.00", "-100.00", "30.00"],
    recibidoQueda: "30.00",
    faltaQueda: "-130.00",
    estadoQueda: "recibido",
  },
];

const repoDe = (e: Escenario) => new CierresBodegaAdminRepository(e.cliente as unknown as PrismaClient);

const marcar = (e: Escenario, id: string, montoRecibido: string) =>
  repoDe(e).marcarConciliado({ id, montoRecibido, nota: null, actorUsuarioId: e.maestroId });

const corregir = (e: Escenario, id: string, montoRecibido: string) =>
  repoDe(e).corregirConciliacion({ id, montoRecibido, nota: null, actorUsuarioId: e.maestroId });

/** Lo que la pantalla lee de esa consolidacion, por el lector real. */
async function deLaPantalla(e: Escenario, id: string) {
  const pagina = await new SaldosSatelitesRepository(e.cliente as unknown as PrismaClient).findConsolidacionesPaginado(
    e.zonaSateliteId,
    { skip: 0, take: 50 },
  );
  const c = pagina.items.find((i) => i.cierreBodegaId === id);
  if (c === undefined) throw new Error(`la pantalla no trae la consolidacion ${id}`);
  return {
    montoRecibido: c.montoRecibido,
    faltaPorRecibir: c.faltaPorRecibir,
    estado: estadoConciliacionDe({ conciliado: c.conciliado, faltaPorRecibir: c.faltaPorRecibir }),
  };
}

/** Las filas de ajuste de la MARCA y su movimiento de caja, byte a byte. */
function filasDeLaMarca(e: Escenario, id: string) {
  return e.tx.$queryRawUnsafe(
    `SELECT to_jsonb(w)::text AS f FROM wallet_movimiento w
      WHERE w.origen_id IN (SELECT id FROM conciliacion_bodega_ajuste WHERE cierre_bodega_id = $1 AND evento = 'marca')
      UNION ALL SELECT to_jsonb(a)::text FROM conciliacion_bodega_ajuste a WHERE a.cierre_bodega_id = $1 AND a.evento = 'marca'
      ORDER BY 1`,
    id,
  ) as Promise<Array<{ f: string }>>;
}

/** La fila entera de la consolidacion, para afirmar que un rechazo no cambia nada. */
function filaDeLaConsolidacion(e: Escenario, id: string) {
  return e.tx.$queryRawUnsafe(`SELECT to_jsonb(c)::text AS f FROM cierre_bodega c WHERE c.id = $1`, id) as Promise<
    Array<{ f: string }>
  >;
}

/** Las filas de historial de la conciliacion: [valor_anterior, valor_nuevo, monto]. */
async function historialDe(e: Escenario, id: string) {
  const filas = await e.tx.historialAccion.findMany({
    where: { entidadId: id, accion: "cierre_bodega_conciliado" },
    select: { valorAnterior: true, valorNuevo: true, monto: true },
  });
  return filas.map((f) => [f.valorAnterior, f.valorNuevo, f.monto?.toFixed(2) ?? null]);
}

const comoTupla = (d: Awaited<ReturnType<typeof filasDeDiferencia>>[number]) => [
  d.evento,
  d.tipo,
  d.categoria,
  d.monto,
  d.diferencia,
  d.monto_esperado,
  d.monto_recibido,
];

describeSiHayBase("502 — «Corregir» sobre una recibida de mas (Postgres real)", () => {
  let mundo: Mundo;
  let tabla: Awaited<ReturnType<typeof medirLaTabla>>;
  let reales: Awaited<ReturnType<typeof conCierresReales>>;

  function medirLaTabla() {
    return conEscenario(mundo, async (e) => {
      const salida = [];
      for (const fila of TABLA) {
        const id = await sembrarConsolidacion(e.tx, {
          zonaId: e.zonaSateliteId,
          usuarioId: e.maestroId,
          general: fila.general,
          pago: fila.pago ?? "0",
        });
        const marca = await marcar(e, id, fila.marcadaPor);
        const trasMarcar = {
          pantalla: await deLaPantalla(e, id),
          marca: await filasDeLaMarca(e, id),
          diferencia: (await filasDeDiferencia(e, id)).map(comoTupla),
          consolidacion: await filaDeLaConsolidacion(e, id),
          historial: await historialDe(e, id),
        };
        const resultado = await corregir(e, id, fila.corregirA);
        salida.push({
          fila,
          marca,
          trasMarcar,
          resultado,
          pantalla: await deLaPantalla(e, id),
          marcaDespues: await filasDeLaMarca(e, id),
          diferencia: (await filasDeDiferencia(e, id)).map(comoTupla),
          consolidacion: await filaDeLaConsolidacion(e, id),
          historial: await historialDe(e, id),
        });
      }
      return salida;
    });
  }

  /** R11 con cierres de verdad: los libros tienen filas y corregir no las toca ni añade. */
  function conCierresReales() {
    return conEscenario(mundo, async (e) => {
      const { c1, c2, cbId, aporte } = await consolidacionConDosCierres(e);
      const marca = await marcar(e, cbId, aporte.plus(200).toFixed(2));
      const librosAntes = await filasDeLosLibros(e, [c1, c2]);
      const marcaAntes = await filasDeLaMarca(e, cbId);
      const pantallaAntes = await deLaPantalla(e, cbId);
      const resultado = await corregir(e, cbId, aporte.toFixed(2));
      return {
        aporte,
        marca,
        resultado,
        librosAntes,
        librosDespues: await filasDeLosLibros(e, [c1, c2]),
        marcaAntes,
        marcaDespues: await filasDeLaMarca(e, cbId),
        pantallaAntes,
        pantalla: await deLaPantalla(e, cbId),
        diferencia: (await filasDeDiferencia(e, cbId)).map((d) => [d.evento, d.tipo, d.monto, d.diferencia]),
        historial: (await historialDe(e, cbId)).filter(([anterior]) => anterior !== null).length,
      };
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    tabla = await medirLaTabla();
    reales = await conCierresReales();
  }, 600_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  describe("la tabla de design.md §3.1 (R11, R12)", () => {
    it("anti-vacuidad: se midieron las siete filas, y cada una partia de una recibida de mas", () => {
      expect(tabla).toHaveLength(7);
      for (const m of tabla) {
        expect(m.marca, m.fila.nombre).toBe("updated");
        expect(m.trasMarcar.pantalla.montoRecibido, m.fila.nombre).toBe(m.fila.marcadaPor);
        expect(m.trasMarcar.pantalla.faltaPorRecibir, m.fila.nombre).toMatch(/^-[1-9]/);
        expect(m.trasMarcar.pantalla.estado, m.fila.nombre).toBe("recibido");
        expect(m.trasMarcar.diferencia, m.fila.nombre).toEqual([m.fila.ajusteDeLaMarca]);
        expect(m.trasMarcar.marca, m.fila.nombre).toHaveLength(2);
      }
    });

    it.each(TABLA.map((f, i) => [f.nombre, i] as const))("%s", (_nombre, i) => {
      const m = tabla[i];
      expect(m.resultado).toBe(m.fila.resultado);
      expect(m.diferencia).toEqual(
        m.fila.ajusteNuevo === null ? [m.fila.ajusteDeLaMarca] : [m.fila.ajusteDeLaMarca, m.fila.ajusteNuevo],
      );
      expect(m.pantalla).toEqual({
        montoRecibido: m.fila.recibidoQueda,
        faltaPorRecibir: m.fila.faltaQueda,
        estado: m.fila.estadoQueda,
      });
    });

    it("R11: la fila de la marca y su movimiento quedan byte a byte iguales en las siete", () => {
      for (const m of tabla) expect(m.marcaDespues, m.fila.nombre).toEqual(m.trasMarcar.marca);
    });

    it("R11: cada correccion deja una fila de historial con el monto anterior y el nuevo", () => {
      const corregidas = tabla.filter((m) => m.resultado === "updated");
      expect(corregidas).toHaveLength(6);
      for (const m of corregidas) {
        const conPar = m.historial.filter(([anterior]) => anterior !== null);
        expect(m.historial.length, m.fila.nombre).toBe(m.trasMarcar.historial.length + 1);
        expect(conPar, m.fila.nombre).toEqual([[m.fila.marcadaPor, m.fila.corregirA, m.fila.corregirA]]);
      }
    });

    it("⭑ R12: corregir a 0 lo que debe un positivo se rechaza sin cambiar nada", () => {
      const m = tabla[5];
      expect(m.resultado).toBe("recibido_cero_con_aporte");
      expect(m.fila.general).toBe("800");
      expect(m.consolidacion).toEqual(m.trasMarcar.consolidacion);
      expect(m.consolidacion).toHaveLength(1);
      expect(m.diferencia).toEqual(m.trasMarcar.diferencia);
      expect(m.historial).toEqual(m.trasMarcar.historial);
    });
  });

  describe("con cierres reales (R11)", () => {
    it("anti-vacuidad: aporte positivo, marcada de mas, y los TRES libros con filas", () => {
      expect(reales.marca).toBe("updated");
      expect(reales.aporte.greaterThan(0)).toBe(true);
      expect(reales.pantallaAntes.faltaPorRecibir).toBe("-200.00");
      for (const tabla_ of ["wallet_movimiento|", "wallet_tienda_movimiento|", "pago_mensajero_movimiento|"]) {
        expect(reales.librosAntes.some((f) => f.startsWith(tabla_)), tabla_).toBe(true);
      }
    });

    it("⭑ R11: corregir hasta lo que debe escribe solo la variacion y queda en 0.00", () => {
      expect(reales.resultado).toBe("updated");
      expect(reales.diferencia).toEqual([
        ["marca", "ingreso", "200.00", "-200.00"],
        ["correccion", "egreso", "200.00", "200.00"],
      ]);
      expect(reales.pantalla.faltaPorRecibir).toBe("0.00");
      expect(reales.pantalla.estado).toBe("recibido");
      expect(reales.historial).toBe(1);
    });

    it("⭑ R11: no vuelve a asentar los cierres, ni cambia una fila de los libros ni de la marca", () => {
      expect(reales.librosDespues).toEqual(reales.librosAntes);
      expect(reales.marcaAntes).toHaveLength(2);
      expect(reales.marcaDespues).toEqual(reales.marcaAntes);
    });
  });
});
