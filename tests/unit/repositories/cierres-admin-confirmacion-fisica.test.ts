import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";

import {
  CierresAdminRepository,
  ConfirmacionFisicaNoAplicableError,
} from "@/lib/repositories/CierresAdminRepository";
import type { IPagoMensajeroMovimientoRepository } from "@/lib/interfaces/repositories/IPagoMensajeroMovimientoRepository";
import type { IWalletMensajeroFeedService } from "@/lib/interfaces/services/IWalletMensajeroFeedService";
import type { IWalletMovimientoRepository } from "@/lib/interfaces/repositories/IWalletMovimientoRepository";
import type { IWalletFeedService } from "@/lib/interfaces/services/IWalletFeedService";
import type { IWalletTiendaMovimientoRepository } from "@/lib/interfaces/repositories/IWalletTiendaMovimientoRepository";
import type { IWalletTiendaFeedService } from "@/lib/interfaces/services/IWalletTiendaFeedService";
import { APLICACION_GESTIONES } from "@/tests/fixtures/anclaje-devolucion";
import { idEstado, sembrarCatalogoEstados } from "@/tests/fixtures/catalogo-estados";

// Feature 238 (T3.3/T3.4, R17-R24/R44) — LA MARCA DE CONFIRMACION FISICA dentro de la transaccion
// de aprobacion.
//
// EL DOBLE HONRA EL `where`, y eso no es celo: un `vi.fn()` que devolviera `{count: n}` a ciegas
// dejaria la GUARDIA sin nadie que la mire, que es exactamente como el fallo de agosto de 2026
// llego a `dev` con el arbol verde (`progress/auditoria_ayuda_tienda.md` §3). Aqui `updateMany`
// filtra las filas por `(id IN ids, cierreId, resultado IN retornables)` igual que lo haria
// Postgres, asi que quitar cualquiera de las tres condiciones cambia lo que se escribe.

const ALCANCE_MAESTRO = { destinoTipo: "bodega_central" as const, destinoZonaId: null };

const G_DEV = "g-dev";
const G_REC = "g-rec";
const G_REP = "g-rep";
const G_INC = "g-inc";
const G_OTRO_CIERRE = "g-otro-cierre";

interface GestionFila {
  id: string;
  ordenId: string;
  cierreId: string;
  resultado: string;
  anuladaAt: Date | null;
  createdAt: Date;
  confirmadaFisicaAt: Date | null;
  /**
   * FICHA 454: la gestion es de CALLE del modelo nuevo (tiene evento `gestion_registrada`). Solo
   * esas las aplica la aprobacion. Ausente = LEGADA.
   */
  registrada?: boolean;
}

const T0 = new Date("2026-08-19T10:00:00.000Z");

/**
 * El corpus: un cierre `c1` con las tres clases que vuelven, un INCIDENTE del mismo cierre y una
 * devolucion de OTRO cierre. Las dos ultimas son los testigos de las dos guardas del WHERE.
 */
function gestiones(): GestionFila[] {
  const base = { anuladaAt: null, createdAt: T0, confirmadaFisicaAt: null };
  return [
    { id: G_DEV, ordenId: "o-dev", cierreId: "c1", resultado: "novedad", ...base },
    { id: G_REC, ordenId: "o-rec", cierreId: "c1", resultado: "devolucion_a_origen_por_rechazo", ...base },
    { id: G_REP, ordenId: "o-rep", cierreId: "c1", resultado: "reprogramado", ...base },
    { id: G_INC, ordenId: "o-inc", cierreId: "c1", resultado: "incidente", ...base },
    { id: G_OTRO_CIERRE, ordenId: "o-otro", cierreId: "c2", resultado: "novedad", ...base },
  ];
}

