import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { superAdminLogin } from '../../services/auth.service';

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const { setSuperAdmin } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Enter email and password.'); return; }
    setLoading(true);
    try {
      const admin = await superAdminLogin(form.email, form.password);
      setSuperAdmin(admin);
      navigate('/super-admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green to-green2 flex items-center justify-center text-2xl">🏥</div>
          <div>
            <div className="font-serif text-xl text-text">OHC Portal</div>
            <div className="text-xs text-muted uppercase tracking-widest">Command Centre</div>
          </div>
        </div>
        <div className="card p-8">
          <div className="inline-block bg-gradient-to-r from-[#7b2d00] to-[#c04a00] text-[#ffcba4] text-xs font-bold tracking-widest uppercase px-3 py-1 rounded mb-5">⚡ Super Admin</div>
          <h2 className="font-serif text-2xl mb-1">Command Centre</h2>
          <p className="text-muted text-sm mb-6">Platform administration access</p>
          {error && <div className="bg-red/10 border border-red/30 text-red text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="field-label">Email Address</label>
              <input type="email" className="field-input" placeholder="superadmin@ohcportal.in" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input type="password" className="field-input" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2 disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
        </div>
        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-muted hover:text-accent transition-colors">← Back to Staff Login</Link>
        </div>
      </div>
    </div>
  );
}
