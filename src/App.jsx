import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { auth } from './config/firebase';

// Pages
import Login from './pages/Login';
import SuperAdminLogin from './pages/super-admin/Login';
import SuperAdminLayout from './pages/super-admin/Dashboard';

const PortalDashboard = () => (
  <div className="p-8 text-text font-serif text-2xl">Portal Dashboard — Coming soon</div>
);

function StaffRoute({ children }) {
  const { staffUser } = useAuthStore();
  return staffUser ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const { superAdmin, loading } = useAuthStore();
  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-muted text-sm">Loading…</div>
      </div>
    </div>
  );
  return superAdmin ? children : <Navigate to="/super-admin/login" replace />;
}

export default function App() {
  const { setSuperAdmin, setLoading } = useAuthStore();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const token = await user.getIdTokenResult(true);
          if (token.claims.role === 'super_admin') {
            setSuperAdmin({
              uid: user.uid,
              email: user.email,
              name: token.claims.name || user.displayName || user.email.split('@')[0],
              role: 'super_admin',
            });
          }
        } catch (e) {
          console.error('Auth rehydration error:', e);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/super-admin/login" element={<SuperAdminLogin />} />
        <Route path="/portal/*" element={
          <StaffRoute>
            <Routes>
              <Route path="dashboard" element={<PortalDashboard />} />
            </Routes>
          </StaffRoute>
        } />
        <Route path="/super-admin/*" element={
          <AdminRoute>
            <SuperAdminLayout />
          </AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
