/**
 * Admin entry for the press engine plugin.
 *
 * Single job: give the component-picker categories human labels. The picker's
 * category accordion resolves its title through react-intl with the RAW
 * category string as the message id (formatMessage({ id: category })), so
 * registering unprefixed keys here is the only way to label the engine
 * categories without renaming component uids — a uid is wire/DB contract and
 * never changes for presentation.
 *
 * Adopters keep the final word: translations from the host app's
 * src/admin/app.tsx (config.translations) take precedence over these.
 */

type TradEntry = { locale: string; data: Record<string, string> };

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: {
    press: 'Blocks',
    section: 'Sections',
    chrome: 'Site chrome',
    custom: 'Custom blocks',
    'custom-section': 'Custom sections',
    'custom-chrome': 'Custom chrome',
  },
  'pt-BR': {
    press: 'Blocos',
    section: 'Seções',
    chrome: 'Chrome do site',
    custom: 'Blocos do projeto',
    'custom-section': 'Seções do projeto',
    'custom-chrome': 'Chrome do projeto',
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
