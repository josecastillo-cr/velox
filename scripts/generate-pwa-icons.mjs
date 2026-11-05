// Genera los PNG de la PWA a partir de los DOS vectores de marca, y el `badge` de las
// notificaciones push a partir del simbolo.
//
// Feature 492 — la marca pasa a ser Velox Courier. Las fuentes son ahora el simbolo de Velox
// sobre `#011027`: `icon-maskable.svg` es una copia byte a byte de
// `docs/marca/velox/svg/icono-maskable.svg` (la vigila `marca-velox-archivos.guardia`) e
// `icon-any.svg` es el mismo vector con el fondo redondeado (rx=108). El `badge-72.png` sale de
// `public/marca/logo-simbolo.svg` convertido en silueta blanca (Android solo usa el alfa).
// Los nombres de salida no cambian: la app instalada se actualiza en vez de duplicarse.
//
// Feature 284 — este script estaba ROTO: leia `public/next.svg`, un archivo que ya no
// existe en el arbol, y pintaba el logotipo de Next sobre un cuadrado naranja. O sea que
// no podia reproducir ni uno de los iconos que la app servia entonces. Desde la 284 lee las
// fuentes reales de la marca (entonces el monograma "ex" de la marca anterior; desde la 492 el simbolo
// de Velox Courier) y emite las imagenes que declaran el manifiesto, el `<head>` y `sw.js`.
//
// POR QUE DOS VECTORES Y NO UNO (decision del humano, 2026-08-25):
//
//   - `icon-any.svg`      -> esquinas redondeadas (rx=108 sobre 512). Es el icono tal cual
//                            se ve cuando NADIE lo enmascara.
//   - `icon-maskable.svg` -> a sangre (rx=0) y con el simbolo dentro de la zona segura
//                            (al 66 %). Lo recorta la mascara del lanzador (Android) o
//                            iOS, que redondean ELLOS. Un icono ya redondeado dentro de una
//                            mascara redondeada da el doble redondeo que se veia hasta hoy.
//
// El PNG de 180 es la variante A SANGRE: iOS aplica su propia mascara al `apple-touch-icon`
// y espera un cuadrado lleno, no un icono con las esquinas ya recortadas.
//
// LA TRAMPA DE LA TIPOGRAFIA, medida el 2026-08-25 y por eso los vectores llevan TRAZADOS y
// no texto (lo mismo vale para Velox: sus vectores son todo `<path>`): el vector anterior pedia `font-family: Poppins` y la app carga Poppins con
// `next/font/google`, que la descarga EN EL NAVEGADOR. Al rasterizar aqui, sin Poppins
// instalada en el sistema, el monograma salia en la tipografia de respaldo y NADIE se
// enteraba: el script no falla, el PNG se genera y la letra no es la de la marca. Medido:
// el `icon-512.png` que la app servia hasta hoy coincidia al 99,7 % con un render en
// **Segoe UI** y difiere un 2,3 % del render en Poppins Bold. Ya habia pasado.
//
// Uso: node scripts/generate-pwa-icons.mjs

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

/** Cada salida: de que vector sale y de que tamano. */
const SALIDAS = [
  { fuente: "icon-any.svg", size: 192, name: "icon-192.png" },
  { fuente: "icon-any.svg", size: 512, name: "icon-512.png" },
  { fuente: "icon-maskable.svg", size: 192, name: "icon-192-maskable.png" },
  { fuente: "icon-maskable.svg", size: 512, name: "icon-512-maskable.png" },
  // iOS: 180x180 y a sangre. El `<head>` lo declara como `apple-touch-icon`.
  { fuente: "icon-maskable.svg", size: 180, name: "icon-180.png" },
];

/** Lado al que se rasteriza el vector antes de reescalar. Sobra para 512. */
const LADO_BASE = 1024;

/**
 * Feature 492 — el icono pequeno de las notificaciones push. Android lo pinta como silueta con
 * SOLO el canal alfa, asi que se toma el alfa del simbolo y se compone sobre blanco puro (RGBA,
 * tipo de color 6). Un `badge` sin alfa sale como un cuadrado lleno en la barra de estado.
 */
const BADGE = { fuente: "public/marca/logo-simbolo.svg", size: 72, name: "badge-72.png" };

function rechazarTexto(nombre, svg) {
  if (/<text[\s>]/.test(svg.toString("utf8"))) {
    // Cinturon: un vector con <text> vuelve a depender de una fuente del sistema y el
    // fallo seria MUDO. Mejor no generar nada que generar un icono con otra letra.
    console.error(`${nombre} contiene <text>: la marca tiene que ir en trazados (<path>).`);
    process.exit(1);
  }
}

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("sharp no esta instalado. Instalalo con: pnpm add -D sharp");
    console.error("Y vuelve a correr: node scripts/generate-pwa-icons.mjs");
    process.exit(1);
  }

  const fuentesDir = resolve(root, "public", "icons", "fuente");
  const iconsDir = resolve(root, "public", "icons");

  for (const { fuente, size, name } of SALIDAS) {
    const svg = readFileSync(resolve(fuentesDir, fuente));

    rechazarTexto(fuente, svg);

    // `density`: el vector declara 512px de lado, asi que 72 -> 512 y 144 -> 1024.
    await sharp(svg, { density: (72 * LADO_BASE) / 512 })
      .resize(size, size)
      .png()
      .toFile(resolve(iconsDir, name));

    console.log(`Generado ${name} (${size}x${size}) desde ${fuente}`);
  }

  {
    const { fuente, size, name } = BADGE;
    const svg = readFileSync(resolve(root, fuente));
    rechazarTexto(fuente, svg);
    const { data, info } = await sharp(svg, { density: 300 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Silueta: RGB a blanco puro, alfa intacto. Un pixel transparente queda (255,255,255,0).
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toFile(resolve(iconsDir, name));
    console.log(`Generado ${name} (${size}x${size}) desde ${fuente} (silueta blanca)`);
  }

  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
