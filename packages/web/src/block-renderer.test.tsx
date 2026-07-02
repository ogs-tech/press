import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlockRenderer } from './block-renderer';

describe('BlockRenderer — section blocks', () => {
  it('resolves a section.* block from the sectionBlocks registry', () => {
    const blocks = [{ __component: 'section.hero', id: 1, title: 'Ship faster' } as any];
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} />);
    expect(out).toContain('<section data-block="section.hero"');
    expect(out).toContain('Ship faster');
  });

  it('lets an adopter components map override a section renderer (last-wins, Spec §9)', () => {
    const blocks = [{ __component: 'section.hero', id: 1, title: 'Ship faster' } as any];
    const MyHero = ({ title }: { title: string }) => <div data-block="custom-hero">{title}</div>;
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} components={{ 'section.hero': MyHero }} />);
    expect(out).toContain('data-block="custom-hero"');
    expect(out).not.toContain('data-block="section.hero"');
  });

  it('still resolves press.* reference blocks (sections are additive)', () => {
    const blocks = [{ __component: 'press.button', id: 1, label: 'Go', href: '/go', variant: 'primary' } as any];
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} />);
    expect(out).toContain('data-block="press.button"');
  });

  it('skips an unknown component without crashing', () => {
    const blocks = [{ __component: 'section.does-not-exist', id: 1 } as any];
    expect(() => renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).not.toThrow();
    expect(renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).toBe('');
  });
});
