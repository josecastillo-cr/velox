// Base comun de los correos de codigo (feature 489, R1/R7/R8).
//
// Funcion pura: cabecera con la marca, cuerpo y pie, en ese orden, en HTML con
// estilos inline (los clientes de correo ignoran <style> y clases) y en texto
// plano con las mismas piezas. Todo valor interpolado en el HTML se escapa.

export interface CorreoCodigoPiezas {
  /** Marca ya resuelta (SMTP_FROM_NAME o "Ordenex"). */
  marca: string;
  titulo: string;
  /** Parrafo antes del codigo. */
  introduccion: string;
  codigo: string;
  expiresInMinutes: number;
  avisoSiNoFuisteTu: string;
}

export interface CorreoCodigoCompuesto {
  html: string;
  text: string;
}

/** Escapa el texto que se interpola en el cuerpo HTML (R8). */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lineaVencimiento(minutos: number): string {
  return `Vence en ${minutos} minutos y solo sirve una vez.`;
}

function lineaPie(marca: string): string {
  return `Este correo lo envió ${marca} de forma automática; no respondas a este mensaje.`;
}

export function componerCorreoCodigo(piezas: CorreoCodigoPiezas): CorreoCodigoCompuesto {
  const { marca, titulo, introduccion, codigo, expiresInMinutes, avisoSiNoFuisteTu } = piezas;
  const e = escaparHtml;

  const text = [
    marca,
    titulo,
    introduccion,
    codigo,
    lineaVencimiento(expiresInMinutes),
    avisoSiNoFuisteTu,
    lineaPie(marca),
  ].join("\n\n");

  const html = [
    "<!doctype html>",
    '<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#f4f6f8;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">',
    '<tr><td align="center">',
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0b2545;">',
    // 1. Cabecera
    `<tr><td style="background:#0b2545;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">${e(marca)}</td></tr>`,
    // 2. Cuerpo
    '<tr><td style="padding:24px;">',
    `<h1 style="margin:0 0 16px;font-size:20px;color:#0b2545;">${e(titulo)}</h1>`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${e(introduccion)}</p>`,
    `<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px;color:#f26419;">${e(codigo)}</p>`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${e(lineaVencimiento(expiresInMinutes))}</p>`,
    `<p style="margin:0;font-size:14px;line-height:1.5;color:#4a5a6a;">${e(avisoSiNoFuisteTu)}</p>`,
    "</td></tr>",
    // 3. Pie
    `<tr><td style="padding:16px 24px;border-top:1px solid #e3e8ee;font-size:12px;color:#6b7a89;">${e(lineaPie(marca))}</td></tr>`,
    "</table>",
    "</td></tr></table>",
    "</body></html>",
  ].join("");

  return { html, text };
}
