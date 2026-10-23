"use client";

import type { CajaResumenDTO, ModoComposicionCaja } from "@/lib/types/wallet";
import { cn } from "@/lib/utils";

import { composicionCajaNombreAccesible } from "./wallet-labels";

// Feature 231 (T4.2, design §4.2) — la barra de composicion de la caja.
//
// Que es: la cifra grande de «Dinero en caja» partida en las DOS porciones que la componen,
// la de las TIENDAS y la de ORDENEX. No hay una tercera porcion ni un residuo escondido: la
// identidad `enCaja = deTerceros + deOrdenex` (ficha 459: «De Ordenex» = ganancia + capital) la
// deriva el servidor y esta comprobada en `lib/utils/caja-tesoreria.ts`.
//
// Ficha 459 (R22): la tarjeta SOLO la monta en estado «saldo». Sin un saldo inicial vigente la
// app no sabe cuanto dinero hay, y repartir «el dinero en caja» seria repartir una cifra que no es.
//
// Que NO es, y por que importa:
//
//  - NO es un `Progress` de Radix (design §6.1). Aquel recibe `value: number`, asi que
//    alimentarlo exigiria convertir el porcentaje a numero EN EL NAVEGADOR — la llamada que
//    R12 prohibe— y ademas representa UNA magnitud sobre un total, no una composicion de dos
//    porciones con cuatro modos degenerados.
//  - NO decide nada (R21). El modo y el porcentaje llegan del servidor ya derivados; aqui no
//    se compara un importe con otro ni se lee `signoGanancia` para adivinar la forma.
//  - NO es interactiva (R8): la tarjeta que la contiene no admite ni un solo control.
//
// Money-safe (R12): `porcentajeTiendas` viaja como STRING y se pega TAL CUAL dentro de la
// unidad `%`. El segundo segmento NO lleva porcentaje: ocupa el resto con `flex-1`, de modo
// que un redondeo de centesima no puede abrir un hilo blanco al final de la barra ni
// desbordarla (design §6.5).
//
// Ficha 488 (decision 1a, design §2.3/§6.2, R14–R16) — un TERCER bolsillo, «IVA por pagar». El IVA
// cobrado a las tiendas sale de «De Ordenex» y se pinta aparte. El navegador sigue sin comparar
// importes: si hay porcion de IVA lo dice el SERVIDOR (`signoIvaPorPagar`), y su ancho es otro
// STRING del DTO (`porcentajeIva`). Con el IVA en cero o negativo la barra es EXACTAMENTE la de antes
// de la ficha (R16): mismos segmentos, mismas medidas, mismo orden.

/**
 * Ficha 488 — color del IVA por pagar. `bg-chart-13` y no `bg-info`: los semanticos base son hexes
 * FIJOS y `bg-info` se funde con la pista `bg-muted` en tema oscuro (2.34:1, medido en
 * `TableroDiaComposicion.test.tsx`); `chart-13` gira con el tema y supera el 3:1 en los dos. Distinto
 * tambien de `bg-warning` (tiendas), de `bg-muted-foreground` (Ordenex) y del `bg-info` del capital
 * en el libro. El libro lo reutiliza para su punto de dueño `iva`: es el mismo bolsillo.
 */
export const COLOR_IVA_POR_PAGAR = "bg-chart-13";

/** Alto de la barra. Una banda fina: acompaña a la cifra, no compite con ella. */
const PISTA = "flex h-2 w-full overflow-hidden rounded-full bg-muted";

/**
 * Un segmento pintado: de quien es, con que color y como se mide.
 *
 *  - `porcentaje` → el ancho es un STRING del DTO: el de las tiendas (R11) o, desde la ficha 488,
 *                   el del IVA (`campo`).
 *  - `resto`      → lo que quede (`flex-1`), sin numero propio.
 *  - `todo`       → la barra entera, cuando no hay reparto que hacer.
 */
type Medida = "porcentaje" | "resto" | "todo";

interface Segmento {
  clave: "tiendas" | "ordenex" | "iva";
  /** Color por TOKEN (R39). Ni un hex, ni una utilidad de paleta ad-hoc. */
  color: string;
  medida: Medida;
  /** Solo con `medida: "porcentaje"`: QUE campo STRING del DTO da el ancho. */
  campo?: "porcentajeTiendas" | "porcentajeIva";
}

const ANCHO: Record<Medida, string> = {
  porcentaje: "shrink-0",
  resto: "flex-1",
  todo: "w-full",
};

