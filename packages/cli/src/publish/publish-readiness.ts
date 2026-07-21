/**
 * Publish-readiness rules for the @press engine packages — a pure, I/O-free
 * checker the test feeds real manifests into. There is no `press publish`
 * command: this guards that `pnpm -r publish` would succeed for a fresh, public
 * @press scope. See the repo `pack:check` script for the live `--dry-run`.
 */

export interface Manifest {
  name?: string;
  private?: boolean;
  version?: string;
  publishConfig?: { access?: string };
  files?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * The packages published to npm: @ogs-tech/create-press (the run-once scaffolder,
 * which is NOT a generated-project dependency) plus the engine @ogs-tech/press-{web,cms}
 * that a generated project installs, and @ogs-tech/press-shared — the wire contract
 * package (PressSchema types + the `validatePressTree` runtime validator) that
 * press-web now depends on at runtime (Decision 3 of the composition-builder
 * refactor). press-shared is a PUBLISHED runtime contract package, not an internal,
 * dev-only, never-published one — it ships its own version/publishConfig and is
 * co-published alongside web/cms via changesets.
 */
export const PUBLISHABLE_PACKAGES = [
  '@ogs-tech/create-press',
  '@ogs-tech/press-web',
  '@ogs-tech/press-cms',
  '@ogs-tech/press-shared',
] as const;

// Dependency fields that ship in the published manifest. devDependencies do not,
// so a workspace: spec there is harmless — but here it would point the tarball at
// a protocol npm cannot resolve and break the adopter's install.
const PUBLISHED_DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;

/** Returns the publish-readiness violations for one manifest (empty array = ready). */
export function checkPublishReadiness(manifest: Manifest): string[] {
  const violations: string[] = [];

  // Scoped packages publish as `restricted` by default; a public @press scope
  // needs the explicit opt-in or the first `npm publish` fails.
  if (manifest.publishConfig?.access !== 'public') {
    violations.push('missing publishConfig.access="public" (scoped packages default to restricted)');
  }

  // A publishable package needs a concrete version to resolve against.
  if (!manifest.version) {
    violations.push('missing a version');
  }

  // NOTE: tarball-surface control (a `files` allowlist OR an `.npmignore`) is
  // asserted by the test, not here — it needs the filesystem, and this checker
  // stays pure. A package may legitimately use either (cli/cms: files; web:
  // .npmignore, because under a files allowlist npm stops honoring .npmignore).

  // workspace: must be rewritten to a real range by the publish tool, never shipped raw
  // — UNLESS the target is itself one of PUBLISHABLE_PACKAGES: changesets co-publish
  // those together, rewriting workspace:* to that package's real published version, so
  // e.g. press-web's `"@ogs-tech/press-shared": "workspace:*"` resolves at publish time.
  // A workspace: spec pointing at anything else would ship a protocol npm can't resolve
  // and break the adopter's install.
  for (const field of PUBLISHED_DEP_FIELDS) {
    for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
      const isWorkspaceSpec = typeof spec === 'string' && spec.startsWith('workspace:');
      const isCoPublishedTarget = (PUBLISHABLE_PACKAGES as readonly string[]).includes(dep);
      if (isWorkspaceSpec && !isCoPublishedTarget) {
        violations.push(`${field}.${dep} still uses the workspace: protocol`);
      }
    }
  }

  return violations;
}
