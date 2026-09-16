/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: 'var(--tg-bg, #0b2a13)',
          text: 'var(--tg-text, #ffffff)',
          hint: 'var(--tg-hint, #93c39d)',
          link: 'var(--tg-link, #2fce63)',
          button: 'var(--tg-button, #ffffff)',

          // Было buttonText
          'button-text': 'var(--tg-button-text, #0b2a13)',

          // Было secondaryBg
          'secondary-bg': 'var(--tg-secondary-bg, #1a6b2e)',

          // Было section
          'section-bg': 'var(--tg-section-bg, #123a1e)',

          separator: 'var(--tg-separator, #1f5029)',
        },
      },
    },
  },
  plugins: [],
};