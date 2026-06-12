import type { CustomCallout } from '@press/web/types';

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
    <aside data-block="custom.callout" style={{ borderLeft: `4px solid ${VARIANT_STYLE[variant ?? 'info']}` }}>
      {message}
    </aside>
  );
}
