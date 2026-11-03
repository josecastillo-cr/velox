import { describe, it, expect, vi } from "vitest";
import { ZonaService, MSG_DISTRITO_RECIEN_ASIGNADO } from "@/lib/services/ZonaService";
import type {
  ConflictoDistritoZona,
  IZonaRepository,
} from "@/lib/interfaces/repositories/IZonaRepository";
import type { Actor } from "@/lib/interfaces/services/IZonaService";
import type { ActualizarZonaInput, CrearZonaInput } from "@/lib/types/zona";

// ⭑ FICHA 499 / B.6 — la traduccion de `distrito_en_otra_zona` en el service (R11, R13).
// El orden de los mensajes lo fija el SERVICE con el comparador español, no la base: por eso se
// prueba aqui, con un doble que devuelve los conflictos DESORDENADOS.

const MAESTRO: Actor = { usuarioId: "m1", rol: "maestro" };

function repoCon(overrides: Partial<IZonaRepository>): IZonaRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    listLite: vi.fn(),
    update: vi.fn(),
    hardDelete: vi.fn(),
    countExistingDistritos: vi.fn(async (ids: string[]) => ids.length),
    countExistingVehiculos: vi.fn(async (ids: string[]) => ids.length),
    findCentralZonaId: vi.fn(),
    contarOrdenesVivasPorZona: vi.fn(),
    listarSinpe: vi.fn(),
    findSinpeByZona: vi.fn(),
    zonaIdDeUsuario: vi.fn(),
    guardarSinpe: vi.fn(),
    confirmarSinpe: vi.fn(),
    ...overrides,
  };
}

const CREAR: CrearZonaInput = {
  nombre: "Norte",
  cobroVehiculo: false,
  esCentral: false,
  distritoIds: ["d1", "d2", "d3"],
  tarifas: [],
  sinpeNumero: "80000000",
  sinpeNombre: "Titular de Prueba",
};
const ACTUALIZAR: ActualizarZonaInput = {
  nombre: "Norte",
  cobroVehiculo: false,
  distritoIds: ["d1", "d2", "d3"],
  tarifas: [],
};

// Desordenados a proposito, con tildes y mayusculas mezcladas. Con un orden por codigo de
// caracter, «Ángeles» iria DESPUES de «san Pedro» y «Zapote», y «san Pedro» despues de «Zapote».
const DESORDENADOS: ConflictoDistritoZona[] = [
  { distritoNombre: "Zapote", zonaNombre: "Este" },
  { distritoNombre: "san Pedro", zonaNombre: "Este" },
  { distritoNombre: "Ángeles", zonaNombre: "Oeste" },
  { distritoNombre: "Barva", zonaNombre: "Norte 2" },
];
const ESPERADOS = [
  "Ángeles ya está en la zona Oeste.",
  "Barva ya está en la zona Norte 2.",
  "san Pedro ya está en la zona Este.",
  "Zapote ya está en la zona Este.",
];

describe("499/B.6 — ZonaService traduce `distrito_en_otra_zona`", () => {
  it("R11 (crear): un mensaje por conflicto, en orden alfabetico español del distrito", async () => {
    const repo = repoCon({
      create: vi.fn().mockResolvedValue({ estado: "distrito_en_otra_zona", conflictos: DESORDENADOS }),
    });
    expect(await new ZonaService(repo).crear(CREAR, MAESTRO)).toEqual({
      status: "validation_error",
      fieldErrors: { distritoIds: ESPERADOS },
    });
  });

  it("R11 (actualizar): un mensaje por conflicto, en orden alfabetico español del distrito", async () => {
    const repo = repoCon({
      update: vi.fn().mockResolvedValue({ estado: "distrito_en_otra_zona", conflictos: DESORDENADOS }),
    });
    expect(await new ZonaService(repo).actualizar("z1", ACTUALIZAR, MAESTRO)).toEqual({
      status: "validation_error",
      fieldErrors: { distritoIds: ESPERADOS },
    });
  });

  it("R11: no muta la lista que devuelve el repositorio", async () => {
    const copia = DESORDENADOS.map((c) => ({ ...c }));
    const repo = repoCon({
      create: vi.fn().mockResolvedValue({ estado: "distrito_en_otra_zona", conflictos: copia }),
    });
    await new ZonaService(repo).crear(CREAR, MAESTRO);
    expect(copia).toEqual(DESORDENADOS);
  });

  it("R13: `conflictos: null` (el indice) da SOLO el mensaje de recarga, al crear y al actualizar", async () => {
    expect(MSG_DISTRITO_RECIEN_ASIGNADO).toBe(
      "Alguno de los elegidos acaba de asignarse a otra zona. Recarga la página y vuelve a intentarlo.",
    );
    const repo = repoCon({
      create: vi.fn().mockResolvedValue({ estado: "distrito_en_otra_zona", conflictos: null }),
      update: vi.fn().mockResolvedValue({ estado: "distrito_en_otra_zona", conflictos: null }),
    });
    const svc = new ZonaService(repo);
    const esperado = {
      status: "validation_error",
      fieldErrors: { distritoIds: [MSG_DISTRITO_RECIEN_ASIGNADO] },
    };
    expect(await svc.crear(CREAR, MAESTRO)).toEqual(esperado);
    expect(await svc.actualizar("z1", ACTUALIZAR, MAESTRO)).toEqual(esperado);
  });

  it("`not_found` y `sin_zona_central` siguen igual", async () => {
    const svc404 = new ZonaService(
      repoCon({ update: vi.fn().mockResolvedValue({ estado: "not_found" }) }),
    );
    expect(await svc404.actualizar("z1", ACTUALIZAR, MAESTRO)).toEqual({ status: "not_found" });

    const svcCentral = new ZonaService(
      repoCon({ update: vi.fn().mockResolvedValue({ estado: "sin_zona_central" }) }),
    );
    const res = await svcCentral.actualizar("z1", { ...ACTUALIZAR, esCentral: false }, MAESTRO);
    expect(res.status).toBe("validation_error");
    expect(res.status === "validation_error" && Object.keys(res.fieldErrors)).toEqual(["esCentral"]);
  });
});
