import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";

import {
  HAY_BASE_DE_DATOS,
  crearPrismaDeTest,
  enTransaccionRevertida,
  serializarEscriturasReales,
  type TxDeTest,
} from "./_postgres-real";
import {
  DIR_M3,
  DOWN,
  UP,
  algunUsuarioId,
  correr,
  existeTabla,
  intentarConMensaje,
  sembrarConsolidacion,
  sembrarZona,
} from "./498/_migraciones";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 498 / T2.6 — M3, retirar los asientos del conjunto S, contra Postgres (R48-R52).
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// El mundo de partida, dentro de la transaccion del test (que SIEMPRE se revierte): se corre el
// `down` de M3 (la base local ya la tiene aplicada), asi la base queda como antes de M3. Despues se
// siembran los casos y se corre el `up`. Las aserciones miran SOLO las filas de los cierres
// sembrados: la base local es compartida y puede traer otras.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

type Casos = Awaited<ReturnType<typeof sembrarCasos>>;

async function crearCierre(
  tx: TxDeTest,
  c: { mensajeroId: string; zonaId: string; destino: "bodega_satelite" | "bodega_central"; estado: "aprobado" | "solicitado"; cierreBodegaId?: string },
): Promise<string> {
  const fila = await tx.cierreDia.create({
    data: {
      mensajeroId: c.mensajeroId,
      estado: c.estado,
      destinoTipo: c.destino,
      destinoZonaId: c.zonaId,
      cierreBodegaId: c.cierreBodegaId ?? null,
    },
    select: { id: true },
  });
  return fila.id;
}

async function caja(tx: TxDeTest, cierreId: string, categoria = "ingreso_flete"): Promise<string> {
  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO wallet_movimiento (id, tipo, categoria, monto, origen_tipo, origen_id)
     VALUES ($1, 'ingreso', $2::wallet_movimiento_categoria, 100, 'cierre_dia', $3)`,
    id,
    categoria,
    cierreId,
  );
  return id;
}

async function tienda(tx: TxDeTest, cierreId: string, tiendaId: string): Promise<string> {
  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO wallet_tienda_movimiento (id, tienda_id, tipo, categoria, monto, origen_tipo, origen_id)
     VALUES ($1, $2, 'debito', 'flete', 100, 'cierre_dia', $3)`,
    id,
    tiendaId,
    cierreId,
  );
  return id;
}

