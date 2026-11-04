import { describe, it, expect } from "vitest";

import {
  COLUMNAS_DESCARGA_PAGOS_REGISTRADOS,
  filaDescargaPagoRegistrado,
} from "@/components/shared/liquidacion/pagos-registrados-descarga-columnas";
import * as modulo from "@/components/shared/liquidacion/pagos-registrados-descarga-columnas";
import { PAGOS_REGISTRADOS_COLUMNAS } from "@/components/shared/liquidacion/liquidacion-labels";
import type { PagoRegistradoDTO } from "@/lib/types/liquidacion";
import {
  LLAMADAS_PROHIBIDAS_EN_DINERO,
  codigoSinComentarios,
  quitarComentarios,
} from "@/tests/fixtures/money-safe";

const RUTA_MODULO =
  "components/shared/liquidacion/pagos-registrados-descarga-columnas.ts";

// Feature 172 (T D.2) — columnas de export de la lista de COMPROBANTES. Cubre R49, R56 y R74.
//
// El archivo lo lee un humano que está conciliando dinero: tiene que traer lo que se ve en
// pantalla, con las mismas palabras, incluidos los pagos ANULADOS y por qué se anularon, y
// nada que sea de la máquina.

const PAGO: PagoRegistradoDTO = {
  // El `id` es el ÚNICO uuid del DTO. Está aquí a propósito: el test de abajo comprueba que
  // NO sale por ninguna celda.
  id: "3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c",
  monto: "98765432109.87",
  metodo: "SINPE",
  referencia: "SINPE-88112233",
  nota: "Liquidación de julio",
  fechaPago: "2026-07-30",
  registradoPorNombre: "Ana Maestra",
  registradoAt: "2026-08-02T15:04:05.000Z",
  esDeReparto: false, // feature 206: pago SUELTO, sin reparto
  anulacion: null,
};

const ANULADO: PagoRegistradoDTO = {
  ...PAGO,
  anulacion: {
    motivo: "Se tecleó el monto de otra tienda",
    anuladoPorNombre: "Beto Admin",
    anuladoAt: "2026-08-03T09:00:00.000Z",
  },
};

