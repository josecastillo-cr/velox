// FEATURE 493 (T2, design §6) — EL DETECTOR DE LA GUARDIA DE MARCA.
//
// Vive aparte de la guardia (`tests/unit/guards/marca-fuente-unica-493.guardia.test.ts`) para que
// el censo de T2 (`progress/censo_marca_493.md`) se pueda emitir con el MISMO codigo que juzga.
// NO importa `@/lib/marca/identidad` (R16): quien necesita la marca de produccion (bloque R1) la
// recibe por parametro desde la guardia.
//
// Trabaja sobre el AST de `typescript`, como `fuente-unica-nombre-estado.guardia.test.ts`: solo
// mira NODOS DE TEXTO (`StringLiteral`, `NoSubstitutionTemplateLiteral`, `TemplateHead/Middle/Tail`,
// `JsxText`). Los comentarios y los identificadores quedan fuera por construccion. Los
// especificadores de modulo (`import … from "…/ingreso-ordenex"`, `vi.mock("…")`, `import("…")`)
// tampoco son texto: son rutas de codigo, y renombrar archivos esta fuera de alcance (§2 b).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { MARCAS_RETIRADAS } from "./marca-retirada-nombre-493";

export const RAIZ = path.resolve(__dirname, "../..");

/** Marcas que ya no pueden aparecer en un texto (viven en `marca-retirada-nombre-493.ts`). */
export { MARCAS_RETIRADAS };

const RETIRADA = new RegExp(MARCAS_RETIRADAS.join("|"), "i");

export interface Hallazgo {
  archivo: string;
  linea: number;
  fragmento: string;
}

export const formatear = (h: Hallazgo) => `${h.archivo}:${h.linea} — ${h.fragmento}`;

// ---------------------------------------------------------------------------------------------
// Lectura del arbol
// ---------------------------------------------------------------------------------------------

/** Lee un archivo del repo con finales de linea normalizados (memoria «CRLF invisible»). */
export function leer(rel: string): string {
  return readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");
}

/** Archivos bajo `dir` (relativos a la raiz, con `/`) cuyo nombre cumple `filtro`. */
export function listar(dir: string, filtro: RegExp): string[] {
  const abs = path.join(RAIZ, dir);
  const acc: string[] = [];
  const rec = (d: string) => {
    for (const e of readdirSync(d)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      const c = path.join(d, e);
      if (statSync(c).isDirectory()) rec(c);
      else if (filtro.test(e)) acc.push(path.relative(RAIZ, c).split(path.sep).join("/"));
    }
  };
  rec(abs);
  return acc.sort();
}

/** `.ts`/`.tsx` de codigo (sin `.d.ts`). */
export const CODIGO = /\.(tsx?|jsx?)$/;
const ES_DECLARACION = /\.d\.ts$/;

export function archivosDeCodigo(dirs: readonly string[]): string[] {
  return dirs.flatMap((d) => listar(d, CODIGO)).filter((f) => !ES_DECLARACION.test(f));
}

// ---------------------------------------------------------------------------------------------
// Nodos de texto
// ---------------------------------------------------------------------------------------------

export interface NodoTexto {
  linea: number;
  texto: string;
}

const LLAMADAS_DE_MODULO = new Set(["require", "mock", "doMock", "unmock", "importActual", "importMock"]);

/** El literal es la ruta de un modulo, no un texto. */
function esEspecificadorDeModulo(n: ts.Node): boolean {
  const p = n.parent;
  if (!p) return false;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isLiteralTypeNode(p) && p.parent && ts.isImportTypeNode(p.parent)) return true;
  if (ts.isCallExpression(p) && p.arguments[0] === n) {
    if (p.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
    const callee = p.expression;
    const nombre = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : "";
    if (LLAMADAS_DE_MODULO.has(nombre)) return true;
  }
  return false;
}