/** Dobles de wallet: feeds vacios -> la tx no mueve dinero y el bloque queda aislado. */
function buildWalletDeps() {
  const walletMovimientoRepo: IWalletMovimientoRepository = {
    crearMovimientos: vi.fn().mockResolvedValue(0),
    listar: vi.fn(),
    agregarPorCategoriaYTipo: vi.fn(),
    obtenerPorId: vi.fn(),
    agregarPorCategoria: vi.fn(),
    obtenerPorOrigen: vi.fn(),
    primerDiaDeLaCaja: vi.fn(async () => null), // ficha 459: este camino no lo usa
    obtenerPorClave: vi.fn(async () => null), // ficha 461 (R68): la relectura por clave; este camino no la usa
    crearMovimientoRegistrado: vi.fn().mockResolvedValue(1), // ficha 362: solo lo decidido por un humano // ficha 333: lectura por la clave del libro; este camino no la usa
  };
  const walletFeedService: IWalletFeedService = {
    construirMovimientosDeIngreso: vi.fn().mockResolvedValue([]),
  };
  const walletTiendaMovimientoRepo: IWalletTiendaMovimientoRepository = {
    crearMovimientos: vi.fn().mockResolvedValue(0),
    listarPorTienda: vi.fn(),
    agregarSaldoPorTienda: vi.fn(),
    listarSaldosTodasTiendas: vi.fn(),
    listarSaldosTiendasPaginado: vi.fn(),
    agregarDesglosePorTienda: vi.fn(),
    // ficha 335: doble no-op; esta suite no abre el selector de cierres.
    listarCierresDeTienda: vi.fn(async () => []),
    // Ficha 344: la lectura por id acotada a la tienda. Este doble no la ejercita.
    obtenerPorIdDeTienda: vi.fn(async () => null),
    registrarCobroEnHistorial: vi.fn(async () => undefined), // exigido por IWalletTiendaMovimientoRepository (ficha 381); no ejercitado aqui
    obtenerCobroPorId: vi.fn(async () => null), // ficha 461; no ejercitado aqui
    nombreDeTienda: vi.fn(async () => ""), obtenerCobroPorClave: vi.fn(async () => null), // ficha 461; no ejercitado aqui
  };
  const walletTiendaFeedService: IWalletTiendaFeedService = {
    construirMovimientosPorTienda: vi.fn().mockResolvedValue([]),
  };
  const pagoMensajeroMovimientoRepo: IPagoMensajeroMovimientoRepository = {
    crearMovimientos: vi.fn().mockResolvedValue(0),
    listarPorMensajero: vi.fn(),
    agregarCuentaPorPagar: vi.fn(),
    listarCuentasPorPagarTodos: vi.fn(),
    listarCuentasPorPagarPaginado: vi.fn(),
    listarCuentasPorPagarCompleto: vi.fn(),
    obtenerNombreMensajero: vi.fn(),
    // 293/T2.2-T3.3: los dos metodos NUEVOS del contrato (lectura). No-op aqui: este
    // doble no ejercita el premio.
    sumarPremiosVivosPorCierre: vi.fn(async () => ({})),
    listarPremiosPorDias: vi.fn(async () => []),
  };
  const walletMensajeroFeedService: IWalletMensajeroFeedService = {
    construirMovimientosDePago: vi.fn().mockResolvedValue({ libro: [], egresoCaja: [] }),
  };
  return {
    walletMovimientoRepo,
    walletFeedService,
    walletTiendaMovimientoRepo,
    walletTiendaFeedService,
    pagoMensajeroMovimientoRepo,
    walletMensajeroFeedService,
  };
}

interface WhereGestion {
  id?: { in?: string[] };
  cierreId?: string;
  resultado?: string | { in?: string[] };
  anuladaAt?: Date | null;
  ordenId?: { in?: string[] };
  // FICHA 454 (T1.7): la aplicacion al aprobar pide solo gestiones de CALLE con evento de
  // registro (`where.eventos`). El doble lo honra con `GestionFila.registrada`.
  eventos?: unknown;
}

/** `resultado` puede llegar como escalar (anclaje 239) o como `{ in }` (confirmacion 238). */
function casaResultado(fila: GestionFila, filtro: WhereGestion["resultado"]): boolean {
  if (filtro === undefined) return true;
  if (typeof filtro === "string") return fila.resultado === filtro;
  return filtro.in === undefined || filtro.in.includes(fila.resultado);
}

/**
 * «Base» en memoria de `gestion_orden` + `orden`. Las escrituras se aplican SOBRE las filas, de
 * modo que despues se pueda preguntar QUE quedo marcado — no solo con que argumentos se llamo.
 */
