import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { openApiSpec } from "@/lib/api/openapi-spec";
import { NOMBRE_ESPERADO } from "@/tests/fixtures/marca-esperada";
import { MARCA_RETIRADA } from "@/tests/fixtures/marca-retirada-nombre-493";

// FEATURE 493 (T11, R9) — las DESCRIPCIONES de la OpenAPI nombran a la empresa con la marca.
//
// Dos artefactos que pueden divergir (como en `openapi-406-evidencias-url.test.ts`): lo que se
// sirve (`lib/api/openapi-spec.ts`) y su espejo textual (`docs/api/api-key-openapi.yaml`), que
// nada regenera. Las frases se afirman literales; la marca, desde el fixture (L1, R16).

const yaml = fs.readFileSync(path.join(__dirname, "..", "..", "..", "docs", "api", "api-key-openapi.yaml"), "utf8");
const servido = JSON.stringify(openApiSpec);

const FRASES = [
  `Los CINCO conceptos que ${NOMBRE_ESPERADO} factura por una orden, en el escenario de ENTREGA`,
  `RETIRADO DEL CATÁLOGO (desde 2026-09-06). ${NOMBRE_ESPERADO} puede retirar una provincia, un cantón`,
];

describe("493/R9 — la OpenAPI habla de la empresa con la marca", () => {
  it.each(FRASES)("lo que se sirve dice «%s»", (frase) => {
    expect(servido).toContain(frase);
  });

  it.each(FRASES)("el espejo .yaml dice «%s»", (frase) => {
    expect(yaml).toContain(frase);
  });

  it("ninguno de los dos conserva la marca retirada (ni en comentarios del .yaml)", () => {
    expect(servido).not.toContain(MARCA_RETIRADA);
    expect(yaml).not.toContain(MARCA_RETIRADA);
  });
});
