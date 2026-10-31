// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import { PoliticaPrivacidad } from "@/app/_legal/PoliticaPrivacidad";
import { InstruccionesEliminacion } from "@/app/_legal/InstruccionesEliminacion";
import type { DatosLegales } from "@/app/_legal/datos-legales";

/**
 * Feature 490 — contenido de las paginas legales.
 *
 * Se renderiza con `renderToStaticMarkup` (el HTML que entrega el SERVIDOR, sin JavaScript del
 * navegador: R5) y se parsea con `DOMParser` para consultarlo. Las aserciones de contenido van
 * contra LITERALES del spec (`requirements.md` R9-R11, R15-R16), nunca contra el propio componente
 * ni contra `DATOS_LEGALES`. R20 se prueba con valores ficticios evidentes, nunca con los reales.
 */

const MARCADOR = "[pendiente de definir]";

const SIN_DATOS: DatosLegales = {
  marca: null,
  razonSocial: null,
  cedulaJuridica: null,
  domicilio: null,
  correoPrivacidad: null,
  ultimaActualizacion: null,
  plazoRespuesta: null,
};

const DATOS_FICTICIOS: DatosLegales = {
  marca: "MARCA-PRUEBA",
  razonSocial: "RAZON-PRUEBA",
  cedulaJuridica: "CEDULA-PRUEBA",
  domicilio: "DOMICILIO-PRUEBA",
  correoPrivacidad: "correo-prueba@ejemplo.test",
  ultimaActualizacion: "FECHA-PRUEBA",
  plazoRespuesta: "PLAZO-PRUEBA",
};

function html(el: ReactElement): string {
  return renderToStaticMarkup(el);
}

function doc(el: ReactElement): Document {
  return new DOMParser().parseFromString(html(el), "text/html");
}

/**
 * Texto visible de la pagina con los espacios normalizados (el JSX parte las frases en varias
 * lineas). Cabecera + `<main>`: el pie es `LandingFooter`, que trae sus propios literales fijos
 * (pregunta abierta 11) y no es contenido legal.
 */
function texto(d: Document): string {
  const partes = [d.querySelector("header"), d.querySelector("main")].map((n) => n?.textContent ?? "");
  return partes.join(" ").replace(/\s+/g, " ");
}

