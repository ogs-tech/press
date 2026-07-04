import type { Core } from '@strapi/strapi';
import { seedSiteSetting } from './lib/seed-site-setting';
import { seedPrivacyPolicyPage } from './lib/seed-page-privacy-policy';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  await seedSiteSetting(strapi);
  await seedPrivacyPolicyPage(strapi);
};

export default bootstrap;
