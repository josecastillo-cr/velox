import { appendAccion, resolverActorCongelado } from "@/lib/repositories/registrar-accion";
import { etiquetaDeEntidad } from "@/lib/types/historial-accion-etiquetas";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  CierreBodegaDetalleCierreRow,
  CorregirConciliacionInput,
  ICierresBodegaAdminRepository,
  MarcaConciliacionResult,
  MarcarConciliadoInput,
  ResolverCierreBodegaInput,
  ResolverCierreBodegaResult,
  RevertirConciliacionInput,
  RevertirConciliacionResult,
} from "@/lib/interfaces/repositories/ICierresBodegaAdminRepository";
import {
  asentarCierreDia,
  dependenciasRealesDeAsiento,
  type AsientoPrismaClient,
  type DependenciasAsiento,
} from "@/lib/repositories/asentar-cierre-dia";
import type { CrearMovimientoInput } from "@/lib/interfaces/repositories/IWalletMovimientoRepository";
import { aporteDeConsolidacion, esSaldadaReglaAnterior, puedeDesmarcarse } from "@/lib/utils/conciliacion-satelite";
import {
  consolidacionesConDinero,
  type ClienteConDinero,
} from "@/lib/repositories/consolidaciones-con-dinero";
import type { CierreBodegaResumenRow } from "@/lib/interfaces/repositories/ICierreBodegaRepository";
import type { CierreGestionPendienteRow } from "@/lib/interfaces/repositories/ICierreDiaRepository";
import {
  BODEGA_RESUMEN_SELECT,
  toBodegaResumenRow,
} from "@/lib/repositories/CierreBodegaRepository";
// Feature 69/T23 (R15): se reusan las MISMAS piezas que compone T18 en `CierresAdminRepository`
// (proyeccion + mapper), no una copia: las dos pantallas de admin muestran el detalle del mismo
// cierre_dia ya creado y tienen que salir del mismo sitio o divergen.
// Feature 230 (T7.1, R26): + las CUATRO piezas de la hoja fundida (proyeccion, snapshot con su
// clave de join, orden y recortes) y su compositor. Mismo motivo llevado al extremo: los DOS
// caminos de la descarga detallada tienen que emitir la MISMA fila desde la MISMA declaracion,
// asi que ninguno de ellos declara nada propio.
import {
  componerGestionesDescarga,
  DETALLE_ADMIN_SELECT,
  DETALLE_DESCARGA_SELECT,
  GESTION_ADMIN_SELECT,
  GESTION_DESCARGA_SELECT,
  ORDEN_GESTIONES_DESCARGA,
  filtrosWhere,
  toPendienteRowDesdeSnapshot,
} from "@/lib/repositories/CierresAdminRepository";
// FICHA 394 (2026-09-08): + el derivador EN LOTE de los intentos de entrega vigentes, el mismo
// que consumen la analitica y el tope de la 276. Se IMPORTA, no se reescribe: es el numero con
// el que el sistema cobra, y dos agregaciones «iguales» divergen a la primera correccion.
import { contarIntentosVigentesEnLoteCon } from "@/lib/repositories/OrdenHistorialRepository";
import type { CierreGestionDescargaDTO } from "@/lib/interfaces/services/ICierresAdminService";
import type { FiltrosDescargaGestiones } from "@/lib/types/filtros-cierres";
import { CierreDetalleFaltanteError } from "@/lib/utils/cierre-detalle";
import { ESTADOS_COLA_SOLICITADO } from "@/lib/utils/colas-cierre";
import type { PaginaRepositorio, RangoPagina } from "@/lib/utils/rango-pagina";
import type { FiltrosCierresBodega } from "@/lib/types/filtros-cierres";
import {
  inicioDelDiaCREnUtc,
  inicioDelDiaSiguienteCREnUtc,
} from "@/lib/utils/fecha-cr";
import { NOMBRE_USUARIO_SELECT, nombreCompletoUsuario } from "@/lib/utils/nombre-usuario";

// Solo el estado que la 40 puede transicionar (R18): la guardia del updateMany.
const ESTADO_SOLICITADO = "solicitado";
// FICHA 431: el otro lado de la marca. `aprobado` se LEE «Recibido» (D2/D3: el enum `cierre_estado`
// NO se toca, lo comparten `cierre_dia` y `cierre_bodega`).
const ESTADO_APROBADO = "aprobado";

// Feature 69/T23: el detalle sale del SNAPSHOT -> el cliente necesita `cierreDetail`.
// FICHA 498 (design §4.3): + lo que necesitan los repositorios REALES de los tres libros, que este
// repositorio construye por defecto para asentar al conciliar (R6).
type CierresBodegaAdminPrismaClient = Pick<
  PrismaClient,
  | "cierreBodega"
  | "cierreDia"
  | "gestionOrden"
  | "cierreDetail"
  // Ficha 362 (R9): la resolucion pasa a `$transaction` y registra su accion en ella.
  | "$transaction"
  | "historialAccion"
  | "usuario"
  | "zona"
> &
  AsientoPrismaClient &
  // FICHA 500 (R1/R3): el detalle calcula `puedeDesmarcar` con `consolidacionesConDinero`.
  ClienteConDinero;

type TxConciliacion = Prisma.TransactionClient;

/** FICHA 498: el snapshot del que sale el aporte reconocido de una consolidacion (§4.4). */
const APORTE_SELECT = {
  totalGeneral: true,
  totalPagoMensajero: true,
  totalIngresoBodegaRechazos: true,
  esperadoReglaAnterior: true,
} as const;

// Proyeccion de la cabecera de un cierre_dia incluido en el detalle (mensajero +
// totales snapshot).
const DETALLE_CIERRE_SELECT = {
  id: true,
  mensajeroId: true,
  totalEfectivo: true,
  totalSimpe: true,
  totalTransferencia: true,
  totalGeneral: true,
  totalPagoMensajero: true, // feature 39/R20: snapshot del pago al mensajero del cierre_dia
  totalIngresoBodegaRechazos: true, // feature 56/R19: snapshot del ingreso de bodega por rechazos del cierre_dia
  mensajero: { select: NOMBRE_USUARIO_SELECT },
} as const;

