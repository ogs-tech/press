/**
 * The `plugin::press-cms.builder` custom-field Input (Spec §4). Two shapes:
 *  - default: a full PressTree (page body) with header/footer slot-mode editors
 *  - options.mode === 'slots': the Site Settings pageDefaults `{ header, footer }`
 * Value tolerance: Strapi hands the form value as an object (or a JSON string on
 * some paths) — normalize on the way in, always emit an object with type 'json'.
 * Rendered with the design-system so the field reads as native admin UI; the
 * production admin already wraps plugin inputs in its DesignSystemProvider.
 */
import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react'; // @types/react 19 removed the global JSX namespace
import { useStrapiApp } from '@strapi/strapi/admin';
import { Box, Button, Field, Flex, NumberInput, SingleSelect, SingleSelectOption, Typography } from '@strapi/design-system';
import { Image } from '@strapi/icons';
import type { ContainerKey, Node, PressSchema, PressTree, Slot } from '@ogs-tech/press-shared';
import { DEFAULT_LAYOUT, isRecord, PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import { refreshPressSchema } from '../lib/press-data';
import { layoutDefaultsOf } from '../lib/form-model';
import { applyContainer, patchContainer, type Forest } from '../lib/tree-ops';
import { ContainerSection, TreeEditor } from './tree-editor';

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

const parseValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return undefined; }
};

const emptyTree = (): PressTree => ({
  version: PRESS_TREE_VERSION,
  root: { type: 'layout', header: { mode: 'inherit' }, footer: { mode: 'inherit' }, children: [] },
});

/** A titled card wrapping one slot's editor — the visual unit for header/body/footer. */
function Section({ dataSlot, title, children }: { dataSlot: string; title: string; children: JSX.Element }) {
  return (
    <Box data-press-slot={dataSlot} background="neutral0" hasRadius shadow="tableShadow" padding={4}>
      <Typography variant="delta" tag="h3">{title}</Typography>
      <Box marginTop={3}>{children}</Box>
    </Box>
  );
}

/** Media field: Strapi's media-library dialog when registered, else a bare asset-id input. Stores { assetId }. */
function MediaField({ value, disabled, onChange }: { value: unknown; disabled?: boolean; onChange(v: unknown): void }) {
  const components = useStrapiApp('PressBuilderMediaField', (state: any) => state.components);
  const MediaLibraryDialog = components?.['media-library'];
  const [open, setOpen] = useState(false);
  const assetId = isRecord(value) && typeof value.assetId === 'number' ? value.assetId : undefined;
  if (!MediaLibraryDialog) {
    return (
      <NumberInput
        aria-label="asset id"
        placeholder="asset id"
        disabled={disabled}
        value={assetId}
        onValueChange={(v) => onChange(v == null ? undefined : { assetId: v })}
      />
    );
  }
  return (
    <>
      <Flex gap={2}>
        <Button variant="secondary" size="S" startIcon={<Image />} disabled={disabled} onClick={() => setOpen(true)}>
          {assetId ? `Asset #${assetId} — change` : 'Pick media'}
        </Button>
        {assetId ? <Button variant="danger-light" size="S" disabled={disabled} onClick={() => onChange(undefined)}>Clear</Button> : null}
      </Flex>
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
    </>
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
    <Section dataSlot={title.toLowerCase()} title={title}>
      <>
        <Box maxWidth="20rem">
          <Field.Root name={`${title}-mode`}>
            <Field.Label>Mode</Field.Label>
            <SingleSelect
              aria-label={`${title} mode`}
              disabled={disabled}
              value={slot.mode}
              onChange={(v) => {
                const mode = v as Slot['mode'];
                onChange(mode === 'custom' ? { mode, children: slot.mode === 'custom' ? slot.children : [] } : { mode });
              }}
            >
              <SingleSelectOption value="inherit">Inherit site defaults</SingleSelectOption>
              <SingleSelectOption value="none">None (bare page)</SingleSelectOption>
              <SingleSelectOption value="custom">Custom</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
        </Box>
        {slot.mode === 'custom' ? (
          <Box marginTop={4}>
            <TreeEditor forest={slot.children as Forest} schema={schema} disabled={disabled}
              onChange={(children) => onChange({ mode: 'custom', children: children as Node[] })} MediaField={MediaField} />
          </Box>
        ) : null}
      </>
    </Section>
  );
}

