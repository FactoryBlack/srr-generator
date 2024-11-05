/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./src/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      colors: {
        'gray-900': '#121212',
        'gray-800': '#1E1E1E',
        'gray-700': '#2A2A2A',
        'pink-500': '#FA2A55',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
