// apps/cms/config/plugins.ts — Project zone, STABLE.
export default ({ env }: { env: (key: string, def?: unknown) => unknown }) => ({
  "press-cms": {
    enabled: true,
    resolve: "@press/cms",
  },
});
