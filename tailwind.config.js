/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // BugLord dark theme palette
        'bg-dark': '#141210',
        'surface-dark': '#1E1B16',
        'card-dark': '#1E1B16',
        'primary-dark': '#6ABF5E',
        'warning-dark': '#F0B429',
        'error-dark': '#E05A44',
        'border-dark': '#3A3327',
        // BugLord light theme palette
        'bg-light': '#F5F0E8',
        'surface-light': '#EDE6D6',
        'primary-light': '#3D6B35',
        'warning-light': '#D4940A',
      },
      fontFamily: {
        mono: ['SpaceMono'],
      },
      borderRadius: {
        game: '10px',
      },
    },
  },
  plugins: [],
};
