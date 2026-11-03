"use client";

import { PackageCheck } from "lucide-react";

import { EstadoConInfo } from "@/components/shared/EstadoInfo";
import { Badge } from "@/components/ui/badge";
import { EscanerGuiaCard } from "@/components/shared/EscanerGuiaCard";
import { extractNumGuiaFromScan } from "@/lib/utils/paquete-url";
import {
  RESULTADOS_QUE_VUELVEN,
  vuelveABodega,
  vuelveABodegaElPaquete,
} from "@/lib/types/gestion-retorno";
import { nombreDeEstado } from "@/lib/types/order-status";
import type {
  CierreDetalleGestion,
  CierreGrupos,
  CierreOrdenSinGestion,
  CierreResultado,
} from "@/lib/interfaces/services/ICierreDiaService";

import { RESULTADO_LABEL, RESULTADO_FILA_LABEL, tituloResultadoConCifra } from "./cierre-labels";

// Feature 238 (T4.2-T4.5, design §5.2/§5.3) — el CUERPO de la ventana de confirmación física:
// lo que bodega ve mientras confirma, guía a guía, que tiene delante cada paquete que vuelve.
//
// Vive fuera de `CierresAdminModule` por el mismo motivo por el que salieron `cierre-factura` y
// `cierre-detalle-shared`: el módulo ya orquesta cuatro modales, y aquí hay ~150 líneas de
// presentación que no deciden nada. **El estado no vive acá**: lo confirmado, el aviso de la
// última lectura y los errores del servidor son del módulo, porque tienen que sobrevivir a
// cerrar y reabrir la ventana (design §5.4) y morir con `cerrarDetalle`. Este componente es
// una función de sus props.
//
// Lo que NO se reinventa: la captura es `EscanerGuiaCard` con sus dos caminos (cámara y número
// tecleado) y el parseo del QR es `extractNumGuiaFromScan`, los mismos que usan las otras seis
// superficies de escaneo. Y **no** se usa `EscanerModal`: ese envoltorio trae su propio botón
// disparador y su propio diálogo, y esto ya vive dentro de uno.

/** Cómo llegó el texto que hay que interpretar: la cámara entrega una URL, el teclado un número. */
export type MedioDeCaptura = "camara" | "manual";

// --- Textos de la ventana (i18n-ready, separados de la lógica, como el resto del módulo) ---

export const CONFIRMACION_TITULO = "Confirmar los paquetes que vuelven";
export const CONFIRMACION_DETALLE =
  "Antes de aprobar, tené delante cada paquete que vuelve a bodega y confirmá su guía: escaneá el código o escribí el número.";
/** Queda un paso más (los montos de los incidentes), así que el botón no promete aprobar. */
export const CONFIRMACION_CONTINUAR = "Continuar";
export const CONFIRMACION_APROBAR = "Confirmar y aprobar";

const ESCANER_TITULO = "Confirmar paquete recibido";
const ESCANER_DESCRIPCION = "Escaneá el código de la guía o escribí su número";
const ESCANER_BOTON = "Confirmar";
const ESCANER_ERROR_CAMARA = "No se pudo abrir la cámara.";

const FILA_PENDIENTE = "Pendiente";
const FILA_CONFIRMADA = "Confirmada";
/**
 * R13, la mitad del cliente. La orden llegó a reparto sin número de guía: no hay nada que
 * escanear, así que ese cierre **no se va a poder aprobar** y bodega tiene que saberlo ANTES de
 * escanear las otras trece. El servidor bloquea igual y con su propio mensaje; esto sólo evita
 * el bloqueo mudo, que es lo que se lee como una app rota.
 *
 * El texto es propio y NO se importa del servicio: los seis mensajes de `CierresAdminService`
 * son constantes de módulo sin exportar, y traerse un módulo de servicio a un componente de
 * cliente arrastraría el servidor entero. Dicen lo mismo con palabras distintas a propósito —
 * si algún día divergieran, la que manda es la del servidor, que es la que decide.
 */
const FILA_SIN_GUIA =
  "Sin número de guía: no se puede confirmar. Avisá a un administrador.";
/** FICHA 497 (R35): nombre accesible del aviso de filas sin guía que va encima de la lista. */
const FILAS_SIN_GUIA_LABEL = "Filas sin número de guía";

