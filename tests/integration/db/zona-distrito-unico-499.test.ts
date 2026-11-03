import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";

import { ZonaRepository } from "@/lib/repositories/ZonaRepository";
import { GeoRepository } from "@/lib/repositories/GeoRepository";
import { ZonaService, MSG_DISTRITO_RECIEN_ASIGNADO } from "@/lib/services/ZonaService";
import type { Actor } from "@/lib/interfaces/services/IZonaService";

import {
  HAY_BASE_DE_DATOS,
  clienteConSavepoint,
  crearPrismaDeTest,
  enTransaccionRevertida,
  fksDeOrden,
  serializarEscriturasReales,
  type FksDeOrden,
  type TxDeTest,
} from "./_postgres-real";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 499 — UN DISTRITO EN UNA SOLA ZONA, CONTRA POSTGRES REAL.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// La regla vive en tres sitios que un doble de Prisma NO ve: el `WHERE` de la lectura de
// conflictos (con su `NOT zonaId`), el orden de esa lectura frente a la primera escritura de la
// transaccion, y el indice unico `zona_distrito_distrito_id_key`. Por eso se mide aqui, con filas.
//
// ⚠️ Todo lo sembrado vive en una transaccion que SIEMPRE se revierte, salvo la carrera de R13,
// que necesita una segunda conexion y por tanto datos CONFIRMADOS: esa siembra se borra en un
// `finally`. Nada de `if (!fks) return;`: sin catalogo, el `beforeAll` revienta con un mensaje.
//
// ⚠️ `zona_es_central_unico` es un indice unico parcial GLOBAL: los casos que necesitan una central
// apagan TODAS las marcas dentro de su transaccion revertida antes de marcar la suya.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const SUFIJO = `499-${Date.now().toString(36)}`;
let contador = 0;
function unico(): string {
  contador += 1;
  return `${SUFIJO}-${contador.toString(36)}-${randomUUID().slice(0, 6)}`;
}

interface ZonaSembrada {
  id: string;
  nombre: string;
}

