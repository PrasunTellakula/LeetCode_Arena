/**
 * LeetCode Arena — content/index.tsx
 *
 * Minimalist content script. Zero DOM injection.
 *
 * Responsibilities:
 *  1. Create an isolated Shadow DOM host (invisible until triggered).
 *  2. Inject Tailwind CSS into the shadow root.
 *  3. Toggle the Arena Dashboard overlay via Alt+A keyboard shortcut.
 *  4. Handle OPEN_ARENA messages from the extension popup.
 *
 * This script does NOT touch LeetCode's navbar, contest cards, or any
 * other page elements. It is purely additive (overlay) and passive.
 */

import { createRoot, type Root } from 'react-dom/client';
import { Dashboard } from './Dashboard';
import cssText from './content.css?inline';

// ─── Shadow DOM host ──────────────────────────────────────────────────────────

const host = document.createElement('div');
host.id = 'leetcode-arena-root';
Object.assign(host.style, {
  position:  'fixed',
  inset:     '0',
  zIndex:    '2147483647',
  display:   'none',
  overflowY: 'auto',
  background:'#1a1a1a',
});
document.body.appendChild(host);

const shadow = host.attachShadow({ mode: 'open' });

// Tailwind v4 CSS injected as a <style> tag so it's scoped to this shadow root
const styleEl = document.createElement('style');
styleEl.textContent = cssText;
shadow.appendChild(styleEl);

// React mount target inside the shadow root
const appContainer = document.createElement('div');
shadow.appendChild(appContainer);

// ─── React root ───────────────────────────────────────────────────────────────

let reactRoot: Root | null = null;

function mountDashboard() {
  reactRoot ??= createRoot(appContainer);
  reactRoot.render(<Dashboard onClose={closeDashboard} />);
}

// ─── Open / Close ─────────────────────────────────────────────────────────────

let isOpen = false;

/** LeetCode's Next.js root — hidden while Arena is visible so content doesn't bleed through. */
function getLcMain(): HTMLElement | null {
  return (
    document.getElementById('__next') ??
    (document.querySelector('body > div:not(#leetcode-arena-root)') as HTMLElement | null)
  );
}

function openDashboard() {
  if (isOpen) return;
  const main = getLcMain();
  if (main) main.style.display = 'none';
  host.style.display   = 'block';
  document.body.style.overflow = 'hidden';
  mountDashboard();
  isOpen = true;
}

function closeDashboard() {
  if (!isOpen) return;
  host.style.display   = 'none';
  document.body.style.overflow = '';
  const main = getLcMain();
  if (main) main.style.display = '';
  isOpen = false;
}

// ─── Message handler — popup → content script ─────────────────────────────────
// The popup's "Open LeetCode Arena" button sends { type: 'OPEN_ARENA' } to
// the active LeetCode tab. This listener receives it and opens the overlay.

chrome.runtime.onMessage.addListener((rawMsg) => {
  const msg = rawMsg as { type?: string };
  if (msg.type === 'OPEN_ARENA') openDashboard();
  return false;
});

// ─── Alt + A keyboard shortcut ────────────────────────────────────────────────
// Content script only runs on leetcode.com (see manifest), so this shortcut
// is naturally restricted to LeetCode pages — no guard needed here.

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    isOpen ? closeDashboard() : openDashboard();
  }
});

console.log('[Arena] Content script ready — Alt+A to toggle.');