/**
 * LeetCode Arena — content/index.tsx
 *
 * Responsibilities:
 *  1. Create an isolated Shadow DOM host + inject Tailwind CSS.
 *  2. Find LeetCode's top nav bar and clone the "Contest" nav item to
 *     create a pixel-perfect "Arena 🔥" link next to it.
 *  3. Toggle the Arena Dashboard (hide/show LC's #__next) on click.
 *  4. Handle OPEN_ARENA messages from the popup.
 *  5. Alt+A keyboard shortcut.
 */

import { createRoot, type Root } from 'react-dom/client';
import { Dashboard } from './Dashboard';
import cssText from './content.css?inline';

// ─── Shadow DOM setup ─────────────────────────────────────────────────────────

const host = document.createElement('div');
host.id = 'leetcode-arena-root';
Object.assign(host.style, {
  position: 'fixed',
  inset: '0',
  zIndex: '2147483647',
  display: 'none',
  overflowY: 'auto',
  background: '#1a1a1a',
});
document.body.appendChild(host);

const shadow = host.attachShadow({ mode: 'open' });

const styleEl = document.createElement('style');
styleEl.textContent = cssText;
shadow.appendChild(styleEl);

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

/** LeetCode's main page content — hidden while Arena is open. */
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
  host.style.display = 'block';
  document.body.style.overflow = 'hidden';
  mountDashboard();
  isOpen = true;
  document.getElementById('arena-nav-link')?.setAttribute('data-arena-open', 'true');
}

function closeDashboard() {
  if (!isOpen) return;
  host.style.display = 'none';
  document.body.style.overflow = '';
  const main = getLcMain();
  if (main) main.style.display = '';
  isOpen = false;
  document.getElementById('arena-nav-link')?.removeAttribute('data-arena-open');
}

// ─── Nav injection ────────────────────────────────────────────────────────────

/**
 * Finding LeetCode's contest link — we try four strategies in order:
 *  1. Exact href="/contest/"
 *  2. href="/contest" (no trailing slash)
 *  3. Any <a> inside a <nav> / <header> with href containing "contest"
 *  4. Text-content scan over all nav/header anchors
 *
 * Once found we clone its entire parent nav-item container for
 * pixel-perfect matching, then swap in our text and click handler.
 */
function findContestLink(): HTMLAnchorElement | null {
  const byExact = document.querySelector<HTMLAnchorElement>('a[href="/contest/"]');
  if (byExact) return byExact;

  const byNoSlash = document.querySelector<HTMLAnchorElement>('a[href="/contest"]');
  if (byNoSlash) return byNoSlash;

  const scope = 'nav a, header a, [role="navigation"] a, [id*="navbar"] a, [class*="navbar"] a';
  for (const el of document.querySelectorAll<HTMLAnchorElement>(scope)) {
    if (/^\/contest\/?$/.test(el.getAttribute('href') ?? '')) return el;
  }

  for (const el of document.querySelectorAll<HTMLAnchorElement>(scope)) {
    if (el.textContent?.trim().toLowerCase() === 'contest') return el;
  }

  return null;
}

let navInjected = false;

function injectArenaNavLink(): boolean {
  // Already done and still in the DOM
  if (navInjected && document.getElementById('arena-nav-link')) return true;

  // Our link got removed (SPA route change) — reset
  if (navInjected && !document.getElementById('arena-nav-link')) navInjected = false;

  const contestLink = findContestLink();
  if (!contestLink) return false;

  // Guard against race conditions
  if (document.getElementById('arena-nav-link')) { navInjected = true; return true; }

  // ── Determine the nav-item wrapper ──────────────────────────────────────────
  // LeetCode wraps each nav link in a <li>, a <div>, or exposes the <a> directly.
  // We try closest <li> first, then any class that looks like a nav-item wrapper.
  const navItem: Element =
    contestLink.closest('li') ??
    contestLink.closest('[class*="nav-item"]') ??
    contestLink.closest('[class*="navItem"]') ??
    contestLink.parentElement ??
    contestLink;

  const navContainer = navItem.parentElement;
  if (!navContainer) return false;

  // ── Clone the entire nav item for pixel-perfect styling ─────────────────────
  const arenaItem = navItem.cloneNode(true) as HTMLElement;

  // Find the <a> inside the clone (or the clone itself)
  const arenaAnchor: HTMLAnchorElement =
    arenaItem.tagName === 'A'
      ? (arenaItem as HTMLAnchorElement)
      : (arenaItem.querySelector('a') as HTMLAnchorElement);

  if (!arenaAnchor) return false;

  arenaAnchor.id = 'arena-nav-link';
  arenaAnchor.href = '#';
  arenaAnchor.textContent = 'Arena 🔥';
  arenaAnchor.removeAttribute('data-state');
  arenaAnchor.removeAttribute('aria-selected');
  arenaAnchor.removeAttribute('aria-current');

  // Active-open highlight (LeetCode orange)
  if (!document.getElementById('arena-injected-styles')) {
    const s = document.createElement('style');
    s.id = 'arena-injected-styles';
    s.textContent = `
      #arena-nav-link[data-arena-open="true"],
      #arena-nav-link[data-arena-open="true"] * {
        color: #ffa116 !important;
      }
    `;
    document.head.appendChild(s);
  }

  arenaAnchor.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isOpen ? closeDashboard() : openDashboard();
  });

  // Insert immediately after the Contest item
  navContainer.insertBefore(arenaItem, navItem.nextSibling);
  navInjected = true;

  console.log('[Arena] "Arena 🔥" injected via clone strategy.');
  return true;
}

// ─── MutationObserver ─────────────────────────────────────────────────────────
// Keep running (don't disconnect) — handles SPA route changes that re-render
// the nav and remove our injected link.

const navObserver = new MutationObserver(() => injectArenaNavLink());

navObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// Immediate attempt for pages that are already fully rendered
injectArenaNavLink();

// ─── Message handler ──────────────────────────────────────────────────────────
// Popup's "Open LeetCode Arena" button sends OPEN_ARENA to focus this tab.

chrome.runtime.onMessage.addListener((rawMsg) => {
  const msg = rawMsg as { type?: string };
  if (msg.type === 'OPEN_ARENA') openDashboard();
  return false;
});

// ─── Keyboard shortcut ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    isOpen ? closeDashboard() : openDashboard();
  }
});

console.log('[Arena] Content script ready. Use Alt+A to toggle.');