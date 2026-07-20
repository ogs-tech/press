/**
 * Builds the document-service `populate` for the page `body` dynamic zone.
 *
 * Strapi 5 populates dynamic zones via a per-component `on` map (see Document
 * Service `populate` docs). `populate: '*'` on each component pulls that
 * component's first-level relations and MEDIA — which is what makes the
 * `preset-atom.image` media cross the REST contract (Spec §5.2 "Media").
 *
 * The component list is passed in (read by the caller from the page content-type
 * at request time) so the engine stays generic: it never hardcodes `custom-*`
 * block names — only what the registry currently admits.
 *
 * EXCEPT `preset-organism.columns`: its per-column `image` media and nested
 * `button` component sit TWO levels below the DZ member (organism → repeatable
 * `columns` → media/component), one past what `'*'` reaches — the same shape
 * that forces the navbar's deep populate in buildChromeDzPopulate. Without
 * this, a column's image/button silently comes back empty on the wire (the
 * admin still shows them). `content` is a `blocks` JSON scalar — no populate key.
 */
export const buildBodyPopulate = (components: string[]): { body: { on: Record<string, unknown> } } => ({
  body: {
    on: Object.fromEntries(
      components.map((uid) =>
        uid === 'preset-organism.columns'
          ? [uid, { populate: { columns: { populate: { image: true, button: true } } } }]
          : [uid, { populate: '*' as const }],
      ),
    ),
  },
});

/**
 * Builds the document-service `populate` VALUE for one site-setting chrome
 * dynamic zone (`header`/`footer`). Like the body, each admitted component gets
 * `populate: '*'` — EXCEPT `preset-organism.navbar`: its `items.page` relation
 * (internal link, resolved to its slug by the web side) and its `cta` component
 * sit one level below what `'*'` reaches, so they are deep-populated explicitly
 * (Spec §1/§3). Without this, every internal nav link silently falls back to
 * its raw `url` field — the exact failure the old headerNav populate prevented.
 */
export const buildChromeDzPopulate = (components: string[]): { on: Record<string, unknown> } => ({
  on: Object.fromEntries(
    components.map((uid) =>
      uid === 'preset-organism.navbar'
        ? [uid, { populate: { items: { populate: { page: { fields: ['slug'] } } }, cta: true } }]
        : [uid, { populate: '*' as const }],
    ),
  ),
});
