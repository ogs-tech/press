import type { Core } from '@strapi/strapi';
import { seedDefaultTheme } from './lib/seed-default-theme';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  await seedDefaultTheme(strapi);
};

export default bootstrap;
