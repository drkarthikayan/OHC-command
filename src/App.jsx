import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Pages
import Login from './pages/Login';
import SuperAdminLogin from './pages/super-admin/Login';

// Placeholder pages (we'll build these next)
const Dashboard = () => <div className="p-8 text-text font-serif text-2xl">Portal Dashboard — Coming next</div>;
const SuperAdminDashboard = () => <div className="p-8 text-text font-serif text-2xl">Super Admin Dashboard — Coming next</div>;

// ── Protected Route: Staff ─────────────────────────────────
function StaffRoute({ children }) {
  const { staffUser } = useAuthStore();
  return staffUser ? children : <Navigate to="/" replace />;
}

// ── Protected Route: Super Admin ──────────────────────────
function AdminRoute({ children }) {
  const { superAdmin } = useAuthStore();
  return superAdmin ? children : <Navigate to="/super-admin/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />
        <Route path="/super-admin/login" element={<SuperAdminLogin />} />

        {/* Staff Portal (protected) */}
        <Route path="/portal/*" element={
          <StaffRoute>
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
            </Routes>
          </StaffRoute>
        } />

        {/* Super Admin (protected) */}
        <Route path="/super-admin/*" element={
          <AdminRoute>
            <Routes>
              <Route path="dashboard" element={<SuperAdminDashboard />} />
            </Routes>
          </AdminRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
