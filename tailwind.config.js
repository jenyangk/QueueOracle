/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        background: 'rgb(10 10 10)',
        foreground: 'rgb(0 255 0)',
        border: 'rgb(51 51 51)',
        terminal: {
          bg: '#0a0a0a',
          fg: '#00ff00',
          amber: '#ffb000',
          blue: '#0080ff',
          gray: '#808080',
          border: '#333333',
        }
      }
    },
  },
  plugins: [],
}