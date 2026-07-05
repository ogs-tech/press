import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlockRenderer } from './block-renderer';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('BlockRenderer — organism blocks (sections)', () => {
  it('resolves an organism block from the organismBlocks registry', () => {
    const blocks = [{ __component: 'preset-organism.hero', id: 1, title: 'Ship faster' } as any];
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} />);
    expect(out).toContain('<section data-block="preset-organism.hero"');
    expect(out).toContain('Ship faster');
  });

  it('lets an adopter components map override an organism renderer (last-wins, Spec §9)', () => {
    const blocks = [{ __component: 'preset-organism.hero', id: 1, title: 'Ship faster' } as any];
    const MyHero = ({ title }: { title: string }) => <div data-block="custom-hero">{title}</div>;
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} components={{ 'preset-organism.hero': MyHero }} />);
    expect(out).toContain('data-block="custom-hero"');
    expect(out).not.toContain('data-block="preset-organism.hero"');
  });

  it('still resolves preset-atom.* atoms (organisms are additive)', () => {
    const blocks = [{ __component: 'preset-atom.button', id: 1, label: 'Go', href: '/go', variant: 'primary' } as any];
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} />);
    expect(out).toContain('data-block="preset-atom.button"');
  });

  it('skips an unknown component without crashing', () => {
    const blocks = [{ __component: 'preset-organism.does-not-exist', id: 1 } as any];
    expect(() => renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).not.toThrow();
    expect(renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).toBe('');
  });

  it('warns with the canonical component urn for an unknown block (identity class 2)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const blocks = [{ __component: 'preset-organism.does-not-exist', id: 1 } as any];
    renderToStaticMarkup(<BlockRenderer blocks={blocks} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('urn:component:preset-organism.does-not-exist'));
    warn.mockRestore();
  });
});

describe('BlockRenderer — chrome organisms', () => {
  it('resolves the chrome organisms (navbar/footer) from the organismBlocks registry', () => {
    const blocks = [
      { __component: 'preset-organism.navbar', id: 1, brand: { name: 'Acme' }, links: [] } as any,
      { __component: 'preset-organism.footer', id: 2, text: 'hello', brand: { name: 'Acme' } } as any,
    ];
    const out = renderToStaticMarkup(<BlockRenderer blocks={blocks} />);
    expect(out).toContain('data-block="preset-organism.navbar"');
    expect(out).toContain('data-block="preset-organism.footer"');
  });

  it('lets an adopter components map override a chrome renderer (adopter wins last, Spec §3)', () => {
    const blocks = [{ __component: 'preset-organism.navbar', id: 1, brand: { name: 'Acme' }, links: [] } as any];
    const MyNavbar = () => <div data-block="custom-navbar" />;
    const out = renderToStaticMarkup(
      <BlockRenderer blocks={blocks} components={{ 'preset-organism.navbar': MyNavbar }} />,
    );
    expect(out).toContain('data-block="custom-navbar"');
    expect(out).not.toContain('data-block="preset-organism.navbar"');
  });

  it('skips an unknown component in a chrome zone without crashing', () => {
    const blocks = [{ __component: 'preset-organism.does-not-exist', id: 1 } as any];
    expect(() => renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).not.toThrow();
    expect(renderToStaticMarkup(<BlockRenderer blocks={blocks} />)).toBe('');
  });
});
