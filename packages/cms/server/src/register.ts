import type { Core } from '@strapi/strapi';
import { injectComponents } from './lib/inject-components';
import { quietSchemaHttpLog } from './lib/quiet-schema-log';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // The composition-builder storage primitive (Spec §4): a JSON custom field.
  // Declared before content-types are transformed into models so the
  // `plugin::press-cms.builder` reference in page/site-setting schema.json resolves.
  strapi.customFields.register({
    name: 'builder',
    plugin: 'press-cms',
    type: 'json',
  });
  injectComponents({ strapi });
  quietSchemaHttpLog(strapi);
};

export default register;
