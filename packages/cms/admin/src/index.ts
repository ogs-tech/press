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
 * preset|custom, layer ∈ atom|molecule|organism|config|layout|template). `layout`
 * and `template` are reserved (no components ship yet) but labelled so the picker
 * is ready when they arrive; `config` components never appear in a picker (they
 * are settings), but are labelled for completeness.
 *
 * Adopters keep the final word: translations from the host app's
 * src/admin/app.tsx (config.translations) take precedence over these.
 */

type TradEntry = { locale: string; data: Record<string, string> };

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: {
    'preset-atom': 'Atoms',
    'preset-molecule': 'Molecules',
    'preset-organism': 'Organisms',
    'preset-config': 'Configuration',
    'preset-layout': 'Layout',
    'preset-template': 'Templates',
    'custom-atom': 'Custom atoms',
    'custom-molecule': 'Custom molecules',
    'custom-organism': 'Custom organisms',
    'custom-layout': 'Custom layout',
    'custom-template': 'Custom templates',
  },
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
  register(): void {
    // No admin surface beyond translations — the plugin is server-first.
  },
  async registerTrads({ locales }: { locales: string[] }): Promise<TradEntry[]> {
    return locales.map((locale) => ({ locale, data: CATEGORY_LABELS[locale] ?? {} }));
  },
};
