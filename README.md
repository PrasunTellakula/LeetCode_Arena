# 🔥 LeetCode Arena

**Gamify your daily LeetCode contest streak.**

LeetCode Arena is a Chrome Extension that brings gamification to your LeetCode daily routine. It seamlessly injects a native-feeling "Arena 🔥" dashboard into LeetCode, tracks your contest completions (both live and virtual) automatically, and rewards you with XP and coins to level up and build out your virtual Hacker Desk!

## ✨ Features

- **Automated Tracking**: The extension automatically listens for successful contest submissions (via LeetCode's API) and ranks pages, eliminating the need for manual tracking.
- **Leveling System**: Earn XP for every contest you complete (200 XP for Live, 100 XP for Virtual) and climb the ranks from Rookie to Legendary.
- **Economy & Shop**: Earn coins and spend them in the Shop to buy items for your Hacker Desk (e.g., Rubber Duck, Mechanical Keyboard, Neon Terminal).
- **Streak Freezes**: Protect your hard-earned streak on days you can't compete by using Streak Freezes.
- **Activity Heatmap**: Visualize your contest activity over the last year with a beautiful GitHub-style heatmap.
- **Seamless UI Integration**: The dashboard opens right inside LeetCode using a Shadow DOM to prevent CSS conflicts, maintaining the exact native LeetCode dark mode aesthetic.
- **Keyboard Shortcut**: Press `Alt + A` anywhere on LeetCode to quickly toggle the Arena dashboard.

## 🛠️ Tech Stack

- **React 18**
- **TypeScript**
- **Tailwind CSS v4** (Injected into Shadow DOM)
- **Zustand** (State management with `chrome.storage.local` persistence)
- **Vite** + **CRXJS** (Fast development and HMR for Chrome Extensions)
- **Lucide React** (Icons)
- **React Activity Calendar** (Heatmap)

## 🚀 Installation & Development

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/leetcode-arena.git
cd leetcode-arena
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server (with HMR)

```bash
npm run dev
```

### 4. Load the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `dist` folder in your project directory.

*(Note: CRXJS provides Hot Module Replacement. Any changes you make to the code will automatically update the extension in Chrome!)*

### 5. Build for Production

```bash
npm run build
```
This will compile and bundle the extension into the `dist` folder, ready to be packed or uploaded to the Chrome Web Store.

## 🏗️ Architecture Notes

- **Content Script (`src/content/index.tsx`)**: Injects the "Arena" nav link using a persistent MutationObserver to handle LeetCode's Next.js SPA routing. Creates a Shadow DOM to host the React application and isolates Tailwind CSS.
- **Background Worker (`src/background/index.ts`)**: Handles the automatic tracking engine. It listens to `chrome.webRequest` (POST submissions) and `chrome.webNavigation` (ranking pages), then safely synchronizes state directly with `chrome.storage.local` using Zustand's expected persist format.
- **State Management (`src/store`)**: Zustand stores (`useUserStore`, `useContestStore`, `useInventoryStore`) are configured with a custom storage adapter (`src/store/chromeStorage.ts`) to persist data to Chrome's local storage automatically.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check [issues page](https://github.com/yourusername/leetcode-arena/issues).