function buildBase(filas: GestionFila[], estadosOrden: Record<string, string> = {}) {
  const ordenes = { ...estadosOrden };
  const gestionOrden = {
    findMany: vi.fn(async ({ where, orderBy }: { where: WhereGestion; orderBy?: unknown }) => {
      const encontradas = filas.filter(
        (g) =>
          (where.cierreId === undefined || g.cierreId === where.cierreId) &&
          casaResultado(g, where.resultado) &&
          (where.anuladaAt === undefined || g.anuladaAt === where.anuladaAt) &&
          (where.ordenId?.in === undefined || where.ordenId.in.includes(g.ordenId)) &&
          (where.eventos === undefined || g.registrada === true),
      );
      void orderBy;
      return encontradas.map((g) => ({
        id: g.id,
        ordenId: g.ordenId,
        resultado: g.resultado,
        mensajeroId: "m1",
        motivo: null,
        eventos: g.registrada
          ? [{ id: `ev-${g.id}`, familiaAplicacion: "gestion", actorUsuarioId: "m1" }]
          : [],
      }));
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: WhereGestion; data: Record<string, unknown> }) => {
        let count = 0;
        for (const g of filas) {
          if (where.id?.in !== undefined && !where.id.in.includes(g.id)) continue;
          // LAS DOS GUARDAS. Sin `cierreId`, aprobar un cierre marcaria gestiones de otro; sin
          // `resultado`, marcaria un incidente —cuyo paquete no vuelve y nadie tuvo delante—.
          if (where.cierreId !== undefined && g.cierreId !== where.cierreId) continue;
          if (!casaResultado(g, where.resultado)) continue;
          Object.assign(g, data);
          count += 1;
        }
        return { count };
      },
    ),
  };
  const orden = {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id?: { in?: string[] }; estatusId?: string };
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const [id, estatusId] of Object.entries(ordenes)) {
          if (where.id?.in !== undefined && !where.id.in.includes(id)) continue;
          if (where.estatusId !== undefined && estatusId !== where.estatusId) continue;
          ordenes[id] = data.estatusId as string;
          count += 1;
        }
        return { count };
      },
    ),
  };
  // FICHA 454 (T1.7): la APLICACION escribe con `UPDATE "orden" SET "estatus_id" = $destino WHERE
  // "id" IN (…) AND "estatus_id" = $enReparto … RETURNING "id"`. El doble honra la guarda. El
  // resto de sentencias (emisor de webhooks del choke point) recibe `[]`: sin suscripciones.
  const $queryRaw = vi.fn(async (...c: unknown[]) => {
    const sql = (c[0] as readonly string[]).join(" ? ");
    if (!sql.includes('UPDATE "orden" SET "estatus_id" =')) return [];
    const destinoId = c[1] as string;
    const ids = (c[2] as { values: string[] }).values;
    const guarda = c[3] as string;
    const movidas: { id: string }[] = [];
    for (const id of ids) {
      if (ordenes[id] !== guarda) continue;
      ordenes[id] = destinoId;
      movidas.push({ id });
    }
    return movidas;
  });
  const prisma = {
    $queryRaw,
    cierreDia: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(1),
      // FICHA 362: `resolverCierre` lee ademas el total y el mensajero para congelar la etiqueta
      // y el importe de la fila del registro.
      findUnique: vi.fn().mockResolvedValue({
        destinoTipo: "bodega_central", // ficha 498 (fixture): el destino que la aprobacion lee (R4)
        mensajeroId: "m1",
        totalGeneral: new Prisma.Decimal("0.00"),
        solicitadoAt: new Date("2026-09-02T12:00:00Z"),
        mensajero: { nombre: "Mensa", primerApellido: "Uno" },
      }),
    },
    // FICHA 362: el registro de la decision, en la MISMA tx.
    historialAccion: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    usuario: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ nombre: "Admin", primerApellido: "Uno", rol: { value: "admin" } }),
    },
    gestionOrden,
    orden,
    ordenHistorialEstado: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  return { prisma, ordenes, filas };
}

function makeRepo(prisma: Record<string, unknown>) {
  const wallet = buildWalletDeps();
  const withTx = {
    ...prisma,
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
  };
  return new CierresAdminRepository(
    withTx as unknown as PrismaClient,
    wallet.walletMovimientoRepo,
    wallet.walletFeedService,
    wallet.walletTiendaMovimientoRepo,
    wallet.walletTiendaFeedService,
    wallet.pagoMensajeroMovimientoRepo,
    wallet.walletMensajeroFeedService,
    { construirEgresoIndemnizacion: vi.fn(async () => []) },
  );
}

function aprobar(repo: CierresAdminRepository, ids: string[], cierreId = "c1") {
  return repo.resolverCierre({
    cierreId,
    alcance: ALCANCE_MAESTRO,
    nuevoEstado: "aprobado",
    resueltoPor: "adm-maestro",
    motivoRechazo: null,
    aplicacionGestiones: APLICACION_GESTIONES,
    confirmacionFisica: ids.map((gestionId) => ({ gestionId })),
  });
}

/** Los ids que quedaron con marca, ordenados. */
function marcadas(filas: GestionFila[]): string[] {
  return filas
    .filter((g) => g.confirmadaFisicaAt !== null)
    .map((g) => g.id)
    .sort();
}

// La guardia del choke point es de FALLO CERRADO: el anclaje registra un par real, asi que la tx
// necesita el catalogo o la aprobacion entera revierte (correcto, pero no lo que se mide aqui).
beforeEach(async () => {
  await sembrarCatalogoEstados();
});