type DetalleCierreRow = Prisma.CierreDiaGetPayload<{ select: typeof DETALLE_CIERRE_SELECT }>;

function toDetalleCierreRow(r: DetalleCierreRow): CierreBodegaDetalleCierreRow {
  return {
    cierreDiaId: r.id,
    mensajeroId: r.mensajeroId,
    mensajeroNombre: nombreCompletoUsuario(r.mensajero),
    totales: {
      efectivo: r.totalEfectivo.toFixed(2),
      simpe: r.totalSimpe.toFixed(2),
      transferencia: r.totalTransferencia.toFixed(2),
      general: r.totalGeneral.toFixed(2),
    },
    totalPagoMensajero: r.totalPagoMensajero.toFixed(2), // R20: snapshot money-safe STRING
    totalIngresoBodegaRechazos: r.totalIngresoBodegaRechazos.toFixed(2), // feature 56/R19: snapshot money-safe STRING
  };
}

/**
 * Feature 184 — Tanda E (R16) — el ORDEN de los cierres de bodega del admin, declarado UNA vez.
 *
 * Lo comparten los CINCO caminos que leen esta tabla desde este repositorio: el listado sin
 * paginar, las dos paginas (cola e historico) y los dos CONJUNTOS de los que salen los archivos.
 * Estaba escrito TRES veces —una por metodo— y la tanda E habria sumado dos copias mas.
 *
 * No es simetria: en cuanto un archivo depende de estos conjuntos, si su orden diverge del de la
 * pagina, la fila 26 del archivo deja de ser la primera de la pagina 2 (R5) y no hay ninguna
 * pantalla que lo diga. Una sola declaracion tampoco lo vuelve invisible: los casos de los
 * `*-where.test.ts` fijan el valor ABSOLUTO, asi que cambiar la constante los pone rojos.
 */
/**
 * Pedido humano del 2026-08-16 — el WHERE de los FILTROS de estos listados (fecha + zona),
 * declarado UNA vez para los cuatro caminos: las dos paginas y los dos conjuntos del archivo.
 *
 * SIN MENSAJERO, y no es un recorte de alcance sino de datos: un cierre de bodega consolida los
 * cierres del dia de VARIOS mensajeros, asi que «el mensajero de este cierre» no es una pregunta
 * con respuesta. La columna no existe.
 *
 * Las fechas son de CALENDARIO DE COSTA RICA: `solicitadoAt` es un instante, y «del 1 al 3»
 * significa desde el inicio del 1 en CR hasta el inicio del 4 en CR. Por eso el limite superior
 * es `lt` del dia SIGUIENTE y no `lte` del mismo dia — con `lte` se perderian los cierres
 * solicitados entre las 00:00 y las 23:59:59.999 del ultimo dia del rango, que es justo el dia
 * que el usuario acaba de pedir. Es el MISMO criterio que `CierresAdminRepository.filtrosWhere`,
 * escrito aparte porque la tabla y sus columnas son otras.
 */
function filtrosBodegaWhere(
  filtros: FiltrosCierresBodega | undefined,
): Prisma.CierreBodegaWhereInput[] {
  if (!filtros) return [];
  const condiciones: Prisma.CierreBodegaWhereInput[] = [];
  if (filtros.desde !== undefined || filtros.hasta !== undefined) {
    condiciones.push({
      solicitadoAt: {
        ...(filtros.desde !== undefined ? { gte: inicioDelDiaCREnUtc(filtros.desde) } : {}),
        ...(filtros.hasta !== undefined
          ? { lt: inicioDelDiaSiguienteCREnUtc(filtros.hasta) }
          : {}),
      },
    });
  }
  if (filtros.destinoZonaIds !== undefined) {
    condiciones.push({ zonaId: { in: [...filtros.destinoZonaIds] } });
  }
  return condiciones;
}

const ORDEN_CIERRES_BODEGA_ADMIN = {
  solicitadoAt: "desc",
} as const satisfies Prisma.CierreBodegaOrderByWithRelationInput;

/**
 * Feature 184 — Tanda E (R16) — el criterio del HISTORICO (cierres de bodega ya RESUELTOS),
 * declarado UNA vez para su pagina y para su conjunto.
 *
 * R44 de la 170 sigue vigente y es el motivo del `notIn`: es el espejo EXACTO del `else` con que
 * el servicio manda al historico todo lo que no esta en la cola. Con un `in: ["aprobado"]` un
 * cierre de bodega RECHAZADO —o cualquier estado nuevo del enum— desapareceria de las dos listas
 * en vez de caer en el historico.
 */
function historicoBodegaWhere(
  filtros?: FiltrosCierresBodega,
): Prisma.CierreBodegaWhereInput {
  const recortes = filtrosBodegaWhere(filtros);
  return {
    estado: { notIn: [...ESTADOS_COLA_SOLICITADO] },
    // Sin filtros no se escribe `AND`: el criterio queda IDENTICO al de antes del 2026-08-16,
    // y los `*-where.test.ts` que fijan su valor absoluto siguen valiendo sin tocarlos.
    ...(recortes.length > 0 ? { AND: recortes } : {}),
  };
}

/**
 * Feature 184 — Tanda E (R16) — el criterio de la COLA de pendientes, declarado UNA vez para su
 * pagina y para su conjunto.
 *
 * COMPLEMENTO EXACTO del de arriba: la MISMA constante de estados, aqui con `in` (el espejo del
 * `if` del servicio) y alli con `notIn`. Que las dos mitades lean la misma constante es lo que
 * garantiza que ninguna fila quede en las dos listas ni se caiga de las dos — y aqui «caerse»
 * significa que un cierre de bodega deja de verse para aprobarlo, con el dinero agregado de una
 * zona entera parado hasta que alguien lo note.
 */
