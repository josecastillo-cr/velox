import { CorreoLegal, DatoLegal } from "./DatoLegal";
import type { DatosLegales } from "./datos-legales";
import {
  EnlaceLegal,
  FichaResponsable,
  ListaLegal,
  PaginaLegal,
  SeccionLegal,
} from "./PaginaLegal";

/**
 * Feature 490 — cuerpo de las instrucciones de eliminacion de datos (`/eliminacion-datos`).
 *
 * Mismo contrato que `PoliticaPrivacidad`: datos legales por prop. La solicitud es por CORREO y no
 * hay formulario (R15). El plazo de respuesta sale de los datos legales (T8). A proposito NO afirma
 * que se borra todo ni que algo se conserva: es la pregunta abierta 8.
 */
export function InstruccionesEliminacion({ datos }: Readonly<{ datos: DatosLegales }>) {
  return (
    <PaginaLegal marca={datos.marca} rotulo="Legal" titulo="Eliminación de datos">
      <p>
        Si quieres que <DatoLegal valor={datos.marca} /> elimine tus datos personales, puedes
        solicitarlo en cualquier momento.
      </p>

      <SeccionLegal titulo="Cómo solicitarlo">
        <p>
          La eliminación se solicita por correo electrónico, escribiendo a{" "}
          <CorreoLegal correo={datos.correoPrivacidad} />.
        </p>
        <p>
          Respondemos cada solicitud en un plazo máximo de{" "}
          <DatoLegal valor={datos.plazoRespuesta} />.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Qué incluir en la solicitud">
        <p>Para identificarte, indica en el correo:</p>
        <ListaLegal>
          <li>Tu nombre.</li>
          <li>El teléfono con el que te relacionas con nosotros.</li>
          <li>Si eres destinatario de un envío, el número de guía cuando lo tengas.</li>
        </ListaLegal>
      </SeccionLegal>

      <SeccionLegal titulo="Responsable de los datos">
        <FichaResponsable
          filas={[
            { etiqueta: "Marca", valor: <DatoLegal valor={datos.marca} /> },
            { etiqueta: "Razón social", valor: <DatoLegal valor={datos.razonSocial} /> },
            {
              etiqueta: "Última actualización",
              valor: <DatoLegal valor={datos.ultimaActualizacion} />,
            },
          ]}
        />
        <p>
          Para saber qué datos guardamos y para qué, consulta la{" "}
          <EnlaceLegal href="/privacidad">Política de privacidad</EnlaceLegal>.
        </p>
      </SeccionLegal>
    </PaginaLegal>
  );
}
