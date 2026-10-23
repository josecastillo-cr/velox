# Revisión — Ficha 488 «La ganancia de la caja, sin IVA»

- **Rama:** `feat/488-ganancia-caja-sin-iva` · **HEAD revisado:** `9b26268f` · **base:** `4f87ca86` (dev)
- **Revisor:** reviewer (2026-10-22). Sin cambios de código; solo este informe.
- **Búsqueda:** para esta revisión usé `grep` y la lectura directa de cada archivo del diff, no el grafo
  `codebase-memory`. Todo símbolo citado está comprobado en el archivo real.

## Veredicto: **RECHAZADO**

El código está bien hecho y medido. Las razones del rechazo están en el proceso y en la verificación
pedida por el propio spec (2 bloqueantes, abajo). Ninguna exige cambiar la derivación ni los tests.

---

## Checklist

### Especificación
- [x] `requirements.md`: R1–R38 en EARS, numerados.
- [x] `design.md`: alternativas descartadas A1–A6 con su motivo (§12).
- [ ] `tasks.md` con todas las tasks `[x]`: **0 de 21** marcadas (B.0–B.11, F.1–F.9). L.1 es del leader,
      antes de desplegar. → **BLOQUEANTE 1**.

### Trazabilidad (R → test que lo ejerce de verdad)
Corrí yo los 64 archivos de test del diff: **64/64 archivos, 1200/1200 tests, 0 skipped** (integración
contra Postgres incluida).

| R | Test que lo ejerce (comprobado) |
| --- | --- |
| R1 | `tests/unit/utils/caja-tesoreria.test.ts` «R1: los SEIS movimientos de IVA…» + «R1/R22 … EFECTIVO»; `metrics-caja-naturaleza.guardia` |
| R2, R3, R6 | `caja-tesoreria.test.ts` «R2/R3/R6» + `tests/integration/db/caja-iva-488.test.ts:390` (§1, Postgres) |
| R4, R5 | `caja-tesoreria.test.ts` «R4/R5» y «R4 (P3)» + `caja-iva-488.test.ts:390`, `:505` (ivaCobrado Δ0 al pagar), `:550` (Δ0 al anular) |
| R7 | `caja-tesoreria.test.ts` «R7 … TODO el catalogo»; `caja-derivacion-457/459/461` (500 conjuntos); `caja-iva-488.test.ts:410` |
| R8 | `caja-iva-488.test.ts:364` (B.0). **Comprobé que el bloque y su siembra son idénticos a los de `510b4155`** (verde sobre dev) |
| R9 | `caja-iva-488.test.ts:437` (periodo), `:463` (concepto), `:478` («A quién») |
| R10 | `caja-tesoreria.test.ts` «R10»; `caja-iva-488.test.ts:491`; `caja-caracterizacion-459`, `wallet-anulacion-458`, `caja-invariante-tiendas` |
| R11, R12, R13 | `tests/components/CajaResumenCard488.test.tsx` (cifra `.text-2xl`, línea `text-xs` tras la cifra dentro de la región, bolsillo en 4 variantes de estado y filtros, signo negativo y cero) |
| R14, R16 | `caja-tesoreria.test.ts` (tabla de la barra, 4 modos × I>0/I=0/I<0) + `tests/components/BarraComposicionCaja488.test.tsx` |
| R15 | `BarraComposicionCaja488.test.tsx:145` + `wallet-labels.test.ts` «R15» |
| R17, R18, R38 | `tests/unit/components/wallet-labels.test.ts` (bloque 488; detector de siglas con autocomprobación) |
| R19 | `caja-tesoreria.test.ts` «T B.5 … R19»; `caja-iva-488.test.ts:420`; `tests/components/ComposicionGananciaCard.test.tsx` |
| R20 | `tests/unit/actions/wallet-actions.test.ts` «ficha 488 / R20» (6 tokens → `validation_error`, servicio no llamado, control `ingreso_flete` ok) |
| R21 | `wallet-conceptos-manuales.test.ts` «FICHA 488»; `wallet-registrar-movimiento-dialog.test.tsx` «488 — el Pago de IVA» |
| R22, R23, R27, R28 | `caja-iva-488.test.ts:505`, `:530`, `:542`/`:584`, `:537`; `wallet-anulacion-service.test.ts` «488/R27» |
| R24 | `efecto-movimiento.test.ts` «488/R24»; `caja-iva-488.test.ts:592`; `wallet-registrar-movimiento-dialog.test.tsx` «R24» |
| R25, R26 | `caja-iva-488.test.ts:550`, `:574` (el WHERE), `:579`; `wallet-anulacion-service.test.ts` «488/R25», «488/R26», por concepto |
| R29 | `tests/components/WalletLedgerIva488.test.tsx` (celda, conceptos y `filaBaseCaja` de la descarga); `libro-kardex-468.test.ts` |
| R30 | `tests/integration/db/como-quedo.test.ts` «488/R30» + `tests/components/DetalleMovimientoPanel.test.tsx` |
| R31, R32 | `metrics-caja-naturaleza.guardia` (listas y descripciones) + `caja-iva-488.test.ts:605`, `:611` |
| R33 | `finanzas-diario.test.ts` «488/R33» + `caja-iva-488.test.ts:620` |
| R34 | `caja-tesoreria.test.ts` «R34»; `caja-iva-488.test.ts:428`; barrido «todo STRING» de `tests/integration/wallet-page.test.tsx` |
| R35, R36 | `tests/integration/db/iva-488-migration.test.ts` (casos b, b-bis, d, d-bis, e ejecutado contra Postgres, f) |
| R37 | `tests/unit/docs/ayuda-wallet-caja-488.test.ts` |

