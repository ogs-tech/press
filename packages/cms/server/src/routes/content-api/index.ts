/**
 * Engine-owned, versioned public routes (Spec §5).
 *
 * `auth: false` makes each route public WITHOUT seeding the users-permissions
 * plugin's "public" role — so the contract is expressed entirely in engine code
 * the adopter never touches (no admin clicks, no Project-zone state). Access is
 * still scoped: the controllers only ever read PUBLISHED page content.
 *
 * `prefix: ''` overrides Strapi's default plugin-name namespacing for plugin
 * content-api routes (which would otherwise mount them under
 * `/api/press-cms/...`). With the empty prefix they mount under the global `/api`
 * prefix with the path as-is: `/api/pages`, `/api/pages/:slug`, `/api/press/schema`.
 */
export default () => ({
  type: 'content-api',
  routes: [
    { method: 'GET', path: '/pages', handler: 'page.find', config: { auth: false, prefix: '' } },
    { method: 'GET', path: '/pages/:slug', handler: 'page.findOne', config: { auth: false, prefix: '' } },
    { method: 'GET', path: '/press/schema', handler: 'schema.get', config: { auth: false, prefix: '' } },
    { method: 'GET', path: '/site-setting', handler: 'site-setting.find', config: { auth: false, prefix: '' } },
  ],
});
