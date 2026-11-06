# Revisión 494, tanda 1 (navegador y service worker)

Rama `feat/494-t1-navegador`, HEAD revisado `99d3705b`, contra `origin/dev`. Alcance: T2.1-T2.5 y R14, R15, R17-R23. R16 es de T5.3.

MCP `codebase-memory` sin conexión (*connection timed out*): medido con `grep` y leyendo los archivos.

## Veredicto: OK

Sin bloqueantes y sin fallos de conducta en el código. Cuatro hallazgos menores. El M1 conviene cerrarlo antes de mergear, porque deja un superviviente real de R20. Es decisión del leader; no lo considero bloqueante porque el código de hoy cumple R20, y el test existe y mide lo que dice para el resto de escritores.

## Checklist

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Tasks T2.1-T2.5 en `[x]` | sí | `tasks.md:36-40` |
| R → test, tanda 1 | sí, con M1 | 42 mutaciones reales: 41 mueren, 1 sobrevive (R20) |
| Claves viejas literales en los tests | sí | Las mutaciones del valor viejo en el módulo (m09-m16) mueren todas contra un literal |
| Gate `--rapido` | no corrido aquí, por instrucción | Medido por el leader: `INIT_EXIT=0`, ampliado |
| Guardia a mano (`--rapido` no la relaciona) | verde | Dentro de los 182 tests de la base del arnés |
| `vitest related` sobre los 17 archivos de producción | verde | 4.812 tests, 4.786 passed, 0 failed, 26 skipped |
| Tablas nuevas, RLS, webhooks, migraciones | no aplica | La tanda no toca base de datos |
| Secretos o dato identificable de producción | ninguno | Revisado el diff |
| Capas | sí | `lib/navegador/claves-legadas.ts` es puro: almacén por parámetro, sin `window` ni `document` |
| R28 | sí | El diff no toca `next.config.*`, `vercel.json`, `proxy.ts` ni `middleware.ts` |
| Checkpoints de cierre de feature (`./init.sh`, `history.md`, E2E) | no aplica a una tanda | E2E: el repo no tiene arnés (criterio del proyecto) |

## Los 26 skipped

Ninguno es de esta tanda: 17 en `tests/components/AnaliticaPage.test.tsx` y 9 en `tests/components/AnaliticaShell.test.tsx`, todos marcados `INERTE 2026-08-19`. Ninguno de los dos archivos está en el diff; `related` los arrastra por el grafo de imports.

## Migración de claves: ¿alguien puede perder una preferencia?

Inventario contrastado con `grep` de `localStorage`, `sessionStorage` y `document.cookie` en `app components hooks lib providers public`: no hay ninguna clave ni lector fuera de §5.1. Los únicos escritores son `preferencia-sonido.ts:40`, `preferencia-columnas.ts:300`, `preferencia-navegacion.ts:40`, `RevisionSinpeBodega.tsx:83`, `preferencia-tema.ts:35,75` y `claves-legadas.ts:108`. Todos escriben la clave nueva, salvo `preferencia-tema.ts:75`, que solo caduca la vieja.

| Caso | Sonido, navegación, columnas, SINPE | Tema |
| --- | --- | --- |
| Solo vieja | Se aplica y se traslada (m01, m02, m17, m18, m42, m43) | Pinta desde el servidor, traslada al montar (m37, m41) |
| Vieja y nueva | Manda la nueva, se borra la vieja (m03, m04) | Manda la nueva, se caduca la vieja (m19, m36) |
| Lee y lanza | `null`, sin propagar (m05, m06) | Sin propagar (m45) |
| Falla solo la escritura | Devuelve el viejo y CONSERVA la vieja: no se pierde | La escritura lanza antes de caducar: se conserva |
| Falla solo el borrado | La nueva manda y la siguiente lectura termina (m07) | No aplica |
| Valor corrupto | Se copia, y lo sanea el lector como antes | No es un tema: se caduca, sin escribir la nueva (m44) |
| SSR | Todos con guarda de `window` o dentro de `try` | El servidor lee las dos; el traslado es de cliente |
| Snapshot de `useSyncExternalStore` | Idempotente, mismo string, sin bucle | No aplica |

