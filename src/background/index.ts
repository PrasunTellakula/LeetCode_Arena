/**
 * LeetCode Arena — background/index.ts
 * MV3 Service Worker — Hybrid automatic contest detection + LeetCode-only guards.
 *
 * Detection strategies (priority order):
 *  1. chrome.webRequest.onCompleted  — POST to any submit endpoint
 *  2. chrome.webNavigation.onCompleted — arrival at contest ranking pages
 *  3. chrome.runtime.onMessage       — explicit signals from content/popup
 *  4. chrome.commands.onCommand      — registered keyboard shortcut (Alt+A)
 *  5. chrome.action.onClicked        — toolbar click when popup fails
 *
 * All UI-toggle paths (4 & 5) enforce: URL must be leetcode.com.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type ContestType = 'live' | 'virtual';

interface UserState {
  streak: { current: number; longest: number; lastActiveDate: string | null };
  coins: number;
  streakFreezes: number;
  xp: number;
  level: string;
  todayStatus: 'pending' | 'completed_virtual' | 'completed_live' | 'freeze_used';
}

interface ContestRecord {
  id: string;
  name: string;
  date: string;
  solvedCount: number;
  durationMinutes: number;
  type: ContestType;
  coinsEarned: number;
}

interface ContestState {
  history: ContestRecord[];
}

interface PersistedSlice<T> {
  state: T;
  version: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KEYS = {
  user:    'arena-user-storage',
  contest: 'arena-contest-storage',
} as const;

const DEFAULT_USER: UserState = {
  streak: { current: 0, longest: 0, lastActiveDate: null },
  coins: 0,
  streakFreezes: 0,
  xp: 0,
  level: 'Rookie',
  todayStatus: 'pending',
};

const DEFAULT_CONTEST: ContestState = { history: [] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateLevel(xp: number): string {
  if (xp < 500)   return 'Rookie';
  if (xp < 1500)  return 'Pupil';
  if (xp < 3000)  return 'Specialist';
  if (xp < 5000)  return 'Expert';
  if (xp < 8000)  return 'Candidate Master';
  if (xp < 12000) return 'Master';
  if (xp < 20000) return 'International Master';
  return 'Legendary';
}

function formatContestName(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function readSlice<T>(key: string, fallback: T): Promise<PersistedSlice<T>> {
  try {
    const result = await chrome.storage.local.get(key);
    const raw = result[key] as string | undefined;
    return raw ? (JSON.parse(raw) as PersistedSlice<T>) : { state: fallback, version: 0 };
  } catch {
    return { state: fallback, version: 0 };
  }
}

async function writeSlice<T>(key: string, slice: PersistedSlice<T>): Promise<void> {
  await chrome.storage.local.set({ [key]: JSON.stringify(slice) });
}

// ─── Core handler ─────────────────────────────────────────────────────────────

/**
 * Single idempotency-guarded handler for all contest completion sources.
 * Writes directly to chrome.storage.local in Zustand's persist format.
 */
async function handleContestCompletion(
  contestName: string,
  type: ContestType,
  solvedCount = 0
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const userSlice = await readSlice<UserState>(KEYS.user, DEFAULT_USER);
  const u = userSlice.state;

  // Idempotency: never double-count the same day
  const done =
    u.streak.lastActiveDate === today &&
    (u.todayStatus === 'completed_live' || u.todayStatus === 'completed_virtual');

  if (done) {
    console.log('[Arena BG] Already recorded for today — skipping.');
    return;
  }

  const coinsEarned = type === 'live' ? 100 : 50;
  const xpEarned    = type === 'live' ? 200 : 100;
  const newXp       = u.xp + xpEarned;
  const newCurrent  = u.streak.current + 1;

  await writeSlice<UserState>(KEYS.user, {
    ...userSlice,
    state: {
      ...u,
      todayStatus:    type === 'live' ? 'completed_live' : 'completed_virtual',
      coins:          u.coins + coinsEarned,
      xp:             newXp,
      level:          calculateLevel(newXp),
      streak: {
        current:        newCurrent,
        longest:        Math.max(u.streak.longest, newCurrent),
        lastActiveDate: today,
      },
    },
  });

  const contestSlice = await readSlice<ContestState>(KEYS.contest, DEFAULT_CONTEST);
  await writeSlice<ContestState>(KEYS.contest, {
    ...contestSlice,
    state: {
      history: [
        ...contestSlice.state.history,
        {
          id:              `${contestName}-${today}-${Date.now()}`,
          name:            contestName,
          date:            today,
          solvedCount,
          durationMinutes: 90,
          type,
          coinsEarned,
        },
      ],
    },
  });

  // Desktop notification
  const notifId = `arena-${Date.now()}`;
  chrome.notifications.create(notifId, {
    type:    'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title:   '🔥 Arena — Auto-detected!',
    message: `${contestName}  ✓  |  +${xpEarned} XP  ·  +${coinsEarned} 🪙  |  🔥 ${newCurrent}-day streak`,
    priority: 2,
  });
  setTimeout(() => chrome.notifications.clear(notifId), 8000);

  console.log(`[Arena BG] "${contestName}" (${type}) → Streak: ${newCurrent} | XP: ${newXp}`);
}

// ─── Listener 1: webRequest — broadened to ALL submission endpoints ───────────
/**
 * Catches successful POST 200/201 responses on every LeetCode submit path:
 *
 *  • /problems/{slug}/submit/            → regular problem  → 'virtual'
 *  • /contest/{name}/problems/{slug}/submit/ → contest submit  → 'live'
 *  • /contest/api/{name}/*               → contest API      → 'live'
 *
 * The idempotency guard in handleContestCompletion ensures a single
 * problem submission on a regular day doesn't spam the store.
 */