/**
 * Dos filas, UN solo bulto. Se dice en la fila porque es lo que hace legible lo que si no parece
 * un error: al leer esa guía, dos filas cambian a «Confirmada» de golpe y el contador —que va en
 * paquetes— avanza sólo uno. Sin esta línea, quien escanea ve la misma guía repetida y busca el
 * segundo paquete que no existe, o cree que la app marcó de más.
 *
 * Siempre en plural («N filas»): `cuantasFilas` es 2 o más por construcción, así que no hay
 * concordancia que resolver.
 */
export function filaMismoPaquete(cuantasFilas: number): string {
  return `Este paquete aparece en ${cuantasFilas} filas de esta lista: una sola lectura las confirma todas.`;
}

/**
 * FICHA 497 (R30) — el rótulo de la sección de las BARRIDAS: el nombre VIGENTE del estado al que el
 * corte las pasó, leído de la fuente (`nombreDeEstado`), no un literal nuevo. Mismo criterio que
 * `cierre-factura.tsx` con su sección hermana. El nombre retirado de ese estado lo prohíbe la
 * guardia `nombres-estado-retirados`.
 */
const NOVEDAD_INTERNA = nombreDeEstado("novedad_interna");

/** FICHA 497 (R30) — título de la sección de barridas con su cifra, igual que los de resultado. */
function tituloBarridasConCifra(cuantas: number): string {
  return `${NOVEDAD_INTERNA} (${cuantas})`;
}

/**
 * FICHA 497 (R35) — el aviso de las filas SIN GUÍA, ANTES de la lista. La línea por fila de la 238
 * se conserva, pero con una lista larga la fila sin guía puede quedar abajo del todo: bodega
 * escanearía las demás antes de enterarse de que el cierre no se va a poder aprobar.
 */
export function textoFilasSinGuia(cuantas: number): string {
  return cuantas === 1
    ? "1 fila de este cierre no tiene número de guía: el cierre no se podrá aprobar. Avisá a un administrador."
    : `${cuantas} filas de este cierre no tienen número de guía: el cierre no se podrá aprobar. Avisá a un administrador.`;
}

// --- Los cuatro desenlaces de una guía leída (R29-R32) ---
// Son cuatro mensajes DISTINTOS a propósito: son cuatro correcciones distintas para quien está
// en el mostrador con el paquete en la mano. «No es de este cierre» manda a buscar en otra pila;
// «no vuelve a bodega» dice que ese paquete no existe o se quedó con el cliente; «ya está
// confirmada» evita que se escanee dos veces creyendo que la primera no entró.

/** R29 — lo leído no se puede interpretar como número de guía. */
const LECTURA_ILEGIBLE =
  "No se pudo leer un número de guía en ese código. Escaneá de nuevo o escribí el número.";
/** R30 — la guía no es de ninguna gestión de este cierre. */
const LECTURA_AJENA = "Esa guía no pertenece a este cierre.";
/** R32 — ya se confirmó en esta sesión. */
const LECTURA_YA_CONFIRMADA =
  "Esa guía ya está confirmada. No se cuenta dos veces.";

/** R31 — es de este cierre, pero ese paquete no vuelve a bodega. Se nombra POR QUÉ no vuelve. */
function lecturaNoVuelve(resultado: CierreResultado): string {
  return `Esa guía es de este cierre, pero ese paquete no vuelve a bodega. Resultado: ${RESULTADO_FILA_LABEL[resultado]}.`;
}

/**
 * R27 — el motivo del bloqueo, CON PALABRAS. Y nombra la salida: si un paquete no llegó, la
 * puerta es rechazar el cierre (D2, firmada: no hay «aprobar de todas formas»). Sin nombrarla,
 * quien está bloqueado busca una puerta trasera que no existe.
 */
export function textoFaltan(faltan: number): string {
  return faltan === 1
    ? "Falta 1 paquete por confirmar. Si no llegó, rechazá el cierre indicando cuál falta."
    : `Faltan ${faltan} paquetes por confirmar. Si alguno no llegó, rechazá el cierre indicando cuáles faltan.`;
}

/**
 * El progreso, siempre visible: con catorce filas, «cuántas van» no puede vivir al final.
 *
 * La frase pone el número DESPUÉS del sustantivo («1 de 3») y no antes («Confirmados 0 de 1
 * paquetes») para que no haya que concordar en número: con un solo paquete, la segunda forma
 * escribe «de 1 paquetes».
 */
