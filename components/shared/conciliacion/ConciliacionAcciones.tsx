"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/Modal";
import { useToast } from "@/hooks/useToast";
import {
  corregirConsolidacionRecibidaAction,
  marcarConsolidacionRecibidaAction,
  revertirConciliacionAction,
} from "@/lib/actions/conciliacion-satelites";
import type {
  MarcaConciliacionActionResult,
  RevertirConciliacionActionResult,
} from "@/lib/actions/conciliacion-satelites";
import { money } from "@/lib/config/moneda";
import {
  estadoConciliacionDe,
  llegoDeMas,
  type EstadoConciliacion,
} from "@/app/(app)/cierres-admin/_components/cierre-labels";

import {
  CONCILIACION_ACCION,
  CONCILIACION_RESPUESTA,
} from "./conciliacion-labels";
import {
  MarcarRecibidoDialog,
  type DebeDeLaConsolidacion,
  type MarcarRecibidoCampos,
  type RecaudadoPorMetodo,
} from "./MarcarRecibidoDialog";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 431 (R25) — LAS DOS ACCIONES DE UNA CONSOLIDACIÓN: marcar recibido y deshacer la marca.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// COMPARTIDO por las dos pantallas que concilian: el desglose de `/wallet/satelites` (donde la
// central persigue el efectivo bodega por bodega) y la cola de `/cierres-admin` (donde el mismo
// botón sustituye al «Aprobar» que esta ficha retira). Mismo componente y no dos: son la misma
// acción sobre la misma fila, y dos copias acabarían diciendo cosas distintas sobre si el dinero
// llegó — que es exactamente el defecto que esta ficha vino a cerrar.
//
// ── UN BOTÓN, Y SÓLO EL QUE APLICA
//   sin conciliar        → «Marcar recibido» (primario: es lo que hay que hacer)
//   recibido incompleto  → «Corregir»        (no se re-marca: se cambia el monto que se dijo)
//   recibido de más      → «Corregir»        (FICHA 502: el badge sigue diciendo «Recibido»)
//   recibido sin dinero  → «Desmarcar»       (discreto: es una corrección, no una operación)
//
// FICHA 500 (R3/R5/R6): «Desmarcar» sale SOLO si quien monta pasa `puedeDesmarcar` — conciliada, sin
// dinero en la caja y no saldada con la regla anterior, decidido en el SERVIDOR con los mismos dos
// cortes con los que `revertirConciliacion` responde. Una «Recibido incompleto» sigue ofreciendo
// «Corregir» se pueda desmarcar o no, y una recibida de más también (502/R7).
//
// Los tres estados salen de `estadoConciliacionDe`, la MISMA función que pinta el badge, así que
// el rótulo del botón y el del estado no pueden contradecirse. «De más» no es un estado: lo añade
// `llegoDeMas` sobre el `faltaPorRecibir` que el servidor ya manda.
//
// ── POR QUÉ «DESMARCAR» PIDE CONFIRMACIÓN Y «MARCAR» NO
// Marcar abre un diálogo donde se ve lo que debe y se teclea el monto, así que ya hay un paso donde
// mirar. Desmarcar es un clic que, sin nada delante, borra el rastro de quién dijo que el dinero
// llegó y de cuánto. La confirmación lleva escrito el importe que se va a borrar. FICHA 502 (R1): y NO
// la nota de la conciliación, que dice que después no se puede desmarcar justo donde sí se puede; la
// nota sigue al pie de `/wallet/satelites` y en la ayuda (R3).
//
// ── FICHA 498 (R20/R21) — MARCAR ASIENTA EL DINERO, Y YA NO SE DESMARCA
// Desde la 498, marcar recibido asienta en la caja el dinero de los cierres de la consolidación.
// Con asientos, el servidor responde a «Desmarcar» con `con_asientos` sin cambiar nada, y la
// pantalla lo dice DENTRO del diálogo (R21), que queda abierto: la marca sigue tal cual y lo que hay
// que hacer es «Corregir». Desde la 500 el botón ni aparece en una con dinero; el aviso SE CONSERVA
// para la pantalla abierta desde antes de que otra persona marcara (datos viejos): el servidor sigue
// siendo la última palabra (500/R7).
//
// ── QUIÉN DECIDE EL PERMISO: EL SERVIDOR
// `puedeConciliar` baja por props desde un Server Component que lo resolvió con `esAccesoTotal`,
// el MISMO predicado con el que `ConciliacionSatelitesService` responde `forbidden` (R27). Son
// las dos mitades del control: ocultar el botón no es una de ellas por sí solo. **Default
// `false`: falla cerrado** — quien monte esto sin decidir el permiso no ofrece conciliar nada.