- [x] Cada R1–R38 tiene al menos un test que lo ejerce.
- [~] El mapa R → test existe, pero repartido entre `progress/dev_488_backend.md` y `progress/dev_488_frontend.md`.
      No existe `progress/impl_488.md`, que piden tasks B.10/B.11/F.8/F.9 y `CHECKPOINTS.md`. → menor m6.

### Mutaciones que corrí yo (todas revertidas; `git status` limpio tras cada una)
| Mutación | Resultado |
| --- | --- |
| Volver al design: `ivaCobrado = derivarBalance(ingresosIva, …)` | ROJO: «R4/R5» de `caja-tesoreria.test.ts` |
| `egreso_reverso_iva_flete_devolucion: "propio"` | ROJO: 3 casos (R1, R4/R5, R10) |
| Barra: segmentos con IVA siempre (ignora `signoIvaPorPagar`) | ROJO: 17 casos (R16 y «el signo manda») |
| m3: el WHERE de `estadoDeDocumentos` vuelve a solo `"ingreso_ajuste"` | ROJO contra Postgres: `caja-iva-488.test.ts:574` |
| m2: contra-asiento siempre `ingreso_ajuste` | ROJO contra Postgres: `caja-iva-488.test.ts:550` |

### Calidad de código
- [x] `pnpm run typecheck`: lo corrí sobre HEAD y sale verde.
- [x] `eslint` sobre los archivos del diff: 0 errores (1 warning).
- [x] Tests: 64/64 archivos del diff verdes, sin skipped. El gate `./init.sh --rapido` AMPLIADO de
      `progress/gate_488_frontend.log` termina con `INIT_EXIT=0`. Sus 4 rojos de `integration/db` salieron
      verdes aislados (58/58), así que son intermitentes y ninguno toca la caja. El log terminó a las 20:11:59
      y el commit es de las 20:12:48. No corrí el completo.
- [n/a] E2E: no hay harness (memoria del proyecto). El riesgo lo cubre la integración contra Postgres
      por las Server Actions reales.

### Datos y seguridad
- [x] No hay tablas nuevas, así que no aplica RLS.
- [x] Migraciones versionadas con `down.sql`.
  - El `down` de la 1 lleva la función de la 458-B byte a byte (comprobado con `diff`, solo cambia el
    sufijo). Lee `pg_enum` y aborta si algún valor está en uso: **no borra valores de enum posteriores**.
  - El `down` de la 2 aborta con RAISE si hay filas y devuelve el CHECK a la lista **exacta** de la 458-B,
    que es el último CHECK previo (comprobado contra `20260928120100_wallet_458_tablas/migration.sql:110-126`).
  - **Ningún `down.sql` previo se tocó**: el diff de `db/migrations` contra `4f87ca86` muestra solo
    las dos carpetas nuevas.
  - Los timestamps `20261023…` son posteriores al último de `origin/dev` (`20261021120000`).
- [x] Sin secretos. Sin webhooks nuevos.

### Capas y permisos
- [x] Repositorio = solo query (el `in` sale de una constante de `lib/utils`). Servicio sin HTTP.
- [x] No hay Server Actions nuevas: se reutilizan `registrarEgresoAdministrativoAction` y
      `anularMovimientoAction`/`anularEgresoCajaAction`. `esAccesoTotal` va primero; R27 está medido contra
      Postgres, en el registro y en la anulación.
