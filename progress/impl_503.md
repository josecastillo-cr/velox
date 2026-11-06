# Ficha 503 — Implementación

Rama `fix/503-ayuda-satelites-saldadas`, worktree `R:/w503`. Búsqueda con Grep/Read: `codebase-memory-mcp` no conectó.
Q1 = A: la frase dice solo el hecho, sin responsable.

## Archivos tocados

- `docs/ayuda/oficina/wallet-satelites.md`: la frase de la sección «Saldada con la regla anterior» y `actualizado: 2026-11-06`.
- `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`: bloques «503» y «503 — AUTOCOMPROBACION».
- `tests/components/Conciliacion498.test.tsx`: caso «503/R4», con fila de control.
- `specs/503-ayuda-satelites-saldadas/tasks.md`: T0 a T6 marcadas.

La pantalla no cambia. `git status` no muestra restos en `components/` ni `app/`.

## Estado de las tareas

| Tarea | Estado | Detalle |
| --- | --- | --- |
| T0-T4 | Hechas | Ver abajo. |
| T5 | Hecha, por el leader | Tras integrar `origin/dev` (`3aa551e9f`), el leader corrió `500-con-dinero-sql-real` y `ConciliacionAcciones500` con Postgres: 18 passed, 0 skipped. La cifra es la que él informó; aquí, sin `DATABASE_URL`, ese archivo daba `9 skipped`. |
| T6 | Hecha | Sección «Ver la app». |
| T7 | Parcial | El mapa está abajo. El gate lo corre el leader. |

## Ver la app (T6)

Playwright contra un solo dev server en el puerto 3503 y `localhost:5432/ordenex`, con `admin.qa@empresa.test`. El entorno se heredó de un wrapper con `process.loadEnvFile`, sin copiar el `.env` ni imprimir valores. No se corrió ningún seed y la contraseña coincidió.

**La saldada.** `cierre_bodega` estaba vacía, así que no había fila que modificar: se insertó una sola, de una bodega satélite, con `monto_recibido = esperado_regla_anterior = 64000`, y se borró por id en un `finally`.

| Pantalla | Lo que dio el DOM |
| --- | --- |
| Ayuda, `/ayuda/oficina/wallet-satelites` | La sección termina en «Esa fila no ofrece ningún botón, ni Corregir ni Desmarcar: su monto no se puede cambiar desde la pantalla.». No queda la frase vieja. |
| `/wallet/satelites/[zonaId]`, con «Todas» | La fila lleva el rótulo «Saldada con la regla anterior», Debe ₡64.000, Monto recibido ₡64.000, Falta por recibir ₡0 y estado «Recibido». Botones y enlaces en la fila: `[]`. |
| `/cierres-admin`, Bodega → Resueltos → detalle | La sección «Conciliación del cierre de bodega» está montada, y eso solo pasa con `puedeConciliar`, pero sale vacía: `innerText` `""`, botones `[]`. En todo el diálogo solo está «Cerrar». |

Sin respuestas 5xx en la pasada final.

**Límite de esta prueba.** No hubo fila de control con botón en el navegador: la consigna era una sola fila. La fila de control está en «503/R4». En `/cierres-admin`, el indicio de que el actor puede conciliar es que la sección se monta.

**Capturas**, fuera del repo, en el scratchpad de la sesión, carpeta `t6/`: `ayuda.png`, `region-conciliacion.png` (contiene la fila; la captura suelta de la fila salió recortada y se descartó), `cierres-admin-detalle.png` y `cierres-admin-seccion.png`.

**La base quedó restaurada.** Hubo 5 pasadas con fila insertada o login (las fallidas, por selectores de la sonda, no por la app); cada fila insertada se borró.

- `cierre_bodega`: 0 filas al terminar, igual que al empezar.
- Conteo de todas las tablas de `public`, antes y después de la pasada final: sin diferencias.
- `Session` y `login_attempt`: 1073 y 1154, las cifras previas. Los del login propio se borraron por id; los de la primera pasada, por ser los más recientes de la cuenta.
- `zona.sinpe_*`: sin cambios. El aviso «Confirmá el SINPE» se cerró con «Ahora no».
- `usuario.updated_at` de la cuenta sigue en 2026-11-05: el login no la tocó.
- Lo que NO se comparó: el resto de columnas de filas ya existentes. Se comprobaron conteos, no contenido.

**Dev server.** Parado, sin nada escuchando en el 3503, y `.next/dev` borrado.

## Hallazgos de T6, fuera de alcance

