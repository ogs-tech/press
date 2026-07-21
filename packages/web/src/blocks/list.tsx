import type { PresetAtomList } from '../types/base';

/** Atom `preset-atom.list` — one item per non-empty line of the curated text. */
export function List({ content, format }: PresetAtomList) {
  const items = (content ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (items.length === 0) return null;
  const Tag = format === 'ordered' ? 'ol' : 'ul';
  return (
    <div data-block="preset-atom.list">
      <Tag>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Tag>
    </div>
  );
}