async function mensajero(
  tx: TxDeTest,
  cierreId: string,
  mensajeroId: string,
  m: { tipo: string; categoria: string; premioDia?: string },
): Promise<string> {
  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO pago_mensajero_movimiento (id, mensajero_id, tipo, categoria, monto, origen_tipo, origen_id, premio_dia)
     VALUES ($1, $2, $3::pago_mensajero_movimiento_tipo, $4::pago_mensajero_movimiento_categoria, 100, 'cierre_dia', $5, $6::date)`,
    id,
    mensajeroId,
    m.tipo,
    m.categoria,
    cierreId,
    m.premioDia ?? null,
  );
  return id;
}

async function sembrarCasos(tx: TxDeTest) {
  const usuarioId = await algunUsuarioId(tx);
  const zonaId = await sembrarZona(tx);
  const central = await tx.zona.findFirstOrThrow({ where: { esCentral: true }, select: { id: true } });
  const base = { mensajeroId: usuarioId, zonaId };
  // S: satelite aprobado SIN consolidacion, y en una consolidacion SIN conciliar.
  const s1 = await crearCierre(tx, { ...base, destino: "bodega_satelite", estado: "aprobado" });
  const cbPendiente = await sembrarConsolidacion(tx, { zonaId, usuarioId, general: "100" });
  const s2 = await crearCierre(tx, { ...base, destino: "bodega_satelite", estado: "aprobado", cierreBodegaId: cbPendiente });
  // Fuera de S: central, de una consolidacion CONCILIADA, y satelite sin aprobar.
  const c = await crearCierre(tx, { ...base, zonaId: central.id, destino: "bodega_central", estado: "aprobado" });
  const cbConciliada = await sembrarConsolidacion(tx, { zonaId, usuarioId, general: "100", recibido: "100" });
  const k = await crearCierre(tx, { ...base, destino: "bodega_satelite", estado: "aprobado", cierreBodegaId: cbConciliada });
  const x = await crearCierre(tx, { ...base, destino: "bodega_satelite", estado: "solicitado" });

  const retiradas = {
    s1Caja: await caja(tx, s1),
    s1Cod: await caja(tx, s1, "ingreso_cod_recaudado"),
    s1Tienda: await tienda(tx, s1, usuarioId),
    s1Devengo: await mensajero(tx, s1, usuarioId, { tipo: "devengo", categoria: "pago_devengado" }),
    s1Pago: await mensajero(tx, s1, usuarioId, { tipo: "pago", categoria: "pago_efectivo" }),
    s2Caja: await caja(tx, s2),
  };
  const dia = `2026-0${1 + Math.floor(Math.random() * 8)}-1${Math.floor(Math.random() * 9)}`;
  const conservadas = {
    s1Premio: await mensajero(tx, s1, usuarioId, { tipo: "devengo", categoria: "premio_ranking", premioDia: dia }),
    s1PremioReverso: await mensajero(tx, s1, usuarioId, { tipo: "pago", categoria: "ajuste_pago", premioDia: dia }),
    cCaja: await caja(tx, c),
    cTienda: await tienda(tx, c, usuarioId),
    kCaja: await caja(tx, k),
    kMensajero: await mensajero(tx, k, usuarioId, { tipo: "devengo", categoria: "pago_devengado" }),
    xCaja: await caja(tx, x),
  };
  return { usuarioId, zonaId, s1, s2, c, k, x, retiradas, conservadas, cierres: [s1, s2, c, k, x] };
}

/** Las filas (completas, como JSON) de los tres libros con origen en los cierres sembrados. */
async function libros(tx: TxDeTest, casos: Casos): Promise<Record<string, string>> {
  const filas = await tx.$queryRawUnsafe<{ id: string; fila: string }[]>(
    `SELECT id, to_jsonb(w)::text AS fila FROM wallet_movimiento w WHERE origen_id = ANY($1::text[])
     UNION ALL SELECT id, to_jsonb(t)::text FROM wallet_tienda_movimiento t WHERE origen_id = ANY($1::text[])
     UNION ALL SELECT id, to_jsonb(p)::text FROM pago_mensajero_movimiento p WHERE origen_id = ANY($1::text[])`,
    casos.cierres,
  );
  return Object.fromEntries(filas.map((f) => [f.id, f.fila]));
}

async function respaldoDe(tx: TxDeTest, casos: Casos) {
  return tx.$queryRawUnsafe<{ tabla: string; id: string; fila: string }[]>(
    `SELECT tabla, id, fila::text AS fila FROM respaldo.asientos_satelite_498
      WHERE fila->>'origen_id' = ANY($1::text[]) ORDER BY tabla, id`,
    casos.cierres,
  );
}

/** El mundo antes de M3, dentro de la tx: el `down` real de M3. */
async function antesDeM3(tx: TxDeTest): Promise<void> {
  await serializarEscriturasReales(tx);
  if (await existeTabla(tx, "respaldo.asientos_satelite_498")) await correr(tx, DOWN(DIR_M3));
}

describeSiHayBase("498/T2.6 — M3 retira los asientos del conjunto S (Postgres real)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("R48/R49/R51: retira SOLO lo de S, conserva premios, centrales, conciliados y no aprobados, y lo respalda integro", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await antesDeM3(tx);
      const casos = await sembrarCasos(tx);
      const antes = await libros(tx, casos);
      await correr(tx, UP(DIR_M3));
      return { casos, antes, despues: await libros(tx, casos), respaldo: await respaldoDe(tx, casos) };
    });
    const retiradas = Object.values(r.casos.retiradas);
    const conservadas = Object.values(r.casos.conservadas);
    // Anti-vacuidad: todo estaba antes.
    for (const id of [...retiradas, ...conservadas]) expect(r.antes[id]).toBeDefined();
    for (const id of retiradas) expect(r.despues[id]).toBeUndefined();
    for (const id of conservadas) expect(r.despues[id]).toBe(r.antes[id]);
    // Respaldo: exactamente las retiradas, con su tabla, y la fila INTEGRA.
    expect(r.respaldo.map((f) => f.id).sort()).toEqual([...retiradas].sort());
    for (const f of r.respaldo) expect(JSON.parse(f.fila)).toEqual(JSON.parse(r.antes[f.id]));
    const tablaDe = Object.fromEntries(r.respaldo.map((f) => [f.id, f.tabla]));
    expect(tablaDe[r.casos.retiradas.s1Caja]).toBe("wallet_movimiento");
    expect(tablaDe[r.casos.retiradas.s1Tienda]).toBe("wallet_tienda_movimiento");
    expect(tablaDe[r.casos.retiradas.s1Devengo]).toBe("pago_mensajero_movimiento");
  });

  it("R50: con un pago al mensajero contra un cierre de S, ABORTA con el conteo y no cambia nada", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await antesDeM3(tx);
      const casos = await sembrarCasos(tx);
      await tx.liquidacionPago.create({
        data: {
          claveIdempotencia: randomUUID(),
          mensajeroId: casos.usuarioId,
          cierreId: casos.s1,
          monto: new Prisma.Decimal("100"),
          metodo: "efectivo",
          fechaPago: new Date("2026-11-01"),
          registradoPor: casos.usuarioId,
        },
      });
      const antes = await libros(tx, casos);
      const error = await intentarConMensaje(tx, UP(DIR_M3));
      return {
        error,
        igual: JSON.stringify(await libros(tx, casos)) === JSON.stringify(antes),
        respaldo: await existeTabla(tx, "respaldo.asientos_satelite_498"),
      };
    });
    expect(r.error).toMatch(/ficha 498: 1 pagos al mensajero registrados contra cierres de S; no se cambia nada/);
    expect(r.igual).toBe(true);
    // Ni siquiera la tabla de respaldo: el archivo entero se revirtio.
    expect(r.respaldo).toBe(false);
  });

  it("R52: up → down → up deja los tres libros igual que el primer up; el down los devuelve integros", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await antesDeM3(tx);
      const casos = await sembrarCasos(tx);
      const inicial = await libros(tx, casos);
      await correr(tx, UP(DIR_M3));
      const tras1 = await libros(tx, casos);
      await correr(tx, DOWN(DIR_M3));
      const trasDown = await libros(tx, casos);
      const respaldoTrasDown = await existeTabla(tx, "respaldo.asientos_satelite_498");
      await correr(tx, UP(DIR_M3));
      return { inicial, tras1, trasDown, respaldoTrasDown, tras2: await libros(tx, casos) };
    });
    expect(Object.keys(r.tras1).length).toBeLessThan(Object.keys(r.inicial).length);
    expect(r.trasDown).toEqual(r.inicial);
    expect(r.respaldoTrasDown).toBe(false);
    expect(r.tras2).toEqual(r.tras1);
  });

  it("R52: el down NO duplica un cierre que ya se volvio a asentar al conciliar", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await antesDeM3(tx);
      const casos = await sembrarCasos(tx);
      await correr(tx, UP(DIR_M3));
      // El cierre s1 se vuelve a asentar (otro id, misma clave de origen).
      const nuevo = await caja(tx, casos.s1);
      const error = await intentarConMensaje(tx, DOWN(DIR_M3));
      const filas = await tx.walletMovimiento.findMany({
        where: { origenId: casos.s1, categoria: "ingreso_flete" },
        select: { id: true },
      });
      return { error, nuevo, filas: filas.map((f) => f.id) };
    });
    expect(r.error).toBeNull();
    expect(r.filas).toEqual([r.nuevo]);
  });

  it("R52: el down conserva el esquema `respaldo` si tiene otra tabla y lo borra si queda vacio", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await antesDeM3(tx);
      await correr(tx, UP(DIR_M3));
      const otras = await tx.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'respaldo' AND c.relname <> 'asientos_satelite_498' AND c.relkind = 'r'`,
      );
      const hayOtras = Number(otras[0].n) > 0;
      // Con otra tabla (la 499 en una base migrada; si no, se crea una).
      if (!hayOtras) await correr(tx, `CREATE TABLE respaldo.otra_498 (id int)`);
      await correr(tx, DOWN(DIR_M3));
      const conOtra = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM pg_namespace WHERE nspname = 'respaldo'`);
      // Vacio: se quitan las demas dentro de la tx y se repite up/down.
      await correr(tx, UP(DIR_M3));
      await correr(
        tx,
        `DO $$ DECLARE r record; BEGIN
           FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'respaldo' AND c.relkind = 'r' AND c.relname <> 'asientos_satelite_498'
           LOOP EXECUTE format('DROP TABLE respaldo.%I', r.relname); END LOOP; END $$`,
      );
      await correr(tx, DOWN(DIR_M3));
      const vacio = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM pg_namespace WHERE nspname = 'respaldo'`);
      return { conOtra: Number(conOtra[0].n), vacio: Number(vacio[0].n) };
    });
    expect(r).toEqual({ conOtra: 1, vacio: 0 });
  });

  it("R48: el up selecciona por predicado: no nombra ids ni fechas", () => {
    const up = UP(DIR_M3);
    expect(up).not.toMatch(/'[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(up).not.toMatch(/'20\d\d-\d\d-\d\d/);
  });
});
