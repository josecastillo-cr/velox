import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * FICHA 500 (bloque 7 de H5, R23) — los textos de la ficha 498 son DEFINITIVOS: ningun archivo donde
 * viven, ni los tests que los fijan, puede marcarlos como provisionales.
 *
 * Lista CERRADA (T5.1, leida en el codigo):
 *   - `lib/constants/wallet-rotulos.ts` — las dos etiquetas de diferencia de la satelite;
 *   - `components/shared/conciliacion/conciliacion-labels.ts` — la nota de la conciliacion
 *     (`NOTA_CONCILIACION_ASIENTA`);
 *   - `app/(app)/wallet/_components/wallet-labels.ts` — las pistas de «Por cobrar a satelites» y el
 *     dueño «Satelite» (`por_cobrar_satelite`);
 *   - `app/(app)/wallet/_components/CajaResumenCard.tsx` — donde se eligen las pistas por signo;
 *   - los tests de la 498 que los fijan.
 *
 * Mira el archivo ENTERO (comentarios incluidos): la marca que la 500 retira era un comentario.
 */

const ARCHIVOS = [
  "lib/constants/wallet-rotulos.ts",
  "components/shared/conciliacion/conciliacion-labels.ts",
  "app/(app)/wallet/_components/wallet-labels.ts",
  "app/(app)/wallet/_components/CajaResumenCard.tsx",
  "tests/components/CajaResumenCard498.test.tsx",
  "tests/components/Conciliacion498.test.tsx",
  "tests/components/WalletLedgerSatelite498.test.tsx",
] as const;

/** Las lineas que marcan algo como provisional, con su numero. */
function marcasProvisionales(texto: string): string[] {
  return texto
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((linea, i) => (/provisional/i.test(linea) ? [`${i + 1}: ${linea.trim()}`] : []));
}

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("FICHA 500 (R23) — los textos de la 498 no se marcan como provisionales", () => {
  it.each(ARCHIVOS)("%s no contiene ninguna marca de provisional", (rel) => {
    expect(marcasProvisionales(leer(rel))).toEqual([]);
  });

  it("autocomprobacion: la lista existe entera y sembrar «provisional» en una copia la pone roja", () => {
    for (const rel of ARCHIVOS) expect(leer(rel).length).toBeGreaterThan(0);
    const copia = `${leer(ARCHIVOS[0])}\n// Texto PROVISIONAL del backend\n`;
    expect(marcasProvisionales(copia)).toHaveLength(1);
    expect(marcasProvisionales("// texto provisional")).toHaveLength(1);
    expect(marcasProvisionales("// texto definitivo")).toHaveLength(0);
  });
});
