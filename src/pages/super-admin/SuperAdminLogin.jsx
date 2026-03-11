import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { superAdminLogin } from '../../services/auth.service';

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const { setSuperAdmin } = useAuthStore();
  const [form,          setForm]          = useState({ email: '', password: '' });
  const [showPassword,  setShowPassword]  = useState(false);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Enter email and password.'); return; }
    setLoading(true);
    try {
      const admin = await superAdminLogin(form.email, form.password);
      setSuperAdmin(admin);
      navigate('/super-admin/dashboard');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const STATS = [
    { label: 'Active OHC Portals', value: '—' },
    { label: 'Total Employees', value: '—' },
    { label: 'Monthly Revenue', value: '—' },
  ];

  return (
    <div className="min-h-screen flex" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>

      {/* LEFT HERO */}
      <div className="hidden lg:flex lg:w-[58%] relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #2d6a4f 0%, #1b4332 60%, #081c15 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, #74c69d 0%, transparent 50%), radial-gradient(circle at 80% 20%, #40916c 0%, transparent 50%)' }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10 border-2 border-white" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full opacity-10 border border-white" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                <path d="M12 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H6a1 1 0 110-2h5V4a1 1 0 011-1z"/>
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-lg">OHC Portal</div>
              <div className="text-white/50 text-xs uppercase tracking-widest">Command Centre</div>
            </div>
          </div>

          <div>
            <h1 className="text-white font-bold leading-tight mb-4"
              style={{ fontSize: '2.75rem', fontFamily: '"Playfair Display", serif' }}>
              Platform<br />
              <span style={{ color: '#d4a017' }}>Command Centre</span>
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-sm mb-10">
              Manage all OHC tenants, monitor platform health, control billing, and oversee the entire SaaS operation from one dashboard.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {STATS.map(s => (
                <div key={s.label} className="bg-white/8 rounded-2xl p-4 border border-white/10">
                  <div className="text-white font-bold text-2xl mb-1">{s.value}</div>
                  <div className="text-white/40 text-xs leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-white/30 text-xs">© OHC Portal SaaS Platform</div>
        </div>
      </div>

      {/* RIGHT LOGIN */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16"
        style={{ background: '#f0f4f8' }}>
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {/* Super Admin badge */}
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #92400e, #d97706)' }}>
                <svg viewBox="0 0 16 16" fill="white" className="w-4 h-4">
                  <path d="M8 1l-.8 1.4L3 7h2v7h6V7h2L8 1z"/>
                </svg>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                  ⚡ Super Admin
                </div>
              </div>
            </div>

            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem' }}
              className="font-semibold text-gray-900 mb-1">
              Command Centre
            </h2>
            <p className="text-gray-400 text-sm mb-5">Platform administration access</p>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-3.5 py-2.5 mb-4">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path d="M8 1L1 14h14L8 1zm0 4v4H7V5h1zm-.5 6.5v-1h1v1h-1z"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email Address</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-gray-400">
                      <rect x="1" y="3" width="14" height="10" rx="2"/><path d="M1 5l7 5 7-5"/>
                    </svg>
                  </div>
                  <input type="email" autoComplete="email"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 focus:bg-white placeholder-gray-300"
                    placeholder="superadmin@ohcportal.in"
                    value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-gray-400">
                      <rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5.5a3 3 0 016 0V7"/>
                    </svg>
                  </div>
                  <input type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 focus:bg-white placeholder-gray-300"
                    placeholder="••••••••"
                    value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                  <button type="button" onClick={() => setShowPassword(s=>!s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword
                      ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>
                      : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                    }
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 mt-1"
                style={{ background: loading ? '#92400e' : 'linear-gradient(135deg, #92400e 0%, #d97706 100%)', boxShadow: '0 4px 14px rgba(146,64,14,0.30)' }}>
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Signing in…</>
                  : <>Sign In <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M6 3l5 5-5 5V3z"/></svg></>
                }
              </button>
            </form>
          </div>

          <div className="text-center mt-4">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M10 3L5 8l5 5"/></svg>
              Back to Staff Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
