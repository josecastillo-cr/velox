import { z } from "zod";

import { cierreBodegaConfig } from "@/lib/config/cierre-bodega";
import { montoPositivoSchema } from "@/lib/types/wallet";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 431 — LA CONCILIACION DE LAS CONSOLIDACIONES DE BODEGA: DTOs Y BORDE.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// MODULO PURO: no importa Prisma en runtime, ni React, ni `lib/services`. Lo consumen el borde
// (zod), el servicio, el repositorio y —cuando llegue— la pantalla.
//
// MONEY-SAFE, Y SIN EXCEPCIONES: todo importe cruza como STRING de escala 2 en las DOS
// direcciones. Ningun `number` de dinero, ningun `Prisma.Decimal` fuera del repositorio, y ninguna
// resta en la pantalla (R20): `saldoSinConciliar` y `faltaPorRecibir` llegan YA CUADRADOS.
//
// ⚠️ EL SALDO MIDE EFECTIVO, NO `total_general`. Es la decision del humano sobre Q2 (2026-09-16) y
// va CONTRA el diseño original, asi que se escribe donde vive el contrato. Medido en produccion el
// 2026-09-15 sobre las 32 consolidaciones existentes:
//
//     total_general        ₡ 4.196.897   100 %
//     total_efectivo       ₡ 3.091.107    73,7 %   <- lo que VIAJA en el bulto
//     total_simpe          ₡ 1.105.790    26,3 %   <- entra directo a una cuenta
//     total_transferencia  ₡         0     0 %
//
// Una cuarta parte del consolidado NO viaja en el bulto: el SINPE llega a una cuenta. Con el saldo
// derivado de `total_general`, la pantalla ensenaria ₡1,1 M de deuda fantasma que nadie va a
// entregar en mano jamas. `total_general` se sigue mostrando como CONTEXTO —es lo que la bodega
// recaudo— pero no es lo que esta pendiente de llegar.
//
// ⚠️ LIMITE DECLARADO, y NO lo resuelve esta ficha: cuando la 429 se despliegue y cada bodega ponga
// su propio SINPE, el SINPE que recaude una satelite dejara de llegar a la central —entrara a la
// cuenta de la bodega—. Eso crea un pendiente nuevo que este diseño no cubre, porque ni viaja en el
// bulto ni esta en `total_efectivo`. Si el negocio lo quiere conciliar tambien, es otra ficha.

/**
 * Una bodega satelite en la tabla de saldos (R17/R21/R23).
 *
 * `diasDeLaMasAntigua` es `null` cuando no queda ninguna consolidacion sin conciliar: `null` es
 * «no hay cola», que NO es lo mismo que `0` («la mas vieja es de hoy»). Confundirlos ensenaria
 * «0 dias» en una bodega que no debe nada.
 */
export interface SaldoSateliteDTO {
  zonaId: string;
  zonaNombre: string;
  /**
   * ⭑ FICHA 498 (R23) — LA DEUDA de la zona. Conserva el nombre de la 431 y cambia de significado:
   * Σ aportes de sus cierres aprobados (todos los metodos de pago, menos lo que es de la satelite)
   * + Σ aporte reconocido de sus consolidaciones saldadas con la regla anterior − Σ `monto_recibido`
   * de sus consolidaciones no rechazadas. Con signo. Ya NO es el efectivo.
   */
  saldoSinConciliar: string;
  /** FICHA 498 (R24/R42) — Σ aportes de sus cierres aprobados SIN consolidar (o de una rechazada). */
  sinConsolidar: string;
  /** FICHA 498 (R24) — cuantos cierres forman `sinConsolidar`. */
  cierresSinConsolidar: number;
  /** Σ `total_efectivo`: la base del saldo, para que la resta sea auditable desde la pantalla. */
  totalEfectivo: string;
  /** Σ `total_general`: CONTEXTO (lo que la bodega recaudo), NO lo pendiente. Ver la cabecera. */
  totalConsolidado: string;
  /** Σ `monto_recibido` (los NULL no suman, que es justo lo que la formula quiere). */
  totalRecibido: string;
  /** R21 — cuantas consolidaciones siguen sin conciliar. */
  consolidacionesSinConciliar: number;
  /** R21 — dias naturales (calendario CR) de la mas antigua sin conciliar. `null` si no hay. */
  diasDeLaMasAntigua: number | null;
  /** ISO del `solicitado_at` de esa mas antigua. `null` si no hay ninguna pendiente. */
  fechaDeLaMasAntigua: string | null;
  /**
   * ⭑ La ULTIMA consolidacion de esta bodega que se marco como recibida. `null` = a esta bodega
   * no se le ha marcado ninguna nunca.
   *
   * ⚠️ NO ES `totalRecibido`, Y LA DIFERENCIA IMPORTA. `totalRecibido` es la SUMA historica de
   * todo lo que esta bodega ha entregado; esto es UNA fila: la ultima vez que llego un bulto,
   * con lo que traia. La columna de la pantalla se llama «Ultima recibida» y pintar ahi el
   * acumulado seria poner un numero de seis cifras bajo un rotulo que promete otro — el defecto
   * exacto que la ficha 359 encontro repetido en 13 pantallas.
   *
   * Es CONTEXTO, no deuda: dice que esta bodega SI entrega, y cuando fue la ultima vez. Una que
   * lleva dos meses sin una fila aqui es una conversacion distinta de una que entrego ayer.
   */
  ultimaRecibida: UltimaRecibidaDTO | null;
}

