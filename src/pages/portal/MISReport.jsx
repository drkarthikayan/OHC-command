import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

/* ── Mini bar chart (pure SVG) ── */
function BarChart({ data, color = '#52b788', height = 60 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 300, H = height, barW = Math.floor(W / data.length) - 4;
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
      {data.map((d, i) => {
        const bh = Math.max(2, (d.value / max) * H);
        const x = i * (W / data.length) + 2;
        const y = H - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx="2" fill={color} fillOpacity="0.8"/>
            <text x={x + barW/2} y={H + 14} textAnchor="middle" fontSize="8" fill="#94a3b8">{d.label}</text>
            {d.value > 0 && <text x={x + barW/2} y={y - 2} textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">{d.value}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, sub, color = 'text-text', bg = 'bg-white', icon }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-border`}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-xs font-medium text-text mt-0.5">{label}</div>
          {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}

export default function MISReport() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [selMonth, setSelMonth] = useState(new Date().getMonth());
  const [selYear,  setSelYear]  = useState(CURRENT_YEAR);
  const [loading,  setLoading]  = useState(true);
  const [data,     setData]     = useState(null);

  const monthStr = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [empSnap, visitSnap, injSnap, refSnap, pharmaSnap,
               preSnap, perSnap, emergSnap, vacSnap] = await Promise.all([
          getDocs(collection(db, `merchants/${tenantId}/employees`)),
          getDocs(query(collection(db, `merchants/${tenantId}/opd_visits`), orderBy('createdAt','desc'))),
          getDocs(collection(db, `merchants/${tenantId}/injuries`)),
          getDocs(collection(db, `merchants/${tenantId}/referrals`)),
          getDocs(collection(db, `merchants/${tenantId}/pharmacy_stock`)),
          getDocs(collection(db, `merchants/${tenantId}/pre_employment`)),
          getDocs(collection(db, `merchants/${tenantId}/periodic_exams`)),
          getDocs(collection(db, `merchants/${tenantId}/emergency_incidents`)),
          getDocs(collection(db, `merchants/${tenantId}/vaccinations`)),
        ]);

        const employees   = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const visits      = visitSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const injuries    = injSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const referrals   = refSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const stock       = pharmaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const preEmp      = preSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const periodic    = perSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const emergencies = emergSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const vaccines    = vacSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filter helpers
        const inMonth = (item) => {
          const d = item.date || item.incidentDate || item.referralDate || item.examDate || '';
          const ts = item.createdAt?.toDate ? item.createdAt.toDate().toISOString().slice(0,7) : '';
          return d.startsWith(monthStr) || ts.startsWith(monthStr);
        };

        const mVisits      = visits.filter(inMonth);
        const mInjuries    = injuries.filter(inMonth);
        const mReferrals   = referrals.filter(inMonth);
        const mPreEmp      = preEmp.filter(inMonth);
        const mPeriodic    = periodic.filter(inMonth);
        const mEmergencies = emergencies.filter(inMonth);
        const mVaccines    = vaccines.filter(inMonth);

        // OPD by shift
        const shiftMap = { General:0, Morning:0, Afternoon:0, Night:0 };
        mVisits.forEach(v => { const s = v.shift || 'General'; if (shiftMap[s] !== undefined) shiftMap[s]++; else shiftMap.General++; });

        // OPD by status
        const statusMap = {};
        mVisits.forEach(v => { const s = v.status || 'Open'; statusMap[s] = (statusMap[s]||0)+1; });

        // Top complaints
        const compMap = {};
        mVisits.forEach(v => { if (v.complaint) compMap[v.complaint] = (compMap[v.complaint]||0)+1; });
        const topComplaints = Object.entries(compMap).sort((a,b)=>b[1]-a[1]).slice(0,8);

        // Department breakdown
        const deptMap = {};
        mVisits.forEach(v => { const d = v.department||'Unknown'; deptMap[d] = (deptMap[d]||0)+1; });
        const deptBreakdown = Object.entries(deptMap).sort((a,b)=>b[1]-a[1]).slice(0,6);

        // Referral outcomes
        const refStatus = {};
        mReferrals.forEach(r => { refStatus[r.status||'pending'] = (refStatus[r.status||'pending']||0)+1; });

        // Emergency types
        const emergMap = {};
        mEmergencies.forEach(e => { emergMap[e.emergencyType||'other'] = (emergMap[e.emergencyType||'other']||0)+1; });

        // Injury types
        const injMap = {};
        mInjuries.forEach(i => { injMap[i.injuryType||'Other'] = (injMap[i.injuryType||'Other']||0)+1; });

        // Fitness stats from exams
        const fitMap = {};
        [...mPreEmp, ...mPeriodic].forEach(e => {
          const f = e.fitnessResult || e.fitnessStatus || 'Pending';
          fitMap[f] = (fitMap[f]||0)+1;
        });

        // Low stock count
        const lowStock = stock.filter(s => {
          const qty = parseFloat(s.quantity || s.qty || 0);
          const min = parseFloat(s.minStock || s.reorderLevel || 10);
          return qty <= min;
        }).length;

        // Last 6 months OPD trend
        const trend = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(selYear, selMonth - i, 1);
          const ms = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          const count = visits.filter(v => {
            const vd = v.date || '';
            const ts = v.createdAt?.toDate ? v.createdAt.toDate().toISOString().slice(0,7) : '';
            return vd.startsWith(ms) || ts.startsWith(ms);
          }).length;
          trend.push({ label: MONTHS[d.getMonth()].slice(0,3), value: count });
        }

        setData({
          employees, mVisits, mInjuries, mReferrals, mPreEmp, mPeriodic,
          mEmergencies, mVaccines, shiftMap, statusMap, topComplaints,
          deptBreakdown, refStatus, emergMap, injMap, fitMap, lowStock, trend,
          totalStock: stock.length,
        });
      } catch (e) {
        console.error(e);
        toast.error('Failed to load MIS data');
      }
      setLoading(false);
    };
    load();
  }, [tenantId, monthStr]);

  const handlePrint = () => {
    if (!data) return;
    const d = data;
    const monthLabel = `${MONTHS[selMonth]} ${selYear}`;

    const html = `<!DOCTYPE html>
<html>
<head>
<title>Monthly MIS Report — ${monthLabel}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; }
  .page-header { background: #1a3a5c; color: white; padding: 14px 18px; border-radius: 6px; margin-bottom: 12px; }
  .page-header h1 { margin: 0; font-size: 16px; font-weight: bold; }
  .page-header p  { margin: 3px 0 0; font-size: 10px; opacity: .75; }
  .meta { display: flex; gap: 20px; margin-bottom: 12px; font-size: 9px; color: #555; }
  .section { margin-bottom: 12px; }
  .section-title { font-size: 11px; font-weight: bold; color: #1a3a5c; border-bottom: 1px solid #c8d9e8; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .5px; }
  .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 12px; }
  .stat-box { border: 1px solid #dde; border-radius: 5px; padding: 8px; text-align: center; }
  .stat-box .val { font-size: 18px; font-weight: bold; color: #1a3a5c; }
  .stat-box .lbl { font-size: 8px; color: #666; margin-top: 2px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th { background: #1a3a5c; color: white; padding: 4px 6px; text-align: left; }
  td { padding: 3px 6px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #f7f9fc; }
  .bar-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .bar-label { width: 100px; font-size: 8px; color: #444; text-align: right; flex-shrink: 0; }
  .bar-track { flex: 1; background: #eee; border-radius: 2px; height: 8px; }
  .bar-fill  { background: #1a8c5c; height: 8px; border-radius: 2px; }
  .bar-val   { width: 24px; font-size: 8px; color: #1a8c5c; font-weight: bold; }
  .footer { margin-top: 16px; border-top: 1px solid #ccc; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #666; }
  .sign-box { border: 1px solid #aaa; width: 140px; height: 40px; margin-top: 4px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 8px; font-weight: bold; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-red   { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>
<div class="page-header">
  <h1>Monthly MIS Report — ${monthLabel}</h1>
  <p>${tenant?.name || 'Company'} &nbsp;|&nbsp; Occupational Health Centre &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
</div>

<div class="stats-grid">
  <div class="stat-box"><div class="val">${d.mVisits.length}</div><div class="lbl">OPD Visits</div></div>
  <div class="stat-box"><div class="val">${d.mInjuries.length}</div><div class="lbl">Injuries</div></div>
  <div class="stat-box"><div class="val">${d.mReferrals.length}</div><div class="lbl">Referrals</div></div>
  <div class="stat-box"><div class="val">${d.mEmergencies.length}</div><div class="lbl">Emergencies</div></div>
  <div class="stat-box"><div class="val">${d.mPreEmp.length + d.mPeriodic.length}</div><div class="lbl">Health Exams</div></div>
  <div class="stat-box"><div class="val">${d.mVaccines.length}</div><div class="lbl">Vaccinations</div></div>
  <div class="stat-box"><div class="val">${d.lowStock}</div><div class="lbl">Low Stock Items</div></div>
  <div class="stat-box"><div class="val">${d.employees.length}</div><div class="lbl">Total Employees</div></div>
</div>

<div class="two-col">
  <div class="section">
    <div class="section-title">Top Complaints / Diagnoses</div>
    ${d.topComplaints.map(([c,n])=>{
      const pct = d.mVisits.length ? Math.round(n/d.mVisits.length*100) : 0;
      return `<div class="bar-row"><div class="bar-label">${c}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="bar-val">${n}</div></div>`;
    }).join('') || '<div style="color:#999;font-size:9px;text-align:center;padding:10px">No data</div>'}
  </div>
  <div class="section">
    <div class="section-title">OPD by Department</div>
    ${d.deptBreakdown.map(([dept,n])=>{
      const pct = d.mVisits.length ? Math.round(n/d.mVisits.length*100) : 0;
      return `<div class="bar-row"><div class="bar-label">${dept}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:#4a8070"></div></div><div class="bar-val">${n}</div></div>`;
    }).join('') || '<div style="color:#999;font-size:9px;text-align:center;padding:10px">No data</div>'}
  </div>
