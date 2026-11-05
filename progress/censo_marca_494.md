# 494 — Censo final de la marca retirada

> Emitido por `tests/fixtures/marca-sin-ordenex-494.ts` (`pnpm exec tsx … censo`) sobre `c9cd9e86`, con el mismo código que juzga la guardia. Sin valores: el repo es público.
> El censo de partida y los de cada tanda están en el historial de este archivo.

**Fuera de excepciones: 0 apariciones.**

## Lo que se queda, por excepción

Se cuenta la cadena en lo versionado, sin distinguir mayúsculas. E2 sube sola: incluye este archivo y la bitácora.

| Id | Motivo | Archivos | Apariciones |
| --- | --- | --- | --- |
| E1 | Fuera del arbol. Fotos historicas: editarlas es drift. | 25 | 36 |
| E2 | Fuera del arbol. Registros historicos. | 1057 | 435316 |
| E3 | Fuera del arbol. Nombre del proyecto en el MCP, derivado de la carpeta local. | 6 | 8 |
| E4 | Nombre real de la base local: esos scripts abortan si no coincide, y es lo que evita que escriban en prod. | 4 | 17 |
| E5 | La clave vieja del navegador hay que poder leerla. Se retira con design §5.6. | 3 | 48 |
| E5.2 | El modulo unico de las claves viejas del navegador (R20). Se retira con design §5.6. | 1 | 10 |
| E5.1 | Alias de relevo del service worker (R21, R22) y los tests que los afirman. Se retiran con design §5.6. | 3 | 11 |
| E6 | Hace falta para pasar la cuenta QA al correo nuevo (R29). | 2 | 12 |
| E7 | Definen lo prohibido y sus contrapruebas. | 5 | 140 |
| E8 | Negativas: afirman que lo viejo no esta. | 2 | 8 |

Fuera del árbol por motivo propio (`design.md §7`): `.design-work/**` y `design-*/`, borradores que no se ejecutan.
