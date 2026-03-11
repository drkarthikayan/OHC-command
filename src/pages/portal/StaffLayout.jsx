import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { roleIcon } from '../../utils/formatters';

import StaffDashboard from './StaffDashboard';
import EmployeesPage from './Employees';
import OpdPage from './Opd';
import PharmacyPage from './Pharmacy';
import CertificatesPage from './Certificates';
import PreEmploymentPage from './PreEmployment';
import InjuryRegisterPage from './InjuryRegister';
import PeriodicExamPage from './PeriodicExam';
import HospitalTrackerPage from './HospitalTracker';
import HealthTrackerPage from './HealthTracker';
import BiomedicalWastePage from './BiomedicalWaste';
import MedicalCampaignsPage from './MedicalCampaigns';

// Role-based nav: what each role can see
const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',    icon: '📊', path: 'dashboard',    roles: ['doctor','nurse','pharmacy','admin','staff'] },
  { id: 'employees',    label: 'Employees',    icon: '👤', path: 'employees',    roles: ['doctor','nurse','admin','staff'] },
  { id: 'opd',          label: 'OPD / Visits', icon: '📋', path: 'opd',          roles: ['doctor','nurse','admin'] },
  { id: 'pharmacy',     label: 'Pharmacy',     icon: '💊', path: 'pharmacy',     roles: ['pharmacy','doctor','admin'] },
  { id: 'certificates',   label: 'Certificates',     icon: '📜', path: 'certificates',   roles: ['doctor','admin'] },
  { id: 'pre-employment', label: 'Pre-Employment',  icon: '📋', path: 'pre-employment', roles: ['doctor','nurse','admin'] },
  { id: 'injuries',       label: 'Injury Register', icon: '🩹', path: 'injuries',       roles: ['doctor','nurse','admin'] },
  { id: 'periodic-exam',   label: 'Periodic Exam',    icon: '🔬', path: 'periodic-exam',   roles: ['doctor','nurse','admin'] },
  { id: 'hospital',        label: 'Hospital Tracker', icon: '🏥', path: 'hospital',        roles: ['doctor','nurse','admin'] },
  { id: 'health-tracker',   label: 'Health Tracker',    icon: '💚', path: 'health-tracker',   roles: ['doctor','nurse','admin'] },
  { id: 'campaigns',        label: 'Campaigns',         icon: '🏥', path: 'campaigns',        roles: ['doctor','nurse','admin'] },
  { id: 'biomedical-waste', label: 'Biomedical Waste',  icon: '♻️', path: 'biomedical-waste', roles: ['doctor','nurse','admin'] },
];

function RoleBadge({ role }) {
  const colors = {
    doctor:   'bg-blue-500/15 text-blue-400',
    nurse:    'bg-pink-500/15 text-pink-400',
    pharmacy: 'bg-amber-500/15 text-amber-400',
    admin:    'bg-purple-500/15 text-purple-400',
    staff:    'bg-gray-500/15 text-gray-400',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${colors[role] || colors.staff}`}>
      {roleIcon[role] || '👤'} {role}
    </span>
  );
}

export default function StaffLayout() {
  const { staffUser, tenant, clearAll } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!staffUser) navigate('/', { replace: true });
  }, [staffUser]);

  if (!staffUser || !tenant) return null;

  const role = staffUser.role || 'staff';
  const navItems = NAV_ITEMS.filter(n => n.roles.includes(role));

  const handleLogout = () => {
    clearAll();
    navigate('/', { replace: true });
  };

  const activePath = location.pathname.split('/portal/')[1];

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-14'} min-h-screen bg-surface border-r border-border flex flex-col transition-all duration-200 shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green to-green2 flex items-center justify-center text-xs font-bold text-white shrink-0">⚕</div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="text-xs font-bold text-text truncate">{tenant.name}</div>
              <div className="text-[10px] text-muted">OHC Portal</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {navItems.map(item => {
            const active = activePath === item.path || (!activePath && item.id === 'dashboard');
            return (
              <Link
                key={item.id}
                to={`/portal/${item.path}`}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all border-l-2 ${
                  active
                    ? 'border-accent text-accent bg-surface2'
                    : 'border-transparent text-muted hover:text-text hover:bg-surface2/60'
                }`}
              >
                <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-border p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green/30 to-green2/30 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                {(staffUser.name || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text truncate">{staffUser.name}</div>
                <div className="text-[10px] text-muted truncate">{staffUser.staffId}</div>
              </div>
              <button onClick={handleLogout} className="text-muted hover:text-red-400 transition-colors text-sm" title="Logout">⏏</button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-muted hover:text-red-400 transition-colors text-sm" title="Logout">⏏</button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-12 bg-surface border-b border-border flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="text-muted hover:text-text transition-colors text-lg"
          >☰</button>
          <div className="flex-1" />
          <RoleBadge role={role} />
          <div className="text-xs text-muted hidden sm:block">{staffUser.name}</div>
          <button
            onClick={handleLogout}
            className="text-xs text-muted hover:text-red-400 transition-colors px-2 py-1 rounded border border-border hover:border-red-400/30"
          >Sign out</button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="dashboard"    element={<StaffDashboard />} />
            <Route path="employees"    element={navItems.find(n=>n.id==='employees')    ? <EmployeesPage />    : <Forbidden />} />
            <Route path="opd"          element={navItems.find(n=>n.id==='opd')          ? <OpdPage />          : <Forbidden />} />
            <Route path="pharmacy"     element={navItems.find(n=>n.id==='pharmacy')     ? <PharmacyPage />     : <Forbidden />} />
            <Route path="certificates"    element={navItems.find(n=>n.id==='certificates')    ? <CertificatesPage />    : <Forbidden />} />
            <Route path="pre-employment" element={navItems.find(n=>n.id==='pre-employment') ? <PreEmploymentPage /> : <Forbidden />} />
            <Route path="injuries"      element={navItems.find(n=>n.id==='injuries')      ? <InjuryRegisterPage />  : <Forbidden />} />
            <Route path="periodic-exam"  element={navItems.find(n=>n.id==='periodic-exam')  ? <PeriodicExamPage />    : <Forbidden />} />
            <Route path="hospital"       element={navItems.find(n=>n.id==='hospital')       ? <HospitalTrackerPage /> : <Forbidden />} />
            <Route path="health-tracker"   element={navItems.find(n=>n.id==='health-tracker')   ? <HealthTrackerPage />    : <Forbidden />} />
            <Route path="campaigns"       element={navItems.find(n=>n.id==='campaigns')       ? <MedicalCampaignsPage /> : <Forbidden />} />
            <Route path="biomedical-waste" element={navItems.find(n=>n.id==='biomedical-waste') ? <BiomedicalWastePage />  : <Forbidden />} />
            <Route path="*"            element={<Navigate to="dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Forbidden() {
  return (
    <div className="p-8 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <div className="text-text font-serif text-xl mb-1">Access Restricted</div>
      <div className="text-muted text-sm">Your role doesn't have permission to view this page.</div>
    </div>
  );
}
