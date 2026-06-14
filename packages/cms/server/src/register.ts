import type { Core } from '@strapi/strapi';
import { injectComponents } from './lib/inject-components';
import { admitCustomBlocks } from './lib/inject-components';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  injectComponents({ strapi });
  admitCustomBlocks({ strapi });
};

export default register;
