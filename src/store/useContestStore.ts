import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeStorage } from './chromeStorage';

interface ContestRecord {
  id: string;
  name: string;
  date: string;
  solvedCount: number;
  durationMinutes: number;
  type: 'live' | 'virtual';
  coinsEarned: number;
}

interface ContestState {
  history: ContestRecord[];
  addRecord: (record: ContestRecord) => void;
}

export const useContestStore = create<ContestState>()(
  persist(
    (set) => ({
      history: [],
      addRecord: (record) => set((state) => ({ 
        history: [...state.history, record] 
      })),
    }),
    {
      name: 'arena-contest-storage',
      storage: createJSONStorage(() => chromeStorage),
    }
  )
);