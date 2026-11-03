import { describe, it, expect, vi } from "vitest";

import {
  corregirConsolidacionRecibidaAction,
  listarConsolidacionesSateliteAction,
  listarSaldosSatelitesAction,
  marcarConsolidacionRecibidaAction,
  revertirConciliacionAction,
} from "@/lib/actions/conciliacion-satelites";
import type { Actor } from "@/lib/interfaces/services/IOrdenService";
import type { IConciliacionSatelitesService } from "@/lib/interfaces/services/IConciliacionSatelitesService";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 431 / T8 (R10/R27) — EL BORDE: SIN SESION, ENTRADA INVALIDA, Y LO QUE NO SE ESCRIBE.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// EL ORDEN ES LA ASERCION, no un detalle de estilo:
//   1. SIN SESION se corta ANTES de validar y ANTES de construir el servicio;
//   2. `schema.parse` mata en el BORDE el monto ausente, negativo o con tres decimales (R10), y
//      —por el `.strict()`— cualquier clave colada;
//   3. el ROL lo decide el SERVICIO (eso se mide en `conciliacion-satelites-service.test.ts`).
//
// En los dos primeros casos, `expect(service.x).not.toHaveBeenCalled()` es lo que afirma que NO SE
// ESCRIBE NADA: R10 dice «y NO DEBE escribir nada», y eso no se prueba mirando el `status`.

const MAESTRO: Actor = { usuarioId: "u-maestro", rol: "maestro" };
const CB = "22222222-2222-4222-8222-222222222222";
const ZONA = "11111111-1111-4111-8111-111111111111";

function fakeService(overrides: Partial<IConciliacionSatelitesService> = {}) {
  return {
    listarSaldosSatelites: vi.fn(async () => ({
      status: "ok" as const,
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
    })),
    listarSaldosSatelitesCompleto: vi.fn(async () => ({
      status: "ok" as const,
      items: [],
      total: 0,
    })),
    listarConsolidacionesSatelite: vi.fn(async () => ({
      status: "ok" as const,
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
    })),
    listarConsolidacionesSateliteCompleto: vi.fn(async () => ({
      status: "ok" as const,
      items: [],
      total: 0,
    })),
    marcarRecibida: vi.fn(async () => ({ status: "ok" as const, cierreBodegaId: CB })),
    revertirConciliacion: vi.fn(async () => ({ status: "ok" as const, cierreBodegaId: CB })),
    corregirRecibida: vi.fn(async () => ({ status: "ok" as const, cierreBodegaId: CB })),
    ...overrides,
  } as unknown as IConciliacionSatelitesService & Record<string, ReturnType<typeof vi.fn>>;
}

const conActor = (actor: Actor | null) => ({ getActor: async () => actor });

/** Lee las llamadas de un doble que viaja tipado como el metodo de la interfaz (ver el servicio). */
function llamadasDe(fn: unknown): unknown[][] {
  return (fn as { mock: { calls: unknown[][] } }).mock.calls;
}

