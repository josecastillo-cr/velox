"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/FormField";
import { Modal } from "@/components/shared/Modal";
import { montoValido } from "@/components/shared/monto-cliente";
import { money } from "@/lib/config/moneda";
import type { MarcaConciliacionActionResult } from "@/lib/actions/conciliacion-satelites";

import {
  CONCILIACION_ACCION,
  CONCILIACION_NOTA_MAX,
  CONCILIACION_RESPUESTA,
  MARCAR_RECIBIDO_ERROR,
  MARCAR_RECIBIDO_TEXTO,
} from "./conciliacion-labels";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 431 (R9/R10) — EL DIÁLOGO DE «MARCAR RECIBIDO».
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// COMPARTIDO, y por eso NO sabe a qué consolidación marca: recibe `onMarcar`, y quien lo monta le
// añade el `cierreBodegaId`. Lo montan las DOS pantallas donde se concilia —el desglose de
// `/wallet/satelites` y la cola de `/cierres-admin`— y ésa es la razón de que viva aquí
// (`docs/architecture.md`: se promueve cuando dos features lo necesitan con la misma API). Molde:
// `components/shared/liquidacion/RegistrarPagoDialog`.
//
// ── MONEY-SAFE (R20): CERO `Number(`, CERO `parseFloat` y CERO restas en este archivo.
// Lo que debe entra como STRING del servidor, PREFIJA el campo tal cual y sale como STRING. La
// única comparación de dinero es la de FORMA del monto, y la hace `montoValido` por texto.
//
// ── FICHA 498 (design §8.4, R16/R16a/R16b) — LO QUE DEBE, NO EL EFECTIVO
// El campo nace con `debe` (el aporte reconocido de la consolidación) si el SERVIDOR dice que es
// positivo, y con `0` si no (el único caso en que el recibido 0 se admite, Q5). Nunca con el
// efectivo: lo recibido es el TOTAL que llegó a la central —lo que entregó la satélite más el SINPE
// o la transferencia consignados directo a la central—, y el diálogo lo dice con el texto literal
// de R16a, con lo recaudado por método a la vista. UN solo campo de monto (R16b).
//
// ── EL MONTO NACE PRECARGADO, Y ES LA DECISIÓN DE DISEÑO DEL DIÁLOGO
// El caso abrumadoramente mayoritario es que el bulto llegue entero: en producción, 32 de 32
// consolidaciones en dos semanas. Con el campo vacío, cada conciliación normal costaría teclear
// un importe de seis cifras, y ahí es donde se cuelan los errores de tecleo en una marca que
// después hay que deshacer. Precargado, la conciliación normal es un clic y la EXCEPCIÓN —contar
// una cantidad distinta— es la que pide trabajo. La pista lo dice con todas sus letras.
//
// ⚠️ PRECARGAR NO ES AUTO-MARCAR. La alternativa E del diseño —que consolidar creara la
// consolidación ya marcada— se descartó porque pone el saldo en cero por defecto y hace invisible
// el bulto que no llegó. Aquí sigue habiendo un acto explícito de una persona: lo que se ahorra
// es teclear, no mirar.
//
// ── QUÉ NO HACE ESTE DIÁLOGO
// No compara el monto contra lo que debe ni avisa de la diferencia: recibir MENOS es legítimo
// (R18, es el caso entero de la ficha) y recibir MÁS también (llegó de más, §1.2). Un aviso de
// «no coincide» convertiría el caso que hay que poder registrar en algo que parece un error.

/** Lo que este formulario sabe componer. El `cierreBodegaId` lo pone quien lo monta. */
export interface MarcarRecibidoCampos {
  montoRecibido: string;
  nota?: string;
}

/** FICHA 498 (R16a) — lo recaudado por método, STRINGs del servidor. Solo se pintan. */
export interface RecaudadoPorMetodo {
  efectivo: string;
  simpe: string;
  transferencia: string;
}

/** FICHA 498 (R16) — lo que debe la consolidación y si es positivo, AMBOS decididos por el servidor. */
export interface DebeDeLaConsolidacion {
  monto: string;
  positivo: boolean;
}

/** FICHA 498 (Q5) — el cero escrito como lo admite el borde (`montoCeroSchema`): 0, 0.0 o 0.00. */
const MONTO_CERO = /^0(\.0{1,2})?$/;