export interface ConciliacionAccionesProps {
  cierreBodegaId: string;
  /** Nombre de la bodega, para el diálogo y para los nombres accesibles. */
  bodega: string;
  /** Día de la consolidación YA formateado por quien lo monta. */
  fecha: string;
  /** FICHA 498 (R16a) — lo recaudado por método, STRINGs del servidor. */
  recaudado: RecaudadoPorMetodo;
  /**
   * FICHA 498 (R16) — lo que debe y su signo, del servidor. `null` si quien monta no lo tiene: el
   * diálogo arranca vacío, nunca con el efectivo.
   */
  debe: DebeDeLaConsolidacion | null;
  /** La marca de hoy, tal como llega del servidor. Aquí no se deriva nada de dinero. */
  marca: { conciliado: boolean; faltaPorRecibir: string; montoRecibido: string | null };
  /** Nota ya guardada, si la hay: el diálogo de corregir parte de ella. */
  nota?: string | null;
  /** Ver la cabecera. Default `false`: falla cerrado. */
  puedeConciliar?: boolean;
  /**
   * FICHA 500 (R3/R6) — ¿se ofrece «Desmarcar»? Lo calcula el SERVIDOR (sin dinero y no saldada con
   * la regla anterior). Default `false`: falla cerrado, igual que `puedeConciliar`.
   */
  puedeDesmarcar?: boolean;
  /**
   * Refresco DIRIGIDO tras marcar o desmarcar. Lo aporta quien monta porque es quien sabe qué
   * claves de SWR describen SU pantalla: la de saldos invalida su tabla y su desglose; la cola de
   * `/cierres-admin` invalida sus dos listados. Un `mutate()` sin argumentos refrescaría también
   * los desgloses de las demás bodegas abiertas, que es una consulta por fila sin motivo.
   */
  onCambio?: () => void | Promise<void>;
}

/** El tamaño de los botones de una fila de tabla: `sm`, como el resto de acciones de fila. */
const TAMANO = "sm" as const;

