import { randomUUID } from "node:crypto";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { PlantillaMensajeRepository } from "@/lib/repositories/PlantillaMensajeRepository";
import { WhatsappEjecucionRepository } from "@/lib/repositories/WhatsappEjecucionRepository";
import { WhatsappEnvioRepository } from "@/lib/repositories/WhatsappEnvioRepository";
import { EjecucionEnvioService, type MetaEnvios } from "@/lib/services/EjecucionEnvioService";
import { informePruebaEnvio } from "@/lib/whatsapp-envios/informes/prueba-envio";
import type { InformeWhatsapp } from "@/lib/whatsapp-envios/informes/tipos";
import {
  HAY_BASE_DE_DATOS,
  clienteConTransaccionAnidada,
  crearPrismaDeTest,
  enTransaccionRevertida,
  serializarEscriturasReales,
  type TxDeTest,
} from "./_postgres-real";
import { crearEnvio, crearPlantilla, crearUsuario, usuarioModelo } from "./_whatsapp-envios-474";

// FEATURE 494 (R25, y R26 se apoya en este) — CAMBIAR EL NOMBRE DE UNA PLANTILLA EN USO.
//
// Es lo que T9.3 hara en prod con plantillas de uso diario, con el mismo `UPDATE` de `design.md §8`:
// el envio enlaza por `plantilla_id`, la ejecucion guarda la foto del nombre, y Meta recibe el nombre
// vigente. Corre contra Postgres, con los repositorios reales de la plantilla, del envio y de la
// ejecucion. Solo el enviador de Meta y la cola son dobles. Todo dentro de una transaccion revertida.
//
//   pnpm exec vitest run tests/integration/db/plantilla-renombrada-envio-494.test.ts

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const informe = {
  ...(informePruebaEnvio as unknown as InformeWhatsapp<unknown>),
  aptoParaAdminTienda: true,
  parametros: z.unknown(),
  generar: async () => ({ tipo: "contenido" as const, valores: {} }),
} as InformeWhatsapp<unknown>;

/** Mismo `UPDATE` que el paso 4 de `design.md §8`. Devuelve las filas tocadas. */
const renombrar = (tx: TxDeTest, viejo: string, nuevo: string) =>
  tx.$executeRawUnsafe(
    `UPDATE plantilla_mensaje SET nombre = $1, template_id = 'tpl-494-nueva', updated_at = now()
      WHERE nombre = $2 AND deleted_at IS NULL`,
    nuevo,
    viejo,
  );

/** La fila entera del envio y sus destinatarios: `updated_at` incluido, para que nada se escape. */
const fotoDelEnvio = async (tx: TxDeTest, envioId: string) => ({
  envio: await tx.$queryRawUnsafe<unknown[]>(`SELECT to_jsonb(e)::text AS fila FROM "whatsapp_envio" e WHERE e."id" = $1`, envioId),
  destinatarios: await tx.$queryRawUnsafe<unknown[]>(
    `SELECT to_jsonb(d)::text AS fila FROM "whatsapp_envio_destinatario" d WHERE d."envio_id" = $1 ORDER BY d."id"`,
    envioId,
  ),
});

const fotoDeEjecucion = async (tx: TxDeTest, id: string) => {
  const filas = await tx.$queryRawUnsafe<{ plantilla_nombre: string | null; plantilla_id: string | null }[]>(
    `SELECT "plantilla_nombre", "plantilla_id" FROM "whatsapp_envio_ejecucion" WHERE "id" = $1`,
    id,
  );
  expect(filas).toHaveLength(1);
  return filas[0];
};

async function montar(tx: TxDeTest) {
  await serializarEscriturasReales(tx);
  const modelo = await usuarioModelo(tx);
  const usuario = await crearUsuario(tx, modelo, "admin", { nombre: "494 destinatario", telefono: "88881111" });
  const plantilla = await crearPlantilla(tx);
  const envioId = await crearEnvio(tx, { plantillaId: plantilla.id, activo: true, usuarioIds: [usuario.id] });
  const cliente = clienteConTransaccionAnidada(tx);
  const ejecuciones = new WhatsappEjecucionRepository(cliente);
  const enviarPlantilla = vi.fn(async (..._args: unknown[]) => ({ status: "ok" as const, mensajeId: `wamid.${randomUUID()}` }) as never);
  const meta: MetaEnvios = {
    enviador: { enviarPlantilla } as unknown as MetaEnvios["enviador"],
    subidor: { subir: vi.fn() } as unknown as MetaEnvios["subidor"],
    idioma: "es",
  };
  const servicio = new EjecucionEnvioService({
    envios: new WhatsappEnvioRepository(cliente),
    ejecuciones,
    plantillas: new PlantillaMensajeRepository(cliente),
    almacen: { guardar: vi.fn(), leer: vi.fn(), firmar: vi.fn(), borrar: vi.fn() } as never,
    cola: { enqueue: vi.fn(async () => null) } as never,
    meta: () => meta,
    informe: () => informe,
    logger: { warn: () => {} },
  });
  const programar = (fechaCr: string) =>
    ejecuciones.insertarProgramada({ envioId, fechaCr, instanteProgramado: new Date(`${fechaCr}T11:00:00Z`) });
  return { plantilla, envioId, ejecuciones, enviarPlantilla, servicio, programar, usuario };
}

