// apps/web/press-config.ts — Project zone. Resolves the root whitelabel config
// ONCE into an immutable module constant. Module-eval scope keeps it
// deterministic under RSC/SSR — no per-request mutation (Spec §7, §11).
import userConfig from 'press.config';
import { resolveConfig } from '@press/web';

export const config = resolveConfig(userConfig);
