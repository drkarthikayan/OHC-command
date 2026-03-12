import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { fmtDate, initials } from '../../utils/formatters';
import { exportEmployeeHealthPdf } from './PdfExport';

// ─── IHI Score Engine ──────────────────────────────────────────────────────────
function calcIHI(exams, vitals, opd) {
  let score = 0, total = 0;
  const latest = exams?.[0] || {};
  const v = vitals?.[0] || {};

  // BP (20pts)
  if (v.bp || latest.bp) {
    total += 20;
    const bp = (v.bp || latest.bp || '').split('/');
    const sys = parseInt(bp[0]); const dia = parseInt(bp[1]);
    if (sys >= 90 && sys <= 120 && dia >= 60 && dia <= 80) score += 20;
    else if (sys <= 139 && dia <= 89) score += 12;
    else if (sys >= 140 || dia >= 90) score += 4;
  }
  // BMI (15pts)
  if (latest.bmi || v.bmi) {
    total += 15;
    const bmi = parseFloat(latest.bmi || v.bmi);
    if (bmi >= 18.5 && bmi <= 24.9) score += 15;
    else if (bmi >= 25 && bmi <= 29.9) score += 9;
    else score += 3;
  }
  // Blood sugar (15pts)
  if (latest.bloodSugar || latest.fbs) {
    total += 15;
    const bs = parseFloat(latest.bloodSugar || latest.fbs);
    if (bs >= 70 && bs <= 100) score += 15;
    else if (bs <= 125) score += 8;
    else score += 2;
  }
  // Hemoglobin (15pts)
  if (latest.hemoglobin || latest.hb) {
    total += 15;
    const hb = parseFloat(latest.hemoglobin || latest.hb);
    if (hb >= 12) score += 15;
    else if (hb >= 10) score += 8;
    else score += 2;
  }
  // OPD frequency penalty (10pts — fewer is better)
  total += 10;
  const opdLast90 = (opd || []).filter(o => {
    const d = o.date?.toDate ? o.date.toDate() : new Date(o.date);
    return (Date.now() - d) < 90 * 864e5;
  }).length;
  if (opdLast90 === 0) score += 10;
  else if (opdLast90 <= 2) score += 6;
  else score += 2;

  if (total === 0) return null;
  return Math.round((score / total) * 100);
}

