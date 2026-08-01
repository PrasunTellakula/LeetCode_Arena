import { defineManifest } from '@crxjs/vite-plugin';
export default defineManifest({
    manifest_version: 3,
    name: "LeetCode Arena",
    version: "1.0.0",
    description: "Gamify your daily LeetCode contest streak.",
    permissions: ["storage", "activeTab", "scripting", "webNavigation", "notifications", "webRequest"],
    host_permissions: ["https://leetcode.com/*", "https://*.leetcode.com/*"],
    icons: {
        "16": "icon.png",
        "32": "icon.png",
        "48": "icon.png",
        "128": "icon.png"
    },
    // Keyboard shortcut — users can reassign in chrome://extensions/shortcuts
    commands: {
        "toggle-arena": {
            suggested_key: { default: "Alt+A" },
            description: "Toggle the LeetCode Arena overlay"
        }
    },
    background: {
        service_worker: "src/background/index.ts",
        type: "module"
    },
    content_scripts: [
        {
            // Strictly LeetCode only — no subdomains, no other sites
            matches: [
                "https://leetcode.com/*",
                "https://*.leetcode.com/*"
            ],
            js: ["src/content/index.tsx"],
            run_at: "document_idle"
        }
    ],
    action: {
        default_popup: "index.html",
        default_icon: {
            "16": "icon.png",
            "32": "icon.png",
            "48": "icon.png",
            "128": "icon.png"
        }
    }
});