describe("238/R17 — la marca se escribe en la MISMA transaccion que aprueba", () => {
  it("marca EXACTAMENTE las gestiones confirmadas del cierre", async () => {
    const base = buildBase(gestiones());

    const res = await aprobar(makeRepo(base.prisma), [G_DEV, G_REC, G_REP]);

    expect(res).toBe("updated");
    expect(marcadas(base.filas)).toEqual([G_DEV, G_REC, G_REP].sort());
    // Una sola transaccion envuelve TODO (todo-o-nada).
    expect((base.prisma as { $transaction?: unknown }).$transaction ?? true).toBeTruthy();
  });

  it("UNA sola consulta para las tres, no una por gestion", async () => {
    const base = buildBase(gestiones());

    await aprobar(makeRepo(base.prisma), [G_DEV, G_REC, G_REP]);

    // A diferencia del bucle de la 158 —que escribe un valor distinto por fila—, aqui el valor es
    // el mismo para todas. El techo real medido son 14 gestiones por cierre.
    const escrituras = base.prisma.gestionOrden.updateMany.mock.calls;
    expect(escrituras).toHaveLength(1);
    expect((escrituras[0][0] as { where: { id: { in: string[] } } }).where.id.in).toEqual([
      G_DEV,
      G_REC,
      G_REP,
    ]);
  });

  it("R19: el `data` lleva EXACTAMENTE `confirmadaFisicaAt` y ninguna clave mas", async () => {
    const base = buildBase(gestiones());

    await aprobar(makeRepo(base.prisma), [G_DEV]);

    const { data } = base.prisma.gestionOrden.updateMany.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    // Money-neutral: ni montos, ni indemnizacion, ni pago, ni ingreso de bodega. Una clave.
    expect(Object.keys(data)).toEqual(["confirmadaFisicaAt"]);
    expect(data.confirmadaFisicaAt).toBeInstanceOf(Date);
  });

  it("un cierre SIN nada que confirmar no ejecuta la escritura (ni una consulta de mas)", async () => {
    const base = buildBase(gestiones());

    const res = await aprobar(makeRepo(base.prisma), []);

    expect(res).toBe("updated");
    expect(base.prisma.gestionOrden.updateMany).not.toHaveBeenCalled();
    expect(marcadas(base.filas)).toEqual([]);
  });
});

describe("238/R18 — las dos guardas del WHERE, con su caso testigo cada una", () => {
  it("TESTIGO del `cierreId`: una gestion de OTRO cierre no se marca, y la tx revierte", async () => {
    const base = buildBase(gestiones());

    // `g-otro-cierre` es `devuelta` y existe: lo unico que la separa es el cierre. Sin la guarda,
    // aprobar `c1` marcaria un paquete que pertenece a otro cierre y nadie lo notaria.
    await expect(aprobar(makeRepo(base.prisma), [G_DEV, G_OTRO_CIERRE])).rejects.toBeInstanceOf(
      ConfirmacionFisicaNoAplicableError,
    );

    const ajena = base.filas.find((g) => g.id === G_OTRO_CIERRE);
    expect(ajena?.confirmadaFisicaAt).toBeNull();
  });

  it("TESTIGO del `resultado`: un INCIDENTE del MISMO cierre no se marca, y la tx revierte", async () => {
    const base = buildBase(gestiones());

    // `g-inc` es del cierre `c1`: solo lo separa su resultado. Su paquete no vuelve —se
    // indemniza—, asi que marcarlo seria declarar que bodega tuvo delante algo que se perdio.
    await expect(aprobar(makeRepo(base.prisma), [G_DEV, G_INC])).rejects.toBeInstanceOf(
      ConfirmacionFisicaNoAplicableError,
    );

    const incidente = base.filas.find((g) => g.id === G_INC);
    expect(incidente?.confirmadaFisicaAt).toBeNull();
  });

  it("R18: `count` insuficiente LANZA (una gestion inexistente basta)", async () => {
    const base = buildBase(gestiones());

    await expect(aprobar(makeRepo(base.prisma), [G_DEV, "g-que-no-existe"])).rejects.toBeInstanceOf(
      ConfirmacionFisicaNoAplicableError,
    );
  });

  it("R18: al lanzar, NADA de la aprobacion queda aplicado (la tx revierte entera)", async () => {
    // ⏳ 2026-09-23 (FICHA 454): antes la orden estaba en el pre-estado y el ANCLAJE (239) iba
    // DESPUES de este bloque, asi que «ni siquiera corria». Con la 454 la APLICACION va ANTES
    // (design §7.1); lo que protege R18 es que el error propaga y la `$transaction` real revierte
    // TODO —feeds, aprobacion y aplicacion—, cosa que este doble no emula y que se mide contra
    // Postgres en `tests/integration/db/454/aplicacion-al-aprobar-sql-real.test.ts` (R11). Aqui el
    // corpus es LEGADO (sin evento de registro): la aplicacion no toca nada y la orden sigue igual.
    const base = buildBase(gestiones(), { "o-dev": idEstado("en_reparto") });
    const repo = makeRepo(base.prisma);

    await expect(aprobar(repo, [G_DEV, G_INC])).rejects.toBeInstanceOf(
      ConfirmacionFisicaNoAplicableError,
    );

    expect(base.ordenes["o-dev"]).toBe(idEstado("en_reparto"));
    expect(base.prisma.ordenHistorialEstado.createMany).not.toHaveBeenCalled();
  });
});

