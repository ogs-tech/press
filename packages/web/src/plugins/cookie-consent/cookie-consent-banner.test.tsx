// @vitest-environment jsdom
//
// Interactive-flow tests for the engine's first stateful client component.
// NOTE deliberately no @testing-library/react: the workspace's
// node-linker=hoisted layout (required by Strapi 5) materializes only
// Strapi-admin's react-19 RTL variant at the root, which cannot render
// elements created by this package's react 18. A minimal act()+createRoot
// harness over the hoisted react-dom 18 covers the same click→cookie→state
// flow without fighting the layout.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CookieConsentBanner } from './cookie-consent-banner';
import { mapCookieConsent } from './map-cookie-consent';
import {
  CONSENT_COOKIE_NAME,
  CONSENT_DECIDED_ATTR,
  makeConsentState,
  parseConsentCookie,
  serializeConsentCookie,
} from './consent-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactElement): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
}

function button(name: string): HTMLButtonElement {
  const el = [...container.querySelectorAll('button')].find((b) => b.textContent === name);
  if (!el) throw new Error(`button "${name}" not found`);
  return el;
}

function click(el: HTMLElement): void {
  act(() => el.click());
}

const plugin = (overrides?: Parameters<typeof mapCookieConsent>[0]) =>
  mapCookieConsent(overrides ?? null, 'home');

const storedDecision = () => parseConsentCookie(document.cookie);

beforeEach(() => {
  // jsdom keeps cookies across tests — start each one undecided.
  document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
  document.documentElement.removeAttribute(CONSENT_DECIDED_ATTR);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('CookieConsentBanner (cookie-consent Spec §5)', () => {
  it('renders nothing when the plugin is disabled', () => {
    render(<CookieConsentBanner plugin={plugin({ enabled: false })} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows title, description, actions, and the privacy link for an undecided visitor', () => {
    render(<CookieConsentBanner plugin={plugin({ privacyPage: { slug: 'privacy-policy' } })} />);
    expect(container.textContent).toContain('Cookies on this site');
    expect(button('Accept all')).toBeTruthy();
    expect(button('Reject optional')).toBeTruthy();
    const link = container.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toBe('Privacy policy');
    expect(link.getAttribute('href')).toBe('/privacy-policy');
  });

  it('never shows for a visitor with a stored decision (post-hydration unmount)', () => {
    document.cookie = `${serializeConsentCookie(makeConsentState({ analytics: true, marketing: true }))}; Path=/`;
    render(<CookieConsentBanner plugin={plugin()} />);
    expect(container.innerHTML).toBe('');
  });

  it('Accept all persists a full grant, stamps the pre-paint attribute, and unmounts', () => {
    render(<CookieConsentBanner plugin={plugin()} />);
    click(button('Accept all'));
    expect(storedDecision()).toMatchObject({ necessary: true, analytics: true, marketing: true });
    expect(document.documentElement.getAttribute(CONSENT_DECIDED_ATTR)).toBe('decided');
    expect(container.innerHTML).toBe('');
  });

  it('Reject optional persists a full denial (necessary stays granted) and unmounts', () => {
    render(<CookieConsentBanner plugin={plugin()} />);
    click(button('Reject optional'));
    expect(storedDecision()).toMatchObject({ necessary: true, analytics: false, marketing: false });
    expect(container.innerHTML).toBe('');
  });

  it('Manage preferences: necessary is locked, toggles start denied, Save persists the draft', () => {
    render(<CookieConsentBanner plugin={plugin()} />);
    click(button('Manage preferences'));

    const checkboxes = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0].checked).toBe(true); // necessary
    expect(checkboxes[0].disabled).toBe(true);

    click(checkboxes[1]); // grant analytics only
    click(button('Save preferences'));
    expect(storedDecision()).toMatchObject({ analytics: true, marketing: false });
  });

  it('omits a category the editor disabled from the preferences panel (Spec §2)', () => {
    render(<CookieConsentBanner plugin={plugin({ marketing: { enabled: false } })} />);
    click(button('Manage preferences'));
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2); // necessary + analytics
    expect(container.textContent).not.toContain('Marketing');
  });

  it('renders the CMS-authored copy when present', () => {
    render(
      <CookieConsentBanner
        plugin={plugin({ title: 'Cookies por aqui', acceptAllLabel: 'Aceitar tudo' })}
      />,
    );
    expect(container.textContent).toContain('Cookies por aqui');
    expect(button('Aceitar tudo')).toBeTruthy();
  });
});
