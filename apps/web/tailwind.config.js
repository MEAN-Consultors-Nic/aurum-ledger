/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#EEF3F9',
          100: '#D6E2EF',
          200: '#ACC2DA',
          300: '#7E9CBE',
          400: '#5577A0',
          500: '#3C5C82',
          600: '#2C476B',
          700: '#1E3A5F',
          800: '#142B47',
          900: '#0B1D32',
        },
      },
    },
  },
  plugins: [],
}
