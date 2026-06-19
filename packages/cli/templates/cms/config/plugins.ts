// cms/config/plugins.ts — Project zone, STABLE. The single line that enables
// the press engine. Strapi auto-discovers @ogs-tech/press-cms from cms/ dependencies
// (it ships strapi.kind: "plugin"), so no explicit `resolve` is required.
export default ({ env }: { env: (key: string, def?: unknown) => unknown }) => ({
  'press-cms': {
    enabled: true,
  },
});
