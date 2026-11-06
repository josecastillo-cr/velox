import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Ficha 498 (R44) — la ayuda de Wallet · Satélites y la de Wallet · Caja describen la regla nueva: el
// dinero de un cierre satélite entra a la caja AL CONCILIAR, la deuda cuenta todos los métodos menos lo
// de la satélite, lo recibido es el TOTAL (también el SINPE o la transferencia consignados directo), el 0
// solo cuando no hay nada que entregar, la columna «Sin consolidar», las «Saldada con la regla anterior»,
// el desenlace de revertir con asientos y el bolsillo «Por cobrar a satélites». Y no queda ninguna frase
// de la regla vieja (marca informativa, deuda solo sobre el efectivo, desmarcar sin mover dinero).
// Literales escritos a mano. Molde: `ayuda-wallet-caja-488.test.ts`.

const leer = (f: string) => readFileSync(path.join(process.cwd(), "docs/ayuda/oficina", f), "utf8");
const SATELITES = leer("wallet-satelites.md");
const CAJA = leer("wallet-caja.md");

/** Lo que R44 enumera, como frases o rótulos que la ayuda TIENE que decir. */
const PUNTOS_R44: { punto: string; archivo: "satelites" | "caja"; patron: RegExp }[] = [
  { punto: "el dinero de una satélite entra al conciliar", archivo: "satelites", patron: /entra a la caja cuando marcás recibida su consolidación/ },
  { punto: "aprobar el cierre de una satélite no mete dinero", archivo: "satelites", patron: /Aprobar el\s+(?:>\s*)?cierre de un mensajero de una satélite \*\*no\*\* mete nada en la caja/ },
  { punto: "la deuda cuenta todos los métodos menos lo de la satélite", archivo: "satelites", patron: /debe todo lo recaudado, por\s+cualquier método, menos lo que es suyo/ },
  { punto: "lo recibido es el total, también el SINPE o la transferencia directos", archivo: "satelites", patron: /\*\*El monto es el total\*\* que llegó a la central, por cualquier método y a cualquier\s+cuenta/ },
  { punto: "el 0 solo cuando no hay nada que entregar", archivo: "satelites", patron: /\*\*El 0 solo cuando no hay nada que entregar\.\*\*/ },
  { punto: "la columna «Sin consolidar»", archivo: "satelites", patron: /\*\*Sin consolidar\*\* \(lo aprobado que todavía no entró/ },
  { punto: "las saldadas con la regla anterior", archivo: "satelites", patron: /## Saldada con la regla anterior/ },
  { punto: "revertir con asientos no deshace nada", archivo: "satelites", patron: /la app no deshace nada y te dice «Ya entró a la caja: corrige el\s+monto en vez de revertir»/ },
  // Ficha 500 (R8): «Desmarcar» solo se ofrece sin dinero en la caja.
  { punto: "«Desmarcar» solo aparece sin dinero en la caja (500/R8)", archivo: "satelites", patron: /\*\*Desmarcar\*\* solo aparece en una consolidación que todavía no movió dinero en la caja\./ },
  // Ficha 502 (R13): «Corregir» también en una recibida de más.
  { punto: "«Corregir» aparece en una recibida incompleta o de más (502/R13)", archivo: "satelites", patron: /\*\*Corregir\*\* aparece en una consolidación recibida incompleta o recibida de más\./ },
  { punto: "«Recibido» incluye lo que llegó de más (502/R13)", archivo: "satelites", patron: /\| \*\*Recibido\*\* \| Llegó completo o de más \|/ },
  { punto: "la nota literal de R43", archivo: "satelites", patron: /Marcar recibido asienta el dinero en la caja\. Después no se puede desmarcar: si el monto no es el correcto, usa «Corregir»/ },
  { punto: "el bolsillo «Por cobrar a satélites» en la caja", archivo: "caja", patron: /### Por cobrar a satélites/ },
  { punto: "las dos pistas del bolsillo", archivo: "caja", patron: /«Lo que las satélites entregaron de menos al conciliar y aún no han pagado\.»[\s\S]*«La central les debe a las satélites\.»/ },
  { punto: "el dueño «Satélite» en el libro", archivo: "caja", patron: /\*\*IVA por pagar\*\* o \*\*Satélite\*\*/ },
  { punto: "en la caja, los cierres satélite entran al conciliar", archivo: "caja", patron: /\*\*Los cierres de una bodega satélite son la excepción: su dinero entra al conciliar, no al aprobar\.\*\*/ },
];

/** Frases de la regla VIEJA (antes de la 498) que no pueden volver. */
const REGLA_VIEJA: RegExp[] = [
  /El saldo NO es un movimiento de caja/i,
  /la cifra es solo el EFECTIVO/i,
  /Desmarcar no mueve dinero/i,
  /La marca es informativa/i,
  /no mueve un col[oó]n/i,
  /no lo contabiliza/i,
];

const texto = (a: "satelites" | "caja", s = SATELITES, c = CAJA) => (a === "satelites" ? s : c);

describe("498/R44 — la ayuda de Wallet · Satélites y de Wallet · Caja", () => {
  it.each(PUNTOS_R44.map((p) => [p.punto, p] as const))("⭑ dice: %s", (_n, p) => {
    expect(texto(p.archivo)).toMatch(p.patron);
  });

  it("⭑ no queda ninguna frase de la regla vieja en ninguno de los dos archivos", () => {
    for (const re of REGLA_VIEJA) {
      expect(SATELITES, String(re)).not.toMatch(re);
      expect(CAJA, String(re)).not.toMatch(re);
    }
  });
});

describe("498/R44 — AUTOCOMPROBACION", () => {
  it("una frase vieja sembrada en la ayuda se ve", () => {
    const sembrada = `${SATELITES}\n## Desmarcar no mueve dinero\n\nLa marca es informativa: dice si el efectivo llegó.\n`;
    expect(REGLA_VIEJA.filter((re) => re.test(sembrada)).length).toBeGreaterThanOrEqual(2);
  });

  it("quitar un punto de R44 de la ayuda pone su caso rojo", () => {
    const sinPunto = SATELITES.replace(/## Saldada con la regla anterior/, "## (quitado)");
    expect(sinPunto).not.toBe(SATELITES); // la mutación se aplicó de verdad
    const p = PUNTOS_R44.find((x) => x.punto === "las saldadas con la regla anterior");
    expect(p).toBeDefined();
    expect(texto("satelites", sinPunto)).not.toMatch((p as (typeof PUNTOS_R44)[number]).patron);
    // Y en la caja: sin el bolsillo, su caso tambien cae.
    const cajaSin = CAJA.replace(/### Por cobrar a satélites/, "### (quitado)");
    expect(texto("caja", SATELITES, cajaSin)).not.toMatch(/### Por cobrar a satélites/);
  });
});

// Ficha 503 — la sección de las saldadas dice lo que hace la fila: no ofrece ningún botón. Este bloque solo fija el
// texto, con literales a mano; que sea VERDAD lo mide el DOM en `Conciliacion498.test.tsx` («503/R4»).

/** Del título de la sección al título siguiente, para que un «Corregir» de otra sección no cuente. Tolera CRLF. */
function seccionSaldada(md: string): string {
  const limpio = md.replace(/\r\n/g, "\n");
  const titulo = "## Saldada con la regla anterior\n";
  const inicio = limpio.indexOf(titulo);
  if (inicio === -1) return "";
  const cuerpo = limpio.slice(inicio + titulo.length);
  const fin = cuerpo.search(/^## /m);
  return fin === -1 ? cuerpo : cuerpo.slice(0, fin);
}

const FRASE_R1 =
  /Esa\s+fila\s+no\s+ofrece\s+ningún\s+botón,\s+ni\s+\*\*Corregir\*\*\s+ni\s+\*\*Desmarcar\*\*:\s+su\s+monto\s+no\s+se\s+puede\s+cambiar\s+desde\s+la\s+pantalla/;
const PROHIBIDOS_R2: RegExp[] = [/se\s+arregla/i, /(usa|con)\s+[«*]*Corregir/];
const PUNTOS_R3: RegExp[] = [
  /rótulo\s+\*\*Saldada\s+con\s+la\s+regla\s+anterior\*\*/,
  /su\s+\*\*Debe\*\*\s+es\s+lo\s+que\s+se\s+marcó\s+entonces/,
  /no\s+deben\s+nada/,
];
const FRASE_VIEJA = "Si alguna se marcó por un monto equivocado, se\narregla con **Corregir**.";
const CON_FRASE_NUEVA =
  "## Saldada con la regla anterior\n\nEsa fila no ofrece ningún botón, ni **Corregir** ni **Desmarcar**: su monto no\nse puede cambiar desde la pantalla.\n\n## Otra\n";

describe("503 — la sección «Saldada con la regla anterior» de la ayuda", () => {
  const seccion = seccionSaldada(SATELITES);

  it("R1 — dice que la fila no ofrece ningún botón y que el monto no se cambia desde la pantalla", () => {
    expect(seccion).toMatch(FRASE_R1);
  });

  it.each(PROHIBIDOS_R2.map((re) => [String(re), re] as const))("R2 — no promete arreglarla con «Corregir»: %s", (_n, re) => {
    expect(seccion).not.toMatch(re);
  });

  it.each(PUNTOS_R3.map((re) => [String(re), re] as const))("R3 — sigue diciendo: %s", (_n, re) => {
    expect(seccion).toMatch(re);
  });
});

describe("503 — AUTOCOMPROBACION", () => {
  const seccion = seccionSaldada(SATELITES);

  it("la sección recortada existe, es la de las saldadas y acaba antes del título siguiente", () => {
    expect(seccion).toMatch(/\*\*saldadas\s+tal\s+como\s+se\s+marcaron\*\*/);
    expect(seccion).not.toMatch(/Qué ve la bodega/);
    expect(seccionSaldada("# Sin la sección\n")).toBe("");
  });

  it("sembrar la frase vieja en la sección pone rojo R2, con los dos patrones", () => {
    const sembrada = seccionSaldada(`## Saldada con la regla anterior\n\n${FRASE_VIEJA}\n\n## Otra\n`);
    for (const re of PROHIBIDOS_R2) expect(sembrada, String(re)).toMatch(re);
  });

  it("un «usa Corregir» de OTRA sección no cuenta contra R2", () => {
    const conOtra = `${CON_FRASE_NUEVA}\nSe arregla: usa «Corregir».\n`;
    for (const re of PROHIBIDOS_R2) expect(conOtra, String(re)).toMatch(re);
    for (const re of PROHIBIDOS_R2) expect(seccionSaldada(conOtra), String(re)).not.toMatch(re);
  });

  it("quitar la frase nueva pone rojo R1", () => {
    expect(seccionSaldada(CON_FRASE_NUEVA)).toMatch(FRASE_R1);
    const sinFrase = CON_FRASE_NUEVA.replace("Esa fila no ofrece", "(quitado)");
    expect(sinFrase).not.toBe(CON_FRASE_NUEVA); // la mutación se aplicó de verdad
    expect(seccionSaldada(sinFrase)).not.toMatch(FRASE_R1);
  });

  it("con CRLF, el recorte y los patrones dan lo mismo", () => {
    const crlf = SATELITES.replace(/\r?\n/g, "\r\n");
    expect(seccionSaldada(crlf)).toBe(seccionSaldada(SATELITES));
    expect(seccionSaldada(CON_FRASE_NUEVA.replace(/\n/g, "\r\n"))).toMatch(FRASE_R1);
  });
});
