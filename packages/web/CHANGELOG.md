# @ogs-tech/press-web

## 0.4.0

### Minor Changes

- [`9e03291`](https://github.com/ogs-tech/press/commit/9e0329169b48b9ae97fd98f6781a693d9303e6d5) Thanks [@odenirdev](https://github.com/odenirdev)! - Relocate the press runtime into the engine and add `press upgrade`.

  `@ogs-tech/press-web` now ships the `press` runtime bin with `dev` / `build` / `upgrade`
  subcommands: the orchestration (`materialize` + `dev` + `build`) moved here from the CLI, and
  the new `press upgrade [version]` rewrites the project's exact `@ogs-tech/press-*` pins — each to
  its own latest published version, or to an explicit coordinated version — reinstalls, and
  re-materializes the host. The adopter's Project zone is never touched.

  Part of the command-surface revision that also renamed the scaffolder
  `@ogs-tech/press-cli` → `@ogs-tech/create-press` (run-once, invoked via
  `pnpm create @ogs-tech/press <name>`, and no longer a dependency of generated projects) and
  purged `deploy` from the package surface.
