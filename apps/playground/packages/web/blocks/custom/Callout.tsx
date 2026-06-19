import type { CustomCallout } from 'playground-shared/types';

const VARIANT_STYLE: Record<string, string> = {
  info: '#2563eb',
  warning: '#d97706',
  success: '#16a34a',
};

/**
 * Adopter-owned custom block (Project zone, Spec §4.2). The engine never names
 * this — it renders solely because press.blocks.ts maps 'custom.callout' to it.
 */
export function Callout(props: CustomCallout) {
  const { message, variant } = props;
  return (
    <aside
      data-block="custom.callout"
      style={{
        // Override a token in this block's own scope — wins locally via the
        // cascade, no engine change, no specificity fight (Spec §5, AC4).
        ['--press-radius-md' as string]: '2px',
        borderLeft: `4px solid ${VARIANT_STYLE[variant ?? 'info']}`,
        // Consume an engine token — the block inherits the theme for free.
        background: 'color-mix(in srgb, var(--press-color-accent) 12%, transparent)',
        borderRadius: 'var(--press-radius-md)',
        padding: 'var(--press-space-3) var(--press-space-4)',
      }}
    >
      {message}
    </aside>
  );
}
