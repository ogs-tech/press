/**
 * Engine-owned, versioned public routes (Spec §5).
 *
 * `auth: false` makes each route public WITHOUT seeding the users-permissions
 * plugin's "public" role — so the contract is expressed entirely in engine code
 * the adopter never touches (no admin clicks, no Project-zone state). Access is
 * still scoped: the controllers only ever read PUBLISHED page content.
 *
 * Content-api routes mount under the global `/api` prefix with the path as-is
 * (no plugin-name prefix): `/api/pages`, `/api/pages/:slug`, `/api/press/schema`.
 */
export default () => ({
  type: 'content-api',
  routes: [
    { method: 'GET', path: '/pages', handler: 'page.find', config: { auth: false } },
    { method: 'GET', path: '/pages/:slug', handler: 'page.findOne', config: { auth: false } },
    { method: 'GET', path: '/press/schema', handler: 'schema.get', config: { auth: false } },
  ],
});