function colaBodegaWhere(filtros?: FiltrosCierresBodega): Prisma.CierreBodegaWhereInput {
  const recortes = filtrosBodegaWhere(filtros);
  return {
    estado: { in: [...ESTADOS_COLA_SOLICITADO] },
    ...(recortes.length > 0 ? { AND: recortes } : {}),
  };
}

/**
 * Feature 40 — repositorio de "Cierres de bodega" del maestro. SOLO queries Prisma. El
 * maestro NO se acota por zona (todo va a la central). Reusa BODEGA_RESUMEN_SELECT /
 * toBodegaResumenRow (cabecera). `resolverCierreBodega` es un unico UPDATE guardado por
 * estado; NO toca cierre_dia ni otra tabla (R21/R22).
 *
 * Feature 69/T23 (R15): el detalle de las gestiones ya NO reusa WITH_DETALLE / toPendienteRow
 * de la 37 (que leen la orden VIVA y siguen siendo correctos para la vista EN VIVO de
 * gestiones sin cierre); sale del SNAPSHOT `cierre_detail` con las mismas piezas que T18.
 */
export class CierresBodegaAdminRepository implements ICierresBodegaAdminRepository {
  /**
   * FICHA 498 (design §4.3, R6): las dependencias del asiento tienen VALOR POR DEFECTO, las reales.
   * Los dos composition roots (`lib/actions/conciliacion-satelites.ts` y `lib/actions/cierre-bodega.ts`)
   * construyen con `prisma` y nada mas: si las dependencias fueran obligatorias, un tercer
   * constructor que las olvidara dejaria la marca muda con la suite verde (memoria «el composition
   * root que no inyecta»). Lo mide `498-composition-root-asiento.int.test.ts` contando FILAS.
   */
  constructor(
    private readonly prisma: CierresBodegaAdminPrismaClient,
    private readonly depsAsiento: DependenciasAsiento = dependenciasRealesDeAsiento(prisma),
  ) {}

  /** R15: todos los cierres de bodega, mas reciente primero, totales -> STRING. */
  async findCierresBodega(): Promise<CierreBodegaResumenRow[]> {
    const rows = await this.prisma.cierreBodega.findMany({
      orderBy: ORDEN_CIERRES_BODEGA_ADMIN,
      select: BODEGA_RESUMEN_SELECT,
    });
    return rows.map(toBodegaResumenRow);
  }

  /**
   * Feature 184 — Tanda E (T E.1, R1/R14/R15/R16) — el HISTORICO ENTERO, sin recorte: el conjunto
   * del que sale el archivo de «Cierres de bodega resueltos» (listado 5).
   *
   * **Por que existe, y por que no bastaba reusar.** Hasta hoy ese archivo se producia releyendo
   * `listarCierresBodegaAdmin()`, que llama a `findCierresBodega`: TODOS los cierres de bodega,
   * cola e historico juntos, para quedarse con una de las dos mitades. `findCierresBodega` NO se
   * puede reusar aqui —a diferencia de lo que pasaba en las tandas B y C, donde el conjunto ya
   * existia— porque no es este conjunto: es su union con el de la cola. Y cada fila de mas no es
   * gratis: `BODEGA_RESUMEN_SELECT` lleva dos joins de nombre y un `_count` de `cierresDia`.
   *
   * Es `findHistoricoPaginado` sin `skip`/`take` y sin el `count`: MISMO `historicoBodegaWhere` y
   * MISMO `ORDEN_CIERRES_BODEGA_ADMIN` (R16), de una sola declaracion cada uno, para que la
   * pagina N sea el segmento N de este conjunto (R5). UNA consulta y ninguna mas (R15): el
   * `count` de la pagina no viaja aqui, porque el total de un conjunto sin recorte es su longitud.
   */
  async findHistoricoCompleto(
    filtros?: FiltrosCierresBodega,
  ): Promise<CierreBodegaResumenRow[]> {
    const rows = await this.prisma.cierreBodega.findMany({
      where: historicoBodegaWhere(filtros),
      orderBy: ORDEN_CIERRES_BODEGA_ADMIN,
      select: BODEGA_RESUMEN_SELECT,
    });
    return rows.map(toBodegaResumenRow);
  }

  /**
   * Feature 184 — Tanda E (T E.1, R1/R14/R15/R16) — la COLA ENTERA de pendientes, sin recorte:
   * el conjunto del que sale el archivo de «Cierres de bodega pendientes» (listado 4).
   *
   * Espejo exacto del de arriba, y con el mismo motivo para existir. Aqui se nota mas: la cola
   * son los cierres SIN resolver —una decena— y el historico crece sin tope con los dias, asi que
   * descargar la cola arrastraba todo el historico de la operacion para descartarlo en memoria.
   *
   * La particion sigue viva en los CUATRO caminos: `colaBodegaWhere` e `historicoBodegaWhere`
   * leen la MISMA `ESTADOS_COLA_SOLICITADO`, una con `in` y otra con `notIn`, y las dos paginas y
   * los dos conjuntos salen de esas dos funciones. Ninguna fila puede quedar en las dos listas ni
   * caerse de las dos.
   */
  async findColaCompleta(
    filtros?: FiltrosCierresBodega,
  ): Promise<CierreBodegaResumenRow[]> {
    const rows = await this.prisma.cierreBodega.findMany({
      where: colaBodegaWhere(filtros),
      orderBy: ORDEN_CIERRES_BODEGA_ADMIN,
      select: BODEGA_RESUMEN_SELECT,
    });
    return rows.map(toBodegaResumenRow);
  }

