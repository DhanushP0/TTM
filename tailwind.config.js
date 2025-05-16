/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-orange-200',
    'border-orange-200',
    'text-orange-200',
    'bg-orange-300',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 