- [x] Contexto: «Hacienda» aparece en textos aprobados por el humano (P5). No hay país, moneda ni cuenta
      hardcodeados en lógica.

### Puntos pedidos por el leader
1. **Trazabilidad:** completa (tabla de arriba).
2. **Desviación `cargosIva`:**
   - Cumple R5. El IVA cobrado sale de los ingresos `iva` con liquidez «cargo» (los tres IVA) menos los
     egresos `iva` con liquidez «cargo» (el reverso del IVA de la 458-B). El Pago de IVA y su anulación son
     `efectivo` y quedan fuera.
   - Medido contra Postgres: Δ IVA cobrado = 0 al pagar y al anular. Mi mutación «volver al design» lo
     pone rojo.
   - Siguen siendo seis `derivarBalance`, sin `.sub(`.
   - **Pero el spec queda contradicho**: la desviación solo se anotó en la bitácora → menor m1.
3. **Literales reescritos de fichas previas:** los revisé uno a uno (457, 458-B, 459, 461, analítica,
   finanzas diarias, efecto, cómo quedó, censos de migración).
   - **Todos los cambios son la consecuencia del IVA fuera de la ganancia:**
     - la ganancia, los ingresos propios, «De Ordenex» y la composición bajan exactamente el IVA del
       escenario (1 492,21; 928 499,43 en M6; 390; 130; 39);
     - R7 gana el cuarto sumando;
     - la anulación del cobro por devolución baja la ganancia 1 000 y no 1 130;
     - `porcentajeTiendas` 100,00 → 95,76 con I > 0 (aritmética comprobada);
     - los censos de enum se desplazan 2 posiciones y los conteos pasan de 27 a 29, de 10 a 12 y de 18 a 14.
   - **Las cifras que no debían moverse siguen iguales en todos los archivos**: cifra principal, «Entró»,
     «Salió», «De las tiendas» y capital. Por ejemplo, `3511.00`, `-4776583.97`, `-9182220.50`,
     `-9186220.50` y `14175.82` se conservan, y el B.0 está intacto.
   - No encontré ninguna regresión tapada.
4. **Migraciones:** correctas (ver Datos y seguridad).
5. **Anulación del Pago de IVA y dinero:**
   - Escribe `ingreso_reverso_pago_iva` (dueño `iva`). La ganancia queda en Δ0, medido contra Postgres.
   - Todo el cálculo va en `Prisma.Decimal`, y los importes nuevos del DTO viajan como STRING de escala 2.
6. **UI:**
   - La tarjeta, la barra (3 bolsillos; con I ≤ 0 el árbol es idéntico al de antes), el bolsillo
     «IVA por pagar», la línea «IVA cobrado a las tiendas: ₡X» en `text-xs`, «Así queda», «Cómo quedó»,
     el libro y la descarga cumplen el spec en jsdom.
   - Los textos coinciden literalmente con design §6.
   - **No se vio en el navegador lo que F.8 exige** → BLOQUEANTE 2. Hay además dos textos mejorables
     (m3, m4).

---

## Hallazgos

### BLOQUEANTE 1 — `tasks.md` sin marcar
`specs/488-ganancia-caja-sin-iva/tasks.md:11-125`: las 21 tareas B.0–B.11 y F.1–F.9 siguen en `[ ]`.
`CHECKPOINTS.md:9` exige todas en `[x]`. Las bitácoras dan B.* y F.1–F.7/F.9 por hechas, y lo comprobé:
hay que marcarlas. **F.8 no se puede marcar honestamente** (bloqueante 2). L.1 es del leader y puede
quedar abierta, anotada como pre-despliegue.

### BLOQUEANTE 2 — F.8 «Ver la app» no cumplida
El *Hecho* de `specs/488-ganancia-caja-sin-iva/tasks.md:120-123` pide, en el dev server y como maestro:
- `/wallet` con un periodo;
- **registrar un Pago de IVA y anularlo**;
- mirar el «Así queda», **la barra en «saldo»**, el libro y la descarga;
- dejar capturas y números en `progress/impl_488.md`.

`progress/dev_488_frontend.md:61-62` lo reconoce: «Sin barra (no hay saldo inicial en local). No registré
ni anulé un Pago de IVA en la app». Lo único que se vio fue la tarjeta en «flujo» sin filtros. Quedan sin
ver en pantalla:
- la porción del IVA y el nombre accesible de la barra (R14–R16);
- el concepto nuevo en el diálogo y su «Así queda» (R21, R24);
- el «Anulado» del libro tras anular (R25);
- la columna «Es dinero de» en la descarga (R29).

