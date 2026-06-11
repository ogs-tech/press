/**
 * Builds the document-service `populate` for the page `body` dynamic zone.
 *
 * Strapi 5 populates dynamic zones via a per-component `on` map (see Document
 * Service `populate` docs). `populate: '*'` on each component pulls that
 * component's first-level relations and MEDIA — which is what makes the
 * `press.hero` image cross the REST contract (Spec §5.1 "Media").
 *
 * The component list is passed in (read by the caller from the page content-type
 * at request time) so the engine stays generic: it never hardcodes `custom.*`
 * block names — only what the registry currently admits.
 */
export const buildBodyPopulate = (components: string[]): { body: { on: Record<string, { populate: '*' }> } } => ({
  body: {
    on: Object.fromEntries(components.map((uid) => [uid, { populate: '*' as const }])),
  },
});
