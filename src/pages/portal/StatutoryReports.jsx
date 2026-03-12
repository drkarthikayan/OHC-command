import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

/* ── Form definitions ── */
const FORMS = {
  /* ── National / Central Forms ── */
  form7: {
    label: 'Form 7',
    title: 'Register of Adult Workers',
    law: 'Factories Act 1948 — Section 62',
    scope: 'national',
    description: 'Mandatory register of all adult workers with employment details, nature of work, shift timings and leave records.',
    fields: ['employeeName','employeeId','department','designation','dateOfJoining','shift','natureOfWork'],
    icon: '📋',
    color: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  form11: {
    label: 'Form 11',
    title: 'Humidity Register',
    law: 'Factories Act 1948 — Section 15',
    scope: 'national',
    description: 'Register of humidity levels recorded in the factory. Required for factories where humidity is artificially increased.',
    fields: ['date','temperature','humidity','location','recordedBy'],
    icon: '🌡️',
    color: 'bg-cyan-50 border-cyan-200',
    badge: 'bg-cyan-100 text-cyan-700',
  },
  form17: {
    label: 'Form 17',
    title: 'Accident / Injury Register',
    law: 'Factories Act 1948 — Section 88',
    scope: 'national',
    description: 'Register of all accidents and injuries occurring in the factory. Must be reported to the Inspector of Factories within 48 hours for serious injuries.',
    fields: ['date','employeeName','employeeId','department','injuryType','bodyPart','causeOfAccident','treatmentGiven','daysLost','outcome'],
    icon: '⚠️',
    color: 'bg-orange-50 border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
  },
  form27: {
    label: 'Form 27',
    title: 'Leave with Wages Register',
    law: 'Factories Act 1948 — Section 62 & 79',
    scope: 'national',
    description: 'Annual register of leave earned, availed, and carried forward by workers. Must be updated at the start of each calendar year.',
    fields: ['employeeName','employeeId','department','leaveDue','leaveAvailed','leaveBalance','year'],
    icon: '📅',
    color: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-700',
  },
  /* ── Tamil Nadu Specific Forms ── */
  form24: {
    label: 'Form 24',
    title: 'Health Register (Tamil Nadu)',
    law: 'Tamil Nadu Factories Rules 1950 — Rule 80',
    scope: 'tamilnadu',
    description: 'Mandatory health register maintained by the OHC doctor for all workers. Records medical examinations, fitness certificates, and health conditions.',
    fields: ['employeeName','employeeId','department','examDate','bpReading','bloodSugar','hemoglobin','bmi','fitnessStatus','nextExamDate','doctor'],
    icon: '🏥',
    color: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  form40: {
    label: 'Form 40',
    title: 'Medical Examination Register (Tamil Nadu)',
    law: 'Tamil Nadu Factories Rules 1950 — Rule 95',
    scope: 'tamilnadu',
    description: 'Pre-employment and periodic medical examination register. Tracks all mandatory examinations for workers in hazardous processes.',
    fields: ['employeeName','employeeId','department','examType','examDate','eyeSight','hearing','lungFunction','xray','bloodTest','fitnessStatus','doctor'],
    icon: '🔬',
    color: 'bg-purple-50 border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
  },
  morbidity: {
    label: 'Monthly Morbidity',
    title: 'Monthly Morbidity Report',
    law: 'Factories Act 1948 + DGFASLI Guidelines',
    scope: 'national',
    description: 'Monthly disease-wise morbidity report showing OPD visits, diagnosis distribution, lost work days, and occupational disease trends.',
    fields: ['month','year','totalVisits','topDiagnoses','occupationalDiseases','referrals','hospitalisations','lostWorkDays'],
    icon: '📊',
    color: 'bg-rose-50 border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
  },
  form21: {
    label: 'Form 21',
    title: 'Register of Dangerous Occurrences',
    law: 'Factories Act 1948 — Section 88A',
    scope: 'national',
    description: 'Register of dangerous occurrences (near misses, hazardous events) that may have caused death or serious injury. Must be reported immediately.',
    fields: ['date','time','location','natureOfOccurrence','personsInvolved','preventiveMeasures','reportedTo'],
    icon: '🚨',
    color: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function StatutoryReports() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [employees, setEmployees]   = useState([]);
  const [visits, setVisits]         = useState([]);
  const [injuries, setInjuries]     = useState([]);
  const [preEmp, setPreEmp]         = useState([]);
  const [periodicExams, setPeriodic] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeForm, setActiveForm] = useState('form7');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [selMonth, setSelMonth]     = useState(new Date().getMonth());
  const [selYear, setSelYear]       = useState(CURRENT_YEAR);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [empSnap, visitSnap, injSnap, preSnap, perSnap] = await Promise.all([
          getDocs(collection(db, `merchants/${tenantId}/employees`)),
          getDocs(query(collection(db, `merchants/${tenantId}/opd_visits`), orderBy('createdAt','desc'))),
          getDocs(collection(db, `merchants/${tenantId}/injuries`)),
          getDocs(collection(db, `merchants/${tenantId}/pre_employment`)),
          getDocs(collection(db, `merchants/${tenantId}/periodic_exams`)),
        ]);
        setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setVisits(visitSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setInjuries(injSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPreEmp(preSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPeriodic(perSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { toast.error('Failed to load data'); }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  /* ── Generate report data from Firestore ── */
  const generateReportData = (formKey) => {
    const monthStr = `${selYear}-${String(selMonth + 1).padStart(2,'0')}`;
    switch(formKey) {
      case 'form7':
        return employees.map((e,i) => ({
          'S.No': i+1,
          'Employee Name': e.name || '—',
          'Employee ID': e.employeeId || '—',
          'Department': e.department || '—',
          'Designation': e.designation || '—',
          'Date of Joining': e.dateOfJoining || '—',
          'Shift': e.shift || 'General',
          'Nature of Work': e.natureOfWork || '—',
        }));
      case 'form17':
        return injuries.map((inj,i) => ({
          'S.No': i+1,
          'Date': inj.date || '—',
          'Employee Name': inj.employeeName || '—',
          'Employee ID': inj.employeeId || '—',
          'Department': inj.department || '—',
          'Injury Type': inj.injuryType || '—',
          'Body Part Affected': inj.bodyPart || '—',
          'Cause of Accident': inj.description || '—',
          'First Aid Given': inj.firstAidGiven || '—',
          'Days Lost': inj.daysLost || '0',
          'Outcome': inj.outcome || '—',
        }));
      case 'form24':
        return [...preEmp, ...periodicExams].map((e,i) => ({
          'S.No': i+1,
          'Employee Name': e.employeeName || e.name || '—',
          'Employee ID': e.employeeId || '—',
          'Department': e.department || '—',
          'Exam Date': e.examDate || e.date || '—',
          'BP': e.bp || e.bloodPressure || '—',
          'Blood Sugar': e.bloodSugar || '—',
          'Haemoglobin': e.haemoglobin || '—',
          'BMI': e.bmi || '—',
          'Fitness Status': e.fitnessStatus || e.fitness || '—',
          'Next Exam Due': e.nextExamDate || '—',
          'Examining Doctor': e.doctor || e.examinedBy || '—',
        }));
      case 'form40':
        return periodicExams.map((e,i) => ({
          'S.No': i+1,
          'Employee Name': e.employeeName || '—',
          'Employee ID': e.employeeId || '—',
          'Department': e.department || '—',
          'Exam Type': e.examType || 'Periodic',
          'Exam Date': e.examDate || e.date || '—',
          'Eye Sight': e.eyeSight || '—',
          'Hearing': e.hearing || '—',
          'Lung Function': e.lungFunction || '—',
          'X-Ray': e.xray || '—',
          'Blood Test': e.bloodTest || '—',
          'Fitness': e.fitnessStatus || '—',
          'Doctor': e.doctor || '—',
        }));
      case 'morbidity': {
        const monthVisits = visits.filter(v => (v.date||'').startsWith(monthStr) || (v.createdAt?.toDate ? v.createdAt.toDate().toISOString() : '').startsWith(monthStr));
        const diagMap = {};
        monthVisits.forEach(v => { if(v.complaint) diagMap[v.complaint] = (diagMap[v.complaint]||0)+1; });
        const topDiag = Object.entries(diagMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
        return topDiag.map(([diag, count], i) => ({
          'S.No': i+1,
          'Diagnosis / Complaint': diag,
          'No. of Cases': count,
          '% of Total': monthVisits.length ? ((count/monthVisits.length)*100).toFixed(1)+'%' : '—',
          'Month': MONTHS[selMonth] + ' ' + selYear,
          'Total OPD Visits': monthVisits.length,
        }));
      }
      case 'form27':
        return employees.map((e,i) => ({
          'S.No': i+1,
          'Employee Name': e.name || '—',
          'Employee ID': e.employeeId || '—',
          'Department': e.department || '—',
          'Leave Due (days)': e.leaveDue || '—',
          'Leave Availed': e.leaveAvailed || '—',
          'Leave Balance': e.leaveBalance || '—',
          'Year': selYear,
        }));
      default:
        return employees.slice(0,5).map((e,i) => ({ 'S.No': i+1, 'Employee': e.name, 'ID': e.employeeId }));
    }
  };

  /* ── Print / Export ── */
  const handlePrint = (formKey) => {
    const formDef = FORMS[formKey];
    const data = generateReportData(formKey);
    const cols = data.length > 0 ? Object.keys(data[0]) : [];
    const monthLabel = formKey === 'morbidity' ? `${MONTHS[selMonth]} ${selYear}` : `Year ${selYear}`;

    const html = `<!DOCTYPE html>
<html>
<head>
<title>${formDef.label} — ${formDef.title}</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 14px; }
  .header h1 { font-size: 15px; margin: 0 0 4px; font-weight: bold; letter-spacing: 1px; }
  .header h2 { font-size: 13px; margin: 0 0 6px; font-weight: normal; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; color: #444; margin-bottom: 14px; }
  .law-badge { background: #f0f4f8; border: 1px solid #ccc; border-radius: 4px; padding: 3px 8px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #1a3a5c; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) { background: #f7f9fc; }
  .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 10px; border-top: 1px solid #ccc; padding-top: 10px; }
  .sign-box { border: 1px solid #888; width: 160px; height: 50px; display: inline-block; margin-top: 5px; }
  .empty-state { text-align: center; padding: 30px; color: #888; font-style: italic; }
</style>
</head>
<body>
<div class="header">
  <h1>${formDef.label} — ${formDef.title}</h1>
  <h2>${tenant?.name || 'Company Name'} &nbsp;|&nbsp; OHC Portal</h2>
</div>
<div class="meta">
  <span class="law-badge">📜 ${formDef.law}</span>
  <span>Period: ${monthLabel}</span>
  <span>Generated: ${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'})}</span>
  <span>Total Records: ${data.length}</span>
</div>
${data.length === 0 ? '<div class="empty-state">No records found for the selected period.</div>' : `
<table>
  <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
  <tbody>${data.map(row=>`<tr>${cols.map(c=>`<td>${row[c]??'—'}</td>`).join('')}</tr>`).join('')}</tbody>
</table>`}
<div class="footer">
  <div>
    <div>OHC Doctor / Medical Officer</div>
    <div class="sign-box"></div>
  </div>
  <div style="text-align:center">
    <div>HR Manager / Factory Manager</div>
    <div class="sign-box"></div>
  </div>
  <div style="text-align:right">
    <div>Company Seal</div>
    <div class="sign-box"></div>
  </div>
</div>
</body>
</html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.print(); };
    toast.success(`${formDef.label} ready to print`);
  };

  const filteredForms = Object.entries(FORMS).filter(([,f]) =>
    scopeFilter === 'all' || f.scope === scopeFilter
  );

  const activeFormDef = FORMS[activeForm];
  const reportData = generateReportData(activeForm);
  const cols = reportData.length > 0 ? Object.keys(reportData[0]) : [];

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
          <h1 className="text-2xl font-display font-bold text-text">Statutory Reports</h1>
          <p className="text-sm text-muted mt-0.5">Factory Act compliance — national & Tamil Nadu forms</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))} className="input text-sm w-36">
            {MONTHS.map((m,i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e=>setSelYear(Number(e.target.value))} className="input text-sm w-24">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => handlePrint(activeForm)}
            className="btn-primary flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4 1h8v4H4V1zM2 6h12a1 1 0 011 1v5a1 1 0 01-1 1h-2v-3H4v3H2a1 1 0 01-1-1V7a1 1 0 011-1zm9 1.5a.5.5 0 110 1 .5.5 0 010-1z"/></svg>
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Employees',    val: employees.length,  color: 'text-text',       bg: 'bg-white'     },
          { label: 'Injuries on Record', val: injuries.length,   color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Health Exams',       val: preEmp.length + periodicExams.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'OPD Visits',         val: visits.length,     color: 'text-sage',       bg: 'bg-sage/5'    },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-border`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Left: Form selector */}
        <div className="w-64 flex-shrink-0 space-y-2">
          {/* Scope filter */}
          <div className="flex gap-1 bg-surface2 rounded-lg p-1">
            {[['all','All'],['national','National'],['tamilnadu','Tamil Nadu']].map(([k,l]) => (
              <button key={k} onClick={() => setScopeFilter(k)}
                className={`flex-1 text-xs py-1 rounded-md font-medium transition-all ${scopeFilter===k ? 'bg-white shadow text-text' : 'text-muted'}`}>
                {l}
              </button>
            ))}
          </div>

          {filteredForms.map(([key, form]) => (
            <button key={key} onClick={() => setActiveForm(key)}
              className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                activeForm === key
                  ? 'border-sage bg-sage/5'
                  : 'border-border bg-white hover:border-sage/40'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{form.icon}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${form.badge}`}>{form.label}</span>
                {form.scope === 'tamilnadu' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">TN</span>
                )}
              </div>
              <div className="text-xs font-medium text-text leading-tight">{form.title}</div>
              <div className="text-[10px] text-muted mt-0.5 truncate">{form.law}</div>
            </button>
          ))}
        </div>

        {/* Right: Report preview */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Form header */}
          <div className={`rounded-xl border-2 p-5 ${activeFormDef.color}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeFormDef.icon}</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-display font-bold text-text">{activeFormDef.label} — {activeFormDef.title}</h2>
                    {activeFormDef.scope === 'tamilnadu' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Tamil Nadu</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-1">📜 {activeFormDef.law}</div>
                  <p className="text-sm text-text mt-2 max-w-xl">{activeFormDef.description}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold text-text">{reportData.length}</div>
                <div className="text-xs text-muted">records</div>
              </div>
            </div>
          </div>

          {/* Period selector for morbidity */}
          {activeForm === 'morbidity' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700 font-medium">
              📊 Showing morbidity data for <strong>{MONTHS[selMonth]} {selYear}</strong> — {reportData.length} diagnoses from {visits.filter(v=>(v.date||'').startsWith(`${selYear}-${String(selMonth+1).padStart(2,'0')}`)).length} OPD visits
            </div>
          )}

          {/* Data table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface2 border-b border-border">
                    {cols.map(c => (
                      <th key={c} className="text-left px-3 py-2.5 text-muted uppercase tracking-wide font-semibold whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.length === 0 ? (
                    <tr><td colSpan={cols.length || 3} className="text-center text-muted py-12">
                      <div className="text-3xl mb-2">{activeFormDef.icon}</div>
                      <div className="font-medium">No records found</div>
                      <div className="text-xs mt-1">Data will appear here once records are entered in the respective modules</div>
                    </td></tr>
                  ) : reportData.map((row, i) => (
                    <tr key={i} className="border-b border-border hover:bg-surface2 transition-colors">
                      {cols.map(c => (
                        <td key={c} className="px-3 py-2 text-text whitespace-nowrap">{row[c] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Print footer note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            <strong>Note:</strong> Printed forms require signature of Factory Manager / HR Manager and OHC Medical Officer. Keep signed copies for Inspector of Factories. Maintain records for minimum <strong>3 years</strong> as per Factories Act.
          </div>
        </div>
      </div>
    </div>
  );
}
