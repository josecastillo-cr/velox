import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  LIQUIDEZ_POR_CATEGORIA,
  NATURALEZA_POR_CATEGORIA,
  derivarCaja,
  derivarComposicionGanancia,
  type NaturalezaMovimiento,
} from "@/lib/utils/caja-tesoreria";
import { derivarBalance } from "@/lib/utils/wallet-balance";
import {
  WALLET_MOVIMIENTO_CATEGORIA_SEED,
  type AgregadoCajaRow,
  type WalletMovimientoCategoria,
  type WalletMovimientoTipo,
} from "@/lib/types/wallet";
import { codigoSinComentarios, LLAMADAS_PROHIBIDAS_EN_DINERO } from "../../fixtures/money-safe";

/**
 * Feature 173 (T A.4) — la derivacion PURA de las dos cifras de la caja.
 * Cubre R1, R2, R3, R4, R5, R6, R7 y R10.
 *
 * Lo que se juega aqui: que ninguna categoria caiga en la naturaleza equivocada por descuido.
 * Una sola mal clasificada no da un error —da una cifra de utilidad que sube cuando alguien
 * corrige un error administrativo—, asi que la clasificacion se comprueba tres veces: por
 * tipos (el `Record` total), recorriendo el SEED en RUNTIME (no basta el typecheck: nadie
 * garantiza que `tsc` corra antes del deploy) y por su EFECTO sobre las dos cifras.
 */

const FUENTE = "lib/utils/caja-tesoreria.ts";

/** El `tipo` con el que la base admite cada categoria (la disyuncion de design §2.2). */
function tipoDe(categoria: WalletMovimientoCategoria): WalletMovimientoTipo {
  return categoria.startsWith("ingreso_") ? "ingreso" : "egreso";
}

function fila(categoria: WalletMovimientoCategoria, total: string): AgregadoCajaRow {
  return { categoria, tipo: tipoDe(categoria), total };
}

describe("NATURALEZA_POR_CATEGORIA — clasificacion exhaustiva (R2/R3)", () => {
  it("R2/R3: TODA categoria del catalogo tiene naturaleza declarada, y el mapa no tiene ninguna de mas", () => {
    // El `Record<WalletMovimientoCategoria, …>` ya rompe el typecheck si el enum gana un valor
    // sin clasificar (R3). Esto lo comprueba tambien en RUNTIME, recorriendo el SEED, y cierra
    // ademas la direccion contraria: una clave en el mapa que ya no exista en el catalogo.
    for (const categoria of WALLET_MOVIMIENTO_CATEGORIA_SEED) {
      expect(NATURALEZA_POR_CATEGORIA[categoria], `categoria ${categoria}`).toBeDefined();
      // Ficha 488: + `iva`, el cuarto dueño.
      expect(["propio", "terceros", "capital", "iva"]).toContain(NATURALEZA_POR_CATEGORIA[categoria]);
    }
    expect(Object.keys(NATURALEZA_POR_CATEGORIA).sort()).toEqual(
      [...WALLET_MOVIMIENTO_CATEGORIA_SEED].sort(),
    );
  });

  it("R2: cada categoria cae en EXACTAMENTE una naturaleza (el mapa es una funcion, no una lista)", () => {
    for (const categoria of WALLET_MOVIMIENTO_CATEGORIA_SEED) {
      const naturaleza: NaturalezaMovimiento = NATURALEZA_POR_CATEGORIA[categoria];
      expect(typeof naturaleza).toBe("string");
      expect(["propio", "terceros", "capital", "iva"]).toContain(naturaleza); // ficha 459: tres; 488: cuatro
    }
  });

  it("R2 (design §2.1): las TRES categorias de tesoreria son de TERCEROS, y ninguna otra lo es", () => {
    // Este es el assert que la mutacion obligatoria de T A.4/T H.3 pone rojo: mover
    // `ingreso_cod_recaudado` a «propio» falla aqui y en los cuatro tests de efecto de abajo.
    const terceros = WALLET_MOVIMIENTO_CATEGORIA_SEED.filter(
      (c) => NATURALEZA_POR_CATEGORIA[c] === "terceros",
    );
    // Ficha 459 (design §5): + el pago por cuenta de una tienda y su anulacion.
    // Ficha 457 (design §4, DH1): + el pago de una tienda a Ordenex y su anulacion.
    expect([...terceros].sort()).toEqual([
      "egreso_pago_por_cuenta_tienda",
      "egreso_pago_tienda",
      "egreso_reverso_abono_tienda",
      "ingreso_abono_tienda",
      "ingreso_cod_recaudado",
      "ingreso_reverso_pago_por_cuenta_tienda",
      "ingreso_reverso_pago_tienda",
    ]);
  });

  it("R2/[P2]: `egreso_pago_mensajero` sigue siendo PROPIO (design §3.4, decision del humano)", () => {
    // La caja queda mixta a proposito: tesoreria para el COD y las tiendas, devengo para los
    // mensajeros. Si alguien lo moviera a «terceros» sin rehacer §3.4, la ganancia dejaria de
    // restar el costo del reparto y subiria sola.
    expect(NATURALEZA_POR_CATEGORIA.egreso_pago_mensajero).toBe("propio");
  });

  it("R26 (design §10-C): `ingreso_ajuste` es PROPIO, y por eso NO puede servir de reverso", () => {
    expect(NATURALEZA_POR_CATEGORIA.ingreso_ajuste).toBe("propio");
    expect(NATURALEZA_POR_CATEGORIA.ingreso_reverso_pago_tienda).toBe("terceros");
    // La trampa que la feature evita: si el reverso se emitiera como `ingreso_ajuste`, anular
    // un pago a una tienda SUBIRIA la ganancia de Ordenex por el monto anulado.
    const conReversoCorrecto = derivarCaja([fila("ingreso_reverso_pago_tienda", "4000.00")]);
    const conAjuste = derivarCaja([fila("ingreso_ajuste", "4000.00")]);
    expect(conReversoCorrecto.ganancia).toBe("0.00");
    expect(conAjuste.ganancia).toBe("4000.00");
  });
});