export function ConciliacionAcciones({
  cierreBodegaId,
  bodega,
  fecha,
  recaudado,
  debe,
  marca,
  nota = null,
  puedeConciliar = false,
  puedeDesmarcar = false,
  onCambio,
}: Readonly<ConciliacionAccionesProps>) {
  const toast = useToast();
  const [marcando, setMarcando] = useState(false);
  const [desmarcando, setDesmarcando] = useState(false);
  /** FICHA 498 (R21) — el aviso de `con_asientos`, dentro del diálogo de «Desmarcar». */
  const [avisoDesmarcar, setAvisoDesmarcar] = useState<string | null>(null);

  if (!puedeConciliar) return null;

  const estado: EstadoConciliacion = estadoConciliacionDe(marca);

  // 473 (R14) — UN ENVÍO POR MODO. «Corregir» sólo existe sobre una «Recibido incompleto» o, desde la
  // 502 (R7/R9), una recibida de más, y las dos YA están conciliadas: mandarlas a la action de marcar
  // —cuyo `WHERE` exige una SIN marcar— era un `conflict` garantizado sin escribir nada. Corregir
  // sustituye el monto y la deja conciliada. Esta misma condición decide el botón y el envío, para que
  // no puedan separarse; y exige `recibido` porque una SIN marcar que debe un negativo también trae la
  // falta negativa (R8).
  const esCorreccion =
    estado === "incompleto" || (estado === "recibido" && llegoDeMas(marca.faltaPorRecibir));

  async function enviar(campos: MarcarRecibidoCampos): Promise<MarcaConciliacionActionResult> {
    const input = { ...campos, cierreBodegaId };
    return esCorreccion
      ? corregirConsolidacionRecibidaAction(input)
      : marcarConsolidacionRecibidaAction(input);
  }

  /** R16 — el aviso dice el monto que QUEDÓ registrado, con el verbo de lo que se hizo. */
  async function trasEnviar(montoRecibido: string) {
    toast.success(
      esCorreccion
        ? CONCILIACION_RESPUESTA.corregida(montoRecibido)
        : CONCILIACION_RESPUESTA.marcada(montoRecibido),
    );
    await onCambio?.();
  }

  /** R17 — el diálogo ya se cerró; el aviso promete «Actualizando la lista», y se cumple. */
  async function trasConflicto() {
    toast.error(CONCILIACION_RESPUESTA.conflicto);
    await onCambio?.();
  }

  /** R12 — deshacer. No lleva monto: el que había se BORRA (y sobrevive en el historial). */
  async function confirmarDesmarcar() {
    let resultado: RevertirConciliacionActionResult;
    try {
      resultado = await revertirConciliacionAction({ cierreBodegaId });
    } catch {
      toast.error(CONCILIACION_RESPUESTA.fallo);
      return;
    }
    if (resultado.status === "ok") {
      toast.success(CONCILIACION_RESPUESTA.revertida);
    } else if (resultado.status === "conflict") {
      toast.error(CONCILIACION_RESPUESTA.conflicto);
    } else if (resultado.status === "no_encontrada") {
      toast.error(CONCILIACION_RESPUESTA.noEncontrada);
    } else if (resultado.status === "forbidden") {
      toast.error(CONCILIACION_RESPUESTA.forbidden);
    } else if (resultado.status === "unauthenticated") {
      toast.error(CONCILIACION_RESPUESTA.unauthenticated);
    } else if (resultado.status === "con_asientos") {
      // FICHA 498 (R21): ya entró a la caja. No cambió nada: el diálogo queda abierto con el aviso
      // y no se refresca nada (no hay nada nuevo que leer).
      setAvisoDesmarcar(CONCILIACION_RESPUESTA.conAsientos);
      return;
    } else if (resultado.status === "saldada_regla_anterior") {
      // FICHA 498 (revisión m2): saldada con la regla anterior, no se revierte. Mismo trato que
      // `con_asientos`: no cambió nada, el diálogo queda abierto con el aviso y no se relee nada.
      setAvisoDesmarcar(CONCILIACION_RESPUESTA.saldadaReglaAnterior);
      return;
    } else {
      toast.error(CONCILIACION_RESPUESTA.fallo);
    }
    setDesmarcando(false);
    await onCambio?.();
  }

  // El nombre accesible lleva SIEMPRE la bodega y el día: una pantalla puede tener veinte filas
  // abiertas, y veinte botones llamados «Marcar recibido» no identifican ninguna para quien
  // navega con lector de pantalla.
  const sufijo = `de ${bodega} del ${fecha}`;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {estado === "pendiente" ? (
        <Button
          type="button"
          size={TAMANO}
          aria-label={`${CONCILIACION_ACCION.marcar} la consolidación ${sufijo}`}
          onClick={() => setMarcando(true)}
        >
          {CONCILIACION_ACCION.marcar}
        </Button>
      ) : null}

      {esCorreccion ? (
        <Button
          type="button"
          size={TAMANO}
          variant="outline"
          aria-label={`${CONCILIACION_ACCION.corregir} el monto recibido ${sufijo}`}
          onClick={() => setMarcando(true)}
        >
          {CONCILIACION_ACCION.corregir}
        </Button>
      ) : null}

      {estado !== "pendiente" && puedeDesmarcar ? (
        <Button
          type="button"
          size={TAMANO}
          variant="ghost"
          aria-label={`${CONCILIACION_ACCION.desmarcar} la consolidación ${sufijo}`}
          onClick={() => {
            setAvisoDesmarcar(null);
            setDesmarcando(true);
          }}
        >
          {CONCILIACION_ACCION.desmarcar}
        </Button>
      ) : null}

      <MarcarRecibidoDialog
        open={marcando}
        onOpenChange={setMarcando}
        bodega={bodega}
        fecha={fecha}
        recaudado={recaudado}
        debe={debe}
        montoActual={estado === "pendiente" ? null : marca.montoRecibido}
        notaActual={nota}
        onMarcar={enviar}
        onMarcado={trasEnviar}
        onConflicto={trasConflicto}
      />

      <Modal
        open={desmarcando}
        onOpenChange={setDesmarcando}
        title={CONCILIACION_ACCION.desmarcar}
        description={`Consolidación de ${bodega} del ${fecha}.`}
        confirmLabel={CONCILIACION_ACCION.desmarcar}
        cancelLabel={CONCILIACION_ACCION.cancelar}
        onConfirm={confirmarDesmarcar}
        closeOnConfirm={false}
        size="md"
      >
        <div className="flex flex-col gap-3 text-sm">
          {/* El importe que se va a borrar, dicho antes de borrarlo. Es el dato que falta para
              decidir, y tras la reversión sólo sobrevive en el registro de acciones. */}
          {marca.montoRecibido === null ? null : (
            <p className="text-muted-foreground">
              Ahora mismo consta recibida por{" "}
              <strong className="font-semibold tabular-nums text-foreground">
                {money(marca.montoRecibido)}
              </strong>
              .
            </p>
          )}
          {/* FICHA 498 (R21): con asientos, el servidor no deshace nada y lo decimos aquí. */}
          {avisoDesmarcar === null ? null : (
            <p role="alert" data-aviso="con-asientos" className="font-medium text-destructive">
              {avisoDesmarcar}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