  /**
   * Feature 170 — FASE 2 (T I.1, R40/R41/R44/R51/R54): una pagina del HISTORICO + el total.
   *
   * El `where` se construye UNA vez y lo comparten `findMany` y `count`: escribirlo dos veces
   * es como el total acaba contando un conjunto distinto del que se muestra.
   */
  async findHistoricoPaginado(
    rango: RangoPagina,
    filtros?: FiltrosCierresBodega,
  ): Promise<PaginaRepositorio<CierreBodegaResumenRow>> {
    // Feature 184/R16: el criterio sale de `historicoBodegaWhere`, la MISMA declaracion que usa
    // el conjunto completo del que sale el archivo. Estaba escrito aqui y habria que haberlo
    // escrito otra vez alli. R44 sigue siendo el motivo del `notIn`: con un
    // `in: ["aprobado","rechazado"]`, un estado nuevo del enum desapareceria de las dos listas.
    const where = historicoBodegaWhere(filtros);
    const [rows, total] = await Promise.all([
      this.prisma.cierreBodega.findMany({
        where,
        orderBy: ORDEN_CIERRES_BODEGA_ADMIN, // R51: el mismo criterio del listado sin paginar
        skip: rango.skip,
        take: rango.take,
        select: BODEGA_RESUMEN_SELECT,
      }),
      this.prisma.cierreBodega.count({ where }), // R41: el total del CONJUNTO
    ]);
    return { items: rows.map(toBodegaResumenRow), total };
  }

  /**
   * Feature 170 — FASE 2 (T J.1, R40/R41/R44/R51/R54): una pagina de la COLA de cierres de
   * bodega pendientes + el total.
   *
   * COMPLEMENTO EXACTO de `findHistoricoPaginado`: la misma constante
   * (`ESTADOS_COLA_SOLICITADO`), aqui con `in` —el espejo del `if` del servicio— y alli con
   * `notIn` —el del `else`—. Leer las dos de la misma lista es lo que impide que un estado
   * nuevo del enum acabe en las dos colas o en ninguna.
   */
  async findColaPaginada(
    rango: RangoPagina,
    filtros?: FiltrosCierresBodega,
  ): Promise<PaginaRepositorio<CierreBodegaResumenRow>> {
    // Feature 184/R16: mismo criterio compartido que el conjunto completo de esta cola.
    const where = colaBodegaWhere(filtros);
    const [rows, total] = await Promise.all([
      this.prisma.cierreBodega.findMany({
        where,
        orderBy: ORDEN_CIERRES_BODEGA_ADMIN, // R51: el mismo criterio del listado sin paginar
        skip: rango.skip,
        take: rango.take,
        select: BODEGA_RESUMEN_SELECT,
      }),
      this.prisma.cierreBodega.count({ where }), // R41: el total del CONJUNTO
    ]);
    return { items: rows.map(toBodegaResumenRow), total };
  }

  /** R11 (+69/R15): cierre de bodega + cada cierre_dia con sus gestiones desde el SNAPSHOT. */
  async findCierreBodegaConDetalle(id: string): Promise<{
    cierre: CierreBodegaResumenRow;
    cierresDia: {
      resumen: CierreBodegaDetalleCierreRow;
      gestiones: CierreGestionPendienteRow[];
    }[];
    puedeDesmarcar: boolean;
  } | null> {
    const cierre = await this.prisma.cierreBodega.findUnique({
      where: { id },
      select: BODEGA_RESUMEN_SELECT,
    });
    if (cierre === null) return null; // R19: no existe

    // Los cierre_dia incluidos (WHERE cierre_bodega_id = id), mas reciente primero.
    const cierresDiaRows = await this.prisma.cierreDia.findMany({
      where: { cierreBodegaId: id },
      orderBy: { solicitadoAt: "desc" },
      select: DETALLE_CIERRE_SELECT,
    });

    // Por cada cierre_dia, sus gestiones (WHERE cierre_id = cierre_dia.id) compuestas con el
    // SNAPSHOT de ese cierre. Feature 69/T23 (R15): un cierre_dia consolidado en un
    // cierre_bodega esta YA CREADO (y normalmente ya aprobado y liquidado), asi que su detalle
    // son los datos CONGELADOS. Antes esto reusaba `WITH_DETALLE`, que navegaba
    // `gestion_orden.orden.*` VIVO: esta pantalla y la de `findCierreByIdEnAlcance` mostraban
    // detalle distinto del MISMO cierre. Mismo DTO que antes -> la UI no cambia.
    const cierresDia = await Promise.all(
      cierresDiaRows.map(async (cd) => {
        const [gestiones, detalle] = await Promise.all([
          this.prisma.gestionOrden.findMany({
            where: { cierreId: cd.id }, // R11: gestiones vinculadas a ESTE cierre_dia
            orderBy: { createdAt: "desc" },
            select: GESTION_ADMIN_SELECT,
          }),
          this.prisma.cierreDetail.findMany({
            where: { cierreId: cd.id }, // el snapshot de ESE cierre_dia
            select: DETALLE_ADMIN_SELECT,
          }),
        ]);
        // Grano: N gestiones de una orden comparten su UNICA fila congelada.
        const byOrden = new Map(detalle.map((d) => [d.ordenId, d]));
        return {
          resumen: toDetalleCierreRow(cd),
          // Sin fallback (R14/decision (a)): si falta la fila, error DURO. Igual que T18: un
          // fallback a datos vivos seria el camino de lectura que esta feature vino a matar.
          gestiones: gestiones.map((g) => {
            const d = byOrden.get(g.ordenId);
            if (d === undefined) throw new CierreDetalleFaltanteError(cd.id, g.ordenId);
            return toPendienteRowDesdeSnapshot(g, d);
          }),
        };
      }),
    );

    // ⭑ FICHA 500 (R3/R4): «Desmarcar» con el MISMO criterio que `revertirConciliacion`.
    const resumen = toBodegaResumenRow(cierre);
    const conDinero = (await consolidacionesConDinero(this.prisma, [id])).has(id);
    const puedeDesmarcar = puedeDesmarcarse({
      conciliado: resumen.conciliado,
      conDinero,
      saldadaReglaAnterior: resumen.saldadaReglaAnterior,
    });
    return { cierre: resumen, cierresDia, puedeDesmarcar };
  }

