import type { Metadata } from "next";

import { MARCADOR_PENDIENTE, type DatosLegales } from "./datos-legales";

/**
 * Feature 490 (R7) — titulo y descripcion de una pagina legal, con la marca tomada de los datos
 * legales (o el marcador de pendiente si aun no esta definida, R19).
 */
export function metadataLegal(
  datos: DatosLegales,
  pagina: { titulo: string; descripcion: (marca: string) => string },
): Metadata {
  const marca = datos.marca ?? MARCADOR_PENDIENTE;
  return {
    title: `${pagina.titulo} · ${marca}`,
    description: pagina.descripcion(marca),
  };
}
