import { pathToFileURL } from "node:url";
import { PrismaClient, RolValue, VehiculoValue } from "@prisma/client";
import { hashPassword } from "@/lib/utils/password";
import { getPrismaClient } from "@/lib/db/prisma-client";

// Siembra un usuario de prueba por rol (admin, mensajero, adminTienda,
// adminSatelite) para poder recorrer la operacion completa en local. El
// `maestro` NO se siembra aqui: tiene su propio bootstrap en
// `scripts/seed-maestro.ts` (`pnpm db:seed:maestro`), porque es la cuenta de
// privilegio total y merece credencial propia.
//
// Uso:
//   QA_PASSWORD='<minimo 12 caracteres>' pnpm exec tsx scripts/seed-usuarios-qa.ts
//
// La contrasena llega por entorno y nunca se versiona, por el mismo motivo que
// `seed-maestro.ts`: hasta la migracion `20260720150000_drop_default_maestro_user`
// el repo cargaba un hash bcrypt hardcodeado, es decir una credencial conocida
// por cualquiera con acceso al codigo. No repetimos eso ni para cuentas de QA.
//
// Es idempotente por email: si la cuenta ya existe, rota el hash y la reactiva
// sin tocar su `id` ni sus relaciones.
//
// FEATURE 494 (R29, R30, design §6): las cuentas cambiaron de dominio de correo. `email` y
// `cedula` son `@unique`, asi que cambiar solo el literal haria fallar la corrida siguiente
// contra una base ya sembrada: el upsert no veria la cuenta e intentaria crearla con la misma
// cedula. Por eso, antes del upsert, se pasa la cuenta al correo nuevo. Solo toca los cuatro
// correos de `PERFILES`: ninguna otra cuenta.

/** Longitud minima exigida a la contrasena de QA. */
export const QA_PASSWORD_MIN_LENGTH = 12;

interface Perfil {
  email: string;
  /** El correo con el que la sembraron antes (R29). */
  emailAnterior: string;
  nombre: string;
  primerApellido: string;
  telefono: string;
  cedula: string;
  rol: RolValue;
  zona?: string;
  vehiculo?: VehiculoValue;
  placa?: string;
  fulfillment?: boolean;
}

/** Lo que la siembra necesita del cliente: sirve el normal y el de una transaccion. */
type ClienteDeSiembra = Pick<
  PrismaClient,
  "rol" | "tipoIdentificacion" | "usuario" | "vehiculo" | "zona"
>;

const PERFILES: Perfil[] = [
  {
    email: "admin.qa@empresa.test",
    emailAnterior: "admin.qa@ordenex.test",
    nombre: "Ana",
    primerApellido: "Admin",
    telefono: "88880002",
    cedula: "9000000002",
    rol: RolValue.admin,
  },
  {
    email: "mensajero.qa@empresa.test",
    emailAnterior: "mensajero.qa@ordenex.test",
    nombre: "Marco",
    primerApellido: "Mensajero",
    telefono: "88880003",
    cedula: "9000000003",
    rol: RolValue.mensajero,
    zona: "GAM",
    vehiculo: "moto",
    placa: "QA-0001",
  },
  {
    email: "tienda.qa@empresa.test",
    emailAnterior: "tienda.qa@ordenex.test",
    nombre: "Tania",
    primerApellido: "Tienda",
    telefono: "88880004",
    cedula: "9000000004",
    rol: RolValue.adminTienda,
    fulfillment: true,
  },
  {
    email: "satelite.qa@empresa.test",
    emailAnterior: "satelite.qa@ordenex.test",
    nombre: "Sara",
    primerApellido: "Satelite",
    telefono: "88880005",
    cedula: "9000000005",
    rol: RolValue.adminSatelite,
    zona: "Quepos",
  },
];

/**
 * Lee la contrasena de QA desde `process.env`. Falla ruidosamente si falta:
 * preferimos cortar a sembrar cuentas con un valor por defecto adivinable.
 */
export function readQaPassword(env: NodeJS.ProcessEnv): string {
  const password = env.QA_PASSWORD;

  if (!password) {
    throw new Error(
      "Falta QA_PASSWORD. No se usa un valor por defecto a proposito: " +
        "una contrasena por defecto es exactamente el problema que este script evita."
    );
  }
  if (password.length < QA_PASSWORD_MIN_LENGTH) {
    throw new Error(
      `QA_PASSWORD debe tener al menos ${QA_PASSWORD_MIN_LENGTH} caracteres.`
    );
  }

  return password;
}

