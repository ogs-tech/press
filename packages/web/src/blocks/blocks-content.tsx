import { Fragment, type ReactNode } from 'react';
import type { BlocksContent, BlocksNode, BlocksText } from '../types/base';

/**
 * Shared in-house renderer for the Strapi `blocks` AST — deliberately NOT
 * `@strapi/blocks-react-renderer` (that package is `"use client"`, so it would turn
 * static prose into a hydrated client island and add a runtime dependency, both
 * against the engine's server-rendered, JS-free block principle).
 *
 * Used by the decomposed text reference blocks (press.paragraph / press.list /
 * press.quote) whose `content` is a Strapi blocks field. Tolerance mirrors
 * BlockRenderer: an unknown node type (or an embedded `image` node — images belong
 * in press.image / press.gallery) renders nothing rather than throwing.
 */

type Inline = BlocksNode | BlocksText;

const isText = (node: Inline): node is BlocksText => node.type === 'text';

/**
 * Wraps a single text run in its semantic mark elements.
 *
 * The Strapi blocks `text` node carries up to five boolean marks
 * (bold/italic/underline/strikethrough/code). Each maps to a semantic element;
 * they compose from the inside out, so `bold` ends up outermost when several are
 * set. An unmarked run renders as bare text (the keyed Fragment just carries the
 * React key needed inside the parent's `.map`).
 */
const MARKS: ReadonlyArray<readonly [keyof BlocksText, (child: ReactNode) => ReactNode]> = [
  ['code', (c) => <code>{c}</code>],
  ['underline', (c) => <u>{c}</u>],
  ['strikethrough', (c) => <s>{c}</s>],
  ['italic', (c) => <em>{c}</em>],
  ['bold', (c) => <strong>{c}</strong>],
];

function renderText(node: BlocksText, key: number): ReactNode {
  let content: ReactNode = node.text;
  for (const [mark, wrap] of MARKS) {
    if (node[mark]) content = wrap(content);
  }
  return <Fragment key={key}>{content}</Fragment>;
}

/**
 * Neutralizes dangerous URL protocols (javascript:/data:/vbscript:) a CMS editor
 * could type into a link, returning '#' instead. http(s)/mailto/tel, relative
 * paths and anchors pass through untouched. Cheap defense-in-depth: link content
 * is editor-authored, not public input, but an executable href is never wanted.
 */
function safeHref(url: string | undefined): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '#';
  return /^(?:javascript|data|vbscript):/i.test(trimmed) ? '#' : trimmed;
}

/** Renders an inline node: either a text run (with marks) or an inline link. */
function renderInline(node: Inline, i: number): ReactNode {
  if (isText(node)) return renderText(node, i);
  if (node.type === 'link') {
    const href = safeHref(node.url);
    // Only outbound http(s) links get rel; internal/anchor links stay clean.
    const external = /^https?:\/\//i.test(href);
    return (
      <a key={i} href={href} {...(external ? { rel: 'noopener noreferrer' } : {})}>
        {(node.children ?? []).map(renderInline)}
      </a>
    );
  }
  return null; // tolerant: unknown inline node → skip
}

/** Renders one list item (its children are inline). */
function renderListItem(node: BlocksNode, i: number): ReactNode {
  return <li key={i}>{(node.children ?? []).map(renderInline)}</li>;
}

/** Renders one block-level node. Unknown / out-of-scope (`image`) → null. */
function renderNode(node: BlocksNode, i: number): ReactNode {
  const children = node.children ?? [];
  switch (node.type) {
    case 'paragraph':
      return <p key={i}>{children.map(renderInline)}</p>;
    case 'heading': {
      const level = Math.min(Math.max(node.level ?? 1, 1), 6);
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return <Tag key={i}>{children.map(renderInline)}</Tag>;
    }
    case 'list': {
      const Tag = node.format === 'ordered' ? 'ol' : 'ul';
      return <Tag key={i}>{children.map(renderListItem)}</Tag>;
    }
    case 'quote':
      return <blockquote key={i}>{children.map(renderInline)}</blockquote>;
    case 'code':
      return (
        <pre key={i}>
          <code>{children.map(renderInline)}</code>
        </pre>
      );
    default:
      return null; // tolerant: unknown block (incl. embedded `image`) → skip
  }
}

/** Renders a Strapi blocks AST array to semantic HTML nodes. */
export function renderBlocks(content: BlocksContent): ReactNode {
  return content.map(renderNode);
}