describe("238/R24 — un RECHAZO no escribe ninguna marca", () => {
  it("rechazar no ejecuta el bloque (vive dentro de la rama `aprobado`)", async () => {
    const base = buildBase(gestiones());

    const res = await makeRepo(base.prisma).resolverCierre({
      cierreId: "c1",
      alcance: ALCANCE_MAESTRO,
      nuevoEstado: "rechazado",
      resueltoPor: "adm-maestro",
      motivoRechazo: "faltan paquetes",
    });

    expect(res).toBe("updated");
    expect(base.prisma.gestionOrden.updateMany).not.toHaveBeenCalled();
    expect(marcadas(base.filas)).toEqual([]);
    // Ademas de este caso, el TIPO lo impide: `confirmacionFisica?: never` en la rama
    // `rechazado` hace que pasarlo NO COMPILE. Los dos candados dicen lo mismo.
  });
});

describe("238/R22/R25 — un cierre que no se aprueba no marca nada", () => {
  it("guardia del cierre perdida (`count = 0`): `conflict` y ni una marca", async () => {
    const base = buildBase(gestiones());
    // El cierre ya no estaba `solicitado` (segunda aprobacion, carrera o doble submit): el
    // `updateMany` del propio cierre devuelve 0 y la rama entera no corre. La idempotencia no la
    // da un `if`, la da esa guarda — no hay codigo de idempotencia en este bloque y no hace falta.
    base.prisma.cierreDia.updateMany.mockResolvedValue({ count: 0 });

    const res = await aprobar(makeRepo(base.prisma), [G_DEV, G_REC, G_REP]);

    expect(res).toBe("conflict");
    expect(base.prisma.gestionOrden.updateMany).not.toHaveBeenCalled();
    expect(marcadas(base.filas)).toEqual([]);
  });
});

// ⏳ 2026-09-23 (FICHA 454, T1.7): el ANCLAJE de la 239 (`devolucion_por_confirmar -> devuelta`) se
// generaliza a la APLICACION de las gestiones de calle al aprobar: la orden de una devolucion del
// modelo nuevo sigue `en_reparto` hasta aqui y la aprobacion la lleva a `devuelta`. La invariante
// de la 238 se conserva tal cual: toda devolucion APLICADA fue confirmada en la MISMA tx, antes.
/** El corpus de siempre, con la devolucion `g-dev` registrada por el modelo nuevo (454). */
function gestionesConDevolucionNueva(): GestionFila[] {
  return gestiones().map((g) => (g.id === G_DEV ? { ...g, registrada: true } : g));
}