Para cumplirlo:
1. En la base LOCAL (`prisma migrate status` → localhost), registrar un aporte o saldo inicial para tener
   estado «saldo».
2. Registrar un Pago de IVA desde el diálogo, anularlo con motivo y descargar el libro.
3. Anotar los números comparados con `verResumenCaja` en `progress/impl_488.md`.

### menor m1 — El design sigue diciendo la fórmula que se descartó
`specs/488-ganancia-caja-sin-iva/design.md:83-92` (§2.2) y `:244` (§5.1) siguen diciendo
`ivaCobrado = derivarBalance(ingresosIva, reversosIvaCobrado)`, con tres cubetas. El código usa
`cargosIva` (`lib/utils/caja-tesoreria.ts:246-251`, `:396`), y es lo correcto: la fórmula del design viola
R5. La desviación solo está en `progress/dev_488_backend.md:24-31`. Falta una nota en design §2.2 y §5.1
(«enmienda de implementación: + `cargosIva`; motivo R5») para que el spec no contradiga al código.

### menor m2 — Una tercera lista propia de contra-asientos de egreso
`lib/repositories/WalletComprobanteRepository.ts:146` (`estaAnulado`, camino `egreso_caja`) sigue buscando
solo `categoria: "ingreso_ajuste"`. Hoy no tiene efecto: la anulación con motivo escribe siempre la
constancia `ajuste_caja_anulacion`, que es su segunda consulta. Aun así contradice el principio que la
propia ficha declara en `lib/utils/egreso-anulable.ts:25-32` («Es LA lista… si quien busca tuviera una
lista propia, el Pago de IVA anulado se leería vigente»). Debería usar
`CATEGORIAS_DE_CONTRA_ASIENTO_DE_EGRESO`. También quedaron obsoletos los comentarios de
`lib/interfaces/repositories/IWalletComprobanteRepository.ts:60` y
`lib/interfaces/services/IEgresoCajaAnulacionService.ts:12`.

### menor m3 — El origen de un Pago de IVA dice «Gasto o sueldo registrado a mano»
`lib/services/OrigenLegibleService.ts:123-133` (`textoDeGasto`) no tiene un caso para `egreso_pago_iva`.
Cae al rótulo genérico `ORIGEN_LABEL.gasto` = «Gasto o sueldo registrado a mano»
(`lib/constants/wallet-rotulos.ts:84`). En el libro, el origen de un Pago de IVA (y de su anulación) dice
que es un gasto o un sueldo, y no es ninguna de las dos cosas. El concepto sí se nombra bien (R29). Para
que el texto sea claro (R38), conviene un caso `egreso_pago_iva` con rótulo propio.

### menor m4 — En la ayuda, una frase quedó en el párrafo equivocado
`docs/ayuda/oficina/wallet-caja.md:408-410`: «Los que se revirtieron antes, sin motivo, se ven Anulado ·
motivo no registrado» se refería a los gastos y sueldos revertidos antes de la 458-B (párrafo `:405-406`).
Ahora cierra el párrafo del Pago de IVA, donde no hay ninguno revertido «antes». Hay que devolverla al
párrafo `:405-406`.

### menor m5 — Contraseñas QA rotadas en la base local compartida
`progress/dev_488_frontend.md:52-54`: frontend_dev rotó las contraseñas de las 4 cuentas QA de la base
LOCAL para poder entrar. Otra sesión que las use perderá el login sin aviso. Hay que avisar al leader o
restaurarlas con `seed-usuarios-qa.ts`.

### menor m6 — `progress/impl_488.md` no existe
`CHECKPOINTS.md:13` y tasks B.10/B.11/F.8/F.9 lo piden. El mapa R→test y las mutaciones están, pero
partidos entre `progress/dev_488_backend.md:44-81` y `progress/dev_488_frontend.md:35-48`. Basta con
crear `impl_488.md` que una los dos mapas y lleve la evidencia de F.8.

---

## Para pasar a OK
1. Cumplir F.8 en el navegador y anotar los números en `progress/impl_488.md` (BLOQUEANTE 2 y m6).
2. Marcar `[x]` B.0–B.11 y F.1–F.9 en `tasks.md` (BLOQUEANTE 1).
3. Los menores m1–m5 son recomendables y no bloquean. m1 (nota en el design) y m4 (frase de la ayuda) cuestan
   minutos.
