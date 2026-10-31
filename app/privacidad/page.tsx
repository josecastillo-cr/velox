import { DATOS_LEGALES } from "../_legal/datos-legales";
import { metadataLegal } from "../_legal/metadata-legal";
import { PoliticaPrivacidad } from "../_legal/PoliticaPrivacidad";

// Feature 490 — pagina PUBLICA (R1, `PUBLIC_ROUTES` del middleware) y ESTATICA (R6): Meta la pide
// sin sesion para pasar la app de WhatsApp a Live, y su rastreador lee el HTML del servidor. No
// lee cookies, cabeceras, parametros de busqueda ni la base: se prerenderiza en el build.
export const dynamic = "force-static";

export const metadata = metadataLegal(DATOS_LEGALES, {
  titulo: "Política de privacidad",
  descripcion: (marca) =>
    `Qué datos personales guarda ${marca}, de quién y para qué se usan.`,
});

export default function PrivacidadPage() {
  return <PoliticaPrivacidad datos={DATOS_LEGALES} />;
}
