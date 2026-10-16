# Review 483 — excepcion acotada en la guardia 69/R10 (cierre_detail inmutable) para el deleteMany de la 477/R18

- PR #861, rama `fix/483-guardia-cierre-detail-477`, commit revisado `b0dfa081`, base `origin/dev` `cec49f00`.
- Diff: `tests/unit/repositories/cierre-detail-inmutable.test.ts` (+27/-3),
  `specs/477-corregir-gestiones-cierre-rechazado/design.md` (+5), `progress/gate_483.log` (nuevo).
- Busqueda: el diff es de 3 archivos y el codigo a leer estaba acotado por el encargo; se leyo
  directamente con git/sed (sin grafo).

## Checklist

- [x] **Excepcion exacta (archivo + operacion + numero).** `EXCEPCIONES = { "repositories/CierreDiaRepository.ts": { deleteMany: 1 } }`;
      la guardia cuenta ocurrencias (`src.match(re).length`) y falla si `n > permitidas`. Para
      cualquier otro archivo u operacion `permitidas = 0`. El regex `cierreDetail\s*\.\s*delete\s*\(`
      no confunde `delete` con `deleteMany` (exige `(` tras el nombre).
- [x] **Mutaciones medidas** (copia aislada de `lib/` + el test en el scratchpad, worktree intacto):
  | Mutacion | Resultado |
  |---|---|
  | M1 segundo `cierreDetail.deleteMany(` en CierreDiaRepository.ts | ROJO (`x2 (permitidas: 1)`) + rojo el test de uso |
  | M2 `cierreDetail.update(` en CierreDiaRepository.ts | ROJO (`update() x1 (permitidas: 0)`) |
  | M3 `cierreDetail.deleteMany(` en ZonaRepository.ts | ROJO (`ZonaRepository.ts ... permitidas: 0`) |
  | M4 quitar el deleteMany real | ROJO (test «la excepcion sigue en uso») |
  | M5 renombrar CierreDiaRepository.ts | ROJO en ambos (la excepcion no viaja con el archivo; ENOENT en el de uso) |
  | M6 `cierreDetail.delete(` en CierreDiaRepository.ts | ROJO (`delete() x1 (permitidas: 0)`) |
  (El test de `db/schema.prisma` falla en la copia solo porque no se copio `db/`; artefacto del arnes, no del PR.)
- [x] **Normalizacion de rutas.** `path.relative(LIB_DIR, file).replace(/\/g, "/")`: en Windows
      convierte `repositories\CierreDiaRepository.ts`; en Linux `path.relative` ya da `/` y el replace
      es no-op. Medido en Windows (la excepcion casa: test verde). Linux por construccion.
- [x] **Test «la excepcion sigue en uso» no vacuo.** Si el archivo no existe, `fs.readFileSync`
      lanza ENOENT y el test FALLA (medido, M5). Si el deleteMany desaparece, `toBe(1)` falla (M4).
      Si aparece un segundo, `toBe(1)` falla (M1). Solo seria vacuo si se vacia `EXCEPCIONES`, que
      es justo el estado sin excepcion (correcto).
- [x] **El deleteMany de la 477 solo actua sobre cierres `rechazado`** (`CierreDiaRepository.ts:1678-1752`):
      dentro de una unica `$transaction`, (1) `SELECT ... FOR UPDATE` del cierre; `enCorreccion` sale de
      `ordenesEnCorreccion` (`lib/repositories/correccion-cierre.ts`), cuyo SQL exige
      `c.estado = 'rechazado'`, `c.mensajero_id` y `cd.cierre_id = cierreId`; (2) `updateMany` con
      `estado: "rechazado"` y `count !== 1 -> throw` (rollback). El `deleteMany` (l.1740) filtra por
      `cierreId` y `ordenId in sinRehacer` ⊆ `enCorreccion`. Un cierre en otro estado no llega al paso 5.
- [x] **Design 477 actualizado** con la nota de la excepcion (trazabilidad del porque).
- [x] **Test aislado**: `npx vitest run tests/unit/repositories/cierre-detail-inmutable.test.ts`
      desde wt-483 -> 1 archivo, 4 tests passed.
- [x] **Gate** `progress/gate_483.log`: `--rapido`, 273 archivos / 3755 tests verdes, `INIT_EXIT=0`
      (sin `.env`: la integracion de DB no corre, pero el diff no toca dinero/datos — el propio gate
      lo dice — y no la requiere).
- [n/a] RLS / webhooks / secretos: el PR no toca codigo de produccion.

## Hallazgos

1. `menor` — El conteo es textual: una mencion `cierreDetail.deleteMany(` en un COMENTARIO de
   CierreDiaRepository.ts cuenta como ocurrencia. Si alguien borra la llamada real y deja un
   comentario con ese texto, el test de uso sigue verde (y el cupo de 1 lo ocupa el comentario).
   Hoy no hay tal comentario (solo la l.1740). Mitigable quitando comentarios antes de contar.
2. `menor` — La excepcion esta acotada a archivo, no a metodo: mover el unico deleteMany a otro
   metodo de CierreDiaRepository.ts, o ensanchar su `where` (p.ej. quitar `ordenId in sinRehacer`),
   no lo detecta la guardia. Limitacion inherente a una guardia por texto; la cubren los tests de
   comportamiento de la 477.
3. `menor` — Limitaciones heredadas de la guardia original (no introducidas aqui): alias
   (`const cd = tx.cierreDetail; cd.deleteMany(...)`) o acceso por indice (`tx["cierreDetail"]`)
   la evaden.
4. `menor` — Se commitea `progress/gate_483.log` (899 lineas); coherente con la practica de dejar
   el log del gate, solo ruido en el diff.

## Veredicto

**OK** — 0 bloqueantes, 4 menores.