/**
 * ⭑ FICHA 431 — la ULTIMA consolidacion recibida de una bodega, ya cuadrada por el servidor.
 *
 * Los tres importes son STRING de escala 2 y `faltaPorRecibir` llega DERIVADO (R20): la pantalla
 * no resta para saber si esa ultima llego incompleta, lo pregunta sobre el string que ya le dan.
 */
export interface UltimaRecibidaDTO {
  /** ISO de `conciliado_at`: CUANDO se marco que llego, no cuando se consolido. */
  fecha: string;
  /** `monto_recibido` de ESA consolidacion: lo que se conto al recibir el bulto. */
  monto: string;
  /**
   * FICHA 498: el APORTE RECONOCIDO de ESA consolidacion («Para la central», o el valor de la
   * regularizacion si esta saldada con la regla anterior). Ya no es el efectivo.
   */
  declarado: string;
  /**
   * R26 — `declarado` − `monto` de ESA fila, derivado en el servidor con `faltaPorRecibir`, la misma
   * funcion que la deuda. Distinto de cero = esa ultima llego incompleta. Puede ser NEGATIVO.
   */
  faltaPorRecibir: string;
}

/**
 * ⭑ FICHA 431 (pasada de frontend) — LAS TRES CIFRAS DE CABECERA de `/wallet/satelites`.
 *
 * ⚠️ POR QUE EXISTE ESTE DTO, y no se suman las filas en la pantalla: R20 prohibe que el
 * navegador haga aritmetica de dinero, y las tres tarjetas son SUMAS sobre el conjunto entero de
 * bodegas. Sumar cinco `saldoSinConciliar` en el cliente seria exactamente la operacion que la
 * ficha 359 encontro rota en 13 pantallas. Las tres llegan YA CUADRADAS, como todo lo demas.
 *
 * Cada tarjeta lleva su CONTEO al lado a proposito: un importe sin cuantas filas lo componen no
 * se puede perseguir, y perseguir efectivo es para lo que existe esta pantalla.
 */