  /**
   * Feature 230 — Tanda 7 (T7.1, R11/R24/R26/R41) — TODAS las gestiones de los cierres del dia
   * YA CONSOLIDADOS en un cierre de bodega que casan los recortes del dialogo.
   *
   * `cierreBodegaId: { not: null }` es la traduccion EXACTA de R24 («las gestiones de los cierres
   * del dia consolidados en un cierre de bodega, y ninguna otra»). No hay alcance por zona que
   * componer: este listado es de ACCESO TOTAL, y el guard de rol lo aplica el servicio antes de
   * llamar aqui (R25).
   *
   * **Esto y el camino de `cierres-admin` cubren conjuntos DISJUNTOS**, no dos vistas de lo mismo
   * (design §2.6): un cierre del dia con destino `bodega_central` —la GAM— nunca se consolida en
   * un cierre de bodega, porque `consolidablesWhere` exige destino satelite. Los dos botones
   * juntos son el total; uno solo deja fuera media operacion.
   *
   * Reusa las cuatro piezas de la hoja fundida sin declarar nada propio (R26), y NO reusa
   * `findCierreBodegaConDetalle` con su bucle por `cierre_dia`: aquel paga una consulta por
   * cierre del dia, y aqui el conjunto es un rango de meses.
   */
  async findGestionesDeCierresBodegaCompleto(
    filtros: FiltrosDescargaGestiones,
  ): Promise<CierreGestionDescargaDTO[]> {
    const gestiones = await this.prisma.gestionOrden.findMany({
      where: {
        cierre: {
          cierreBodegaId: { not: null }, // R24: solo lo ya consolidado en bodega
          // Los recortes se componen con `AND`, la MISMA forma que usan `historicoWhere` y
          // `colaWhere` del otro repositorio, y por el mismo motivo: como claves hermanas, un
          // recorte puede SUSTITUIR al criterio de seleccion en vez de sumarse a el.
          AND: filtrosWhere(filtros),
        },
      },
      orderBy: [...ORDEN_GESTIONES_DESCARGA], // R11/R26: el MISMO orden que el camino A
      select: GESTION_DESCARGA_SELECT, // R41: sin `evidencia_storage_path`
    });
    if (gestiones.length === 0) return [];

    const cierreIds = [...new Set(gestiones.map((g) => g.cierreId).filter((id) => id !== null))];
    // FICHA 394 — ids DEDUPLICADOS de las ordenes: una orden puede traer varias gestiones y su
    // conteo de intentos es UNO.
    const ordenIds = [...new Set(gestiones.map((g) => g.ordenId))];
    const [detalle, intentosPorOrden] = await Promise.all([
      this.prisma.cierreDetail.findMany({
        where: { cierreId: { in: cierreIds } },
        select: DETALLE_DESCARGA_SELECT,
      }),
      // FICHA 394 — el MISMO derivador en lote que el camino A (R26: las dos hojas emiten la
      // misma fila). Una consulta para todo el conjunto, no una por gestion.
      contarIntentosVigentesEnLoteCon(this.prisma.gestionOrden, ordenIds),
    ]);
    return componerGestionesDescarga(gestiones, detalle, intentosPorOrden);
  }

  /**
   * R16-R22: transicion atomica guardada; un solo UPDATE.
   *
   * FICHA 362 (R6/R9/R11) — `cierre_bodega_aprobado` / `cierre_bodega_rechazado`. El metodo se
   * envuelve en `$transaction` (forma 2 del design §2.3: era un `updateMany` suelto), y el
   * registro va DENTRO del `res.count === 1`: un cierre ya resuelto no deja rastro de una segunda
   * resolucion que no ocurrio.
   *
   * `monto` = `total_general` del cierre (snapshot), `Decimal`. `motivoRechazo` NO se copia (R5).
   */
  async resolverCierreBodega(
    input: ResolverCierreBodegaInput,
  ): Promise<ResolverCierreBodegaResult> {
    const { id, nuevoEstado, resueltoPor, motivoRechazo } = input;

    const resultado = await this.prisma.$transaction(async (tx) => {
      // R18: aplica SOLO si sigue `solicitado` (guardia de estado en el WHERE).
      const res = await tx.cierreBodega.updateMany({
        where: { id, estado: ESTADO_SOLICITADO },
        data: {
          estado: nuevoEstado,
          resueltoPor, // R20
          resueltoAt: new Date(), // R20
          motivoRechazo,
        },
      });
      if (res.count !== 1) return null;

      const cierre = await tx.cierreBodega.findUnique({
        where: { id },
        select: {
          totalGeneral: true,
          solicitadoAt: true,
          zona: { select: { nombre: true } },
        },
      });
      const actor = await resolverActorCongelado(tx, resueltoPor);
      await appendAccion(tx, [
        {
          accion:
            nuevoEstado === "aprobado" ? "cierre_bodega_aprobado" : "cierre_bodega_rechazado",
          entidadTipo: "cierre_bodega",
          entidadId: id,
          entidadEtiqueta: etiquetaDeEntidad("cierre_bodega", {
            zonaNombre: cierre?.zona.nombre ?? null,
            fecha: cierre?.solicitadoAt ?? new Date(),
          }),
          monto: cierre?.totalGeneral ?? null,
          ...actor,
        },
      ]);
      return "updated" as const;
    });
    if (resultado === "updated") return "updated";

    // count 0: distinguir "ya resuelto" (existe) de "no existe".
    const existe = await this.prisma.cierreBodega.count({ where: { id } });
    return existe > 0 ? "conflict" : "fuera_de_alcance"; // R18 vs R19
  }