describeSiHayBase("494/R25 — una plantilla en uso cambia de nombre", () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("el enviador recibe el nombre nuevo, el envio no cambia y la ejecucion anterior conserva su foto", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const { plantilla, envioId, enviarPlantilla, servicio, programar } = await montar(tx);
      const nuevo = `n494_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

      // Antes de la primera ejecucion: ni enviar ni renombrar pueden mover la configuracion del envio.
      const envioAntes = await fotoDelEnvio(tx, envioId);

      const anterior = await programar("2099-05-01");
      const resAnterior = await servicio.ejecutar(anterior.id);
      const fotoAnterior = await fotoDeEjecucion(tx, anterior.id);

      const tocadas = await renombrar(tx, plantilla.nombre, nuevo);

      const siguiente = await programar("2099-05-02");
      const resSiguiente = await servicio.ejecutar(siguiente.id);

      return {
        viejo: plantilla.nombre,
        nuevo,
        plantillaId: plantilla.id,
        tocadas,
        resAnterior: resAnterior.estado,
        resSiguiente: resSiguiente.estado,
        nombresEnviados: enviarPlantilla.mock.calls.map((c) => c[1]),
        fotoAnterior,
        fotoAnteriorTras: await fotoDeEjecucion(tx, anterior.id),
        fotoSiguiente: await fotoDeEjecucion(tx, siguiente.id),
        envioAntes,
        envioDespues: await fotoDelEnvio(tx, envioId),
      };
    });

    expect(r.tocadas).toBe(1);
    expect(r.resAnterior).toBe("completada");
    expect(r.resSiguiente).toBe("completada");
    // R26: mientras no cambia, se envia con el que hay; R25: al cambiar, con el nuevo. Exactamente uno de cada.
    expect(r.nombresEnviados).toEqual([r.viejo, r.nuevo]);
    expect(r.viejo).not.toBe(r.nuevo);
    // La foto de antes se queda, y la de despues toma el nombre vigente.
    expect(r.fotoAnterior).toEqual({ plantilla_nombre: r.viejo, plantilla_id: r.plantillaId });
    expect(r.fotoAnteriorTras).toEqual(r.fotoAnterior);
    expect(r.fotoSiguiente).toEqual({ plantilla_nombre: r.nuevo, plantilla_id: r.plantillaId });
    // La configuracion del envio, byte a byte, con al menos su fila y su destinatario.
    expect(r.envioAntes.envio).toHaveLength(1);
    expect(r.envioAntes.destinatarios).toHaveLength(1);
    expect(r.envioDespues).toEqual(r.envioAntes);
  });

  it("una entrega a medias de antes del cambio se reintenta con el nombre nuevo, y su foto no se mueve", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const { plantilla, envioId, ejecuciones, enviarPlantilla, servicio, programar } = await montar(tx);
      const nuevo = `n494_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

      const envioAntes = await fotoDelEnvio(tx, envioId);
      enviarPlantilla.mockResolvedValueOnce({ status: "transitorio", detalle: "503" } as never);
      const ejecucion = await programar("2099-05-03");
      await servicio.ejecutar(ejecucion.id);
      const pendientes = await ejecuciones.entregasPendientes(ejecucion.id);
      const fotoAntes = await fotoDeEjecucion(tx, ejecucion.id);

      const tocadas = await renombrar(tx, plantilla.nombre, nuevo);

      expect(pendientes).toHaveLength(1);
      await servicio.reintentar(pendientes[0].id, { intentos: 1, maxIntentos: 3 });

      const estado = await tx.$queryRawUnsafe<{ estado: string }[]>(
        `SELECT "estado"::text AS "estado" FROM "whatsapp_envio_entrega" WHERE "id" = $1`,
        pendientes[0].id,
      );
      return {
        viejo: plantilla.nombre,
        nuevo,
        tocadas,
        nombresEnviados: enviarPlantilla.mock.calls.map((c) => c[1]),
        fotoAntes,
        fotoDespues: await fotoDeEjecucion(tx, ejecucion.id),
        estado: estado.map((f) => f.estado),
        envioAntes,
        envioDespues: await fotoDelEnvio(tx, envioId),
      };
    });

    expect(r.tocadas).toBe(1);
    expect(r.nombresEnviados).toEqual([r.viejo, r.nuevo]);
    expect(r.estado).toEqual(["aceptada"]);
    expect(r.fotoAntes.plantilla_nombre).toBe(r.viejo);
    expect(r.fotoDespues).toEqual(r.fotoAntes);
    expect(r.envioDespues).toEqual(r.envioAntes);
  });
});