describeSiHayBase("⭑ 499 — un distrito en una sola zona (Postgres real)", () => {
  let prisma: PrismaClient;
  let FKS: FksDeOrden;
  let ACTOR: Actor;

  beforeAll(async () => {
    prisma = crearPrismaDeTest();
    const fks = await fksDeOrden(prisma);
    if (fks === null) {
      throw new Error(
        "hay DATABASE_URL pero la tabla `orden` esta vacia: sin un canton no se pueden sembrar " +
          "distritos. Corre `pnpm run db:seed` antes de esta suite.",
      );
    }
    FKS = fks;
    const usuario = await prisma.usuario.findFirst({ select: { id: true } });
    if (usuario === null) {
      throw new Error("hacen falta usuarios en la base. Corre `pnpm run db:seed:maestro`.");
    }
    ACTOR = { usuarioId: usuario.id, rol: "maestro" };
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function sembrarZona(
    tx: TxDeTest,
    prefijo: string,
    esCentral = false,
  ): Promise<ZonaSembrada> {
    const nombre = `499 ${prefijo} ${unico()}`;
    const z = await tx.zona.create({
      data: { nombre, esCentral, sinpeNumero: "80000000", sinpeNombre: "Titular de Prueba" },
      select: { id: true },
    });
    return { id: z.id, nombre };
  }

  async function sembrarDistrito(tx: TxDeTest, zonaIds: string[], nombre?: string): Promise<string> {
    const d = await tx.distrito.create({
      data: { nombre: nombre ?? `499 D ${unico()}`, cantonId: FKS.cantonId },
      select: { id: true },
    });
    for (const zonaId of zonaIds) {
      await tx.zonaDistrito.create({ data: { zonaId, distritoId: d.id } });
    }
    return d.id;
  }

  async function sembrarTarifa(tx: TxDeTest, zonaId: string): Promise<void> {
    await tx.tarifaZonaMensajero.create({
      data: {
        zonaId,
        cobroEntregado: new Prisma.Decimal("1000.00"),
        cobroRechazado: new Prisma.Decimal("500.00"),
      },
      select: { id: true },
    });
  }

  async function sembrarOrden(tx: TxDeTest, zonaId: string, distritoId: string): Promise<string> {
    const o = await tx.orden.create({
      data: {
        numRemision: `R-${unico()}`,
        destinatario: "Destinataria 499",
        telefonoDest: "8888-0000",
        producto: "caja de zapatos",
        estatusId: FKS.estatusId,
        tiendaId: FKS.tiendaId,
        zonaId,
        provinciaId: FKS.provinciaId,
        cantonId: FKS.cantonId,
        distritoId,
        direccion: "avenida siempre viva 742",
        montoCobrar: 12_000,
      },
      select: { id: true },
    });
    return o.id;
  }

  /** La foto de una zona: lo que un guardado rechazado NO puede haber cambiado. */
  async function fotoDeZona(tx: TxDeTest, zonaId: string) {
    const z = await tx.zona.findUniqueOrThrow({
      where: { id: zonaId },
      select: { nombre: true, esCentral: true, cobroVehiculo: true },
    });
    const distritos = (
      await tx.zonaDistrito.findMany({ where: { zonaId }, select: { distritoId: true } })
    )
      .map((f) => f.distritoId)
      .sort();
    const tarifas = (
      await tx.tarifaZonaMensajero.findMany({
        where: { zonaId },
        select: { id: true, cobroEntregado: true, cobroRechazado: true, vehiculoId: true },
      })
    ).map((t) => ({ ...t, cobroEntregado: t.cobroEntregado.toString(), cobroRechazado: t.cobroRechazado.toString() }));
    return { ...z, distritos, tarifas };
  }

  function servicio(tx: TxDeTest): ZonaService {
    return new ZonaService(new ZonaRepository(clienteConSavepoint(tx)));
  }

  function repo(tx: TxDeTest): ZonaRepository {
    return new ZonaRepository(clienteConSavepoint(tx));
  }

  async function sinCentrales(tx: TxDeTest): Promise<void> {
    await tx.zona.updateMany({ where: { esCentral: true }, data: { esCentral: false } });
    const quedan = await tx.zona.count({ where: { esCentral: true } });
    if (quedan !== 0) throw new Error(`el escenario arranca con ${quedan} centrales: imposible`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // B.0 — el defecto, medido antes de arreglarlo (rojo en `dev` el 2026-11-02: los dos `ok`)
  // ═══════════════════════════════════════════════════════════════════════════════════════════

  it("B.0 (i): crear una zona con un distrito que ya esta en otra responde validation_error", async () => {
    const medido = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const x = await sembrarZona(tx, "X");
      const d = await sembrarDistrito(tx, [x.id]);
      const res = await servicio(tx).crear(
        {
          nombre: `499 Nueva ${unico()}`,
          cobroVehiculo: false,
          esCentral: false,
          distritoIds: [d],
          tarifas: [],
          sinpeNumero: "80000000",
          sinpeNombre: "Titular de Prueba",
        },
        ACTOR,
      );
      const asignaciones = await tx.zonaDistrito.count({ where: { distritoId: d } });
      return { status: res.status, asignaciones };
    });
    expect(medido.status).toBe("validation_error");
    expect(medido.asignaciones).toBe(1);
  });

  it("B.0 (ii): actualizar Y con un distrito de X responde validation_error y Y no cambia", async () => {
    const medido = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const x = await sembrarZona(tx, "X");
      const y = await sembrarZona(tx, "Y");
      const dx = await sembrarDistrito(tx, [x.id]);
      const dy = await sembrarDistrito(tx, [y.id]);
      const res = await servicio(tx).actualizar(
        y.id,
        { nombre: `${y.nombre} renombrada`, cobroVehiculo: false, distritoIds: [dy, dx], tarifas: [] },
        ACTOR,
      );
      const zonaY = await tx.zona.findUniqueOrThrow({ where: { id: y.id }, select: { nombre: true } });
      const distritosY = (
        await tx.zonaDistrito.findMany({ where: { zonaId: y.id }, select: { distritoId: true } })
      ).map((f) => f.distritoId);
      return { status: res.status, nombreY: zonaY.nombre, distritosY, nombreOriginal: y.nombre, dy };
    });
    expect(medido.status).toBe("validation_error");
    expect(medido.nombreY).toBe(medido.nombreOriginal);
    expect(medido.distritosY).toEqual([medido.dy]);
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // B.7 — R9 a R16 contra Postgres
  // ═══════════════════════════════════════════════════════════════════════════════════════════

  it("R9: crear con conflicto y una central previa no escribe NADA; la central conserva la marca", async () => {
    // M3 (leer los conflictos DESPUES del `updateMany` de la central) pone este caso rojo: el
    // callback devuelve sin lanzar, la transaccion se confirma y la marca se pierde.
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await sinCentrales(tx);
      const central = await sembrarZona(tx, "C", true);
      const x = await sembrarZona(tx, "X");
      const d = await sembrarDistrito(tx, [x.id]);
      const libre = await sembrarDistrito(tx, []);
      const nombreNueva = `499 Nueva ${unico()}`;
      const zonasAntes = await tx.zona.count();
      const nmAntes = await tx.zonaDistrito.count();
      const tarifasAntes = await tx.tarifaZonaMensajero.count();
      const historialAntes = await tx.historialAccion.count();

      const res = await repo(tx).create(
        {
          nombre: nombreNueva,
          cobroVehiculo: false,
          esCentral: true,
          distritoIds: [libre, d],
          tarifas: [{ cobroEntregado: 1500, cobroRechazado: 700, vehiculoId: null }],
          sinpeNumero: "80000000",
          sinpeNombre: "Titular de Prueba",
        },
        ACTOR.usuarioId,
      );
      return {
        res,
        centralSigue: (await tx.zona.findUniqueOrThrow({ where: { id: central.id } })).esCentral,
        nueva: await tx.zona.count({ where: { nombre: nombreNueva } }),
        zonas: (await tx.zona.count()) - zonasAntes,
        nm: (await tx.zonaDistrito.count()) - nmAntes,
        tarifas: (await tx.tarifaZonaMensajero.count()) - tarifasAntes,
        historial: (await tx.historialAccion.count()) - historialAntes,
        x,
      };
    });
    expect(m.res.estado).toBe("distrito_en_otra_zona");
    expect(m.res.estado === "distrito_en_otra_zona" && m.res.conflictos?.map((c) => c.zonaNombre)).toEqual([
      m.x.nombre,
    ]);
    expect(m.centralSigue).toBe(true);
    expect(m.nueva).toBe(0);
    expect({ zonas: m.zonas, nm: m.nm, tarifas: m.tarifas, historial: m.historial }).toEqual({
      zonas: 0,
      nm: 0,
      tarifas: 0,
      historial: 0,
    });
  });

  it("R10: actualizar con conflicto no cambia nombre, N:M, tarifas, marca, ordenes ni historial", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await sinCentrales(tx);
      const x = await sembrarZona(tx, "X");
      const y = await sembrarZona(tx, "Y");
      const dx = await sembrarDistrito(tx, [x.id]);
      const dy = await sembrarDistrito(tx, [y.id]);
      const libre = await sembrarDistrito(tx, []);
      await sembrarTarifa(tx, y.id);
      // Una orden del distrito de Y que apunta a X: el guardado de Y la reconciliaria.
      const orden = await sembrarOrden(tx, x.id, dy);
      const antes = await fotoDeZona(tx, y.id);
      const historialAntes = await tx.historialAccion.count();

      const payload = {
        nombre: `${y.nombre} renombrada`,
        cobroVehiculo: false,
        esCentral: true,
        distritoIds: [dy, libre, dx],
        tarifas: [{ cobroEntregado: 2000, cobroRechazado: 900, vehiculoId: null }],
      };
      const res = await repo(tx).update(y.id, payload, ACTOR.usuarioId);
      const despues = await fotoDeZona(tx, y.id);
      const zonaDeLaOrden = (await tx.orden.findUniqueOrThrow({ where: { id: orden } })).zonaId;
      const historial = (await tx.historialAccion.count()) - historialAntes;

      // ANTI-VACUIDAD de la premisa: el MISMO guardado sin el distrito de X SI reconcilia la orden
      // y SI escribe. Si esto no se moviera, «no cambio nada» no demostraria nada.
      const control = await repo(tx).update(
        y.id,
        { ...payload, distritoIds: [dy, libre] },
        ACTOR.usuarioId,
      );
      const zonaTrasControl = (await tx.orden.findUniqueOrThrow({ where: { id: orden } })).zonaId;
      return { res, antes, despues, zonaDeLaOrden, historial, x, y, control, zonaTrasControl };
    });
    expect(m.res.estado).toBe("distrito_en_otra_zona");
    expect(m.despues).toEqual(m.antes);
    expect(m.zonaDeLaOrden).toBe(m.x.id);
    expect(m.historial).toBe(0);
    // La premisa:
    expect(m.control.estado).toBe("ok");
    expect(m.control.estado === "ok" && m.control.ordenesReconciliadas).toBe(1);
    expect(m.zonaTrasControl).toBe(m.y.id);
  });

  it("R11: el service real nombra cada conflicto, en orden alfabetico español (crear y actualizar)", async () => {
    // M1 (quitar `leerConflictos` de `update`) pone rojo el caso de actualizar: el indice lo
    // atrapa y sale el mensaje de recarga en vez del nombrado.
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const este = await sembrarZona(tx, "Este");
      const oeste = await sembrarZona(tx, "Oeste");
      const y = await sembrarZona(tx, "Y");
      const zeta = `Zeta ${unico()}`;
      const abaco = `Ábaco ${unico()}`;
      const dZeta = await sembrarDistrito(tx, [este.id], zeta);
      const dAbaco = await sembrarDistrito(tx, [oeste.id], abaco);
      const svc = servicio(tx);
      const alCrear = await svc.crear(
        {
          nombre: `499 Nueva ${unico()}`,
          cobroVehiculo: false,
          esCentral: false,
          distritoIds: [dZeta, dAbaco],
          tarifas: [],
          sinpeNumero: "80000000",
          sinpeNombre: "Titular de Prueba",
        },
        ACTOR,
      );
      const alActualizar = await svc.actualizar(
        y.id,
        { nombre: y.nombre, cobroVehiculo: false, distritoIds: [dZeta, dAbaco], tarifas: [] },
        ACTOR,
      );
      return { alCrear, alActualizar, esperados: [
        `${abaco} ya está en la zona ${oeste.nombre}.`,
        `${zeta} ya está en la zona ${este.nombre}.`,
      ] };
    });
    const esperado = { status: "validation_error", fieldErrors: { distritoIds: m.esperados } };
    expect(m.alCrear).toEqual(esperado);
    expect(m.alActualizar).toEqual(esperado);
  });

  it("R12: los propios sin cambios, menos de los propios, o con uno libre: `ok`", async () => {
    // M2 (quitar el `NOT zonaId` del WHERE) pone este caso rojo: los propios dan conflicto.
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const y = await sembrarZona(tx, "Y");
      const d1 = await sembrarDistrito(tx, [y.id]);
      const d2 = await sembrarDistrito(tx, [y.id]);
      const libre = await sembrarDistrito(tx, []);
      const r = repo(tx);
      const base = { nombre: y.nombre, cobroVehiculo: false, tarifas: [] };
      const iguales = await r.update(y.id, { ...base, distritoIds: [d1, d2] }, ACTOR.usuarioId);
      const menos = await r.update(y.id, { ...base, distritoIds: [d1] }, ACTOR.usuarioId);
      const masLibre = await r.update(y.id, { ...base, distritoIds: [d1, libre] }, ACTOR.usuarioId);
      const final = (await fotoDeZona(tx, y.id)).distritos;
      return { estados: [iguales.estado, menos.estado, masLibre.estado], final, esperado: [d1, libre].sort() };
    });
    expect(m.estados).toEqual(["ok", "ok", "ok"]);
    expect(m.final).toEqual(m.esperado);
  });

  it("R10: actualizar con conflicto pidiendo la marca NO se la quita a la central ajena", async () => {
    // Revision 499 (m3): el caso R10 de arriba arranca sin centrales, asi que leer los conflictos
    // DESPUES del `updateMany` que apaga «las otras centrales» no lo ponia rojo. Aqui hay una
    // central ajena: con esa mutacion el callback devuelve sin lanzar y la marca se pierde.
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await sinCentrales(tx);
      const central = await sembrarZona(tx, "C", true);
      const x = await sembrarZona(tx, "X");
      const y = await sembrarZona(tx, "Y");
      const dx = await sembrarDistrito(tx, [x.id]);
      const historialAntes = await tx.historialAccion.count();
      const res = await repo(tx).update(
        y.id,
        { nombre: y.nombre, cobroVehiculo: false, esCentral: true, distritoIds: [dx], tarifas: [] },
        ACTOR.usuarioId,
      );
      return {
        res,
        centralSigue: (await tx.zona.findUniqueOrThrow({ where: { id: central.id } })).esCentral,
        ySigueSinMarca: !(await tx.zona.findUniqueOrThrow({ where: { id: y.id } })).esCentral,
        historial: (await tx.historialAccion.count()) - historialAntes,
      };
    });
    expect(m.res.estado).toBe("distrito_en_otra_zona");
    expect(m.centralSigue).toBe(true);
    expect(m.ySigueSinMarca).toBe(true);
    expect(m.historial).toBe(0);
  });

  it("R14: una zona que no existe responde `not_found` aunque el distrito este en otra", async () => {
    const res = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const x = await sembrarZona(tx, "X");
      const dx = await sembrarDistrito(tx, [x.id]);
      return repo(tx).update(
        randomUUID(),
        { nombre: `499 fantasma ${unico()}`, cobroVehiculo: false, distritoIds: [dx], tarifas: [] },
        ACTOR.usuarioId,
      );
    });
    expect(res).toEqual({ estado: "not_found" });
  });

  it("design §4.2: `sin_zona_central` gana a un conflicto", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await sinCentrales(tx);
      const central = await sembrarZona(tx, "C", true);
      const x = await sembrarZona(tx, "X");
      const dx = await sembrarDistrito(tx, [x.id]);
      const res = await repo(tx).update(
        central.id,
        { nombre: central.nombre, cobroVehiculo: false, esCentral: false, distritoIds: [dx], tarifas: [] },
        ACTOR.usuarioId,
      );
      return { res };
    });
    expect(m.res).toEqual({ estado: "sin_zona_central" });
  });

  it("R15/R16: listArbol real — `zonas` con su unica zona o vacia, y el colapso como siempre", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const x = await sembrarZona(tx, "X");
      const conZona = await sembrarDistrito(tx, [x.id]);
      const sinZona = await sembrarDistrito(tx, []);
      const arbol = await new GeoRepository(tx as unknown as PrismaClient).listArbol();
      const distritos = arbol.flatMap((p) => p.cantones.flatMap((c) => c.distritos));
      return {
        x,
        con: distritos.find((d) => d.id === conZona),
        sin: distritos.find((d) => d.id === sinZona),
      };
    });
    expect(m.con).toMatchObject({
      zonas: [{ id: m.x.id, nombre: m.x.nombre }],
      zonaId: m.x.id,
      zonaNombre: m.x.nombre,
    });
    expect(m.sin).toMatchObject({ zonas: [], zonaId: null, zonaNombre: null });
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // R13 — la carrera, determinista, con DOS conexiones
  // ═══════════════════════════════════════════════════════════════════════════════════════════

  it("R13: un guardado simultaneo asigna el distrito; el `update` choca con el indice y no escribe nada", async () => {
    // M4 (quitar `esViolacionDistritoUnico` del `catch`) pone este caso rojo: el error se relanza.
    //
    // Pasos (design §4.3): (1) la conexion B inserta (X, d) SIN confirmar; (2) `update(Y, [d])`
    // lee conflictos —no ve la fila— y su `createMany` se queda esperando en el indice; (3) B
    // confirma; (4) el `update` recibe la violacion. Datos CONFIRMADOS: se borran en el `finally`.
    const otra = crearPrismaDeTest();
    const nombres = { x: `499 carrera X ${unico()}`, y: `499 carrera Y ${unico()}` };
    const ids: { x?: string; y?: string; d?: string; dy?: string } = {};
    // Fuera del `try`: si el test cae a mitad, el `finally` suelta a B antes de limpiar (si no, la
    // limpieza esperaria por su fila sin confirmar hasta el `timeout` de B).
    let soltarB: () => void = () => undefined;
    let transaccionB: Promise<unknown> = Promise.resolve();
    try {
      const x = await prisma.zona.create({
        data: { nombre: nombres.x, sinpeNumero: "80000000", sinpeNombre: "Titular de Prueba" },
      });
      const y = await prisma.zona.create({
        data: { nombre: nombres.y, sinpeNumero: "80000000", sinpeNombre: "Titular de Prueba" },
      });
      ids.x = x.id;
      ids.y = y.id;
      const d = await prisma.distrito.create({
        data: { nombre: `499 carrera D ${unico()}`, cantonId: FKS.cantonId },
      });
      const dy = await prisma.distrito.create({
        data: { nombre: `499 carrera DY ${unico()}`, cantonId: FKS.cantonId },
      });
      ids.d = d.id;
      ids.dy = dy.id;
      await prisma.zonaDistrito.create({ data: { zonaId: y.id, distritoId: dy.id } });
      await prisma.tarifaZonaMensajero.create({
        data: { zonaId: y.id, cobroEntregado: "1000.00", cobroRechazado: "500.00" },
      });
      const antes = await fotoDeZona(prisma as unknown as TxDeTest, y.id);

      const puedeConfirmar = new Promise<void>((r) => (soltarB = r));
      let avisarInsertado!: () => void;
      const insertado = new Promise<void>((r) => (avisarInsertado = r));
      transaccionB = otra.$transaction(
        async (txB) => {
          await txB.zonaDistrito.create({ data: { zonaId: x.id, distritoId: d.id } });
          avisarInsertado();
          await puedeConfirmar;
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
      await insertado;

      const guardado = new ZonaRepository(prisma).update(
        y.id,
        {
          nombre: `${nombres.y} renombrada`,
          cobroVehiculo: false,
          distritoIds: [dy.id, d.id],
          tarifas: [{ cobroEntregado: 2000, cobroRechazado: 900, vehiculoId: null }],
        },
        ACTOR.usuarioId,
      );
      // Error de este test (no del codigo) si el guardado termina ANTES de quedar bloqueado.
      let terminoAntes = false;
      void guardado.then(
        () => (terminoAntes = true),
        () => (terminoAntes = true),
      );

      // Esperar a que el `createMany` del guardado este bloqueado en el indice por la fila de B.
      const limite = Date.now() + 15_000;
      for (;;) {
        const bloqueados = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query ILIKE '%zona_distrito%' AND pid <> pg_backend_pid()`,
        );
        if (Number(bloqueados[0].n) > 0) break;
        if (terminoAntes) throw new Error("el guardado termino sin quedar bloqueado: la carrera no se reprodujo");
        if (Date.now() > limite) throw new Error("el guardado nunca quedo bloqueado en el indice");
        await new Promise((r) => setTimeout(r, 50));
      }

      soltarB();
      await transaccionB;
      const res = await guardado;

      const despues = await fotoDeZona(prisma as unknown as TxDeTest, y.id);
      const historialDeY = await prisma.historialAccion.count({ where: { entidadId: y.id } });
      const asignacionesDeD = await prisma.zonaDistrito.findMany({
        where: { distritoId: d.id },
        select: { zonaId: true },
      });

      expect(res).toEqual({ estado: "distrito_en_otra_zona", conflictos: null });
      expect(despues).toEqual(antes);
      expect(historialDeY).toBe(0);
      expect(asignacionesDeD).toEqual([{ zonaId: x.id }]);

      // Y el service lo traduce SOLO al mensaje de recarga.
      // (El desenlace MEDIDO, reinyectado tal cual: el service no vuelve a tocar la base.)
      const traducido = await new ZonaService({
        countExistingDistritos: async (l: string[]) => l.length,
        countExistingVehiculos: async (l: string[]) => l.length,
        update: async () => res,
      } as unknown as ZonaRepository).actualizar(
        y.id,
        { nombre: nombres.y, cobroVehiculo: false, distritoIds: [d.id], tarifas: [] },
        ACTOR,
      );
      expect(traducido).toEqual({
        status: "validation_error",
        fieldErrors: { distritoIds: [MSG_DISTRITO_RECIEN_ASIGNADO] },
      });
    } finally {
      soltarB();
      await transaccionB.catch(() => undefined);
      const zonaIds = [ids.x, ids.y].filter((v): v is string => v !== undefined);
      const distritoIds = [ids.d, ids.dy].filter((v): v is string => v !== undefined);
      await prisma.zonaDistrito.deleteMany({
        where: { OR: [{ zonaId: { in: zonaIds } }, { distritoId: { in: distritoIds } }] },
      });
      await prisma.tarifaZonaMensajero.deleteMany({ where: { zonaId: { in: zonaIds } } });
      await prisma.zona.deleteMany({ where: { id: { in: zonaIds } } });
      await prisma.distrito.deleteMany({ where: { id: { in: distritoIds } } });
      await otra.$disconnect();
    }
  }, 60_000);
});
