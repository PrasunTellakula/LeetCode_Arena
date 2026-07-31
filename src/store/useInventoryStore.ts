import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeStorage } from './chromeStorage';

interface InventoryState {
  ownedItems: string[];
  equipped: {
    theme: string;
    avatar: string;
    deskItems: string[];
  };
  buyItem: (itemId: string, cost: number, currentCoins: number) => boolean;
  equipDeskItem: (itemId: string) => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      ownedItems: ['base-terminal'],
      equipped: {
        theme: 'default',
        avatar: 'default',
        deskItems: ['base-terminal'],
      },

      buyItem: (itemId, cost, currentCoins) => {
        const state = get();
        if (currentCoins >= cost && !state.ownedItems.includes(itemId)) {
          set({ ownedItems: [...state.ownedItems, itemId] });
          return true; // Return true so UI knows to deduct coins
        }
        return false;
      },

      equipDeskItem: (itemId) => set((state) => {
        if (state.ownedItems.includes(itemId) && !state.equipped.deskItems.includes(itemId)) {
          return {
            equipped: { ...state.equipped, deskItems: [...state.equipped.deskItems, itemId] }
          };
        }
        return state;
      }),
    }),
    {
      name: 'arena-inventory-storage',
      storage: createJSONStorage(() => chromeStorage),
    }
  )
);