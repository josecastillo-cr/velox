import { MARCA_RETIRADA } from "@/tests/fixtures/marca-retirada-nombre-493";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GET } from "@/app/api-docs/route";
import { openApiSpec } from "@/lib/api/openapi-spec";

// Feature 492 (R20) — la documentacion publica para integradores se titula con la marca Velox
// Courier: la pagina `/api-docs`, el `info.title` del spec que sirve `/api/docs/openapi` y su
// espejo de texto `docs/api/api-key-openapi.yaml`. LITERAL de contrato, no `MARCA.nombre`.

const TITULO = "Velox Courier — API de integración por API key";
const YAML = fs.readFileSync(path.join(process.cwd(), "docs", "api", "api-key-openapi.yaml"), "utf8");

describe("Feature 492 — titulo de la documentacion de la API (R20)", () => {
  it("la pagina /api-docs lleva el titulo en su <title>", async () => {
    const html = await GET().text();
    expect(html).toContain(`<title>${TITULO}</title>`);
    expect(html).not.toMatch(new RegExp(`<title>[^<]*${MARCA_RETIRADA}`));
  });

  it("el spec OpenAPI servido se titula igual", () => {
    expect(openApiSpec.info.title).toBe(TITULO);
  });

  it("el espejo YAML se titula igual", () => {
    expect(YAML).toMatch(/^info:\r?\n {2}title: Velox Courier — API de integración por API key\r?$/m);
  });
});
