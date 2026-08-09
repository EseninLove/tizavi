/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: 'var(--tg-bg, #ffffff)',
          text: 'var(--tg-text, #000000)',
          hint: 'var(--tg-hint, #8e8e93)',
          link: 'var(--tg-link, #2481cc)',
          button: 'var(--tg-button, #2481cc)',

          // Было buttonText
          'button-text': 'var(--tg-button-text, #ffffff)',

          // Было secondaryBg
          'secondary-bg': 'var(--tg-secondary-bg, #f2f2f7)',

          // Было section
          'section-bg': 'var(--tg-section-bg, #ffffff)',

          separator: 'var(--tg-separator, #e5e5ea)',
        },
      },
    },
  },
  plugins: [],
};