describe("derivarCaja — las dos cifras (R1/R4/R5)", () => {
  it("R4: `enCaja` = entradas − salidas, con TODAS las naturalezas dentro", () => {
    const r = derivarCaja([
      fila("ingreso_cod_recaudado", "10000.00"), // terceros
      fila("ingreso_flete", "1000.00"), // propio
      fila("egreso_pago_tienda", "6000.00"), // terceros
      fila("egreso_sueldo", "500.00"), // propio
    ]);

    // Ficha 459 (R2, reescrito): el flete es un CARGO a la tienda, no dinero que entra aparte del
    // contra-entrega (F2). «Entro» = solo el contra-entrega.
    expect(r.entradas).toBe("10000.00"); // 10000 (el flete de 1000 no es efectivo)
    expect(r.salidas).toBe("6500.00"); // 6000 + 500
    expect(r.enCaja).toBe("3500.00");
    expect(r.signoEnCaja).toBe("positivo");
  });

  it("R5: `ganancia` = ingresos propios − egresos propios, sobre el MISMO conjunto", () => {
    const r = derivarCaja([
      fila("ingreso_cod_recaudado", "10000.00"),
      fila("ingreso_flete", "1000.00"),
      fila("egreso_pago_tienda", "6000.00"),
      fila("egreso_sueldo", "500.00"),
    ]);

    expect(r.ingresosPropios).toBe("1000.00"); // el COD NO cuenta
    expect(r.egresosPropios).toBe("500.00"); // el pago a la tienda TAMPOCO
    expect(r.ganancia).toBe("500.00");
    expect(r.signoGanancia).toBe("positivo");
  });

  it("R1: sobre un conjunto CON dinero de terceros, las dos cifras son DISTINTAS", () => {
    const r = derivarCaja([
      fila("ingreso_cod_recaudado", "10000.00"),
      fila("ingreso_flete", "1000.00"),
      fila("egreso_pago_tienda", "6000.00"),
      fila("egreso_sueldo", "500.00"),
    ]);

    expect(r.enCaja).not.toBe(r.ganancia);
    expect(r.enCaja).toBe("3500.00");
    expect(r.ganancia).toBe("500.00");
    // Y la diferencia entre ambas es, exactamente, lo que se les debe a las tiendas.
    // Ficha 459 (R5, reescrito): 10000 cobrado − 6000 ya entregado − 1000 de flete que Ordenex se
    // queda de ese contra-entrega = 3000.
    expect(r.deTerceros).toBe("3000.00");
    expect(new Prisma.Decimal(r.ganancia).add(r.deTerceros).toFixed(2)).toBe(r.enCaja);
  });

  it("R2/R5: el contra-entrega ENTRA en la caja y NO roza la ganancia", () => {
    // Efecto medible de la clasificacion: la MISMA base, con y sin el COD.
    const sinCod = derivarCaja([fila("ingreso_flete", "1000.00"), fila("egreso_sueldo", "500.00")]);
    const conCod = derivarCaja([
      fila("ingreso_flete", "1000.00"),
      fila("egreso_sueldo", "500.00"),
      fila("ingreso_cod_recaudado", "10000.00"),
    ]);

    expect(conCod.ganancia).toBe(sinCod.ganancia); // <- mutacion obligatoria: rojo si es «propio»
    expect(conCod.ganancia).toBe("500.00");
    // Ficha 459 (R2, reescrito): el flete no entra aparte; la caja es el contra-entrega − el sueldo.
    expect(conCod.enCaja).toBe("9500.00");
    expect(sinCod.enCaja).toBe("-500.00");
  });

  it("R26/R30: pagar a la tienda y anular deja el dinero en caja igual y la ganancia intacta", () => {
    const antes = [fila("ingreso_cod_recaudado", "10000.00"), fila("ingreso_flete", "1000.00")];
    const trasPagar = [...antes, fila("egreso_pago_tienda", "6000.00")];
    const trasAnular = [...trasPagar, fila("ingreso_reverso_pago_tienda", "6000.00")];

    const a = derivarCaja(antes);
    const b = derivarCaja(trasPagar);
    const c = derivarCaja(trasAnular);

    // Ficha 459 (R2, reescrito): el flete de 1000 no es efectivo; la caja parte de 10000.
    expect(b.enCaja).toBe("4000.00");
    expect(c.enCaja).toBe(a.enCaja); // el dinero vuelve EXACTAMENTE al importe previo
    expect(c.enCaja).toBe("10000.00");
    // Y la ganancia es identica en los TRES momentos: anular no es ingresar.
    expect(a.ganancia).toBe("1000.00");
    expect(b.ganancia).toBe("1000.00");
    expect(c.ganancia).toBe("1000.00");
  });

  it("R4/R5: signos NEGATIVO y CERO, en las dos cifras", () => {
    const negativa = derivarCaja([
      fila("egreso_gasto_fijo", "300.00"),
      fila("ingreso_flete", "100.00"),
    ]);
    // Ficha 459 (reescrito): el flete (100) es un cargo a la tienda, no efectivo: la caja baja los
    // 300 del gasto fijo y «De las tiendas» baja 100 (la tienda debe ese flete).
    expect(negativa.enCaja).toBe("-300.00");
    expect(negativa.signoEnCaja).toBe("negativo");
    expect(negativa.deTerceros).toBe("-100.00");
    expect(negativa.ganancia).toBe("-200.00");
    expect(negativa.signoGanancia).toBe("negativo");

    const enCero = derivarCaja([
      fila("ingreso_cod_recaudado", "700.00"),
      fila("egreso_pago_tienda", "700.00"),
    ]);
    expect(enCero.enCaja).toBe("0.00");
    expect(enCero.signoEnCaja).toBe("cero");
    expect(enCero.ganancia).toBe("0.00");
    expect(enCero.signoGanancia).toBe("cero");
    // El dinero de terceros entro y salio entero: la tercera linea queda en cero.
    expect(enCero.deTerceros).toBe("0.00");
  });

  it("conjunto VACIO -> los importes en 0.00 y los dos signos en cero (no un hueco)", () => {
    expect(derivarCaja([])).toEqual({
      entradas: "0.00",
      salidas: "0.00",
      enCaja: "0.00",
      signoEnCaja: "cero",
      ingresosPropios: "0.00",
      egresosPropios: "0.00",
      ganancia: "0.00",
      signoGanancia: "cero",
      deTerceros: "0.00",
      periodoFiltrado: false,
      // Feature 231 (R18): sin nada que repartir la barra no admite dos segmentos y no se
      // enuncia porcentaje alguno. El caso vacio cae en la tercera fila de la tabla.
      porcentajeTiendas: "0.00",
      modoComposicion: "sin_reparto",
      // Ficha 459 (§2.6): capital en cero, «De Ordenex» en cero, estado «flujo» y, con el libro
      // vacio, sin dia de arranque.
      capital: "0.00",
      signoCapital: "cero",
      deOrdenex: "0.00",
      signoDeTerceros: "cero",
      deTercerosAbsoluto: "0.00",
      estado: "flujo",
      flujoDesde: null,
      // Ficha 488 (§5.1): sin IVA, los cuatro campos nuevos en cero y sin porcion.
      ivaCobrado: "0.00",
      ivaPorPagar: "0.00",
      signoIvaPorPagar: "cero",
      porcentajeIva: "0.00",
    });
  });

  it("acumula VARIAS filas del mismo tipo sin perder ninguna", () => {
    const r = derivarCaja([
      fila("ingreso_flete", "300.00"),
      fila("ingreso_comision_cod", "150.00"),
      fila("ingreso_iva_flete", "39.00"),
      fila("ingreso_cod_recaudado", "5000.00"),
      fila("egreso_pago_mensajero", "200.00"),
      fila("egreso_gasto_variable", "50.00"),
      fila("egreso_pago_tienda", "1000.00"),
    ]);

    // Ficha 459 (reescrito): los tres ingresos (489) son CARGOS a la tienda.
    // Ficha 488 (reescrito): el IVA (39) ya NO es ingreso propio: va al IVA por pagar. Antes de la
    // 488: ingresosPropios 489,00 y ganancia 239,00.
    expect(r.entradas).toBe("5000.00"); // solo el contra-entrega es efectivo
    expect(r.salidas).toBe("1250.00"); // 200 + 50 + 1000
    expect(r.ingresosPropios).toBe("450.00"); // 300 + 150 (el IVA de 39 no es de Ordenex)
    expect(r.egresosPropios).toBe("250.00"); // 200 + 50 (el pago a tienda es de terceros)
    expect(r.enCaja).toBe("3750.00"); // 5000 − 1250
    expect(r.ganancia).toBe("200.00");
    expect(r.ivaPorPagar).toBe("39.00");
    expect(r.deTerceros).toBe("3511.00"); // 5000 − 1000 − 489 (el IVA sigue siendo un cargo a la tienda)
  });

  it("459/R7: cifra principal = ganancia + «De las tiendas» + capital, al centimo", () => {
    const r = derivarCaja([
      fila("ingreso_flete", "300.00"),
      fila("ingreso_comision_cod", "150.37"),
      fila("ingreso_cod_recaudado", "5000.00"),
      fila("egreso_pago_tienda", "1000.00"),
      fila("egreso_sueldo", "20.11"),
    ]);
    // A mano: Entro 5000,00; Salio 1020,11; cifra 3979,89. Ganancia 450,37 − 20,11 = 430,26.
    // De las tiendas 5000 − 1000 − 450,37 = 3549,63. Capital 0. 430,26 + 3549,63 = 3979,89.
    expect(r.enCaja).toBe("3979.89");
    expect(r.ganancia).toBe("430.26");
    expect(r.deTerceros).toBe("3549.63");
    expect(r.capital).toBe("0.00");
    expect(r.deOrdenex).toBe("430.26");
  });
});