export function textoProgreso(confirmadas: number, total: number): string {
  return `Paquetes confirmados: ${confirmadas} de ${total}.`;
}

/**
 * Ya están todos los paquetes delante. Lo que viene DEPENDE del cierre, y decirlo mal es la
 * clase de mentira que ninguna suite mira: con incidentes todavía queda teclear los montos
 * (R37), así que anunciar «ya se puede aprobar» junto a un botón que dice «Continuar» deja a
 * bodega buscando el botón de aprobar que no existe.
 */
export function textoCompleta(hayIncidentes: boolean): string {
  return hayIncidentes
    ? "Están todos. Queda indicar los montos de los incidentes."
    : "Están todos. Ya se puede aprobar el cierre.";
}

/**
 * R34 — los incidentes, NOMBRADOS como excluidos y con su razón. No es un detalle de cortesía:
 * medido el 2026-08-19, hay incidentes en 2 de 12 cierres y conviven con retornables, así que
 * esta línea se ve de verdad. Sin ella, bodega cuenta los paquetes del cierre, le salen más que
 * los de la lista y busca el que «falta».
 */
export function textoIncidentesExcluidos(cuantos: number): string {
  return cuantos === 1
    ? "1 incidente de este cierre no se escanea: ese paquete no vuelve a bodega, se indemniza."
    : `${cuantos} incidentes de este cierre no se escanean: esos paquetes no vuelven a bodega, se indemnizan.`;
}

/**
 * FICHA 497 (design §6.2) — UNA FILA DEL CONJUNTO ESPERADO, venga de donde venga. Es la vista
 * unificada que permite tener UN contador y UN intérprete de lecturas (R32): una gestión cuyo
 * paquete vuelve, o una BARRIDA (orden que el corte pasó a `novedad_interna` al crear el cierre).
 *
 * `clave` es el id con el que el servidor identifica la fila y con el que devuelve sus errores:
 * `gestionId` para una gestión, `ordenId` para una barrida. Los dos son uuid distintos, así que
 * pueden convivir en el mismo `Record` de confirmadas y de errores sin chocar.
 *
 * El `numGuia` de una barrida es su guía CONGELADA (`cierre_sin_gestion.num_guia`), la misma
 * contra la que compara el servidor: con la viva, pantalla y servidor podrían pedir números
 * distintos y el botón se quedaría bloqueado sin explicación (design §9-F).
 */
export type FilaAConfirmar =
  | {
      origen: "gestion";
      clave: string;
      numGuia: number | null;
      numRemision: string;
      destinatario: string;
      tiendaNombre: string;
      resultado: CierreResultado;
    }
  | {
      origen: "barrida";
      clave: string;
      numGuia: number | null;
      numRemision: string;
      destinatario: string;
      tiendaNombre: string;
    };

/**
 * R2 (238) + R5/R30 (497) — el CONJUNTO ESPERADO tal como lo ve la pantalla: las gestiones del
 * cierre cuyo paquete vuelve a bodega, en el orden del punto único (`RESULTADOS_QUE_VUELVEN`), y
 * DESPUÉS todas las barridas del cierre. Sale del MISMO detalle que ya se pidió al servidor
 * (`grupos` y `ordenesSinGestion`): no hay una consulta aparte que pueda decir otra cosa, y eso es
 * lo que hace cierto que la ventana pida exactamente lo que el servicio exige cubrir.
 *
 * Las barridas entran porque el PUNTO ÚNICO dice que su paquete vuelve
 * (`vuelveABodegaElPaquete({ origen: "barrida" })`), no por una regla escrita acá: si algún día
 * dejara de volver, la ventana y el servicio la excluirían a la vez.
 */
export function filasAConfirmar(
  grupos: CierreGrupos,
  ordenesSinGestion: readonly CierreOrdenSinGestion[],
): FilaAConfirmar[] {
  const gestiones: FilaAConfirmar[] = RESULTADOS_QUE_VUELVEN.flatMap((resultado) =>
    grupos[resultado].map(
      (g): FilaAConfirmar => ({
        origen: "gestion",
        clave: g.gestionId,
        numGuia: g.numGuia,
        numRemision: g.numRemision,
        destinatario: g.destinatario,
        tiendaNombre: g.tiendaNombre,
        resultado: g.resultado,
      }),
    ),
  );
  const barridas: FilaAConfirmar[] = vuelveABodegaElPaquete({ origen: "barrida" })
    ? ordenesSinGestion.map(
        (b): FilaAConfirmar => ({
          origen: "barrida",
          clave: b.ordenId,
          numGuia: b.numGuia,
          numRemision: b.numRemision,
          destinatario: b.destinatario,
          tiendaNombre: b.tiendaNombre,
        }),
      )
    : [];
  return [...gestiones, ...barridas];
}