  /**
   * ⭑ FICHA 431 (R8/R9/R11/R13) — MARCAR RECIBIDA una consolidacion, con su monto.
   *
   * Mismo molde que `resolverCierreBodega` y a proposito: `$transaction` propia, guarda por estado
   * en el `WHERE`, `appendAccion(tx, …)` DENTRO del callback y el trio de desenlaces.
   *
   * ⚠️ `appendAccion(tx, …)` Y NUNCA `appendAccion(this.prisma, …)`. Esa sustitucion NO la caza
   * NINGUN test de integracion de este repo —ahi `this.prisma` ES el cliente de la transaccion del
   * test— y solo la caza la guardia estatica del censo
   * (`tests/unit/guards/historial-accion-escrituras-cubiertas.guardia.test.ts`), que exige forma
   * `abre_tx` y el `appendAccion` dentro del callback.
   *
   * EL ESPEJO `resuelto_at`/`resuelto_por` NO ES DUPLICACION POR DESCUIDO:
   * el repositorio de analitica de conciliacion de cierres (`contarCierresPorEstado`, sin su nombre
   * completo a proposito: la guardia de fuente de la 127 censa todo archivo que lo escriba, y este
   * no es de analitica) selecciona los aprobados POR
   * `resuelto_at`. Sin rellenarlo, los cierres de bodega saldrian de la analitica financiera en
   * silencio. Las columnas NUEVAS son las que llevan el SIGNIFICADO y el monto; estas son el
   * espejo heredado del acto.
   *
   * ⭑ FICHA 498 (design §4.4, R8-R15) — MARCAR ASIENTA EL DINERO EN LA CAJA. Desde la decision del
   * humano del 2026-11-02 marcar deja de ser solo seguimiento: en la MISMA transaccion asienta cada
   * cierre satelite aprobado de la consolidacion en los tres libros (`asentarCierreDia`, el mismo
   * procedimiento que la aprobacion de un cierre central) y escribe la DIFERENCIA (una fila de ajuste
   * y un movimiento de caja) si lo recibido no es lo esperado. Las filas toman la fecha de esta
   * transaccion (R13). Cualquier fallo revierte la marca entera (R14). Por eso ya no se puede
   * desmarcar: si el monto no es el correcto, se corrige.
   */
  async marcarConciliado(input: MarcarConciliadoInput): Promise<MarcaConciliacionResult> {
    const { id, montoRecibido, nota, actorUsuarioId } = input;
    // Money-safe: el importe entra como STRING de escala 2 y se convierte AQUI, en el borde de la
    // escritura. Ni `Number`, ni `parseFloat`, ni aritmetica.
    const monto = new Prisma.Decimal(montoRecibido);
    const ahora = new Date();

    const resultado = await this.prisma.$transaction(async (tx) => {
      // FICHA 498 (Q5, §4.4 bis, R15a): recibido 0 SOLO si no hay nada que entregar. Antes de tocar
      // nada: si el aporte reconocido es positivo, la transaccion termina sin escribir.
      if (await this.ceroConAporte(tx, id, monto)) return "recibido_cero_con_aporte" as const;

      // R11: aplica SOLO si sigue pendiente de conciliar. Los DOS predicados, no uno: el estado es
      // lo que las pantallas leen y `conciliado_at` es EL predicado de la marca.
      const res = await tx.cierreBodega.updateMany({
        where: { id, estado: ESTADO_SOLICITADO, conciliadoAt: null },
        data: {
          estado: ESTADO_APROBADO, // D2: `aprobado` se LEE «Recibido»
          conciliadoAt: ahora,
          conciliadoPor: actorUsuarioId,
          montoRecibido: monto,
          conciliadoNota: nota,
          resueltoAt: ahora, // espejo (ver cabecera)
          resueltoPor: actorUsuarioId, // espejo (ver cabecera)
        },
      });
      if (res.count !== 1) return null;

      // FICHA 498 (R8): asienta cada cierre satelite APROBADO de esta consolidacion, completo (R12).
      // Idempotente: un cierre que ya tenia sus filas (aprobado con la regla vieja) no se duplica.
      const cierres = await tx.cierreDia.findMany({
        where: { cierreBodegaId: id, estado: "aprobado", destinoTipo: "bodega_satelite" },
        select: { id: true },
        orderBy: [{ solicitadoAt: "asc" }, { id: "asc" }],
      });
      for (const c of cierres) await asentarCierreDia(tx, c.id, this.depsAsiento);
      // R9/R10/R11: la diferencia, contra el aporte de ESTA consolidacion.
      await this.escribirDiferencia(tx, {
        cierreBodegaId: id,
        evento: "marca",
        recibido: monto,
        actorUsuarioId,
      });

      const cierre = await tx.cierreBodega.findUnique({
        where: { id },
        select: { solicitadoAt: true, zona: { select: { nombre: true } } },
      });
      const actor = await resolverActorCongelado(tx, actorUsuarioId);
      await appendAccion(tx, [
        {
          accion: "cierre_bodega_conciliado",
          entidadTipo: "cierre_bodega",
          entidadId: id,
          entidadEtiqueta: etiquetaDeEntidad("cierre_bodega", {
            zonaNombre: cierre?.zona.nombre ?? null,
            fecha: cierre?.solicitadoAt ?? ahora,
          }),
          // El monto RECIBIDO, no el consolidado: es lo que la persona afirma haber contado.
          monto,
          // La NOTA no entra (R5 de la 362): es texto libre tecleado por una persona.
          ...actor,
        },
      ]);
      return "updated" as const;
    });
    if (resultado !== null) return resultado;

    const existe = await this.prisma.cierreBodega.count({ where: { id } });
    return existe > 0 ? "conflict" : "fuera_de_alcance"; // R11 vs no existe
  }

