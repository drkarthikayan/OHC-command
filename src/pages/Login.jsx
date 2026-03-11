import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { staffLogin, getTenants } from '../services/auth.service';

export default function Login() {
  const navigate = useNavigate();
  const { setStaffUser, setTenant } = useAuthStore();

  const [tenants,        setTenants]        = useState([]);
  const [form,           setForm]           = useState({ tenantId: '', staffId: '', password: '' });
  const [showPassword,   setShowPassword]   = useState(false);
  const [error,          setError]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    getTenants()
      .then(setTenants)
      .catch(() => setError('Could not load OHC list.'))
      .finally(() => setLoadingTenants(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const { tenantId, staffId, password } = form;
    if (!tenantId)          { setError('Please select your OHC.'); return; }
    if (!staffId || !password) { setError('Enter your Staff ID and password.'); return; }
    setLoading(true);
    try {
      const { user, tenant } = await staffLogin(tenantId, staffId, password);
      setStaffUser(user); setTenant(tenant);
      navigate('/portal/dashboard');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const FEATURES = [
    { icon: '🩺', text: 'Complete OPD & Medical Examination Records' },
    { icon: '💊', text: 'Integrated Pharmacy & Dispensary Management' },
    { icon: '📊', text: 'Interactive Health Index (IHI) Analytics' },
    { icon: '📜', text: 'Automated Medical Certificate Generation' },
    { icon: '✅', text: 'Full ILO Convention C161 Compliance' },
  ];

  return (
    <div className="min-h-screen flex" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>

      {/* ── LEFT HERO PANEL ── */}
      <div className="hidden lg:flex lg:w-[58%] relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #2d6a4f 0%, #1b4332 60%, #081c15 100%)' }}>

        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, #74c69d 0%, transparent 50%), radial-gradient(circle at 80% 20%, #40916c 0%, transparent 50%)' }} />

        {/* Large decorative circle */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10 border-2 border-white" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full opacity-10 border border-white" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                <path d="M12 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H6a1 1 0 110-2h5V4a1 1 0 011-1z"/>
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">OHC Portal</div>
              <div className="text-white/50 text-xs uppercase tracking-widest">Occupational Health Centre</div>
            </div>
          </div>

          {/* Headline */}
          <div>
            <h1 className="text-white font-bold leading-tight mb-4"
              style={{ fontSize: '2.75rem', fontFamily: '"Playfair Display", serif' }}>
              Workforce Health,<br />
              <span style={{ color: '#d4a017' }}>Managed Intelligently</span>
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-sm mb-10">
              A comprehensive occupational health management platform built for ILO C161 compliance, empowering healthier, safer workplaces.
            </p>

            {/* Feature list */}
            <div className="space-y-3.5">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-base shrink-0">
                    {f.icon}
                  </div>
                  <span className="text-white/75 text-sm">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-white/30 text-xs">© ILO C161 Compliant</div>
        </div>
      </div>

      {/* ── RIGHT LOGIN PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16"
        style={{ background: '#f0f4f8' }}>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2d6a4f, #52b788)' }}>
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M12 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H6a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
          </div>
          <div className="font-bold text-lg text-gray-900">OHC Portal</div>
        </div>

        <div className="w-full max-w-sm">
          {/* Header card area */}
          <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm border border-gray-100">
            {/* Top identity bar */}
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                <div className="w-full h-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #2d6a4f, #52b788)' }}>
                  <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                    <path d="M12 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H6a1 1 0 110-2h5V4a1 1 0 011-1z"/>
                  </svg>
                </div>
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">OHC Portal</div>
                <div className="text-xs text-gray-400 uppercase tracking-widest">Staff Portal</div>
              </div>
            </div>

            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem' }}
              className="font-semibold text-gray-900 mb-1">
              Welcome back
            </h2>
            <p className="text-gray-400 text-sm mb-5">Sign in to access your OHC portal</p>

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
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Select Your OHC
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none appearance-none transition-all focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white"
                    value={form.tenantId}
                    onChange={e => setForm({ ...form, tenantId: e.target.value })}
                    disabled={loadingTenants}>
                    <option value="">{loadingTenants ? 'Loading OHCs…' : '— Select your OHC —'}</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none">
                    <path d="M4 6l4 4 4-4"/>
                  </svg>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Staff ID
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                      className="w-4 h-4 text-gray-400">
                      <circle cx="8" cy="5.5" r="2.5"/><path d="M2 13c0-3.31 2.69-6 6-6s6 2.69 6 6"/>
                    </svg>
                  </div>
                  <input
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder-gray-300"
                    placeholder="e.g. DR001"
                    value={form.staffId}
                    onChange={e => setForm({ ...form, staffId: e.target.value })}
                    autoComplete="username" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                      className="w-4 h-4 text-gray-400">
                      <rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5.5a3 3 0 016 0V7"/>
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder-gray-300"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password" />
                  <button type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword
                      ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>
                      : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                    }
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                style={{ background: loading ? '#4a8070' : 'linear-gradient(135deg, #2d6a4f 0%, #40916c 100%)', boxShadow: '0 4px 14px rgba(45,106,79,0.35)' }}>
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Signing in…</>
                  : <>Sign In <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M6 3l5 5-5 5V3z"/></svg></>
                }
              </button>
            </form>
          </div>

          {/* Super Admin link */}
          <div className="text-center">
            <Link to="/super-admin/login"
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-gray-300">
                <path d="M8 1l-.8 1.4L3 7h2v7h6V7h2L8 1z"/>
              </svg>
              Super Admin access
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