Dos pérdidas teóricas, las dos sin efecto duradero:

- Nueva corrupta con vieja válida en `localStorage`: gana la nueva y se borra la vieja, como exige R15. Ningún escritor produce una nueva corrupta.
- Pestaña de la versión anterior abierta mientras otra nueva migra: ver M4.

## §5.5: relevo del service worker

| Combinación | Resultado | Juicio |
| --- | --- | --- |
| Página vieja → SW nuevo en espera (relevo) | Alias en `sw.js:249` | Correcto. m38 muere |
| Página vieja → SW nuevo (página lista) | Alias en `sw.js:254` | Correcto. m39 muere |
| Página nueva → SW viejo que controla | Lo ignora; la purga espera al relevo | Aceptado por §5.5 |
| SW viejo → página nueva (push) | `esMensajePushRecibido` | Correcto. m40 muere |
| **SW nuevo → página vieja (push), fuera de §5.5** | La página ignora `app:push-recibido` | **Aceptable**, ver abajo |
| Tag viejo y nuevo | No se fusionan una vez | Aceptado por §5.5. `notificationclick` lee `data`, no el tag; nadie consulta `getNotifications` |

**Sobre la quinta combinación: la acepto.** Exige dos o más pestañas, porque con una sola el relevo recarga esa misma página, y G1 no recarga las demás (`hooks/useActualizacionPwa.ts:17`). No se pierde ningún aviso: la notificación del sistema sale igual y el sondeo de 60 s pone la campana al día. Lo que se paga es un tono de más, justo el modo de fallo que `usePushEnVentana.ts:26-28` ya elige como el peor caso admisible. Sin dinero ni datos, y termina al recargar, que `AvisoVersionNueva` ya ofrece. Mandar los dos nombres desde el SW lo arreglaría a cambio de revalidar dos veces en toda página nueva durante 90 días: peor trato. Falta anotarla en el diseño (M3).

Lo probado en Chromium real por el implementador (`progress/494_t1_sw_real.log`, ignorado por git) no lo he reproducido; aquí se ha medido con el SW real cargado en las guardias.

## §5.3: no conectar `traducir` en esta tanda

Correcto hoy: traducir con el catálogo actual haría reaparecer la columna (el test de `preferencias-494.test.tsx:126` lo fija). Por catálogos, `grep` de `clave: "…ordenex` da una sola columna guardable, `analitica-productos-descarga-columnas.ts:154`. `BarraComposicionCaja.tsx` también usa `clave: "ordenex"`, pero no es una preferencia guardada. El alcance de §5.3 a un solo ámbito es correcto.

Release antes de la tanda 4, medido con un test temporal (ya retirado): valor `{"ocultas":["ordenex"],"orden":["c","ordenex","b"]}` bajo `app:` y catálogo renombrado a `empresa` da `clavesVisibles = ["empresa","c","b"]`.

- Mientras no se renombre el catálogo: nada cambia, la oculta sigue oculta.
- Al renombrar con `traducir` solo sobre la vieja: **la columna oculta reaparece y su posición se pierde**. No se pierde dato de dinero y se vuelve a ocultar con un clic.
- Con la release prevista tras la tanda 7: no ocurre, porque en producción todo sigue bajo la clave vieja y pasa por `traducir`.

Ver M2.

## Cookie de tema

