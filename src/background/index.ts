/**
 * LeetCode Arena — background/index.ts
 * MV3 Service Worker — automatic contest detection & state sync.
 *
 * Detection strategies (in priority order):
 *  1. chrome.webRequest.onCompleted  — POST to contest submit endpoints (primary)
 *  2. chrome.webNavigation.onCompleted — arrival at contest ranking pages (fallback)
 *  3. chrome.runtime.onMessage       — explicit signals from content/popup
 *
 * Storage format matches Zustand's persist middleware exactly:
 *   key: 'arena-user-storage'    → JSON string of { state: UserState,    version: 0 }
 *   key: 'arena-contest-storage' → JSON string of { state: ContestState, version: 0 }
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

/** Format "weekly-contest-412" → "Weekly Contest 412" */
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
 * Called whenever a contest-completion event is detected.
 * Idempotency-guarded: same-day completions are ignored.
 */
async function handleContestCompletion(
  contestName: string,
  type: ContestType,
  solvedCount = 0
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const userSlice    = await readSlice<UserState>(KEYS.user, DEFAULT_USER);
  const u            = userSlice.state;

  // Guard: already counted today
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

  // Celebrate!
  const notifId = `arena-${Date.now()}`;
  chrome.notifications.create(notifId, {
    type:    'basic',
    iconUrl: chrome.runtime.getURL('favicon.svg'),
    title:   '🔥 Arena — Contest Complete!',
    message: `${contestName}  ✓  |  +${xpEarned} XP  ·  +${coinsEarned} 🪙  |  🔥 ${newCurrent}-day streak`,
    priority: 2,
  });
  setTimeout(() => chrome.notifications.clear(notifId), 8000);

  console.log(`[Arena BG] "${contestName}" (${type}) done. Streak: ${newCurrent}`);
}

// ─── Listener 1: webRequest — contest submission POSTs (primary) ──────────────
/**
 * LeetCode's contest submission endpoint:
 *   POST https://leetcode.com/contest/{name}/problems/{slug}/submit/
 *
 * A 200 response means the submission was accepted by the server (i.e., the
 * user actively competed — the actual verdict doesn't matter for streak purposes).
 *
 * Also watches the general /problems/ submit path for practice-mode sessions
 * under a virtual contest umbrella.
 */
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.method !== 'POST') return;
    if (details.statusCode !== 200) return;

    // Contest submission: /contest/{name}/problems/{slug}/submit/
    const contestMatch = details.url.match(
      /leetcode\.com\/contest\/([^/?#]+)\/problems\/[^/?#]+\/submit/i
    );
    if (contestMatch) {
      const contestName = formatContestName(contestMatch[1]);
      // Virtual contests typically have "virtual" in the URL or query string
      const isVirtual = /virtual/i.test(details.url);
      void handleContestCompletion(contestName, isVirtual ? 'virtual' : 'live', 1);
    }
  },
  {
    urls: [
      '*://leetcode.com/contest/*/problems/*/submit/',
      '*://leetcode.com/contest/*/problems/*/submit',
    ],
    types: ['xmlhttprequest'],
  }
);

// ─── Listener 2: webNavigation — contest ranking pages (fallback) ─────────────
/**
 * Fires when the user navigates to a contest ranking/results page, which is a
 * reliable secondary signal for "the user finished a contest".
 *
 * Examples:
 *   https://leetcode.com/contest/weekly-contest-412/ranking/
 *   https://leetcode.com/contest/biweekly-contest-136/virtual/ranking/
 */
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
 * Accepts manual signals from the content script or popup.
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

    const { contestName = 'Contest', contestType = 'virtual', solvedCount = 0 } = msg.payload ?? {};

    void handleContestCompletion(
      contestName,
      contestType as ContestType,
      solvedCount
    ).then(() => sendResponse({ success: true }));

    return true; // Keep channel open for async response
  }
);

console.log('[Arena] Background service worker active.');