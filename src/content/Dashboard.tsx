/**
 * LeetCode Arena — Dashboard.tsx
 * Main overlay UI rendered inside the Shadow DOM on LeetCode pages.
 * Reads from Zustand stores; tracking is fully automatic.
 */

import { useState, useEffect, useMemo } from 'react';
import { ActivityCalendar } from 'react-activity-calendar';
import {
  Flame,
  Snowflake,
  CheckCircle,
  ExternalLink,
  Trophy,
  BarChart3,
  Coins,
  X,
  ShoppingBag,
  Monitor,
} from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { useContestStore } from '../store/useContestStore';
import { useInventoryStore } from '../store/useInventoryStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardProps {
  onClose: () => void;
}

interface CalendarActivity {
  date: string;
  count: number;
  level: number;
}

interface ContestRecord {
  id: string;
  name: string;
  date: string;
  solvedCount: number;
  type: 'live' | 'virtual';
  coinsEarned: number;
  durationMinutes: number;
}

// ─── Shop catalog ─────────────────────────────────────────────────────────────

interface ShopItem {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly cost: number;
  readonly desc: string;
}

const SHOP_CATALOG: ShopItem[] = [
  { id: 'base-terminal',       name: 'Terminal',        icon: '🖥️',  cost: 0,   desc: 'Your starter workstation'  },
  { id: 'rubber-duck',         name: 'Rubber Duck',     icon: '🦆',  cost: 75,  desc: 'Debug by explaining'       },
  { id: 'coffee-mug',          name: 'Coffee Mug',      icon: '☕',  cost: 100, desc: 'Premium fuel supply'       },
  { id: 'plant-pot',           name: 'Desk Plant',      icon: '🪴',  cost: 120, desc: 'Bring nature inside'       },
  { id: 'mechanical-keyboard', name: 'Mech Keyboard',   icon: '⌨️',  cost: 200, desc: 'Click-clack supremacy'     },
  { id: 'action-figure',       name: 'Action Figure',   icon: '🤖',  cost: 250, desc: 'Motivational companion'    },
  { id: 'neon-terminal',       name: 'Neon Terminal',   icon: '🌟',  cost: 350, desc: 'Cyberpunk desk setup'      },
  { id: 'gaming-chair',        name: 'Gaming Chair',    icon: '🪑',  cost: 500, desc: 'Ergonomic excellence'      },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_THRESHOLDS: { name: string; min: number; max: number }[] = [
  { name: 'Rookie',               min: 0,     max: 500   },
  { name: 'Pupil',                min: 500,   max: 1500  },
  { name: 'Specialist',           min: 1500,  max: 3000  },
  { name: 'Expert',               min: 3000,  max: 5000  },
  { name: 'Candidate Master',     min: 5000,  max: 8000  },
  { name: 'Master',               min: 8000,  max: 12000 },
  { name: 'International Master', min: 12000, max: 20000 },
  { name: 'Legendary',            min: 20000, max: 25000 },
];

const LEVEL_COLORS: Record<string, string> = {
  'Rookie':               'text-[#8c8c8c] border-[#555]',
  'Pupil':                'text-[#1ccc84] border-[#1ccc84]',
  'Specialist':           'text-[#00b8a3] border-[#00b8a3]',
  'Expert':               'text-[#60a5fa] border-[#60a5fa]',
  'Candidate Master':     'text-[#c084fc] border-[#c084fc]',
  'Master':               'text-[#ffa116] border-[#ffa116]',
  'International Master': 'text-[#ff375f] border-[#ff375f]',
  'Legendary':            'text-[#ffd700] border-[#ffd700]',
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getLevelThreshold(levelName: string) {
  return LEVEL_THRESHOLDS.find((t) => t.name === levelName) ?? LEVEL_THRESHOLDS[0];
}

function getXpProgress(xp: number, levelName: string): number {
  if (levelName === 'Legendary') return 100;
  const t = getLevelThreshold(levelName);
  return Math.max(0, Math.min(100, ((xp - t.min) / (t.max - t.min)) * 100));
}

function buildCalendarData(history: { date: string }[]): CalendarActivity[] {
  const today = new Date();
  const start = new Date(today);
  start.setFullYear(today.getFullYear() - 1);
  const startStr = start.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const dateMap = new Map<string, number>();
  history.forEach(({ date }) => {
    if (date >= startStr) dateMap.set(date, (dateMap.get(date) ?? 0) + 1);
  });

  const entries: CalendarActivity[] = [];
  if (!dateMap.has(startStr)) entries.push({ date: startStr, count: 0, level: 0 });
  dateMap.forEach((count, date) => entries.push({ date, count, level: Math.min(count * 2, 4) }));
  if (!dateMap.has(todayStr)) entries.push({ date: todayStr, count: 0, level: 0 });

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── LevelBadge ───────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: string }) {
  const cls = LEVEL_COLORS[level] ?? 'text-[#8c8c8c] border-[#555]';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${cls} whitespace-nowrap`}>
      {level}
    </span>
  );
}

// ─── XpBar ────────────────────────────────────────────────────────────────────

function XpBar({ xp, level }: { xp: number; level: string }) {
  const t   = getLevelThreshold(level);
  const pct = getXpProgress(xp, level);
  const isMax = level === 'Legendary';
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <div className="flex-1 min-w-[64px] max-w-[140px]">
        <div className="h-1.5 bg-lc-border rounded-full overflow-hidden">
          <div
            className="h-full bg-lc-brand-orange rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-lc-text-secondary whitespace-nowrap tabular-nums">
        {isMax ? `${xp.toLocaleString()} XP` : `${xp.toLocaleString()} / ${t.max.toLocaleString()}`}
      </span>
    </div>
  );
}

// ─── DailyActionCard (auto-tracking — no manual buttons) ──────────────────────

function DailyActionCard() {
  const { streak, streakFreezes, todayStatus, useFreeze } = useUserStore();

  const today          = getToday();
  const completedToday = streak.lastActiveDate === today &&
    (todayStatus === 'completed_live' || todayStatus === 'completed_virtual');
  const frozenToday    = streak.lastActiveDate === today && todayStatus === 'freeze_used';

  // ── Completed live ────────────────────────────────────────
  if (completedToday && todayStatus === 'completed_live') {
    return (
      <div className="bg-lc-surface border border-lc-brand-orange/30 rounded-lg p-5">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle className="w-5 h-5 text-lc-brand-orange flex-shrink-0" />
          <h3 className="font-semibold text-lc-text-primary">Live Contest Complete!</h3>
        </div>
        <p className="text-sm text-lc-text-secondary">
          You competed live today.{' '}
          <span className="text-lc-brand-orange font-medium">+200 XP · +100 🪙</span> awarded.
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-lc-brand-orange">
          <Flame className="w-4 h-4" />
          <span>{streak.current}-day streak — keep going!</span>
        </div>
      </div>
    );
  }

  // ── Completed virtual ─────────────────────────────────────
  if (completedToday && todayStatus === 'completed_virtual') {
    return (
      <div className="bg-lc-surface border border-lc-status-success/30 rounded-lg p-5">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle className="w-5 h-5 text-lc-status-success flex-shrink-0" />
          <h3 className="font-semibold text-lc-text-primary">Virtual Session Complete!</h3>
        </div>
        <p className="text-sm text-lc-text-secondary">
          Great work on the virtual contest.{' '}
          <span className="text-lc-status-success font-medium">+100 XP · +50 🪙</span> awarded.
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-lc-status-success">
          <Flame className="w-4 h-4" />
          <span>{streak.current}-day streak maintained.</span>
        </div>
      </div>
    );
  }

  // ── Frozen ────────────────────────────────────────────────
  if (frozenToday) {
    return (
      <div className="bg-lc-surface border border-[#60a5fa]/30 rounded-lg p-5">
        <div className="flex items-center gap-3 mb-2">
          <Snowflake className="w-5 h-5 text-[#60a5fa] flex-shrink-0" />
          <h3 className="font-semibold text-lc-text-primary">Streak Frozen</h3>
        </div>
        <p className="text-sm text-lc-text-secondary">
          A freeze protected your {streak.current}-day streak today.{' '}
          <span className="text-[#60a5fa]">
            {streakFreezes} freeze{streakFreezes !== 1 ? 's' : ''} remaining.
          </span>
        </p>
      </div>
    );
  }

  // ── Pending ───────────────────────────────────────────────
  return (
    <div className="bg-lc-surface border border-lc-border rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        {/* Left */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lc-text-primary mb-1">Today's Challenge</h3>
          <p className="text-sm text-lc-text-secondary mb-1">
            Compete to extend your streak and earn XP &amp; coins.
          </p>
          <p className="text-xs text-lc-text-secondary mb-4 flex items-center gap-1">
            <span className="text-lc-status-success">●</span>
            Auto-tracked — just compete and we'll detect it!
          </p>

          <a
            href="https://leetcode.com/contest/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-lc-brand-orange hover:bg-lc-brand-orangeHover text-black font-semibold text-sm px-4 py-2 rounded-md transition-colors select-none"
          >
            Browse Contests
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>

        {/* Right — Streak pill */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-1">
          <div className="flex items-center gap-1 text-lc-brand-orange">
            <Flame className="w-5 h-5" />
            <span className="text-2xl font-bold tabular-nums">{streak.current}</span>
          </div>
          <span className="text-xs text-lc-text-secondary">day streak</span>
        </div>
      </div>

      {/* Freeze row */}
      {streakFreezes > 0 && (
        <div className="mt-4 pt-4 border-t border-lc-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-lc-text-secondary">
            <Snowflake className="w-4 h-4 text-[#60a5fa]" />
            <span>
              {streakFreezes} freeze{streakFreezes !== 1 ? 's' : ''} available
            </span>
          </div>
          <button
            type="button"
            onClick={() => useFreeze()}
            className="text-xs text-[#60a5fa] hover:text-blue-300 border border-[#60a5fa]/40 hover:border-[#60a5fa] px-2.5 py-1 rounded transition-colors"
          >
            Use Freeze
          </button>
        </div>
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-lc-surface border border-lc-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-lc-text-secondary mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-lc-text-primary tabular-nums">{value}</div>
      {sub && <div className="text-xs text-lc-text-secondary mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function Heatmap({ history }: { history: { date: string }[] }) {
  const data = useMemo(() => buildCalendarData(history), [history]);

  if (data.length < 2) {
    return (
      <div className="bg-lc-surface border border-lc-border rounded-lg p-5 flex items-center justify-center h-28">
        <p className="text-lc-text-secondary text-sm text-center">
          Compete in your first contest to start tracking activity.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-lc-surface border border-lc-border rounded-lg p-5 overflow-x-auto">
      <ActivityCalendar
        data={data}
        colorScheme="dark"
        theme={{ dark: ['#282828', '#14532d', '#166534', '#15803d', '#2cbb5d'] }}
        blockSize={12}
        blockMargin={3}
        fontSize={11}
        style={{ color: '#8c8c8c' }}
      />
    </div>
  );
}

// ─── RecentHistory ────────────────────────────────────────────────────────────

function RecentHistory({ history }: { history: ContestRecord[] }) {
  const recent = useMemo(() => [...history].reverse().slice(0, 5), [history]);
  if (recent.length === 0) return null;

  return (
    <div className="bg-lc-surface border border-lc-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-lc-border">
        <h3 className="text-sm font-semibold text-lc-text-primary">Recent Contests</h3>
      </div>
      <div className="divide-y divide-lc-border">
        {recent.map((r) => (
          <div
            key={r.id}
            className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-lc-border/20 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.type === 'live' ? 'bg-lc-brand-orange' : 'bg-lc-status-success'}`} />
              <div className="min-w-0">
                <p className="text-sm text-lc-text-primary truncate">{r.name}</p>
                <p className="text-xs text-lc-text-secondary">{r.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 text-sm">
              {r.solvedCount > 0 && <span className="text-lc-text-secondary">{r.solvedCount} solved</span>}
              <span className="text-lc-brand-orange font-medium">+{r.coinsEarned} 🪙</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                r.type === 'live'
                  ? 'text-lc-brand-orange border-lc-brand-orange/30 bg-lc-brand-orange/10'
                  : 'text-lc-status-success border-lc-status-success/30 bg-lc-status-success/10'
              }`}>
                {r.type}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ShopItemCard ─────────────────────────────────────────────────────────────

function ShopItemCard({
  item,
  isOwned,
  isEquipped,
  canAfford,
  justPurchased,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  isOwned: boolean;
  isEquipped: boolean;
  canAfford: boolean;
  justPurchased: boolean;
  onBuy: () => void;
  onEquip: () => void;
}) {
  const canBuy = !isOwned && item.cost > 0;

  const borderCls = isEquipped
    ? 'border-lc-brand-orange/60'
    : isOwned
      ? 'border-lc-status-success/40'
      : 'border-lc-border';

  return (
    <div className={`bg-lc-bg border ${borderCls} rounded-lg p-3 flex flex-col gap-2 relative`}>
      {/* Equipped badge */}
      {isEquipped && (
        <span className="absolute top-1.5 right-1.5 text-[8px] font-bold bg-lc-brand-orange text-black px-1 rounded leading-4">
          ON DESK
        </span>
      )}

      <div className="text-center text-3xl leading-none pt-1">{item.icon}</div>

      <div className="text-center">
        <p className="text-xs font-semibold text-lc-text-primary">{item.name}</p>
        <p className="text-[10px] text-lc-text-secondary mt-0.5 leading-tight">{item.desc}</p>
      </div>

      <div className="mt-auto pt-1">
        {/* Not purchasable (free or already owned) */}
        {!canBuy && (
          isEquipped ? (
            <p className="text-center text-[10px] font-bold text-lc-brand-orange py-1">✓ Equipped</p>
          ) : (
            <button
              type="button"
              onClick={onEquip}
              className="w-full text-[10px] font-semibold py-1 rounded border border-lc-status-success/40 hover:border-lc-status-success text-lc-status-success transition-colors"
            >
              Equip
            </button>
          )
        )}

        {/* Purchasable */}
        {canBuy && (
          justPurchased ? (
            <p className="text-center text-[10px] font-bold text-lc-status-success py-1 animate-pulse">
              ✓ Purchased!
            </p>
          ) : (
            <button
              type="button"
              onClick={onBuy}
              disabled={!canAfford}
              title={canAfford ? undefined : 'Not enough coins'}
              className={`w-full text-[10px] font-bold py-1 rounded transition-colors ${
                canAfford
                  ? 'bg-lc-brand-orange hover:bg-lc-brand-orangeHover text-black cursor-pointer'
                  : 'bg-lc-border text-lc-text-secondary cursor-not-allowed'
              }`}
            >
              {item.cost} 🪙{!canAfford && ' ↑'}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ─── HackerDesk ───────────────────────────────────────────────────────────────

function HackerDesk() {
  const { ownedItems, equipped, buyItem, equipDeskItem } = useInventoryStore();
  const { coins, addCoins } = useUserStore();
  const [lastPurchased, setLastPurchased] = useState<string | null>(null);

  function handleBuy(id: string, cost: number) {
    if (buyItem(id, cost, coins)) {
      addCoins(-cost);
      setLastPurchased(id);
      setTimeout(() => setLastPurchased(null), 2500);
    }
  }

  const deskItems = equipped.deskItems
    .map((id) => SHOP_CATALOG.find((item) => item.id === id))
    .filter((item): item is ShopItem => item !== undefined);

  return (
    <div className="space-y-4">
      {/* ── Your Desk ──────────────────────────────────────── */}
      <div className="bg-lc-surface border border-lc-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="w-4 h-4 text-lc-text-secondary" />
          <h3 className="text-sm font-semibold text-lc-text-primary">Your Hacker Desk</h3>
        </div>

        {deskItems.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {deskItems.map((item) => (
              <div key={item.id} className="flex flex-col items-center gap-1 text-center">
                <span className="text-3xl">{item.icon}</span>
                <span className="text-[10px] text-lc-text-secondary">{item.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-lc-text-secondary">
            Your desk is empty — buy items in the shop below and equip them!
          </p>
        )}
      </div>

      {/* ── Shop ───────────────────────────────────────────── */}
      <div className="bg-lc-surface border border-lc-border rounded-lg overflow-hidden">
        {/* Shop header */}
        <div className="px-5 py-3 border-b border-lc-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-lc-text-secondary" />
            <h3 className="text-sm font-semibold text-lc-text-primary">Shop</h3>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Coins className="w-4 h-4 text-lc-brand-orange" />
            <span className="font-semibold text-lc-text-primary tabular-nums">{coins.toLocaleString()}</span>
            <span className="text-lc-text-secondary text-xs">coins</span>
          </div>
        </div>

        {/* Item grid */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SHOP_CATALOG.map((item) => {
            const isOwned    = ownedItems.includes(item.id);
            const isEquipped = equipped.deskItems.includes(item.id);
            const canAfford  = coins >= item.cost;
            const justPurchased = lastPurchased === item.id;

            return (
              <ShopItemCard
                key={item.id}
                item={item}
                isOwned={isOwned}
                isEquipped={isEquipped}
                canAfford={canAfford}
                justPurchased={justPurchased}
                onBuy={() => handleBuy(item.id, item.cost)}
                onEquip={() => equipDeskItem(item.id)}
              />
            );
          })}
        </div>

        <p className="text-[11px] text-lc-text-secondary text-center px-5 pb-4">
          Earn coins by competing in contests. Spending is permanent.
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard (root) ─────────────────────────────────────────────────────────

export function Dashboard({ onClose }: DashboardProps) {
  const { streak, coins, xp, level } = useUserStore();
  const { history } = useContestStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useUserStore.persist.hasHydrated()) { setHydrated(true); return; }
    const unsub = useUserStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  return (
    <div className="min-h-screen bg-lc-bg text-lc-text-primary font-sans">

      {/* ── Sticky header ──────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-lc-bg border-b border-lc-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Flame className="w-5 h-5 text-lc-brand-orange" />
            <span className="font-bold text-lc-text-primary tracking-tight">Arena</span>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <LevelBadge level={level} />
            <XpBar xp={xp} level={level} />
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-sm" title="Coins">
              <Coins className="w-4 h-4 text-lc-brand-orange" />
              <span className="font-semibold tabular-nums">{coins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 text-sm" title="Streak">
              <Flame className="w-4 h-4 text-lc-brand-orange" />
              <span className="font-semibold tabular-nums">{streak.current}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Arena"
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-lc-border transition-colors text-lc-text-secondary hover:text-lc-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────── */}
      {!hydrated ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-lc-text-secondary text-sm animate-pulse">Loading your stats…</p>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto p-4 space-y-4">

          {/* Row 1: Daily card + stat tiles */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DailyActionCard />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <StatCard
                icon={<Trophy className="w-3.5 h-3.5" />}
                label="Best Streak"
                value={streak.longest}
                sub="days"
              />
              <StatCard
                icon={<BarChart3 className="w-3.5 h-3.5" />}
                label="Total Contests"
                value={history.length}
                sub="all time"
              />
            </div>
          </div>

          {/* Row 2: Activity heatmap */}
          <section>
            <h2 className="text-xs font-semibold text-lc-text-secondary uppercase tracking-widest mb-2 px-0.5">
              Activity
            </h2>
            <Heatmap history={history} />
          </section>

          {/* Row 3: Recent contests */}
          {history.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-lc-text-secondary uppercase tracking-widest mb-2 px-0.5">
                Recent Contests
              </h2>
              <RecentHistory history={history} />
            </section>
          )}

          {/* Row 4: Hacker Desk & Shop */}
          <section>
            <h2 className="text-xs font-semibold text-lc-text-secondary uppercase tracking-widest mb-2 px-0.5">
              Hacker Desk &amp; Shop
            </h2>
            <HackerDesk />
          </section>

        </main>
      )}
    </div>
  );
}
