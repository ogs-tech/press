import { Container } from '@ogs-tech/press-web';
import type { CustomOrganismCallout } from '__SHARED_PKG__/types';

const VARIANT_STYLE: Record<string, string> = {
  info: '#2563eb',
  warning: '#d97706',
  success: '#16a34a',
};

/**
 * Adopter-owned custom block (Project zone, Spec §4.2). The engine never names
 * this — it renders solely because press.blocks.ts maps 'custom-organism.callout' to it.
 *
 * A custom ORGANISM owns its own width: the engine's prose selector re-centers
 * only atoms (`preset-atom.*` / `custom-atom.*`), so a non-atom custom block
 * wraps itself in `<Container>` — the same contract the engine's own organisms
 * follow (outer Container owns width + gutter, the visual lives on an inner
 * element).
 */
export function Callout(props: CustomOrganismCallout) {
  const { message, variant } = props;
  return (
    <Container as="aside" maxWidth="lg" data-block="custom-organism.callout">
      <div style={{ borderLeft: `4px solid ${VARIANT_STYLE[variant ?? 'info']}`, padding: '0.5rem 0 0.5rem 1rem' }}>
        {message}
      </div>
    </Container>
  );
}