- El servidor la lee antes de hidratar: `app/(app)/layout.tsx:51-53`, y es el único lector de servidor. El layout raíz sigue sin leerla (`tema-encendido.guardia`). m19 y m37 mueren.
- `preferencia-tema.ts:75` sí puede caducar la vieja con una constante que R20 no ve; es correcto, y `cookie-legada-494.test.ts:72` exige que a la vieja solo se le escriba esa caducidad (m22 y m23 mueren). El hueco del detector es más ancho de lo declarado: M1.
- `path=/` coincide con el de la cookie vieja, así que la caducidad la borra de verdad.
- `leerPreferenciaTema` ya no tiene llamadas de producción fuera de `migrarCookieTema`.

## Desvíos declarados

| Desvío | ¿Debilita la guardia? |
| --- | --- |
| E5 partida en E5 y E5.1 | **No, la refuerza.** Sustituye un archivo entero por líneas de alias. El patrón no distingue archivo, así que `"ordenex:push-recibido"` y `"ordenex:cualquier-otra-cosa"` también quedarían exceptuados en `sw.js`; lo primero lo cubre `pwa-push.guardia` (m29 muere) y lo segundo sería un literal sin uso. m32 y m33 mueren |
| `claveViejaDe` y `leerConLegado` | `leerConLegado` no. **`claveViejaDe` sí abre una vía:** da la clave vieja sin literal, y es lo que deja vivo a m26. Ver M1 |
| R20 mira también `providers/` | No, la refuerza. m27 muere y confirma que el directorio se recorre |
| Basura en la nueva y vieja válida: gana la vieja | No. Es lo que dice §5.4, igual en servidor y cliente, con test (`AppLayout.test.tsx`, `cookie-legada-494.test.ts:91`) |

## Mutaciones

45 aplicadas con restauración byte a byte, comprobando en cada una que el archivo cambió y que corrieron tests (base 182, final 182, `git status` limpio). 3 resultaron equivalentes por construcción (m21, m34, m35: la rama solo corre cuando ya coinciden) y no cuentan.

| Resultado | Cuáles |
| --- | --- |
| Mueren con los tests de la tanda | m01-m20, m22, m23, m27-m33, m36-m45 |
| Mueren solo con `vitest related`, por tests anteriores a la 494 | m24 (`TemaToggle.test.tsx`), m25 (`AbrirEnAppNavegacion.test.tsx`, `preferencia-navegacion.test.ts`) |
| **Sobrevive** | **m26: `RevisionSinpeBodega.tsx:83` escribiendo con `claveViejaDe(...)`**, también con `related` (44 tests) |

## Hallazgos

### M1, menor: el detector de R20 no ve los nombres viejos que exporta el propio módulo

`tests/fixtures/marca-sin-ordenex-494.ts:293,301-320`. `progress/impl_494.md:258` declara el hueco solo para `COOKIE_TEMA_VIEJA` y dice que lo cubre `cookie-legada-494.test.ts`, pero ese test solo vigila `migrarCookieTema` y `guardarPreferenciaTema`. Medido contra `hallazgosLegado`, devuelven 0 hallazgos:

- `document.cookie` con `COOKIE_TEMA_VIEJA` importada.
- `setItem(claveViejaDe(CLAVE)!, v)` y `setItem(MENSAJE_RELEVO_AHORA_LEGADO, v)`.
- Dentro del módulo: `setItem(vieja, valor)` (m08 lo caza el test del módulo), `setItem` en varias líneas con literal, y `setItem("ordenex:" + k, v)`.
- Fuera del módulo, `setItem("ordenex:" + k, v)`: R20 no lo ve, aunque sí sube el trinquete, que la tanda 7 convierte en `it` llano.

Consecuencia real: m26 sobrevive. El código de hoy cumple (escritores enumerados arriba), y `claveViejaDe` no tiene ningún importador de producción fuera del módulo.

Arreglo pequeño: en `hallazgosLegado`, tratar como clave vieja los nombres exportados (`COOKIE_TEMA_VIEJA`, `MENSAJE_*_LEGADO`, `claveViejaDe`) en una línea que escriba, con excepción exacta para la línea de caducidad de `preferencia-tema.ts`; dejar de exportar `claveViejaDe` si los tests pueden pasar por `leerConLegado`; y añadir en `preferencias-494.test.tsx` que aplazar el aviso de SINPE escribe solo la clave nueva.

