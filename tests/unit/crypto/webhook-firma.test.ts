import { CABECERA_FIRMA_RETIRADA, CABECERA_TIMESTAMP_RETIRADA, PREFIJO_CABECERA_RETIRADA } from "@/tests/fixtures/marca-retirada-nombre-493";
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  firmarWebhook,
  cabecerasFirma,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "@/lib/crypto/webhook-firma";

// Feature 99 (R18) — la firma es HMAC-SHA256 determinista sobre `${timestamp}.${cuerpo}` y
// cambia si cualquiera cambia. El secreto nunca aparece en la salida.

const SECRET = "ordx_whsec_secreto-de-prueba";
const CUERPO = JSON.stringify({ evento: "orden.estado_actualizado", eventoId: "e1" });
const TS = 1_700_000_000;

// FEATURE 493 (R17, L5b): los NOMBRES de las cabeceras son contrato. Literales a mano, no la
// constante de produccion (que los demas tests si usan para leer el valor).
describe("493/R17 — las cabeceras de firma se llaman X-Velox-*", () => {
  it(`cabecerasFirma emite exactamente X-Velox-Signature y X-Velox-Timestamp, y no las ${PREFIJO_CABECERA_RETIRADA}*`, () => {
    const nombres = Object.keys(cabecerasFirma(SECRET, TS, CUERPO)).sort();
    expect(nombres).toEqual(["X-Velox-Signature", "X-Velox-Timestamp"]);
    expect(nombres).not.toContain(CABECERA_FIRMA_RETIRADA);
    expect(nombres).not.toContain(CABECERA_TIMESTAMP_RETIRADA);
  });

  it("mismo formato de valor que antes: `sha256=<hex>` y segundos unix", () => {
    const h = cabecerasFirma(SECRET, TS, CUERPO);
    expect(h["X-Velox-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(h["X-Velox-Timestamp"]).toBe("1700000000");
  });
});

describe("R18 — firma HMAC-SHA256 determinista sobre timestamp + cuerpo", () => {
  it("coincide con el HMAC-SHA256 hex de `${timestamp}.${cuerpo}`", () => {
    const esperado = createHmac("sha256", SECRET).update(`${TS}.${CUERPO}`).digest("hex");
    expect(firmarWebhook(SECRET, TS, CUERPO)).toBe(esperado);
  });

  it("es determinista: misma entrada -> misma firma", () => {
    expect(firmarWebhook(SECRET, TS, CUERPO)).toBe(firmarWebhook(SECRET, TS, CUERPO));
  });

  it("cambia si cambia el cuerpo", () => {
    expect(firmarWebhook(SECRET, TS, CUERPO)).not.toBe(firmarWebhook(SECRET, TS, CUERPO + " "));
  });

  it("cambia si cambia el timestamp (anti-replay ligado a la firma)", () => {
    expect(firmarWebhook(SECRET, TS, CUERPO)).not.toBe(firmarWebhook(SECRET, TS + 1, CUERPO));
  });

  it("cambia si cambia el secreto", () => {
    expect(firmarWebhook(SECRET, TS, CUERPO)).not.toBe(firmarWebhook(SECRET + "x", TS, CUERPO));
  });

  it("el secreto NUNCA aparece en la firma ni en las cabeceras", () => {
    const firma = firmarWebhook(SECRET, TS, CUERPO);
    expect(firma).not.toContain(SECRET);
    const headers = cabecerasFirma(SECRET, TS, CUERPO);
    expect(headers[WEBHOOK_SIGNATURE_HEADER]).toBe(`sha256=${firma}`);
    expect(headers[WEBHOOK_TIMESTAMP_HEADER]).toBe(String(TS));
    expect(JSON.stringify(headers)).not.toContain(SECRET);
  });
});
