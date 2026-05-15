/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'Iowan Old Style', 'Georgia', 'serif'],
        display: ['Fraunces', 'Iowan Old Style', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        paper: {
          DEFAULT: '#fbf7ee',
          50: '#fdfaf3',
          100: '#f6efde',
          200: '#f2ebd9',
          300: '#ebe2cb',
          400: '#dccfae',
        },
        ink: {
          DEFAULT: '#1a1410',
          soft: '#4a3b2e',
          mute: '#7a6a55',
        },
        saffron: {
          DEFAULT: '#c2410c',
          deep: '#9a3412',
        },
        bottle: {
          DEFAULT: '#1b4332',
          light: '#2d6a4f',
        },
        tobacco: '#7c5e3c',
      },
      letterSpacing: {
        'eyebrow': '0.18em',
        'tight-display': '-0.025em',
      },
    },
  },
  plugins: [],
};
