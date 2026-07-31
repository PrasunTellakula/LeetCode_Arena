/**
 * LeetCode Arena — Extension Popup (App.tsx)
 * A compact, dark-mode mini-dashboard that surfaces the user's core stats
 * and routes them to the Arena dashboard on LeetCode.
 */

import { useState, useEffect } from 'react'
import { Flame, Coins, Clock, CheckCircle, Snowflake } from 'lucide-react'
import { useUserStore } from './store/useUserStore'

// ─── Level config (mirrors useUserStore) ─────────────────────────────────────

const LEVELS = [
  { name: 'Rookie',               min: 0,     max: 500   },
  { name: 'Pupil',                min: 500,   max: 1500  },
  { name: 'Specialist',           min: 1500,  max: 3000  },
  { name: 'Expert',               min: 3000,  max: 5000  },
  { name: 'Candidate Master',     min: 5000,  max: 8000  },
  { name: 'Master',               min: 8000,  max: 12000 },
  { name: 'International Master', min: 12000, max: 20000 },
  { name: 'Legendary',            min: 20000, max: 25000 },
] as const

function getLevelInfo(name: string) {
  return LEVELS.find((l) => l.name === name) ?? LEVELS[0]
}

function getNextLevelName(name: string): string {
  const idx = LEVELS.findIndex((l) => l.name === name)
  return LEVELS[idx + 1]?.name ?? 'Legendary'
}

function xpProgress(xp: number, level: string): number {
  if (level === 'Legendary') return 100
  const l = getLevelInfo(level)
  return Math.max(0, Math.min(100, ((xp - l.min) / (l.max - l.min)) * 100))
}

const LEVEL_COLORS: Record<string, string> = {
  'Rookie':               'text-[#8c8c8c]',
  'Pupil':                'text-[#1ccc84]',
  'Specialist':           'text-[#00b8a3]',
  'Expert':               'text-[#60a5fa]',
  'Candidate Master':     'text-[#c084fc]',
  'Master':               'text-[#ffa116]',
  'International Master': 'text-[#ff375f]',
  'Legendary':            'text-[#ffd700]',
}

// ─── Today-status display config ─────────────────────────────────────────────

type TodayStatus = 'pending' | 'completed_virtual' | 'completed_live' | 'freeze_used'

const STATUS_CONFIG: Record<TodayStatus, {
  Icon: typeof Clock
  text: string
  cls: string
}> = {
  pending:           { Icon: Clock,        text: 'No contest yet today',      cls: 'text-lc-text-secondary' },
  completed_virtual: { Icon: CheckCircle,  text: 'Virtual session complete',  cls: 'text-lc-status-success' },
  completed_live:    { Icon: CheckCircle,  text: 'Live contest complete',      cls: 'text-lc-brand-orange'   },
  freeze_used:       { Icon: Snowflake,    text: 'Streak frozen for today',   cls: 'text-[#60a5fa]'         },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const { streak, coins, xp, level, todayStatus } = useUserStore()
  const [hydrated, setHydrated] = useState(false)

  // Wait for chrome.storage.local hydration
  useEffect(() => {
    if (useUserStore.persist.hasHydrated()) { setHydrated(true); return }
    const unsub = useUserStore.persist.onFinishHydration(() => setHydrated(true))
    return unsub
  }, [])

  /**
   * If an existing LeetCode tab is open, focus it and send the OPEN_ARENA
   * message so the content script opens the dashboard automatically.
   * Otherwise, open a fresh leetcode.com tab.
   */
  async function handleOpenArena() {
    try {
      const tabs = await chrome.tabs.query({ url: '*://leetcode.com/*' })
      if (tabs.length > 0 && tabs[0].id != null) {
        chrome.tabs.update(tabs[0].id, { active: true })
        chrome.tabs.sendMessage(tabs[0].id, { type: 'OPEN_ARENA' }).catch(() => {})
      } else {
        chrome.tabs.create({ url: 'https://leetcode.com' })
      }
    } catch {
      chrome.tabs.create({ url: 'https://leetcode.com' })
    }
    window.close()
  }

  const pct      = xpProgress(xp, level)
  const lvlInfo  = getLevelInfo(level)
  const nextLvl  = getNextLevelName(level)
  const xpToNext = level === 'Legendary' ? 0 : lvlInfo.max - xp
  const status   = STATUS_CONFIG[todayStatus as TodayStatus] ?? STATUS_CONFIG.pending
  const StatusIcon = status.Icon

  return (
    <div className="w-80 bg-lc-bg text-lc-text-primary select-none">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-lc-border">
        <Flame className="w-4 h-4 text-lc-brand-orange flex-shrink-0" />
        <span className="font-bold text-sm flex-1 tracking-tight">LeetCode Arena</span>
        <span className="text-[10px] text-lc-text-secondary">Alt+A on LC</span>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      {!hydrated ? (
        <div className="flex items-center justify-center py-16">
          <span className="text-lc-text-secondary text-xs animate-pulse">Loading stats…</span>
        </div>
      ) : (
        <div className="p-4 space-y-3">

          {/* Level + XP bar */}
          <div className="bg-lc-surface border border-lc-border rounded-lg p-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className={`font-bold text-sm ${LEVEL_COLORS[level] ?? 'text-lc-text-primary'}`}>
                {level}
              </span>
              <span className="text-[11px] text-lc-text-secondary tabular-nums">
                {xp.toLocaleString()} XP
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-lc-border rounded-full overflow-hidden">
              <div
                className="h-full bg-lc-brand-orange rounded-full transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>

            {level !== 'Legendary' && (
              <p className="text-[10px] text-lc-text-secondary mt-1">
                {xpToNext.toLocaleString()} XP to{' '}
                <span className={LEVEL_COLORS[nextLvl] ?? ''}>{nextLvl}</span>
              </p>
            )}
          </div>

          {/* Streak + Coins */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-lc-surface border border-lc-border rounded-lg px-3 py-2.5 flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-lc-brand-orange flex-shrink-0" />
              <div>
                <p className="text-lg font-bold leading-none tabular-nums">{streak.current}</p>
                <p className="text-[10px] text-lc-text-secondary mt-0.5">Day Streak</p>
              </div>
            </div>
            <div className="bg-lc-surface border border-lc-border rounded-lg px-3 py-2.5 flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-lc-brand-orange flex-shrink-0" />
              <div>
                <p className="text-lg font-bold leading-none tabular-nums">{coins.toLocaleString()}</p>
                <p className="text-[10px] text-lc-text-secondary mt-0.5">Coins</p>
              </div>
            </div>
          </div>

          {/* Best streak */}
          <p className="text-[11px] text-lc-text-secondary px-0.5">
            Best streak:{' '}
            <span className="text-lc-text-primary font-semibold">{streak.longest}</span> days
          </p>

          {/* Today's status */}
          <div className="flex items-center gap-2 py-0.5">
            <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 ${status.cls}`} />
            <span className={`text-xs ${status.cls}`}>{status.text}</span>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleOpenArena}
            className="w-full flex items-center justify-center gap-2 bg-lc-brand-orange hover:bg-lc-brand-orangeHover text-black font-bold text-sm py-2.5 rounded-md transition-colors cursor-pointer"
          >
            <Flame className="w-4 h-4" />
            Open LeetCode Arena
          </button>

        </div>
      )}
    </div>
  )
}
