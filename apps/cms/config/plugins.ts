// apps/cms/config/plugins.ts — Project zone, STABLE.
// The single line the adopter needs to enable the press engine. Strapi
// auto-discovers @press/cms from the host's dependencies (it ships
// strapi.kind: "plugin"), so no explicit `resolve` is required — keeping this
// the thinnest possible enable point.
export default ({ env }: { env: (key: string, def?: unknown) => unknown }) => ({
  "press-cms": {
    enabled: true,
  },
});