describe("238/R23 — la invariante que cruza 238 y 239 (454: aplicacion)", () => {
  it("toda gestion APLICADA quedo confirmada en la MISMA transaccion", async () => {
    // `o-dev` esta `en_reparto` con su devolucion pendiente: la aprobacion la aplica a `devuelta`.
    // Su gestion `g-dev` es la que bodega confirmo unas lineas antes, en la misma tx.
    const base = buildBase(gestionesConDevolucionNueva(), { "o-dev": idEstado("en_reparto") });

    const res = await aprobar(makeRepo(base.prisma), [G_DEV, G_REC, G_REP]);

    expect(res).toBe("updated");
    // (1) La aplicacion ocurrio: la orden se movio y dejo su fila de historial.
    expect(base.ordenes["o-dev"]).toBe(APLICACION_GESTIONES.destinoPorResultado.novedad);
    expect(base.prisma.ordenHistorialEstado.createMany).toHaveBeenCalledTimes(1);

    // (2) LA INVARIANTE: las gestiones que produjeron ese anclaje estan TODAS confirmadas. No se
    // deduce del codigo en una revision — se afirma aqui. Y el bloque de anclaje NO se toca: no
    // se le anade una guarda por `confirmada_fisica_at`, porque un segundo criterio puede
    // divergir del primero y el primero ya es imposible de saltarse.
    const anclaje = base.prisma.ordenHistorialEstado.createMany.mock.calls[0][0] as {
      data: Array<{ gestionOrdenId?: string }>;
    };
    const gestionesAncladas = anclaje.data.map((f) => f.gestionOrdenId);
    expect(gestionesAncladas).toEqual([G_DEV]);
    for (const gestionId of gestionesAncladas) {
      const fila = base.filas.find((g) => g.id === gestionId);
      expect(fila?.confirmadaFisicaAt, `${gestionId} se anclo SIN confirmar`).not.toBeNull();
    }
  });

  // ⏳ 2026-09-23 (FICHA 454, design §7.1 y §16 «rojos esperados»): este caso decia «la marca se
  // escribe ANTES del anclaje» y afirmaba `["confirmar", "anclar"]`. La 454 muda la aplicacion
  // ANTES de la devolucion de rechazadas (R10: una orden que queda `rechazada` en esta aprobacion
  // tiene que llegar a `por_devolver*` en la MISMA), y la confirmacion fisica sigue donde estaba,
  // despues de la 139. El orden pasa a ser `["anclar", "confirmar"]`, DENTRO de la misma tx: la
  // invariante que importa —toda devolucion aplicada queda confirmada o la tx entera revierte— la
  // mide el caso de arriba. Corrida del test viejo contra el codigo nuevo:
  // `expected [ 'anclar', 'confirmar' ] to deeply equal [ 'confirmar', 'anclar' ]`.
  it("454: la aplicacion va ANTES de la marca, las dos en la MISMA tx (orden de §7.1)", async () => {
    const base = buildBase(gestionesConDevolucionNueva(), { "o-dev": idEstado("en_reparto") });
    const orden: string[] = [];
    const marcar = base.prisma.gestionOrden.updateMany.getMockImplementation();
    base.prisma.gestionOrden.updateMany.mockImplementation(
      async (args: Parameters<typeof base.prisma.gestionOrden.updateMany>[0]) => {
        orden.push("confirmar");
        return marcar ? marcar(args) : { count: 0 };
      },
    );
    // FICHA 454: la aplicacion escribe por `$queryRaw` (UPDATE … RETURNING), no por `updateMany`.
    const aplicar = base.prisma.$queryRaw.getMockImplementation();
    base.prisma.$queryRaw.mockImplementation(async (...c: unknown[]) => {
      if ((c[0] as readonly string[]).join(" ").includes('UPDATE "orden" SET "estatus_id" =')) {
        orden.push("anclar");
      }
      return aplicar ? aplicar(...c) : [];
    });

    await aprobar(makeRepo(base.prisma), [G_DEV]);

    expect(orden).toEqual(["anclar", "confirmar"]);
  });
});

