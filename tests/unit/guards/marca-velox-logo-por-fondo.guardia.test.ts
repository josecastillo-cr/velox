import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { quitarComentarios } from "@/tests/fixtures/sin-comentarios";

// FICHA 492 (T6) — GUARDIA DE LA VARIANTE DEL LOGO POR FONDO (R13, R14, R15).
//
// El logo de Velox tiene VELOX en blanco: sobre un fondo claro desaparece. Que cada `<Logo>` lleve
// la variante de su fondo (design §3.6) no lo ve ningun test de render en jsdom —no hay CSS ni
// tema—, asi que se fija aqui leyendo cada consumidor y exigiendo, EN ORDEN, el `fondo` de cada
// `<Logo>`. Un `<Logo>` sin `fondo` explicito cuenta como fallo: el defecto (`oscuro`) sobre un
// fondo que gira con el tema seria invisible en tema claro.

const RAIZ = process.cwd();

/** Variante esperada de cada `<Logo>` del archivo, en orden de aparicion (design §3.6). */
const TABLA: Readonly<Record<string, readonly string[]>> = {
  "app/(app)/_components/Sidebar.tsx": ["oscuro"],
  "app/_landing/LandingNav.tsx": ["oscuro"],
  "app/_landing/LandingFooter.tsx": ["oscuro"],
  // Panel de marca de escritorio (`bg-navy` fijo) y cabecera movil (`bg-background`, gira).
  "app/login/page.tsx": ["oscuro", "tema"],
  "app/recuperar-contrasena/page.tsx": ["oscuro", "tema"],
  "app/postulacion/page.tsx": ["oscuro", "tema"],
  // Pagina publica de seguimiento: tokens de tema.
  "app/paquete/[numGuia]/page.tsx": ["tema"],
};

function variantes(rel: string): string[] {
  const codigo = quitarComentarios(fs.readFileSync(path.join(RAIZ, rel), "utf8"));
  return Array.from(codigo.matchAll(/<Logo\b([^>]*?)\/?>/g)).map(
    (m) => /\bfondo="([a-z]+)"/.exec(m[1])?.[1] ?? "(sin fondo)",
  );
}

describe("Feature 492 — cada <Logo> lleva la variante de su fondo (R13, R14, R15)", () => {
  it.each(Object.entries(TABLA))("%s", (rel, esperado) => {
    expect(variantes(rel)).toEqual(esperado);
  });

  it("autocomprobacion: el escaner encuentra los <Logo> y lee su fondo", () => {
    const total = Object.keys(TABLA).reduce((n, rel) => n + variantes(rel).length, 0);
    expect(total).toBe(10);
  });

  it("ningun otro archivo de app/ ni components/ pinta <Logo> fuera de la tabla", () => {
    const encontrados: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) recorrer(rel);
        else if (/\.tsx$/.test(e.name) && variantes(rel).length > 0) encontrados.push(rel);
      }
    };
    recorrer("app");
    recorrer("components");
    expect(encontrados.sort()).toEqual(Object.keys(TABLA).sort());
  });
});
