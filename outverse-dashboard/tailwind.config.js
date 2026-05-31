/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'lab': '#4CAF50',      // أخضر
        'bazaar': '#2196F3',   // أزرق
        'vault': '#9C27B0',    // بنفسجي
        'story': '#FF9800',    // برتقالي
        'shop': '#E91E63',     // وردي
        'background': 'rgb(var(--c-background) / <alpha-value>)',
        'surface': 'rgb(var(--c-surface) / <alpha-value>)',
        'text': 'rgb(var(--c-text) / <alpha-value>)',
        'text-secondary': 'rgb(var(--c-text-secondary) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
      },
    },
  },
  plugins: [],
} 