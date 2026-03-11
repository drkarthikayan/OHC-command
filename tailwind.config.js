/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // OHC Pastel Clinical Light Theme
        bg:       '#f0f4f8',        // soft blue-grey page background
        surface:  '#ffffff',        // pure white cards
        surface2: '#f7f9fc',        // off-white nested surfaces
        border:   '#e2e8f0',        // light grey border
        sage:     '#6b9e8f',        // primary sage green
        sage2:    '#4a8070',        // deeper sage
        accent:   '#52b788',        // fresh mint accent
        lavender: '#7c6fcd',        // soft lavender for highlights
        rose:     '#e07a8f',        // warm rose for alerts
        amber:    '#d97706',        // warm amber for warnings
        sky:      '#3b82f6',        // clear sky blue
        text:     '#1e293b',        // dark slate body text
        muted:    '#64748b',        // slate muted text
        subtle:   '#94a3b8',        // lighter subtle text
        // semantic
        red:      '#ef4444',
        blue:     '#3b82f6',
        purple:   '#7c6fcd',
        green:    '#52b788',
        green2:   '#4a8070',
        gold:     '#d97706',
      },
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', 'sans-serif'],
        serif:   ['"Playfair Display"', 'serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'card':   '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-md':'0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
        'card-lg':'0 8px 24px 0 rgba(0,0,0,0.10), 0 4px 8px -2px rgba(0,0,0,0.06)',
        'modal':  '0 20px 60px 0 rgba(0,0,0,0.18)',
      },
      borderRadius: {
        DEFAULT: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      animation: {
        'fade-in':      'fadeIn 0.2s ease-out',
        'slide-up':     'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        'slide-in-left':'slideInLeft 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        fadeIn:      { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:     { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideInLeft: { from: { opacity: 0, transform: 'translateX(-8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
