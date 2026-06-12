// apps/cms/src/index.ts — Project zone.
// The host owns an INTENTIONALLY EMPTY lifecycle. All engine behavior ships
// from @press/cms. If anything engine-related ever has to be added here, that is
// a contract leak (spec §8).
export default {
  register(/* { strapi } */) {},
  bootstrap(/* { strapi } */) {},
};