describe("columnas de descarga de los comprobantes de pago", () => {
  it("declara sus columnas ENUMERADAS, en el orden de la pantalla (R49)", () => {
    expect(COLUMNAS_DESCARGA_PAGOS_REGISTRADOS.map((c) => c.clave)).toEqual([
      "fechaPago",
      "monto",
      "metodo",
      "referencia",
      "nota",
      "registradoPor",
      "registradoEl",
      "estado",
      "anuladoPor",
      "anuladoEl",
      "motivoAnulacion",
    ]);
    expect(COLUMNAS_DESCARGA_PAGOS_REGISTRADOS.map((c) => c.encabezado)).toEqual([
      "Fecha del pago",
      "Monto",
      "Método",
      "Referencia",
      "Nota",
      "Registró",
      "Registrado el",
      "Estado",
      "Anulado por",
      "Anulado el",
      "Motivo de la anulación",
    ]);
  });

  it("los encabezados salen del MISMO objeto del que la tabla saca los suyos", () => {
    // Si el archivo y la pantalla pudieran divergir, el día que alguien renombre una columna
    // en la tabla el xlsx seguiría diciendo lo de antes y nadie se enteraría.
    const porClave = new Map(
      COLUMNAS_DESCARGA_PAGOS_REGISTRADOS.map((c) => [c.clave, c.encabezado]),
    );
    for (const [clave, encabezado] of Object.entries(PAGOS_REGISTRADOS_COLUMNAS)) {
      expect(porClave.get(clave), `columna ${clave}`).toBe(encabezado);
    }
  });

  it("emite el monto TAL CUAL, sin recalcularlo ni adornarlo (money-safe, R14)", () => {
    const fila = filaDescargaPagoRegistrado(PAGO);
    expect(fila.monto).toBe("98765432109.87");
    expect(typeof fila.monto).toBe("string");
    expect(String(fila.monto)).not.toContain("₡");
    // Por qué importa: un `Number(...)` intermedio ni siquiera conserva los CÉNTIMOS.
    expect(filaDescargaPagoRegistrado({ ...PAGO, monto: "1000.10" }).monto).toBe("1000.10");
    expect(String(Number("1000.10"))).toBe("1000.1"); // lo que habría pasado al parsear
  });

  it("emite el método como ETIQUETA legible, no como valor interno (R49)", () => {
    expect(filaDescargaPagoRegistrado(PAGO).metodo).toBe("SINPE");
    expect(filaDescargaPagoRegistrado({ ...PAGO, metodo: "efectivo" }).metodo).toBe(
      "Efectivo",
    );
    expect(filaDescargaPagoRegistrado({ ...PAGO, metodo: "transferencia" }).metodo).toBe(
      "Transferencia",
    );
  });

  it("distingue la fecha REAL del pago del instante en que se registró (R49)", () => {
    // No son lo mismo y el archivo no puede confundirlas: un pago entregado el 30 puede
    // anotarse el 2 del mes siguiente, y la conciliación se hace por la fecha real.
    const fila = filaDescargaPagoRegistrado(PAGO);
    expect(fila.fechaPago).toBe("2026-07-30");
    expect(fila.registradoEl).toBe("2026-08-02");
    expect(fila.fechaPago).not.toBe(fila.registradoEl);
  });

  it("un comprobante VIGENTE sale marcado como tal y sin datos de anulación", () => {
    const fila = filaDescargaPagoRegistrado(PAGO);
    expect(fila.estado).toBe("Vigente");
    expect(fila.anuladoPor).toBeNull();
    expect(fila.anuladoEl).toBeNull();
    expect(fila.motivoAnulacion).toBeNull();
  });

  it("R74: un comprobante ANULADO sale COMPLETO, marcado y con quién, cuándo y por qué", () => {
    const fila = filaDescargaPagoRegistrado(ANULADO);
    // Todos sus datos originales, intactos: anular no borra el pago, lo compensa.
    expect(fila.fechaPago).toBe("2026-07-30");
    expect(fila.monto).toBe("98765432109.87");
    expect(fila.metodo).toBe("SINPE");
    expect(fila.referencia).toBe("SINPE-88112233");
    expect(fila.nota).toBe("Liquidación de julio");
    expect(fila.registradoPor).toBe("Ana Maestra");
    expect(fila.registradoEl).toBe("2026-08-02");
    // …más la anulación.
    expect(fila.estado).toBe("Anulado");
    expect(fila.anuladoPor).toBe("Beto Admin");
    expect(fila.anuladoEl).toBe("2026-08-03");
    expect(fila.motivoAnulacion).toBe("Se tecleó el monto de otra tienda");
  });

  it("R74: el estado distingue de verdad los dos casos (no es una etiqueta fija)", () => {
    expect(filaDescargaPagoRegistrado(PAGO).estado).not.toBe(
      filaDescargaPagoRegistrado(ANULADO).estado,
    );
  });

  it("los campos opcionales ausentes van como celda VACÍA, no como un guion", () => {
    // El «—» es presentación: en una hoja de cálculo se leería como un dato.
    const fila = filaDescargaPagoRegistrado({ ...PAGO, referencia: null, nota: null });
    expect(fila.referencia).toBeNull();
    expect(fila.nota).toBeNull();
    expect(fila.referencia).not.toBe("—");
  });

  it("emite valores CRUDOS: texto o celda vacía, nunca objetos", () => {
    for (const [clave, celda] of Object.entries(filaDescargaPagoRegistrado(ANULADO))) {
      const tipo = celda === null ? "null" : typeof celda;
      expect(["string", "number", "null"], `columna ${clave}`).toContain(tipo);
    }
  });

  it("R56: no expone NINGÚN identificador interno — empezando por el `id` del pago", () => {
    for (const pago of [PAGO, ANULADO]) {
      const fila = filaDescargaPagoRegistrado(pago);
      expect(fila).not.toHaveProperty("id");
      expect(fila).not.toHaveProperty("pagoId");
      for (const celda of Object.values(fila)) {
        if (typeof celda === "string") {
          expect(celda).not.toMatch(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
          );
          expect(celda).not.toContain(pago.id);
        }
      }
    }
  });

  it("R56: quien registró y quien anuló salen por NOMBRE, que es lo único que trae el DTO", () => {
    // El DTO no emite `registradoPor` ni `anuladoPor` como id (T C.1), así que el archivo no
    // puede filtrarlos ni queriendo. Este test fija que las columnas leen el nombre.
    const fila = filaDescargaPagoRegistrado(ANULADO);
    expect(fila.registradoPor).toBe(ANULADO.registradoPorNombre);
    expect(fila.anuladoPor).toBe(ANULADO.anulacion?.anuladoPorNombre);
  });

  it("el módulo exporta SOLO las columnas y la proyección (la guardia ejecuta todo lo demás)", () => {
    // La guardia de datos sensibles invoca con una sonda TODA función exportada por un
    // `*-descarga-columnas.ts`. Un tercer export que no fuera una proyección la rompería, y
    // el fallo se leería como un falso positivo de datos sensibles.
    expect(Object.keys(modulo).sort()).toEqual([
      "COLUMNAS_DESCARGA_PAGOS_REGISTRADOS",
      "filaDescargaPagoRegistrado",
    ]);
  });

  it("money-safe (R14): el CÓDIGO del módulo no convierte ni redondea ningún monto", () => {
    // Se barre el código SIN comentarios: los docstrings de este árbol nombran a propósito
    // lo que está prohibido («sin parseFloat/Number»), y un barrido sobre el texto crudo
    // fallaría por citarlo. Lo que se persigue es la LLAMADA, no la palabra.
    const codigo = codigoSinComentarios(RUTA_MODULO);
    for (const prohibida of LLAMADAS_PROHIBIDAS_EN_DINERO) {
      expect(codigo, `el módulo llama a ${prohibida}`).not.toMatch(prohibida);
    }
  });

  it("contraprueba del barrido: sí detecta una llamada real, y no la mención en un comentario", () => {
    // Sin esto, «el barrido pasa» no diría nada: podría estar pasando porque no mira.
    expect(quitarComentarios("const x = Number(pago.monto);")).toMatch(/\bNumber\s*\(/);
    expect(quitarComentarios("// nunca Number( aqui\nconst x = pago.monto;")).not.toMatch(
      /\bNumber\s*\(/,
    );
  });
});

// Ficha 501. Los esperados son LITERALES: compararlos contra `fechaCalendarioCR` sería comparar la
// función consigo misma. Y las horas caen a propósito en 00:00-05:59 UTC: entre las 09:00 y las
// 18:00 UTC de los fixtures de arriba, el día UTC y el de Costa Rica coinciden y el defecto no se ve.
describe("ficha 501 — «Registrado el» y «Anulado el» salen en día de Costa Rica", () => {
  const anuladoEn = (anuladoAt: string): PagoRegistradoDTO => ({
    ...PAGO,
    anulacion: { motivo: "Duplicado", anuladoPorNombre: "Beto Admin", anuladoAt },
  });

  it("R3: un registro de las 20:30 de Costa Rica sale con SU día, no con el siguiente", () => {
    const fila = filaDescargaPagoRegistrado({ ...PAGO, registradoAt: "2026-08-03T02:30:00.000Z" });
    expect(fila.registradoEl).toBe("2026-08-02");
  });

  it("R4: una anulación de las 20:30 de Costa Rica sale con SU día, no con el siguiente", () => {
    const fila = filaDescargaPagoRegistrado(anuladoEn("2026-08-04T02:30:00.000Z"));
    expect(fila.anuladoEl).toBe("2026-08-03");
  });

  it.each([
    ["2026-08-03T00:00:00.000Z", "2026-08-02"],
    ["2026-08-03T05:59:59.999Z", "2026-08-02"],
    ["2026-08-03T06:00:00.000Z", "2026-08-03"],
    ["2026-09-01T00:00:00.000Z", "2026-08-31"],
    ["2027-01-01T05:00:00.000Z", "2026-12-31"],
  ])("R5: el instante %s sale como %s, en registro y en anulación", (instante, esperado) => {
    expect(filaDescargaPagoRegistrado({ ...PAGO, registradoAt: instante }).registradoEl).toBe(
      esperado,
    );
    expect(filaDescargaPagoRegistrado(anuladoEn(instante)).anuladoEl).toBe(esperado);
  });

  it("R6: «Fecha del pago» es un día calendario y no recibe el desfase, ni en la frontera", () => {
    const fila = filaDescargaPagoRegistrado({
      ...anuladoEn("2026-08-04T00:00:00.000Z"),
      registradoAt: "2026-08-03T00:00:00.000Z",
    });
    expect(fila.fechaPago).toBe("2026-07-30");
  });

  it("R9: lo que no es un instante legible sale TAL CUAL, sin inventar fecha ni fallar", () => {
    const fila = filaDescargaPagoRegistrado({ ...anuladoEn("pendiente"), registradoAt: "pendiente" });
    expect(fila.registradoEl).toBe("pendiente");
    expect(fila.anuladoEl).toBe("pendiente");
  });
});
