import { CorreoLegal, DatoLegal } from "./DatoLegal";
import type { DatosLegales } from "./datos-legales";
import {
  EnlaceLegal,
  FichaResponsable,
  ListaLegal,
  PaginaLegal,
  SeccionLegal,
  SubtituloLegal,
} from "./PaginaLegal";

/**
 * Feature 490 — cuerpo de la politica de privacidad (`/privacidad`).
 *
 * Recibe los datos legales POR PROP y no importa la configuracion: `page.tsx` es el unico sitio
 * que une ambos, y el test lo renderiza con datos `null` (R19) y con datos ficticios (R20) sin
 * mockear modulos.
 *
 * El inventario sale de `specs/490-paginas-legales/design.md` §3, verificado contra
 * `db/schema.prisma`: solo figura lo que la aplicacion guarda y solo para lo que la aplicacion lo
 * usa (R9-R12). Terceros, norma aplicable y plazo de respuesta se publican por decision del
 * humano (2026-10-30, T8). A proposito NO afirma plazos de conservacion ni que se conserva tras una
 * solicitud de eliminacion (pregunta abierta 8): un texto legal que promete lo que nadie decidio es
 * peor que uno que calla.
 */
export function PoliticaPrivacidad({ datos }: Readonly<{ datos: DatosLegales }>) {
  return (
    <PaginaLegal marca={datos.marca} rotulo="Legal" titulo="Política de privacidad">
      <p>
        <DatoLegal valor={datos.marca} /> presta servicios de mensajería y entrega de paquetes.
        Esta política explica qué datos personales guarda la aplicación, de quién y para qué se
        usan.
      </p>

      <SeccionLegal titulo="Responsable de los datos">
        <FichaResponsable
          filas={[
            { etiqueta: "Marca", valor: <DatoLegal valor={datos.marca} /> },
            { etiqueta: "Razón social", valor: <DatoLegal valor={datos.razonSocial} /> },
            { etiqueta: "Cédula jurídica", valor: <DatoLegal valor={datos.cedulaJuridica} /> },
            { etiqueta: "Domicilio", valor: <DatoLegal valor={datos.domicilio} /> },
            {
              etiqueta: "Correo de contacto de privacidad",
              valor: <CorreoLegal correo={datos.correoPrivacidad} />,
            },
            {
              etiqueta: "Última actualización",
              valor: <DatoLegal valor={datos.ultimaActualizacion} />,
            },
          ]}
        />
      </SeccionLegal>

      <SeccionLegal titulo="Destinatarios de los envíos">
        <p>Son las personas que reciben un paquete que transportamos.</p>
        <SubtituloLegal>Qué datos guardamos</SubtituloLegal>
        <ListaLegal>
          <li>Nombre.</li>
          <li>Teléfono.</li>
          <li>Dirección de entrega, con provincia, cantón y distrito.</li>
          <li>Ubicación geocodificada de la dirección de entrega.</li>
          <li>Notas y contenido del envío.</li>
          <li>Monto a cobrar.</li>
          <li>
            Mensajes de WhatsApp intercambiados: texto, ubicaciones compartidas, contactos
            compartidos y referencias a archivos adjuntos (se guarda la referencia, no el
            archivo).
          </li>
          <li>Fotografías de evidencia de la entrega.</li>
        </ListaLegal>
        <SubtituloLegal>Para qué se usan</SubtituloLegal>
        <ListaLegal>
          <li>Entregar el envío y contactar al destinatario.</li>
          <li>Planificar la ruta de reparto.</li>
          <li>Cobrar contra entrega el monto indicado.</li>
          <li>Coordinar la entrega con el mensajero.</li>
          <li>Probar la entrega o un incidente durante el envío.</li>
        </ListaLegal>
      </SeccionLegal>

      <SeccionLegal titulo="Usuarios de la aplicación">
        <p>
          Son las personas con una cuenta de acceso: administradores, mensajeros, tiendas y
          satélites.
        </p>
        <SubtituloLegal>Qué datos guardamos</SubtituloLegal>
        <ListaLegal>
          <li>Nombre y apellidos.</li>
          <li>Número y tipo de identificación.</li>
          <li>Correo electrónico.</li>
          <li>Teléfono.</li>
          <li>Vehículo y placa (mensajeros).</li>
          <li>
            Documentos de postulación de mensajeros: fotografías de la identificación, de la
            propiedad del vehículo y del rostro.
          </li>
          <li>Ubicación al registrar una gestión de entrega.</li>
          <li>
            Datos de seguridad de acceso: dirección IP y navegador de los intentos de ingreso y de
            los dispositivos de confianza.
          </li>
        </ListaLegal>
        <SubtituloLegal>Para qué se usan</SubtituloLegal>
        <ListaLegal>
          <li>Identificar la cuenta y comunicarnos con su titular.</li>
          <li>Asignar repartos a los mensajeros.</li>
          <li>Verificar la identidad y el vehículo de quien se postula como mensajero.</li>
          <li>Respaldar cada gestión de entrega registrada.</li>
          <li>Proteger el ingreso a la aplicación.</li>
        </ListaLegal>
      </SeccionLegal>

      <SeccionLegal titulo="Postulantes">
        <p>Son las personas que dejan sus datos en el formulario público de postulación.</p>
        <SubtituloLegal>Qué datos guardamos</SubtituloLegal>
        <ListaLegal>
          <li>Nombre.</li>
          <li>Teléfono.</li>
          <li>Correo electrónico.</li>
          <li>El mensaje que escriben.</li>
        </ListaLegal>
        <SubtituloLegal>Para qué se usan</SubtituloLegal>
        <ListaLegal>
          <li>Responder la postulación.</li>
        </ListaLegal>
      </SeccionLegal>

      <SeccionLegal titulo="Servicios de terceros">
        <p>Para prestar el servicio, la aplicación se apoya en estos proveedores:</p>
        <ListaLegal>
          <li>Meta (WhatsApp): mensajería con los destinatarios para coordinar la entrega.</li>
          <li>Google Maps: ubicación de las direcciones de entrega y planificación de rutas.</li>
          <li>Brevo: envío de correos electrónicos.</li>
          <li>Vercel: alojamiento de la aplicación.</li>
          <li>Supabase: base de datos y almacenamiento de archivos.</li>
        </ListaLegal>
      </SeccionLegal>

      <SeccionLegal titulo="Marco legal">
        <p>
          El tratamiento de los datos personales se rige por la Ley 8968 de Costa Rica, Ley de
          Protección de la Persona frente al Tratamiento de sus Datos Personales.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Eliminación de tus datos">
        <p>
          Puedes solicitar que eliminemos tus datos personales escribiendo a{" "}
          <CorreoLegal correo={datos.correoPrivacidad} />. Respondemos cada solicitud en un plazo
          máximo de <DatoLegal valor={datos.plazoRespuesta} />. Consulta cómo hacerlo en{" "}
          <EnlaceLegal href="/eliminacion-datos">Eliminación de datos</EnlaceLegal>.
        </p>
      </SeccionLegal>
    </PaginaLegal>
  );
}
