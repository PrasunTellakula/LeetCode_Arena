import { StateStorage } from 'zustand/middleware';

// Custom adapter to make Zustand work flawlessly with Chrome Extension Storage
export const chromeStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      chrome.storage.local.get(name, (result) => {
        resolve((result[name] as string | null) ?? null);
      });
    });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [name]: value }, () => resolve());
    });
  },
  removeItem: async (name: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.remove(name, () => resolve());
    });
  },
};