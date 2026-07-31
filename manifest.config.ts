import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: "LeetCode Arena",
  version: "1.0.0",
  description: "Gamify your daily LeetCode contest streak.",
  permissions: ["storage", "activeTab", "scripting", "webNavigation", "notifications", "webRequest"],
  host_permissions: ["https://leetcode.com/*", "https://*.leetcode.com/*"],
  icons: {
    "16":  "icon.png",
    "32":  "icon.png",
    "48":  "icon.png",
    "128": "icon.png"
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["https://leetcode.com/*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle"
    }
  ],
  action: {
    default_popup: "index.html",
    default_icon: {
      "16":  "icon.png",
      "32":  "icon.png",
      "48":  "icon.png",
      "128": "icon.png"
    }
  }
})