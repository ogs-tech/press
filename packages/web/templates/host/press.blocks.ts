// .press/web/press.blocks.ts (materialized) — re-exports the adopter-owned
// custom block map from the web zone (web/blocks/custom/index.ts). The engine
// never names individual blocks; it only forwards the adopter's map to
// <BlockRenderer/>.
export { customBlocks } from '../../web/blocks/custom';
