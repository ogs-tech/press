import type { Core } from '@strapi/strapi';

export type PluginStore = {
  get: (params: { key: string }) => Promise<unknown>;
  set: (params: { key: string; value: unknown }) => Promise<void>;
};

// `strapi.store` exists at runtime but is not on the Core.Strapi typing surface
// this plugin compiles against — hence the narrow local cast.
export const pluginStore = (strapi: Core.Strapi): PluginStore =>
  (strapi as any).store({ type: 'plugin', name: 'press-cms' });
