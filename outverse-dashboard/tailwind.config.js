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
        'background': '#1A1A1A',
        'surface': '#2D2D2D',
        'text': '#FFFFFF',
        'text-secondary': '#B3B3B3',
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
      },
    },
  },
  plugins: [],
} 