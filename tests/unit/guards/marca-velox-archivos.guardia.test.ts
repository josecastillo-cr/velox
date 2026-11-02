import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// FICHA 492 (T2) — GUARDIA DE LOS ARCHIVOS DE MARCA COPIADOS (R3, R8).
//
// `docs/marca/velox/` NO se sirve: la feature copia a `public/` y `app/` lo que usa. Si manana
// llega el archivo del disenador y alguien reemplaza `docs/` sin volver a copiar, la app seguiria
// sirviendo el vectorizado viejo sin que nadie lo viera. Esta guardia compara byte a byte.
//
// POR QUE VIVE EN `tests/unit/guards/`: un cambio en `public/**`, `app/*.svg` o `docs/**` no lo
// selecciona ningun grafo de imports; fuera de aqui el gate rapido no la correria.

const raiz = process.cwd();
const leer = (rel: string) => fs.readFileSync(path.join(raiz, rel));

const COPIAS: ReadonlyArray<readonly [origen: string, destino: string]> = [
  ["docs/marca/velox/svg/logo-horizontal.svg", "public/marca/logo-horizontal.svg"],
  ["docs/marca/velox/svg/logo-horizontal-fondo-claro.svg", "public/marca/logo-horizontal-fondo-claro.svg"],
  ["docs/marca/velox/svg/logo-simbolo.svg", "public/marca/logo-simbolo.svg"],
  ["docs/marca/velox/svg/icono-maskable.svg", "public/icons/fuente/icon-maskable.svg"],
  ["docs/marca/velox/favicon.ico", "app/favicon.ico"],
  ["docs/marca/velox/svg/favicon.svg", "app/icon.svg"],
];

describe("Feature 492 — archivos de marca copiados desde docs/marca/velox (R3)", () => {
  it.each(COPIAS)("%s -> %s es byte a byte identico", (origen, destino) => {
    const a = leer(origen);
    const b = leer(destino);
    expect(b.length).toBeGreaterThan(0);
    expect(b.equals(a)).toBe(true);
  });
});

describe("Feature 492 — favicon sin la marca anterior (R8)", () => {
  it("app/icon.png (monograma «ex») ya no existe: Next lo declararia junto al nuevo", () => {
    expect(fs.existsSync(path.join(raiz, "app/icon.png"))).toBe(false);
  });

  it("no queda ningun otro icono de pestana en app/ (icon.*, apple-icon.*) salvo los de Velox", () => {
    const iconos = fs
      .readdirSync(path.join(raiz, "app"))
      .filter((n) => /^(icon|apple-icon|favicon)(\d*)\.[a-z]+$/i.test(n))
      .sort();
    expect(iconos).toEqual(["favicon.ico", "icon.svg"]);
  });
});
