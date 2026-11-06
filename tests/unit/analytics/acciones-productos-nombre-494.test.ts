import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// FEATURE 494 (design §3.2) — EL NOMBRE DE ESTAS DOS ACTIONS ES LO QUE CORTA EL CRUCE DE VERSIONES.
//
// El id de una Server Action sale de su archivo y de su nombre exportado. Estas dos devuelven el DTO cuyo
// campo cambió de nombre: una pestaña abierta durante el despliegue que las llamara con el id de siempre
// recibiría la forma nueva y guardaría un archivo con «Cobró» vacía, sin error. Con otro nombre, su id ya no
// existe y recibe un fallo visible. Volver al nombre anterior no rompe `tsc` si se renombra todo a la vez, así
// que el nombre va literal. Si la forma del DTO vuelve a cambiar, el sufijo sube.

const RAIZ = path.resolve(__dirname, "../../..");

const exportadas = (rel: string) =>
  [...readFileSync(path.join(RAIZ, rel), "utf8").matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);

describe("494, design §3.2 — las actions del dinero por producto", () => {
  it("el conteo se exporta con este nombre", () => {
    expect(exportadas("lib/actions/conteo-productos.ts")).toEqual(["consultarConteoProductosV2"]);
  });

  it("el detalle se exporta con este nombre", () => {
    expect(exportadas("lib/actions/detalle-dinero-producto.ts")).toEqual(["consultarDetalleDineroProductoV2"]);
  });
});