- **Turbopack no arranca en un worktree con junction:** `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. Se usó `next dev --webpack`, sin cambiar configuración.
- **Región vacía en `/cierres-admin`:** con una saldada, la sección con nombre accesible queda sin contenido. Es lo que el comentario de `CierresBodegaAdminModule.tsx:878-880` quiere evitar para el caso sin permiso. La ficha no cambia la pantalla, así que no se tocó.
- **La nota de 498/R43 sigue al pie de esa tabla**, «usa «Corregir»», justo debajo de una fila sin ese botón. Ya está fuera de alcance por el spec.

## Mapa R -> test

| R | Test | Estado |
| --- | --- | --- |
| R1 | `ayuda-wallet-satelites-498.test.ts:111`, «R1 — dice que la fila no ofrece ningún botón…» | Verde; rojo con M1 |
| R2 | `ayuda-wallet-satelites-498.test.ts:115`, «R2 — no promete arreglarla con «Corregir»» (2 patrones) | Verde; rojo con M1 |
| R3 | `ayuda-wallet-satelites-498.test.ts:119`, «R3 — sigue diciendo» (3 patrones) | Verde; sin mutación propia |
| R4 | `Conciliacion498.test.tsx:467`, «503/R4 — una saldada sin corregir…» | Verde; rojo con M2 y M3 |
| R5 | `ConciliacionAcciones500.test.tsx:71-76` | Verde; rojo con M2 |
| R5 (valor del servidor) | `500-con-dinero-sql-real.test.ts:257` y `:275-276` | Verde en la corrida del leader con Postgres; saltado en la mía |

## Salida de los tests

`pnpm typecheck`: exit 0. `pnpm lint`: exit 0, 0 errores y 236 warnings.

Contra la ayuda anterior a T3 (T1): 3 rojos, R1 y los dos de R2; R3 y la autocomprobación verdes.

```
Test Files  1 failed (1)
     Tests  3 failed | 27 passed (30)
```

Árbol final, con los dos archivos tocados, `ConciliacionAcciones500`, el de Postgres y los que leen esta ayuda
(`wallet-barra-unica-467.guardia`, `aporte-satelite-fuente-unica-498.guardia`, `acotamiento-por-rol`,
`contexto-documental`, `contexto-458`, `AyudaBoton`):

```
Test Files  9 passed | 1 skipped (10)
     Tests  196 passed | 9 skipped (205)
```

Los 9 saltados son los del archivo de Postgres en mi corrida, antes de T5:

```
Test Files  1 skipped (1)
     Tests  9 skipped (9)
```

## Mutaciones

Una a una, sobre el commit `627f95393`, con tests ejecutados de verdad y revertidas con `git checkout`. La columna «Blob» compara `git hash-object` con `HEAD:<archivo>`.

| Id | Mutación | Rojos | Blob tras revertir |
| --- | --- | --- | --- |
| M1 | Reponer la frase vieja en la ayuda | R1 y los dos de R2 (3 failed, 27 passed) | `63db0c20` = HEAD |
| M2 | `esCorreccion = estado !== "pendiente"` en `ConciliacionAcciones.tsx` | «503/R4» (`Conciliacion498.test.tsx:495`, 1 botón en la fila) y `ConciliacionAcciones500.test.tsx:75` | `490ae962` = HEAD |
| M3 | `puedeDesmarcar={true}` en `ConciliacionSatelite.tsx:345` | «503/R4» (`:495`) y dos ajenos que ya la vigilaban, `502/R7` (`:428`) y `500/R3` (`:456`) | `d0444cac` = HEAD |

M1 solo se corrió contra `ayuda-wallet-satelites-498.test.ts`, el archivo de esta ficha que fija el texto.

## Autocomprobación y CRLF

- Sembrar la frase vieja en la sección casa con los dos patrones de R2; quitar la nueva deja de casar con R1.
- Un «usa Corregir» de otra sección no cuenta contra R2: el recorte acaba en el siguiente `## `. Por eso no se tropieza con `wallet-satelites.md:112`, fuera de alcance.
- El recorte normaliza CRLF: la ayuda pasada a CRLF da la misma sección, y R1 casa con la frase partida en CRLF.
- No se importa nada de `components/`: los literales van escritos a mano.

## Notas

- La frase es la de `design.md` §1 tal cual; el salto de línea cae entre «ni» y «**Desmarcar**», y el patrón usa `\s+`.
- `origin/dev` ya está integrado en la rama: lo hizo el leader en `3aa551e9f`.

## Gate del leader

`./init.sh --rapido` sobre 92b423eea: `INIT_EXIT=0`, 3947 passed en unitarios y guardias, sin intermitentes.
