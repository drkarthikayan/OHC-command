export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:'#f0f4f8', surface:'#ffffff', surface2:'#f7f9fc', border:'#e2e8f0',
        sage:'#6b9e8f', sage2:'#4a8070', accent:'#52b788', lavender:'#7c6fcd',
        rose:'#e07a8f', amber:'#d97706', sky:'#3b82f6',
        text:'#1e293b', muted:'#64748b', subtle:'#94a3b8',
        red:'#ef4444', blue:'#3b82f6', purple:'#7c6fcd', green:'#52b788', green2:'#4a8070', gold:'#d97706',
      },
      fontFamily: { sans:['"Plus Jakarta Sans"','sans-serif'], serif:['"Playfair Display"','serif'] },
      boxShadow: { card:'0 1px 3px rgba(0,0,0,0.06)', 'card-md':'0 4px 12px rgba(0,0,0,0.08)', 'card-lg':'0 8px 24px rgba(0,0,0,0.10)', modal:'0 20px 60px rgba(0,0,0,0.18)' },
      animation: { 'fade-in':'fadeIn 0.2s ease-out', 'slide-up':'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)', 'slide-in-left':'slideInLeft 0.25s cubic-bezier(0.34,1.56,0.64,1)' },
      keyframes: { fadeIn:{from:{opacity:0},to:{opacity:1}}, slideUp:{from:{opacity:0,transform:'translateY(12px)'},to:{opacity:1,transform:'translateY(0)'}}, slideInLeft:{from:{opacity:0,transform:'translateX(-8px)'},to:{opacity:1,transform:'translateX(0)'}} },
    },
  },
  plugins: [],
};
