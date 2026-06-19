import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { materialize } from '../materialize';
import { run } from '../util/run';
import { waitForReadyOrExit } from '../util/wait-for-ready-or-exit';
import { watchSchema } from '../util/watch-schema';

export interface DevOptions {
  cwd: string;
}

const CMS_URL = 'http://localhost:1337';
const WEB_URL = 'http://localhost:3000';
const READY_TRIES = 60;
const READY_INTERVAL_MS = 2000;
const READY_BUDGET_S = (READY_TRIES * READY_INTERVAL_MS) / 1000;
const SCHEMA_POLL_MS = 2000;

function syncTypesScript(projectRoot: string): string {
  const require = createRequire(path.join(projectRoot, 'noop.js'));
  const webPkg = require.resolve('@ogs-tech/press-web/package.json');
  return path.join(path.dirname(webPkg), 'bin', 'sync-types.ts');
}

/**
 * Boots the whole stack as one command (spec §5):
 *   1. materialize .press/web/ from the engine host template
 *   2. seed sample content (cms server must be DOWN for the programmatic seed)
 *   3. boot the cms host (:1337), wait healthy — or abort if it dies/stalls
 *   4. sync types (cms schema -> shared/types — the Spec 1 contract)
 *   5. boot the web host (:3000), wait serving — or abort if it dies/stalls
 *   6. watch the engine schema and re-sync types on change (keeps generated.ts fresh)
 * Every wait is crash-aware (waitForReadyOrExit): a child that exits early aborts
 * loudly with its exit code instead of polling a dead port for the full budget.
 * Once both are up, an exit of EITHER tears the stack down with a truthful code —
 * `press dev` never reports a false success.
 */
export async function devCommand(opts: DevOptions): Promise<void> {
  const root = opts.cwd;
  const cmsDir = path.join(root, 'packages', 'cms');

  console.log('> materialize .press/web');
  materialize(root);

  console.log('> seed sample content');
  await run('node', [path.join(cmsDir, 'scripts', 'seed.mjs')], { cwd: cmsDir });

  const children: ChildProcess[] = [];
  let shuttingDown = false;
  const schemaWatch = new AbortController();
  const killAll = () => {
    shuttingDown = true;
    schemaWatch.abort();
    for (const c of children) if (c.exitCode === null) c.kill();
  };

  // SIGINT/SIGTERM is a clean, user-initiated stop → tear down and exit 0.
  const onSignal = () => {
    killAll();
    process.exit(0);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  console.log('> boot cms (:1337)');
  const cms = spawn('pnpm', ['-C', 'packages/cms', 'develop'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
  });
  children.push(cms);

  const cmsReady = await waitForReadyOrExit({
    url: `${CMS_URL}/_health`,
    child: cms,
    okStatus: 204,
    tries: READY_TRIES,
    intervalMs: READY_INTERVAL_MS,
  });
  if (cmsReady.status !== 'ready') {
    killAll();
    throw new Error(
      cmsReady.status === 'exited'
        ? `cms exited (code ${cmsReady.code}) before becoming healthy on :1337 — see the cms log above.`
        : `cms did not become healthy on :1337 within ${READY_BUDGET_S}s.`,
    );
  }

  console.log('> sync types (cms schema -> shared/types)');
  await run('pnpm', ['exec', 'tsx', syncTypesScript(root)], {
    cwd: root,
    env: { CMS_URL, PRESS_TYPES_DIR: path.join(root, 'packages', 'shared', 'types') },
  });

  console.log('> boot web (:3000)');
  console.log('  note: .press/web is engine-owned and regenerated every run — do not edit it.');
  const web = spawn('pnpm', ['exec', 'next', 'dev', '.press/web', '-p', '3000'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CMS_URL },
  });
  children.push(web);

  const webReady = await waitForReadyOrExit({
    url: WEB_URL,
    child: web,
    tries: READY_TRIES,
    intervalMs: READY_INTERVAL_MS,
  });
  if (webReady.status !== 'ready') {
    killAll();
    throw new Error(
      webReady.status === 'exited'
        ? `web (next dev) exited (code ${webReady.code}) before serving :3000 — see the web log above.`
        : `web (next dev) did not serve :3000 within ${READY_BUDGET_S}s.`,
    );
  }
  console.log(`\npress dev ready — web ${WEB_URL}, cms ${CMS_URL}/admin\n`);

  // Keep shared/types/generated.ts fresh while the stack runs: re-sync whenever the
  // engine serves a different schema (e.g. the adopter adds a custom.* block and
  // Strapi restarts). Loud but non-fatal — a transient unreachable/invalid schema is
  // logged and retried, never tears the stack down. Stopped by killAll's abort.
  void watchSchema({
    url: `${CMS_URL}/api/press/schema`,
    signal: schemaWatch.signal,
    intervalMs: SCHEMA_POLL_MS,
    onChange: async () => {
      console.log('\n> schema changed — re-syncing types');
      await run('pnpm', ['exec', 'tsx', syncTypesScript(root)], {
        cwd: root,
        env: { CMS_URL, PRESS_TYPES_DIR: path.join(root, 'packages', 'shared', 'types') },
      });
    },
    onError: () => {
      if (!schemaWatch.signal.aborted) {
        console.error('  (type-sync watch: schema unreachable or re-sync failed — retrying)');
      }
    },
  });

  // Both servers are long-running; if either exits now, the stack is down. Tear
  // the other down and surface the failing code so callers/CI never see a false
  // success. A signal-initiated stop already exited(0) above, so this only fires
  // on an unexpected death.
  const exited = await new Promise<{ name: string; code: number | null }>((resolve) => {
    cms.once('exit', (code) => resolve({ name: 'cms', code }));
    web.once('exit', (code) => resolve({ name: 'web', code }));
  });
  if (!shuttingDown) {
    console.error(`\n${exited.name} exited (code ${exited.code}) — shutting down press dev.\n`);
    killAll();
    process.exit(exited.code ?? 1);
  }
}
