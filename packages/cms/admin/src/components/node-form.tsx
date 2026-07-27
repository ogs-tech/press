/**
 * Per-block form generated from the schema catalog (Spec §4). Renders one input
 * per FieldDescriptor; nested `component` descriptors recurse with the referenced
 * component's own descriptors — so preset-molecule.link, the navbar cta chain
 * (navbar → button → link) and any custom nesting all work with zero per-block
 * code. Controls are Strapi design-system widgets so the form reads as native
 * admin UI; the descriptor layer (form-model.ts) is the only thing that knows
 * about press schema.
 */
import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react'; // @types/react 19 removed the global JSX namespace
import {
  Box, Button, Field, Flex, NumberInput, SingleSelect, SingleSelectOption,
  Textarea, TextInput, Toggle, Typography,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import { isRecord, type PressSchema } from '@ogs-tech/press-shared';
import { fieldsFor, type FieldDescriptor } from '../lib/form-model';
import { fieldLabel } from '../lib/palette-labels';
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

function PageRefField({ value, disabled, onChange }: { value: unknown; disabled?: boolean; onChange(v: unknown): void }) {
  const [pages, setPages] = useState<PageOption[]>([]);
  useEffect(() => {
    let live = true;
    fetchPages().then((p) => live && setPages(p)).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const current = isRecord(value) && typeof value.documentId === 'string' ? value.documentId : undefined;
  return (
    <SingleSelect
      aria-label="Linked page"
      placeholder="— none —"
      disabled={disabled}
      value={current}
      onClear={() => onChange(undefined)}
      clearLabel="Clear page"
      onChange={(v) => onChange(v ? { documentId: String(v) } : undefined)}
    >
      {pages.map((p) => (
        <SingleSelectOption key={p.documentId} value={p.documentId}>{p.title} (/{p.slug})</SingleSelectOption>
      ))}
    </SingleSelect>
  );
}

/** The leaf control for a single (non-component) descriptor. */
function FieldControl({ field, value, disabled, onChange, MediaField }: {
  field: FieldDescriptor;
  value: unknown;
  disabled?: boolean;
  onChange(v: unknown): void;
  MediaField: NodeFormProps['MediaField'];
}) {
  switch (field.kind) {
    case 'text':
      return <TextInput aria-label={field.name} disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'textarea':
      return <Textarea aria-label={field.name} disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'number':
      return <NumberInput aria-label={field.name} disabled={disabled} value={typeof value === 'number' ? value : undefined} onValueChange={(v) => onChange(v ?? undefined)} />;
    case 'checkbox':
      return <Toggle aria-label={field.name} onLabel="Yes" offLabel="No" disabled={disabled} checked={value === true} onChange={(e) => onChange(e.currentTarget.checked)} />;
    case 'select':
      return (
        <SingleSelect
          aria-label={field.name}
          placeholder="— default —"
          disabled={disabled}
          value={(value as string) ?? undefined}
          onClear={() => onChange(undefined)}
          clearLabel="Clear"
          onChange={(v) => onChange(v ? String(v) : undefined)}
        >
          {(field.options ?? []).map((opt) => <SingleSelectOption key={opt} value={opt}>{opt}</SingleSelectOption>)}
        </SingleSelect>
      );
    case 'media':
      return <MediaField value={value} disabled={disabled} onChange={onChange} />;
    case 'pageRef':
      return <PageRefField value={value} disabled={disabled} onChange={onChange} />;
    case 'json':
      return (
        <Textarea
          aria-label={field.name}
          disabled={disabled}
          defaultValue={value === undefined ? '' : JSON.stringify(value, null, 2)}
          onBlur={(e) => {
            try { onChange(e.target.value ? JSON.parse(e.target.value) : undefined); } catch { /* keep last valid value */ }
          }}
        />
      );
    default:
      return null;
  }
}

/** A nested `component` descriptor: a bordered section that recurses into NodeForm (repeatable → a list). */
function ComponentField({ field, schema, value, disabled, onChange, MediaField }: {
  field: FieldDescriptor;
  schema: PressSchema;
  value: unknown;
  disabled?: boolean;
  onChange(v: unknown): void;
  MediaField: NodeFormProps['MediaField'];
}) {
  const nested = field.component ? schema.components[field.component] : undefined;
  if (!field.component || !nested) return <Typography variant="pi" textColor="danger600">unknown component {field.component}</Typography>;

  const shell = (children: JSX.Element) => (
    <Box paddingLeft={4} marginTop={1} style={{ borderLeft: '2px solid var(--press-nest-rail, rgba(120,120,140,0.25))' }}>
      {children}
    </Box>
  );

  if (!field.repeatable) {
    return shell(
      <NodeForm componentUid={field.component} schema={schema} data={isRecord(value) ? value : {}} disabled={disabled}
        onChange={onChange} MediaField={MediaField} />,
    );
  }

  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  return shell(
    <Flex direction="column" alignItems="stretch" gap={2} data-press-repeat="">
      {items.map((item, i) => (
        <Box key={i} padding={2} hasRadius background="neutral0" borderColor="neutral200" borderStyle="solid" borderWidth="1px">
          <Flex justifyContent="space-between" alignItems="center" marginBottom={1}>
            <Typography variant="pi" fontWeight="bold" textColor="neutral600">{fieldLabel(field.name)} {i + 1}</Typography>
            <Button variant="danger-light" size="S" startIcon={<Trash />} disabled={disabled}
              onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</Button>
          </Flex>
          <NodeForm componentUid={field.component!} schema={schema} data={isRecord(item) ? item : {}} disabled={disabled}
            onChange={(next) => onChange(items.map((it, j) => (j === i ? next : it)))} MediaField={MediaField} />
        </Box>
      ))}
      <Box>
        <Button variant="secondary" size="S" startIcon={<Plus />} disabled={disabled}
          onClick={() => onChange([...items, {}])}>Add {fieldLabel(field.name)}</Button>
      </Box>
    </Flex>,
  );
}

export function NodeForm({ componentUid, schema, data, disabled, onChange, MediaField }: NodeFormProps) {
  const component = schema.components[componentUid];
  // Memoized above the early return (component is stable per componentUid/schema,
  // recomputed only when either changes, not on every field edit's re-render).
  const fields = useMemo(() => (component ? fieldsFor(component.attributes) : []), [component]);
  if (!component) return <Typography variant="pi" textColor="danger600">unknown component {componentUid}</Typography>;

  if (fields.length === 0) {
    return <Typography variant="pi" textColor="neutral500">This block has no editable fields.</Typography>;
  }

  const set = (name: string, v: unknown): void => {
    const next = { ...data };
    if (v === undefined) delete next[name];
    else next[name] = v;
    onChange(next);
  };

  return (
    <Flex direction="column" alignItems="stretch" gap={3} data-press-form={componentUid}>
      {fields.map((field) => {
        if (field.kind === 'component') {
          return (
            <Box key={field.name}>
              <Typography variant="pi" fontWeight="bold" textColor="neutral700">{fieldLabel(field.name)}</Typography>
              <ComponentField field={field} schema={schema} value={data[field.name]} disabled={disabled}
                onChange={(v) => set(field.name, v)} MediaField={MediaField} />
            </Box>
          );
        }
        return (
          <Field.Root key={field.name} name={field.name} required={field.required}>
            <Field.Label>{fieldLabel(field.name)}</Field.Label>
            <FieldControl field={field} value={data[field.name]} disabled={disabled}
              onChange={(v) => set(field.name, v)} MediaField={MediaField} />
          </Field.Root>
        );
      })}
    </Flex>
  );
}