export interface ResumenSatelitesDTO {
  /**
   * Tarjeta 1 — Σ de `saldoSinConciliar` (la deuda) de TODAS las bodegas satelite, con las MISMAS
   * agregaciones que las filas (FICHA 498, R25): la suma de la columna ES esta cifra. Puede ser
   * NEGATIVA.
   */
  pendienteTotal: string;
  /** Cuantas consolidaciones siguen SIN marcar (`conciliado_at IS NULL`). */
  consolidacionesSinConciliar: number;
  /** En cuantas bodegas distintas hay saldo pendiente (distinto de cero). */
  bodegasConPendiente: number;
  /**
   * Tarjeta 2 — «Recibido este mes»: Σ `monto_recibido` de lo marcado DENTRO del mes en curso
   * del calendario de COSTA RICA, no del mes UTC ni del del navegador.
   *
   * ⚠️ Se corta por `conciliado_at` —cuando se marco— y NO por `solicitado_at`: la pregunta que
   * responde es «cuanto efectivo entro a la central este mes», y una consolidacion de agosto que
   * llego en septiembre entro en septiembre.
   */
  recibidoEsteMes: string;
  /** Cuantas consolidaciones se marcaron este mes. */
  consolidacionesRecibidasEsteMes: number;
  /**
   * Tarjeta 3 — «Con diferencia»: Σ de lo que FALTA en las consolidaciones YA marcadas por menos
   * de lo declarado (R18). Solo cuenta el faltante POSITIVO: una que llego de mas no compensa a
   * otra que llego de menos, porque son dos bultos distintos y dos conversaciones distintas.
   */
  diferenciaTotal: string;
  /** Cuantas consolidaciones llegaron incompletas. */
  consolidacionesConDiferencia: number;
}

/**
 * Una consolidacion en el desglose de su bodega (R22/R24).
 *
 * `conciliado` es `conciliadoAt !== null` ya derivado: la pantalla NO decide el estado comparando
 * campos. El vocabulario aprobado lo pone la capa de presentacion (R28): sin conciliar →
 * «Pendiente de conciliar»; conciliada y sin diferencia → «Recibido»; conciliada con
 * `faltaPorRecibir` distinto de cero → «Recibido incompleto».
 */
export interface ConsolidacionSateliteDTO {
  cierreBodegaId: string;
  /** ISO. Es la fecha por la que se mide la antiguedad de R21. */
  solicitadoAt: string;
  /** R22 — la composicion del total, para que se vea que parte viaja en el bulto. */
  totales: {
    efectivo: string;
    simpe: string;
    transferencia: string;
    general: string;
  };
  /** `null` = sin conciliar. NUNCA `"0.00"` por ausencia: cero recibido es otra cosa. */
  montoRecibido: string | null;
  /**
   * FICHA 498 (R26) — `debe` − COALESCE(`monto_recibido`, 0), DERIVADO EN EL SERVIDOR con
   * `faltaPorRecibir`. Ya NO es el efectivo. Puede ser NEGATIVO (llego de mas): no se recorta.
   */
  faltaPorRecibir: string;
  /** FICHA 498 (R41) — snapshot: el pago a los mensajeros de la satelite. */
  totalPagoMensajero: string;
  /** FICHA 498 (R41) — snapshot: la ganancia de la satelite por rechazos. */
  totalIngresoBodegaRechazos: string;
  /** FICHA 498 (R41) — `paraLaCentral` de la consolidacion (general − pago − rechazos), con signo. */
  paraLaCentral: string;
  /**
   * FICHA 498 (R41/R41a) — lo que DEBE: el aporte reconocido. Igual a `paraLaCentral` salvo en una
   * saldada con la regla anterior, donde es el valor que fijo la regularizacion.
   */
  debe: string;
  /**
   * FICHA 498 (§8.4, R16) — `debe > 0`, decidido en el SERVIDOR. Si es `false`, el dialogo de marcar
   * propone 0 (el unico caso en que el recibido 0 se admite, Q5).
   */
  debePositivo: boolean;
  /** FICHA 498 (R41a) — saldada con la regla anterior (rotulo propio en la pantalla). */
  saldadaReglaAnterior: boolean;
  /**
   * ⭑ FICHA 500 (R3/R4) — ¿se ofrece «Desmarcar»? Conciliada, sin dinero (`consolidacionesConDinero`,
   * el criterio de `revertirConciliacion`) y no saldada con la regla anterior. Lo decide el SERVIDOR;
   * la pantalla no lo deriva de otros campos. No baja a la descarga.
   */
  puedeDesmarcar: boolean;
  /** Derivado de `conciliadoAt !== null`. */
  conciliado: boolean;
  conciliadoAt: string | null;
  conciliadoPorNombre: string | null;
  /** Texto libre corto. No baja a las descargas ni entra al historial (R5 de la 362). */
  nota: string | null;
  /** Cuantos `cierre_dia` componen esta consolidacion. */
  cantidadCierres: number;
}