function tipoDeScript(nombre: string): ts.ScriptKind {
  if (nombre.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (nombre.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (nombre.endsWith(".js") || nombre.endsWith(".mjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** Todos los nodos de texto de un fuente TS/JS, sin comentarios ni especificadores de modulo. */
export function textosDeCodigo(fuente: string, nombre = "fuente.tsx"): NodoTexto[] {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, tipoDeScript(nombre));
  const out: NodoTexto[] = [];
  const anotar = (n: ts.Node, texto: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    out.push({ linea: line + 1, texto });
  };
  const visitar = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      if (!esEspecificadorDeModulo(n)) anotar(n, n.text);
    } else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      anotar(n, n.text);
    } else if (ts.isJsxText(n)) {
      if (n.text.trim() !== "") anotar(n, n.text.trim());
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

const recortar = (s: string) => {
  const una = s.replace(/\s+/g, " ").trim();
  return una.length > 140 ? `${una.slice(0, 137)}…` : una;
};

// ---------------------------------------------------------------------------------------------
// Bloque R15 (y R16 en tests) — la marca retirada en un texto
// ---------------------------------------------------------------------------------------------

/**
 * Excepciones CERRADAS de R11 (design §6.1). Cada una con su motivo. Se aplican al texto ENTERO de
 * un nodo; si el nodo cumple una, no es hallazgo.
 */
export const EXCEPCIONES_R11: ReadonlyArray<readonly [motivo: string, cumple: (t: string) => boolean]> = [
  [
    "prefijo `ordenex:` — clave de almacenamiento local, mensaje pagina↔service worker o tag de notificacion (R11, R12)",
    (t) => /^ordenex:/.test(t),
  ],
  [
    "identificador entero en minusculas (`ordenex`, `solo_ordenex`, `ganancia_ordenex`, `ordenex_tema`…): clave de columna, valor de enum, cookie, id de metrica (R11)",
    (t) => /^[a-z0-9_]*ordenex[a-z0-9_]*$/.test(t),
  ],
];

export const esExcepcionR11 = (t: string) => EXCEPCIONES_R11.some(([, cumple]) => cumple(t));

/**
 * Hallazgos de la marca retirada en los nodos de texto de un fuente TS/JS (R15). Un nodo NO es
 * hallazgo si entero es una excepcion de R11 o si solo contiene la marca dentro de identificadores
 * (`quitarIdentificadores`). `permitidoExtra` admite mas (R16 en tests).
 */
export function hallazgosRetiradaEnCodigo(
  fuente: string,
  archivo = "fuente.tsx",
  permitidoExtra: (t: string) => boolean = () => false,
): Hallazgo[] {
  return textosDeCodigo(fuente, archivo)
    .filter(
      (n) =>
        RETIRADA.test(n.texto) &&
        !esExcepcionR11(n.texto) &&
        RETIRADA.test(quitarIdentificadores(n.texto)) &&
        !permitidoExtra(n.texto),
    )
    .map((n) => ({ archivo, linea: n.linea, fragmento: recortar(n.texto) }));
}

/**
 * Archivos que no son codigo (Markdown, HTML, YAML, JSON): cada linea con la marca retirada es un
 * hallazgo, salvo las que `permitida` admita.
 */
export function hallazgosRetiradaEnTextoPlano(
  fuente: string,
  archivo: string,
  permitida: (linea: string) => boolean = () => false,
): Hallazgo[] {
  const out: Hallazgo[] = [];
  fuente.split("\n").forEach((l, i) => {
    if (RETIRADA.test(l) && !permitida(l)) out.push({ archivo, linea: i + 1, fragmento: recortar(l) });
  });
  return out;
}

/**
 * R11 — un texto puede CONTENER un identificador interno con la marca retirada, y ese identificador
 * se conserva («SI un texto contiene un identificador interno que contiene "ordenex"…»). Ejemplos:
 * la descripcion de una metrica que nombra su id (`ganancia_ordenex`), el titulo de un `it` que
 * nombra el campo (`liquidado.ordenex`), un fragmento de fuente que una guardia escanea
 * (`NETO_ORDENEX_LABEL`). Nada de eso es la marca dicha a una persona ni se puede cambiar sin
 * renombrar identificadores (fuera de alcance, design §2 b).
 *
 * Esta funcion tacha las apariciones ADMITIDAS y deja las demas. Una aparicion se admite si el
 * TOKEN que la contiene (racha de `[A-Za-z0-9_./:@-]`) es un identificador `\w+` mas largo que la
 * palabra sola (`ganancia_ordenex`, `deOrdenex`, `NETO_ORDENEX_LABEL`). Solo en TESTS (`enTest`),
 * ademas:
 *  - un token en minusculas mas largo que la palabra (`liquidado.ordenex`, `lib/utils/ingreso-ordenex.ts`,
 *    y los dominios de DATO de prueba `no-reply@ordenex.co`, `https://ordenex.app/…`, R16);
 *  - la palabra en minusculas entre comillas de un selector (`='ordenex'`) o en codigo Markdown (`` `ordenex` ``).
 * Nunca se admite `X-Ordenex-…` (contrato, R17) salvo con `cabeceraPermitida` (negativas L5b de
 * tests), ni la palabra sola con su caja de marca («Ordenex», «ORDENEX»), ni la minuscula suelta.
 */
export function quitarIdentificadores(
  texto: string,
  opciones: { enTest?: boolean; cabeceraPermitida?: boolean } = {},
): string {
  const { enTest = false, cabeceraPermitida = false } = opciones;
  const tok = /[A-Za-z0-9_./:@-]/;
  let out = "";
  let i = 0;
  const re = /ordenex/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    let a = m.index;
    let b = m.index + m[0].length;
    while (a > 0 && tok.test(texto[a - 1])) a -= 1;
    while (b < texto.length && tok.test(texto[b])) b += 1;
    const token = texto.slice(a, b).replace(/[.:-]+$/, "");
    const minuscula = m[0] === "ordenex";
    const previo = texto.slice(Math.max(0, m.index - 2), m.index);
    const largo = token.length > m[0].length;
    const admitida = /^X-Ordenex-/i.test(texto.slice(a, b))
      ? cabeceraPermitida
      : (/^\w+$/.test(token) && largo) ||
        (enTest && minuscula && largo) ||
        (enTest && minuscula && token === "ordenex" && (/^=['"]$/.test(previo) || previo.endsWith("`")));
    out += texto.slice(i, m.index) + (admitida ? "·······" : m[0]);
    i = m.index + m[0].length;
  }
  return out + texto.slice(i);
}

// ---------------------------------------------------------------------------------------------
// Bloque R1 — la marca vigente escrita a mano fuera de su modulo
// ---------------------------------------------------------------------------------------------

/**
 * Hallazgos de la marca vigente escrita a mano en un texto (R1). `nombre` se busca suelto y
 * sensible a mayusculas; `corto` solo en las formas de etiqueta (`de X`, `Cobró X`, `Total X`),
 * porque una palabra suelta como «Velox» daria falsos positivos (design §6.2).
 */
export function hallazgosMarcaAMano(
  fuente: string,
  archivo: string,
  marca: { nombre: string; nombreCorto: string },
  permitido: (t: string) => boolean = () => false,
): Hallazgo[] {
  const corto = marca.nombreCorto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const formasCortas = new RegExp(`(^|\\s)(de|Cobró|Total)\\s+${corto}\\b`);
  return textosDeCodigo(fuente, archivo)
    .filter((n) => (n.texto.includes(marca.nombre) || formasCortas.test(n.texto)) && !permitido(n.texto))
    .map((n) => ({ archivo, linea: n.linea, fragmento: recortar(n.texto) }));
}

// ---------------------------------------------------------------------------------------------
// Bloque R16 — los tests no se anclan a su fuente
// ---------------------------------------------------------------------------------------------

/** ¿El fuente importa (o mockea) `lib/marca/identidad`, por alias o por ruta relativa? */
export function importaIdentidad(fuente: string, archivo = "fuente.ts"): boolean {
  const sf = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true, tipoDeScript(archivo));
  let si = false;
  const visitar = (n: ts.Node): void => {
    if (si) return;
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && esEspecificadorDeModulo(n)) {
      if (/(^|\/)lib\/marca\/identidad(\.ts)?$/.test(n.text)) si = true;
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return si;
}

// ---------------------------------------------------------------------------------------------
// Bloque contrato (R17, R18, R20)
// ---------------------------------------------------------------------------------------------

/** Lo que ya no puede salir en el contrato con integradores ni en el correo de soporte. */
export const CONTRATO_RETIRADO: ReadonlyArray<readonly [nombre: string, patron: RegExp]> = [
  ["cabecera de firma vieja (X-Ordenex-*)", /X-Ordenex-/gi],
  ["dominio viejo (ordenex.co, app.ordenex.co, soporte@ordenex.co)", /ordenex\.co\b/gi],
];

function contratoEn(texto: string): string[] {
  return CONTRATO_RETIRADO.filter(([, p]) => new RegExp(p.source, "i").test(texto)).map(([n]) => n);
}

/** Contrato retirado en los nodos de texto de un fuente TS/JS (los comentarios no cuentan). */
export function hallazgosContratoEnCodigo(fuente: string, archivo = "fuente.ts"): Hallazgo[] {
  return textosDeCodigo(fuente, archivo).flatMap((n) =>
    contratoEn(n.texto).map((que) => ({ archivo, linea: n.linea, fragmento: `${que}: ${recortar(n.texto)}` })),
  );
}

/** Contrato retirado en un archivo de texto plano (cada linea). */
export function hallazgosContratoEnTextoPlano(fuente: string, archivo: string): Hallazgo[] {
  const out: Hallazgo[] = [];
  fuente.split("\n").forEach((l, i) => {
    for (const que of contratoEn(l)) out.push({ archivo, linea: i + 1, fragmento: `${que}: ${recortar(l)}` });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Censos del arbol: listas cerradas y recorridos. Los usa la guardia y el censo de T2.
// ---------------------------------------------------------------------------------------------

export const CODIGO_DIRS = ["app", "components", "hooks", "lib"] as const;
export const MODULO_MARCA = "lib/marca/identidad.ts";

/** Esta guardia, su detector y la marca retirada de las negativas: contienen la marca retirada a proposito (sinteticos, `MARCAS_RETIRADAS`, rutas). */
export const PROPIOS = new Set([
  "tests/unit/guards/marca-fuente-unica-493.guardia.test.ts",
  "tests/fixtures/marca-retirada-493.ts",
  "tests/fixtures/marca-retirada-nombre-493.ts",
  // 494: su guardia, su detector y su trinquete tambien la contienen a proposito. T8.2 retira el trinquete.
  "tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts",
  "tests/fixtures/marca-sin-ordenex-494.ts",
  "tests/fixtures/marca-pendientes-494.ts",
]);

/**
 * R16 — los UNICOS tests que pueden importar `lib/marca/identidad` (lista cerrada, medida en T0):
 * el ancla de la 493, la guardia de la 493 y los tests/guardias de paridad de la 492.
 */
export const PUEDEN_IMPORTAR_LA_MARCA = new Set([
  "tests/unit/marca/textos-ancla-493.test.ts",
  "tests/unit/guards/marca-fuente-unica-493.guardia.test.ts",
  "tests/unit/marca/identidad.test.ts",
  "tests/unit/guards/marca-velox-identidad.guardia.test.ts",
  "tests/unit/guards/marca-velox-sin-anterior.guardia.test.ts",
]);

/** L5b — tests de contrato que afirman que la cabecera vieja `X-Ordenex-*` YA NO sale (lista cerrada). */
export const NEGATIVAS_DE_CONTRATO = new Set([
  "tests/unit/clients/webhook-sender.test.ts",
  "tests/unit/crypto/webhook-firma.test.ts",
  "tests/unit/services/webhook-estado-service.test.ts",
  "tests/unit/services/webhook-estado-service.mensajero.test.ts",
  "tests/unit/services/WebhookEventoOrdenService.test.ts",
  "tests/unit/api/openapi-webhook-estado-actualizado.test.ts",
  "tests/integration/api/webhook-evidencias-url-resuelve.route.test.ts",
  "tests/integration/db/455/caracterizacion/webhook-estado.test.ts",
  "tests/unit/docs/changelog-api-493.test.ts",
]);

/**
 * R1 — excepciones CERRADAS a «la marca vigente escrita a mano» (design §6.2):
 *  - `app/_legal/datos-legales.ts`: `DATOS_LEGALES.marca` es un dato legal con test propio (490/492);
 *  - «<marca> S.A.» como EJEMPLO de razon social (P2) en sus tres archivos: es un dato, no la marca.
 */
export const R1_ARCHIVOS_EXENTOS = new Set(["app/_legal/datos-legales.ts"]);
export const R1_RAZON_SOCIAL_EN = new Set([
  "components/shared/sinpe-textos.ts",
  "app/(app)/configuracion/tarifas/_components/CrearZonaForm.tsx",
  "lib/types/plantilla-datos.ts",
]);

/** El nombre de archivo de la coleccion Postman no se renombra (fuera de alcance, requirements). */
export const POSTMAN = "ordenex-api-key.postman_collection.json";
export const lineaPermitidaEnDocs = (l: string) => !RETIRADA.test(l.split(POSTMAN).join(""));

/** Documentacion para integradores barrida como texto (R9). */
export const DOCS_INTEGRADORES = [
  "docs/api/guia-integracion/guia-integracion.html",
  "docs/api/guia-integracion/README.md",
  "docs/api/api-key-openapi.yaml",
] as const;

const archivosCodigoSinMarca = () => archivosDeCodigo(CODIGO_DIRS).filter((f) => f !== MODULO_MARCA);
const archivosTest = () => archivosDeCodigo(["tests", "e2e"]);

export function censoR15Codigo(): Hallazgo[] {
  return archivosCodigoSinMarca().flatMap((f) => hallazgosRetiradaEnCodigo(leer(f), f));
}

export function censoR15Public(): Hallazgo[] {
  const js = listar("public", /\.js$/).flatMap((f) => hallazgosRetiradaEnCodigo(leer(f), f));
  const planos = listar("public", /\.(json|html)$/).flatMap((f) => hallazgosRetiradaEnTextoPlano(leer(f), f));
  return [...js, ...planos];
}

export function censoR10Ayuda(): Hallazgo[] {
  return listar("docs/ayuda", /\.md$/).flatMap((f) => hallazgosRetiradaEnTextoPlano(leer(f), f));
}

export function censoR9Integradores(): Hallazgo[] {
  return DOCS_INTEGRADORES.flatMap((f) => hallazgosRetiradaEnTextoPlano(leer(f), f, lineaPermitidaEnDocs));
}

export function censoR1(marca: { nombre: string; nombreCorto: string }): Hallazgo[] {
  const razonSocial = `${marca.nombre} S.A.`;
  return archivosCodigoSinMarca()
    .filter((f) => !R1_ARCHIVOS_EXENTOS.has(f))
    .flatMap((f) =>
      hallazgosMarcaAMano(
        leer(f),
        f,
        marca,
        (t) => R1_RAZON_SOCIAL_EN.has(f) && t.includes(razonSocial) && !t.split(razonSocial).join("").includes(marca.nombre),
      ),
    );
}

export function censoR16Imports(): string[] {
  return archivosTest().filter((f) => !PUEDEN_IMPORTAR_LA_MARCA.has(f) && importaIdentidad(leer(f), f));
}

export function censoR16Textos(): Hallazgo[] {
  return archivosTest()
    .filter((f) => !PROPIOS.has(f))
    .flatMap((f) => {
      const cabecera = NEGATIVAS_DE_CONTRATO.has(f);
      return hallazgosRetiradaEnCodigo(
        leer(f),
        f,
        (t) => !RETIRADA.test(quitarIdentificadores(t, { enTest: true, cabeceraPermitida: cabecera })),
      );
    });
}

export function censoContrato(): Hallazgo[] {
  const codigo = archivosDeCodigo(CODIGO_DIRS)
    .concat(listar("public", /\.js$/))
    .flatMap((f) => hallazgosContratoEnCodigo(leer(f), f));
  const planos = [
    ...listar("public", /\.(json|html)$/),
    ...listar("docs/ayuda", /\.md$/),
    ...listar("docs/api", /./).filter((f) => f !== "docs/api/CHANGELOG.md" && !/\.(pdf|png|jpe?g)$/i.test(f)),
  ].flatMap((f) => hallazgosContratoEnTextoPlano(leer(f), f));
  return [...codigo, ...planos];
}
