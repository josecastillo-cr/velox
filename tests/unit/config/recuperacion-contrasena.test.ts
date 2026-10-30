import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { recuperacionContrasenaActiva } from "@/lib/config/recuperacion-contrasena";

// Feature 489 — R17: el interruptor solo enciende con "true"/"1" (sin
// mayusculas, trim); cualquier otro valor, vacio o ausencia es apagado.

const ORIG = process.env.RECUPERACION_CONTRASENA_ACTIVA;

afterEach(() => {
  if (ORIG === undefined) delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
  else process.env.RECUPERACION_CONTRASENA_ACTIVA = ORIG;
});

describe("recuperacionContrasenaActiva (R17)", () => {
  it.each(["true", "TRUE", " 1 ", "1", " True "])("%j enciende", (valor) => {
    process.env.RECUPERACION_CONTRASENA_ACTIVA = valor;
    expect(recuperacionContrasenaActiva()).toBe(true);
  });

  it.each(["false", "0", "si", "", "   ", "yes", "on", "truee"])("%j apaga", (valor) => {
    process.env.RECUPERACION_CONTRASENA_ACTIVA = valor;
    expect(recuperacionContrasenaActiva()).toBe(false);
  });

  it("ausente apaga", () => {
    delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
    expect(recuperacionContrasenaActiva()).toBe(false);
  });

  it("se evalua en cada llamada, no queda congelado", () => {
    process.env.RECUPERACION_CONTRASENA_ACTIVA = "true";
    expect(recuperacionContrasenaActiva()).toBe(true);
    delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
    expect(recuperacionContrasenaActiva()).toBe(false);
  });
});

// Feature 489 — R18: el interruptor se lee SOLO en el servidor. Guardia estructural: ningun
// archivo de app/, components/ ni lib/ lo expone como NEXT_PUBLIC_*, y el LoginForm (componente
// de cliente) no lee process.env: recibe el valor como prop desde app/login/page.tsx.
const RAIZ = process.cwd();

function archivosFuente(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) out.push(...archivosFuente(ruta));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(nombre)) out.push(ruta);
  }
  return out;
}

describe("interruptor solo en servidor (R18)", () => {
  it("ningun archivo de app/, components/ ni lib/ contiene NEXT_PUBLIC_RECUPERACION", () => {
    const archivos = ["app", "components", "lib"].flatMap((d) => archivosFuente(join(RAIZ, d)));
    // Control de no-vacuidad: el recorrido SI encontro el archivo que lee el interruptor.
    expect(archivos.some((f) => f.endsWith(join("config", "recuperacion-contrasena.ts")))).toBe(
      true,
    );
    const culpables = archivos.filter((f) =>
      readFileSync(f, "utf8").includes("NEXT_PUBLIC_RECUPERACION"),
    );
    expect(culpables).toEqual([]);
  });

  it("LoginForm.tsx no lee process.env y recibe recuperacionActiva como prop", () => {
    const fuente = readFileSync(join(RAIZ, "app", "login", "_components", "LoginForm.tsx"), "utf8");
    expect(fuente).not.toMatch(/process\.env/);
    expect(fuente).toMatch(/recuperacionActiva/);
  });
});