chrome.webRequest.onCompleted.addListener(
  (details) => {
    // Only POST submissions
    if (details.method !== 'POST') return;
    // Accept 200 OR 201 (some endpoints return 201 Created)
    if (details.statusCode !== 200 && details.statusCode !== 201) return;

    const url = details.url;

    // Priority 1: Contest submission endpoint
    const contestMatch = url.match(
      /leetcode\.com\/contest\/([^/?#]+)\/problems\/[^/?#]+\/submit/i
    );
    if (contestMatch) {
      const contestName = formatContestName(contestMatch[1]);
      const isVirtual   = /virtual/i.test(url);
      void handleContestCompletion(contestName, isVirtual ? 'virtual' : 'live', 1);
      return;
    }

    // Priority 2: Contest API endpoint
    const contestApiMatch = url.match(/leetcode\.com\/contest\/api\/([^/?#]+)/i);
    if (contestApiMatch) {
      const contestName = formatContestName(contestApiMatch[1]);
      void handleContestCompletion(contestName, 'live', 1);
      return;
    }

    // Priority 3: Regular problem submission (counts as virtual / practice)
    const regularMatch = url.match(/leetcode\.com\/problems\/([^/?#]+)\/submit/i);
    if (regularMatch) {
      // Format "two-sum" → "Two Sum" style name from slug
      const problemName = formatContestName(regularMatch[1]);
      void handleContestCompletion(problemName, 'virtual', 1);
    }
  },
  {
    urls: [
      // Regular problem submissions
      '*://leetcode.com/problems/*/submit/',
      '*://leetcode.com/problems/*/submit',
      // Contest problem submissions
      '*://leetcode.com/contest/*/problems/*/submit/',
      '*://leetcode.com/contest/*/problems/*/submit',
      // Contest API endpoints
      '*://leetcode.com/contest/api/*',
    ],
    types: ['xmlhttprequest'],
  }
);

// ─── Listener 2: webNavigation — contest ranking pages ────────────────────────

chrome.webNavigation.onCompleted.addListener(
  (details) => {
    if (details.frameId !== 0) return;

    const match = details.url.match(
      /leetcode\.com\/contest\/([^/?#]+)\/(virtual\/)?ranking/i
    );
    if (!match) return;

    const contestName = formatContestName(match[1]);
    const type: ContestType = match[2] ? 'virtual' : 'live';
    void handleContestCompletion(contestName, type);
  },
  {
    url: [{ hostSuffix: 'leetcode.com', pathContains: 'ranking' }],
  }
);

// ─── Listener 3: runtime.onMessage — explicit signals ────────────────────────
/**
 * Accepts signals from the content script's "Verify Today's Activity" flow
 * (after the GraphQL check passes) and from any other extension page.
 *
 * Message: { type: 'ARENA_CONTEST_COMPLETE',
 *             payload: { contestName, contestType, solvedCount } }
 */
chrome.runtime.onMessage.addListener(
  (rawMsg: unknown, _sender, sendResponse) => {
    const msg = rawMsg as {
      type?: string;
      payload?: { contestName?: string; contestType?: string; solvedCount?: number };
    };

    if (msg.type !== 'ARENA_CONTEST_COMPLETE') return false;

    const { contestName = 'Contest', contestType = 'live', solvedCount = 0 } = msg.payload ?? {};

    void handleContestCompletion(
      contestName,
      contestType as ContestType,
      solvedCount
    ).then(() => sendResponse({ success: true }));

    return true;
  }
);

console.log('[Arena] Background service worker active — hybrid tracking enabled.');

// ─── URL guard helper ─────────────────────────────────────────────────────────

/** Returns true only if the given URL belongs to leetcode.com (or a subdomain). */
function isLeetCodeUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === 'leetcode.com' || hostname.endsWith('.leetcode.com');
  } catch {
    return false;
  }
}

/** Show a short "Arena only works on LeetCode" notification. */
function notifyWrongSite() {
  const id = `arena-wrong-site-${Date.now()}`;
  chrome.notifications.create(id, {
    type:    'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title:   'LeetCode Arena',
    message: 'Arena only works on leetcode.com. Navigate there first!',
    priority: 1,
  });
  setTimeout(() => chrome.notifications.clear(id), 4000);
}

/** Forward an OPEN_ARENA message to the specified tab. */
async function sendOpenArena(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'OPEN_ARENA' });
  } catch {
    // Content script not yet ready — tab will handle Alt+A natively
  }
}

// ─── Listener 4: commands.onCommand — registered keyboard shortcut ────────────
/**
 * Handles the "toggle-arena" command (Alt+A) registered in the manifest.
 * This fires from ANY Chrome tab, so we must enforce the LeetCode-only rule.
 *
 *  • Active tab is leetcode.com  → send OPEN_ARENA to the tab
 *  • Active tab is anything else → show a notification and do nothing
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-arena') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (!isLeetCodeUrl(tab.url)) {
    notifyWrongSite();
    return;
  }

  await sendOpenArena(tab.id);
});

// ─── Listener 5: action.onClicked — toolbar icon (popup-less fallback) ────────
/**
 * Chrome fires action.onClicked only when NO default_popup is defined.
 * We keep this as a defensive fallback in case the popup fails to load.
 * Same LeetCode-only guard applies.
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!isLeetCodeUrl(tab.url)) {
    notifyWrongSite();
    return;
  }
  if (tab.id != null) await sendOpenArena(tab.id);
});