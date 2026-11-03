import type { CreateZonaResult } from "@/lib/interfaces/repositories/IZonaRepository";
import type { ZonaDTO } from "@/lib/types/zona";

/**
 * FICHA 499 — `ZonaRepository.create` deja de devolver `ZonaDTO` a secas (design §3.1). Los tests
 * que crean una zona con distritos LIBRES desenvuelven aqui el `ok`; cualquier otro desenlace es un
 * fallo RUIDOSO, nunca un `undefined` que pase por vacuidad.
 */
export function zonaCreada(res: CreateZonaResult): ZonaDTO {
  if (res.estado !== "ok") throw new Error(`se esperaba \`ok\` al crear y llego \`${res.estado}\``);
  return res.zona;
}
