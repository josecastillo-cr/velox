import { describe, expect, it } from "vitest";

import { claveDeConteoProductos, prepararConsultaProductos, TAG_CONTEO_PRODUCTOS } from "@/lib/analytics/productos-consulta";
import type { ConsultaProductos } from "@/lib/analytics/productos-consulta";
import { ConteoProductosService } from "@/lib/services/ConteoProductosService";
import { cacheFalsa } from "./_cache-falsa";
import { dineroFalso, filaDinero } from "./_dinero-falso";

// FEATURE 494 (R9, design §3.3) — UNA ENTRADA ESCRITA ANTES DEL RENOMBRADO NO SE LEE.
//
// `liquidado.ordenex` pasó a `liquidado.empresa`. Leída por el código nuevo, una entrada vieja da
// `liquidado.empresa === undefined`: cifras vacías y ningún error, y `tsc` no lo ve porque la forma
// llega por `JSON.parse`. Las claves van LITERALES: la vieja es la que sigue escrita en la caché.

const AHORA = new Date("2026-09-01T12:00:00.000Z");
const SEP = String.fromCharCode(31);
const CUERPO = ["d=2026-09-01", "h=2026-09-01", "a=global", "z=*", "p=*", "c=*", "s=*", "t=*", "x=*"].join(SEP);

const CLAVE_VIEJA = ["conteo-productos", CUERPO, "$=concedido"].join(SEP);
const CLAVE_NUEVA = ["conteo-productos:v2", CUERPO, "$=concedido"].join(SEP);

function consultaDe(): ConsultaProductos {
  const preparada = prepararConsultaProductos(
    { rango: "personalizado", desde: "2026-09-01", hasta: "2026-09-01" },
    { usuarioId: "u1", rol: "maestro" } as never,
    AHORA,
  );
  if (preparada.status !== "ok") throw new Error(`filtro de prueba invalido: ${preparada.status}`);
  return preparada.consulta;
}

const volumen = {
  async contarProductos() {
    return [{ tiendaId: "t1", tiendaNombre: "Tienda Uno", producto: "1 * Base C", status: "entregado", n: 1 }];
  },
} as never;

/** Una entrada como las que hay escritas hoy: mismo DTO, con el campo por su nombre anterior. */
const ENTRADA_VIEJA = {
  filas: [
    {
      tiendaId: "t1",
      tienda: "Tienda Uno",
      producto: "Base C",
      unidades: 1,
      ordenes: 1,
      porStatus: [{ status: "entregado", conteo: 1 }],
      ordenesAcompanadas: 0,
      dinero: {
        recaudado: "10000.00",
        liquidado: { recaudado: "10000.00", ordenex: "3955.00", tienda: "6045.00", ordenes: 1 },
        pendiente: { recaudado: "0.00", ordenes: 0 },
        retorno: "0.00",
        fulfillment: "0.00",
      },
    },
  ],
  ordenes: 1,
  ordenesSinProducto: 0,
  dinero: { estado: "concedido" },
  lastSync: "2026-09-01T00:00:00.000Z",
};

describe("494/R9 — la caché del análisis de productos", () => {
  it("la clave cambia para la misma consulta, y solo en su primera pieza", () => {
    const clave = claveDeConteoProductos(consultaDe());
    expect(clave).toBe(CLAVE_NUEVA);
    expect(clave).not.toBe(CLAVE_VIEJA);
  });

  it("con una entrada vieja viva, se recalcula y sale la cifra, no un campo vacío", async () => {
    const cache = cacheFalsa();
    // La entrada que dejó la versión anterior, bajo su clave. Si la nueva coincidiera, esto sería un HIT.
    await cache.envolver(CLAVE_VIEJA, [TAG_CONTEO_PRODUCTOS], async () => ENTRADA_VIEJA);
    expect(cache.tamano()).toBe(1);

    const dineroRepo = dineroFalso([filaDinero()]);
    const service = new ConteoProductosService(volumen, cache, dineroRepo, { now: () => AHORA });
    const dto = await service.consultar(consultaDe());

    expect(dineroRepo.llamadas).toBe(1);
    expect(dto.filas[0]?.dinero?.liquidado.empresa).toBe("3955.00");
    expect(JSON.stringify(dto)).not.toContain("ordenex");
    expect(dto.lastSync).toBe(AHORA.toISOString());
  });

  it("la entrada nueva sigue bajo el mismo tag: «refrescar» alcanza a las dos", async () => {
    const cache = cacheFalsa();
    await cache.envolver(CLAVE_VIEJA, [TAG_CONTEO_PRODUCTOS], async () => ENTRADA_VIEJA);
    const service = new ConteoProductosService(volumen, cache, dineroFalso([filaDinero()]), { now: () => AHORA });
    await service.consultar(consultaDe());
    expect(cache.tamano()).toBe(2);

    await cache.invalidar("manual", [TAG_CONTEO_PRODUCTOS]);

    expect(cache.tamano()).toBe(0);
  });
});