describe("derivarCaja — sin dinero de terceros, las dos cifras COINCIDEN (R6)", () => {
  // Es la retrocompatibilidad conceptual de la feature: hoy no existe ni una fila de terceros,
  // asi que el numero que el maestro lleva viendo desde la 42 no cambia de VALOR, cambia de
  // NOMBRE. La cifra que aparece de cero es la otra.
  //
  // Ficha 459 (reescrito): la coincidencia vale para lo propio que es EFECTIVO. Los seis cargos a
  // una tienda son propios pero no efectivo: suben la ganancia sin entrar a la caja (bajan «De las
  // tiendas»), asi que ya no pueden estar en este conjunto. Ver el caso nuevo de abajo.
  const SOLO_PROPIAS = WALLET_MOVIMIENTO_CATEGORIA_SEED.filter(
    (c) => NATURALEZA_POR_CATEGORIA[c] === "propio" && LIQUIDEZ_POR_CATEGORIA[c] === "efectivo",
  );

  it("R6: un conjunto con TODAS las categorias propias del catalogo da enCaja === ganancia", () => {
    const filas = SOLO_PROPIAS.map((c, i) => fila(c, `${(i + 1) * 100}.00`));
    const r = derivarCaja(filas);

    expect(r.enCaja).toBe(r.ganancia);
    expect(r.signoEnCaja).toBe(r.signoGanancia);
    expect(r.entradas).toBe(r.ingresosPropios);
    expect(r.salidas).toBe(r.egresosPropios);
    expect(r.deTerceros).toBe("0.00");
  });

  it("R6/R9: sobre un conjunto sin terceros, `ganancia` es lo que hoy devuelve `derivarBalance`", () => {
    const filas = SOLO_PROPIAS.map((c, i) => fila(c, `${(i + 1) * 100}.00`));
    const r = derivarCaja(filas);
    const balanceDeSiempre = derivarBalance(r.entradas, r.salidas);

    expect(r.ganancia).toBe(balanceDeSiempre.balance);
    expect(r.signoGanancia).toBe(balanceDeSiempre.signo);
    expect(r.enCaja).toBe(balanceDeSiempre.balance);
  });

  it("459/R4/R5: un CARGO a la tienda sube la ganancia y baja «De las tiendas»; la caja no se mueve", () => {
    const r = derivarCaja([fila("ingreso_flete", "1000.00")]);
    expect(r.enCaja).toBe("0.00");
    expect(r.entradas).toBe("0.00");
    expect(r.ganancia).toBe("1000.00");
    expect(r.deTerceros).toBe("-1000.00");
    expect(r.signoDeTerceros).toBe("negativo");
    expect(r.deTercerosAbsoluto).toBe("1000.00");
  });

  it("R6: basta UNA fila de terceros para que las dos cifras se separen", () => {
    // Ficha 459 (reescrito): con un ajuste (propio y EFECTIVO) en vez del flete, que es un cargo.
    const propias = [fila("ingreso_ajuste", "1000.00"), fila("egreso_sueldo", "400.00")];
    expect(derivarCaja(propias).enCaja).toBe(derivarCaja(propias).ganancia);

    const conUnaDeTerceros = [...propias, fila("ingreso_cod_recaudado", "0.01")];
    const r = derivarCaja(conUnaDeTerceros);
    expect(r.enCaja).not.toBe(r.ganancia);
    expect(r.enCaja).toBe("600.01");
    expect(r.ganancia).toBe("600.00");
  });
});

