import type { Core } from '@strapi/strapi';
import { seedSiteSetting } from './lib/seed-site-setting';
import { seedCookieConsent } from './lib/seed-cookie-consent';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  await seedSiteSetting(strapi);
  // Order matters: seedCookieConsent updates the record seedSiteSetting creates
  // (and self-heals — without marking its flag — if the record is absent).
  await seedCookieConsent(strapi);
};

export default bootstrap;
