import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MARCA } from "@/lib/marca/identidad";

// FICHA 492 (T3, T13a) — GUARDIA «YA NO ES LA MARCA ANTERIOR» (R7, R8, R9, R22).
//
// Los SHA-256 de abajo son los de cada archivo de identidad de la empresa tal como estaba en
// `origin/dev` 8e150533 ANTES de reemplazarlo (T0, anotados en `progress/impl_492.md`). Son la
// huella de la marca anterior: si un archivo servido vuelve a coincidir con uno de ellos (un
// revert, un merge que se lo trae de vuelta), esto se pone rojo.
//
// Un hash distinto solo dice «otro archivo»; por eso se completa con el color: el pixel de fondo
// de cada icono es `#011027` (el de Velox) y el badge es una silueta blanca con alfa.
//
// POR QUE VIVE EN `tests/unit/guards/`: los cambios en `public/**` no los selecciona ningun grafo
// de imports.

const RAIZ = process.cwd();

/** Huella de la marca anterior (T0). */
const HUELLA_ANTERIOR: Readonly<Record<string, string>> = {
  "app/icon.png": "c9ab1514c72abe83e64f5064b230cc981c441be508ba18da8f07fff582673fbd",
  "public/icons/icon-192.png": "41f5858ea654a5408da290a6fa9a33639244e38261d9b72b2cb59ded70e75ab3",
  "public/icons/icon-512.png": "7ca122b7ccc1440658fc2a853fec620cc3f932e5ea4743041bd4d7b53b1d6c31",
  "public/icons/icon-192-maskable.png": "f267f046952144fe66308602b35b126cb8b4ecd8c6dd8781ff4a7612f1969790",
  "public/icons/icon-512-maskable.png": "71c5f1cefe6a7adae1ac8a26243c2aca40fcce3780857eafb04a111e300c552b",
  "public/icons/icon-180.png": "d0bba6acc991691c914f7f7c8444cd3dbaa733566a7a72b0ae35ebb08153d52c",
  "public/icons/badge-72.png": "02196430dbbbb160a48e4de57782811fdf95486a0de1ea491c364e2ed85ec5c3",
  // T13a (R22): las tres capturas del dialogo de instalacion, rehechas con Playwright (P3).
  "public/screenshots/ingreso-narrow.png": "79cba346f3ac7fd8f93846af85d5460c76e66957f3910e4e8bc6719419d0a0e9",
  "public/screenshots/inicio-narrow.png": "aa0f6826301706c9059611da3f80358ee0d100f7c858a5b4994a20c40c81f2bb",
  "public/screenshots/inicio-wide.png": "4ca3d4adfd3ac62d51b76a79a6ea7dd6b1ca2cb6a89be7e74acbfd7c3b7cfc0a",
};

const HASHES_ANTERIORES = new Set(Object.values(HUELLA_ANTERIOR));

/** Archivos de identidad que se sirven hoy y no pueden ser ninguno de la marca anterior. */
const SERVIDOS = [
  "app/favicon.ico",
  "app/icon.svg",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "public/icons/icon-192-maskable.png",
  "public/icons/icon-512-maskable.png",
  "public/icons/icon-180.png",
  "public/icons/badge-72.png",
  "public/screenshots/ingreso-narrow.png",
  "public/screenshots/inicio-narrow.png",
  "public/screenshots/inicio-wide.png",
];

/** Los cinco iconos de la PWA (manifiesto + `apple-touch-icon`). */
const ICONOS = SERVIDOS.filter((r) => /\/icon-\d+(-maskable)?\.png$/.test(r));

const sha256 = (rel: string) =>
  crypto.createHash("sha256").update(fs.readFileSync(path.join(RAIZ, rel))).digest("hex");

function hexARgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function rgba(rel: string) {
  const sharp = (await import("sharp")).default;
  return sharp(path.join(RAIZ, rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

describe("Feature 492 — ningun archivo servido es de la marca anterior (R7, R8, R9, R22)", () => {
  it("la huella tiene los archivos de T0", () => {
    expect(Object.keys(HUELLA_ANTERIOR)).toHaveLength(10);
    expect(ICONOS).toHaveLength(5);
  });

  it.each(SERVIDOS)("%s no coincide byte a byte con la marca anterior", (rel) => {
    expect(fs.existsSync(path.join(RAIZ, rel)), `no existe ${rel}`).toBe(true);
    expect(HASHES_ANTERIORES.has(sha256(rel)), `${rel} es un archivo de la marca anterior`).toBe(false);
  });
});

describe("Feature 492 — el fondo de cada icono es el de Velox (R7)", () => {
  it.each(ICONOS)("%s: el pixel del borde superior centrado es #011027", async (rel) => {
    const { data, info } = await rgba(rel);
    const x = Math.floor(info.width / 2);
    const y = Math.floor(info.width / 64);
    const i = (y * info.width + x) * 4;
    const [r, g, b] = hexARgb(MARCA.colorTema);
    // Literal de contrato ademas de la fuente: el color de Velox no se deduce de nada.
    expect(MARCA.colorTema).toBe("#011027");
    expect([data[i], data[i + 1], data[i + 2], data[i + 3]]).toEqual([r, g, b, 255]);
  });
});

describe("Feature 492 — el badge es la silueta blanca del simbolo (R9)", () => {
  it("es un PNG RGBA (tipo de color 6)", () => {
    const bytes = fs.readFileSync(path.join(RAIZ, "public/icons/badge-72.png"));
    expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(bytes[25]).toBe(6);
  });

  it("todo pixel visible es blanco y al menos un 5 % de los pixeles es visible", async () => {
    const { data, info } = await rgba("public/icons/badge-72.png");
    expect(info.width).toBe(72);
    expect(info.height).toBe(72);
    let visibles = 0;
    let noBlancos = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        visibles += 1;
        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) noBlancos += 1;
      }
    }
    expect(noBlancos).toBe(0);
    expect(visibles / (info.width * info.height)).toBeGreaterThanOrEqual(0.05);
    // Y no es un cuadrado lleno: tiene que haber transparencia para que se lea el simbolo.
    expect(visibles).toBeLessThan(info.width * info.height);
  });
});