function IHIGauge({ score }) {
  if (score === null) return (
    <div className="flex flex-col items-center justify-center h-32 text-muted text-sm">
      <div className="text-3xl mb-1">📋</div>No exam data yet
    </div>
  );
  const grade = score >= 85 ? ['Excellent','#52b788'] : score >= 70 ? ['Good','#6b9e8f'] : score >= 50 ? ['Average','#f59e0b'] : score >= 30 ? ['Below Avg','#f97316'] : ['Poor','#ef4444'];
  const pct = score / 100;
  const r = 52; const circ = 2 * Math.PI * r;
  const dash = circ * pct; const gap = circ - dash;
  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="90" viewBox="0 0 130 80">
        <path d="M15,75 A55,55 0 0,1 115,75" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round"/>
        <path d="M15,75 A55,55 0 0,1 115,75" fill="none" stroke={grade[1]} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(score/100)*172} 172`} style={{transition:'stroke-dasharray 1s ease'}}/>
        <text x="65" y="68" textAnchor="middle" fontSize="24" fontWeight="700" fill={grade[1]}>{score}</text>
      </svg>
      <div className="text-xs font-bold mt-1" style={{color:grade[1]}}>{grade[0]}</div>
      <div className="text-xs text-muted">IHI Score / 100</div>
    </div>
  );
}

function VitalsCard({ vitals }) {
  const v = vitals?.[0];
  if (!v) return <div className="text-muted text-sm text-center py-4">No vitals recorded</div>;
  const items = [
    { label:'BP', value: v.bp || '—', unit:'mmHg', icon:'🫀' },
    { label:'Pulse', value: v.pulse || '—', unit:'bpm', icon:'💓' },
    { label:'Temperature', value: v.temperature || v.temp || '—', unit:'°F', icon:'🌡️' },
    { label:'SpO₂', value: v.spo2 || v.spO2 || '—', unit:'%', icon:'💨' },
    { label:'BMI', value: v.bmi || '—', unit:'', icon:'⚖️' },
    { label:'Weight', value: v.weight || '—', unit:'kg', icon:'🏋️' },
  ];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {items.map(item => (
          <div key={item.label} className="bg-surface2 rounded-xl p-2.5 text-center">
            <div className="text-base mb-0.5">{item.icon}</div>
            <div className="text-sm font-bold text-text">{item.value} <span className="text-xs text-muted font-normal">{item.unit}</span></div>
            <div className="text-[10px] text-muted">{item.label}</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted mt-2 text-right">Last recorded: {v.date ? fmtDate(v.date) : v.createdAt ? fmtDate(v.createdAt) : '—'}</div>
    </div>
  );
}

const TABS = ['Overview','OPD History','Examinations','Vaccinations','Injuries'];

export default function EmployeeProfile({ emp, tid, onClose, onEdit }) {
  const [tab, setTab] = useState('Overview');
  const [opd, setOpd] = useState([]);
  const [exams, setExams] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [injuries, setInjuries] = useState([]);
  const [vitals, setVitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!emp || !tid) return;
    setLoading(true);
    setTab('Overview');

    const empId = emp.empId || emp.id;
    const empName = emp.name;

    const fetches = [
      getDocs(query(collection(db,'merchants',tid,'opd'), orderBy('createdAt','desc'), limit(20))),
      getDocs(query(collection(db,'merchants',tid,'periodicExams'), orderBy('createdAt','desc'), limit(10))).catch(() =>
        getDocs(query(collection(db,'merchants',tid,'annualChecks'), orderBy('createdAt','desc'), limit(10))).catch(() => ({ docs: [] }))
      ),
      getDocs(query(collection(db,'merchants',tid,'vaccinations'), orderBy('createdAt','desc'), limit(20))).catch(() => ({ docs: [] })),
      getDocs(query(collection(db,'merchants',tid,'injuries'), orderBy('createdAt','desc'), limit(20))).catch(() => ({ docs: [] })),
      getDocs(query(collection(db,'merchants',tid,'vitals'), orderBy('createdAt','desc'), limit(5))).catch(() => ({ docs: [] })),
    ];

    Promise.all(fetches).then(([opdSnap, examSnap, vacSnap, injSnap, vitSnap]) => {
      const filter = (snap) => snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.empId === empId || r.employeeId === empId || r.employeeName === empName);

      setOpd(filter(opdSnap));
      setExams(filter(examSnap));
      setVaccinations(filter(vacSnap));
      setInjuries(filter(injSnap));
      setVitals(filter(vitSnap));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [emp?.id, tid]);

  if (!emp) return null;

  const ihi = calcIHI(exams, vitals, opd);
  const age = emp.dob ? Math.floor((Date.now() - new Date(emp.dob)) / 3.156e10) : null;

  const statusColors = {
    Active: 'text-accent bg-accent/10',
    Inactive: 'text-muted bg-surface2',
    Pending: 'text-amber-500 bg-amber-500/10',
    'On Leave': 'text-blue-400 bg-blue-400/10',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        style={{animation: 'fadeIn 0.2s ease'}}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full bg-surface shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{width: 'min(680px, 95vw)', animation: 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)'}}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2d4a3e] to-[#1a3028] px-6 py-5 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-xl font-bold text-white border border-white/20 flex-shrink-0">
                {initials(emp.name)}
              </div>
              <div>
                <div className="text-white font-serif text-xl">{emp.name}</div>
                <div className="text-white/60 text-sm mt-0.5">{emp.empId} · {emp.designation || 'Staff'} · {emp.department || '—'}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/80`}>
                    {emp.status || 'Active'}
                  </span>
                  {emp.bloodGroup && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">🩸 {emp.bloodGroup}</span>}
                  {age && <span className="text-[11px] text-white/60">{age} yrs · {emp.gender}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!loading && (
                <button
                  onClick={() => exportEmployeeHealthPdf({ emp, opd, exams, vaccinations, injuries, tenantName: '' })}
                  className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >⬇ PDF</button>
              )}
              {onEdit && (
                <button onClick={onEdit} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors">
                  ✏️ Edit
                </button>
              )}
              <button onClick={onClose} className="text-white/60 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">×</button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: 'OPD Visits', value: opd.length || '—', icon: '🏥' },
              { label: 'Vaccinations', value: vaccinations.length || '—', icon: '💉' },
              { label: 'Injuries', value: injuries.length || '—', icon: '⚠️' },
              { label: 'Exams Done', value: exams.length || '—', icon: '📋' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <div className="text-base">{s.icon}</div>
                <div className="text-white font-bold text-sm">{loading ? '…' : s.value}</div>
                <div className="text-white/50 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-surface flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                tab === t
                  ? 'text-accent border-accent'
                  : 'text-muted border-transparent hover:text-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted">
              <div className="w-8 h-8 border-2 border-border border-t-sage rounded-full animate-spin mb-3" />
              Loading health data…
            </div>
          ) : (
            <>
              {tab === 'Overview' && (
                <div className="space-y-4">
                  {/* IHI + Vitals row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="card p-4">
                      <div className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Health Index</div>
                      <IHIGauge score={ihi} />
                    </div>
                    <div className="card p-4">
                      <div className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Latest Vitals</div>
                      <VitalsCard vitals={vitals} />
                    </div>
                  </div>

                  {/* Personal Details */}
                  <div className="card p-4">
                    <div className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Personal Information</div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Date of Joining', fmtDate(emp.doj)],
                        ['Date of Birth', emp.dob ? `${fmtDate(emp.dob)} (${age} yrs)` : '—'],
                        ['Mobile', emp.mobile || '—'],
                        ['Email', emp.email || '—'],
                        ['Blood Group', emp.bloodGroup || '—'],
                        ['Gender', emp.gender || '—'],
                      ].map(([l, v]) => (
                        <div key={l}>
                          <div className="text-[11px] text-muted mb-0.5">{l}</div>
                          <div className="text-sm text-text">{v}</div>
                        </div>
                      ))}
                      {emp.address && (
                        <div className="col-span-2">
                          <div className="text-[11px] text-muted mb-0.5">Address</div>
                          <div className="text-sm text-text">{emp.address}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent OPD */}
                  {opd.length > 0 && (
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold text-muted uppercase tracking-wider">Recent Visits</div>
                        <button onClick={() => setTab('OPD History')} className="text-xs text-accent hover:underline">View all →</button>
                      </div>
                      <div className="space-y-2">
                        {opd.slice(0, 3).map(o => (
                          <div key={o.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                            <div>
                              <div className="text-sm text-text">{o.complaint || o.chiefComplaint || 'Visit'}</div>
                              <div className="text-xs text-muted">{o.diagnosis || '—'}</div>
                            </div>
                            <div className="text-xs text-muted text-right">{o.date ? fmtDate(o.date) : o.createdAt ? fmtDate(o.createdAt) : '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'OPD History' && (
                <div className="space-y-2">
                  {opd.length === 0 ? (
                    <div className="text-center py-12 text-muted">
                      <div className="text-4xl mb-2">🏥</div>
                      No OPD visits recorded
                    </div>
                  ) : opd.map((o, i) => (
                    <div key={o.id} className="card p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent mt-0.5 flex-shrink-0">{i + 1}</div>
                          <div>
                            <div className="text-sm font-semibold text-text">{o.complaint || o.chiefComplaint || 'General Visit'}</div>
                            {o.diagnosis && <div className="text-xs text-muted mt-0.5">Dx: {o.diagnosis}</div>}
                            {o.treatment && <div className="text-xs text-text/70 mt-0.5">Rx: {o.treatment}</div>}
                            {(o.bp || o.pulse || o.temperature) && (
                              <div className="flex gap-3 mt-2 text-xs text-muted">
                                {o.bp && <span>BP: {o.bp}</span>}
                                {o.pulse && <span>Pulse: {o.pulse}</span>}
                                {o.temperature && <span>Temp: {o.temperature}°F</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <div className="text-xs text-muted">{o.date ? fmtDate(o.date) : o.createdAt ? fmtDate(o.createdAt) : '—'}</div>
                          {o.status && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                              o.status === 'Closed' ? 'text-accent bg-accent/10' : 'text-amber-500 bg-amber-500/10'
                            }`}>{o.status}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'Examinations' && (
                <div className="space-y-3">
                  {exams.length === 0 ? (
                    <div className="text-center py-12 text-muted">
                      <div className="text-4xl mb-2">📋</div>
                      No examination records
                    </div>
                  ) : exams.map((e, i) => (
                    <div key={e.id} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold text-sm text-text">{e.type || e.examType || 'Periodic Exam'} #{i + 1}</div>
                        <div className="text-xs text-muted">{e.date ? fmtDate(e.date) : e.createdAt ? fmtDate(e.createdAt) : '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[
                          ['BP', e.bp], ['BMI', e.bmi], ['Weight', e.weight ? `${e.weight} kg` : null],
                          ['Blood Sugar', e.bloodSugar || e.fbs], ['Hemoglobin', e.hemoglobin || e.hb],
                          ['Cholesterol', e.cholesterol], ['Vision', e.vision], ['Hearing', e.hearing],
                          ['Fitness', e.fitnessStatus || e.fitness],
                        ].filter(([, v]) => v).map(([l, v]) => (
                          <div key={l} className="bg-surface2 rounded-lg p-2">
                            <div className="text-muted text-[10px]">{l}</div>
                            <div className="text-text font-medium">{v}</div>
                          </div>
                        ))}
                      </div>
                      {e.remarks && <div className="mt-2 text-xs text-muted bg-surface2 rounded-lg p-2">Remarks: {e.remarks}</div>}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'Vaccinations' && (
                <div className="space-y-2">
                  {vaccinations.length === 0 ? (
                    <div className="text-center py-12 text-muted">
                      <div className="text-4xl mb-2">💉</div>
                      No vaccination records
                    </div>
                  ) : vaccinations.map(v => (
                    <div key={v.id} className="card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-sm flex-shrink-0">💉</div>
                        <div>
                          <div className="text-sm font-semibold text-text">{v.vaccineName || v.vaccine || 'Vaccine'}</div>
                          <div className="text-xs text-muted">Dose {v.doseNumber || v.dose || '—'} · {v.batchNumber ? `Batch: ${v.batchNumber}` : ''}</div>
                          {v.route && <div className="text-xs text-muted">{v.route}</div>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-text">{v.dateGiven ? fmtDate(v.dateGiven) : v.createdAt ? fmtDate(v.createdAt) : '—'}</div>
                        {v.nextDueDate && (
                          <div className="text-[10px] text-amber-500 mt-0.5">Next: {fmtDate(v.nextDueDate)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'Injuries' && (
                <div className="space-y-2">
                  {injuries.length === 0 ? (
                    <div className="text-center py-12 text-muted">
                      <div className="text-4xl mb-2">⚠️</div>
                      No injury records — great sign!
                    </div>
                  ) : injuries.map(inj => {
                    const sev = { Minor: 'text-amber-500 bg-amber-500/10', Moderate: 'text-orange-500 bg-orange-500/10', Severe: 'text-red-500 bg-red-500/10', Fatal: 'text-red-700 bg-red-700/10' };
                    return (
                      <div key={inj.id} className="card p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="text-sm font-semibold text-text">{inj.injuryType || inj.type || 'Workplace Injury'}</div>
                          <div className="flex items-center gap-2">
                            {inj.severity && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${sev[inj.severity] || 'text-muted'}`}>{inj.severity}</span>}
                            <span className="text-xs text-muted">{inj.date ? fmtDate(inj.date) : inj.createdAt ? fmtDate(inj.createdAt) : '—'}</span>
                          </div>
                        </div>
                        {inj.bodyPart && <div className="text-xs text-muted">Body part: {inj.bodyPart}</div>}
                        {inj.description && <div className="text-xs text-text/70 mt-1">{inj.description}</div>}
                        {inj.lostDays && <div className="text-xs text-muted mt-1">Lost days: {inj.lostDays}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  );
}
