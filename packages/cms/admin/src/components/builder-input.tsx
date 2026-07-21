/**
 * The `plugin::press-cms.builder` custom-field Input (Spec §4). Two shapes:
 *  - default: a full PressTree (page body) with header/footer slot-mode editors
 *  - options.mode === 'slots': the Site Settings pageDefaults `{ header, footer }`
 * Value tolerance: Strapi hands the form value as an object (or a JSON string on
 * some paths) — normalize on the way in, always emit an object with type 'json'.
 */
import { useEffect, useState } from 'react';
import { useStrapiApp } from '@strapi/strapi/admin';
import type { Node, PressSchema, PressTree, Slot } from '@ogs-tech/press-shared';
import { fetchPressSchema } from '../lib/press-data';
import type { Forest } from '../lib/tree-ops';
import { TreeEditor } from './tree-editor';

interface BuilderInputProps {
  name: string;
  attribute: { options?: { mode?: string } };
  value?: unknown;
  disabled?: boolean;
  label?: string;
  hint?: string;
  error?: string;
  onChange(event: { target: { name: string; value: unknown; type: string } }): void;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const parseValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return undefined; }
};

const emptyTree = (): PressTree => ({
  version: 1,
  root: { type: 'layout', header: { mode: 'inherit' }, footer: { mode: 'inherit' }, children: [] },
});

/** Media field: Strapi's media-library dialog when registered, else a bare asset-id input. Stores { assetId }. */
function MediaField({ value, disabled, onChange }: { value: unknown; disabled?: boolean; onChange(v: unknown): void }) {
  const components = useStrapiApp('PressBuilderMediaField', (state: any) => state.components);
  const MediaLibraryDialog = components?.['media-library'];
  const [open, setOpen] = useState(false);
  const assetId = isRecord(value) && typeof value.assetId === 'number' ? value.assetId : undefined;
  if (!MediaLibraryDialog) {
    return (
      <input
        type="number"
        placeholder="asset id"
        disabled={disabled}
        value={assetId ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : { assetId: Number(e.target.value) })}
      />
    );
  }
  return (
    <span>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}>
        {assetId ? `Asset #${assetId} — change` : 'Pick media'}
      </button>
      {assetId ? <button type="button" disabled={disabled} onClick={() => onChange(undefined)}>Clear</button> : null}
      {open ? (
        <MediaLibraryDialog
          allowedTypes={['images']}
          onClose={() => setOpen(false)}
          onSelectAssets={(assets: Array<{ id: number }>) => {
            if (assets[0]) onChange({ assetId: assets[0].id });
            setOpen(false);
          }}
        />
      ) : null}
    </span>
  );
}

function SlotEditor({ title, slot, schema, disabled, onChange }: {
  title: string;
  slot: Slot;
  schema: PressSchema;
  disabled?: boolean;
  onChange(slot: Slot): void;
}) {
  return (
    <fieldset data-press-slot={title}>
      <legend>{title}</legend>
      <select
        aria-label={`${title} mode`}
        disabled={disabled}
        value={slot.mode}
        onChange={(e) => {
          const mode = e.target.value as Slot['mode'];
          onChange(mode === 'custom' ? { mode, children: slot.mode === 'custom' ? slot.children : [] } : { mode });
        }}
      >
        <option value="inherit">inherit site defaults</option>
        <option value="none">none (bare page)</option>
        <option value="custom">custom</option>
      </select>
      {slot.mode === 'custom' ? (
        <TreeEditor forest={slot.children as Forest} schema={schema} disabled={disabled}
          onChange={(children) => onChange({ mode: 'custom', children: children as Node[] })} MediaField={MediaField} />
      ) : null}
    </fieldset>
  );
}

export default function BuilderInput({ name, attribute, value, disabled, label, hint, error, onChange }: BuilderInputProps) {
  const [schema, setSchema] = useState<PressSchema | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchPressSchema()
      .then((s) => live && setSchema(s))
      .catch((e) => live && setLoadError(String(e)));
    return () => { live = false; };
  }, []);

  const emit = (next: unknown): void => onChange({ target: { name, value: next, type: 'json' } });
  const parsed = parseValue(value);

  if (loadError) return <p role="alert">press builder: schema unavailable ({loadError})</p>;
  if (!schema) return <p>Loading press schema…</p>;

  const slotsMode = attribute.options?.mode === 'slots';

  if (slotsMode) {
    const pd = isRecord(parsed) ? parsed : {};
    const header = Array.isArray(pd.header) ? (pd.header as Forest) : [];
    const footer = Array.isArray(pd.footer) ? (pd.footer as Forest) : [];
    return (
      <div data-press-builder="slots">
        {label ? <strong>{label}</strong> : null}
        <fieldset><legend>header</legend>
          <TreeEditor forest={header} schema={schema} disabled={disabled}
            onChange={(next) => emit({ ...pd, header: next })} MediaField={MediaField} />
        </fieldset>
        <fieldset><legend>footer</legend>
          <TreeEditor forest={footer} schema={schema} disabled={disabled}
            onChange={(next) => emit({ ...pd, footer: next })} MediaField={MediaField} />
        </fieldset>
        {hint ? <small>{hint}</small> : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    );
  }

  const tree: PressTree = isRecord(parsed) && isRecord(parsed.root) ? (parsed as unknown as PressTree) : emptyTree();
  const setRoot = (patch: Partial<PressTree['root']>): void => emit({ ...tree, root: { ...tree.root, ...patch } });

  return (
    <div data-press-builder="tree">
      {label ? <strong>{label}</strong> : null}
      <SlotEditor title="header" slot={tree.root.header} schema={schema} disabled={disabled} onChange={(header) => setRoot({ header })} />
      <fieldset data-press-slot="body">
        <legend>body</legend>
        <TreeEditor forest={tree.root.children as Forest} schema={schema} disabled={disabled}
          onChange={(children) => setRoot({ children: children as Node[] })} MediaField={MediaField} />
      </fieldset>
      <SlotEditor title="footer" slot={tree.root.footer} schema={schema} disabled={disabled} onChange={(footer) => setRoot({ footer })} />
      {hint ? <small>{hint}</small> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
