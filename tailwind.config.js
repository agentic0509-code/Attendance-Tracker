/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep navy and professional accent colors
        navy: {
          50: '#f4f6f8',
          100: '#e7ebf0',
          200: '#c5cedb',
          300: '#95a5bd',
          400: '#5e759a',
          500: '#3e547a',
          600: '#2e4162',
          700: '#243350',
          800: '#1d2941',
          900: '#0B192C', // Deep Navy base color
          950: '#060d18',
        },
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Bright professional blue accent
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          955: '#172554',
        }
      }
    },
  },
  plugins: [],
}
