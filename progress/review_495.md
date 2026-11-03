# 495 — Fechas de cierre en hora de Costa Rica · revisión

> Reviewer, 2026-11-02. Worktree `wt-495`, rama `fix/495-fechas-cierre-hora-cr`, HEAD revisado
> `b99020e4` (7 commits sobre `f0833d64`). Búsqueda de sitios: lectura del diff y `grep` sobre las
> tres carpetas y sobre `app/ components/ lib/` (el MCP `codebase-memory` no se usó: la revisión es
> de un diff acotado y los barridos son de texto plano).

## Veredicto: **APROBADO** (condicionado a cerrar T7)

Sin bloqueantes en el código ni en la trazabilidad. Queda **T7 sin marcar**: el `--rapido`
(`progress/gate_495_1.log`) termina `INIT_EXIT=1` por 4 archivos de `integration/db` de
geografía/zonas (`Unique constraint failed` en `zonaDistrito`), causa ajena (índice único de la
ficha 499 aplicado a la base local compartida). No se cuentan contra la 495; la ficha no pasa a
`done` hasta repetir el `--rapido` en verde tras mergear la 499 y marcar T7.

## Checklist

### Especificación
- [x] `requirements.md` con R1–R13 en EARS (R10–R13 = ampliación a `/incidentes`, commiteada en
      `74e916ad` antes de tocar código).
- [x] `design.md` con alternativas descartadas (§5, A1–A5).
- [ ] `tasks.md` todo `[x]`: **T7 abierta** (gate rojo por causa ajena, ver arriba). T8 marcada `[x]`
      con «ver la app» declarado inaplicable (ver hallazgo m5).

### Trazabilidad (corrida propia, aislada)
`pnpm exec vitest run` de 12 archivos (los 5 nuevos/tocados + `CierreFacturaPapel`,
`IncidentesAdminModule`, `incidentes-descarga-columnas`, `cierres-admin-descarga-columnas`,
`cierres-gestiones-fundida-descarga-columnas`, guardias 459 y 495): **12/12 archivos, 219/219 tests,
exit 0**.

| R | Test | Aserción real |
|---|---|---|
| R1 | `tests/components/cierres-fechas-cr-495.test.tsx` «R1» | sí: tarjeta/hoja y comprobante en papel `Solicitado 2026-10-31 · Resuelto 2026-10-31`, y `not.toContain("2026-11-01")` |
| R2 | mismo, «R2» | sí: Solicitado, Resuelto y «Conciliado el» = `2026-10-31` por línea |
| R3 | mismo, «R3» + `CierreDiaModule.test.tsx` «Ficha 495» | sí: nombre accesible, hoja, botón «Ver del cierre del 2026-10-31» (y el de `-11-01` ausente), descripción del diálogo `· 2026-10-31 ·` |
| R4 | `tests/unit/descarga/cierres-fechas-cr-495.test.ts` | sí: las 7 proyecciones = `2026-10-31`; las fechas-día de la fundida (`fechaGestion`, `diaReparto`, `fechaCreacionOrden`) intactas |
| R5 | mismo literal `2026-10-31` en pantalla y descarga | sí (literal, no uno contra otro) |
| R6 | `tests/unit/utils/fecha-dia-iso.test.ts` | sí: `05:03Z`→`10-31`, `05:59:59.999Z`→`10-31`, `00:00:00.000Z`→`10-31`, `06:00Z`→`11-01`, `23:59Z`→`11-01` |
| R7 | componentes «R7» (2) + descarga «R7» | sí: sin pieza «Resuelto»/«Conciliado el», sin `NaN`/`Invalid Date`; `fechaResuelta` = `null` |
| R8 | `fecha-dia-iso.test.ts` «R8» | sí: `""` y `"pendiente"` tal cual; `columnas-sensibles.guardia` sin tocar |
| R9 | `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts` | sí: contraprueba con las 5 formas + `?.slice`, línea correcta con CRLF, comentario y forma nueva no saltan; `revisados > 30` |
| R10 | `tests/components/incidentes-fechas-cr-495.test.tsx` «R10» | sí: cola, histórico, «Reportado el» y «Resuelto por … · 2026-10-31» con `toBe` exacto |
| R11 | descarga «R11/R12» | sí: `fecha` y `fechaResuelta` = `2026-10-31` |
| R12 | incidentes «R12» + descarga | sí: celda localizada por encabezado = «—» (reforzado tras una mutación superviviente), detalle sin «· fecha», descarga `null` |
| R13 | guardia «revisa archivos de las tres carpetas» | sí: `CARPETAS` literal con `incidentes` y >0 archivos por carpeta |

- [x] `progress/impl_495.md` contiene el mapa R → test y las contrapruebas por mutación (16 filas,
      incluidas dos supervivientes explicadas: una reforzada, otra equivalente).
- [x] Sin aserciones contra su propia fuente: todos los esperados son literales (`DIA_CR =
      "2026-10-31"`); ningún test compara contra `fechaCalendarioCR`/`fechaDiaInstanteCR`.
- [x] Sin tests borrados ni debilitados: el diff en `tests/` es solo de adiciones.