export interface MarcarRecibidoDialogProps {
  /** Visibilidad controlada por el padre (mismo contrato que `Modal`). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nombre de la bodega: da nombre accesible al diálogo y distingue un bulto de otro. */
  bodega: string;
  /** Día de la consolidación, YA formateado por quien lo monta (aquí no se formatean fechas). */
  fecha: string;
  /** FICHA 498 (R16a) — lo recaudado por método, pintado encima del campo. */
  recaudado: RecaudadoPorMetodo;
  /**
   * FICHA 498 (R16) — lo que debe (aporte reconocido) y su signo, del servidor. Prefija el campo:
   * `monto` si es positivo, `0` si no. `null` cuando quien monta no lo tiene del servidor: el campo
   * arranca VACÍO —nunca con el efectivo— y la banda «Debe» no se pinta.
   */
  debe: DebeDeLaConsolidacion | null;
  /**
   * El monto ya marcado, si se está CORRIGIENDO una conciliación existente. Cuando llega, el
   * campo arranca con él —no con lo que debe— porque corregir es partir de lo que se dijo antes,
   * y el título cambia para que nadie crea que está marcando algo que ya estaba marcado.
   */
  montoActual?: string | null;
  /** Nota ya guardada, si se corrige. Misma lógica que `montoActual`. */
  notaActual?: string | null;
  /** Envía la marca. La aporta quien monta, que es quien sabe de qué consolidación se trata. */
  onMarcar: (campos: MarcarRecibidoCampos) => Promise<MarcaConciliacionActionResult>;
  /** Se invoca cuando el servidor confirmó, con el monto que quedó registrado. */
  onMarcado?: (montoRecibido: string) => void | Promise<void>;
  /**
   * 473 (R17) — el servidor respondió `conflict`: la consolidación ya no está en el estado en que
   * se abrió el diálogo. Con este manejador el diálogo SE CIERRA y delega el aviso y el refresco
   * en quien lo monta, que es quien sabe qué lista releer. Sin él conserva el comportamiento
   * anterior: el aviso dentro del diálogo, que queda abierto.
   */
  onConflicto?: () => void | Promise<void>;
}

/** Traduce la respuesta del servidor a un aviso. Fuera del componente para que el `switch` sea
 *  EXHAUSTIVO sobre el resultado: un estado nuevo en el contrato rompe el build en vez de caer
 *  en un `default` mudo. */
function avisoDe(resultado: MarcaConciliacionActionResult): string {
  switch (resultado.status) {
    case "ok":
      return "";
    case "conflict":
      return CONCILIACION_RESPUESTA.conflicto;
    case "no_encontrada":
      return CONCILIACION_RESPUESTA.noEncontrada;
    case "forbidden":
      return CONCILIACION_RESPUESTA.forbidden;
    // FICHA 498 (R15a): recibido 0 con dinero por entregar. No cambió nada; el diálogo queda abierto.
    case "recibido_cero_con_aporte":
      return CONCILIACION_RESPUESTA.reciboCeroConAporte;
    case "unauthenticated":
      return CONCILIACION_RESPUESTA.unauthenticated;
    case "validation_error":
      // Los mensajes van por campo; el aviso general se deja vacío para no duplicarlos.
      return "";
  }
}