</div>

<div class="two-col">
  <div class="section">
    <div class="section-title">OPD by Shift</div>
    <table><thead><tr><th>Shift</th><th>Visits</th><th>%</th></tr></thead><tbody>
    ${Object.entries(d.shiftMap).map(([s,n])=>`<tr><td>${s}</td><td>${n}</td><td>${d.mVisits.length?Math.round(n/d.mVisits.length*100):0}%</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Referral Status</div>
    <table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>
    ${Object.entries(d.refStatus).map(([s,n])=>`<tr><td style="text-transform:capitalize">${s}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan="2" style="color:#999;text-align:center">No referrals</td></tr>'}
    </tbody></table>
  </div>
</div>

<div class="two-col">
  <div class="section">
    <div class="section-title">Injury Register Summary</div>
    <table><thead><tr><th>Injury Type</th><th>Count</th></tr></thead><tbody>
    ${Object.entries(d.injMap).map(([t,n])=>`<tr><td>${t}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan="2" style="color:#999;text-align:center">No injuries</td></tr>'}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Fitness Status (Exams)</div>
    <table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>
    ${Object.entries(d.fitMap).map(([s,n])=>`<tr><td>${s}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan="2" style="color:#999;text-align:center">No exams</td></tr>'}
    </tbody></table>
  </div>
</div>

<div class="footer">
  <div><div>OHC Medical Officer</div><div class="sign-box"></div></div>
  <div><div>HR / Factory Manager</div><div class="sign-box"></div></div>
  <div style="text-align:right"><div>Company Seal</div><div class="sign-box"></div></div>
</div>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
    toast.success('MIS Report ready to print');
  };

  const monthLabel = `${MONTHS[selMonth]} ${selYear}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Monthly MIS Report</h1>
          <p className="text-sm text-muted mt-0.5">Management information summary — {monthLabel}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={selMonth} onChange={e=>{setSelMonth(Number(e.target.value));}} className="input text-sm w-36">
            {MONTHS.map((m,i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e=>{setSelYear(Number(e.target.value));}} className="input text-sm w-24">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handlePrint} disabled={loading || !data}
            className="btn-primary flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4 1h8v4H4V1zM2 6h12a1 1 0 011 1v5a1 1 0 01-1 1h-2v-3H4v3H2a1 1 0 01-1-1V7a1 1 0 011-1zm9 1.5a.5.5 0 110 1 .5.5 0 010-1z"/></svg>
            Print MIS Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : !data ? null : (
        <>
          {/* Key stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="OPD Visits"    value={data.mVisits.length}      icon="🏥" color="text-sage"       bg="bg-sage/5"     sub={`${data.employees.length} employees`}/>
            <StatCard label="Injuries"       value={data.mInjuries.length}    icon="⚠️" color="text-orange-600" bg="bg-orange-50"  sub="This month"/>
            <StatCard label="Referrals"      value={data.mReferrals.length}   icon="🔗" color="text-blue-600"   bg="bg-blue-50"    sub="Sent to specialists"/>
            <StatCard label="Emergencies"    value={data.mEmergencies.length} icon="🚨" color="text-red-600"    bg="bg-red-50"     sub="SOP activations"/>
            <StatCard label="Health Exams"   value={data.mPreEmp.length + data.mPeriodic.length} icon="🔬" color="text-purple-600" bg="bg-purple-50" sub="Pre-emp + periodic"/>
            <StatCard label="Vaccinations"   value={data.mVaccines.length}    icon="💉" color="text-emerald-600" bg="bg-emerald-50" sub="Doses given"/>
            <StatCard label="Low Stock Items" value={data.lowStock}           icon="💊" color={data.lowStock > 5 ? 'text-red-600' : 'text-amber-600'} bg={data.lowStock > 5 ? 'bg-red-50' : 'bg-amber-50'} sub={`of ${data.totalStock} items`}/>
            <StatCard label="Workforce"      value={data.employees.length}    icon="👥" color="text-text"        bg="bg-white"      sub="Total employees"/>
          </div>

          {/* OPD Trend */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-text mb-3">6-Month OPD Trend</h3>
            <BarChart data={data.trend} color="#52b788" height={70}/>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top complaints */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-text mb-3">Top Complaints / Diagnoses</h3>
              {data.topComplaints.length === 0 ? (
                <div className="text-center text-muted py-6 text-sm">No OPD data for {monthLabel}</div>
              ) : data.topComplaints.map(([complaint, count], i) => {
                const pct = data.mVisits.length ? Math.round(count / data.mVisits.length * 100) : 0;
                return (
                  <div key={i} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-text font-medium">{complaint}</span>
                      <span className="text-muted">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-sage rounded-full" style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* OPD by shift + dept */}
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text mb-3">OPD by Shift</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key:'Morning',   icon:'🌅', bg:'bg-amber-50',   txt:'text-amber-600'  },
                    { key:'Afternoon', icon:'🌤️', bg:'bg-orange-50',  txt:'text-orange-600' },
                    { key:'Night',     icon:'🌙', bg:'bg-indigo-50',  txt:'text-indigo-600' },
                    { key:'General',   icon:'☀️', bg:'bg-blue-50',    txt:'text-blue-600'   },
                  ].map(s => (
                    <div key={s.key} className={`${s.bg} rounded-xl p-3 flex items-center gap-2`}>
                      <span>{s.icon}</span>
                      <div>
                        <div className={`text-lg font-bold ${s.txt}`}>{data.shiftMap[s.key] || 0}</div>
                        <div className="text-xs text-muted">{s.key}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text mb-3">Top Departments</h3>
                {data.deptBreakdown.length === 0 ? (
                  <div className="text-center text-muted py-4 text-sm">No data</div>
                ) : data.deptBreakdown.map(([dept, count], i) => {
                  const pct = data.mVisits.length ? Math.round(count / data.mVisits.length * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted w-4">{i+1}</span>
                      <span className="text-xs text-text flex-1 truncate">{dept}</span>
                      <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-sage2 rounded-full" style={{ width: `${pct}%` }}/>
                      </div>
                      <span className="text-xs font-bold text-text w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Referral status */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-text mb-3">Referrals — Status</h3>
              {Object.keys(data.refStatus).length === 0 ? (
                <div className="text-center text-muted py-4 text-sm">No referrals</div>
              ) : Object.entries(data.refStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                  <span className="text-xs capitalize text-text">{status}</span>
                  <span className="text-xs font-bold text-sage">{count}</span>
                </div>
              ))}
            </div>

            {/* Injuries */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-text mb-3">Injuries — Type</h3>
              {Object.keys(data.injMap).length === 0 ? (
                <div className="text-center text-muted py-4 text-sm">✅ No injuries</div>
              ) : Object.entries(data.injMap).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                  <span className="text-xs text-text truncate">{type}</span>
                  <span className="text-xs font-bold text-orange-600">{count}</span>
                </div>
              ))}
            </div>

            {/* Fitness summary */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-text mb-3">Fitness Status (Exams)</h3>
              {Object.keys(data.fitMap).length === 0 ? (
                <div className="text-center text-muted py-4 text-sm">No exams this month</div>
              ) : Object.entries(data.fitMap).map(([status, count]) => {
                const color = status === 'Fit' ? 'text-emerald-600' : status === 'Unfit' ? 'text-red-600' : 'text-amber-600';
                return (
                  <div key={status} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                    <span className="text-xs text-text">{status}</span>
                    <span className={`text-xs font-bold ${color}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compliance note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
            <strong>MIS Note:</strong> This report covers all OHC activities for <strong>{monthLabel}</strong>. Print and retain signed copies for management review and Inspector of Factories. Submit to HR/Admin by the 5th of the following month.
          </div>
        </>
      )}
    </div>
  );
}
