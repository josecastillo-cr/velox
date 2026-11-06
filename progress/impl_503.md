# Ficha 503 — Implementación

Rama `fix/503-ayuda-satelites-saldadas`, worktree `R:/w503`. Búsqueda con Grep/Read: `codebase-memory-mcp` no conectó.
Q1 = A: la frase dice solo el hecho, sin responsable.

## Archivos tocados

- `docs/ayuda/oficina/wallet-satelites.md`: la frase de la sección «Saldada con la regla anterior» y `actualizado: 2026-11-06`.
- `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`: bloques «503» y «503 — AUTOCOMPROBACION».
- `tests/components/Conciliacion498.test.tsx`: caso «503/R4», con fila de control.
- `specs/503-ayuda-satelites-saldadas/tasks.md`: T0 a T4 marcadas.

La pantalla no cambia. `git status` no muestra restos en `components/` ni `app/`.

## Lo que queda sin hacer

| Tarea | Estado | Motivo |
| --- | --- | --- |
| T5, parte Postgres | **No ejecutada** | `500-con-dinero-sql-real.test.ts` da `9 skipped`: el worktree no tiene `.env` ni `DATABASE_URL`. `init.sh` dice que no se copie el `.env`, y no se intentó sacar el valor del `.env` del checkout principal, fuera del alcance dado. El archivo no cambia. |
| T5, parte componente | Verde | `ConciliacionAcciones500.test.tsx`, dentro de la corrida de abajo. |
| T6 | **No ejecutada** | Ver la app pide dev server y base local, y este worktree no tiene base. No se ha visto la frase ni la fila en un navegador. |
| T7 | Parcial | El mapa está abajo. El gate lo corre el leader. |

Para cerrar T5, con `DATABASE_URL` en la sesión: `pnpm exec vitest run tests/integration/db/500-con-dinero-sql-real.test.ts`, y debe dar 9 passed, no `skipped`. El respaldo real de `puedeDesmarcar: false` en una saldada (R4 y R5) depende de esa corrida.

## Mapa R -> test

| R | Test | Estado |
| --- | --- | --- |
| R1 | `ayuda-wallet-satelites-498.test.ts:111`, «R1 — dice que la fila no ofrece ningún botón…» | Verde; rojo con M1 |
| R2 | `ayuda-wallet-satelites-498.test.ts:115`, «R2 — no promete arreglarla con «Corregir»» (2 patrones) | Verde; rojo con M1 |
| R3 | `ayuda-wallet-satelites-498.test.ts:119`, «R3 — sigue diciendo» (3 patrones) | Verde; sin mutación propia |
| R4 | `Conciliacion498.test.tsx:467`, «503/R4 — una saldada sin corregir…» | Verde; rojo con M2 y M3 |
| R5 | `ConciliacionAcciones500.test.tsx:71-76` | Verde; rojo con M2 |
| R5 (valor del servidor) | `500-con-dinero-sql-real.test.ts:257` y `:275-276` | **Saltado en este worktree** |

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

Los 9 saltados son los del archivo de Postgres:

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
- Al commitear, `origin/dev` llevaba 1 commit de ventaja sobre la rama: no se ha integrado.