/**
 * R29: si existe la cuenta con el correo anterior y no la nueva, le cambia el correo. Conserva
 * `id` y relaciones porque es un `UPDATE` de la misma fila. Si existen las dos, no decide por
 * nadie: la anterior se queda como esta y se avisa.
 */
async function pasarAlCorreoNuevo(prisma: ClienteDeSiembra, p: Perfil): Promise<void> {
  const anterior = await prisma.usuario.findUnique({
    where: { email: p.emailAnterior },
    select: { id: true },
  });
  if (anterior === null) return;

  const nueva = await prisma.usuario.findUnique({
    where: { email: p.email },
    select: { id: true },
  });
  if (nueva !== null) {
    console.warn(
      `Existen ${p.emailAnterior} y ${p.email}: no se toca ninguna, hay que resolverlo a mano.`
    );
    return;
  }

  await prisma.usuario.update({
    where: { id: anterior.id },
    data: { email: p.email },
  });
  console.log(`Usuario QA pasado al correo nuevo: ${p.email}`);
}

/**
 * Siembra las cuentas QA. Recibe el cliente y el hash por parametro para poder ejercitarla dentro
 * de una transaccion revertida (mismo patron que `seedMaestro`).
 */
export async function seedUsuariosQa(
  prisma: ClienteDeSiembra,
  passwordHash: string
): Promise<void> {
  // Prerequisito de catalogo: lo siembra `pnpm db:seed`. Si falta, avisamos
  // en vez de estallar con un error de FK ilegible.
  const tipoCedula = await prisma.tipoIdentificacion.findUnique({
    where: { value: "cedula" },
  });
  if (!tipoCedula) {
    throw new Error(
      "No existe el tipo_identificacion 'cedula'. Corre primero `pnpm db:seed`."
    );
  }

  for (const p of PERFILES) {
    const rol = await prisma.rol.findUnique({ where: { value: p.rol } });
    if (!rol) {
      throw new Error(`No existe el rol '${p.rol}'. Corre primero \`pnpm db:seed\`.`);
    }

    const zonaId = p.zona
      ? (await prisma.zona.findFirst({ where: { nombre: p.zona } }))?.id
      : undefined;
    if (p.zona && !zonaId) {
      throw new Error(`No existe la zona '${p.zona}'. Corre primero \`pnpm db:seed\`.`);
    }

    const vehiculoId = p.vehiculo
      ? (await prisma.vehiculo.findFirst({ where: { name: p.vehiculo } }))?.id
      : undefined;
    if (p.vehiculo && !vehiculoId) {
      throw new Error(
        `No existe el vehiculo '${p.vehiculo}'. Corre primero \`pnpm db:seed\`.`
      );
    }

    const comun = {
      passwordHash,
      estado: "activo" as const,
      rolId: rol.id,
      zonaId: zonaId ?? null,
      vehiculoId: vehiculoId ?? null,
      placa: p.placa ?? null,
      fulfillment: p.fulfillment ?? false,
    };

    await pasarAlCorreoNuevo(prisma, p);

    await prisma.usuario.upsert({
      where: { email: p.email },
      update: comun,
      create: {
        ...comun,
        nombre: p.nombre,
        primerApellido: p.primerApellido,
        email: p.email,
        telefono: p.telefono,
        cedula: p.cedula,
        tipoIdentificacionId: tipoCedula.id,
      },
    });
    // Nunca se loguea la contrasena, solo el email afectado.
    console.log(`Usuario QA listo: ${p.email} [${p.rol}]`);
  }
}

async function main(): Promise<void> {
  // Prisma 7 no auto-carga el .env y este script corre por `tsx`, no por el CLI
  // de Prisma: sin esto `DATABASE_URL` llega undefined a `getPrismaClient()`.
  try {
    process.loadEnvFile();
  } catch {
    // sin .env: se usan las variables ya presentes en process.env
  }

  const password = readQaPassword(process.env);
  const prisma = getPrismaClient();

  try {
    await seedUsuariosQa(prisma, await hashPassword(password));
  } finally {
    await prisma.$disconnect();
  }
}

// Solo auto-ejecuta cuando este archivo es el entrypoint del proceso; si un
// test lo importa para ejercitar `seedUsuariosQa`, `main()` NO se dispara.
const isEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((error: unknown) => {
    console.error(
      "Fallo el seed de usuarios QA:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  });
}
