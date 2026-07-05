import type { Core } from '@strapi/strapi';
import { pluginStore } from './plugin-store';

/** UID of the engine's page collection type (plugin name `press-cms`). */
export const PAGE_UID = 'plugin::press-cms.page';

const PRIVACY_SEED_KEY = 'privacyPageSeeded';

/** A preset-atom.heading section title (level 2 — the page title itself is the h1). */
const heading = (text: string) => ({ __component: 'preset-atom.heading', text, level: '2' });

/** A preset-atom.paragraph block; `content` is Strapi rich-text blocks JSON, not a plain string. */
const paragraph = (text: string) => ({
  __component: 'preset-atom.paragraph',
  content: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
});

/**
 * Privacy-policy page template: the standard section structure with short
 * placeholder guidance, no legal boilerplate — the engine scaffolds the
 * document, the adopter's editor writes (and owns) the actual policy.
 */
export const PRIVACY_PAGE = {
  title: 'Privacy Policy',
  slug: 'privacy-policy',
  body: [
    paragraph(
      'Introduce this policy: who you are, what this site does, and your commitment to protecting personal data. State when the policy was last updated.',
    ),
    heading('Data We Collect'),
    paragraph(
      'Describe the personal data this site collects — e.g. contact-form submissions, analytics identifiers, newsletter e-mail addresses — and how it is collected.',
    ),
    heading('Cookies'),
    paragraph(
      'List the cookies and similar technologies in use, what each one is for, and how visitors can manage or refuse them.',
    ),
    heading('How We Use Your Data'),
    paragraph(
      'Explain the purposes your data is used for and the legal basis for each (consent, contract, legitimate interest…).',
    ),
    heading('Data Sharing'),
    paragraph(
      'Name the third parties that may receive visitor data (hosting, analytics, e-mail providers) and why.',
    ),
    heading('Your Rights'),
    paragraph(
      'Describe the rights visitors have over their data — access, correction, deletion, portability — and how to exercise them.',
    ),
    heading('Contact'),
    paragraph('Provide a contact channel (e-mail or form) for privacy questions and data requests.'),
  ],
};

/**
 * Seeds the privacy-policy page template exactly once:
 *
 * 1. Plugin-store flag first: after the one seeding pass the page is never
 *    written again — an editor-deleted page is respected forever (same
 *    semantics as the chrome seed).
 * 2. Slug collision → the adopter's own page wins: the seed marks itself done
 *    without writing.
 * 3. The page is created as a DRAFT — the engine never publishes content on
 *    its own; an editor reviews the placeholders and publishes.
 */
export async function seedPrivacyPolicyPage(strapi: Core.Strapi): Promise<void> {
  const store = pluginStore(strapi);
  if (await store.get({ key: PRIVACY_SEED_KEY })) return;

  const docs = strapi.documents(PAGE_UID);
  const existing = await docs.findFirst({ filters: { slug: PRIVACY_PAGE.slug } } as any);
  if (!existing) {
    await docs.create({ data: PRIVACY_PAGE as any });
  }

  await store.set({ key: PRIVACY_SEED_KEY, value: true });
}
