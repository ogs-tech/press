/**
 * Per-block form generated from the schema catalog (Spec §4). Renders one input
 * per FieldDescriptor; nested `component` descriptors recurse with the
 * referenced component's own descriptors — so preset-molecule.link, the navbar
 * cta chain (navbar → button → link) and any custom nesting all work with zero
 * per-block code. Plain HTML elements on purpose (no design-system dep).
 */
import { useEffect, useState } from 'react';
import type { PressSchema } from '@ogs-tech/press-shared';
import { fieldsFor, type FieldDescriptor } from '../lib/form-model';
import { fetchPages, type PageOption } from '../lib/press-data';

interface NodeFormProps {
  componentUid: string;
  schema: PressSchema;
  data: Record<string, unknown>;
  disabled?: boolean;
  onChange(data: Record<string, unknown>): void;
  /** Injectable media picker (tests stub it; production wires the media-library dialog). */
  MediaField: (props: { value: unknown; disabled?: boolean; onChange(v: unknown): void }) => JSX.Element;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function PageRefField({ value, disabled, onChange }: { value: unknown; disabled?: boolean; onChange(v: unknown): void }) {
  const [pages, setPages] = useState<PageOption[]>([]);
  useEffect(() => {
    let live = true;
    fetchPages().then((p) => live && setPages(p)).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const current = isRecord(value) && typeof value.documentId === 'string' ? value.documentId : '';
  return (
    <select
      disabled={disabled}
      value={current}
      onChange={(e) => onChange(e.target.value ? { documentId: e.target.value } : undefined)}
    >
      <option value="">— none —</option>
      {pages.map((p) => (
        <option key={p.documentId} value={p.documentId}>{p.title} (/{p.slug})</option>
      ))}
    </select>
  );
}

function Field({ field, schema, value, disabled, onChange, MediaField }: {
  field: FieldDescriptor;
  schema: PressSchema;
  value: unknown;
  disabled?: boolean;
  onChange(v: unknown): void;
  MediaField: NodeFormProps['MediaField'];
}) {
  switch (field.kind) {
    case 'text':
      return <input type="text" disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'textarea':
      return <textarea rows={4} disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'number':
      return <input type="number" disabled={disabled} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
    case 'checkbox':
      return <input type="checkbox" disabled={disabled} checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case 'select':
      return (
        <select disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">— default —</option>
          {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    case 'media':
      return <MediaField value={value} disabled={disabled} onChange={onChange} />;
    case 'pageRef':
      return <PageRefField value={value} disabled={disabled} onChange={onChange} />;
    case 'json':
      return (
        <textarea
          rows={4}
          disabled={disabled}
          defaultValue={value === undefined ? '' : JSON.stringify(value, null, 2)}
          onBlur={(e) => {
            try { onChange(e.target.value ? JSON.parse(e.target.value) : undefined); } catch { /* keep last valid value */ }
          }}
        />
      );
    case 'component': {
      const nested = field.component ? schema.components[field.component] : undefined;
      if (!nested) return <em>unknown component {field.component}</em>;
      if (field.repeatable) {
        const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
        return (
          <div data-press-repeat="">
            {items.map((item, i) => (
              <fieldset key={i}>
                <NodeForm componentUid={field.component!} schema={schema} data={isRecord(item) ? item : {}} disabled={disabled}
                  onChange={(next) => onChange(items.map((it, j) => (j === i ? next : it)))} MediaField={MediaField} />
                <button type="button" disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
              </fieldset>
            ))}
            <button type="button" disabled={disabled} onClick={() => onChange([...items, {}])}>Add {field.name}</button>
          </div>
        );
      }
      return (
        <NodeForm componentUid={field.component!} schema={schema} data={isRecord(value) ? (value as Record<string, unknown>) : {}}
          disabled={disabled} onChange={(next) => onChange(next)} MediaField={MediaField} />
      );
    }
    default:
      return null;
  }
}

export function NodeForm({ componentUid, schema, data, disabled, onChange, MediaField }: NodeFormProps) {
  const component = schema.components[componentUid];
  if (!component) return <em>unknown component {componentUid}</em>;
  const fields = fieldsFor(component.attributes);
  return (
    <div data-press-form={componentUid}>
      {fields.map((field) => (
        <label key={field.name} style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ display: 'block', fontWeight: 600 }}>{field.name}{field.required ? ' *' : ''}</span>
          <Field field={field} schema={schema} value={data[field.name]} disabled={disabled} MediaField={MediaField}
            onChange={(v) => {
              const next = { ...data };
              if (v === undefined) delete next[field.name];
              else next[field.name] = v;
              onChange(next);
            }} />
        </label>
      ))}
    </div>
  );
}