### M2, menor: la traducción de T5.3 sigue condicionada a que alguien recuerde una nota

`specs/494-marca-identificadores-internos/tasks.md:59`. La nota es correcta, pero dice «si hubo release». El test previsto para R16 siembra la clave vieja, así que no detectaría el caso de `app:`, y cualquier release completa de `dev` antes de T5.3 lo activa (§10 la prevé tras la tanda 7; la vía §2 bis no arrastra esta tanda). Propuesta para T5.3, no para esta tanda: traducir también al leer bajo `app:` en ese único ámbito, sin condición, con los dos casos en R16. Es idempotente y cuesta lo mismo que comprobar si hubo release.

### M3, menor: la quinta combinación no está en la tabla de §5.5

`specs/494-marca-identificadores-internos/design.md:321-326`. Solo consta en `progress/impl_494.md:262-264`. Quien retire los alias según §5.6 mirará el diseño. Añadir la fila.

### M4, menor: dos casos transitorios sin anotar (razonados, no medidos en navegador)

- **Pestaña de la versión anterior.** Una pestaña nueva borra `ordenex:*`, y la vieja, abierta, vuelve a sus valores por defecto hasta recargar; lo que elija ahí se descarta en la siguiente lectura de una página nueva, porque manda la nueva (R15). Nada de lo guardado antes se pierde.
- **Rollback de `prod`.** Página nueva abierta y SW anterior en espera: `useActualizacionPwa.ts:194` manda solo `app:relevo-ahora`, y ese SW no lo entiende, así que «actualizar» no hace nada hasta cerrar las pestañas. Además, el código anterior no lee nada de lo ya trasladado a `app:`. §5.5 no contempla volver atrás; conviene anotarlo donde T8 o `docs/release.md` hablen de revertir.

## Comprobado y sin hallazgo

- Aserciones contra su propia fuente: `AppLayout.test.tsx` y `tema-encendido.guardia` usan `COOKIE_TEMA_VIEJA` importada, y `pwa-relevo-y-purga` compara con los `*_LEGADO`, pero cada valor tiene su literal en otro test: m14, m15 y m16 mueren.
- Mapa de R18: la trazabilidad de `requirements.md` lo sitúa en `RevisionSinpeBodega.test.tsx` y vive en `preferencias-494.test.tsx`. Es test real (m09, m42) y cae en E5.
- Eventos de ventana renombrados: no persisten; sin migración, como dice §5.1.

## Mapa R → mutación que lo mata

| R | Mutaciones | Test |
| --- | --- | --- |
| R14 | m01, m02, m10-m13, m17, m18, m43 | `migrar-clave-494.test.ts`, `preferencias-494.test.tsx` |
| R15 | m03, m04, m19, m36 | `migrar-clave-494.test.ts`, `AppLayout.test.tsx`, `cookie-legada-494.test.ts` |
| R17 | m14, m20, m37, m41, m44 | `AppLayout.test.tsx`, `cookie-legada-494.test.ts` |
| R18 | m09, m42 | `preferencias-494.test.tsx` |
| R19 | m05-m07, m45 | `migrar-clave-494.test.ts`, `cookie-legada-494.test.ts` |
| R20 | m08, m22-m25, m27, m33; **m26 sobrevive** | guardia bloque «legado», `cookie-legada-494.test.ts`, tests previos para m24 y m25 |
| R21 | m16, m31, m38, m39 | `pwa-relevo-y-purga.guardia.test.ts` |
| R22 | m15, m28, m29, m40 | `usePushEnVentana.test.tsx`, `pwa-push.guardia.test.ts` |
| R23 | m30 | `pwa-push.guardia.test.ts` |