// ── Schemas zod de borde ──

/**
 * R23 — la tabla de saldos. Sin filtros: el conjunto es «todas las bodegas satelite» y en
 * produccion son CINCO. `.strict()` mata cualquier clave colada.
 */
export const listarSaldosSatelitesSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .default(cierreBodegaConfig.DEFAULT_PAGE_SIZE)
      .transform((n) => Math.min(n, cierreBodegaConfig.MAX_PAGE_SIZE)),
  })
  .strict();

export type ListarSaldosSatelitesInput = z.infer<typeof listarSaldosSatelitesSchema>;

/**
 * R29 — el mismo conjunto SIN paginar, para la descarga. DERIVADO del de su pagina quitando
 * `page`/`pageSize`, no reescrito: dos declaraciones del mismo alcance divergen a la primera
 * correccion.
 */
export const listarSaldosSatelitesCompletoSchema = listarSaldosSatelitesSchema
  .omit({ page: true, pageSize: true })
  .strict();

export type ListarSaldosSatelitesCompletoInput = z.infer<
  typeof listarSaldosSatelitesCompletoSchema
>;

/** R24 — el desglose de UNA bodega. `zonaId` es obligatorio: sin el no hay desglose que pedir. */
export const listarConsolidacionesSateliteSchema = z
  .object({
    zonaId: z.string().uuid(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .default(cierreBodegaConfig.DEFAULT_PAGE_SIZE)
      .transform((n) => Math.min(n, cierreBodegaConfig.MAX_PAGE_SIZE)),
    /** Recorta a la cola de lo pendiente. Ausente = las dos poblaciones. */
    soloSinConciliar: z.coerce.boolean().optional(),
  })
  .strict();

export type ListarConsolidacionesSateliteInput = z.infer<
  typeof listarConsolidacionesSateliteSchema
>;

export const listarConsolidacionesSateliteCompletoSchema = listarConsolidacionesSateliteSchema
  .omit({ page: true, pageSize: true })
  .strict();

export type ListarConsolidacionesSateliteCompletoInput = z.infer<
  typeof listarConsolidacionesSateliteCompletoSchema
>;

/**
 * FICHA 498 (Q5, design §4.4 bis) — el CERO literal, y nada mas: `"0"`, `"0.0"` o `"0.00"`. Un
 * negativo, un vacio o tres decimales siguen muriendo en el borde (R15b).
 */
export const montoCeroSchema = z.string().regex(/^0(\.0{1,2})?$/, "Monto inválido");

/**
 * R9/R10 — MARCAR RECIBIDA (y CORREGIR: las dos acciones comparten este schema).
 *
 * ⭑ FICHA 498 (Q5, decision del humano del 2026-11-02): el humano admitio el recibido 0 SOLO en la
 * conciliacion y SOLO cuando la consolidacion no tiene nada que entregar (aporte reconocido ≤ 0).
 * Esa es una regla de DATO, no de formato: por eso el borde admite el cero literal (`montoCeroSchema`)
 * ademas de `montoPositivoSchema` —que NO se toca: lo comparten la liquidacion, los gastos fijos, los
 * efectos y los cierres admin, que no deben aceptar 0— y la decision la toma el repositorio con el
 * aporte leido en la misma transaccion (desenlace `recibido_cero_con_aporte`).
 *
 * La `nota` es opcional y se recorta: cero caracteres no es una nota, es ausencia.
 */
export const marcarConsolidacionRecibidaSchema = z
  .object({
    cierreBodegaId: z.string().uuid(),
    // STRING, > 0 con <= 2 decimales, o el cero literal (R10, R15a/R15b).
    montoRecibido: z.union([montoPositivoSchema, montoCeroSchema]),
    nota: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type MarcarConsolidacionRecibidaInput = z.infer<typeof marcarConsolidacionRecibidaSchema>;

/** R12 — REVERTIR. No lleva monto: el que hubiera se BORRA (y queda en el historial). */
export const revertirConciliacionSchema = z
  .object({
    cierreBodegaId: z.string().uuid(),
  })
  .strict();

export type RevertirConciliacionInputBorde = z.infer<typeof revertirConciliacionSchema>;
