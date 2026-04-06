/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      colors: {
        dark: '#1a1a2e',
        'dark-light': '#2a2a3e',
        teal: '#00d4aa',
        'teal-dark': '#00b89a',
      },
    },
  },
  plugins: [],
}