describe("431/T8 — el borde: sin sesion", () => {
  it("⭑ sin sesion, las cuatro acciones devuelven `unauthenticated` y NO tocan el servicio", async () => {
    const service = fakeService();
    const deps = { service, ...conActor(null) };

    expect((await listarSaldosSatelitesAction({}, deps)).status).toBe("unauthenticated");
    expect(
      (await listarConsolidacionesSateliteAction({ zonaId: ZONA }, deps)).status,
    ).toBe("unauthenticated");
    expect(
      (
        await marcarConsolidacionRecibidaAction(
          { cierreBodegaId: CB, montoRecibido: "485.00" },
          deps,
        )
      ).status,
    ).toBe("unauthenticated");
    expect((await revertirConciliacionAction({ cierreBodegaId: CB }, deps)).status).toBe(
      "unauthenticated",
    );

    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("431/T8 (R10) — el monto muere en el borde, y no se escribe nada", () => {
  it.each([
    ["ausente", {}],
    ["cadena vacia", { montoRecibido: "" }],
    ["negativo", { montoRecibido: "-1.00" }],
    // Ficha 498 (Q5): el cero literal YA NO muere en el borde (lo decide el repositorio con el aporte).
    ["cero con TRES decimales", { montoRecibido: "0.001" }],
    ["con TRES decimales", { montoRecibido: "485.123" }],
    ["no numerico", { montoRecibido: "mucho" }],
    ["un number y no un string", { montoRecibido: 485 }],
  ])("⭑ monto %s -> `validation_error` y el servicio NI SE LLAMA", async (_n, parche) => {
    const service = fakeService();
    const r = await marcarConsolidacionRecibidaAction(
      { cierreBodegaId: CB, ...parche },
      { service, ...conActor(MAESTRO) },
    );

    expect(r.status).toBe("validation_error");
    // R10: «NO DEBE escribir nada». Esto es lo que lo afirma.
    expect(service.marcarRecibida).not.toHaveBeenCalled();
  });

  it("⭑ FICHA 498 (Q5, R15b) — el CERO literal pasa el borde y llega al servicio, que decide con el dato", async () => {
    // SUSTITUYE al caso de la 431 «el CERO se rechaza a proposito»: el humano admitio el 0 el
    // 2026-11-02, SOLO en la conciliacion y SOLO con aporte <= 0. Esa es una regla de DATO: el borde
    // admite el cero literal y el repositorio responde `recibido_cero_con_aporte` si hay dinero por
    // entregar. `montoPositivoSchema` no se toca (lo mide la suite del schema).
    for (const cero of ["0", "0.0", "0.00"]) {
      const service = fakeService();
      const r = await marcarConsolidacionRecibidaAction(
        { cierreBodegaId: CB, montoRecibido: cero },
        { service, ...conActor(MAESTRO) },
      );
      expect(r.status, cero).toBe("ok");
      expect(service.marcarRecibida).toHaveBeenCalledTimes(1);
    }
  });

  it("un monto VALIDO pasa, con y sin nota", async () => {
    // Control positivo: sin el, un schema que lo rechazara todo pasaria los casos de arriba.
    const service = fakeService();
    const deps = { service, ...conActor(MAESTRO) };

    expect(
      (
        await marcarConsolidacionRecibidaAction(
          { cierreBodegaId: CB, montoRecibido: "485.00" },
          deps,
        )
      ).status,
    ).toBe("ok");
    expect(
      (
        await marcarConsolidacionRecibidaAction(
          { cierreBodegaId: CB, montoRecibido: "485", nota: "faltaron 15" },
          deps,
        )
      ).status,
    ).toBe("ok");
    expect(service.marcarRecibida).toHaveBeenCalledTimes(2);
  });

  it("⭑ `.strict()`: una clave colada muere en el borde", async () => {
    // Lo que esto impide de verdad: que alguien mande `actorUsuarioId` o `estado` en el payload y
    // el borde se lo pase al servicio. Quien marca sale de la SESION, siempre.
    const service = fakeService();
    const r = await marcarConsolidacionRecibidaAction(
      { cierreBodegaId: CB, montoRecibido: "485.00", actorUsuarioId: "otro" },
      { service, ...conActor(MAESTRO) },
    );

    expect(r.status).toBe("validation_error");
    expect(service.marcarRecibida).not.toHaveBeenCalled();
  });

  it("un `cierreBodegaId` que no es uuid muere en el borde", async () => {
    const service = fakeService();
    const r = await revertirConciliacionAction(
      { cierreBodegaId: "no-soy-un-uuid" },
      { service, ...conActor(MAESTRO) },
    );
    expect(r.status).toBe("validation_error");
    expect(service.revertirConciliacion).not.toHaveBeenCalled();
  });
});

describe("431/T8 — el borde transporta lo que el servicio decide, sin reinterpretarlo", () => {
  it("`forbidden` del servicio llega tal cual (el rol es dominio, no transporte)", async () => {
    const service = fakeService({
      marcarRecibida: vi.fn(async () => ({ status: "forbidden" as const })),
    });
    const r = await marcarConsolidacionRecibidaAction(
      { cierreBodegaId: CB, montoRecibido: "485.00" },
      { service, ...conActor(MAESTRO) },
    );
    expect(r).toEqual({ status: "forbidden" });
  });

  it("`conflict` y `no_encontrada` llegan tal cual", async () => {
    const enConflicto = fakeService({
      marcarRecibida: vi.fn(async () => ({ status: "conflict" as const })),
    });
    expect(
      await marcarConsolidacionRecibidaAction(
        { cierreBodegaId: CB, montoRecibido: "1.00" },
        { service: enConflicto, ...conActor(MAESTRO) },
      ),
    ).toEqual({ status: "conflict" });

    const inexistente = fakeService({
      revertirConciliacion: vi.fn(async () => ({ status: "no_encontrada" as const })),
    });
    expect(
      await revertirConciliacionAction(
        { cierreBodegaId: CB },
        { service: inexistente, ...conActor(MAESTRO) },
      ),
    ).toEqual({ status: "no_encontrada" });
  });

  it("el listado aplica los valores por defecto de paginacion del dominio", async () => {
    const service = fakeService();
    await listarSaldosSatelitesAction({}, { service, ...conActor(MAESTRO) });
    const input = llamadasDe(service.listarSaldosSatelites)[0][0] as {
      page: number;
      pageSize: number;
    };
    expect(input.page).toBe(1);
    expect(input.pageSize).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 473 / T4 (R10/R11) — CORREGIR: el mismo borde que marcar, y la escritura propia.
// ═════════════════════════════════════════════════════════════════════════════════════════════

describe("473/T4 — corregirConsolidacionRecibidaAction", () => {
  it("R10 corregir sin sesion responde unauthenticated sin llamar al servicio", async () => {
    const service = fakeService();
    const r = await corregirConsolidacionRecibidaAction(
      // Entrada INVALIDA a proposito: sin sesion se corta ANTES de validar.
      { cierreBodegaId: "no-uuid", montoRecibido: "-1", extra: 1 },
      { service, ...conActor(null) },
    );
    expect(r.status).toBe("unauthenticated");
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    ["monto ausente", {}],
    // Ficha 498 (Q5): «monto 0» sale de esta lista; el cero literal llega al servicio (R15b).
    ["monto negativo", { montoRecibido: "-5.00" }],
    ["monto con tres decimales", { montoRecibido: "200800.001" }],
    ["monto no numerico", { montoRecibido: "doscientos" }],
    ["clave extra", { montoRecibido: "200800.00", actorUsuarioId: "otro" }],
    ["nota de 501 caracteres", { montoRecibido: "200800.00", nota: "x".repeat(501) }],
  ])(
    "R11 corregir con %s responde validation_error sin llamar al servicio",
    async (_n, parche) => {
      const service = fakeService();
      const r = await corregirConsolidacionRecibidaAction(
        { cierreBodegaId: CB, ...parche },
        { service, ...conActor(MAESTRO) },
      );
      expect(r.status).toBe("validation_error");
      // La clave colada la reporta zod como error de FORMULARIO (`unrecognized_keys`), no de campo:
      // es el mismo mapeo que hoy usa marcar. Los demas casos SI traen su campo.
      if (r.status === "validation_error" && _n !== "clave extra") {
        expect(Object.keys(r.fieldErrors).length).toBeGreaterThan(0);
      }
      for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    },
  );

  it("corregir ok: llama a corregirRecibida (con nota de 500) y NUNCA a marcarRecibida", async () => {
    const service = fakeService();
    const nota = "y".repeat(500);
    const r = await corregirConsolidacionRecibidaAction(
      { cierreBodegaId: CB, montoRecibido: "200800.00", nota },
      { service, ...conActor(MAESTRO) },
    );
    expect(r).toEqual({ status: "ok", cierreBodegaId: CB });
    expect(service.corregirRecibida).toHaveBeenCalledTimes(1);
    expect(service.corregirRecibida).toHaveBeenCalledWith(
      { cierreBodegaId: CB, montoRecibido: "200800.00", nota },
      MAESTRO,
    );
    expect(service.marcarRecibida).not.toHaveBeenCalled();
  });

  it("marcar NO llama a corregirRecibida", async () => {
    const service = fakeService();
    await marcarConsolidacionRecibidaAction(
      { cierreBodegaId: CB, montoRecibido: "1.00" },
      { service, ...conActor(MAESTRO) },
    );
    expect(service.corregirRecibida).not.toHaveBeenCalled();
  });

  it("`conflict`, `no_encontrada` y `forbidden` del servicio llegan tal cual", async () => {
    for (const status of ["conflict", "no_encontrada", "forbidden"] as const) {
      const service = fakeService({ corregirRecibida: vi.fn(async () => ({ status })) });
      expect(
        await corregirConsolidacionRecibidaAction(
          { cierreBodegaId: CB, montoRecibido: "1.00" },
          { service, ...conActor(MAESTRO) },
        ),
      ).toEqual({ status });
    }
  });
});
