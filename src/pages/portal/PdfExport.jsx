/**
 * OHC Command — Universal PDF Export
 * Uses browser print API — no external libraries, zero bundle cost.
 * Generates branded A4 reports for any module.
 */

const BRAND = {
  green: '#2d6a4f',
  sage:  '#6b9e8f',
  light: '#f0f4f8',
  border:'#e2e8f0',
  text:  '#1a2d1a',
  muted: '#6b7280',
};

function fmtVal(v) {
  if (!v) return '—';
  if (v?.toDate) return v.toDate().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  if (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(v).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  }
  return String(v);
}

// ─── HTML template builders ───────────────────────────────────────────────────

function headerHtml(title, subtitle, tenant, dateRange) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid ${BRAND.green};margin-bottom:20px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:${BRAND.green};border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:18px;font-weight:700;">+</span>
          </div>
          <div>
            <div style="font-size:18px;font-weight:700;color:${BRAND.green};">OHC Command</div>
            <div style="font-size:11px;color:${BRAND.muted};">${tenant || 'Occupational Health Centre'}</div>
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:700;color:${BRAND.text};">${title}</div>
        <div style="font-size:11px;color:${BRAND.muted};">${subtitle || ''}</div>
        <div style="font-size:10px;color:${BRAND.muted};margin-top:2px;">
          ${dateRange || 'Generated: ' + new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
        </div>
      </div>
    </div>`;
}

function statsHtml(stats) {
  if (!stats?.length) return '';
  return `
    <div style="display:grid;grid-template-columns:repeat(${Math.min(stats.length,4)},1fr);gap:10px;margin-bottom:20px;">
      ${stats.map(s => `
        <div style="background:${BRAND.light};border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:${BRAND.green};">${s.value}</div>
          <div style="font-size:10px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;">${s.label}</div>
        </div>`).join('')}
    </div>`;
}

function tableHtml(columns, rows, emptyMsg) {
  if (!rows?.length) return `<p style="text-align:center;color:${BRAND.muted};padding:30px;">${emptyMsg || 'No records found.'}</p>`;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:${BRAND.green};">
          ${columns.map(c => `<th style="padding:8px 10px;text-align:left;color:white;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">${c.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, i) => `
          <tr style="background:${i % 2 === 0 ? 'white' : BRAND.light};">
            ${columns.map(c => {
              const val = c.key ? fmtVal(row[c.key]) : (c.render ? c.render(row) : '—');
              return `<td style="padding:7px 10px;color:${BRAND.text};border-bottom:1px solid ${BRAND.border};">${val}</td>`;
            }).join('')}
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function footerHtml() {
  return `
    <div style="margin-top:30px;padding-top:12px;border-top:1px solid ${BRAND.border};display:flex;justify-content:space-between;font-size:9px;color:${BRAND.muted};">
      <span>OHC Command · Confidential Medical Record</span>
      <span>Printed on ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}</span>
    </div>`;
}

// ─── Print trigger ────────────────────────────────────────────────────────────

function printHtml(bodyHtml, landscape = false) {
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OHC Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 30px; color: #1a2d1a; background: white; }
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 20mm; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px;">
    <button onclick="window.print()" style="background:#2d6a4f;color:white;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🖨️ Print / Save PDF</button>
    <button onclick="window.close()" style="background:#f0f4f8;color:#1a2d1a;border:1px solid #e2e8f0;padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer;">✕ Close</button>
  </div>
  ${bodyHtml}
</body>
</html>`);
  win.document.close();
}

// ─── Report generators ────────────────────────────────────────────────────────

