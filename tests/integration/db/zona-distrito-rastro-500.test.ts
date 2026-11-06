import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { ZonaRepository } from "@/lib/repositories/ZonaRepository";
import { HistorialAccionRepository } from "@/lib/repositories/HistorialAccionRepository";
import { accionesDeCategoria } from "@/lib/types/historial-accion";
import type { UpdateZonaData, UpdateZonaResult } from "@/lib/interfaces/repositories/IZonaRepository";
import type { FiltroHistorialAccionResuelto } from "@/lib/interfaces/repositories/IHistorialAccionRepository";

import {
  HAY_BASE_DE_DATOS,
  RegistroCaido,
  clienteConSavepoint,
  crearPrismaDeTest,
  enTransaccionRevertida,
  fksDeOrden,
  serializarEscriturasReales,
  type TxDeTest,
} from "./_postgres-real";
import { zonaCreada } from "./_fixtures/zona-creada";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 500 (T4.2; R12-R19 y la parte de R21 del repositorio) — EL RASTRO DE LOS DISTRITOS DE
// UNA ZONA, CONTRA POSTGRES REAL y por `ZonaRepository` real.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Los dobles no ven el «antes» y el «despues» de la N:M (memoria «Probar el WHERE donde vive»). Todo
// corre en una transaccion que SIEMPRE se revierte, con `serializarEscriturasReales` primero.
//
// ⚠️ NADA DE `if (!fks) return;`: con base y sin catalogo esto REVIENTA. Sin base alcanzable,
// `describe.skip` VISIBLE. Cada caso afirma su premisa antes de afirmar su efecto.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const ACCION = "zona_distrito_cambiado" as const;
const SUFIJO = `500-${Date.now().toString(36)}`;
let contador = 0;
function unico(): string {
  contador += 1;
  return `${SUFIJO}-${contador.toString(36)}-${randomUUID().slice(0, 6)}`;
}

function datos(nombre: string, distritoIds: string[], cobro?: number): UpdateZonaData {
  return {
    nombre,
    cobroVehiculo: false,
    distritoIds,
    tarifas: cobro === undefined ? [] : [{ cobroEntregado: cobro, cobroRechazado: 100, vehiculoId: null }],
  };
}

function soloOk(res: UpdateZonaResult): Extract<UpdateZonaResult, { estado: "ok" }> {
  if (res.estado !== "ok") throw new Error(`se esperaba \`ok\` y llego \`${res.estado}\``);
  return res;
}

/**
 * FICHA 502 (design §2): un cliente cuya RAIZ es el `prisma` real (otra conexion del pool) y cuyo
 * `$transaction` entrega la `tx` del escenario. Local a este archivo a proposito: `clienteConSavepoint`
 * lo usan decenas de archivos y no compensa cambiarlo por un menor.
 */
function raizDistintaDeTx(raiz: PrismaClient, tx: TxDeTest): PrismaClient {
  return new Proxy(raiz, {
    get(objetivo, prop) {
      if (prop === "$transaction") return async (fn: (t: TxDeTest) => unknown) => fn(tx);
      const valor = Reflect.get(objetivo, prop) as unknown;
      return typeof valor === "function" ? valor.bind(objetivo) : valor;
    },
  });
}

