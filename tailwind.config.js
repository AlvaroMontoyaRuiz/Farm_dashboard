/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Existing names are kept so older pages pick up the new palette.
        farm: {
          green: '#1F7A4D',
          dark: '#17261D',
          beige: '#F3F5F0',
          sand: '#DDE3D6',
        },
        ink: { DEFAULT: '#17261D', soft: '#5B6B60', faint: '#8A978E' },
        field: '#F3F5F0',
        line: '#E2E7DC',
        levante: '#1F7A4D',
        finalizador: '#D98A00',
        alert: { DEFAULT: '#B4421E', bg: '#FBECE6' },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(23,38,29,0.04), 0 4px 16px -6px rgba(23,38,29,0.08)',
      },
    },
  },
  plugins: [],
};