/**
 * Los CUATRO modos, en un `Record` TOTAL (design §4.2): un modo nuevo en el servidor rompe el
 * build de esta pantalla en vez de caer en un `default` que pintaria cualquier cosa.
 *
 *  - `dos_bolsillos` — los dos segmentos. Tiendas en `warning` (es dinero que hay que
 *    entregar, no una alarma) y Ordenex en superficie NEUTRA: `DESIGN.md` reserva el acento
 *    para accion y estado, y la ganancia normal no es ninguna de las dos cosas (R5).
 *  - `solo_tiendas` — la barra ENTERA en `warning` (R16): Ordenex esta en perdida y lo que
 *    queda en la caja es dinero de las tiendas.
 *  - `solo_ordenex` — el espejo (R17, D4): no queda nada de las tiendas.
 *  - `sin_reparto` — CERO segmentos (R18/R20): la pista neutra vacia, sin porcentaje alguno.
 */
const SEGMENTOS_POR_MODO: Record<ModoComposicionCaja, readonly Segmento[]> = {
  dos_bolsillos: [
    { clave: "tiendas", color: "bg-warning", medida: "porcentaje", campo: "porcentajeTiendas" },
    { clave: "ordenex", color: "bg-muted-foreground", medida: "resto" },
  ],
  solo_tiendas: [{ clave: "tiendas", color: "bg-warning", medida: "todo" }],
  solo_ordenex: [{ clave: "ordenex", color: "bg-muted-foreground", medida: "todo" }],
  sin_reparto: [],
};

/**
 * Ficha 488 (design §2.3) — los segmentos cuando el IVA por pagar es POSITIVO. Mismo `Record` total
 * sobre los cuatro modos (el modo se sigue derivando de «De Ordenex» y «De las tiendas»). El ultimo
 * segmento de cada lista ocupa el resto, asi que un redondeo no abre hueco.
 */
const SEGMENTOS_CON_IVA_POR_MODO: Record<ModoComposicionCaja, readonly Segmento[]> = {
  dos_bolsillos: [
    { clave: "tiendas", color: "bg-warning", medida: "porcentaje", campo: "porcentajeTiendas" },
    { clave: "iva", color: COLOR_IVA_POR_PAGAR, medida: "porcentaje", campo: "porcentajeIva" },
    { clave: "ordenex", color: "bg-muted-foreground", medida: "resto" },
  ],
  solo_tiendas: [
    { clave: "tiendas", color: "bg-warning", medida: "porcentaje", campo: "porcentajeTiendas" },
    { clave: "iva", color: COLOR_IVA_POR_PAGAR, medida: "resto" },
  ],
  solo_ordenex: [
    { clave: "iva", color: COLOR_IVA_POR_PAGAR, medida: "porcentaje", campo: "porcentajeIva" },
    { clave: "ordenex", color: "bg-muted-foreground", medida: "resto" },
  ],
  sin_reparto: [
    { clave: "iva", color: COLOR_IVA_POR_PAGAR, medida: "porcentaje", campo: "porcentajeIva" },
  ],
};

export interface BarraComposicionCajaProps {
  /** El resumen ENTERO, ya derivado en el servidor: modo, porcentaje y los dos importes. */
  resumen: CajaResumenDTO;
  className?: string;
}

export function BarraComposicionCaja({ resumen, className }: BarraComposicionCajaProps) {
  // R16: sin IVA por pagar positivo (lo dice el signo del SERVIDOR), la barra de siempre.
  const segmentos =
    resumen.signoIvaPorPagar === "positivo"
      ? SEGMENTOS_CON_IVA_POR_MODO[resumen.modoComposicion]
      : SEGMENTOS_POR_MODO[resumen.modoComposicion];

  return (
    <div
      // R13: el nombre accesible enuncia las DOS porciones con su rotulo y su importe. Sin el,
      // quien usa lector de pantalla oiria «imagen» y nada mas. `role="img"` deja los
      // segmentos fuera del arbol accesible, que es lo correcto: son pintura.
      role="img"
      aria-label={composicionCajaNombreAccesible(resumen)}
      data-modo={resumen.modoComposicion}
      className={cn(PISTA, className)}
    >
      {segmentos.map((segmento) => (
        <span
          key={segmento.clave}
          data-segmento={segmento.clave}
          className={cn(ANCHO[segmento.medida], segmento.color)}
          // El ancho es un DATO de la respuesta, no una clase: Tailwind lee el fuente y no
          // puede generar `w-[83.33%]` en tiempo de ejecucion. El STRING entra tal cual.
          style={
            segmento.medida === "porcentaje" && segmento.campo
              ? { width: `${resumen[segmento.campo]}%` }
              : undefined
          }
        />
      ))}
    </div>
  );
}
