/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // OHC Dark Forest Green Design System
        bg:       '#0d1a14',
        surface:  '#132010',
        surface2: '#1a2d1a',
        border:   '#2a3d2a',
        green:    '#2d6a4f',
        green2:   '#40916c',
        accent:   '#74c69d',
        gold:     '#d4a017',
        red:      '#e05252',
        amber:    '#e08c2c',
        blue:     '#4a9eca',
        purple:   '#b06af0',
        text:     '#e8f0e8',
        muted:    '#7a9a7a',
      },
      fontFamily: {
        sans:  ['DM Sans', 'sans-serif'],
        serif: ['DM Serif Display', 'serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
      },
    },
  },
  plugins: [],
};
