import { randomUUID } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import type { PressTree } from '@ogs-tech/press-shared';
import { PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import { seedPage } from './seed-page';
import { SITE_SETTING_UID } from './seed-site-setting';

const PRIVACY_POLICY_BODY: PressTree = {
  version: PRESS_TREE_VERSION,
  root: {
    type: 'layout',
    header: { mode: 'inherit' },
    footer: { mode: 'inherit' },
    children: [
      {
        id: randomUUID(),
        type: 'block',
        component: 'preset-atom.heading',
        data: { text: 'Privacy Policy', level: '1' },
      },
      {
        id: randomUUID(),
        type: 'block',
        component: 'preset-atom.paragraph',
        data: {
          content:
            'This page is a placeholder — replace it with your actual privacy policy before launch.',
        },
      },
    ],
  },
};

/**
 * Seeds the privacy-policy page exactly once (Plugin/Legal Spec §3). The
 * `legalPages.enabled` gate is read ONCE, at seed time — same "checked once"
 * contract as seedPage's own flag: disabling the gate after the page already
 * exists does not retroactively remove it. Absent component (fresh install,
 * nothing populated yet) reads as enabled (`=== false` check, not `!== true`).
 */
export async function seedLegalPages(strapi: Core.Strapi): Promise<void> {
  const site = (await strapi.documents(SITE_SETTING_UID).findFirst({
    populate: { legalPages: true },
  } as any)) as { legalPages?: { enabled?: boolean } | null } | null;

  if (site?.legalPages?.enabled === false) return;

  await seedPage(strapi, {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    body: PRIVACY_POLICY_BODY,
    flagKey: 'legalPrivacyPolicySeeded',
  });
}
