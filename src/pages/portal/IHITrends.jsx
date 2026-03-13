import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { calcIHI, getIHIGrade } from '../../utils/ihi';
import toast from 'react-hot-toast';

/* ── Tiny SVG line chart ── */
function SparkLine({ data, color = '#52b788', height = 48, showArea = true }) {
  if (!data || data.length < 2) return (
    <div className="flex items-center justify-center h-12 text-xs text-muted">No data</div>
  );
  const W = 280, H = height;
  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - ((v - min) / range) * H,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = path + ` L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {showArea && <path d={area} fill={color} fillOpacity="0.12" />}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />
      ))}
    </svg>
  );
}

/* ── Multi-line chart ── */
function MultiLine({ series, height = 160 }) {
  if (!series || series.length === 0) return null;
  const allVals = series.flatMap(s => s.data);
  if (allVals.length === 0) return null;
  const W = 400, H = height;
  const min = Math.min(...allVals) - 5;
  const max = Math.max(...allVals) + 5;
  const range = max - min || 1;
  const maxLen = Math.max(...series.map(s => s.data.length));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = H - t * H;
        const val = Math.round(min + t * range);
        return (
          <g key={t}>
            <line x1="30" y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x="25" y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{val}</text>
          </g>
        );
      })}
      {series.map(s => {
        if (s.data.length < 1) return null;
        const pts = s.data.map((v, i) => [
          30 + (i / Math.max(s.data.length - 1, 1)) * (W - 35),
          H - ((v - min) / range) * H,
        ]);
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        return (
          <g key={s.label}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={s.color} />)}
          </g>
        );
      })}
    </svg>
  );
}

/* ── IHI gauge arc ── */
function IHIGauge({ score }) {
  const pct = score / 100;
  const r = 36, cx = 44, cy = 44;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - pct);
  const color = score >= 85 ? '#52b788' : score >= 70 ? '#74c69d' : score >= 50 ? '#f59e0b' : score >= 30 ? '#fb923c' : '#ef4444';
  return (
    <svg viewBox="0 0 88 52" className="w-24">
      <path d={`M8,44 A36,36 0 0,1 80,44`} fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
      <path d={`M8,44 A36,36 0 0,1 80,44`} fill="none" stroke={color} strokeWidth="8"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x="44" y="40" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

const TREND_COLORS = {
  ihi:    '#52b788',
  bp_sys: '#ef4444',
  bp_dia: '#f97316',
  bmi:    '#8b5cf6',
  sugar:  '#f59e0b',
  hb:     '#3b82f6',
};

export default function IHITrends() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [employees, setEmployees]   = useState([]);
  const [exams, setExams]           = useState([]);
  const [vitals, setVitals]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selEmp, setSelEmp]         = useState(null);
  const [empSearch, setEmpSearch]   = useState('');
  const [empSugg, setEmpSugg]       = useState([]);
  const [activeTab, setActiveTab]   = useState('ihi'); // ihi | vitals | compare
  const [deptFilter, setDeptFilter] = useState('all');

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [empSnap, examSnap, visitSnap] = await Promise.all([
          getDocs(collection(db, `merchants/${tenantId}/employees`)),
          getDocs(query(collection(db, `merchants/${tenantId}/periodic_exams`), orderBy('examDate', 'asc'))),
          getDocs(query(collection(db, `merchants/${tenantId}/opd_visits`), orderBy('createdAt', 'asc'))),
        ]);
        setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setExams(examSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setVitals(visitSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { toast.error('Failed to load'); }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  /* ── Employee search ── */
  useEffect(() => {
    if (!empSearch.trim()) { setEmpSugg([]); return; }
    const q = empSearch.toLowerCase();
    setEmpSugg(employees.filter(e =>
      e.name?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q)
    ).slice(0, 6));
  }, [empSearch, employees]);

  /* ── Compute IHI history for selected employee ── */
  const getEmpHistory = (emp) => {
    if (!emp) return [];
    const empExams = exams.filter(e => e.employeeId === emp.employeeId || e.employeeId === emp.id);
    return empExams.map(exam => ({
      date: exam.examDate || exam.date || '—',
      score: calcIHI(emp, exam, {}).total,
      bp: exam.bp || '',
      sugar: parseFloat(exam.bloodSugar || 0),
      hb: parseFloat(exam.haemoglobin || 0),
      bmi: (() => {
        const w = parseFloat(exam.weight || 0), h = parseFloat(exam.height || 0);
        return w && h ? parseFloat((w / ((h/100)**2)).toFixed(1)) : 0;
      })(),
    }));
  };

  /* ── BP parser ── */
  const parseBP = (bp) => {
    if (!bp) return { sys: 0, dia: 0 };
    const m = bp.match(/(\d+)[\/\-](\d+)/);
    return m ? { sys: parseInt(m[1]), dia: parseInt(m[2]) } : { sys: 0, dia: 0 };
  };

  /* ── Trajectory ── */
  const getTrend = (scores) => {
    if (scores.length < 2) return 'stable';
    const last = scores[scores.length - 1];
    const prev = scores[scores.length - 2];
    if (last - prev > 5) return 'improving';
    if (prev - last > 5) return 'declining';
    return 'stable';
  };

  /* ── Department IHI averages ── */
  const deptAverages = () => {
    const map = {};
    employees.forEach(emp => {
      const dept = emp.department || 'Unknown';
      const empExams = exams.filter(e => e.employeeId === emp.employeeId || e.employeeId === emp.id);
      const latest = empExams[empExams.length - 1];
      const score = calcIHI(emp, latest || {}, {}).total;
      if (!map[dept]) map[dept] = { total: 0, count: 0 };
      map[dept].total += score;
      map[dept].count++;
    });
    return Object.entries(map).map(([dept, v]) => ({
      dept,
      avg: Math.round(v.total / v.count),
      count: v.count,
    })).sort((a, b) => b.avg - a.avg);
  };

  /* ── All employees IHI for leaderboard ── */
  const allIHI = employees.map(emp => {
    const empExams = exams.filter(e => e.employeeId === emp.employeeId || e.employeeId === emp.id);
    const latest = empExams[empExams.length - 1];
    const result = calcIHI(emp, latest || {}, {});
    const history = empExams.map(ex => calcIHI(emp, ex, {}).total);
    return {
      ...emp,
      score: result.total,
      grade: getIHIGrade(result.total),
      trend: getTrend(history),
      examCount: empExams.length,
    };
  }).filter(e => deptFilter === 'all' || e.department === deptFilter)
    .sort((a, b) => b.score - a.score);

  const empHistory = selEmp ? getEmpHistory(selEmp) : [];
  const ihiScores  = empHistory.map(h => h.score);
  const bpSeries   = empHistory.map(h => parseBP(h.bp));
  const depts      = [...new Set(employees.map(e => e.department).filter(Boolean))];

  const trendConfig = {
    improving: { label: '↑ Improving', bg: 'bg-emerald-100', txt: 'text-emerald-700' },
    stable:    { label: '→ Stable',    bg: 'bg-blue-100',    txt: 'text-blue-700'    },
    declining: { label: '↓ Declining', bg: 'bg-red-100',     txt: 'text-red-700'     },
  };

  const gradeColor = {
    Excellent: 'text-emerald-600', Good: 'text-green-600',
    Average: 'text-amber-600', 'Below Average': 'text-orange-600', Poor: 'text-red-600',
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">IHI Trend Charts</h1>
          <p className="text-sm text-muted mt-0.5">Individual Health Index history & workforce analytics</p>
        </div>
        <div className="flex gap-2">
          {['ihi','vitals','compare'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                activeTab === t ? 'bg-sage text-white' : 'bg-white border border-border text-text hover:bg-surface2'
              }`}>
              {t === 'ihi' ? '📈 IHI Trends' : t === 'vitals' ? '💊 Vitals' : '🏢 Department'}
            </button>
          ))}
        </div>
      </div>

      {/* ── IHI TRENDS TAB ── */}
      {activeTab === 'ihi' && (
        <div className="space-y-4">
          {/* Employee search */}
          <div className="card p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Search employee to view IHI history…"
                  className="input w-full pl-9"/>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 absolute left-2.5 top-2.5 text-muted">
                  <path fillRule="evenodd" d="M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm3.09-1.32l2.73 2.73-1.06 1.06-2.73-2.73A5.5 5.5 0 116.5 12a5.47 5.47 0 01-3.09-.96z"/>
                </svg>
                {empSugg.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-border rounded-lg shadow-lg z-10 mt-1">
                    {empSugg.map(e => (
                      <button key={e.id} onClick={() => { setSelEmp(e); setEmpSearch(e.name||''); setEmpSugg([]); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface2 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-sage/20 text-sage flex items-center justify-center text-xs font-bold">
                          {(e.name||'?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text">{e.name}</div>
                          <div className="text-xs text-muted">{e.department} · {e.employeeId}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selEmp && (
                <button onClick={() => { setSelEmp(null); setEmpSearch(''); }}
                  className="text-xs text-muted hover:text-text px-3 py-2 border border-border rounded-lg">
                  Clear
                </button>
              )}
            </div>
          </div>

          {selEmp && empHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* IHI gauge + info */}
              <div className="card p-5 flex flex-col items-center text-center">
                <IHIGauge score={ihiScores[ihiScores.length - 1] || 0} />
                <div className="mt-2 text-lg font-display font-bold text-text">{selEmp.name}</div>
                <div className="text-xs text-muted">{selEmp.department} · {selEmp.employeeId}</div>
                <div className={`mt-2 text-sm font-semibold ${gradeColor[getIHIGrade(ihiScores[ihiScores.length-1]||0)] || 'text-text'}`}>
                  {getIHIGrade(ihiScores[ihiScores.length - 1] || 0)}
                </div>
                <div className={`mt-1.5 text-xs px-3 py-1 rounded-full font-medium ${trendConfig[getTrend(ihiScores)].bg} ${trendConfig[getTrend(ihiScores)].txt}`}>
                  {trendConfig[getTrend(ihiScores)].label}
                </div>
                <div className="mt-3 text-xs text-muted">{empHistory.length} exam{empHistory.length !== 1 ? 's' : ''} on record</div>
              </div>

              {/* IHI Line chart */}
              <div className="card p-5 md:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text">IHI Score Over Time</h3>
                  <span className="text-xs text-muted">{empHistory[0]?.date} → {empHistory[empHistory.length-1]?.date}</span>
                </div>
                <SparkLine data={ihiScores} color="#52b788" height={80} />
                <div className="mt-3 flex gap-2 flex-wrap">
                  {empHistory.map((h, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xs font-bold text-sage">{h.score}</div>
                      <div className="text-[10px] text-muted">{h.date?.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : selEmp ? (
            <div className="card p-8 text-center text-muted">
              <div className="text-3xl mb-2">📊</div>
              <div className="font-medium">No exam history for {selEmp.name}</div>
              <div className="text-xs mt-1">IHI trends will appear after periodic exams are recorded</div>
            </div>
          ) : (
            /* Leaderboard */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">All Employees — IHI Leaderboard</h3>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="input text-xs w-36">
                  <option value="all">All Departments</option>
                  {depts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface2 border-b border-border text-xs text-muted uppercase">
                      <th className="text-left px-4 py-2.5">Rank</th>
                      <th className="text-left px-4 py-2.5">Employee</th>
                      <th className="text-left px-4 py-2.5">Department</th>
                      <th className="text-left px-4 py-2.5">IHI Score</th>
                      <th className="text-left px-4 py-2.5">Grade</th>
                      <th className="text-left px-4 py-2.5">Trend</th>
                      <th className="text-left px-4 py-2.5">Exams</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allIHI.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-muted py-10">
                        <div className="text-2xl mb-1">📊</div>No employee data
                      </td></tr>
                    ) : allIHI.map((emp, i) => {
                      const tc = trendConfig[emp.trend];
                      const gc = gradeColor[emp.grade] || 'text-text';
                      const barW = emp.score;
                      const barColor = emp.score >= 85 ? 'bg-emerald-400' : emp.score >= 70 ? 'bg-green-400' : emp.score >= 50 ? 'bg-amber-400' : 'bg-red-400';
                      return (
                        <tr key={emp.id} className="border-b border-border hover:bg-surface2 cursor-pointer transition-colors"
                          onClick={() => { setSelEmp(emp); setEmpSearch(emp.name||''); }}>
                          <td className="px-4 py-3 text-muted font-medium">#{i+1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-sage/20 text-sage text-xs font-bold flex items-center justify-center">
                                {(emp.name||'?')[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-text">{emp.name}</div>
                                <div className="text-xs text-muted">{emp.employeeId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted text-xs">{emp.department || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }}/>
                              </div>
                              <span className="font-bold text-text">{emp.score}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-3 text-xs font-semibold ${gc}`}>{emp.grade}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tc.bg} ${tc.txt}`}>{tc.label}</span>
                          </td>
                          <td className="px-4 py-3 text-muted text-xs">{emp.examCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VITALS TAB ── */}
      {activeTab === 'vitals' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="relative">
              <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                placeholder="Search employee to view vitals trends…"
                className="input w-full pl-9"/>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 absolute left-2.5 top-2.5 text-muted">
                <path fillRule="evenodd" d="M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm3.09-1.32l2.73 2.73-1.06 1.06-2.73-2.73A5.5 5.5 0 116.5 12a5.47 5.47 0 01-3.09-.96z"/>
              </svg>
              {empSugg.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-border rounded-lg shadow-lg z-10 mt-1">
                  {empSugg.map(e => (
                    <button key={e.id} onClick={() => { setSelEmp(e); setEmpSearch(e.name||''); setEmpSugg([]); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-surface2 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-sage/20 text-sage flex items-center justify-center text-xs font-bold">
                        {(e.name||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text">{e.name}</div>
                        <div className="text-xs text-muted">{e.department}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selEmp && empHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BP Chart */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-red-400 inline-block"/>
                  <h3 className="text-sm font-semibold text-text">Blood Pressure (mmHg)</h3>
                </div>
                <MultiLine height={120} series={[
                  { label: 'Systolic',  data: bpSeries.map(b=>b.sys).filter(v=>v>0),  color: '#ef4444' },
                  { label: 'Diastolic', data: bpSeries.map(b=>b.dia).filter(v=>v>0), color: '#f97316' },
                ]} />
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Systolic</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>Diastolic</span>
                </div>
              </div>
              {/* Blood Sugar */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"/>
                  <h3 className="text-sm font-semibold text-text">Blood Sugar (mg/dL)</h3>
                </div>
                <SparkLine data={empHistory.map(h=>h.sugar).filter(v=>v>0)} color="#f59e0b" height={120}/>
                <div className="text-xs text-muted mt-1">Normal: 70–100 mg/dL (fasting)</div>
              </div>
              {/* Haemoglobin */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-blue-400 inline-block"/>
                  <h3 className="text-sm font-semibold text-text">Haemoglobin (g/dL)</h3>
                </div>
                <SparkLine data={empHistory.map(h=>h.hb).filter(v=>v>0)} color="#3b82f6" height={120}/>
                <div className="text-xs text-muted mt-1">Normal: M ≥13 g/dL · F ≥12 g/dL</div>
              </div>
              {/* BMI */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-purple-400 inline-block"/>
                  <h3 className="text-sm font-semibold text-text">BMI (kg/m²)</h3>
                </div>
                <SparkLine data={empHistory.map(h=>h.bmi).filter(v=>v>0)} color="#8b5cf6" height={120}/>
                <div className="text-xs text-muted mt-1">Normal: 18.5–24.9 kg/m²</div>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-muted">
              <div className="text-3xl mb-2">💊</div>
              <div>{selEmp ? `No vitals history for ${selEmp.name}` : 'Search an employee to view vitals trends'}</div>
            </div>
          )}
        </div>
      )}

      {/* ── DEPARTMENT COMPARE TAB ── */}
      {activeTab === 'compare' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dept avg bars */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-text mb-4">Department IHI Averages</h3>
              <div className="space-y-3">
                {deptAverages().map(d => {
                  const color = d.avg >= 85 ? 'bg-emerald-400' : d.avg >= 70 ? 'bg-green-400' : d.avg >= 50 ? 'bg-amber-400' : 'bg-red-400';
                  return (
                    <div key={d.dept}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-text font-medium">{d.dept}</span>
                        <span className="text-muted">{d.avg} · {d.count} emp</span>
                      </div>
                      <div className="w-full h-2.5 bg-border rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${d.avg}%` }}/>
                      </div>
                    </div>
                  );
                })}
                {deptAverages().length === 0 && (
                  <div className="text-center text-muted py-6 text-sm">No department data</div>
                )}
              </div>
            </div>

            {/* Grade distribution */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-text mb-4">Workforce Health Grade Distribution</h3>
              {(() => {
                const grades = { Excellent: 0, Good: 0, Average: 0, 'Below Average': 0, Poor: 0 };
                allIHI.forEach(e => { if (grades[e.grade] !== undefined) grades[e.grade]++; });
                const total = allIHI.length || 1;
                const colors = { Excellent: 'bg-emerald-400', Good: 'bg-green-400', Average: 'bg-amber-400', 'Below Average': 'bg-orange-400', Poor: 'bg-red-400' };
                return (
                  <div className="space-y-3">
                    {Object.entries(grades).map(([grade, count]) => (
                      <div key={grade}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-text">{grade}</span>
                          <span className="text-muted">{count} ({Math.round(count/total*100)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${colors[grade]}`} style={{ width: `${Math.round(count/total*100)}%` }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* At-risk employees */}
            <div className="card p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-text mb-4">🚨 At-Risk Employees (IHI &lt; 50)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {allIHI.filter(e => e.score < 50).map(emp => (
                  <div key={emp.id} className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-full bg-red-200 text-red-700 text-xs font-bold flex items-center justify-center">
                        {(emp.name||'?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-text truncate">{emp.name}</div>
                        <div className="text-[10px] text-muted">{emp.department}</div>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-red-600">{emp.score}</div>
                    <div className="text-[10px] text-red-500">{emp.grade}</div>
                  </div>
                ))}
                {allIHI.filter(e => e.score < 50).length === 0 && (
                  <div className="col-span-4 text-center text-muted py-6 text-sm">
                    ✅ No at-risk employees
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