export function exportOpdRegister(visits, tenantName, dateFilter) {
  const cols = [
    { label:'#',           render: (_,i) => i+1 },
    { label:'Date',        key: 'visitDate' },
    { label:'Employee',    key: 'employeeName' },
    { label:'Dept',        key: 'department' },
    { label:'Complaint',   key: 'complaint' },
    { label:'Diagnosis',   key: 'diagnosis' },
    { label:'Treatment',   key: 'treatment' },
    { label:'BP',          render: r => r.vitals?.bp || r.bp || '—' },
    { label:'Status',      key: 'status' },
  ];

  // fix render to pass index
  const rows = visits;
  const tableRows = rows.map((row, i) => {
    const cells = cols.map(c => {
      if (c.key) return `<td style="padding:7px 10px;color:${BRAND.text};border-bottom:1px solid ${BRAND.border};">${fmtVal(row[c.key])}</td>`;
      if (c.render) return `<td style="padding:7px 10px;color:${BRAND.text};border-bottom:1px solid ${BRAND.border};">${c.render(row,i) ?? '—'}</td>`;
      return '<td>—</td>';
    });
    return `<tr style="background:${i%2===0?'white':BRAND.light};">${cells.join('')}</tr>`;
  });

  const open   = visits.filter(v => v.status === 'Open').length;
  const closed = visits.filter(v => v.status === 'Closed').length;

  const html = `
    ${headerHtml('OPD Register', dateFilter || 'All visits', tenantName)}
    ${statsHtml([
      { label:'Total Visits',  value: visits.length },
      { label:'Open',          value: open },
      { label:'Closed',        value: closed },
      { label:'Unique Employees', value: new Set(visits.map(v=>v.employeeId)).size },
    ])}
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:${BRAND.green};">
          ${cols.map(c=>`<th style="padding:8px 10px;text-align:left;color:white;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">${c.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${tableRows.join('')}</tbody>
    </table>
    ${!visits.length ? `<p style="text-align:center;color:${BRAND.muted};padding:30px;">No OPD records found.</p>` : ''}
    ${footerHtml()}`;

  printHtml(html, true);
}

export function exportEmployeeList(employees, tenantName) {
  const cols = [
    { label:'#',           render: (_,i) => i+1 },
    { label:'Emp ID',      key: 'empId' },
    { label:'Name',        key: 'name' },
    { label:'Department',  key: 'department' },
    { label:'Designation', key: 'designation' },
    { label:'Blood Grp',   key: 'bloodGroup' },
    { label:'Gender',      key: 'gender' },
    { label:'Mobile',      key: 'mobile' },
    { label:'DOJ',         key: 'doj' },
    { label:'Status',      key: 'status' },
  ];

  const byDept = {};
  employees.forEach(e => { byDept[e.department||'General'] = (byDept[e.department||'General']||0)+1; });
  const topDepts = Object.entries(byDept).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([d,n])=>`${d} (${n})`).join(', ');

  const tableRows = employees.map((row, i) => {
    const cells = cols.map(c => {
      if (c.key) return `<td style="padding:7px 10px;color:${BRAND.text};border-bottom:1px solid ${BRAND.border};">${fmtVal(row[c.key])}</td>`;
      if (c.render) return `<td style="padding:7px 10px;color:${BRAND.text};border-bottom:1px solid ${BRAND.border};">${c.render(row,i)}</td>`;
      return '<td>—</td>';
    });
    return `<tr style="background:${i%2===0?'white':BRAND.light};">${cells.join('')}</tr>`;
  });

  const html = `
    ${headerHtml('Employee Master List', `${employees.length} employees · Top depts: ${topDepts}`, tenantName)}
    ${statsHtml([
      { label:'Total',   value: employees.length },
      { label:'Active',  value: employees.filter(e=>e.status==='Active').length },
      { label:'Inactive',value: employees.filter(e=>e.status==='Inactive').length },
      { label:'Depts',   value: Object.keys(byDept).length },
    ])}
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:${BRAND.green};">
          ${cols.map(c=>`<th style="padding:8px 10px;text-align:left;color:white;font-weight:600;font-size:10px;text-transform:uppercase;">${c.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${tableRows.join('')}</tbody>
    </table>
    ${footerHtml()}`;

  printHtml(html, true);
}

export function exportInjuryRegister(injuries, tenantName) {
  const tableRows = injuries.map((row, i) => {
    return `<tr style="background:${i%2===0?'white':BRAND.light};">
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${i+1}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${fmtVal(row.date||row.injuryDate||row.createdAt)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.employeeName||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.department||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.injuryType||row.type||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.bodyPart||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.severity||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.lostDays||'0'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.status||'—'}</td>
    </tr>`;
  });

  const lostDaysTotal = injuries.reduce((s,r)=>s+(parseInt(r.lostDays)||0),0);

  const html = `
    ${headerHtml('Injury Register', 'OSHA 300 Format', tenantName)}
    ${statsHtml([
      { label:'Total Incidents', value: injuries.length },
      { label:'Lost Day Cases',  value: injuries.filter(r=>r.lostDays>0).length },
      { label:'Total Lost Days', value: lostDaysTotal },
      { label:'Open Cases',      value: injuries.filter(r=>r.status!=='Closed').length },
    ])}
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:${BRAND.green};">
          ${['#','Date','Employee','Dept','Type','Body Part','Severity','Lost Days','Status'].map(h=>`<th style="padding:8px 10px;text-align:left;color:white;font-weight:600;font-size:10px;text-transform:uppercase;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${tableRows.join('')}</tbody>
    </table>
    ${!injuries.length?`<p style="text-align:center;color:${BRAND.muted};padding:30px;">No injury records.</p>`:''}
    ${footerHtml()}`;

  printHtml(html, true);
}

export function exportPharmacyStock(stock, tenantName) {
  const tableRows = stock.map((row, i) => {
    const isLow = row.quantity <= (row.minStock ?? 10);
    const isEmpty = row.quantity === 0;
    const rowBg = isEmpty ? '#fff5f5' : isLow ? '#fffbeb' : (i%2===0?'white':BRAND.light);
    const qtyColor = isEmpty ? '#dc2626' : isLow ? '#d97706' : BRAND.text;
    return `<tr style="background:${rowBg};">
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${i+1}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};font-weight:500;">${row.name||row.medicineName||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.category||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.unit||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};color:${qtyColor};font-weight:600;">${row.quantity??'0'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.minStock??10}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${fmtVal(row.expiryDate)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${isEmpty?'<span style="color:#dc2626;font-weight:700;">OUT OF STOCK</span>':isLow?'<span style="color:#d97706;font-weight:600;">LOW</span>':'<span style="color:#16a34a;">OK</span>'}</td>
    </tr>`;
  });

  const html = `
    ${headerHtml('Pharmacy Stock Report', 'Current inventory status', tenantName)}
    ${statsHtml([
      { label:'Total Items',    value: stock.length },
      { label:'Out of Stock',   value: stock.filter(s=>s.quantity===0).length },
      { label:'Low Stock',      value: stock.filter(s=>s.quantity>0&&s.quantity<=(s.minStock??10)).length },
      { label:'Adequate',       value: stock.filter(s=>s.quantity>(s.minStock??10)).length },
    ])}
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:${BRAND.green};">
          ${['#','Medicine','Category','Unit','Qty','Min','Expiry','Status'].map(h=>`<th style="padding:8px 10px;text-align:left;color:white;font-weight:600;font-size:10px;text-transform:uppercase;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${tableRows.join('')}</tbody>
    </table>
    ${!stock.length?`<p style="text-align:center;color:${BRAND.muted};padding:30px;">No stock records.</p>`:''}
    ${footerHtml()}`;

  printHtml(html, true);
}

export function exportVaccinationRegister(vaccinations, tenantName) {
  const tableRows = vaccinations.map((row, i) => {
    const dueDate = row.nextDueDate ? new Date(row.nextDueDate?.toDate?row.nextDueDate.toDate():row.nextDueDate) : null;
    const isOverdue = dueDate && dueDate < new Date();
    const isDueSoon = dueDate && !isOverdue && (dueDate - Date.now()) < 30 * 864e5;
    return `<tr style="background:${i%2===0?'white':BRAND.light};">
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${i+1}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};font-weight:500;">${row.employeeName||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.department||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.vaccineName||row.vaccine||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.doseNumber||row.dose||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${fmtVal(row.dateGiven||row.createdAt)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};color:${isOverdue?'#dc2626':isDueSoon?'#d97706':BRAND.text};">
        ${dueDate ? (isOverdue?'⚠️ ':isDueSoon?'⏰ ':'')+fmtVal(row.nextDueDate) : '—'}
      </td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BRAND.border};">${row.batchNumber||'—'}</td>
    </tr>`;
  });

  const html = `
    ${headerHtml('Vaccination Register', 'Employee immunization records', tenantName)}
    ${statsHtml([
      { label:'Total Records', value: vaccinations.length },
      { label:'Overdue',       value: vaccinations.filter(v=>{const d=v.nextDueDate?new Date(v.nextDueDate?.toDate?v.nextDueDate.toDate():v.nextDueDate):null;return d&&d<new Date();}).length },
      { label:'Due This Month',value: vaccinations.filter(v=>{const d=v.nextDueDate?new Date(v.nextDueDate?.toDate?v.nextDueDate.toDate():v.nextDueDate):null;return d&&d>new Date()&&(d-Date.now())<30*864e5;}).length },
      { label:'Up to Date',    value: vaccinations.filter(v=>!v.nextDueDate||new Date(v.nextDueDate?.toDate?v.nextDueDate.toDate():v.nextDueDate)>new Date()).length },
    ])}
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:${BRAND.green};">
          ${['#','Employee','Dept','Vaccine','Dose','Date Given','Next Due','Batch No'].map(h=>`<th style="padding:8px 10px;text-align:left;color:white;font-weight:600;font-size:10px;text-transform:uppercase;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${tableRows.join('')}</tbody>
    </table>
    ${!vaccinations.length?`<p style="text-align:center;color:${BRAND.muted};padding:30px;">No vaccination records.</p>`:''}
    ${footerHtml()}`;

  printHtml(html, true);
}

// ─── Reusable export button component ─────────────────────────────────────────
export function ExportPdfButton({ onClick, label = 'Export PDF', small = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 font-medium text-muted hover:text-accent border border-border hover:border-accent/40 bg-surface hover:bg-accent/5 rounded-lg transition-all ${small ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
      title="Export as PDF"
    >
      <svg width={small?12:14} height={small?12:14} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      {label}
    </button>
  );
}

// ─── Employee 360° Health Profile PDF ────────────────────────────────────────
export function exportEmployeeHealthPdf({ emp, opd = [], exams = [], vaccinations = [], injuries = [], tenantName }) {
  const age = emp.dob ? Math.floor((Date.now() - new Date(emp.dob).getTime()) / (365.25 * 864e5)) : null;
  const latestExam = exams[0] || {};

  const mkTable = (headers, rows) => `
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px;">
      <thead><tr style="background:${BRAND.green};">${headers.map(h=>`<th style="padding:7px 10px;text-align:left;color:white;font-size:10px;text-transform:uppercase;">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  const opdRows = opd.slice(0,20).map((v,i)=>`<tr style="background:${i%2===0?'white':BRAND.light};">
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${fmtVal(v.visitDate)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${v.complaint||'—'}</td>
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${v.diagnosis||'—'}</td>
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${v.status||'—'}</td>
  </tr>`).join('');

  const vacRows = vaccinations.slice(0,20).map((v,i)=>`<tr style="background:${i%2===0?'white':BRAND.light};">
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${v.vaccineName||v.vaccine||'—'}</td>
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${v.doseNumber||v.dose||'—'}</td>
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${fmtVal(v.dateGiven||v.createdAt)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${fmtVal(v.nextDueDate)}</td>
  </tr>`).join('');

  const injRows = injuries.slice(0,10).map((r,i)=>`<tr style="background:${i%2===0?'white':BRAND.light};">
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${fmtVal(r.date||r.injuryDate||r.createdAt)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${r.injuryType||r.type||'—'}</td>
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${r.severity||'—'}</td>
    <td style="padding:6px 10px;border-bottom:1px solid ${BRAND.border};">${r.status||'—'}</td>
  </tr>`).join('');

  const infoGrid = (pairs) => pairs.filter(([,v])=>v).map(([l,v])=>
    `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${BRAND.border};font-size:11px;">
      <span style="color:${BRAND.muted};">${l}</span>
      <span style="font-weight:500;">${fmtVal(v)}</span>
    </div>`).join('');

  const html = `
    ${headerHtml('Employee Health Profile', `${emp.name} · ${emp.empId||''}`, tenantName||'')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div style="background:${BRAND.light};border-radius:10px;padding:14px;">
        <div style="font-size:11px;font-weight:700;color:${BRAND.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Personal Info</div>
        ${infoGrid([['Name',emp.name],['Emp ID',emp.empId],['Department',emp.department],['Designation',emp.designation],['Blood Group',emp.bloodGroup],['Gender',emp.gender],['Age',age?`${age} years`:null],['Date of Joining',emp.doj],['Status',emp.status]])}
      </div>
      <div style="background:${BRAND.light};border-radius:10px;padding:14px;">
        <div style="font-size:11px;font-weight:700;color:${BRAND.green};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Latest Vitals</div>
        ${infoGrid([['Blood Pressure',latestExam.bp||emp.bp],['Pulse',latestExam.pulse||emp.pulse],['Temperature',latestExam.temp||emp.temp],['SpO2',latestExam.spo2||emp.spo2],['BMI',latestExam.bmi||emp.bmi],['Weight',latestExam.weight||emp.weight],['Fitness Status',emp.fitnessStatus]])}
      </div>
    </div>
    ${statsHtml([{label:'OPD Visits',value:opd.length},{label:'Vaccinations',value:vaccinations.length},{label:'Injuries',value:injuries.length},{label:'Exams Done',value:exams.length}])}
    ${opd.length?`<div style="font-size:12px;font-weight:700;color:${BRAND.green};margin-bottom:8px;text-transform:uppercase;">OPD History</div>${mkTable(['Date','Complaint','Diagnosis','Status'],opdRows)}`:''}
    ${vaccinations.length?`<div style="font-size:12px;font-weight:700;color:${BRAND.green};margin-bottom:8px;text-transform:uppercase;">Vaccinations</div>${mkTable(['Vaccine','Dose','Date Given','Next Due'],vacRows)}`:''}
    ${injuries.length?`<div style="font-size:12px;font-weight:700;color:${BRAND.green};margin-bottom:8px;text-transform:uppercase;">Injury Records</div>${mkTable(['Date','Type','Severity','Status'],injRows)}`:''}
    ${footerHtml()}`;

  printHtml(html, false);
}