describe("derivarCaja — money-safe y frontera (R7/R10)", () => {
  it("R7: los nueve importes son STRING con DOS decimales, siempre", () => {
    const r = derivarCaja([
      fila("ingreso_cod_recaudado", "7"), // sin decimales en la entrada
      fila("ingreso_flete", "1.5"), // un solo decimal
      fila("egreso_pago_tienda", "2"),
    ]);

    for (const clave of [
      "entradas",
      "salidas",
      "enCaja",
      "ingresosPropios",
      "egresosPropios",
      "ganancia",
      "deTerceros",
    ] as const) {
      expect(typeof r[clave], clave).toBe("string");
      expect(r[clave], clave).toMatch(/^-?\d+\.\d{2}$/);
    }
    // Ficha 459 (reescrito): el flete (1,5) es un cargo — no entra, y baja «De las tiendas».
    expect(r.entradas).toBe("7.00");
    expect(r.enCaja).toBe("5.00");
    expect(r.ganancia).toBe("1.50");
    expect(r.deTerceros).toBe("3.50");
    for (const clave of ["capital", "deOrdenex", "deTercerosAbsoluto"] as const) {
      expect(r[clave], clave).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it("R7: el signo es EXPLICITO y solo puede ser uno de los tres valores", () => {
    const r = derivarCaja([fila("ingreso_flete", "1.00")]);
    expect(["positivo", "negativo", "cero"]).toContain(r.signoEnCaja);
    expect(["positivo", "negativo", "cero"]).toContain(r.signoGanancia);
  });

  it("R7: money-safe — 0.10 + 0.20 da 0.30 exacto, no 0.30000000000000004", () => {
    // Ficha 459 (reescrito): con dos ingresos EFECTIVO (el flete y la comision son cargos).
    const r = derivarCaja([
      fila("ingreso_ajuste", "0.10"),
      fila("ingreso_cod_recaudado", "0.20"),
      fila("egreso_sueldo", "0.30"),
    ]);
    expect(r.entradas).toBe("0.30");
    expect(r.enCaja).toBe("0.00");
    expect(r.signoEnCaja).toBe("cero");
  });

  it("R7: money-safe — un importe fuera del rango exacto de un double no pierde centavos", () => {
    const r = derivarCaja([fila("ingreso_cod_recaudado", "98765432109.87")]);
    expect(r.entradas).toBe("98765432109.87");
    expect(r.enCaja).toBe("98765432109.87");
    expect(r.ganancia).toBe("0.00");
  });

  it("R7: el modulo NO tiene ni una llamada capaz de convertir un monto a numero", () => {
    const fuente = codigoSinComentarios(FUENTE);
    for (const prohibida of LLAMADAS_PROHIBIDAS_EN_DINERO) {
      expect(fuente, `${FUENTE} llama a ${prohibida}`).not.toMatch(prohibida);
    }
  });

  it("R10: es PURA — la firma solo admite las filas ya agregadas, ni repositorio ni cliente", () => {
    // Un solo parametro OBLIGATORIO (las opciones de presentacion tienen default), salida
    // sincrona: no hay por donde colarle una base de datos.
    expect(derivarCaja.length).toBe(1);
    expect(derivarCaja([]) instanceof Promise).toBe(false);

    const fuente = codigoSinComentarios(FUENTE);
    for (const prohibido of [
      "PrismaClient",
      "Repository",
      "prisma.",
      "findMany",
      "groupBy",
      "await ",
      "async ",
    ]) {
      expect(fuente, `${FUENTE} nombra ${prohibido}`).not.toContain(prohibido);
    }
  });

  it("R10: no muta la entrada ni depende del orden de las filas", () => {
    const filas: AgregadoCajaRow[] = [
      fila("ingreso_cod_recaudado", "10000.00"),
      fila("egreso_pago_tienda", "6000.00"),
      fila("ingreso_flete", "1000.00"),
    ];
    const copia = structuredClone(filas);

    const enOrden = derivarCaja(filas);
    const alReves = derivarCaja([...filas].reverse());

    expect(filas).toEqual(copia);
    expect(alReves).toEqual(enOrden);
  });

  it("[P7]: `periodoFiltrado` es false por defecto y no toca ningun numero", () => {
    const filas = [fila("ingreso_cod_recaudado", "10000.00"), fila("egreso_pago_tienda", "6000.00")];
    const sinFiltros = derivarCaja(filas);
    const conFiltros = derivarCaja(filas, { periodoFiltrado: true });

    expect(sinFiltros.periodoFiltrado).toBe(false);
    expect(conFiltros.periodoFiltrado).toBe(true);
    // El rotulo cambia; el numero NO.
    expect({ ...conFiltros, periodoFiltrado: false }).toEqual(sinFiltros);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// FICHA 488 (T B.4) — la ganancia SIN IVA, el IVA cobrado, el IVA por pagar y la barra con tres
// bolsillos. Literales A MANO en los comentarios (nunca con la funcion probada).
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** a + b + … en STRING/Decimal (nunca `number`). */
function suma(...importes: string[]): string {
  return importes.reduce((acc, x) => acc.add(new Prisma.Decimal(x)), new Prisma.Decimal(0)).toFixed(2);
}

/** b − a, en STRING/Decimal. */
function menosStr(b: string, a: string): string {
  return new Prisma.Decimal(b).sub(new Prisma.Decimal(a)).toFixed(2);
}

describe("ficha 488 — la clasificacion del IVA (R1)", () => {
  it("R1: los SEIS movimientos de IVA son de dueño `iva`, y ninguno mas", () => {
    // Mutacion m1 (design §13): devolver `ingreso_iva_flete` a «propio» pone rojo este caso.
    const iva = WALLET_MOVIMIENTO_CATEGORIA_SEED.filter((c) => NATURALEZA_POR_CATEGORIA[c] === "iva");
    expect([...iva].sort()).toEqual([
      "egreso_pago_iva",
      "egreso_reverso_iva_flete_devolucion",
      "ingreso_iva_comision_cod",
      "ingreso_iva_flete",
      "ingreso_iva_flete_devolucion",
      "ingreso_reverso_pago_iva",
    ]);
  });

  it("R1/R22: el Pago de IVA y su anulacion son EFECTIVO; los tres IVA y su reverso siguen siendo cargo", () => {
    // Mutacion m4 (design §13): `egreso_pago_iva` como `cargo_a_tienda` pone rojo este caso y el R22 de abajo.
    expect(LIQUIDEZ_POR_CATEGORIA.egreso_pago_iva).toBe("efectivo");
    expect(LIQUIDEZ_POR_CATEGORIA.ingreso_reverso_pago_iva).toBe("efectivo");
    for (const c of [
      "ingreso_iva_flete",
      "ingreso_iva_flete_devolucion",
      "ingreso_iva_comision_cod",
      "egreso_reverso_iva_flete_devolucion",
    ] as const) {
      expect(LIQUIDEZ_POR_CATEGORIA[c], c).toBe("cargo_a_tienda");
    }
  });
});

describe("ficha 488 — derivarCaja con IVA (R2–R7, R10, R22, R34)", () => {
  it("R2/R3/R6: la ganancia, sus ingresos y «De Ordenex» NO llevan IVA; el IVA va a su bolsillo", () => {
    // Flete 1 000 + su IVA 130 ; comision 100 + su IVA 13. Todo cargo: la caja no se mueve.
    // ganancia = 1 000 + 100 = 1 100 ; IVA cobrado = IVA por pagar = 130 + 13 = 143
    // De las tiendas = −(1 000 + 130 + 100 + 13) = −1 243 ; cifra 0 = 1 100 − 1 243 + 0 + 143
    const r = derivarCaja([
      fila("ingreso_flete", "1000.00"),
      fila("ingreso_iva_flete", "130.00"),
      fila("ingreso_comision_cod", "100.00"),
      fila("ingreso_iva_comision_cod", "13.00"),
    ]);
    expect({
      ingresosPropios: r.ingresosPropios,
      egresosPropios: r.egresosPropios,
      ganancia: r.ganancia,
      deOrdenex: r.deOrdenex,
      ivaCobrado: r.ivaCobrado,
      ivaPorPagar: r.ivaPorPagar,
      signoIvaPorPagar: r.signoIvaPorPagar,
      deTerceros: r.deTerceros,
      enCaja: r.enCaja,
    }).toEqual({
      ingresosPropios: "1100.00",
      egresosPropios: "0.00",
      ganancia: "1100.00",
      deOrdenex: "1100.00",
      ivaCobrado: "143.00",
      ivaPorPagar: "143.00",
      signoIvaPorPagar: "positivo",
      deTerceros: "-1243.00",
      enCaja: "0.00",
    });
  });

  it("R4/R5: IVA cobrado neto de la anulacion del IVA de un cobro; los Pagos de IVA y su anulacion NO lo cambian", () => {
    // IVA cobrado = 130 + 19,50 + 6,50 − 19,50 (anulacion)                           = 136,50
    // IVA por pagar = (130 + 19,50 + 6,50 + 40 anulacion del pago) − (19,50 + 100 pago) = 76,50
    // Entro 40 (la anulacion del pago entra de verdad) ; Salio 100 ; cifra −60
    // De las tiendas = 19,50 (reverso de cargo) − 156 (cargos) = −136,50 ; ganancia 0
    // R7: 0 + (−136,50) + 0 + 76,50 = −60
    const r = derivarCaja([
      fila("ingreso_iva_flete", "130.00"),
      fila("ingreso_iva_flete_devolucion", "19.50"),
      fila("ingreso_iva_comision_cod", "6.50"),
      fila("egreso_reverso_iva_flete_devolucion", "19.50"),
      fila("egreso_pago_iva", "100.00"),
      fila("ingreso_reverso_pago_iva", "40.00"),
    ]);
    expect({
      ivaCobrado: r.ivaCobrado,
      ivaPorPagar: r.ivaPorPagar,
      ganancia: r.ganancia,
      entradas: r.entradas,
      salidas: r.salidas,
      enCaja: r.enCaja,
      deTerceros: r.deTerceros,
      capital: r.capital,
    }).toEqual({
      ivaCobrado: "136.50",
      ivaPorPagar: "76.50",
      ganancia: "0.00",
      entradas: "40.00",
      salidas: "100.00",
      enCaja: "-60.00",
      deTerceros: "-136.50",
      capital: "0.00",
    });
  });

  it("R10: anular un cobro por devolucion a origen baja la ganancia en el FLETE y el IVA por pagar en el IVA", () => {
    const cobro = [fila("ingreso_flete_devolucion", "1000.00"), fila("ingreso_iva_flete_devolucion", "130.00")];
    const antes = derivarCaja(cobro);
    const despues = derivarCaja([
      ...cobro,
      fila("egreso_reverso_flete_devolucion", "1000.00"),
      fila("egreso_reverso_iva_flete_devolucion", "130.00"),
    ]);
    expect({ ganancia: antes.ganancia, ivaPorPagar: antes.ivaPorPagar, ivaCobrado: antes.ivaCobrado }).toEqual({
      ganancia: "1000.00",
      ivaPorPagar: "130.00",
      ivaCobrado: "130.00",
    });
    expect({ ganancia: despues.ganancia, ivaPorPagar: despues.ivaPorPagar, ivaCobrado: despues.ivaCobrado }).toEqual({
      ganancia: "0.00",
      ivaPorPagar: "0.00",
      ivaCobrado: "0.00",
    });
    // La cifra principal no se mueve con ninguno de los dos (son cargo y reverso de cargo).
    expect(despues.enCaja).toBe(antes.enCaja);
  });

  it("R22: un Pago de IVA M sube «Salio» M, baja la cifra M y el IVA por pagar M; ganancia, tiendas y capital igual", () => {
    const base = [
      fila("ingreso_cod_recaudado", "5000.00"),
      fila("ingreso_flete", "1000.00"),
      fila("ingreso_iva_flete", "130.00"),
    ];
    const a = derivarCaja(base);
    const b = derivarCaja([...base, fila("egreso_pago_iva", "100.00")]);
    expect({
      salidas: menosStr(b.salidas, a.salidas),
      enCaja: menosStr(b.enCaja, a.enCaja),
      ivaPorPagar: menosStr(b.ivaPorPagar, a.ivaPorPagar),
      ivaCobrado: menosStr(b.ivaCobrado, a.ivaCobrado),
      ganancia: menosStr(b.ganancia, a.ganancia),
      deTerceros: menosStr(b.deTerceros, a.deTerceros),
      capital: menosStr(b.capital, a.capital),
    }).toEqual({
      salidas: "100.00",
      enCaja: "-100.00",
      ivaPorPagar: "-100.00",
      ivaCobrado: "0.00",
      ganancia: "0.00",
      deTerceros: "0.00",
      capital: "0.00",
    });
  });

  it("R4 (P3): un Pago de IVA mayor que el IVA por pagar lo deja NEGATIVO, con su signo", () => {
    const r = derivarCaja([fila("ingreso_iva_flete", "130.00"), fila("egreso_pago_iva", "200.00")]);
    expect(r.ivaPorPagar).toBe("-70.00");
    expect(r.signoIvaPorPagar).toBe("negativo");
  });

  it("R7: cifra principal = «De Ordenex» + «De las tiendas» + IVA por pagar, al centimo, con TODO el catalogo", () => {
    // Cada categoria con un importe distinto (y con centimos): la identidad no puede cuadrar por azar.
    const filas = WALLET_MOVIMIENTO_CATEGORIA_SEED.map((c, i) =>
      fila(c, `${(i + 1) * 37}.${String((i * 7) % 100).padStart(2, "0")}`),
    );
    for (const conjunto of [filas, filas.slice(0, 11), filas.slice(9), filas.filter((_, i) => i % 3 === 0)]) {
      const r = derivarCaja(conjunto);
      expect(suma(r.deOrdenex, r.deTerceros, r.ivaPorPagar)).toBe(r.enCaja);
      // y «De Ordenex» sigue siendo ganancia + capital.
      expect(suma(r.ganancia, r.capital)).toBe(r.deOrdenex);
    }
  });

  it("R34: los campos nuevos son STRING; los importes, con DOS decimales", () => {
    const r = derivarCaja([fila("ingreso_iva_flete", "1.5"), fila("ingreso_cod_recaudado", "7")]);
    for (const clave of ["ivaCobrado", "ivaPorPagar", "porcentajeIva"] as const) {
      expect(typeof r[clave], clave).toBe("string");
      expect(r[clave], clave).toMatch(/^-?\d+\.\d{2}$/);
    }
    expect(["positivo", "negativo", "cero"]).toContain(r.signoIvaPorPagar);
  });

  it("design §2.2: el modulo NO resta por su cuenta (ni un `.sub(`): todas las restas son de `derivarBalance`", () => {
    expect(codigoSinComentarios(FUENTE)).not.toContain(".sub(");
  });
});

describe("ficha 488 — la barra con tres bolsillos (R14/R16, design §2.3)", () => {
  // Cada caso: (filas, modo, porcentajeTiendas, porcentajeIva). A mano: S = suma de los bolsillos
  // POSITIVOS entre O («De Ordenex»), T («De las tiendas») e I (IVA por pagar).
  const IVA_100 = fila("ingreso_reverso_pago_iva", "100.00"); // I = +100, efectivo
  const IVA_MENOS_50 = fila("egreso_pago_iva", "50.00"); // I = −50
  const O600_T300 = [fila("ingreso_ajuste", "600.00"), fila("ingreso_cod_recaudado", "300.00")];
  const OM200_T300 = [fila("egreso_sueldo", "200.00"), fila("ingreso_cod_recaudado", "300.00")];
  const O500_TM500 = [fila("ingreso_flete", "500.00")];
  const OM100_T0 = [fila("egreso_sueldo", "100.00")];
  const casos: { nombre: string; filas: AgregadoCajaRow[]; modo: string; tiendas: string; iva: string }[] = [
    // O = 600, T = 300. Con I = 100: S = 1 000 → 30,00 / 10,00. Sin IVA: 300 / 900 = 33,33 (lo de antes).
    { nombre: "dos_bolsillos con I > 0", filas: [...O600_T300, IVA_100], modo: "dos_bolsillos", tiendas: "30.00", iva: "10.00" },
    { nombre: "dos_bolsillos con I = 0", filas: O600_T300, modo: "dos_bolsillos", tiendas: "33.33", iva: "0.00" },
    { nombre: "dos_bolsillos con I < 0", filas: [...O600_T300, IVA_MENOS_50], modo: "dos_bolsillos", tiendas: "33.33", iva: "0.00" },
    // O = −200, T = 300. Con I = 100: S = 400 → 75,00 / 25,00 (la cifra es 200: la mutacion m5 daria
    // 50,00). Sin IVA: 100,00, lo de antes.
    { nombre: "solo_tiendas con I > 0", filas: [...OM200_T300, IVA_100], modo: "solo_tiendas", tiendas: "75.00", iva: "25.00" },
    { nombre: "solo_tiendas con I = 0", filas: OM200_T300, modo: "solo_tiendas", tiendas: "100.00", iva: "0.00" },
    { nombre: "solo_tiendas con I < 0", filas: [...OM200_T300, IVA_MENOS_50], modo: "solo_tiendas", tiendas: "100.00", iva: "0.00" },
    // O = 500, T = −500 (un flete sin contra-entrega). Con I = 100: S = 600 → 0,00 / 16,67.
    { nombre: "solo_ordenex con I > 0", filas: [...O500_TM500, IVA_100], modo: "solo_ordenex", tiendas: "0.00", iva: "16.67" },
    { nombre: "solo_ordenex con I = 0", filas: O500_TM500, modo: "solo_ordenex", tiendas: "0.00", iva: "0.00" },
    { nombre: "solo_ordenex con I < 0", filas: [...O500_TM500, IVA_MENOS_50], modo: "solo_ordenex", tiendas: "0.00", iva: "0.00" },
    // O = −100, T = 0. Con I = 100: S = 100 → la barra es TODA IVA (100,00). Sin IVA: nada.
    { nombre: "sin_reparto con I > 0", filas: [...OM100_T0, IVA_100], modo: "sin_reparto", tiendas: "0.00", iva: "100.00" },
    { nombre: "sin_reparto con I = 0", filas: OM100_T0, modo: "sin_reparto", tiendas: "0.00", iva: "0.00" },
    { nombre: "sin_reparto con I < 0", filas: [...OM100_T0, IVA_MENOS_50], modo: "sin_reparto", tiendas: "0.00", iva: "0.00" },
  ];

  for (const caso of casos) {
    it(`R14/R16: ${caso.nombre}`, () => {
      const r = derivarCaja(caso.filas);
      expect({ modo: r.modoComposicion, tiendas: r.porcentajeTiendas, iva: r.porcentajeIva }).toEqual({
        modo: caso.modo,
        tiendas: caso.tiendas,
        iva: caso.iva,
      });
    });
  }

  it("R16: con I <= 0 la porcion de las tiendas es la de ANTES de la 488 (T / (O + T)) para esos importes", () => {
    // O = 250, T = 750 → 75,00, con I = 0 y con I = −50 (el IVA negativo no abre porcion ni cambia S).
    const base = [fila("ingreso_ajuste", "250.00"), fila("ingreso_cod_recaudado", "750.00")];
    const sinIva = derivarCaja(base);
    const ivaNegativo = derivarCaja([...base, IVA_MENOS_50]);
    expect(sinIva.porcentajeTiendas).toBe("75.00");
    expect(ivaNegativo.porcentajeTiendas).toBe("75.00");
    expect(ivaNegativo.porcentajeIva).toBe("0.00");
  });
});

describe("ficha 488 (T B.5) — la composicion de la ganancia sin IVA (R19)", () => {
  it("R19: ninguna fila de IVA ni del reverso del IVA; los totales son los de la tarjeta (R3)", () => {
    // Con TODO el catalogo dentro: un IVA que se colara en la composicion apareceria como clave o
    // descuadraria el total contra `ingresosPropios`.
    const filas = WALLET_MOVIMIENTO_CATEGORIA_SEED.map((c, i) => fila(c, `${(i + 1) * 10}.00`));
    const c = derivarComposicionGanancia(filas);
    const r = derivarCaja(filas);
    const claves = [...Object.keys(c.ingresos), ...Object.keys(c.egresos)];
    for (const iva of [
      "ingreso_iva_flete",
      "ingreso_iva_flete_devolucion",
      "ingreso_iva_comision_cod",
      "egreso_reverso_iva_flete_devolucion",
      "egreso_pago_iva",
      "ingreso_reverso_pago_iva",
    ]) {
      expect(claves, iva).not.toContain(iva);
    }
    expect(c.totalIngresos).toBe(r.ingresosPropios);
    expect(c.totalEgresos).toBe(r.egresosPropios);
    // Y el Pago de IVA no cae en «Otros gastos de Ordenex»: no es un egreso de Ordenex.
    const soloPago = derivarComposicionGanancia([fila("egreso_pago_iva", "500.00")]);
    expect(soloPago.otrosEgresos).toBe("0.00");
    expect(soloPago.totalEgresos).toBe("0.00");
    expect(soloPago.hayOtrosEgresos).toBe(false);
  });
});
