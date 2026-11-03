import { Prisma } from "@prisma/client";

// Fix P2002 bajo el driver adapter de Prisma 7 (`@prisma/adapter-pg` / `PrismaPg`).
//
// Con el adapter, la violacion de unicidad P2002 NO trae `error.meta.target`
// (viene `undefined`). El nombre de la constraint violada vive en
// `error.meta.driverAdapterError.cause.originalMessage`, p. ej.:
//   "llave duplicada viola restriccion de unicidad «usuario_email_key»".
// En el motor nativo (sin adapter) el campo violado venia en `meta.target`
// (array de columnas). Los handlers que disambiguan leyendo solo `meta.target`
// se rompen bajo el adapter y dejan escalar el P2002 crudo a un 500.
//
// Este modulo unifica AMBAS formas en un texto minusculizado y buscable con
// `.includes(...)`, para que los `mapDuplicadoError` de cada repositorio sigan
// funcionando igual en nativo y en adapter.

/** `true` si el error es un P2002 (violacion de unicidad) de Prisma. */
export function esP2002(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Devuelve un texto en minusculas con el/los identificadores de la constraint
 * violada por un P2002, robusto a ambas formas del error:
 *   - forma nativa: `meta.target` (array -> join con coma; string -> tal cual).
 *   - forma adapter: `meta.driverAdapterError.cause.originalMessage` (string).
 * Concatena ambas fuentes (lo que exista) separadas por espacio. Devuelve `null`
 * si el error no es un P2002 o si no aporta ninguna pista de la constraint; los
 * callers deben tratar `null` como "no puedo disambiguar" y re-lanzar el original.
 */
export function textoConstraintP2002(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return null;
  }
  const meta = error.meta;
  if (meta == null) return null;

  const partes: string[] = [];

  // Forma nativa: meta.target (array de columnas o, en algunos casos, string).
  const target: unknown = (meta as Record<string, unknown>).target;
  if (Array.isArray(target)) {
    partes.push(target.filter((t): t is string => typeof t === "string").join(","));
  } else if (typeof target === "string") {
    partes.push(target);
  }

  // Forma adapter: meta.driverAdapterError.cause.originalMessage (campos no
  // tipados en el tipo de Prisma; acceso defensivo para no romper `strict`).
  const original = leerOriginalMessage(meta as Record<string, unknown>);
  if (original) partes.push(original);

  const texto = partes.join(" ").toLowerCase().trim();
  return texto.length > 0 ? texto : null;
}

/** Lee `meta.driverAdapterError.cause.originalMessage` de forma segura, o `null`. */
function leerOriginalMessage(meta: Record<string, unknown>): string | null {
  const dae = meta.driverAdapterError;
  if (dae == null || typeof dae !== "object") return null;
  const cause = (dae as Record<string, unknown>).cause;
  if (cause == null || typeof cause !== "object") return null;
  const original = (cause as Record<string, unknown>).originalMessage;
  return typeof original === "string" ? original : null;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 499 (R13) — EL RECHAZO DEL INDICE `zona_distrito_distrito_id_key`.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// MEDIDO EL 2026-11-02 contra Postgres, con el cliente real (adapter pg), un `createMany` duplicado
// DENTRO de un `$transaction` interactivo:
//   ctor: PrismaClientKnownRequestError · code: "P2002" · meta.target: ausente
//   meta.driverAdapterError.cause.originalCode: "23505"
//   meta.driverAdapterError.cause.originalMessage: «llave duplicada viola restriccion de unicidad
//                                                  «zona_distrito_distrito_id_key»»
//   cause (del propio error): undefined
//
// Se cubre IGUAL la forma del driver sin `code` —la que se midio para la FK en la 373
// (`_shared/prisma-fk.ts`): `DriverAdapterError` con el error de `pg` en `cause`—, porque el adapter
// ya cambio de forma una vez (P2002 sin `meta.target`).
//
// Se detecta POR EL NOMBRE DEL INDICE, nunca solo por el SQLSTATE: `23505` tambien lo da el par
// `zona_distrito_zona_id_distrito_id_key`, y ese nombre NO contiene `zona_distrito_distrito_id_key`.

/** Nombre del indice unico de la 499, tal como lo deriva Prisma de `@@unique([distritoId])`. */
export const INDICE_DISTRITO_UNICO = "zona_distrito_distrito_id_key";

/**
 * `true` si el error es la violacion del indice unico de `zona_distrito.distrito_id`, en
 * cualquiera de sus dos formas (P2002 de Prisma, o el error del driver con SQLSTATE 23505).
 * Cualquier otro error devuelve `false` y quien llama DEBE seguir su camino (re-lanzar).
 */
export function esViolacionDistritoUnico(error: unknown): boolean {
  const texto = textoConstraintP2002(error);
  if (texto !== null) return texto.includes(INDICE_DISTRITO_UNICO);
  return textoDeErrorDeDriver23505(error)?.includes(INDICE_DISTRITO_UNICO) ?? false;
}

/**
 * El texto (minusculas) de un error del driver con SQLSTATE 23505, o `null` si no lo es. Mira el
 * error y su `cause`: `code`/`originalCode` para el SQLSTATE, y `message`/`originalMessage`/
 * `constraint` para el nombre.
 */
function textoDeErrorDeDriver23505(error: unknown): string | null {
  if (error == null || typeof error !== "object") return null;
  const capas = [error, (error as Record<string, unknown>).cause].filter(
    (c): c is Record<string, unknown> => c != null && typeof c === "object",
  );
  const es23505 = capas.some((c) => c.code === "23505" || c.originalCode === "23505");
  if (!es23505) return null;
  const partes: string[] = [];
  for (const c of capas) {
    for (const campo of ["message", "originalMessage", "constraint"]) {
      const v = c[campo];
      if (typeof v === "string") partes.push(v);
    }
  }
  return partes.join(" ").toLowerCase();
}
