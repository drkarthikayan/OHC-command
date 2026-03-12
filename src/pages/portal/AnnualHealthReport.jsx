import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

// ─── Brand / print helpers ────────────────────────────────────────────────────
const G = { green:'#2d6a4f', sage:'#6b9e8f', light:'#f0f4f8', border:'#e2e8f0', text:'#1a2d1a', muted:'#6b7280', amber:'#d97706', red:'#dc2626' };

function fv(v) {
  if (!v) return '—';
  if (v?.toDate) return v.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  if (typeof v==='string' && v.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  return String(v);
}

function printHtml(body) {
  const win = window.open('','_blank','width=960,height=800');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Annual Health Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Plus Jakarta Sans',sans-serif;background:white;color:#1a2d1a;padding:32px;}
  @page{size:A4 portrait;margin:18mm;}
  @media print{body{padding:0;}.no-print{display:none!important;}table{page-break-inside:auto;}tr{page-break-inside:avoid;}}
  h2{font-size:15px;font-weight:700;color:${G.green};margin:24px 0 10px;text-transform:uppercase;letter-spacing:0.5px;border-left:4px solid ${G.green};padding-left:10px;}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px;}
  th{background:${G.green};color:white;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.4px;}
  td{padding:6px 10px;border-bottom:1px solid ${G.border};}
  .stat-grid{display:grid;gap:10px;margin-bottom:20px;}
  .stat{background:${G.light};border-radius:8px;padding:12px;text-align:center;}
  .stat-val{font-size:24px;font-weight:800;color:${G.green};}
  .stat-lbl{font-size:10px;color:${G.muted};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
  .section{margin-bottom:28px;}
  .badge-ok{color:#16a34a;background:#dcfce7;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600;}
  .badge-warn{color:${G.amber};background:#fef3c7;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600;}
  .badge-bad{color:${G.red};background:#fee2e2;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600;}
  .chart-bar-wrap{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11px;}
  .chart-bar-bg{flex:1;background:#e5e7eb;border-radius:4px;height:14px;overflow:hidden;}
  .chart-bar{height:100%;border-radius:4px;background:${G.green};}
  .insight{background:#f0fdf4;border-left:3px solid ${G.green};padding:10px 14px;border-radius:0 8px 8px 0;font-size:12px;color:#166534;margin:8px 0;}
  .insight-warn{background:#fffbeb;border-left-color:${G.amber};color:#92400e;}
  .insight-bad{background:#fef2f2;border-left-color:${G.red};color:#991b1b;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .card{background:${G.light};border-radius:10px;padding:14px;}
  .card-title{font-size:11px;font-weight:700;color:${G.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;}
  .kv{display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid ${G.border};}
  .kv:last-child{border:none;}
  .kv-key{color:${G.muted};}
  .kv-val{font-weight:600;}
</style>
</head><body>
<div class="no-print" style="position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px;">
  <button onclick="window.print()" style="background:${G.green};color:white;border:none;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🖨️ Print / Save PDF</button>
  <button onclick="window.close()" style="background:${G.light};color:${G.text};border:1px solid ${G.border};padding:9px 14px;border-radius:8px;font-size:13px;cursor:pointer;">✕ Close</button>
</div>
${body}
</body></html>`);
  win.document.close();
}

// ─── Data loader ──────────────────────────────────────────────────────────────
async function loadAll(tid) {
  const get = (col, ord) => getDocs(ord ? query(collection(db,'merchants',tid,col),orderBy(ord,'desc')) : collection(db,'merchants',tid,col))
    .then(s => s.docs.map(d=>({id:d.id,...d.data()})));

  const [employees, opd, pharmacy, injuries, vaccinations, exams, preEmp, certificates, hospitalCases] = await Promise.all([
    get('employees'), get('opd','createdAt'), get('pharmacy'), get('injuries','createdAt'),
    get('vaccinations','createdAt'), get('periodicExams','createdAt'), get('preEmployment','createdAt'),
    get('certificates','createdAt'), get('hospitalCases','createdAt'),
  ]);
  return { employees, opd, pharmacy, injuries, vaccinations, exams, preEmp, certificates, hospitalCases };
}

// ─── Report generator ─────────────────────────────────────────────────────────
function buildReport(data, tenantName, year) {
  const { employees, opd, pharmacy, injuries, vaccinations, exams, preEmp, certificates, hospitalCases } = data;

  // Year filter helper
  const inYear = (v, dateField) => {
    const raw = v[dateField];
    if (!raw) return false;
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    return d.getFullYear() === year;
  };

  const opdY = opd.filter(v => inYear(v,'visitDate') || inYear(v,'createdAt'));
  const injY = injuries.filter(v => inYear(v,'createdAt') || inYear(v,'date'));
  const vacY = vaccinations.filter(v => inYear(v,'createdAt') || inYear(v,'dateGiven'));
  const examY = exams.filter(v => inYear(v,'createdAt'));
  const preY = preEmp.filter(v => inYear(v,'createdAt'));
  const certY = certificates.filter(v => inYear(v,'createdAt') || inYear(v,'issueDate'));
  const hospY = hospitalCases.filter(v => inYear(v,'createdAt'));

  // Dept breakdown helper
  const byDept = (arr, field='department') => {
    const m={};
    arr.forEach(r=>{const d=r[field]||'Unknown';m[d]=(m[d]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  };

  // Complaint frequency
  const complaintMap={};
  opdY.forEach(v=>{(v.complaints||[v.complaint]).filter(Boolean).forEach(c=>{complaintMap[c]=(complaintMap[c]||0)+1;});});
  const topComplaints = Object.entries(complaintMap).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Injury types
  const injTypeMap={};
  injY.forEach(r=>{const t=r.injuryType||r.type||'Unknown';injTypeMap[t]=(injTypeMap[t]||0)+1;});
  const topInjTypes = Object.entries(injTypeMap).sort((a,b)=>b[1]-a[1]).slice(0,6);

  // Dept OPD
  const deptOpd = byDept(opdY);
  const deptInj = byDept(injY);

  // Lost days
  const totalLostDays = injY.reduce((s,r)=>s+(parseInt(r.lostDays)||0),0);
  const lostDayCases = injY.filter(r=>(parseInt(r.lostDays)||0)>0).length;

  // Fitness status
  const fitCount = employees.filter(e=>e.fitnessStatus==='Fit'||!e.fitnessStatus).length;
  const unfitCount = employees.filter(e=>e.fitnessStatus==='Unfit').length;
  const restrictedCount = employees.filter(e=>e.fitnessStatus==='Restricted').length;

  // Pharmacy
  const outOfStock = pharmacy.filter(i=>i.quantity===0).length;
  const lowStock = pharmacy.filter(i=>i.quantity>0&&i.quantity<=(i.minStock||10)).length;
  const expiringSoon = pharmacy.filter(i=>{if(!i.expiry)return false;const d=new Date(i.expiry);return d>new Date()&&(d-Date.now())<30*864e5;}).length;

  // Monthly OPD trend
  const monthlyOpd = Array(12).fill(0);
  opdY.forEach(v=>{
    const raw=v.visitDate||v.createdAt;
    if(!raw)return;
    const d=raw?.toDate?raw.toDate():new Date(raw);
    if(d.getFullYear()===year)monthlyOpd[d.getMonth()]++;
  });
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const maxOpdMonth=Math.max(...monthlyOpd,1);

  // Gender split
  const maleCount=employees.filter(e=>e.gender==='Male').length;
  const femaleCount=employees.filter(e=>e.gender==='Female').length;
  const otherCount=employees.length-maleCount-femaleCount;

  // Blood group
  const bgMap={};
  employees.forEach(e=>{if(e.bloodGroup){bgMap[e.bloodGroup]=(bgMap[e.bloodGroup]||0)+1;}});

  // Insights
  const insights=[];
  const incidenceRate = employees.length ? ((injY.length/employees.length)*100).toFixed(1) : 0;
  if(injY.length>0){
    insights.push({type:incidenceRate>5?'bad':'warn', text:`Injury incidence rate: ${incidenceRate}% (${injY.length} injuries among ${employees.length} employees). ${incidenceRate>5?'Action required — review safety protocols.':'Within acceptable range.'}`});
  }
  if(totalLostDays>0){
    insights.push({type:'warn',text:`${totalLostDays} man-days lost due to workplace injuries across ${lostDayCases} lost-day cases.`});
  }
  if(lowStock+outOfStock>0){
    insights.push({type:outOfStock>0?'bad':'warn',text:`Pharmacy alert: ${outOfStock} items out of stock, ${lowStock} items below minimum level. Procurement review recommended.`});
  }
  if(expiringSoon>0){
    insights.push({type:'warn',text:`${expiringSoon} pharmacy items expiring within 30 days. Review and dispose as per biomedical waste policy.`});
  }
  const opdPerEmp = employees.length ? (opdY.length/employees.length).toFixed(1) : 0;
  insights.push({type:'ok',text:`Average OPD utilisation: ${opdPerEmp} visits per employee for ${year}. ${opdPerEmp>5?'High utilisation — consider additional medical staff.':''}`});
  if(vacY.length>0){
    insights.push({type:'ok',text:`${vacY.length} vaccinations administered in ${year}. Continue immunization schedule per OSHA guidelines.`});
  }

  // Bar chart helper
  const bar = (label,val,max,color=G.green) =>
    `<div class="chart-bar-wrap"><div style="width:130px;color:${G.muted};text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${label}</div>
    <div class="chart-bar-bg"><div class="chart-bar" style="width:${Math.round((val/Math.max(max,1))*100)}%;background:${color};"></div></div>
    <div style="width:30px;text-align:right;font-weight:600;">${val}</div></div>`;

  // Section: header
  const header = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:18px;border-bottom:3px solid ${G.green};margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;background:${G.green};border-radius:10px;display:flex;align-items:center;justify-content:center;"><span style="color:white;font-size:24px;font-weight:800;">+</span></div>
        <div>
          <div style="font-size:20px;font-weight:800;color:${G.green};">OHC Command</div>
          <div style="font-size:12px;color:${G.muted};">${tenantName||'Occupational Health Centre'}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:22px;font-weight:800;color:${G.text};">Annual Health Report ${year}</div>
        <div style="font-size:11px;color:${G.muted};">Management Summary · Confidential</div>
        <div style="font-size:10px;color:${G.muted};margin-top:3px;">Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>
    </div>`;

  // Executive summary stats
  const execStats = `
    <div class="section">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px;">
        ${[
          ['Employees',employees.length],
          [`OPD Visits (${year})`,opdY.length],
          [`Injuries (${year})`,injY.length],
          [`Vaccinations (${year})`,vacY.length],
          ['Pharmacy Items',pharmacy.length],
        ].map(([l,v])=>`<div class="stat"><div class="stat-val">${v}</div><div class="stat-lbl">${l}</div></div>`).join('')}
      </div>
    </div>`;

  // Insights
  const insightHtml = `
    <div class="section">
      <h2>Key Insights & Recommendations</h2>
      ${insights.map(i=>`<div class="insight${i.type==='warn'?' insight-warn':i.type==='bad'?' insight-bad':''}">${i.text}</div>`).join('')}
    </div>`;

  // Workforce overview
  const deptRows = byDept(employees).map(([d,n],i)=>
    `<tr style="background:${i%2===0?'white':G.light};"><td>${d}</td><td style="font-weight:600;">${n}</td><td>${Math.round(n/Math.max(employees.length,1)*100)}%</td></tr>`).join('');

  const workforce = `
    <div class="section">
      <h2>Workforce Overview</h2>
      <div class="two-col">
        <div>
          <div class="card">
            <div class="card-title">Workforce Snapshot</div>
            ${[
              ['Total Employees',employees.length],
              ['Active',employees.filter(e=>e.status==='Active').length],
              ['Male / Female / Other',`${maleCount} / ${femaleCount} / ${otherCount}`],
              ['Fit for Work',fitCount],
              ['Restricted Duty',restrictedCount],
              ['Unfit',unfitCount],
            ].map(([k,v])=>`<div class="kv"><span class="kv-key">${k}</span><span class="kv-val">${v}</span></div>`).join('')}
          </div>
        </div>
        <div>
          <div class="card-title" style="font-size:11px;font-weight:700;color:${G.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Department Distribution</div>
          <table><thead><tr><th>Department</th><th>Headcount</th><th>%</th></tr></thead><tbody>${deptRows}</tbody></table>
        </div>
      </div>
    </div>`;

  // OPD analysis
  const monthlyChart = monthlyOpd.map((v,i)=>bar(months[i],v,maxOpdMonth)).join('');
  const deptOpdRows = deptOpd.slice(0,8).map(([d,n],i)=>
    `<tr style="background:${i%2===0?'white':G.light};"><td>${d}</td><td style="font-weight:600;">${n}</td></tr>`).join('');
  const complaintRows = topComplaints.map(([c,n],i)=>
    `<tr style="background:${i%2===0?'white':G.light};"><td>${c}</td><td style="font-weight:600;">${n}</td></tr>`).join('');

  const opdSection = `
    <div class="section">
      <h2>OPD / Clinical Activity (${year})</h2>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
        ${[
          [`Total Visits`,opdY.length],
          ['Open Cases',opdY.filter(v=>v.status==='Open').length],
          ['Closed',opdY.filter(v=>v.status==='Closed').length],
          ['Follow-up',opdY.filter(v=>v.status==='Follow-up').length],
        ].map(([l,v])=>`<div class="stat"><div class="stat-val">${v}</div><div class="stat-lbl">${l}</div></div>`).join('')}
      </div>
      <div class="two-col">
        <div>
          <div class="card-title" style="font-size:11px;font-weight:700;color:${G.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Monthly OPD Trend</div>
          ${monthlyChart}
        </div>
        <div class="two-col" style="gap:12px;">
          <div>
            <div class="card-title" style="font-size:11px;font-weight:700;color:${G.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">By Department</div>
            <table><thead><tr><th>Dept</th><th>Visits</th></tr></thead><tbody>${deptOpdRows}</tbody></table>
          </div>
          <div>
            <div class="card-title" style="font-size:11px;font-weight:700;color:${G.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Top Complaints</div>
            <table><thead><tr><th>Complaint</th><th>Count</th></tr></thead><tbody>${complaintRows||'<tr><td colspan="2" style="color:#9ca3af;">No data</td></tr>'}</tbody></table>
          </div>
        </div>
      </div>
    </div>`;

  // Injury analysis
  const injTypeRows = topInjTypes.map(([t,n],i)=>
    `<tr style="background:${i%2===0?'white':G.light};"><td>${t}</td><td style="font-weight:600;">${n}</td></tr>`).join('');
  const injDeptRows = deptInj.slice(0,6).map(([d,n],i)=>
    `<tr style="background:${i%2===0?'white':G.light};"><td>${d}</td><td style="font-weight:600;">${n}</td></tr>`).join('');

  const injSection = `
    <div class="section">
      <h2>Workplace Injury Analysis (${year})</h2>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
        ${[
          ['Total Incidents',injY.length],
          ['Lost-Day Cases',lostDayCases],
          ['Total Lost Days',totalLostDays],
          ['Incidence Rate',incidenceRate+'%'],
        ].map(([l,v])=>`<div class="stat"><div class="stat-val">${v}</div><div class="stat-lbl">${l}</div></div>`).join('')}
      </div>
      ${injY.length ? `
      <div class="two-col">
        <div>
          <div class="card-title" style="font-size:11px;font-weight:700;color:${G.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">By Injury Type</div>
          <table><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>${injTypeRows||'<tr><td colspan="2">—</td></tr>'}</tbody></table>
        </div>
        <div>
          <div class="card-title" style="font-size:11px;font-weight:700;color:${G.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">By Department</div>
          <table><thead><tr><th>Dept</th><th>Count</th></tr></thead><tbody>${injDeptRows||'<tr><td colspan="2">—</td></tr>'}</tbody></table>
        </div>
      </div>
      <div style="margin-top:12px;">
        <div class="card-title" style="font-size:11px;font-weight:700;color:${G.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Recent Incidents</div>
        <table>
          <thead><tr><th>Date</th><th>Employee</th><th>Dept</th><th>Type</th><th>Severity</th><th>Lost Days</th><th>Status</th></tr></thead>
          <tbody>${injY.slice(0,10).map((r,i)=>`<tr style="background:${i%2===0?'white':G.light};">
            <td>${fv(r.date||r.injuryDate||r.createdAt)}</td><td>${r.employeeName||'—'}</td><td>${r.department||'—'}</td>
            <td>${r.injuryType||r.type||'—'}</td><td>${r.severity||'—'}</td><td>${r.lostDays||'0'}</td><td>${r.status||'—'}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>` : `<p style="color:${G.muted};text-align:center;padding:20px;">No injuries recorded in ${year}. ✅</p>`}
    </div>`;

  // Vaccination
  const vaccineMap={};
  vacY.forEach(v=>{const n=v.vaccineName||v.vaccine||'Unknown';vaccineMap[n]=(vaccineMap[n]||0)+1;});
  const vacRows = Object.entries(vaccineMap).sort((a,b)=>b[1]-a[1]).map(([v,n],i)=>
    `<tr style="background:${i%2===0?'white':G.light};"><td>${v}</td><td style="font-weight:600;">${n}</td></tr>`).join('');

  const vacSection = `
    <div class="section">
      <h2>Vaccination Programme (${year})</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
        ${[
          ['Total Administered',vacY.length],
          ['Vaccines Used',Object.keys(vaccineMap).length],
          ['Employees Covered',new Set(vacY.map(v=>v.employeeId)).size],
        ].map(([l,v])=>`<div class="stat"><div class="stat-val">${v}</div><div class="stat-lbl">${l}</div></div>`).join('')}
      </div>
      ${vacY.length?`<table><thead><tr><th>Vaccine</th><th>Doses Given</th></tr></thead><tbody>${vacRows}</tbody></table>`
        :`<p style="color:${G.muted};text-align:center;padding:20px;">No vaccinations recorded in ${year}.</p>`}
    </div>`;

  // Pharmacy summary
  const pharmSection = `
    <div class="section">
      <h2>Pharmacy Inventory Status</h2>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
        ${[
          ['Total Items',pharmacy.length],
          ['Out of Stock',outOfStock],
          ['Low Stock',lowStock],
          ['Expiring Soon',expiringSoon],
        ].map(([l,v])=>`<div class="stat"><div class="stat-val" style="color:${v>0&&l!=='Total Items'?G.amber:G.green};">${v}</div><div class="stat-lbl">${l}</div></div>`).join('')}
      </div>
      <table>
        <thead><tr><th>Medicine</th><th>Category</th><th>Unit</th><th>Qty</th><th>Min Stock</th><th>Status</th></tr></thead>
        <tbody>${pharmacy.slice(0,20).map((i,idx)=>{
          const isLow=i.quantity<=(i.minStock||10);const isEmpty=i.quantity===0;
          return `<tr style="background:${idx%2===0?'white':G.light};">
            <td style="font-weight:500;">${i.name||'—'}</td><td>${i.category||'—'}</td><td>${i.unit||'—'}</td>
            <td style="font-weight:700;color:${isEmpty?G.red:isLow?G.amber:G.text};">${i.quantity??0}</td>
            <td>${i.minStock||10}</td>
            <td>${isEmpty?'<span class="badge-bad">Out of Stock</span>':isLow?'<span class="badge-warn">Low</span>':'<span class="badge-ok">OK</span>'}</td>
          </tr>`;}).join('')}
        </tbody>
      </table>
    </div>`;

  // Exams & pre-employment
  const examSection = `
    <div class="section">
      <h2>Medical Examinations (${year})</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;">
        ${[
          [`Pre-Employment`,preY.length],
          ['Periodic Exams',examY.length],
          ['Certificates Issued',certY.length],
        ].map(([l,v])=>`<div class="stat"><div class="stat-val">${v}</div><div class="stat-lbl">${l}</div></div>`).join('')}
      </div>
    </div>`;

  // Footer
  const footer = `
    <div style="margin-top:32px;padding-top:14px;border-top:2px solid ${G.border};display:flex;justify-content:space-between;align-items:center;font-size:10px;color:${G.muted};">
      <span>OHC Command · Annual Health Report ${year} · Confidential — For Management Use Only</span>
      <span>Generated on ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</span>
    </div>`;

  return header + execStats + insightHtml + workforce + opdSection + injSection + vacSection + pharmSection + examSection + footer;
}

// ─── UI Page ──────────────────────────────────────────────────────────────────
export default function AnnualHealthReportPage() {
  const { tenant } = useAuthStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // summary stats for preview
  const [generating, setGenerating] = useState(false);

  const tid = tenant?.id;
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear-1, currentYear-2, currentYear-3];

  const loadPreview = async () => {
    if (!tid) return;
    setLoading(true);
    try {
      const data = await loadAll(tid);
      const inYear = (v, f) => {
        const raw = v[f]; if (!raw) return false;
        const d = raw?.toDate ? raw.toDate() : new Date(raw);
        return d.getFullYear() === year;
      };
      setPreview({
        employees: data.employees.length,
        opd: data.opd.filter(v => inYear(v,'visitDate')||inYear(v,'createdAt')).length,
        injuries: data.injuries.filter(v => inYear(v,'createdAt')||inYear(v,'date')).length,
        vaccinations: data.vaccinations.filter(v => inYear(v,'createdAt')||inYear(v,'dateGiven')).length,
        pharmacy: data.pharmacy.length,
        exams: data.exams.filter(v => inYear(v,'createdAt')).length,
        _data: data,
      });
    } catch(e) { toast.error('Failed to load data: '+e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tid) loadPreview(); }, [tid, year]);

  const generate = async () => {
    if (!preview?._data) { toast.error('Load preview first.'); return; }
    setGenerating(true);
    try {
      const html = buildReport(preview._data, tenant?.name, year);
      printHtml(html);
      toast.success('Report opened in new window. Use Print / Save PDF.');
    } catch(e) { toast.error('Generation failed: '+e.message); }
    finally { setGenerating(false); }
  };

  const StatCard = ({ label, value, icon, sub }) => (
    <div className="card p-4 flex items-start gap-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-text">{value ?? '—'}</div>
        <div className="text-xs text-muted uppercase tracking-wide mt-0.5">{label}</div>
        {sub && <div className="text-xs text-accent mt-1">{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Annual Health Report</h1>
          <p className="text-muted text-sm mt-1">Comprehensive management summary — all modules in one PDF</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="field-input w-28"
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={generate}
            disabled={generating || loading || !preview}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {generating ? '⏳ Generating…' : '📄 Generate Report'}
          </button>
        </div>
      </div>

      {/* What's included */}
      <div className="card p-5 mb-6">
        <div className="font-semibold text-text text-sm mb-3">📋 Report includes</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-muted">
          {[
            '✅ Executive summary with key health KPIs',
            '✅ Workforce overview & department breakdown',
            '✅ OPD analysis with monthly trend chart',
            '✅ Top complaints & high-utilisation departments',
            '✅ Workplace injury analysis (OSHA-style)',
            '✅ Injury types, severity, lost-day cases',
            '✅ Vaccination programme coverage',
            '✅ Pharmacy inventory status',
            '✅ Medical examinations summary',
            '✅ AI-generated insights & recommendations',
          ].map((item, i) => (
            <div key={i}>{item}</div>
          ))}
        </div>
      </div>

      {/* Preview stats */}
      {loading ? (
        <div className="card p-10 text-center text-muted text-sm">Loading {year} data…</div>
      ) : preview ? (
        <>
          <div className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            Data Preview — {year}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard icon="👥" label="Employees" value={preview.employees} />
            <StatCard icon="📋" label={`OPD Visits (${year})`} value={preview.opd} />
            <StatCard icon="⚠️" label={`Injuries (${year})`} value={preview.injuries}
              sub={preview.injuries > 0 ? `${((preview.injuries/Math.max(preview.employees,1))*100).toFixed(1)}% incidence rate` : 'No incidents'} />
            <StatCard icon="💉" label={`Vaccinations (${year})`} value={preview.vaccinations} />
            <StatCard icon="💊" label="Pharmacy Items" value={preview.pharmacy} />
            <StatCard icon="🔬" label={`Exams (${year})`} value={preview.exams} />
          </div>

          {/* Generate CTA */}
          <div className="bg-sage/10 border border-sage/20 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="font-semibold text-text">Ready to generate</div>
              <div className="text-sm text-muted mt-0.5">Opens a printable A4 PDF in a new window. Use "Print / Save PDF" to download.</div>
            </div>
            <button
              onClick={generate}
              disabled={generating}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 shrink-0 ml-4"
            >
              {generating ? '⏳ Please wait…' : '📄 Generate Report →'}
            </button>
          </div>
        </>
      ) : (
        <div className="card p-10 text-center text-muted text-sm">
          Select a year and click Generate to create the report.
        </div>
      )}
    </div>
  );
}
