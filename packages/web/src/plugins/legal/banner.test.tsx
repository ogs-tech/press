// @vitest-environment jsdom
//
// Interactive-flow tests for the cookie-consent banner — a stateful client
// component. Same hand-rolled act() + createRoot harness as mobile-nav.test.tsx
// (CLAUDE.md testing note): NEVER @testing-library/react.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CookieConsentBanner } from './banner';
import { readConsentCookie, resetConsent, setConsent } from './consent-store';
import { DEFAULT_COOKIE_CONSENT } from './default-cookie-consent';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactElement): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
}

function banner(): HTMLElement | null {
  return container.querySelector('[data-press-consent="banner"]');
}
function reopenTrigger(): HTMLButtonElement | null {
  return container.querySelector('[data-press-consent="reopen"]');
}
function acceptAllButton(): HTMLButtonElement {
  const el = container.querySelector('[data-press-consent="accept-all"]') as HTMLButtonElement | null;
  if (!el) throw new Error('accept-all button not found');
  return el;
}
function savePreferencesButton(): HTMLButtonElement {
  const el = container.querySelector('[data-press-consent="save-preferences"]') as HTMLButtonElement | null;
  if (!el) throw new Error('save-preferences button not found');
  return el;
}

const { enabled: _enabled, ...CONSENT_PROPS } = DEFAULT_COOKIE_CONSENT;

const ANTI_FLASH_ATTR = 'data-press-consent-decided';

beforeEach(() => {
  resetConsent();
  document.documentElement.removeAttribute(ANTI_FLASH_ATTR);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetConsent();
  document.documentElement.removeAttribute(ANTI_FLASH_ATTR);
});

describe('<CookieConsentBanner>', () => {
  it('renders the full banner when no decision is stored', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    const b = banner();
    expect(b).not.toBeNull();
    expect(b!.textContent).toContain(DEFAULT_COOKIE_CONSENT.bannerTitle);
    expect(reopenTrigger()).toBeNull();
  });

  it('Accept All persists {analytics:true,marketing:true} and swaps to the floating trigger', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    act(() => acceptAllButton().click());
    expect(readConsentCookie()).toMatchObject({ analytics: true, marketing: true });
    expect(banner()).toBeNull();
    expect(reopenTrigger()).not.toBeNull();
  });

  it('Save Preferences with both toggles off persists an all-false decision (one-click full rejection)', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    act(() => savePreferencesButton().click());
    expect(readConsentCookie()).toMatchObject({ analytics: false, marketing: false });
    expect(banner()).toBeNull();
    expect(reopenTrigger()).not.toBeNull();
  });

  it('clicking the trigger reopens the panel pre-filled from the stored decision', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    act(() => acceptAllButton().click());
    act(() => reopenTrigger()!.click());
    const b = banner();
    expect(b).not.toBeNull();
    const analyticsInput = b!.querySelector('[data-category="analytics"] input') as HTMLInputElement;
    const marketingInput = b!.querySelector('[data-category="marketing"] input') as HTMLInputElement;
    expect(analyticsInput.checked).toBe(true);
    expect(marketingInput.checked).toBe(true);
  });

  // The anti-flash attribute's theme.css rule (`[data-press-consent-decided]
  // [data-press-consent="banner"] { display: none }`) hides ANY rendered
  // banner. Nothing else removes the attribute, so if the banner didn't clear
  // it on mount, a returning visitor clicking the reopen trigger would see
  // literally nothing happen — and so would a re-consent flow after a
  // cookie-version bump, or any post-mount resetConsent().
  it('removes the pre-hydration anti-flash attribute from <html> once mounted', () => {
    document.documentElement.setAttribute(ANTI_FLASH_ATTR, '');
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    expect(document.documentElement.hasAttribute(ANTI_FLASH_ATTR)).toBe(false);
  });

  it('clears the anti-flash attribute for a returning visitor, so the reopened panel is not hidden', () => {
    setConsent({ analytics: true, marketing: false });
    document.documentElement.setAttribute(ANTI_FLASH_ATTR, '');
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    expect(reopenTrigger()).not.toBeNull();
    expect(document.documentElement.hasAttribute(ANTI_FLASH_ATTR)).toBe(false);
    act(() => reopenTrigger()!.click());
    expect(banner()).not.toBeNull();
    expect(document.documentElement.hasAttribute(ANTI_FLASH_ATTR)).toBe(false);
  });

  it('always renders the necessary category checkbox as checked and disabled', () => {
    render(<CookieConsentBanner {...CONSENT_PROPS} />);
    const necessaryInput = banner()!.querySelector('[data-category="necessary"] input') as HTMLInputElement;
    expect(necessaryInput.checked).toBe(true);
    expect(necessaryInput.disabled).toBe(true);
  });
});
