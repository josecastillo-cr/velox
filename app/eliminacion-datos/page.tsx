import { DATOS_LEGALES } from "../_legal/datos-legales";
import { InstruccionesEliminacion } from "../_legal/InstruccionesEliminacion";
import { metadataLegal } from "../_legal/metadata-legal";

// Feature 490 — pagina PUBLICA (R2, `PUBLIC_ROUTES` del middleware) y ESTATICA (R6): son las
// instrucciones de eliminacion de datos que Meta exige, pedidas sin sesion. No lee cookies,
// cabeceras, parametros de busqueda ni la base: se prerenderiza en el build.
export const dynamic = "force-static";

export const metadata = metadataLegal(DATOS_LEGALES, {
  titulo: "Eliminación de datos",
  descripcion: (marca) => `Cómo solicitar a ${marca} la eliminación de tus datos personales.`,
});

export default function EliminacionDatosPage() {
  return <InstruccionesEliminacion datos={DATOS_LEGALES} />;
}