/**
 * TODAS las gestiones del cierre, de los cinco resultados. Hace falta para poder distinguir
 * R30 («no es de este cierre») de R31 («es de este cierre y no vuelve»): con sólo las
 * retornables delante, las dos lecturas serían indistinguibles.
 */
export function gestionesDelCierre(grupos: CierreGrupos): CierreDetalleGestion[] {
  return Object.values(grupos).flat();
}

/**
 * Lo que produce interpretar una lectura: o marca filas, o dice qué pasó. Nunca las dos.
 *
 * `claves` es una LISTA y no una fila suelta a propósito: una guía puede tener **más de una fila
 * pendiente** en el mismo cierre (dos gestiones vivas de la misma orden), y hay UN solo paquete
 * físico detrás. Una lectura = «tengo este paquete delante» = todas sus filas cubiertas. Con una
 * sola fila por lectura, la segunda no se podía confirmar nunca (ver `interpretarLectura`).
 *
 * FICHA 497: las claves son `gestionId` u `ordenId` (de una barrida), según el origen de la fila.
 */
export type LecturaInterpretada =
  | { tipo: "confirma"; claves: readonly string[]; numGuia: number }
  | { tipo: "aviso"; mensaje: string };

/**
 * R29-R32 (238) + R33/R34 (497) — de un texto leído a uno de los cuatro desenlaces. **Función
 * pura**: no toca estado, no llama a ninguna Server Action y no sabe pintar. Toda la resolución
 * `numGuia -> fila` se hace en el cliente contra el detalle YA cargado, que es el mismo conjunto
 * que el servidor exige cubrir (design §5.1): no hay una segunda consulta que pueda decir otra cosa.
 *
 * Se mira primero el CONJUNTO ESPERADO (`filas`: gestiones que vuelven y barridas). Si la guía no
 * está ahí, se mira en TODAS las gestiones del cierre, porque distinguir «no es de este cierre» de
 * «es de este cierre y no vuelve» son dos correcciones distintas (R30 vs R31 de la 238). Ese
 * segundo aviso sólo lo puede disparar una gestión: una barrida vuelve siempre, así que si su guía
 * casa, casa en `filas`. Una guía que no casa con nada es «no es de este cierre» (R34 de la 497).
 *
 * **Se buscan TODAS las filas de esa guía, no la primera.** Un cierre puede traer dos gestiones
 * vivas de la MISMA orden y, por tanto, con la misma guía: medido contra producción el
 * 2026-08-19, 1 de 48 pares (cierre, orden) vivos está en ese caso, y es justo del tipo que
 * bloquea. Con `find` pasaba esto: la primera lectura confirmaba la primera fila, la segunda
 * lectura volvía a caer en esa misma fila y respondía «ya está confirmada», y la segunda fila se
 * quedaba `Pendiente` PARA SIEMPRE — el contador clavado en `N-1 de N`, el botón apagado y el
 * cierre imposible de aprobar por ninguna vía. El servidor no tiene ese candado: dedupe por
 * clave (no por guía) y compara la guía contra la de CADA fila, así que dos entradas con la
 * misma `numGuia` y distinta clave le valen.
 *
 * ⚠️ **PREMISA DE LA QUE DEPENDE LA CORRECCIÓN DE TODO ESTO: `orden.numGuia` es `@unique`**
 * (`db/schema.prisma`, modelo `Orden`). Ésa —y sólo ésa— es la razón por la que «todas las filas
 * de esta guía» significa «un solo bulto». Una guía identifica UNA orden; una orden es UN paquete
 * físico; luego confirmar de golpe todas sus filas es atestiguar el bulto que se tiene delante, ni
 * uno más. **Si esa unicidad desapareciera, esto dejaría de ser una corrección y pasaría a ser un
 * agujero**: una sola lectura daría por confirmados paquetes DISTINTOS y bodega estaría firmando
 * que tiene delante algo que no tiene. Nada del código lo avisaría —ni el typecheck, ni la
 * pantalla, que seguiría comportándose igual—, así que la premisa se vigila donde se escribe: el
 * caso «PREMISA» de `tests/components/CierresAdminConfirmacionFisica.test.tsx` lee
 * `db/schema.prisma` y se pone rojo si el `@unique` de `numGuia` se cae. No se delega en la
 * guardia de la 229, que fija lo mismo por un motivo suyo y se iría con ella.
 */
