/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./routes/**/*.{ts,tsx}",
    "./islands/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep navy for text
        navy: {
          900: '#1e293b',
          800: '#334155',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Courier Prime', 'monospace'],
      },
    },
  },
  plugins: [],
}
