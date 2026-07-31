import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeStorage } from './chromeStorage';

interface UserState {
  streak: {
    current: number;
    longest: number;
    lastActiveDate: string | null;
  };
  coins: number;
  streakFreezes: number;
  xp: number;
  level: string;
  todayStatus: 'pending' | 'completed_virtual' | 'completed_live' | 'freeze_used';
  
  // Actions
  addCoins: (amount: number) => void;
  addXp: (amount: number) => void;
  useFreeze: () => boolean;
  completeContest: (type: 'live' | 'virtual') => void;
}

const calculateLevel = (xp: number) => {
  if (xp < 500) return 'Rookie';
  if (xp < 1500) return 'Pupil';
  if (xp < 3000) return 'Specialist';
  if (xp < 5000) return 'Expert';
  if (xp < 8000) return 'Candidate Master';
  if (xp < 12000) return 'Master';
  if (xp < 20000) return 'International Master';
  return 'Legendary';
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      streak: { current: 0, longest: 0, lastActiveDate: null },
      coins: 0,
      streakFreezes: 0,
      xp: 0,
      level: 'Rookie',
      todayStatus: 'pending',

      addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
      
      addXp: (amount) => set((state) => {
        const newXp = state.xp + amount;
        return { xp: newXp, level: calculateLevel(newXp) };
      }),

      useFreeze: () => {
        const state = get();
        if (state.streakFreezes > 0 && state.todayStatus === 'pending') {
          set({ streakFreezes: state.streakFreezes - 1, todayStatus: 'freeze_used' });
          return true;
        }
        return false;
      },

      completeContest: (type) => set((state) => {
        const today = new Date().toISOString().split('T')[0];
        // If already completed today, don't double-count the streak
        if (state.todayStatus === 'completed_virtual' || state.todayStatus === 'completed_live') {
           return {}; 
        }
        
        const newCurrent = state.streak.current + 1;
        return {
          todayStatus: type === 'live' ? 'completed_live' : 'completed_virtual',
          streak: {
            current: newCurrent,
            longest: Math.max(state.streak.longest, newCurrent),
            lastActiveDate: today
          }
        };
      })
    }),
    {
      name: 'arena-user-storage',
      storage: createJSONStorage(() => chromeStorage),
    }
  )
);