describeSiHayBase("⭑ 500 — los distritos de una zona dejan rastro al guardar (Postgres real)", () => {
  let prisma: PrismaClient;
  let CANTON: { id: string; nombre: string };
  let USUARIO: string;
  let NOMBRE_ACTOR: string;
  let ROL_ACTOR: string;

  beforeAll(async () => {
    prisma = crearPrismaDeTest();
    const fks = await fksDeOrden(prisma);
    if (fks === null) {
      throw new Error("hay DATABASE_URL pero la tabla `orden` esta vacia: corre `pnpm run db:seed` antes.");
    }
    const canton = await prisma.canton.findUniqueOrThrow({ where: { id: fks.cantonId }, select: { id: true, nombre: true } });
    CANTON = canton;
    const usuario = await prisma.usuario.findFirst({
      select: { id: true, nombre: true, primerApellido: true, rol: { select: { value: true } } },
      orderBy: { id: "asc" },
    });
    if (usuario === null) throw new Error("hacen falta usuarios en la base: corre `pnpm run db:seed:maestro`.");
    USUARIO = usuario.id;
    NOMBRE_ACTOR = [usuario.nombre, usuario.primerApellido].filter((p) => p).join(" ");
    ROL_ACTOR = usuario.rol.value;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  interface Escenario {
    tx: TxDeTest;
    repo: ZonaRepository;
    A: { id: string; nombre: string };
    B: { id: string; nombre: string };
    distrito: (nombre?: string, zonaId?: string) => Promise<{ id: string; nombre: string }>;
    filas: (zonaId: string) => Promise<
      {
        accion: string;
        entidadTipo: string;
        entidadId: string | null;
        entidadEtiqueta: string;
        valorAnterior: string | null;
        valorNuevo: string | null;
        monto: unknown;
        loteId: string;
        actorUsuarioId: string | null;
        actorNombre: string | null;
        actorRol: string | null;
      }[]
    >;
    nm: (zonaId: string) => Promise<string[]>;
  }

  function conEscenario<T>(fn: (e: Escenario) => Promise<T>, romperRegistro = false): Promise<T> {
    return enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const nombres = { A: `500 A ${unico()}`, B: `500 B ${unico()}` };
      const a = await tx.zona.create({
        data: { sinpeNumero: "80000000", sinpeNombre: "Titular", nombre: nombres.A },
        select: { id: true },
      });
      const b = await tx.zona.create({
        data: { sinpeNumero: "80000000", sinpeNombre: "Titular", nombre: nombres.B },
        select: { id: true },
      });
      const e: Escenario = {
        tx,
        repo: new ZonaRepository(clienteConSavepoint(tx, romperRegistro)),
        A: { id: a.id, nombre: nombres.A },
        B: { id: b.id, nombre: nombres.B },
        distrito: async (nombre = `500 D ${unico()}`, zonaId) => {
          const d = await tx.distrito.create({ data: { nombre, cantonId: CANTON.id }, select: { id: true } });
          if (zonaId !== undefined) await tx.zonaDistrito.create({ data: { zonaId, distritoId: d.id } });
          return { id: d.id, nombre };
        },
        filas: (zonaId) =>
          tx.historialAccion.findMany({
            where: { accion: ACCION, entidadId: zonaId },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              accion: true,
              entidadTipo: true,
              entidadId: true,
              entidadEtiqueta: true,
              valorAnterior: true,
              valorNuevo: true,
              monto: true,
              loteId: true,
              actorUsuarioId: true,
              actorNombre: true,
              actorRol: true,
            },
          }),
        nm: async (zonaId) =>
          (await tx.zonaDistrito.findMany({ where: { zonaId }, select: { distritoId: true } }))
            .map((f) => f.distritoId)
            .sort(),
      };
      return fn(e);
    });
  }

  it("R12/R13/R14/R16: añadir 2 y quitar 1 → 3 filas, un lote propio, valores exactos, sin monto, con actor", async () => {
    const r = await conEscenario(async (e) => {
      const queda = await e.distrito(undefined, e.A.id);
      const sale = await e.distrito(`500 Sale ${unico()}`, e.A.id);
      const entra1 = await e.distrito(`500 Entra1 ${unico()}`);
      const entra2 = await e.distrito(`500 Entra2 ${unico()}`);
      const antes = await e.filas(e.A.id);
      const nuevoNombre = `${e.A.nombre} bis`;
      // Tambien cambia el pago al mensajero: otra accion del MISMO guardado, con su propio lote.
      soloOk(await e.repo.update(e.A.id, datos(nuevoNombre, [queda.id, entra1.id, entra2.id], 1500), USUARIO));
      const otrasDelGuardado = await e.tx.historialAccion.findMany({
        where: { entidadId: e.A.id, accion: { not: ACCION } },
        select: { accion: true, loteId: true },
      });
      return {
        antes: antes.length,
        filas: await e.filas(e.A.id),
        otrasDelGuardado,
        sale,
        entra1,
        entra2,
        nuevoNombre,
        nm: await e.nm(e.A.id),
        esperadoNm: [queda.id, entra1.id, entra2.id].sort(),
      };
    });
    expect(r.antes).toBe(0);
    expect(r.nm).toEqual(r.esperadoNm); // premisa: el guardado se aplico
    expect(r.filas).toHaveLength(3);
    // R14. Las tres filas comparten `created_at` (un solo INSERT) y el `id` es aleatorio: se comparan
    // como conjunto, ordenadas aqui.
    const clave = (p: (string | null)[]) => JSON.stringify(p);
    expect(r.filas.map((f) => [f.valorAnterior, f.valorNuevo]).sort((a, b) => clave(a).localeCompare(clave(b)))).toEqual([
      [`${r.sale.nombre} (${CANTON.nombre})`, null],
      [null, `${r.entra1.nombre} (${CANTON.nombre})`],
      [null, `${r.entra2.nombre} (${CANTON.nombre})`],
    ].sort((a, b) => clave(a).localeCompare(clave(b))));
    // R16: la zona (nombre DESPUES del guardado), quien guardo, y sin monto.
    for (const f of r.filas) {
      expect(f).toMatchObject({
        accion: ACCION,
        entidadTipo: "zona",
        entidadId: expect.any(String),
        entidadEtiqueta: r.nuevoNombre,
        monto: null,
        actorUsuarioId: USUARIO,
        actorNombre: NOMBRE_ACTOR,
        actorRol: ROL_ACTOR,
      });
    }
    // R13: un solo lote para las tres, distinto del de las demas acciones del guardado.
    const lotes = new Set(r.filas.map((f) => f.loteId));
    expect(lotes.size).toBe(1);
    expect(r.otrasDelGuardado.map((o) => o.accion)).toContain("zona_pago_mensajero_cambiado");
    for (const o of r.otrasDelGuardado) expect(lotes.has(o.loteId)).toBe(false);
  });

  it("R15: un distrito de 80 caracteres deja un valor de 60, sin pasarse", async () => {
    const r = await conEscenario(async (e) => {
      const base = `500L${unico()}`;
      const largo = (base + "x".repeat(80)).slice(0, 80);
      const d = await e.distrito(largo);
      soloOk(await e.repo.update(e.A.id, datos(e.A.nombre, [d.id]), USUARIO));
      return { largo, filas: await e.filas(e.A.id) };
    });
    expect(r.largo).toHaveLength(80);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].valorNuevo).toHaveLength(60);
    expect(r.filas[0].valorNuevo).toBe(r.largo.slice(0, 60));
  });

  // R17. Los REPETIDOS no llegan al repositorio: `ZonaService` los deduplica (`distinct`) antes de
  // llamar a `update`, cuyo `createMany` fallaria con la PK de `zona_distrito`. Aqui se mide el OTRO
  // ORDEN contra Postgres; el repetido lo cubre el unitario de `diferenciaDeDistritos`.
  it("R17: los mismos distritos en otro orden → 0 filas", async () => {
    const r = await conEscenario(async (e) => {
      const d1 = await e.distrito(undefined, e.A.id);
      const d2 = await e.distrito(undefined, e.A.id);
      const res = soloOk(await e.repo.update(e.A.id, datos(e.A.nombre, [d2.id, d1.id]), USUARIO));
      return { res: res.estado, filas: await e.filas(e.A.id), nm: await e.nm(e.A.id), esperado: [d1.id, d2.id].sort() };
    });
    expect(r.res).toBe("ok");
    expect(r.nm).toEqual(r.esperado);
    expect(r.filas).toHaveLength(0);
  });

  it("R18: zona inexistente, quitar la unica central y distrito en otra zona → 0 filas y la N:M igual", async () => {
    const r = await conEscenario(async (e) => {
      const propio = await e.distrito(undefined, e.A.id);
      const libre = await e.distrito();
      const deB = await e.distrito(undefined, e.B.id);
      // not_found
      const fantasma = randomUUID();
      const noExiste = await e.repo.update(fantasma, datos("x", [libre.id]), USUARIO);
      // sin_zona_central: la central de la base (o una sembrada si no la hay).
      const central =
        (await e.tx.zona.findFirst({ where: { esCentral: true }, select: { id: true, nombre: true } })) ??
        (await e.tx.zona.create({
          data: { nombre: `500 C ${unico()}`, esCentral: true, sinpeNumero: "80000000", sinpeNombre: "Titular" },
          select: { id: true, nombre: true },
        }));
      const nmCentralAntes = await e.nm(central.id);
      const sinCentral = await e.repo.update(
        central.id,
        { ...datos(central.nombre, [...nmCentralAntes, libre.id]), esCentral: false },
        USUARIO,
      );
      // distrito_en_otra_zona
      const nmAAntes = await e.nm(e.A.id);
      const enOtra = await e.repo.update(e.A.id, datos(e.A.nombre, [propio.id, deB.id]), USUARIO);
      return {
        estados: [noExiste.estado, sinCentral.estado, enOtra.estado],
        filas: [
          ...(await e.filas(fantasma)),
          ...(await e.filas(central.id)),
          ...(await e.filas(e.A.id)),
        ].length,
        nmA: [nmAAntes, await e.nm(e.A.id)],
        nmCentral: [nmCentralAntes, await e.nm(central.id)],
      };
    });
    expect(r.estados).toEqual(["not_found", "sin_zona_central", "distrito_en_otra_zona"]);
    expect(r.filas).toBe(0);
    expect(r.nmA[1]).toEqual(r.nmA[0]);
    expect(r.nmCentral[1]).toEqual(r.nmCentral[0]);
  });

  it("R18: un error forzado al registrar (despues del reemplazo) → 0 filas y la N:M igual que antes", async () => {
    const r = await conEscenario(async (e) => {
      const antes = await e.distrito(undefined, e.A.id);
      const nuevo = await e.distrito();
      const nmAntes = await e.nm(e.A.id);
      let error: unknown = null;
      try {
        await e.repo.update(e.A.id, datos(e.A.nombre, [nuevo.id]), USUARIO);
      } catch (err) {
        error = err;
      }
      return { error, nmAntes, nmDespues: await e.nm(e.A.id), filas: await e.filas(e.A.id), antes: antes.id };
    }, true);
    expect(r.error).toBeInstanceOf(RegistroCaido); // premisa: el guardado SI llego a registrar y fallo
    expect(r.nmAntes).toEqual([r.antes]);
    expect(r.nmDespues).toEqual(r.nmAntes);
    expect(r.filas).toHaveLength(0);
  });

  // ⭑ FICHA 502 (T1; R4, R5). `clienteConSavepoint` entrega el MISMO proxy como raiz y como `tx`, asi que
  // ningun caso de arriba distingue `appendAccion(tx, …)` de `appendAccion(this.prisma, …)` (m1 de la
  // revision de la 500). Aqui la raiz es el `prisma` real, con la otra conexion del pool, y Postgres hace
  // la distincion por visibilidad en READ COMMITTED: con `this.prisma` las filas salen ya commiteadas.
  it("502/R4/R5: las filas del rastro existen dentro de la tx, no se ven desde otra conexion y no sobreviven al revertir", async () => {
    const r = await conEscenario(async (e) => {
      const sale = await e.distrito(undefined, e.A.id);
      const entra = await e.distrito();
      const repo = new ZonaRepository(raizDistintaDeTx(prisma, e.tx));
      const guardado = soloOk(await repo.update(e.A.id, datos(e.A.nombre, [entra.id]), USUARIO));
      return {
        zonaId: e.A.id,
        guardado: guardado.estado,
        nm: await e.nm(e.A.id),
        esperadoNm: [entra.id],
        quitado: sale.id,
        dentroDeLaTx: (await e.filas(e.A.id)).length,
        // Premisa: esa conexion es otra de verdad. La zona sembrada sin commitear no se ve desde ella.
        zonaDesdeOtraConexion: await prisma.zona.count({ where: { id: e.A.id } }),
        desdeOtraConexion: await prisma.historialAccion.count({ where: { accion: ACCION, entidadId: e.A.id } }),
      };
    });
    const tras = { accion: ACCION, entidadId: r.zonaId };
    const trasRevertir = await prisma.historialAccion.count({ where: tras });
    // ANTES de los `expect`: con el codigo mal, las filas quedan commiteadas en la base compartida y un
    // `expect` rojo saltaria una limpieza puesta despues. Con el codigo bien, borra 0 filas.
    await prisma.historialAccion.deleteMany({ where: tras });

    expect(r.guardado).toBe("ok");
    expect(r.nm).toEqual(r.esperadoNm);
    expect(r.nm).not.toContain(r.quitado);
    expect(r.zonaDesdeOtraConexion).toBe(0);
    expect(r.dentroDeLaTx).toBe(2);
    expect(r.desdeOtraConexion).toBe(0); // R4
    expect(trasRevertir).toBe(0); // R5
  });

  it("R19: crear una zona con distritos y borrarla → 0 filas", async () => {
    const r = await conEscenario(async (e) => {
      const d1 = await e.distrito();
      const d2 = await e.distrito();
      const zona = zonaCreada(
        await e.repo.create(
          {
            nombre: `500 Nueva ${unico()}`,
            cobroVehiculo: false,
            esCentral: false,
            distritoIds: [d1.id, d2.id],
            tarifas: [],
            sinpeNumero: "80000000",
            sinpeNombre: "Titular",
          },
          USUARIO,
        ),
      );
      const nm = await e.nm(zona.id);
      const filasTrasCrear = (await e.filas(zona.id)).length;
      const borrado = await e.repo.hardDelete(zona.id, USUARIO);
      return { nm: nm.length, filasTrasCrear, borrado, filas: (await e.filas(zona.id)).length };
    });
    expect(r.nm).toBe(2); // premisa: la zona nacio con sus distritos
    expect(r.borrado).toBe("ok");
    expect(r.filasTrasCrear).toBe(0);
    expect(r.filas).toBe(0);
  });

  it("R21: el repositorio del historial las encuentra por «mueve dinero» y por la accion, con sus valores (pantalla y descarga)", async () => {
    const r = await conEscenario(async (e) => {
      const d = await e.distrito(`500 R21 ${unico()}`);
      soloOk(await e.repo.update(e.A.id, datos(e.A.nombre, [d.id]), USUARIO));
      const historial = new HistorialAccionRepository(e.tx as unknown as PrismaClient);
      const base: FiltroHistorialAccionResuelto = {
        q: e.A.nombre,
        actorId: null,
        accion: null,
        entidadTipo: null,
        desde: null,
        hasta: null,
      };
      const orden = { sortBy: "created_at", sortDir: "desc" } as const;
      const porCategoria = await historial.list({
        filtro: { ...base, accion: accionesDeCategoria("mueve_dinero") },
        orden,
        page: 1,
        pageSize: 25,
      });
      const porAccion = await historial.list({ filtro: { ...base, accion: [ACCION] }, orden, page: 1, pageSize: 25 });
      const descarga = await historial.listAll({ filtro: { ...base, accion: [ACCION] }, orden, limite: 100 });
      const pick = (f: { accion: string; valorAnterior: string | null; valorNuevo: string | null }) => [
        f.accion,
        f.valorAnterior,
        f.valorNuevo,
      ];
      return {
        texto: `${d.nombre} (${CANTON.nombre})`,
        categoria: porCategoria.items.filter((f) => f.accion === ACCION).map(pick),
        accion: porAccion.items.map(pick),
        descarga: descarga.map(pick),
      };
    });
    const esperado = [[ACCION, null, r.texto]];
    expect(r.categoria).toEqual(esperado);
    expect(r.accion).toEqual(esperado);
    expect(r.descarga).toEqual(esperado);
  });
});
