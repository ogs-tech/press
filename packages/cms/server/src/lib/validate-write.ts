/**
 * Write-path validation backstop (Spec §4): the builder UI makes invalid trees
 * unreachable; these lifecycle guards protect direct API writes. STRICT: any
 * error OR warning rejects — sanitize-and-accept is the READ side's job.
 */
import { validateNodeArray, validatePressTree, type TreeIssue } from '@ogs-tech/press-shared';

const format = (issues: TreeIssue[]): string => issues.map((i) => `  ${i.path}: ${i.message}`).join('\n');

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return Symbol('unparseable'); // guaranteed to fail validation with a clear message
  }
};

export function assertValidPageWrite(data: Record<string, unknown> | undefined): void {
  const body = data?.body;
  if (body === undefined || body === null) return;
  const { errors, warnings } = validatePressTree(parseMaybeJson(body));
  const issues = [...errors, ...warnings];
  if (issues.length > 0) {
    throw new Error(`[press-cms] invalid composition tree in page.body — write rejected:\n${format(issues)}`);
  }
}

export function assertValidSiteSettingWrite(data: Record<string, unknown> | undefined): void {
  const pd = parseMaybeJson(data?.pageDefaults);
  if (pd === undefined || pd === null) return;
  if (typeof pd !== 'object' || Array.isArray(pd)) {
    throw new Error('[press-cms] pageDefaults must be an object of { header, footer } node arrays — write rejected');
  }
  for (const key of ['header', 'footer'] as const) {
    const slot = (pd as Record<string, unknown>)[key];
    if (slot === undefined || slot === null) continue;
    const { errors, warnings } = validateNodeArray(slot);
    const issues = [...errors, ...warnings];
    if (issues.length > 0) {
      throw new Error(`[press-cms] invalid nodes in pageDefaults.${key} — write rejected:\n${format(issues)}`);
    }
  }
}