### Sitios (punto 2 del encargo)
- [x] S1–S7 e I1–I5 cambiados; el barrido propio en las tres carpetas no encuentra más recortes
      (`slice(0, 10)`, `substring`, `split("T")`, `fechaDiaISO`, `toLocale*`, `toISOString`). Las
      demás lecturas de `solicitadoAt`/`resueltoAt`/`conciliadoAt` son paso de props hacia `fecha()`
      o ya usaban `fechaCalendarioCR` (`CierresBodegaAdminModule.tsx:881`, `cierre-factura.tsx:2239`).

### Utilidad (punto 3)
- [x] `fechaDiaInstanteCR` delega el cálculo en `fechaCalendarioCR`; sin rama de medianoche
      (correcto para `timestamp`); lo no legible cae a `fechaDiaISO` (tal cual). Pantalla y descarga
      importan la misma función en los 9 archivos.
- [x] Nulos: los manejan los llamadores (`iso ? … : "—"` / `=== null ? null`); la firma es `string`,
      así que un `Date` no compila (no hace falta caso).

### Calidad de código / gate
- [x] typecheck y lint verdes (log del gate); 0 errores de lint, solo warnings preexistentes.
- [ ] `--rapido` verde: **no** (4 rojos ajenos, ver veredicto). Los intermitentes del log
      (`ajuste-caja-anulacion-461`, `liquidacion-reparto-migration`, etc.) pasaron aislados.
- [x] E2E: no aplica (no es flujo crítico; solo formato de fecha).

### Datos, seguridad, capas, permisos
- [x] Sin tablas, migraciones, webhooks, secretos ni cambios de capa. Solo `app/` (presentación) y
      una función pura nueva en `lib/utils/`.
- [~] Multi-país: la zona horaria de Costa Rica está fija, pero es la convención ya existente
      (`fechaCalendarioCR`) y el spec lo declara así. Ver m6.

## Hallazgos

Ningún **BLOQUEANTE**.

- **m1 (menor) — La guardia se puede esquivar de formas obvias.** Las regex no ven: un import con
  alias (`import { fechaDiaISO as dia }` y luego `dia(x)`), `split(/T/)`, `slice(0, LARGO)` con
  constante, un `.match` con la regex de fecha, `toLocaleDateString()`/`Intl.DateTimeFormat` sin
  `timeZone`, ni `fechaDiaMovimientoCR` (que trata la medianoche UTC exacta como día). Tampoco mira
  componentes compartidos fuera de las tres carpetas. Es aceptable para una ficha `small` y cumple
  R9/R13 tal como están escritos; endurecerla (p. ej. prohibir también el import de `fechaDiaISO` y
  `fechaDiaMovimientoCR` en estas carpetas) sería una mejora barata.
- **m2 (menor, fuera de alcance) — Mismo patrón fuera de estas carpetas.**
  `components/shared/liquidacion/PagosRegistradosTabla.tsx:65` y
  `pagos-registrados-descarga-columnas.ts:65,71,74` pasan `registradoAt`/`anuladoAt`/`fechaPago`
  por `fechaDiaISO`. No verifiqué si son `timestamp` o `@db.Date` (172 usa medianoche UTC); si
  `registradoAt`/`anuladoAt` son instantes, tienen el mismo defecto. Candidato a ficha aparte.
- **m3 (menor) — Dos caminos para el mismo cálculo.** `CierresBodegaAdminModule.tsx:881` sigue con
  `fechaCalendarioCR(new Date(...))` en vez de `fechaDiaInstanteCR`. Mismo resultado para entradas
  válidas; el spec lo dejó fuera a propósito. Solo coherencia.
- **m4 (menor) — Entrada no-instante con forma de fecha.** `fechaDiaInstanteCR("2026-11-01")` (día
  sin hora) devuelve `2026-10-31`, y un ISO sin `Z` se parsearía en hora local. Ningún llamador
  actual pasa eso (todos son `timestamp` serializados con `Z`) y el JSDoc delimita el uso; anotado
  para quien la reutilice.
- **m5 (menor) — T8 «ver la app» no hecho.** Los tests de componente renderizan los componentes
  reales (tarjetas, comprobante en papel, botón y diálogo de `CierreDiaModule`, tabla y detalle de
  incidentes) con un instante de las 23:03 CR y aserciones exactas; el cambio es de formato puro con
  una función ya probada. Valoración: la cobertura basta y no es bloqueante. Recomendado un vistazo
  a `/cierres-admin` y `/incidentes` en preview antes de la release.
- **m6 (menor) — Zona horaria fija.** Costa Rica UTC−6 fijo vía `fechaCalendarioCR`: convención
  previa del repo, no introducida aquí. Relevante solo para el SaaS multi-país derivado.
- **m7 (menor) — Desvío textual del spec.** R3 dice «Ver detalle del cierre del …»; el nombre real
  es «Ver del cierre del …» (`VER_DETALLE_LABEL = "Ver"`). El test afirma el texto real y el informe
  lo anota. Conviene corregir el spec.
- **m8 (menor) — Diagnóstico del gate en el informe.** `impl_495.md` atribuye los 4 rojos a «filas
  residuales»; la causa conocida es el índice único de la 499 en la base compartida. No cambia
  nada de la 495, pero al cerrar T7 conviene dejar la causa correcta en el informe.

## Para cerrar la ficha

1. Tras mergear la 499 (o con la base local sin su índice), repetir `./init.sh --rapido` con
   `INIT_EXIT` dentro del log; confirmar sin `skipped` inesperados y marcar T7.
2. Opcional: m1 (endurecer la guardia) y m2 (ficha aparte para liquidación).
