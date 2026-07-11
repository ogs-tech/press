---
'@ogs-tech/press-web': patch
---

fix(cli): `press build` surfaces the failing subprocess's real exit code

`util/run.ts` now rejects with a `SubprocessError` carrying the child's real
`code` (and `signal`), and `bin/press.ts` re-exits with it instead of a blanket
`1`. Before, any failing step in `press build` (`strapi build` / `next build`)
collapsed to exit `1`, weakening the "truthful failure" guarantee that `dev.ts`
already upholds via `waitForReadyOrExit` — a CMS build failing with a specific
code was indistinguishable from any other error in CI. `press dev`'s pre-boot
`seed`/`sync-types` steps become truthful for free (same `run()` helper). No
behavior change on success (exit 0).
