import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

import {
  INDICE_DISTRITO_UNICO,
  esViolacionDistritoUnico,
} from "@/lib/repositories/_shared/prisma-unique";

// ⭑ FICHA 499 (R13) — el detector del rechazo de `zona_distrito_distrito_id_key`, en las dos
// formas en que puede llegar. La forma P2002 es la MEDIDA el 2026-11-02 (ver el comentario de
// `_shared/prisma-unique.ts`); la del driver sin `code` es la que se midio para la FK en la 373.

function p2002(originalMessage: string, originalCode = "23505") {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the (not available)", {
    code: "P2002",
    clientVersion: "7.8.0",
    meta: {
      modelName: "ZonaDistrito",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: { originalCode, originalMessage, kind: "UniqueConstraintViolation" },
      },
    },
  });
}

/** El error del driver tal como lo deja el adapter cuando NO lo traduce: sin `code` propio. */
function errorDeDriver(cause: Record<string, unknown>): Error {
  const e = new Error(String(cause.message ?? "driver error"));
  e.name = "DriverAdapterError";
  (e as Error & { cause: unknown }).cause = cause;
  return e;
}

describe("499 — esViolacionDistritoUnico", () => {
  it("el nombre del indice es el que deriva Prisma de @@unique([distritoId])", () => {
    expect(INDICE_DISTRITO_UNICO).toBe("zona_distrito_distrito_id_key");
  });

  it("detecta el P2002 medido (nombre en meta.driverAdapterError.cause.originalMessage)", () => {
    const e = p2002("llave duplicada viola restricción de unicidad «zona_distrito_distrito_id_key»");
    expect(esViolacionDistritoUnico(e)).toBe(true);
  });

  it("detecta el P2002 de la forma nativa (meta.target con el nombre)", () => {
    const e = new Prisma.PrismaClientKnownRequestError("x", {
      code: "P2002",
      clientVersion: "7.8.0",
      meta: { target: "zona_distrito_distrito_id_key" },
    });
    expect(esViolacionDistritoUnico(e)).toBe(true);
  });

  it("detecta el error del driver sin `code`, con cause.code 23505 y el nombre en el mensaje", () => {
    const e = errorDeDriver({
      code: "23505",
      message: 'duplicate key value violates unique constraint "zona_distrito_distrito_id_key"',
    });
    expect(esViolacionDistritoUnico(e)).toBe(true);
  });

  it("detecta el error del driver con originalCode 23505 y el nombre en `constraint`", () => {
    const e = errorDeDriver({
      originalCode: "23505",
      originalMessage: "llave duplicada",
      constraint: "zona_distrito_distrito_id_key",
    });
    expect(esViolacionDistritoUnico(e)).toBe(true);
  });

  it("NO detecta el indice del par (zona_distrito_zona_id_distrito_id_key), en ninguna forma", () => {
    const msg = "llave duplicada viola restricción de unicidad «zona_distrito_zona_id_distrito_id_key»";
    expect(esViolacionDistritoUnico(p2002(msg))).toBe(false);
    expect(esViolacionDistritoUnico(errorDeDriver({ code: "23505", message: msg }))).toBe(false);
  });

  it("NO detecta la central unica, ni un 23505 sin nombre, ni otro SQLSTATE con el nombre", () => {
    expect(esViolacionDistritoUnico(p2002("«zona_es_central_unico»"))).toBe(false);
    expect(esViolacionDistritoUnico(errorDeDriver({ code: "23505", message: "llave duplicada" }))).toBe(false);
    expect(
      esViolacionDistritoUnico(
        errorDeDriver({ code: "23503", message: "zona_distrito_distrito_id_key" }),
      ),
    ).toBe(false);
  });

  it("NO detecta nada que no sea un error", () => {
    expect(esViolacionDistritoUnico(null)).toBe(false);
    expect(esViolacionDistritoUnico("zona_distrito_distrito_id_key")).toBe(false);
    expect(esViolacionDistritoUnico(new Error("zona_distrito_distrito_id_key"))).toBe(false);
  });
});
