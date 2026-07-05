/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        gas: '#dc2626',
        oleo: '#16a34a',
        poli: '#2563eb',
        propuesta: '#d97706',
        acento: '#0e7490',
        sidebar: '#0b1220',
        sidebaractive: '#12203a',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