  /**
   * ⭑ FICHA 431 (R12/R13) — REVERTIR la marca: vuelve a «Pendiente de conciliar» y BORRA los cuatro
   * datos de la marca mas el espejo.
   *
   * ⚠️ METODO PROPIO Y NO UN BOOLEANO EN `marcarConciliado`: la guardia del censo mide POR METODO,
   * no por escritura (medido en las fichas 376 y 380). Con las dos acciones en el mismo metodo,
   * borrar uno de los dos `appendAccion` la dejaria VERDE.
   *
   * ⚠️ EL MONTO SE LEE ANTES DE BORRARLO, y va a la fila del historial. Despues de este UPDATE, esa
   * fila es el UNICO sitio del sistema donde sobrevive cuanto se habia dado por recibido: sin el,
   * el rastro diria «alguien deshizo algo» en vez de «alguien deshizo un recibido de ₡500.000».
   *
   * ⚠️ CONSECUENCIA DECLARADA: al vaciar `resuelto_at`, la analitica financiera deja de contar este
   * cierre en su periodo. Es lo correcto —no se recibio— y esta escrito para que no sorprenda.
   */
  async revertirConciliacion(input: RevertirConciliacionInput): Promise<RevertirConciliacionResult> {
    const { id, actorUsuarioId } = input;

    const resultado = await this.prisma.$transaction(async (tx) => {
      // ⭑ FICHA 498 (design §4.6, R20): si el dinero YA entro a la caja, no se revierte NADA —ni la
      // marca, ni el historial, ni los libros—. Se corrige el monto en vez de revertir (R21).
      // ⭑ FICHA 500 (R1/R2): el MISMO criterio que las pantallas, en `consolidacionesConDinero`.
      if ((await consolidacionesConDinero(tx, [id])).has(id)) return "con_asientos" as const;
      // FICHA 498 (revision m2): una saldada con la regla anterior (Q4) no se revierte. Sin este corte,
      // el `updateMany` de abajo violaria el CHECK `cierre_bodega_esperado_regla_anterior_check` de M4
      // (`conciliado_at = NULL` con la marca puesta) y saldria como error interno. Desenlace de dominio.
      const regularizada = await tx.cierreBodega.findUnique({
        where: { id },
        select: { esperadoReglaAnterior: true },
      });
      if (regularizada !== null && esSaldadaReglaAnterior(regularizada)) {
        return "saldada_regla_anterior" as const;
      }

      // El monto ANTES del borrado: es lo que la fila del historial tiene que documentar.
      const previo = await tx.cierreBodega.findUnique({
        where: { id },
        select: {
          montoRecibido: true,
          solicitadoAt: true,
          zona: { select: { nombre: true } },
        },
      });

      // R12: aplica SOLO si de verdad estaba marcada. Los DOS predicados, por el mismo motivo que
      // en `marcarConciliado`.
      const res = await tx.cierreBodega.updateMany({
        where: { id, estado: ESTADO_APROBADO, conciliadoAt: { not: null } },
        data: {
          estado: ESTADO_SOLICITADO, // D2: `solicitado` se LEE «Pendiente de conciliar»
          conciliadoAt: null,
          conciliadoPor: null,
          montoRecibido: null,
          conciliadoNota: null,
          resueltoAt: null, // espejo: se va con la marca (ver cabecera)
          resueltoPor: null, // espejo
        },
      });
      if (res.count !== 1) return null;

      const actor = await resolverActorCongelado(tx, actorUsuarioId);
      await appendAccion(tx, [
        {
          accion: "cierre_bodega_conciliacion_revertida",
          entidadTipo: "cierre_bodega",
          entidadId: id,
          entidadEtiqueta: etiquetaDeEntidad("cierre_bodega", {
            zonaNombre: previo?.zona.nombre ?? null,
            fecha: previo?.solicitadoAt ?? new Date(),
          }),
          // EL MONTO QUE SE BORRA. Leido arriba, dentro de la misma transaccion.
          monto: previo?.montoRecibido ?? null,
          ...actor,
        },
      ]);
      return "updated" as const;
    });
    if (resultado !== null) return resultado;

    const existe = await this.prisma.cierreBodega.count({ where: { id } });
    return existe > 0 ? "conflict" : "fuera_de_alcance"; // R12 vs no existe
  }

  /**
   * ⭑ FICHA 473 (R1-R8, R12) — CORREGIR el monto recibido de una consolidacion YA conciliada.
   *
   * Mismo molde que `marcarConciliado`/`revertirConciliacion`: `$transaction` propia, guarda en el
   * `WHERE`, `appendAccion(tx, …)` DENTRO del callback y el trio de desenlaces.
   *
   * ⚠️ SIN CORTE PREVIO por `montoRecibido === null`: rechazar una pendiente o una rechazada es
   * trabajo del `WHERE`. Un `if` antes lo haria redundante e inmune a las mutaciones (quitar los
   * predicados de estado sobreviviria).
   *
   * ⚠️ `montoRecibido: previo.montoRecibido` en el `WHERE` es un compare-and-swap (R8): en READ
   * COMMITTED, una correccion concurrente que leyo el mismo `previo` re-evalua el `WHERE` tras el
   * bloqueo de fila, ve el monto ya cambiado y obtiene `count 0` → `conflict`. Sin el, su fila de
   * historial llevaria un `valor_anterior` falso.
   *
   * D3: reescribe `conciliado_at`/`resuelto_at` igual que el rodeo Desmarcar + Marcar que sustituye.
   *
   * ⭑ FICHA 498 (design §4.5, R17-R19): escribe la DIFERENCIA solo por la VARIACION contra el aporte
   * reconocido (una fila de ajuste `correccion` + un movimiento de caja). No vuelve a asentar los
   * cierres y no modifica ni borra ningun movimiento ni ajuste anterior.
   */
  async corregirConciliacion(input: CorregirConciliacionInput): Promise<MarcaConciliacionResult> {
    const { id, montoRecibido, nota, actorUsuarioId } = input;
    // Money-safe: STRING de escala 2 → `Prisma.Decimal` en el borde de la escritura.
    const monto = new Prisma.Decimal(montoRecibido);
    const ahora = new Date();

    const resultado = await this.prisma.$transaction(async (tx) => {
      // FICHA 498 (Q5, R15a): la misma regla del recibido 0 que al marcar, antes de tocar nada.
      if (await this.ceroConAporte(tx, id, monto)) return "recibido_cero_con_aporte" as const;

      // El monto ANTERIOR, leido en la misma transaccion: va al historial y al compare-and-swap.
      const previo = await tx.cierreBodega.findUnique({
        where: { id },
        select: {
          montoRecibido: true,
          solicitadoAt: true,
          zona: { select: { nombre: true } },
        },
      });
      if (previo === null) return null;

      // R6/R8: SOLO si sigue conciliada (los DOS predicados) y su monto es el leido arriba.
      const res = await tx.cierreBodega.updateMany({
        where: {
          id,
          estado: ESTADO_APROBADO,
          conciliadoAt: { not: null },
          montoRecibido: previo.montoRecibido,
        },
        data: {
          montoRecibido: monto,
          conciliadoNota: nota,
          conciliadoPor: actorUsuarioId,
          conciliadoAt: ahora,
          resueltoAt: ahora, // espejo (D3)
          resueltoPor: actorUsuarioId, // espejo (D3)
        },
      });
      if (res.count !== 1) return null;

      // FICHA 498 (R17/R18): solo la variacion. `asentada` incluye la marca y las correcciones
      // previas; el CAS de arriba serializa dos correcciones concurrentes.
      await this.escribirDiferencia(tx, {
        cierreBodegaId: id,
        evento: "correccion",
        recibido: monto,
        actorUsuarioId,
      });

      const actor = await resolverActorCongelado(tx, actorUsuarioId);
      await appendAccion(tx, [
        {
          accion: "cierre_bodega_conciliado",
          entidadTipo: "cierre_bodega",
          entidadId: id,
          entidadEtiqueta: etiquetaDeEntidad("cierre_bodega", {
            zonaNombre: previo.zona.nombre,
            fecha: previo.solicitadoAt,
          }),
          // El monto NUEVO; el par anterior/nuevo distingue esta fila de una marca (D1).
          monto,
          valorAnterior: previo.montoRecibido?.toFixed(2) ?? null,
          valorNuevo: monto.toFixed(2),
          // La NOTA no entra (R4; R5 de la 362): es texto libre tecleado por una persona.
          ...actor,
        },
      ]);
      return "updated" as const;
    });
    if (resultado !== null) return resultado;

    const existe = await this.prisma.cierreBodega.count({ where: { id } });
    return existe > 0 ? "conflict" : "fuera_de_alcance"; // R6/R8 vs R7
  }

