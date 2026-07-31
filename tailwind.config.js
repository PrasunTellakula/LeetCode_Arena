/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          lc: {
            bg: '#1a1a1a',          // Main background
            surface: '#282828',     // Card surfaces
            border: '#3e3e3e',      // Border color
            brand: {
              orange: '#ffa116',    // LeetCode Brand Orange
              orangeHover: '#df8d13'
            },
            status: {
              easy: '#00b8a3',
              medium: '#ffc01e',
              hard: '#ff375f',
              success: '#2cbb5d',   // Accepted green
            },
            text: {
              primary: '#eff2f6',
              secondary: '#8c8c8c',
            }
          }
        },
        fontFamily: {
          sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        }
      },
    },
    plugins: [],
  }