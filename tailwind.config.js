/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        farm: {
          green: '#2f7d4f',
          dark: '#1f3f2a',
          beige: '#f4efe6',
          sand: '#d9c9a3',
        },
      },
    },
  },
  plugins: [],
};
