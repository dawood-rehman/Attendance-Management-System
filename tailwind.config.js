/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#eef5ff',
          100: '#d9e8ff',
          200: '#bbd5ff',
          300: '#8ab8ff',
          400: '#5290f7',
          500: '#2d6be4',
          600: '#1a4fd8',
          700: '#163caf',
          800: '#17338e',
          900: '#182f72',
          950: '#111d47',
        },
        surface: {
          DEFAULT: '#0f1117',
          50:  '#f8f9fc',
          100: '#f0f2f8',
          200: '#e2e6f0',
          700: '#2a2d3e',
          800: '#1e2032',
          900: '#141624',
          950: '#0c0e1a',
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)",
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
};
