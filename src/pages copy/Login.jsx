import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { staffLogin, getTenants } from '../services/auth.service';

export default function Login() {
  const navigate = useNavigate();
  const { setStaffUser, setTenant } = useAuthStore();

  const [tenants,       setTenants]       = useState([]);
  const [form,          setForm]          = useState({ tenantId: '', staffId: '', password: '' });
  const [showPassword,  setShowPassword]  = useState(false);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [loadingTenants,setLoadingTenants]= useState(true);

  useEffect(() => {
    getTenants()
      .then(setTenants)
      .catch(() => setError('Could not load OHC list. Check connection.'))
      .finally(() => setLoadingTenants(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const { tenantId, staffId, password } = form;
    if (!tenantId) { setError('Please select your OHC.'); return; }
    if (!staffId || !password) { setError('Enter your Staff ID and password.'); return; }
    setLoading(true);
    try {
      const { user, tenant } = await staffLogin(tenantId, staffId, password);
      setStaffUser(user);
      setTenant(tenant);
      navigate('/portal/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg bg-mesh flex items-center justify-center p-4">

      {/* Decorative blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(107,158,143,0.25) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
      <div className="fixed bottom-0 left-0 w-80 h-80 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,111,205,0.20) 0%, transparent 70%)', transform: 'translate(-30%,30%)' }} />

      <div className="w-full max-w-sm relative animate-slide-up">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-card-md"
            style={{ background: 'linear-gradient(135deg, #6b9e8f 0%, #52b788 100%)' }}>
            <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
              <path d="M12 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H6a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-text">OHC Portal</h1>
          <p className="text-muted text-sm mt-1">Occupational Health Centre</p>
        </div>

        {/* Card */}
        <div className="card shadow-card-lg p-7">
          <h2 className="font-semibold text-text text-lg mb-1">Sign in to your portal</h2>
          <p className="text-muted text-sm mb-6">Enter your credentials to continue</p>

          {error && (
            <div className="flex items-start gap-2.5 bg-rose/8 border border-rose/20 text-rose text-sm rounded-xl px-3.5 py-3 mb-5 animate-fade-in">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
                <path d="M8 1L1 14h14L8 1zm0 4v4.5H7V5h1zm-.5 6.5v-1h1v1h-1z"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="field-label">Select Your OHC</label>
              <div className="relative">
                <select className="field-input appearance-none pr-9"
                  value={form.tenantId}
                  onChange={e => setForm({...form, tenantId: e.target.value})}
                  disabled={loadingTenants}>
                  <option value="">{loadingTenants ? 'Loading OHCs…' : '— Select your OHC —'}</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <svg viewBox="0 0 16 16" fill="currentColor" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-subtle pointer-events-none">
                  <path d="M4 6l4 4 4-4"/>
                </svg>
              </div>
            </div>

            <div>
              <label className="field-label">Staff ID</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <circle cx="8" cy="5.5" r="2.5"/><path d="M2 13c0-3.31 2.69-6 6-6s6 2.69 6 6"/>
                  </svg>
                </div>
                <input className="field-input pl-10" placeholder="e.g. DR001"
                  value={form.staffId}
                  onChange={e => setForm({...form, staffId: e.target.value})}
                  autoComplete="username" />
              </div>
            </div>

            <div>
              <label className="field-label">Password</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5.5a3 3 0 016 0V7"/>
                  </svg>
                </div>
                <input type={showPassword ? 'text' : 'password'}
                  className="field-input pl-10 pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  autoComplete="current-password" />
                <button type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted transition-colors">
                  {showPassword
                    ? <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zm7 2.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5"/></svg>
                    : <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zm7 2.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>
                  }
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2 text-base disabled:opacity-50 disabled:cursor-not-allowed">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Signing in…</>
                : <>Sign In <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M6 3l5 5-5 5"/></svg></>
              }
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-5">
          <Link to="/super-admin/login"
            className="text-xs text-subtle hover:text-sage transition-colors inline-flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M8 1l-.8 1.4L3 7h2v7h6V7h2L8 1z"/></svg>
            Super Admin access
          </Link>
        </div>
      </div>
    </div>
  );
}