describe("238/R44 — el error no filtra PII", () => {
  it("el mensaje lleva SOLO el id del cierre", () => {
    const error = new ConfirmacionFisicaNoAplicableError("c1");
    expect(error.message).toBe("confirmacion fisica no aplicable a una gestion del cierre c1");
    expect(error.name).toBe("ConfirmacionFisicaNoAplicableError");
    // Ni gestiones, ni guias, ni destinatarios, ni actores: patron `IndemnizacionNoAplicableError`.
    expect(error.message).not.toMatch(/g-dev|g-inc|9001|adm-maestro|destinatario/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// FICHA 497 (T3.2/T3.3, R5-R9, R22-R24, R27, R28) — LAS BARRIDAS: lectura y marca.
//
// Mismo criterio que arriba: el doble de `cierreSinGestion` HONRA el `where` (cierre, orden y
// alcance por la relacion), asi que quitar una condicion cambia lo que se lee o se escribe.
// ════════════════════════════════════════════════════════════════════════════════════════════════

interface BarridaFila {
  cierreId: string;
  ordenId: string;
  numGuia: number | null;
  numRemision: string;
  confirmadaFisicaAt: Date | null;
  cierre: { destinoTipo: "bodega_central" | "bodega_satelite"; destinoZonaId: string };
}

const ZONA_CENTRAL = "z-central";
const ZONA_SAT = "z-sat";

/** `c1` (central) con dos barridas; `c2` (central) con una; `c3` (satelite) con una. */
function barridas(): BarridaFila[] {
  const central = { destinoTipo: "bodega_central" as const, destinoZonaId: ZONA_CENTRAL };
  const sat = { destinoTipo: "bodega_satelite" as const, destinoZonaId: ZONA_SAT };
  const base = { confirmadaFisicaAt: null };
  return [
    { cierreId: "c1", ordenId: "o-b1", numGuia: 7001, numRemision: "R-B1", cierre: central, ...base },
    { cierreId: "c1", ordenId: "o-b2", numGuia: null, numRemision: "R-B2", cierre: central, ...base },
    { cierreId: "c2", ordenId: "o-b-otro", numGuia: 7003, numRemision: "R-B3", cierre: central, ...base },
    { cierreId: "c3", ordenId: "o-b-sat", numGuia: 7004, numRemision: "R-B4", cierre: sat, ...base },
  ];
}

interface WhereBarrida {
  cierreId?: string;
  ordenId?: { in?: string[] };
  cierre?: { destinoTipo?: string; destinoZonaId?: string };
}

function casaBarrida(b: BarridaFila, where: WhereBarrida): boolean {
  return (
    (where.cierreId === undefined || b.cierreId === where.cierreId) &&
    (where.ordenId?.in === undefined || where.ordenId.in.includes(b.ordenId)) &&
    (where.cierre?.destinoTipo === undefined || b.cierre.destinoTipo === where.cierre.destinoTipo) &&
    (where.cierre?.destinoZonaId === undefined || b.cierre.destinoZonaId === where.cierre.destinoZonaId)
  );
}

/** La base de arriba + `cierre_sin_gestion` en memoria. */
function buildBaseConBarridas(filasBarrida: BarridaFila[] = barridas()) {
  const base = buildBase(gestiones());
  const cierreSinGestion = {
    findMany: vi.fn(async ({ where }: { where: WhereBarrida; select: unknown }) =>
      filasBarrida
        .filter((b) => casaBarrida(b, where))
        .map((b) => ({ ordenId: b.ordenId, numGuia: b.numGuia })),
    ),
    updateMany: vi.fn(
      async ({ where, data }: { where: WhereBarrida; data: Record<string, unknown> }) => {
        let count = 0;
        for (const b of filasBarrida) {
          if (!casaBarrida(b, where)) continue;
          Object.assign(b, data);
          count += 1;
        }
        return { count };
      },
    ),
  };
  return { ...base, prisma: { ...base.prisma, cierreSinGestion }, barridas: filasBarrida, cierreSinGestion };
}

function barridasMarcadas(filas: BarridaFila[]): string[] {
  return filas
    .filter((b) => b.confirmadaFisicaAt !== null)
    .map((b) => `${b.cierreId}:${b.ordenId}`)
    .sort();
}

function aprobarCon(
  repo: CierresAdminRepository,
  confirmacionFisica: Array<{ gestionId: string } | { ordenId: string }>,
  cierreId = "c1",
) {
  return repo.resolverCierre({
    cierreId,
    alcance: ALCANCE_MAESTRO,
    nuevoEstado: "aprobado",
    resueltoPor: "adm-maestro",
    motivoRechazo: null,
    aplicacionGestiones: APLICACION_GESTIONES,
    confirmacionFisica,
  });
}

describe("497/R5-R9 — findBarridasDelCierre", () => {
  it("R5/R8: devuelve TODAS las barridas de ESTE cierre y ninguna de otro", async () => {
    const base = buildBaseConBarridas();

    const r = await makeRepo(base.prisma).findBarridasDelCierre("c1", ALCANCE_MAESTRO);

    expect(r).toEqual([
      { ordenId: "o-b1", numGuia: 7001 },
      { ordenId: "o-b2", numGuia: null },
    ]);
  });

  it("R6/R7: el WHERE lleva el cierre y el ALCANCE por la relacion; el select, la guia CONGELADA", async () => {
    const base = buildBaseConBarridas();

    await makeRepo(base.prisma).findBarridasDelCierre("c1", ALCANCE_MAESTRO);

    const arg = base.cierreSinGestion.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ cierreId: "c1", cierre: { destinoTipo: "bodega_central" } });
    // La guia sale de `cierre_sin_gestion.num_guia` (la congelada), no de la orden viva: el
    // `select` no navega a `orden` ni lee su estatus.
    expect(arg.select).toEqual({ ordenId: true, numGuia: true });
  });

  it("R7: un cierre FUERA de alcance devuelve `[]`, indistinguible de uno inexistente", async () => {
    const base = buildBaseConBarridas();
    const repo = makeRepo(base.prisma);
    const otraSatelite = { destinoTipo: "bodega_satelite" as const, destinoZonaId: "z-otra" };

    expect(await repo.findBarridasDelCierre("c3", otraSatelite)).toEqual([]);
    expect(await repo.findBarridasDelCierre("c-inexistente", otraSatelite)).toEqual([]);
    // Y en SU alcance si la ve: el `[]` de arriba lo produce el alcance, no un doble mudo.
    expect(
      await repo.findBarridasDelCierre("c3", { destinoTipo: "bodega_satelite", destinoZonaId: ZONA_SAT }),
    ).toEqual([{ ordenId: "o-b-sat", numGuia: 7004 }]);
  });

  it("R9: un cierre sin barridas registradas devuelve `[]`", async () => {
    const base = buildBaseConBarridas([]);

    expect(await makeRepo(base.prisma).findBarridasDelCierre("c1", ALCANCE_MAESTRO)).toEqual([]);
  });
});

describe("497/R22-R24 — la marca de las barridas en la MISMA transaccion", () => {
  it("R22: marca EXACTAMENTE las barridas confirmadas del cierre, en UNA escritura", async () => {
    const base = buildBaseConBarridas();

    const res = await aprobarCon(makeRepo(base.prisma), [{ ordenId: "o-b1" }, { ordenId: "o-b2" }]);

    expect(res).toBe("updated");
    expect(barridasMarcadas(base.barridas)).toEqual(["c1:o-b1", "c1:o-b2"]);
    expect(base.cierreSinGestion.updateMany).toHaveBeenCalledTimes(1);
    const { where } = base.cierreSinGestion.updateMany.mock.calls[0][0];
    expect(where).toEqual({ cierreId: "c1", ordenId: { in: ["o-b1", "o-b2"] } });
  });

  it("R24: el `data` lleva EXACTAMENTE `confirmadaFisicaAt` (ni dinero ni datos congelados)", async () => {
    const base = buildBaseConBarridas();

    await aprobarCon(makeRepo(base.prisma), [{ ordenId: "o-b1" }]);

    const { data } = base.cierreSinGestion.updateMany.mock.calls[0][0];
    expect(Object.keys(data)).toEqual(["confirmadaFisicaAt"]);
    expect(data.confirmadaFisicaAt).toBeInstanceOf(Date);
    const b1 = base.barridas.find((b) => b.ordenId === "o-b1");
    expect(b1).toMatchObject({ numGuia: 7001, numRemision: "R-B1", cierreId: "c1" });
  });

  it("mezcla: cada origen va a SU tabla, y ninguna escritura recibe claves del otro", async () => {
    const base = buildBaseConBarridas();

    const res = await aprobarCon(makeRepo(base.prisma), [
      { gestionId: G_DEV },
      { ordenId: "o-b1" },
      { gestionId: G_REC },
      { ordenId: "o-b2" },
    ]);

    expect(res).toBe("updated");
    const gestionWhere = base.prisma.gestionOrden.updateMany.mock.calls[0][0].where as WhereGestion;
    expect(gestionWhere.id?.in).toEqual([G_DEV, G_REC]);
    expect(base.cierreSinGestion.updateMany.mock.calls[0][0].where.ordenId).toEqual({
      in: ["o-b1", "o-b2"],
    });
    expect(marcadas(base.filas)).toEqual([G_DEV, G_REC].sort());
    expect(barridasMarcadas(base.barridas)).toEqual(["c1:o-b1", "c1:o-b2"]);
  });

  it("TESTIGO del `cierreId` de la barrida: una barrida de OTRO cierre no se marca, y la tx revierte", async () => {
    const base = buildBaseConBarridas();

    // `o-b-otro` es barrida de `c2`. Sin la guarda del cierre, el `count` cuadraria (2 de 2) y
    // aprobar `c1` marcaria un paquete de otro cierre.
    await expect(
      aprobarCon(makeRepo(base.prisma), [{ ordenId: "o-b1" }, { ordenId: "o-b-otro" }]),
    ).rejects.toBeInstanceOf(ConfirmacionFisicaNoAplicableError);

    expect(base.barridas.find((b) => b.ordenId === "o-b-otro")?.confirmadaFisicaAt).toBeNull();
  });

  it("R23: `count` corto LANZA (una barrida inexistente basta)", async () => {
    const base = buildBaseConBarridas();

    await expect(
      aprobarCon(makeRepo(base.prisma), [{ ordenId: "o-b1" }, { ordenId: "o-que-no-existe" }]),
    ).rejects.toBeInstanceOf(ConfirmacionFisicaNoAplicableError);
  });

  it("sin barridas confirmadas NO se escribe la tabla (solo gestiones, o nada)", async () => {
    const base = buildBaseConBarridas();

    await aprobarCon(makeRepo(base.prisma), [{ gestionId: G_DEV }]);
    await aprobarCon(makeRepo(base.prisma), []);

    expect(base.cierreSinGestion.updateMany).not.toHaveBeenCalled();
  });
});

describe("497/R27/R28 — ni un rechazo ni un cierre ya resuelto marcan barridas", () => {
  it("R28: rechazar no escribe la marca de las barridas", async () => {
    const base = buildBaseConBarridas();

    const res = await makeRepo(base.prisma).resolverCierre({
      cierreId: "c1",
      alcance: ALCANCE_MAESTRO,
      nuevoEstado: "rechazado",
      resueltoPor: "adm-maestro",
      motivoRechazo: "faltan paquetes",
    });

    expect(res).toBe("updated");
    expect(base.cierreSinGestion.updateMany).not.toHaveBeenCalled();
    expect(barridasMarcadas(base.barridas)).toEqual([]);
  });

  it("R27: un cierre ya aprobado (`count = 0` en la transicion) no reescribe la marca", async () => {
    const base = buildBaseConBarridas();
    base.prisma.cierreDia.updateMany.mockResolvedValue({ count: 0 });

    const res = await aprobarCon(makeRepo(base.prisma), [{ ordenId: "o-b1" }]);

    expect(res).toBe("conflict");
    expect(base.cierreSinGestion.updateMany).not.toHaveBeenCalled();
    expect(barridasMarcadas(base.barridas)).toEqual([]);
  });
});
