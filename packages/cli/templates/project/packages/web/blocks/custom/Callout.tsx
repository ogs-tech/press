import type { CustomOrganismCallout } from '__SHARED_PKG__/types';

const VARIANT_STYLE: Record<string, string> = {
  info: '#2563eb',
  warning: '#d97706',
  success: '#16a34a',
};

/**
 * Adopter-owned custom block (Project zone, Spec §4.2). The engine never names
 * this — it renders solely because press.blocks.ts maps 'custom-organism.callout' to it.
 */
export function Callout(props: CustomOrganismCallout) {
  const { message, variant } = props;
  return (
    <aside
      data-block="custom-organism.callout"
      style={{ borderLeft: `4px solid ${VARIANT_STYLE[variant ?? 'info']}`, padding: '0.5rem 0 0.5rem 1rem' }}
    >
      {message}
    </aside>
  );
}
