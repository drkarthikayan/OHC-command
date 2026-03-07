import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { staffLogin, getTenants } from '../services/auth.service';

export default function Login() {
  const navigate = useNavigate();
  const { setStaffUser, setTenant } = useAuthStore();

  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState({ tenantId: '', staffId: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(true);

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
    if (!staffId || !password) { setError('Enter Staff ID and password.'); return; }

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
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green to-green2 
                          flex items-center justify-center text-2xl">🏥</div>
          <div>
            <div className="font-serif text-xl text-text">OHC Portal</div>
            <div className="text-xs text-muted uppercase tracking-widest">Occupational Health</div>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="font-serif text-2xl mb-1">Welcome back</h2>
          <p className="text-muted text-sm mb-6">Sign in to your OHC portal</p>

          {error && (
            <div className="bg-red/10 border border-red/30 text-red text-sm 
                            rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* OHC Selector */}
            <div>
              <label className="field-label">Your OHC / Company</label>
              <select
                className="field-input"
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                disabled={loadingTenants}
              >
                <option value="">
                  {loadingTenants ? 'Loading OHCs…' : '— Select your OHC —'}
                </option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Staff ID */}
            <div>
              <label className="field-label">Staff ID</label>
              <input
                className="field-input"
                placeholder="e.g. DR001"
                value={form.staffId}
                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                className="field-input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2 
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white 
                                   rounded-full animate-spin"/> Signing in…</>
              ) : 'Sign In →'}
            </button>
          </form>
        </div>

        {/* Super Admin link */}
        <div className="text-center mt-6">
          <Link
            to="/super-admin/login"
            className="text-xs text-muted hover:text-accent transition-colors"
          >
            ⚡ Super Admin →
          </Link>
        </div>
      </div>
    </div>
  );
}
