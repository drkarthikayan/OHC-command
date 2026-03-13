import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { roleIcon } from '../../utils/formatters';
import { AlertsBell } from './SmartAlerts';

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
import FieldRoundsPage from './FieldRounds';
import AuditsPage from './Audits';
import VaccinationRegisterPage from './VaccinationRegister';
import WorkPermitsPage from './WorkPermits';
import HealthEducationPage from './HealthEducation';
import DispensaryLogPage from './DispensaryLog';
import AnnualHealthReportPage from './AnnualHealthReport';
import ReferralsPage from './Referrals';
import EmergencySOPPage from './EmergencySOP';
import StatutoryReportsPage from './StatutoryReports';
import IHITrendsPage from './IHITrends';

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard',    label: 'Dashboard',        icon: '◼', path: 'dashboard',    roles: ['doctor','nurse','pharmacy','admin','staff'] },
      { id: 'employees',    label: 'Employees',        icon: '◼', path: 'employees',    roles: ['doctor','nurse','admin','staff'] },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { id: 'opd',            label: 'OPD / Visits',    icon: '◼', path: 'opd',            roles: ['doctor','nurse','admin'] },
      { id: 'emergency-sop', label: 'Emergency SOP', icon: '◼', path: 'emergency-sop', roles: ['doctor','nurse','admin'] },
      { id: 'pre-employment', label: 'Pre-Employment',  icon: '◼', path: 'pre-employment', roles: ['doctor','nurse','admin'] },
      { id: 'periodic-exam',  label: 'Periodic Exam',   icon: '◼', path: 'periodic-exam',  roles: ['doctor','nurse','admin'] },
      { id: 'certificates',   label: 'Certificates',    icon: '◼', path: 'certificates',   roles: ['doctor','admin'] },
    ],
  },
  {
    label: 'Health',
    items: [
      { id: 'hospital',       label: 'Hospital Tracker', icon: '◼', path: 'hospital',       roles: ['doctor','nurse','admin'] },
      { id: 'health-tracker', label: 'Health Tracker',   icon: '◼', path: 'health-tracker', roles: ['doctor','nurse','admin'] },
      { id: 'injuries',       label: 'Injury Register',  icon: '◼', path: 'injuries',       roles: ['doctor','nurse','admin'] },
    ],
  },
  {
    label: 'Field Activities',
    items: [
      { id: 'field-rounds',        label: 'Field Rounds',        icon: '◼', path: 'field-rounds',        roles: ['doctor','nurse','admin'] },
      { id: 'audits',              label: 'Audits',              icon: '◼', path: 'audits',              roles: ['doctor','nurse','admin'] },
      { id: 'vaccination',         label: 'Vaccination Register',icon: '◼', path: 'vaccination',         roles: ['doctor','nurse','admin'] },
      { id: 'work-permits',        label: 'Work Permits',        icon: '◼', path: 'work-permits',        roles: ['doctor','nurse','admin'] },
      { id: 'health-education',    label: 'Health Education',    icon: '◼', path: 'health-education',    roles: ['doctor','nurse','admin'] },
    ],
  },
  {
    label: 'Pharmacy',
    items: [
      { id: 'pharmacy',         label: 'Stock Management',   icon: '◼', path: 'pharmacy',         roles: ['pharmacy','doctor','admin'] },
      { id: 'dispensary-log',   label: 'Dispensary Log',     icon: '◼', path: 'dispensary-log',   roles: ['doctor','nurse','admin'] },
      { id: 'campaigns',        label: 'Medical Campaigns',  icon: '◼', path: 'campaigns',        roles: ['doctor','nurse','admin'] },
      { id: 'biomedical-waste', label: 'Biomedical Waste',   icon: '◼', path: 'biomedical-waste', roles: ['doctor','nurse','admin'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      { id: 'annual-report', label: 'Annual Health Report', icon: '◼', path: 'annual-report', roles: ['doctor','admin'] },
      { id: 'ihi-trends', label: 'IHI Trend Charts', icon: '◼', path: 'ihi-trends', roles: ['doctor','admin'] },
      { id: 'statutory-reports', label: 'Statutory Reports', icon: '◼', path: 'statutory-reports', roles: ['doctor','admin'] },
      { id: 'referrals', label: 'Referral Management', icon: '◼', path: 'referrals', roles: ['doctor','admin'] },
    ],
  },
];

// Nav icon map (SVG-based — no emoji)
const NAV_ICONS = {
  dashboard:       <IconGrid />,
  employees:       <IconUsers />,
  opd:             <IconClipboard />,
  'pre-employment':<IconSearch />,
  'periodic-exam': <IconFlask />,
  certificates:    <IconAward />,
  hospital:        <IconHospital />,
  'health-tracker':<IconHeart />,
  injuries:        <IconAlert />,
  pharmacy:        <IconPill />,
  campaigns:       <IconBullhorn />,
  'biomedical-waste': <IconRecycle />,
  'field-rounds':     <IconCompass />,
  'audits':           <IconCheckSquare />,
  'vaccination':      <IconSyringe />,
  'work-permits':     <IconShield />,
  'health-education': <IconGradCap />,
  'dispensary-log':   <IconReceipt />,
  'annual-report':    <IconBarChart />,
  'referrals':         <IconReferral />,
  'emergency-sop':     <IconEmergency />,
  'statutory-reports':  <IconScroll />,
  'ihi-trends':         <IconTrend />,
};

function IconGrid()     { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>; }
function IconUsers()    { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.76 2.24-5 5-5s5 2.24 5 5"/><circle cx="12" cy="5" r="2"/><path d="M11 11.5c.9-.31 2.1-.5 3-.5"/></svg>; }
function IconClipboard(){ return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5 2a1 1 0 011-1h4a1 1 0 011 1v1H5V2zM3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1zm2 4h6v1H5V7zm0 2h4v1H5V9z"/></svg>; }
function IconSearch()   { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm3.09-1.32l2.73 2.73-1.06 1.06-2.73-2.73A5.5 5.5 0 116.5 12a5.47 5.47 0 01-3.09-.96l-.23.22H4v-1.5L6.09 9.3A4.47 4.47 0 006.5 11z"/></svg>; }
function IconFlask()    { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5 1v6L2 12a2 2 0 001.8 2.9h8.4A2 2 0 0014 12L11 7V1H5zm2 1h2v5.5l2.5 4H4.5L7 7.5V2z"/></svg>; }
function IconAward()    { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><circle cx="8" cy="6" r="4"/><path d="M5.5 10l-1.5 5 4-2.5 4 2.5-1.5-5"/></svg>; }
function IconHospital() { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M1 2a1 1 0 011-1h12a1 1 0 011 1v13H1V2zm7 2H7v2H5v1h2v2h1V7h2V6H8V4zm-4 8h2v2H4v-2zm6 0h2v2h-2v-2z" clipRule="evenodd"/></svg>; }
function IconHeart()    { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 13.5C5.5 11.5 2 9 2 5.5A3.5 3.5 0 018 3.72 3.5 3.5 0 0114 5.5C14 9 10.5 11.5 8 13.5z"/></svg>; }
function IconAlert()    { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 1L1 14h14L8 1zm0 3l4.5 8h-9L8 4zm-.5 2v3h1V6h-1zm0 4v1h1v-1h-1z"/></svg>; }
function IconPill()     { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M10.5 1.5a4.5 4.5 0 013.18 7.68l-5 5A4.5 4.5 0 012.32 7.82l5-5A4.48 4.48 0 0110.5 1.5zM8 5.5L4.5 9a2.5 2.5 0 003.18 3.18L11 8.82 8 5.5z"/></svg>; }
function IconBullhorn() { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M13 2v9l-2-1.5V3.5L13 2zM2 5h7v5H2L1 8.5 2 5zm1.5 7l1-2.5H6l-1 2.5H3.5z"/></svg>; }
function IconRecycle()  { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 2L6 5h1.5v2H5a1 1 0 00-.87.5L2 11.5h2.5L3 14h4l1-2.5H6.5v-2h3v2H8l1 2.5h4l-1.5-2.5H14l-2.13-4A1 1 0 0011 7H8.5V5H10L8 2z"/></svg>; }
function IconMenu()     { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><rect x="1" y="3" width="14" height="1.5" rx="0.75"/><rect x="1" y="7.25" width="14" height="1.5" rx="0.75"/><rect x="1" y="11.5" width="14" height="1.5" rx="0.75"/></svg>; }
function IconChevron()  { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M5 3l6 5-6 5"/></svg>; }
function IconLogout()   { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M6 8h7"/></svg>; }
function IconCompass()     { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><circle cx="8" cy="8" r="6" fillOpacity=".15"/><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6l-1.5 3.5L5 10l1.5-3.5L10 6z"/></svg>; }
function IconCheckSquare() { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><rect x="2" y="2" width="12" height="12" rx="2" fillOpacity=".15"/><rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2 2 4-3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>; }
function IconSyringe()     { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M11.5 1.5l3 3-1 1-1-1-5 5 .5 1.5-1.5.5L7 11 4 14l-1-1 3-3-.5-.5 1-1.5 1.5.5 5-5-1-1 1-1z"/></svg>; }
function IconShield()      { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 1L2 3.5V8c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V3.5L8 1z" fillOpacity=".15"/><path d="M8 1L2 3.5V8c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V3.5L8 1z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>; }
function IconGradCap()     { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 3L1 6.5l7 3.5 7-3.5L8 3z"/><path d="M4 8.5V12c0 1 1.8 2 4 2s4-1 4-2V8.5" fillOpacity=".3"/><path d="M13 6.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconReceipt()     { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M3 1h10a1 1 0 011 1v12l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5V2a1 1 0 011-1z" fillOpacity=".15"/><path d="M3 1h10a1 1 0 011 1v12l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5V2a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>; }
function IconTrend()     { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M1 12l4-4 3 3 4-5 3 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconScroll()    { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4 1h8a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm1 3h6M5 7h6M5 9h4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg>; }
function IconEmergency()  { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 1L1 14h14L8 1z" fillOpacity=".15" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 6v3M8 11v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconReferral()  { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M3 8h7M8 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 3h5a1 1 0 011 1v1M2 3v9a1 1 0 001 1h9a1 1 0 001-1V9"/></svg>; }
function IconBarChart()    { return <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><rect x="1" y="9" width="3" height="6" rx="1"/><rect x="6" y="5" width="3" height="10" rx="1"/><rect x="11" y="2" width="3" height="13" rx="1"/></svg>; }

const ROLE_COLORS = {
  doctor:   { bg: 'bg-sky/10',     text: 'text-sky',      dot: '#3b82f6' },
  nurse:    { bg: 'bg-rose/10',    text: 'text-rose',     dot: '#e07a8f' },
  pharmacy: { bg: 'bg-amber/10',   text: 'text-amber',    dot: '#d97706' },
  admin:    { bg: 'bg-lavender/10',text: 'text-lavender', dot: '#7c6fcd' },
  staff:    { bg: 'bg-subtle/10',  text: 'text-muted',    dot: '#94a3b8' },
};

function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-rose/10 flex items-center justify-center mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-rose">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
      </div>
      <div className="font-semibold text-text mb-1">Access Restricted</div>
      <p className="text-sm text-muted">You don't have permission to view this page.</p>
    </div>
  );
}

export default function StaffLayout() {
  const { staffUser, tenant, clearAll } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  useEffect(() => {
    if (!staffUser) navigate('/', { replace: true });
  }, [staffUser]);

  if (!staffUser || !tenant) return null;

  const role     = staffUser.role || 'staff';
  const roleConf = ROLE_COLORS[role] || ROLE_COLORS.staff;

  // All nav items this role can see
  const allItems = NAV_GROUPS.flatMap(g => g.items).filter(i => i.roles.includes(role));

  const currentPath = location.pathname.split('/').pop();
  const activeItem  = allItems.find(i => i.path === currentPath) || allItems[0];

  const handleLogout = () => { clearAll(); navigate('/', { replace: true }); };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6b9e8f 0%, #52b788 100%)' }}>
            <svg viewBox="0 0 20 20" fill="white" className="w-5 h-5">
              <path d="M10 2a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V3a1 1 0 011-1z"/>
            </svg>
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="font-serif text-base font-semibold text-text leading-tight">OHC Command</div>
              <div className="text-[11px] text-muted truncate">{tenant?.name}</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(i => i.roles.includes(role));
          if (!visibleItems.length) return null;
          return (
            <div key={group.label} className="mb-1">
              {sidebarOpen && (
                <div className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-subtle">
                  {group.label}
                </div>
              )}
              {visibleItems.map(item => {
                const isActive = location.pathname === `/portal/${item.path}` || (location.pathname === '/portal' && item.path === 'dashboard');
                return (
                  <Link key={item.id} to={`/portal/${item.path}`}
                    onClick={() => setMobileOpen(false)}
                    className={`nav-item ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-0 mx-auto w-11 h-11' : ''}`}>
                    <div className={`nav-item-icon ${isActive ? '' : 'opacity-60'}`}>
                      {NAV_ICONS[item.id]}
                    </div>
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                    {sidebarOpen && isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sage shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className={`flex items-center gap-2.5 px-2 py-2 rounded-xl ${sidebarOpen ? '' : 'justify-center'}`}>
          <div className={`avatar avatar-sm font-bold shrink-0 ${roleConf.bg} ${roleConf.text}`}>
            {(staffUser.name?.[0] || 'U').toUpperCase()}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text truncate">{staffUser.name}</div>
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${roleConf.text}`}>{role}</div>
            </div>
          )}
          {sidebarOpen && (
            <button onClick={handleLogout}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-rose/10 hover:text-rose transition-colors shrink-0"
              title="Log out">
              <IconLogout />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col shrink-0 transition-all duration-300 sidebar
        ${sidebarOpen ? 'w-60' : 'w-16'}`}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-text/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 sidebar shadow-card-lg animate-slide-in-left">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 bg-surface border-b border-border flex items-center gap-3 px-4 shrink-0 shadow-card">
          {/* Sidebar toggle */}
          <button onClick={() => { setSidebarOpen(s => !s); setMobileOpen(m => !m); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface2 hover:text-text transition-colors">
            <IconMenu />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="text-subtle font-medium hidden sm:block">Portal</span>
            <span className="text-border hidden sm:block"><IconChevron /></span>
            <span className="font-semibold text-text truncate">{activeItem?.label || 'Dashboard'}</span>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            {/* Alerts Bell */}
            <AlertsBell />
            {/* Role pill */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${roleConf.bg} ${roleConf.text}`}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: roleConf.dot }} />
              {staffUser.name?.split(' ')[0]}
            </div>
            {/* Logout button (mobile) */}
            <button onClick={handleLogout}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-rose/10 hover:text-rose transition-colors">
              <IconLogout />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-mesh">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"      element={<StaffDashboard />} />
            <Route path="employees"      element={allItems.find(n=>n.id==='employees')      ? <EmployeesPage />       : <Forbidden />} />
            <Route path="opd"            element={allItems.find(n=>n.id==='opd')            ? <OpdPage />             : <Forbidden />} />
            <Route path="pharmacy"       element={allItems.find(n=>n.id==='pharmacy')       ? <PharmacyPage />        : <Forbidden />} />
            <Route path="certificates"   element={allItems.find(n=>n.id==='certificates')   ? <CertificatesPage />    : <Forbidden />} />
            <Route path="pre-employment" element={allItems.find(n=>n.id==='pre-employment') ? <PreEmploymentPage />   : <Forbidden />} />
            <Route path="injuries"       element={allItems.find(n=>n.id==='injuries')       ? <InjuryRegisterPage />  : <Forbidden />} />
            <Route path="periodic-exam"  element={allItems.find(n=>n.id==='periodic-exam')  ? <PeriodicExamPage />    : <Forbidden />} />
            <Route path="hospital"       element={allItems.find(n=>n.id==='hospital')       ? <HospitalTrackerPage /> : <Forbidden />} />
            <Route path="health-tracker" element={allItems.find(n=>n.id==='health-tracker') ? <HealthTrackerPage />   : <Forbidden />} />
            <Route path="campaigns"      element={allItems.find(n=>n.id==='campaigns')      ? <MedicalCampaignsPage />: <Forbidden />} />
            <Route path="biomedical-waste" element={allItems.find(n=>n.id==='biomedical-waste') ? <BiomedicalWastePage /> : <Forbidden />} />
            <Route path="field-rounds"   element={allItems.find(n=>n.id==='field-rounds')   ? <FieldRoundsPage />     : <Forbidden />} />
            <Route path="audits"         element={allItems.find(n=>n.id==='audits')         ? <AuditsPage />          : <Forbidden />} />
            <Route path="vaccination"    element={allItems.find(n=>n.id==='vaccination')    ? <VaccinationRegisterPage />: <Forbidden />} />
            <Route path="work-permits"   element={allItems.find(n=>n.id==='work-permits')   ? <WorkPermitsPage />     : <Forbidden />} />
            <Route path="health-education" element={allItems.find(n=>n.id==='health-education') ? <HealthEducationPage />: <Forbidden />} />
            <Route path="dispensary-log" element={allItems.find(n=>n.id==='dispensary-log') ? <DispensaryLogPage />   : <Forbidden />} />
            <Route path="annual-report"  element={allItems.find(n=>n.id==='annual-report')  ? <AnnualHealthReportPage /> : <Forbidden />} />
              <Route path="ihi-trends" element={allItems.find(n=>n.id==='ihi-trends') ? <IHITrendsPage /> : <Forbidden />} />
              <Route path="statutory-reports" element={allItems.find(n=>n.id==='statutory-reports') ? <StatutoryReportsPage /> : <Forbidden />} />
              <Route path="emergency-sop" element={allItems.find(n=>n.id==='emergency-sop') ? <EmergencySOPPage /> : <Forbidden />} />
              <Route path="referrals"     element={allItems.find(n=>n.id==='referrals')     ? <ReferralsPage />           : <Forbidden />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