export default function BuilderInput({ name, attribute, value, disabled, label, hint, error, onChange }: BuilderInputProps) {
  const [schema, setSchema] = useState<PressSchema | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    // Refetch on every mount, not the module-cached fetchPressSchema: the admin
    // is an SPA, and layoutDefaults is EDITABLE Site Settings data — a stale
    // cached payload would name a pre-edit site default (see refreshPressSchema).
    refreshPressSchema()
      .then((s) => live && setSchema(s))
      .catch((e) => live && setLoadError(String(e)));
    return () => { live = false; };
  }, []);

  // schema is referentially stable across edits (only ever replaced by the
  // effect above) — memoized so a keystroke anywhere in the tree doesn't
  // re-derive the site's layout defaults.
  const layoutDefaults = useMemo(() => (schema ? layoutDefaultsOf(schema) : DEFAULT_LAYOUT), [schema]);

  const emit = (next: unknown): void => onChange({ target: { name, value: next, type: 'json' } });
  const parsed = parseValue(value);

  if (loadError) return <Typography role="alert" textColor="danger600">press builder: schema unavailable ({loadError})</Typography>;
  if (!schema) return <Typography textColor="neutral600">Loading press schema…</Typography>;

  const slotsMode = attribute.options?.mode === 'slots';

  const footer = (
    <>
      {hint ? <Typography variant="pi" textColor="neutral600">{hint}</Typography> : null}
      {error ? <Typography variant="pi" textColor="danger600" role="alert">{error}</Typography> : null}
    </>
  );

  if (slotsMode) {
    const pd = isRecord(parsed) ? parsed : {};
    const header = Array.isArray(pd.header) ? (pd.header as Forest) : [];
    const footerNodes = Array.isArray(pd.footer) ? (pd.footer as Forest) : [];
    return (
      <Flex direction="column" alignItems="stretch" gap={4} data-press-builder="slots">
        {label ? <Typography variant="beta" tag="h2">{label}</Typography> : null}
        <Section dataSlot="header" title="Header">
          <TreeEditor forest={header} schema={schema} disabled={disabled}
            onChange={(next) => emit({ ...pd, header: next })} MediaField={MediaField} />
        </Section>
        <Section dataSlot="footer" title="Footer">
          <TreeEditor forest={footerNodes} schema={schema} disabled={disabled}
            onChange={(next) => emit({ ...pd, footer: next })} MediaField={MediaField} />
        </Section>
        {footer}
      </Flex>
    );
  }

  const tree: PressTree = isRecord(parsed) && isRecord(parsed.root) ? (parsed as unknown as PressTree) : emptyTree();
  const setRoot = (patch: Partial<PressTree['root']>): void => emit({ ...tree, root: { ...tree.root, ...patch } });
  /** Root-addressed container patch — same rule as the path-addressed
   *  setContainerAttr (an emptied container disappears), via patchContainer +
   *  applyContainer (tree-ops.ts). */
  const setRootContainer = (key: ContainerKey, value: string | undefined): void => {
    emit({ ...tree, root: applyContainer(tree.root, patchContainer(tree.root.container, key, value)) });
  };

  return (
    <Flex direction="column" alignItems="stretch" gap={4} data-press-builder="tree">
      {label ? <Typography variant="beta" tag="h2">{label}</Typography> : null}
      <SlotEditor title="Header" slot={tree.root.header} schema={schema} disabled={disabled} onChange={(header) => setRoot({ header })} />
      <Section dataSlot="body" title="Body">
        <>
          {/* The layout ROOT's own attrs — only `gap` applies (rhythm between
              top-level children). Slots mode has no root node, so this is
              tree-mode only. */}
          <ContainerSection nodeType="layout" topLevel container={tree.root.container}
            defaults={layoutDefaults.page} disabled={disabled} onSet={setRootContainer} />
          <Box marginTop={3}>
            <TreeEditor forest={tree.root.children as Forest} schema={schema} disabled={disabled}
              onChange={(children) => setRoot({ children: children as Node[] })} MediaField={MediaField} />
          </Box>
        </>
      </Section>
      <SlotEditor title="Footer" slot={tree.root.footer} schema={schema} disabled={disabled} onChange={(footer) => setRoot({ footer })} />
      {footer}
    </Flex>
  );
}