export function interpretarLectura(
  texto: string,
  medio: MedioDeCaptura,
  filas: readonly FilaAConfirmar[],
  gestionesDelCierre: readonly CierreDetalleGestion[],
  yaConfirmadas: Readonly<Record<string, number>>,
): LecturaInterpretada {
  // La cámara entrega la URL del paquete (`<origin>/paquete/<numGuia>`) y hay que extraer el
  // número; lo tecleado ES el número. Es la ÚNICA diferencia entre los dos caminos, igual que
  // en `RecogerPaqueteCard`: de aquí en adelante los dos recorren exactamente el mismo camino.
  const numGuia =
    medio === "camara"
      ? extractNumGuiaFromScan(texto)
      : /^\d+$/.test(texto.trim())
        ? Number(texto.trim())
        : null;
  if (numGuia === null || !Number.isSafeInteger(numGuia) || numGuia <= 0) {
    return { tipo: "aviso", mensaje: LECTURA_ILEGIBLE }; // R29
  }

  // Las filas sin guía (`numGuia === null`) no casan nunca: `numGuia` ya es un número acá.
  const queVuelven = filas.filter((f) => f.numGuia === numGuia);
  if (queVuelven.length === 0) {
    // R31: `vuelveABodega` es el PUNTO ÚNICO. La pantalla no decide por su cuenta qué vuelve; si
    // lo decidiera, podría pedir confirmar un conjunto distinto del que el servidor exige y el
    // botón se quedaría bloqueado sin explicación posible. Aquí sólo se NOMBRA el resultado de
    // una gestión del cierre cuya guía no está en el conjunto esperado (son todas del mismo
    // paquete; lo que corrige a quien está en el mostrador es SABER que ese bulto no se escanea).
    const delCierre = gestionesDelCierre.find(
      (g) => g.numGuia === numGuia && !vuelveABodega(g.resultado),
    );
    if (delCierre === undefined) return { tipo: "aviso", mensaje: LECTURA_AJENA }; // R30 / 497-R34
    return { tipo: "aviso", mensaje: lecturaNoVuelve(delCierre.resultado) };
  }

  const pendientes = queVuelven.filter((f) => yaConfirmadas[f.clave] === undefined);
  // R32, intacto y con su motivo: avisa cuando YA NO QUEDA NADA que cubrir con esa guía, que es
  // el caso en que la segunda lectura del mismo bulto no cuenta. Mientras quede una fila
  // pendiente sí hay algo que confirmar, y avisar ahí era el defecto.
  if (pendientes.length === 0) {
    return { tipo: "aviso", mensaje: LECTURA_YA_CONFIRMADA };
  }
  return { tipo: "confirma", claves: pendientes.map((f) => f.clave), numGuia };
}

/**
 * La CLAVE del paquete FÍSICO de una fila. Dos gestiones vivas de la misma orden llegan con la
 * misma guía y son **un solo bulto** en el estante: cuentan una vez.
 *
 * La guía sirve de clave del bulto **por la misma premisa que sostiene `interpretarLectura`:
 * `orden.numGuia` es `@unique`** (`db/schema.prisma`, modelo `Orden`). Si dos órdenes pudieran
 * compartir guía, `guia:<numGuia>` fundiría paquetes DISTINTOS en una sola entrada del contador:
 * el total saldría corto y bodega pondría delante menos bultos de los que debe. Ahí la premisa
 * no protege una confirmación de más, sino un total de menos — el mismo agujero por el otro lado.
 *
 * Sin guía no hay forma de saber si dos filas son el mismo bulto, así que cada una cuenta por su
 * cuenta. No es un detalle: colapsarlas rebajaría el total y, con él, el número de paquetes que
 * bodega tiene que poner delante — y esas filas además no se pueden confirmar nunca (R13), así
 * que el bloqueo tiene que seguir contándolas. FICHA 497: la clave sin guía lleva el ORIGEN,
 * para que una gestión y una barrida nunca se fundan por accidente.
 */
