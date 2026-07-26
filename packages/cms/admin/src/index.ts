/**
 * Admin entry for the press engine plugin.
 *
 * Single job: give the component-picker categories human labels. The picker's
 * category accordion resolves its title through react-intl with the RAW
 * category string as the message id (formatMessage({ id: category })), so
 * registering the `preset-*` / `custom-*` keys here is the only way to label the
 * engine categories without renaming component uids — a uid is wire/DB contract
 * and never changes for presentation.
 *
 * The categories follow the Atomic Design model: `{owner}-{layer}` (owner ∈
 * preset|custom, layer ∈ atom|molecule|organism|config|layout|template). `template`
 * is reserved (no components ship yet) but labelled so the picker is ready when it
 * arrives; `config`/`layout` components never appear in a picker (they're settings
 * and tree-node descriptors, never DZ members), but are labelled for completeness.
 *
 * Adopters keep the final word: translations from the host app's
 * src/admin/app.tsx (config.translations) take precedence over these.
 */
import { CATEGORY_LABELS as EN_CATEGORY_LABELS } from './lib/palette-labels';

type TradEntry = { locale: string; data: Record<string, string> };

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: EN_CATEGORY_LABELS,
  'pt-BR': {
    'preset-atom': 'Átomos',
    'preset-molecule': 'Moléculas',
    'preset-organism': 'Organismos',
    'preset-config': 'Configuração',
    'preset-layout': 'Layout',
    'preset-template': 'Templates',
    'custom-atom': 'Átomos do projeto',
    'custom-molecule': 'Moléculas do projeto',
    'custom-organism': 'Organismos do projeto',
    'custom-layout': 'Layout do projeto',
    'custom-template': 'Templates do projeto',
  },
};

// Generic pt resolves like pt-BR — the labels are region-neutral.
CATEGORY_LABELS.pt = CATEGORY_LABELS['pt-BR'];

export default {
  register(app: any): void {
    // The composition-builder custom field: the JSON PressTree editor that
    // replaces the retired Dynamic Zones on page `body` and Site Settings
    // `pageDefaults`. Registered as `plugin::press-cms.builder`; the Input is
    // lazy-imported so the tree-editor bundle only loads on the edit view.
    app.customFields.register({
      name: 'builder',
      pluginId: 'press-cms',
      type: 'json',
      intlLabel: { id: 'press-cms.builder.label', defaultMessage: 'Composition' },
      intlDescription: { id: 'press-cms.builder.description', defaultMessage: 'The press composition tree (layout + blocks)' },
      components: {
        Input: async () => import('./components/builder-input'),
      },
      options: { base: [], advanced: [] },
    });
  },
  async registerTrads({ locales }: { locales: string[] }): Promise<TradEntry[]> {
    return locales.map((locale) => ({ locale, data: CATEGORY_LABELS[locale] ?? {} }));
  },
};
