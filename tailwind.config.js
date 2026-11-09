/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          line: 'var(--accent-line)',
        },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        head: 'var(--head)',
        zebra: 'var(--zebra)',
        skeleton: 'var(--skeleton)',
        quote: 'var(--quote)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
        mono: 'var(--font-mono)',
      },
      borderRadius: { DEFAULT: '6px', btn: '4px', win: '8px' },
      boxShadow: { float: 'var(--shadow-float)' },
      width: { rail: '56px', list: '240px', inspector: '320px' },
      height: { topbar: '44px', status: '24px', dock: '44px' },
      keyframes: {
        sk: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.5' } },
        fadein: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: { sk: 'sk 2s ease-in-out infinite', fadein: 'fadein .18s ease-out' },
    },
  },
  plugins: [],
}