function clavePaquete(f: FilaAConfirmar): string {
  return f.numGuia === null ? `sin-guia:${f.origen}:${f.clave}` : `guia:${f.numGuia}`;
}

/** Las filas del conjunto esperado, agrupadas por paquete físico (una guía, un bulto). */
export function agruparPorPaquete(filas: readonly FilaAConfirmar[]): FilaAConfirmar[][] {
  const porClave = new Map<string, FilaAConfirmar[]>();
  for (const f of filas) {
    const grupo = porClave.get(clavePaquete(f));
    if (grupo === undefined) porClave.set(clavePaquete(f), [f]);
    else grupo.push(f);
  }
  return [...porClave.values()];
}

/**
 * R27 (238) + R32 (497) — el progreso EN PAQUETES, que es lo que el rótulo dice y lo que bodega
 * cuenta en el estante. UN SOLO contador para gestiones y barridas: un segundo contador dejaría
 * un «Están todos» con barridas pendientes detrás.
 *
 * **No en filas**: en el cierre medido el 2026-08-19 eran doce filas para once bultos, así que
 * «Paquetes confirmados: X de 12» ya mentía antes de este arreglo; y contar filas haría además que
 * una sola lectura moviera el contador de dos en dos, que a los ojos de quien escanea es un error.
 *
 * `faltan` es el MISMO candado de antes: un paquete cuenta como hecho sólo si TODAS sus filas
 * están confirmadas, y una lectura confirma todas las pendientes de esa guía a la vez, así que
 * «faltan 0 paquetes» y «no queda ninguna fila pendiente» son la misma condición.
 */
export function progresoDePaquetes(
  filas: readonly FilaAConfirmar[],
  confirmadas: Readonly<Record<string, number>>,
): { total: number; hechas: number; faltan: number } {
  const paquetes = agruparPorPaquete(filas);
  const hechas = paquetes.filter((grupo) =>
    grupo.every((f) => confirmadas[f.clave] !== undefined),
  ).length;
  return { total: paquetes.length, hechas, faltan: paquetes.length - hechas };
}

/** Una sección de la lista: un resultado de gestión que vuelve, o las barridas (al final). */
interface SeccionDeLaLista {
  key: string;
  ariaLabel: string;
  titulo: string;
  filas: FilaAConfirmar[];
}

/**
 * R2/R33 (238) + R30 (497) — las secciones de la lista, en orden: primero las gestiones que
 * vuelven AGRUPADAS por resultado y en el orden que declara el punto único (añadir un resultado
 * retornable al `Record` lo hace aparecer acá sin tocar este archivo); y como ÚLTIMA sección, en
 * la MISMA lista y con el mismo peso, las barridas rotuladas con el nombre vigente del estado.
 *
 * No van en una caja aparte: la única caja aparte de esta ventana es la de los incidentes, que
 * dice «esto no se escanea», y una hermana se leería como opcional (design §6.1).
 */
function seccionesDeLaLista(filas: readonly FilaAConfirmar[]): SeccionDeLaLista[] {
  const deGestiones = RESULTADOS_QUE_VUELVEN.map((resultado) => {
    const deEse = filas.filter((f) => f.origen === "gestion" && f.resultado === resultado);
    return {
      key: resultado,
      ariaLabel: RESULTADO_LABEL[resultado],
      titulo: tituloResultadoConCifra(resultado, deEse.length),
      filas: deEse,
    };
  });
  const barridas = filas.filter((f) => f.origen === "barrida");
  const deBarridas: SeccionDeLaLista = {
    key: "barridas",
    ariaLabel: NOVEDAD_INTERNA,
    titulo: tituloBarridasConCifra(barridas.length),
    filas: barridas,
  };
  return [...deGestiones, deBarridas].filter((s) => s.filas.length > 0);
}

