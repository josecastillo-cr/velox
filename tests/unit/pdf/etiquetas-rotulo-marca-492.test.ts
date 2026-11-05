import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";

import { HOJAS_ETIQUETA } from "@/lib/config/etiquetas-hoja";
import { drawEtiqueta, ROTULO_GUIA } from "@/lib/pdf/etiquetas-dibujo";
import { fuenteEtiqueta } from "@/lib/pdf/etiquetas-fuente";
import { registrarFuente } from "@/lib/pdf/etiquetas-fuente-registro";
import { crearLayout } from "@/lib/pdf/etiquetas-layout";

import { CASO_EVIDENCIA } from "../../fixtures/etiquetas-282";
import { leerEtiqueta } from "./etiquetas-verificacion";

import { MARCA_RETIRADA, MARCA_RETIRADA_RE } from "@/tests/fixtures/marca-retirada-nombre-493";
// Feature 492 (R16, P2) — el rotulo de marca de la cabecera de la etiqueta es «VELOX · GUÍA».
// LITERAL DE CONTRATO a proposito: compararlo contra `ROTULO_GUIA` seria compararlo consigo mismo.
// La capacidad por hoja (R17) la fijan, SIN editar, `etiquetas-capacidad`, `etiquetas-diseno-353`,
// `etiquetas-caracter-no-cubierto`, `components/etiquetas-pdf` y la guardia de la maqueta unica.

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function dibujar(hoja: (typeof HOJAS_ETIQUETA)[number]) {
  const doc = new jsPDF({ unit: "mm", format: [hoja.anchoMm, hoja.altoMm] });
  registrarFuente(doc, fuenteEtiqueta);
  const layout = crearLayout(hoja);
  drawEtiqueta(doc, layout, CASO_EVIDENCIA.dto, { qr: PNG_1X1, barcode: PNG_1X1 }, fuenteEtiqueta);
  const bytes = new Uint8Array(Buffer.from(doc.output("arraybuffer")));
  return { leida: leerEtiqueta(doc, bytes, 0, hoja.altoMm, fuenteEtiqueta), bytes };
}

describe("Feature 492 — rotulo de marca de la etiqueta (R16)", () => {
  it("vale «VELOX · GUÍA» (contrato literal, P2)", () => {
    expect(ROTULO_GUIA).toBe("VELOX · GUÍA");
  });

  it("se dibuja en negro: el codigo de la etiqueta no cambia nunca el color del texto", () => {
    // jsPDF dibuja en negro por defecto; la termica imprime negro puro. Un `setTextColor` en el
    // dibujo de la etiqueta haria gris o color el rotulo.
    for (const rel of ["lib/pdf/etiquetas-dibujo.ts", "lib/pdf/etiquetas-maqueta.ts"]) {
      const codigo = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(codigo, rel).not.toMatch(/setTextColor/);
    }
  });

  it.each(HOJAS_ETIQUETA.map((h) => [h.id, h] as const))(
    `hoja %s: la etiqueta lleva el rotulo en Helvetica negrita, dentro de la hoja, y no dice ${MARCA_RETIRADA.toUpperCase()}`,
    (_id, hoja) => {
      const { leida } = dibujar(hoja);
      const rotulo = leida.textos.find((t) => t.texto === "VELOX · GUÍA");
      expect(rotulo, "falta «VELOX · GUÍA» en el PDF").toBeDefined();
      // Tipografia estandar en negrita (no la embebida) y sin logo grafico anadido: el rotulo es texto.
      expect(rotulo!.embebida).toBe(false);
      expect(rotulo!.baseFont).toMatch(/Helvetica-Bold/);
      expect(rotulo!.xMm + rotulo!.anchoMm).toBeLessThanOrEqual(hoja.anchoMm);
      expect(leida.textos.map((t) => t.texto).join(" ")).not.toMatch(MARCA_RETIRADA_RE);
    },
  );
});