  /**
   * FICHA 498 (Q5, design §4.4 bis, R15a/R15b): ¿es un recibido 0 sobre una consolidacion con aporte
   * reconocido POSITIVO? El aporte se lee del snapshot DENTRO de la transaccion de la marca. Con
   * aporte 0 o negativo el 0 se acepta y sigue el camino normal (R11 / ingreso de diferencia).
   * Si la consolidacion no existe devuelve `false`: el `WHERE` de la escritura lo resuelve.
   */
  private async ceroConAporte(tx: TxConciliacion, id: string, monto: Prisma.Decimal): Promise<boolean> {
    if (!monto.isZero()) return false;
    const row = await tx.cierreBodega.findUnique({ where: { id }, select: APORTE_SELECT });
    return row !== null && aporteDeConsolidacion(row).greaterThan(0);
  }

  /**
   * FICHA 498 (design §4.4 pasos 1-7, R9-R12, R17-R19) — escribe la DIFERENCIA de la satelite, si la
   * hay. Lo comparten marcar (`evento = marca`) y corregir (`evento = correccion`).
   *
   *   esperado = aporte reconocido (`aporteDeConsolidacion`: «Para la central» o, en una saldada con
   *              la regla anterior, su `esperado_regla_anterior`);
   *   asentada = Σ diferencia de las filas de ajuste YA escritas para esta consolidacion;
   *   delta    = esperado − recibido − asentada.
   *
   * delta 0 → nada. Si no: UNA fila de ajuste (append-only) y UN movimiento de caja con origen en
   * ella — egreso `egreso_diferencia_satelite` por delta si es positivo (llego de menos), ingreso
   * `ingreso_diferencia_satelite` por |delta| si es negativo. Sin `fechaMovimiento` (R13).
   */
  private async escribirDiferencia(
    tx: TxConciliacion,
    d: {
      cierreBodegaId: string;
      evento: "marca" | "correccion";
      recibido: Prisma.Decimal;
      actorUsuarioId: string;
    },
  ): Promise<void> {
    const row = await tx.cierreBodega.findUniqueOrThrow({
      where: { id: d.cierreBodegaId },
      select: APORTE_SELECT,
    });
    const esperado = aporteDeConsolidacion(row);
    const suma = await tx.conciliacionBodegaAjuste.aggregate({
      where: { cierreBodegaId: d.cierreBodegaId },
      _sum: { diferencia: true },
    });
    const asentada = suma._sum.diferencia ?? new Prisma.Decimal(0);
    const delta = esperado.minus(d.recibido).minus(asentada);
    if (delta.isZero()) return; // R11/R18

    const ajuste = await tx.conciliacionBodegaAjuste.create({
      data: {
        cierreBodegaId: d.cierreBodegaId,
        evento: d.evento,
        montoEsperado: esperado,
        montoRecibido: d.recibido,
        diferencia: delta,
        creadoPor: d.actorUsuarioId,
      },
      select: { id: true },
    });
    const llegoDeMenos = delta.greaterThan(0);
    const mov: CrearMovimientoInput = {
      tipo: llegoDeMenos ? "egreso" : "ingreso",
      categoria: llegoDeMenos ? "egreso_diferencia_satelite" : "ingreso_diferencia_satelite",
      monto: delta.abs().toFixed(2),
      origenTipo: "conciliacion_bodega_ajuste",
      origenId: ajuste.id,
      descripcion: null,
      registradoPor: null,
    };
    const escritas = await this.depsAsiento.walletMovimientoRepo.crearMovimientos(tx, [mov]);
    // El origen es una fila de ajuste RECIEN creada: un 0 aqui solo puede ser un fallo. Se lanza para
    // que la marca entera revierta (R14) en vez de dejar un ajuste sin su movimiento.
    if (escritas !== 1) {
      throw new Error(`ficha 498: la diferencia de la consolidacion ${d.cierreBodegaId} no se escribio`);
    }
  }
}

