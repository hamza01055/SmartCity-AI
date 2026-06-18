/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        void:   '#030712',
        deep:   '#0f172a',
        mid:    '#1e293b',
        sky:    '#38bdf8',
        violet: '#818cf8',
        mint:   '#34d399',
        sun:    '#fbbf24',
        rose:   '#f87171',
      },
      boxShadow: {
        sky:    '0 0 20px 2px rgba(56,189,248,0.3)',
        mint:   '0 0 20px 2px rgba(52,211,153,0.3)',
        violet: '0 0 20px 2px rgba(129,140,248,0.3)',
      },
    },
  },
  plugins: [],
}
