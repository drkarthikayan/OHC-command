import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';

const CERT_TYPES = ['Fitness Certificate','Medical Examination','Return to Work','First Aid','Vaccination Record','Pre-Employment Medical','Annual Health Check'];
const FITNESS = ['Fit for Duty','Fit with Restrictions','Temporarily Unfit','Permanently Unfit'];
const EMPTY = {
  certType: 'Fitness Certificate', employeeId: '', employeeName: '', department: '',
  issueDate: new Date().toISOString().slice(0,10), validTill: '',
  fitnessStatus: 'Fit for Duty', remarks: '', restrictions: '', doctorName: '', doctorReg: '',
  certNo: '',
};

export default function CertificatesPage() {
  const { tenant, staffUser } = useAuthStore();
  const [certs, setCerts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [empSearch, setEmpSearch] = useState('');

  const tid = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['admin','doctor'].includes(role);

  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db, 'merchants', tid, 'certificates'), orderBy('createdAt', 'desc')),
      snap => { setCerts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
    getDocs(collection(db, 'merchants', tid, 'employees')).then(s =>
      setEmployees(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [tid]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const genCertNo = () => `CERT-${Date.now().toString().slice(-6)}`;

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY, certNo: genCertNo(), doctorName: staffUser?.name || '' });
    setError(''); setEmpSearch(''); setShowModal(true);
  };
  const openEdit = (c) => { setEditing(c); setForm({ ...EMPTY, ...c }); setError(''); setEmpSearch(''); setShowModal(true); };

  const selectEmployee = (emp) => {
    set('employeeId', emp.empId || emp.id);
    set('employeeName', emp.name);
    set('department', emp.department || '');
    setEmpSearch('');
  };

  const handleSave = async () => {
    if (!form.employeeName.trim()) { setError('Please select an employee.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await updateDoc(doc(db, 'merchants', tid, 'certificates', editing.id), { ...form, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'merchants', tid, 'certificates'), { ...form, createdAt: serverTimestamp() });
      }
      toast.success(editing ? 'Certificate updated.' : 'Certificate issued.'); setShowModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    const ok = await new Promise(r => { r(window.confirm(`Delete certificate ${c.certNo}?`)); }); if (!ok) return;
    await deleteDoc(doc(db, 'merchants', tid, 'certificates', c.id)); toast.success('Certificate deleted.');
  };

  const handlePrint = (cert) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(printHTML(cert, tenant));
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const filtered = certs.filter(c => {
    const q = search.toLowerCase();
    const matchQ = !q || c.employeeName?.toLowerCase().includes(q) || c.certNo?.toLowerCase().includes(q) || c.certType?.toLowerCase().includes(q);
    const matchT = !filterType || c.certType === filterType;
    return matchQ && matchT;
  });

  const fitnessColor = {
    'Fit for Duty': 'text-accent bg-accent/10',
    'Fit with Restrictions': 'text-amber-400 bg-amber-400/10',
    'Temporarily Unfit': 'text-orange-400 bg-orange-400/10',
    'Permanently Unfit': 'text-red-400 bg-red-400/10',
  };

  const empResults = empSearch ? employees.filter(e => e.name?.toLowerCase().includes(empSearch.toLowerCase()) || e.empId?.toLowerCase().includes(empSearch.toLowerCase())).slice(0,5) : [];

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Certificates</h1>
          <p className="text-muted text-sm mt-0.5">{filtered.length} certificates issued</p>
        </div>
        {canEdit && <button onClick={openAdd} className="btn-primary">+ Issue Certificate</button>}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input className="field-input w-64" placeholder="Search employee, cert no, type…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="field-input w-56" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {CERT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Employee','Type','Cert No','Issue Date','Fitness',''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading ? (
          <div className="py-12 text-center text-muted text-sm">Loading certificates…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">📜</div>
            <div className="text-muted text-sm">{certs.length === 0 ? 'No certificates issued yet.' : 'No results match your filters.'}</div>
          </div>
        ) : filtered.map(c => (
          <div key={c.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">{initials(c.employeeName)}</div>
              <div className="min-w-0">
                <button onClick={() => setViewing(c)} className="text-sm font-medium text-text hover:text-accent block truncate text-left">{c.employeeName}</button>
                <div className="text-xs text-muted">{c.department}</div>
              </div>
            </div>
            <div className="text-sm text-muted truncate">{c.certType}</div>
            <div className="text-xs text-muted font-mono">{c.certNo}</div>
            <div className="text-xs text-muted">{fmtDate(c.issueDate)}</div>
            <div><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fitnessColor[c.fitnessStatus] || 'text-muted'}`}>{c.fitnessStatus}</span></div>
            <div className="flex gap-1">
              <button onClick={() => handlePrint(c)} className="text-muted hover:text-accent text-sm p-1" title="Print">🖨️</button>
              {canEdit && <button onClick={() => openEdit(c)} className="text-muted hover:text-accent text-sm p-1" title="Edit">✏️</button>}
              {role === 'admin' && <button onClick={() => handleDelete(c)} className="text-muted hover:text-red-400 text-sm p-1" title="Delete">🗑️</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing ? 'Edit Certificate' : 'Issue Certificate'}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-text text-xl">×</button>
            </div>
            <div className="modal-body space-y-3">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2">{error}</div>}

              <div className="relative">
                <label className="field-label">Employee *</label>
                {form.employeeName ? (
                  <div className="flex items-center gap-2 p-2 bg-surface2 border border-border rounded-lg">
                    <div className="w-7 h-7 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent">{initials(form.employeeName)}</div>
                    <div className="flex-1 text-sm text-text">{form.employeeName}</div>
                    <button onClick={() => { set('employeeName',''); set('employeeId',''); }} className="text-muted hover:text-text text-xs">×</button>
                  </div>
                ) : (
                  <>
                    <input className="field-input" placeholder="Search employee…" value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
                    {empResults.length > 0 && (
                      <div className="absolute z-20 w-full bg-surface border border-border rounded-lg mt-1 shadow-lg overflow-hidden">
                        {empResults.map(e => (
                          <button key={e.id} onClick={() => selectEmployee(e)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface2 text-left">
                            <div className="text-sm text-text">{e.name}</div>
                            <div className="text-xs text-muted ml-auto">{e.empId}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Certificate Type</label>
                  <select className="field-input" value={form.certType} onChange={e => set('certType', e.target.value)}>
                    {CERT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Certificate No.</label>
                  <input className="field-input" value={form.certNo} onChange={e => set('certNo', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Issue Date</label>
                  <input type="date" className="field-input" value={form.issueDate} onChange={e => set('issueDate', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Valid Till</label>
                  <input type="date" className="field-input" value={form.validTill} onChange={e => set('validTill', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="field-label">Fitness Status</label>
                  <select className="field-input" value={form.fitnessStatus} onChange={e => set('fitnessStatus', e.target.value)}>
                    {FITNESS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="field-label">Remarks / Findings</label>
                  <textarea className="field-input h-16 resize-none" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Clinical findings, notes…" />
                </div>
                <div className="col-span-2">
                  <label className="field-label">Restrictions (if any)</label>
                  <input className="field-input" value={form.restrictions} onChange={e => set('restrictions', e.target.value)} placeholder="Avoid heavy lifting, heights…" />
                </div>
                <div>
                  <label className="field-label">Doctor Name</label>
                  <input className="field-input" value={form.doctorName} onChange={e => set('doctorName', e.target.value)} placeholder={staffUser?.name} />
                </div>
                <div>
                  <label className="field-label">Doctor Reg. No.</label>
                  <input className="field-input" value={form.doctorReg} onChange={e => set('doctorReg', e.target.value)} placeholder="MCI12345" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Issue Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewing && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal-box w-full max-w-md">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">Certificate</h2>
              <button onClick={() => setViewing(null)} className="text-muted hover:text-text text-xl">×</button>
            </div>
            <div className="modal-body space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="w-10 h-10 rounded-full bg-green/20 flex items-center justify-center text-sm font-bold text-accent">{initials(viewing.employeeName)}</div>
                <div>
                  <div className="font-medium text-text">{viewing.employeeName}</div>
                  <div className="text-xs text-muted">{viewing.department} · {viewing.certNo}</div>
                </div>
              </div>
              {[
                ['Type', viewing.certType],
                ['Issue Date', fmtDate(viewing.issueDate)],
                ['Valid Till', viewing.validTill ? fmtDate(viewing.validTill) : 'N/A'],
                ['Fitness', viewing.fitnessStatus],
                ['Restrictions', viewing.restrictions || 'None'],
                ['Remarks', viewing.remarks || '—'],
                ['Doctor', viewing.doctorName],
                ['Reg. No.', viewing.doctorReg || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-muted">{l}</span>
                  <span className="text-text font-medium text-right max-w-xs">{v}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button onClick={() => handlePrint(viewing)} className="btn-ghost">🖨️ Print</button>
              {canEdit && <button onClick={() => { setViewing(null); openEdit(viewing); }} className="btn-ghost">Edit</button>}
              <button onClick={() => setViewing(null)} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PRINT HTML ────────────────────────────────────────────
function printHTML(cert, tenant) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Certificate - ${cert.certNo}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#fff;color:#1a1a1a;font-size:13px}
@media print{@page{size:A4;margin:15mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.page{max-width:720px;margin:0 auto;padding:32px}
.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #2d6a4f;margin-bottom:20px}
.logo{display:flex;align-items:center;gap:10px}
.logo-icon{width:40px;height:40px;background:linear-gradient(135deg,#2d6a4f,#40916c);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px}
.org{font-family:'DM Serif Display',serif;font-size:20px;color:#0d1a14}
.sub{font-size:11px;color:#555;margin-top:2px}
.cert-title{text-align:center;margin:20px 0 24px}
.cert-title h1{font-family:'DM Serif Display',serif;font-size:26px;color:#2d6a4f}
.cert-title p{font-size:11px;color:#888;margin-top:4px}
.badge{display:inline-block;padding:5px 16px;border-radius:20px;font-size:12px;font-weight:600;margin:16px 0}
.fit{background:#d1fae5;color:#065f46}
.partial{background:#fef3c7;color:#92400e}
.unfit{background:#fee2e2;color:#991b1b}
.section{margin:16px 0}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.field{background:#f9fafb;border-radius:8px;padding:10px 12px}
.field-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
.field-value{font-size:13px;color:#111;font-weight:500}
.remarks{background:#f9fafb;border-radius:8px;padding:12px;margin:12px 0}
.footer{margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e5e7eb;padding-top:16px}
.sig-line{width:160px;border-top:1px solid #333;padding-top:6px;font-size:11px;text-align:center}
.cert-no{font-size:10px;color:#aaa}
</style></head><body>
<div class="page">
<div class="header">
  <div class="logo">
    <div class="logo-icon">⚕</div>
    <div>
      <div class="org">${tenant?.name || 'OHC Portal'}</div>
      <div class="sub">Occupational Health Centre</div>
    </div>
  </div>
  <div style="text-align:right">
    <div class="cert-no">Cert No: <strong>${cert.certNo}</strong></div>
    <div class="cert-no" style="margin-top:4px">Date: ${fmtDate(cert.issueDate)}</div>
  </div>
</div>
<div class="cert-title">
  <h1>${cert.certType}</h1>
  <p>This certificate is issued by the Occupational Health Centre</p>
</div>
<div class="section">
  <div class="section-title">Employee Information</div>
  <div class="grid">
    <div class="field"><div class="field-label">Name</div><div class="field-value">${cert.employeeName}</div></div>
    <div class="field"><div class="field-label">Employee ID</div><div class="field-value">${cert.employeeId || '—'}</div></div>
    <div class="field"><div class="field-label">Department</div><div class="field-value">${cert.department || '—'}</div></div>
    <div class="field"><div class="field-label">Issue Date</div><div class="field-value">${fmtDate(cert.issueDate)}</div></div>
    ${cert.validTill ? `<div class="field"><div class="field-label">Valid Till</div><div class="field-value">${fmtDate(cert.validTill)}</div></div>` : ''}
  </div>
</div>
<div style="text-align:center">
  <div class="badge ${cert.fitnessStatus === 'Fit for Duty' ? 'fit' : cert.fitnessStatus.includes('Restrictions') ? 'partial' : 'unfit'}">
    ${cert.fitnessStatus}
  </div>
</div>
${cert.restrictions ? `<div class="remarks"><div class="field-label" style="margin-bottom:6px">Restrictions</div><div style="color:#333">${cert.restrictions}</div></div>` : ''}
${cert.remarks ? `<div class="remarks"><div class="field-label" style="margin-bottom:6px">Remarks / Clinical Notes</div><div style="color:#333">${cert.remarks}</div></div>` : ''}
<div class="footer">
  <div>
    <div class="sig-line">${cert.doctorName || 'Doctor'}</div>
    <div style="font-size:10px;color:#aaa;margin-top:4px">${cert.doctorReg ? `Reg: ${cert.doctorReg}` : 'Medical Officer'}</div>
  </div>
  <div style="text-align:right;font-size:10px;color:#aaa">
    <div>Issued by: OHC Command</div>
    <div>Printed: ${new Date().toLocaleDateString('en-IN')}</div>
  </div>
</div>
</div>
</body></html>`;
}