function itemsDeLista(d: Document): string[] {
  return [...d.querySelectorAll("main li")].map((li) =>
    (li.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}

function pendientes(d: Document): Element[] {
  return [...d.querySelectorAll("main [data-pendiente]")];
}

// =================================================================================================
// Privacidad
// =================================================================================================

describe("PoliticaPrivacidad — estructura y HTML de servidor (R5, R8)", () => {
  it("R5: el texto completo esta en el HTML estatico, sin scripts", () => {
    const markup = html(<PoliticaPrivacidad datos={SIN_DATOS} />);

    expect(markup).toContain("Política de privacidad");
    expect(markup).toContain("Fotografías de evidencia de la entrega.");
    expect(markup).toContain("Responder la postulación.");
    expect(markup).not.toContain("<script");
  });

  it("R8: tiene exactamente un <h1>", () => {
    const d = doc(<PoliticaPrivacidad datos={SIN_DATOS} />);
    const h1 = d.querySelectorAll("h1");

    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe("Política de privacidad");
  });
});

describe("PoliticaPrivacidad — categorias de datos (R9, R10, R11)", () => {
  it("R9: enumera los datos de los destinatarios", () => {
    const items = itemsDeLista(doc(<PoliticaPrivacidad datos={SIN_DATOS} />));

    for (const literal of [
      "Nombre.",
      "Teléfono.",
      "Dirección de entrega, con provincia, cantón y distrito.",
      "Ubicación geocodificada de la dirección de entrega.",
      "Notas y contenido del envío.",
      "Monto a cobrar.",
      "Fotografías de evidencia de la entrega.",
    ]) {
      expect(items).toContain(literal);
    }
    const whatsapp = items.find((i) => i.startsWith("Mensajes de WhatsApp intercambiados"));
    expect(whatsapp).toBeDefined();
    for (const parte of [
      "texto",
      "ubicaciones compartidas",
      "contactos compartidos",
      "referencias a archivos adjuntos",
    ]) {
      expect(whatsapp).toContain(parte);
    }
  });

  it("R10: enumera los datos de los usuarios internos", () => {
    const items = itemsDeLista(doc(<PoliticaPrivacidad datos={SIN_DATOS} />));

    for (const literal of [
      "Nombre y apellidos.",
      "Número y tipo de identificación.",
      "Correo electrónico.",
      "Vehículo y placa (mensajeros).",
      "Documentos de postulación de mensajeros: fotografías de la identificación, de la propiedad del vehículo y del rostro.",
      "Ubicación al registrar una gestión de entrega.",
      "Datos de seguridad de acceso: dirección IP y navegador de los intentos de ingreso y de los dispositivos de confianza.",
    ]) {
      expect(items).toContain(literal);
    }
  });

  it("R11: enumera los datos de los postulantes", () => {
    const d = doc(<PoliticaPrivacidad datos={SIN_DATOS} />);
    const seccion = [...d.querySelectorAll("main section")].find(
      (s) => s.querySelector("h2")?.textContent === "Postulantes",
    );
    expect(seccion).toBeDefined();
    const items = [...seccion!.querySelectorAll("li")].map((li) => li.textContent?.trim());

    for (const literal of ["Nombre.", "Teléfono.", "Correo electrónico.", "El mensaje que escriben."]) {
      expect(items).toContain(literal);
    }
  });
});

describe("PoliticaPrivacidad — finalidades (R12)", () => {
  it.each([
    [
      "Destinatarios de los envíos",
      [
        "Entregar el envío y contactar al destinatario.",
        "Planificar la ruta de reparto.",
        "Cobrar contra entrega el monto indicado.",
        "Coordinar la entrega con el mensajero.",
        "Probar la entrega o un incidente durante el envío.",
      ],
    ],
    [
      "Usuarios de la aplicación",
      [
        "Identificar la cuenta y comunicarnos con su titular.",
        "Asignar repartos a los mensajeros.",
        "Verificar la identidad y el vehículo de quien se postula como mensajero.",
        "Respaldar cada gestión de entrega registrada.",
        "Proteger el ingreso a la aplicación.",
      ],
    ],
    ["Postulantes", ["Responder la postulación."]],
  ])("la seccion «%s» dice para que se usan sus datos", (titulo, usos) => {
    const d = doc(<PoliticaPrivacidad datos={SIN_DATOS} />);
    const seccion = [...d.querySelectorAll("main section")].find(
      (s) => s.querySelector("h2")?.textContent === titulo,
    );
    expect(seccion).toBeDefined();
    const subtitulos = [...seccion!.querySelectorAll("h3")].map((h) => h.textContent);
    expect(subtitulos).toContain("Para qué se usan");

    const items = [...seccion!.querySelectorAll("li")].map((li) =>
      (li.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    for (const uso of usos) expect(items).toContain(uso);
  });

  it("T8: nombra a los terceros que procesan datos", () => {
    const d = doc(<PoliticaPrivacidad datos={SIN_DATOS} />);
    const seccion = [...d.querySelectorAll("main section")].find(
      (s) => s.querySelector("h2")?.textContent === "Servicios de terceros",
    );
    expect(seccion).toBeDefined();
    const items = [...seccion!.querySelectorAll("li")].map((li) => li.textContent ?? "");
    for (const tercero of ["Meta (WhatsApp)", "Google Maps", "Brevo", "Vercel", "Supabase"]) {
      expect(items.some((i) => i.startsWith(`${tercero}:`)), tercero).toBe(true);
    }
  });

  it("T8: cita la Ley 8968 de Costa Rica", () => {
    const t = texto(doc(<PoliticaPrivacidad datos={SIN_DATOS} />));
    expect(t).toContain(
      "Ley 8968 de Costa Rica, Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales",
    );
  });

  it("T8: el plazo de respuesta sale de los datos legales", () => {
    expect(texto(doc(<PoliticaPrivacidad datos={DATOS_FICTICIOS} />))).toContain(
      "en un plazo máximo de PLAZO-PRUEBA",
    );
  });

  it("no afirma que se conserva nada tras una solicitud (abierto 8)", () => {
    const t = texto(doc(<PoliticaPrivacidad datos={SIN_DATOS} />)).toLowerCase();
    for (const prohibido of ["se conserva", "conservamos", "días hábiles"]) {
      expect(t).not.toContain(prohibido);
    }
  });
});

describe("PoliticaPrivacidad — datos legales (R13, R19, R20) y enlace (R14)", () => {
  it("R13 + R20: con datos definidos muestra los cinco valores y ningun marcador", () => {
    const d = doc(<PoliticaPrivacidad datos={DATOS_FICTICIOS} />);
    const t = texto(d);

    for (const valor of [
      "MARCA-PRUEBA",
      "RAZON-PRUEBA",
      "CEDULA-PRUEBA",
      "DOMICILIO-PRUEBA",
      "correo-prueba@ejemplo.test",
      "FECHA-PRUEBA",
      "PLAZO-PRUEBA",
    ]) {
      expect(t).toContain(valor);
    }
    expect(t).not.toContain(MARCADOR);
    expect(d.querySelectorAll("[data-pendiente]")).toHaveLength(0);
  });

  it("R13: rotula cada dato legal", () => {
    const etiquetas = [...doc(<PoliticaPrivacidad datos={SIN_DATOS} />).querySelectorAll("main dt")].map(
      (dt) => dt.textContent,
    );
    expect(etiquetas).toEqual([
      "Marca",
      "Razón social",
      "Cédula jurídica",
      "Domicilio",
      "Correo de contacto de privacidad",
      "Última actualización",
    ]);
  });

  it("R19: sin datos definidos, cada dato legal sale como marcador visible y sin sustituto", () => {
    const d = doc(<PoliticaPrivacidad datos={SIN_DATOS} />);
    const dd = [...d.querySelectorAll("main dd")];

    expect(dd).toHaveLength(6);
    for (const celda of dd) {
      expect(celda.textContent).toBe(MARCADOR);
      expect(celda.querySelector("[data-pendiente]")).not.toBeNull();
    }
    // Ningun valor ficticio ni real colado como sustituto.
    expect(texto(d)).not.toMatch(/S\.A\.|@/);
    expect(pendientes(d).length).toBeGreaterThanOrEqual(5);
  });

  it("R14: enlaza a la pagina de eliminacion", () => {
    const d = doc(<PoliticaPrivacidad datos={SIN_DATOS} />);
    expect(d.querySelector('main a[href="/eliminacion-datos"]')).not.toBeNull();
  });
});

// =================================================================================================
// Eliminacion
// =================================================================================================

describe("InstruccionesEliminacion — estructura (R5, R8)", () => {
  it("R5: el texto esta en el HTML estatico, sin scripts", () => {
    const markup = html(<InstruccionesEliminacion datos={SIN_DATOS} />);
    expect(markup).toContain("Eliminación de datos");
    expect(markup).toContain("por correo electrónico");
    expect(markup).not.toContain("<script");
  });

  it("R8: tiene exactamente un <h1>", () => {
    const h1 = doc(<InstruccionesEliminacion datos={SIN_DATOS} />).querySelectorAll("h1");
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe("Eliminación de datos");
  });
});

describe("InstruccionesEliminacion — solicitud por correo (R15, R16, R21)", () => {
  it("R15: explica que se solicita por correo y muestra el correo como mailto:", () => {
    const d = doc(<InstruccionesEliminacion datos={DATOS_FICTICIOS} />);

    expect(texto(d)).toContain("La eliminación se solicita por correo electrónico");
    const mailto = d.querySelector('main a[href^="mailto:"]');
    expect(mailto).not.toBeNull();
    expect(mailto!.getAttribute("href")).toBe("mailto:correo-prueba@ejemplo.test");
    expect(mailto!.textContent).toBe("correo-prueba@ejemplo.test");
  });

  it("R16: dice que datos incluir para identificar a la persona", () => {
    const items = itemsDeLista(doc(<InstruccionesEliminacion datos={SIN_DATOS} />));
    expect(items).toEqual([
      "Tu nombre.",
      "El teléfono con el que te relacionas con nosotros.",
      "Si eres destinatario de un envío, el número de guía cuando lo tengas.",
    ]);
  });

  it("R21: sin correo definido no hay mailto: y el marcador sale como texto", () => {
    const d = doc(<InstruccionesEliminacion datos={SIN_DATOS} />);

    expect(d.querySelector('a[href^="mailto:"]')).toBeNull();
    const parrafo = [...d.querySelectorAll("main p")].find((p) =>
      p.textContent?.includes("por correo electrónico"),
    );
    expect(parrafo?.querySelector("[data-pendiente]")?.textContent).toBe(MARCADOR);
  });

  it("T8: indica el plazo de respuesta tomado de los datos legales", () => {
    const d = doc(<InstruccionesEliminacion datos={DATOS_FICTICIOS} />);
    expect(texto(d)).toContain("Respondemos cada solicitud en un plazo máximo de PLAZO-PRUEBA.");
  });

  it("no afirma que se borra todo ni que algo se conserva (abierto 8)", () => {
    const t = texto(doc(<InstruccionesEliminacion datos={SIN_DATOS} />)).toLowerCase();
    for (const prohibido of ["se conserva", "conservamos", "todos tus datos serán"]) {
      expect(t).not.toContain(prohibido);
    }
  });
});

describe("InstruccionesEliminacion — datos legales y enlace (R17, R19, R20)", () => {
  it("R17 + R20: muestra marca, razon social y fecha definidas, sin marcador", () => {
    const d = doc(<InstruccionesEliminacion datos={DATOS_FICTICIOS} />);
    const t = texto(d);

    for (const valor of ["MARCA-PRUEBA", "RAZON-PRUEBA", "FECHA-PRUEBA", "PLAZO-PRUEBA"]) {
      expect(t).toContain(valor);
    }
    expect(t).not.toContain(MARCADOR);
  });

  it("R17 + R19: sin datos, marca, razon social y fecha salen como marcador", () => {
    const d = doc(<InstruccionesEliminacion datos={SIN_DATOS} />);
    const filas = [...d.querySelectorAll("main dt")].map((dt) => [
      dt.textContent,
      dt.nextElementSibling?.textContent,
    ]);
    expect(filas).toEqual([
      ["Marca", MARCADOR],
      ["Razón social", MARCADOR],
      ["Última actualización", MARCADOR],
    ]);
  });

  it("R17: enlaza a la pagina de privacidad", () => {
    const d = doc(<InstruccionesEliminacion datos={SIN_DATOS} />);
    expect(d.querySelector('main a[href="/privacidad"]')).not.toBeNull();
  });
});

describe("armazon comun — la marca de la cabecera sale de los datos legales (R19, R20)", () => {
  it.each([
    ["privacidad", PoliticaPrivacidad],
    ["eliminacion", InstruccionesEliminacion],
  ] as const)("%s: cabecera con marca o marcador, y enlace a /", (_n, Cuerpo) => {
    const conDatos = doc(<Cuerpo datos={DATOS_FICTICIOS} />);
    const sinDatos = doc(<Cuerpo datos={SIN_DATOS} />);

    expect(conDatos.querySelector("header")?.textContent).toContain("MARCA-PRUEBA");
    expect(sinDatos.querySelector("header [data-pendiente]")?.textContent).toBe(MARCADOR);
    expect(sinDatos.querySelector('header a[href="/"]')).not.toBeNull();
  });
});

// =================================================================================================
// page.tsx: metadata (R7) y union config + cuerpo
// =================================================================================================

describe("page.tsx — metadata con la marca de los datos legales (R7)", () => {
  afterEach(() => {
    vi.doUnmock("@/app/_legal/datos-legales");
    vi.resetModules();
  });

  async function cargarConMarca(marca: string | null) {
    vi.resetModules();
    vi.doMock("@/app/_legal/datos-legales", () => ({
      DATOS_LEGALES: { ...SIN_DATOS, marca },
      MARCADOR_PENDIENTE: MARCADOR,
    }));
    const privacidad = await import("@/app/privacidad/page");
    const eliminacion = await import("@/app/eliminacion-datos/page");
    return { privacidad, eliminacion };
  }

  it("con marca definida, titulo y descripcion la incluyen", async () => {
    const { privacidad, eliminacion } = await cargarConMarca("MARCA-PRUEBA");

    for (const m of [privacidad.metadata, eliminacion.metadata]) {
      expect(String(m.title)).toContain("MARCA-PRUEBA");
      expect(String(m.description)).toContain("MARCA-PRUEBA");
    }
    expect(String(privacidad.metadata.title)).toContain("Política de privacidad");
    expect(String(eliminacion.metadata.title)).toContain("Eliminación de datos");
  });

  it("sin marca definida, titulo y descripcion llevan el marcador", async () => {
    const { privacidad, eliminacion } = await cargarConMarca(null);

    for (const m of [privacidad.metadata, eliminacion.metadata]) {
      expect(String(m.title)).toContain(MARCADOR);
      expect(String(m.description)).toContain(MARCADOR);
    }
  });

  it("R5: la page.tsx real renderiza su cuerpo completo en el HTML de servidor", async () => {
    const { privacidad, eliminacion } = await cargarConMarca(null);

    const p = renderToStaticMarkup(privacidad.default());
    const e = renderToStaticMarkup(eliminacion.default());
    expect(p).toContain("Destinatarios de los envíos");
    expect(e).toContain("Qué incluir en la solicitud");
    expect(p).not.toContain("<script");
    expect(e).not.toContain("<script");
  });
});

// =================================================================================================
// T8: con los datos legales reales ya definidos no queda ningun marcador visible
// =================================================================================================

describe("T8 — datos legales reales: ningun marcador de pendiente", () => {
  it.each([
    ["/privacidad", "@/app/privacidad/page"],
    ["/eliminacion-datos", "@/app/eliminacion-datos/page"],
  ])("%s (page.tsx real, pie incluido) no muestra el marcador", async (_ruta, modulo) => {
    vi.resetModules();
    const pagina = await import(/* @vite-ignore */ modulo);
    const markup = renderToStaticMarkup(pagina.default());

    expect(markup).not.toContain(MARCADOR);
    expect(markup).not.toContain("data-pendiente");
    expect(String(pagina.metadata.title)).not.toContain(MARCADOR);
  });

  it("no publica datos personales del gerente (decision del humano)", async () => {
    vi.resetModules();
    const pagina = await import("@/app/privacidad/page");
    const t = renderToStaticMarkup(pagina.default()).toLowerCase();
    expect(t).not.toContain("gerente");
    expect(t).not.toContain("apoderado");
  });
});