export function MarcarRecibidoDialog({
  open,
  onOpenChange,
  bodega,
  fecha,
  recaudado,
  debe,
  montoActual = null,
  notaActual = null,
  onMarcar,
  onMarcado,
  onConflicto,
}: Readonly<MarcarRecibidoDialogProps>) {
  const esCorreccion = montoActual !== null;
  const idBase = useId();
  const campoId = (nombre: string) => `${idBase}-${nombre}`;

  // El valor de partida: lo ya marcado si se corrige; si se marca por primera vez, lo que debe (o 0
  // si el servidor dice que no debe nada, R16). Sin ese dato, vacío: nunca el efectivo.
  const partida = montoActual ?? (debe === null ? "" : debe.positivo ? debe.monto : "0");

  const [monto, setMonto] = useState(partida);
  const [nota, setNota] = useState(notaActual ?? "");
  const [abiertoAntes, setAbiertoAntes] = useState(open);
  const [errorMonto, setErrorMonto] = useState<string | undefined>(undefined);
  const [errorNota, setErrorNota] = useState<string | undefined>(undefined);
  const [aviso, setAviso] = useState<string | null>(null);

  // Transición CERRADO → ABIERTO: se ajusta el estado DURANTE el render, que es la forma que
  // React documenta para reaccionar a un cambio de prop. Con un efecto sería un `setState` en
  // cascada, que en este repo es error de lint (`react-hooks/set-state-in-effect`).
  //
  // A diferencia de `RegistrarPagoDialog`, aquí el formulario SÍ se reinicia en cada apertura y
  // es correcto: esta acción no lleva clave de idempotencia porque su guarda es el propio estado
  // —marcar dos veces responde `conflict` (R11)— y el asiento de la 498 vive en la MISMA
  // transacción que la marca, así que tampoco se duplica.
  // Conservar un borrador entre aperturas haría que abrir OTRA consolidación heredara el monto
  // tecleado para la anterior, que en una pantalla de dinero es peor que volver a teclear.
  if (open !== abiertoAntes) {
    setAbiertoAntes(open);
    if (open) {
      setMonto(partida);
      setNota(notaActual ?? "");
      setErrorMonto(undefined);
      setErrorNota(undefined);
      setAviso(null);
    }
  }

  const notaLimpia = nota.trim();
  // Misma forma que revalida el borde: `montoPositivoSchema` (> 0, hasta dos decimales) o, desde la
  // 498 (Q5), el cero literal. Sin tope por arriba, porque el schema compartido tampoco lo tiene: el
  // cliente no puede ser más estricto que su propio servidor. Si el cero se admite para ESTA
  // consolidación lo decide el servidor (`recibido_cero_con_aporte`).
  const montoOk = montoValido(monto) || MONTO_CERO.test(monto.trim());
  const notaOk = notaLimpia.length <= CONCILIACION_NOTA_MAX;
  const formularioValido = montoOk && notaOk;

  async function confirmar() {
    if (!formularioValido) {
      setErrorMonto(montoOk ? undefined : MARCAR_RECIBIDO_ERROR.monto);
      setErrorNota(notaOk ? undefined : MARCAR_RECIBIDO_ERROR.notaLarga(CONCILIACION_NOTA_MAX));
      return;
    }
    setErrorMonto(undefined);
    setErrorNota(undefined);
    setAviso(null);

    const montoLimpio = monto.trim();
    let resultado: MarcaConciliacionActionResult;
    try {
      // La nota VACÍA no se manda: el schema del borde es `.strict()` y la declara opcional, así
      // que una cadena vacía sería una nota en blanco guardada como si alguien la hubiera escrito.
      resultado = await onMarcar({
        montoRecibido: montoLimpio,
        ...(notaLimpia ? { nota: notaLimpia } : {}),
      });
    } catch {
      setAviso(CONCILIACION_RESPUESTA.fallo);
      return;
    }

    if (resultado.status === "ok") {
      await onMarcado?.(montoLimpio);
      onOpenChange(false);
      return;
    }
    if (resultado.status === "validation_error") {
      setErrorMonto(resultado.fieldErrors.montoRecibido?.[0] ?? MARCAR_RECIBIDO_ERROR.monto);
      setErrorNota(resultado.fieldErrors.nota?.[0]);
      return;
    }
    if (resultado.status === "conflict" && onConflicto) {
      onOpenChange(false);
      await onConflicto();
      return;
    }
    setAviso(avisoDe(resultado));
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={esCorreccion ? MARCAR_RECIBIDO_TEXTO.tituloCorregir : MARCAR_RECIBIDO_TEXTO.titulo}
      description={MARCAR_RECIBIDO_TEXTO.descripcion(bodega, fecha)}
      confirmLabel={
        esCorreccion ? MARCAR_RECIBIDO_TEXTO.confirmarCorregir : MARCAR_RECIBIDO_TEXTO.confirmar
      }
      cancelLabel={CONCILIACION_ACCION.cancelar}
      confirmDisabled={!formularioValido}
      onConfirm={confirmar}
      /* El cierre lo decide `confirmar`: un rechazo del servidor deja el diálogo abierto con lo
         que la persona escribió, en vez de tragarse el monto tecleado. */
      closeOnConfirm={false}
      size="md"
    >
      <div className="flex flex-col gap-4">
        {/* LO QUE DEBE, en su propia banda: es el número contra el que se compara mentalmente
            lo que llegó, así que tiene que leerse sin buscarlo. Se pinta TAL CUAL (también si es
            cero o negativo). `tabular-nums` para que las cifras se alineen con las del campo. */}
        {debe === null ? null : (
          <div
            data-banda="debe"
            className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5"
          >
            <span className="text-sm text-muted-foreground">{MARCAR_RECIBIDO_TEXTO.debe}</span>
            <strong className="text-base font-semibold tabular-nums text-foreground">
              {money(debe.monto)}
            </strong>
          </div>
        )}

        {/* FICHA 498 (R16a) — lo recaudado por método y el texto literal: lo recibido es el TOTAL. */}
        <div className="flex flex-col gap-2">
          <dl
            aria-label={MARCAR_RECIBIDO_TEXTO.recaudado}
            data-bloque="recaudado"
            className="grid grid-cols-3 gap-2 text-sm"
          >
            {(["efectivo", "simpe", "transferencia"] as const).map((metodo) => (
              <div key={metodo} className="flex flex-col gap-0.5 rounded-md border px-2.5 py-1.5">
                <dt className="text-xs text-muted-foreground">
                  {MARCAR_RECIBIDO_TEXTO.metodo[metodo]}
                </dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {money(recaudado[metodo])}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">{MARCAR_RECIBIDO_TEXTO.recibidoEsTotal}</p>
        </div>

        {aviso ? (
          <p role="alert" className="text-sm text-destructive">
            {aviso}
          </p>
        ) : null}

        <FormField
          id={campoId("monto")}
          label={MARCAR_RECIBIDO_TEXTO.montoRecibido}
          hint={
            debe === null || esCorreccion
              ? MARCAR_RECIBIDO_TEXTO.montoAyudaSinDebe
              : MARCAR_RECIBIDO_TEXTO.montoAyuda
          }
          required
          error={errorMonto}
        >
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              className="tabular-nums focus-visible:ring-3 focus-visible:ring-ring"
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value);
                setErrorMonto(undefined);
              }}
              placeholder="0.00"
            />
          )}
        </FormField>

        <FormField
          id={campoId("nota")}
          label={MARCAR_RECIBIDO_TEXTO.nota}
          hint={MARCAR_RECIBIDO_TEXTO.notaAyuda}
          error={errorNota}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              className="focus-visible:ring-3 focus-visible:ring-ring"
              value={nota}
              onChange={(e) => {
                setNota(e.target.value);
                setErrorNota(undefined);
              }}
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}
