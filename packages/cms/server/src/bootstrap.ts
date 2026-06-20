import type { Core } from '@strapi/strapi';
import { seedSiteSetting } from './lib/seed-site-setting';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  await seedSiteSetting(strapi);
};

export default bootstrap;
