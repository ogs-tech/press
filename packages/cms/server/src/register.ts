import type { Core } from '@strapi/strapi';
import { injectComponents } from './lib/inject-components';
import { admitCustomBlocks } from './lib/inject-components';
import { quietSchemaHttpLog } from './lib/quiet-schema-log';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  injectComponents({ strapi });
  admitCustomBlocks({ strapi });
  quietSchemaHttpLog(strapi);
};

export default register;