export interface ConfirmacionFisicaCuerpoProps {
  /**
   * El conjunto esperado: las gestiones del cierre cuyo paquete vuelve a bodega y, desde la 497,
   * sus barridas (`filasAConfirmar`).
   */
  filas: readonly FilaAConfirmar[];
  /** R34: las `incidente` del mismo cierre, para nombrarlas como excluidas. */
  incidentes: readonly CierreDetalleGestion[];
  /** `clave (gestionId u ordenId) -> numGuia leído`. Lo confirmado en esta sesión. */
  confirmadas: Readonly<Record<string, number>>;
  /** Errores del servidor por clave de fila (`fieldErrors`), pintados en su fila. */
  errores: Readonly<Record<string, string>>;
  /** R29-R32: qué pasó con la última lectura; `null` si no hay nada que decir. */
  aviso: string | null;
  /** Confirmación persistente del último acierto, bajo el formulario. */
  ultimaGuiaConfirmada: number | null;
  /** Interpreta y aplica una lectura. Devuelve `true` si marcó una fila (limpia el campo). */
  onLectura: (texto: string, medio: MedioDeCaptura) => boolean;
}

export function ConfirmacionFisicaCuerpo({
  filas,
  incidentes,
  confirmadas,
  errores,
  aviso,
  ultimaGuiaConfirmada,
  onLectura,
}: Readonly<ConfirmacionFisicaCuerpoProps>) {
  // El rótulo dice «paquetes», así que se cuentan PAQUETES: una guía repetida en dos filas es un
  // solo bulto en el estante (ver `progresoDePaquetes`).
  const { total, hechas, faltan } = progresoDePaquetes(filas, confirmadas);
  // Cuántas filas comparten bulto con otra, para poder decirlo en la fila.
  const filasPorPaquete = new Map<string, number>(
    agruparPorPaquete(filas).map((grupo) => [clavePaquete(grupo[0]), grupo.length]),
  );
  // FICHA 497 (R35): cuántas filas del conjunto esperado no se van a poder confirmar nunca.
  const sinGuia = filas.filter((f) => f.numGuia === null).length;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- La barra de estado ----------
          VA ARRIBA Y PEGADA, y esa es la decisión de diseño de esta ventana. Medido contra
          producción el 2026-08-19: el techo de un cierre son CATORCE guías (media 2,7). Con
          catorce filas y bodega escaneando de pie, un progreso al final de la lista no existe:
          hay que soltar el paquete, desplazar y volver. Aquí hay dos candados para que no pase:
          (1) `sticky top-0` dentro del cuerpo del modal, que es el contenedor que desplaza; y
          (2) la LISTA tiene su propio desplazamiento acotado más abajo, así que en el caso
          normal el cuerpo del modal no desplaza en absoluto y esta barra ni se mueve.

          No va en la `description` del Modal —que también queda fija— porque eso es
          `Dialog.Description`: se anuncia UNA vez al abrir y un contador que cambia con cada
          escaneo no se volvería a anunciar. Acá es una región viva (`role="status"`). */}
      <div className="sticky top-0 z-10 flex flex-col gap-1.5 bg-background pb-3">
        <p role="status" className="text-sm font-medium">
          {textoProgreso(hechas, total)}
        </p>
        {/* R27: el motivo del bloqueo con TEXTO, nunca sólo un botón apagado. */}
        {faltan > 0 ? (
          <p role="note" className="text-sm text-muted-foreground">
            {textoFaltan(faltan)}
          </p>
        ) : (
          <p role="note" className="text-sm font-medium text-success-strong">
            {textoCompleta(incidentes.length > 0)}
          </p>
        )}
        {/* R29-R32: qué pasó con la última lectura. Persistente y no un toast: el toast se va
            solo y quien está escaneando una tanda seguida necesita seguir viéndolo. */}
        {aviso ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {aviso}
          </p>
        ) : null}
      </div>

      {/* ---------- R34: los incidentes excluidos, nombrados ---------- */}
      {incidentes.length > 0 ? (
        <section
          aria-label="Incidentes excluidos de la confirmación"
          className="rounded-lg border border-info/40 bg-info-soft px-3 py-2 dark:bg-info/15"
        >
          <p className="text-sm font-medium text-info-strong">
            {textoIncidentesExcluidos(incidentes.length)}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {incidentes.map((g) => (
              <li key={g.gestionId} className="text-xs text-info-strong">
                {`Nº Guía ${g.numGuia ?? "—"} · ${g.numRemision} · ${g.destinatario}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------- FICHA 497 (R35): las filas sin guía, ANTES de la lista ----------
          El aviso por fila de la 238 se conserva; este dice el número y la consecuencia arriba,
          antes de que bodega escanee las demás. No lleva `role="note"`: ése es el del BLOQUEO
          (R27) y tiene que seguir siendo el único. */}
      {sinGuia > 0 ? (
        <section
          aria-label={FILAS_SIN_GUIA_LABEL}
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2"
        >
          <p className="text-sm font-medium text-destructive">{textoFilasSinGuia(sinGuia)}</p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* La tarjeta de captura, con sus DOS caminos (R28). `max-w-none` porque la tarjeta nace
            con el ancho de una pantalla de teléfono y acá vive en una columna del modal. */}
        <EscanerGuiaCard
          className="max-w-none"
          ariaLabel="Confirmar por número de guía o escaneo"
          titulo={ESCANER_TITULO}
          descripcion={ESCANER_DESCRIPCION}
          icono={PackageCheck}
          onDecoded={(texto) => {
            onLectura(texto, "camara");
          }}
          mensajeErrorCamara={ESCANER_ERROR_CAMARA}
          manual={{
            onSubmit: (valor) => onLectura(valor, "manual"),
            submitLabel: ESCANER_BOTON,
          }}
          exito={
            ultimaGuiaConfirmada === null ? undefined : (
              <>
                Guía{" "}
                <span className="font-semibold">{ultimaGuiaConfirmada}</span>{" "}
                confirmada.
              </>
            )
          }
        />

        {/* ---------- La lista del conjunto esperado (R33) ----------
            Con su PROPIO desplazamiento acotado: catorce filas caben en un modal alto, pero
            desplazar la lista entera arrastraría también la barra de estado y la tarjeta de
            captura, que son justo lo que hay que tener a la vista mientras se escanea. */}
        <div className="max-h-[45vh] overflow-y-auto pr-1">
          <div className="flex flex-col gap-4">
            {seccionesDeLaLista(filas).map((seccion) => (
              <section key={seccion.key} aria-label={seccion.ariaLabel}>
                <h3 className="mb-1.5 text-sm font-semibold">{seccion.titulo}</h3>
                <ul className="flex flex-col gap-2">
                  {seccion.filas.map((f) => {
                    const confirmada = confirmadas[f.clave] !== undefined;
                    const error = errores[f.clave];
                    const filasDelPaquete = filasPorPaquete.get(clavePaquete(f)) ?? 1;
                    return (
                      <li
                        key={f.clave}
                        // Las filas de gestión conservan `data-gestion` (la 238 las señala por
                        // ahí); las de barrida llevan `data-barrida` con su `ordenId`.
                        data-gestion={f.origen === "gestion" ? f.clave : undefined}
                        data-barrida={f.origen === "barrida" ? f.clave : undefined}
                        className="flex flex-col gap-1 rounded-lg border border-border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {`Nº Guía ${f.numGuia ?? "—"} · ${f.numRemision}`}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {/* FICHA 456 (T3.4, R10): el resultado de la fila con su botón. Una
                                barrida no tiene resultado: lleva el ESTADO al que el corte la
                                pasó (497/R30), con el mismo chip y su botón de información. */}
                            <EstadoConInfo
                              codigo={f.origen === "gestion" ? f.resultado : "novedad_interna"}
                              chip={(nombre) => <Badge variant="outline">{nombre}</Badge>}
                            />
                            <Badge variant={confirmada ? "success" : "warning"}>
                              {confirmada ? FILA_CONFIRMADA : FILA_PENDIENTE}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {`${f.destinatario} · ${f.tiendaNombre}`}
                        </p>
                        {f.numGuia === null ? (
                          <p role="alert" className="text-sm text-destructive">
                            {FILA_SIN_GUIA}
                          </p>
                        ) : null}
                        {/* Dos gestiones vivas de la misma orden = una guía, un bulto. Se nombra
                            para que ver la misma guía dos veces no se lea como un error. Sin
                            `role`: es contenido de la fila, no un aviso aparte — el `role="note"`
                            de la barra de estado es el del BLOQUEO (R27) y tiene que seguir
                            siendo el único, o dejaría de poder señalarse. */}
                        {filasDelPaquete > 1 ? (
                          <p className="text-xs text-muted-foreground">
                            {filaMismoPaquete(filasDelPaquete)}
                          </p>
                        ) : null}
                        {/* T4.7 (238) + R36 (497): el error del servidor de ESA fila, en SU fila.
                            La clave es el `gestionId` o, en una barrida, el `ordenId`. */}
                        {error ? (
                          <p
                            id={`confirmacion-${f.clave}-error`}
                            role="alert"
                            className="text-sm text-destructive"
                          >
                            {error}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
