import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';
import EmployeeProfile from './EmployeeProfile';
import { exportEmployeeList, ExportPdfButton } from './PdfExport';

const DEPTS = ['General','Engineering','Production','Safety','HR','Admin','Accounts','Security','Logistics','IT'];
const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
const STATUSES = ['Active','Inactive','Pending','On Leave'];
const EMPTY = { empId:'',name:'',department:'',designation:'',doj:'',dob:'',gender:'Male',bloodGroup:'',mobile:'',email:'',address:'',status:'Active' };

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''));
  return lines.slice(1).map(line => {
    const vals=[]; let cur=''; let inQ=false;
    for (let i=0;i<line.length;i++) {
      if(line[i]==='"'){inQ=!inQ;}
      else if(line[i]===',' && !inQ){vals.push(cur.trim());cur='';}
      else{cur+=line[i];}
    }
    vals.push(cur.trim());
    const row={};
    headers.forEach((h,i)=>{row[h]=(vals[i]||'').replace(/^"|"$/g,'').trim();});
    return row;
  }).filter(r=>Object.values(r).some(v=>v));
}

const FIELD_MAP = {
  empid:'empId',emp_id:'empId',employee_id:'empId',id:'empId',
  name:'name',full_name:'name',employee_name:'name',
  department:'department',dept:'department',
  designation:'designation',role:'designation',position:'designation',job_title:'designation',
  doj:'doj',date_of_joining:'doj',joining_date:'doj',
  dob:'dob',date_of_birth:'dob',birth_date:'dob',
  gender:'gender',sex:'gender',
  blood_group:'bloodGroup',bloodgroup:'bloodGroup',blood:'bloodGroup',
  mobile:'mobile',phone:'mobile',contact:'mobile',mobile_number:'mobile',
  email:'email',email_id:'email',address:'address',status:'status',
};

function mapRow(raw) {
  const emp={...EMPTY};
  for(const [k,v] of Object.entries(raw)){const m=FIELD_MAP[k];if(m&&v)emp[m]=v;}
  return emp;
}

// ─── Bulk Import Modal ────────────────────────────────────────────────────────
function BulkImportModal({ tid, onClose }) {
  const fileRef = useRef();
  const [step, setStep] = useState('upload');
  const [rows, setRows] = useState([]);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv'].includes(ext)) { toast.error('Please upload a CSV file. For Excel: File → Save As → CSV.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        if (!parsed.length) { toast.error('No data rows found.'); return; }
        const mapped = parsed.map(mapRow).filter(r=>r.name.trim());
        if (!mapped.length) { toast.error('No valid rows. Ensure file has a "name" column.'); return; }
        setRows(mapped);
        setStep('preview');
      } catch(err) { toast.error('Parse error: '+err.message); }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) { fileRef.current.files = e.dataTransfer.files; handleFile({target:{files:e.dataTransfer.files}}); }
  };

  const handleImport = async () => {
    setStep('importing');
    const res = [];
    for (let i=0;i<rows.length;i++) {
      try {
        await addDoc(collection(db,'merchants',tid,'employees'),{...rows[i],createdAt:serverTimestamp(),importedAt:serverTimestamp()});
        res.push({name:rows[i].name,empId:rows[i].empId,ok:true});
      } catch(e) {
        res.push({name:rows[i].name,empId:rows[i].empId,ok:false,error:e.message});
      }
      setProgress(Math.round(((i+1)/rows.length)*100));
    }
    setResults(res);
    setStep('done');
    toast.success(`Imported ${res.filter(r=>r.ok).length} of ${rows.length} employees.`);
  };

  const downloadTemplate = () => {
    const csv = 'empId,name,department,designation,doj,dob,gender,bloodGroup,mobile,email,status\nEMP001,John Smith,Engineering,Engineer,2024-01-15,1990-05-20,Male,B+,9876543210,john@company.com,Active\nEMP002,Priya Sharma,HR,HR Manager,2023-06-01,1988-11-10,Female,O+,9123456789,priya@company.com,Active';
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download='employee_import_template.csv';a.click();
  };

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="modal-header">
          <h2 className="font-serif text-xl text-text">⬆ Bulk Import Employees</h2>
          <button onClick={onClose} className="text-muted hover:text-text text-xl">×</button>
        </div>

        {step === 'upload' && (
          <div className="modal-body space-y-5">
            <div className="bg-sage/10 border border-sage/20 rounded-xl p-4 text-sm space-y-1">
              <div className="font-semibold text-text mb-1">How to import</div>
              {['Download the template CSV below','Fill in your employee data (one row per employee)','Upload the CSV file','Review the preview, then confirm'].map((s,i)=>(
                <div key={i} className="flex gap-2 text-muted"><span className="text-accent font-bold">{i+1}.</span>{s}</div>
              ))}
            </div>

            <div
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all"
              onClick={()=>fileRef.current?.click()}
              onDragOver={e=>e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="text-4xl mb-3">📂</div>
              <div className="text-base font-semibold text-text">Drop CSV here or click to browse</div>
              <div className="text-xs text-muted mt-1.5">CSV files only · For Excel: save as CSV first</div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile}/>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-muted">
              {[['empId','Employee ID'],['name *','Full Name (required)'],['department','Department'],['designation','Job Title'],['doj','Date of Joining'],['dob','Date of Birth'],['gender','Gender'],['bloodGroup','Blood Group'],['mobile','Phone Number'],['email','Email'],['status','Active / Inactive']].map(([col,desc])=>(
                <div key={col} className="bg-surface2 rounded-lg px-2.5 py-1.5 flex gap-2 items-center">
                  <code className="text-accent font-mono text-[10px]">{col}</code>
                  <span className="text-[10px] text-muted ml-auto">{desc}</span>
                </div>
              ))}
            </div>

            <button onClick={downloadTemplate} className="btn-ghost w-full text-sm gap-2">
              ⬇ Download Template CSV
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="modal-body space-y-4">
            <div className="flex items-center gap-3 bg-accent/10 border border-accent/20 rounded-xl p-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="text-sm font-semibold text-text">{rows.length} employees ready to import</div>
                <div className="text-xs text-muted">Review below and click Import to confirm</div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface2">
                  <tr className="border-b border-border">
                    {['#','Emp ID','Name','Dept','Designation','DOJ','Gender','Status'].map(h=>(
                      <th key={h} className="px-3 py-2 text-left font-bold text-muted text-[10px] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r,i)=>(
                    <tr key={i} className="border-b border-border/40 hover:bg-surface2/50">
                      <td className="px-3 py-2 text-muted">{i+1}</td>
                      <td className="px-3 py-2 font-mono text-accent">{r.empId||'—'}</td>
                      <td className="px-3 py-2 font-medium text-text">{r.name}</td>
                      <td className="px-3 py-2 text-muted">{r.department||'—'}</td>
                      <td className="px-3 py-2 text-muted">{r.designation||'—'}</td>
                      <td className="px-3 py-2 text-muted">{r.doj||'—'}</td>
                      <td className="px-3 py-2 text-muted">{r.gender||'—'}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${r.status==='Active'?'bg-accent/15 text-accent':'bg-surface2 text-muted'}`}>{r.status||'Active'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setStep('upload')} className="btn-ghost flex-1">← Change File</button>
              <button onClick={handleImport} className="btn-primary flex-1">Import {rows.length} Employees →</button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="modal-body py-12 text-center space-y-5">
            <div className="text-5xl animate-bounce">⬆️</div>
            <div className="text-sm font-semibold text-text">Importing {rows.length} employees…</div>
            <div className="w-full bg-surface2 rounded-full h-3 overflow-hidden mx-auto max-w-sm">
              <div className="h-full bg-accent rounded-full transition-all duration-200" style={{width:`${progress}%`}}/>
            </div>
            <div className="text-xs text-muted">{progress}% complete · Please wait</div>
          </div>
        )}

        {step === 'done' && (
          <div className="modal-body space-y-4">
            <div className={`flex items-center gap-3 rounded-xl p-4 border ${results.filter(r=>!r.ok).length?'bg-amber-500/10 border-amber-500/20':'bg-accent/10 border-accent/20'}`}>
              <span className="text-3xl">{results.filter(r=>!r.ok).length?'⚠️':'🎉'}</span>
              <div>
                <div className="text-sm font-semibold text-text">{results.filter(r=>r.ok).length} of {results.length} employees imported successfully</div>
                {results.filter(r=>!r.ok).length>0&&<div className="text-xs text-amber-400 mt-0.5">{results.filter(r=>!r.ok).length} failed — check details below</div>}
              </div>
            </div>
            <div className="rounded-xl border border-border max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface2">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-muted uppercase">Emp ID</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-muted uppercase">Name</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-muted uppercase">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r,i)=>(
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-3 py-2 font-mono text-muted">{r.empId||'—'}</td>
                      <td className="px-3 py-2 text-text">{r.name}</td>
                      <td className="px-3 py-2">{r.ok?<span className="text-accent font-semibold">✅ Added</span>:<span className="text-red-400">❌ {r.error}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { tenant, staffUser } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [profileEmp, setProfileEmp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const tid = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['admin','doctor','nurse'].includes(role);
  const canDelete = role === 'admin';

  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(query(collection(db,'merchants',tid,'employees'),orderBy('createdAt','desc')),
      snap=>{setEmployees(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},
      ()=>setLoading(false));
    return ()=>unsub();
  }, [tid]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (emp) => { setEditing(emp); setForm({...EMPTY,...emp}); setShowModal(true); };
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    if (!form.empId.trim()) { toast.error('Employee ID is required.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db,'merchants',tid,'employees',editing.id),{...form,updatedAt:serverTimestamp()});
        toast.success('Employee updated.');
      } else {
        await addDoc(collection(db,'merchants',tid,'employees'),{...form,createdAt:serverTimestamp()});
        toast.success(`${form.name} added.`);
      }
      setShowModal(false);
    } catch(e){toast.error(e.message);}finally{setSaving(false);}
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db,'merchants',tid,'employees',deleteTarget.id));
      toast.success(`${deleteTarget.name} removed.`);
    } catch(e){toast.error(e.message);}finally{setDeleteTarget(null);}
  };

  const filtered = employees.filter(e=>{
    const q=search.toLowerCase();
    return(!q||e.name?.toLowerCase().includes(q)||e.empId?.toLowerCase().includes(q)||e.department?.toLowerCase().includes(q))
      &&(!filterDept||e.department===filterDept)&&(!filterStatus||e.status===filterStatus);
  });

  const sc={Active:'text-accent bg-accent/10',Inactive:'text-muted bg-surface2',Pending:'text-amber-400 bg-amber-400/10','On Leave':'text-blue-400 bg-blue-400/10'};

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Employees</h1>
          <p className="text-muted text-sm mt-0.5">{filtered.length} of {employees.length} employees · click a name to view health profile</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <ExportPdfButton onClick={()=>exportEmployeeList(employees,tenant?.name)} label="Export PDF"/>
            <button onClick={()=>setShowImport(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted hover:text-accent border border-border hover:border-accent/40 bg-surface hover:bg-accent/5 rounded-lg transition-all">
              ⬆ Bulk Import
            </button>
            <button onClick={openAdd} className="btn-primary">+ Add Employee</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-64" placeholder="Search name, ID, department…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="field-input w-44" value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
          <option value="">All Departments</option>{DEPTS.map(d=><option key={d}>{d}</option>)}
        </select>
        <select className="field-input w-40" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Employee','Department','Designation','Status','DOJ',''].map(h=><div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>)}
        </div>
        {loading
          ? <div className="py-12 text-center text-muted text-sm">Loading…</div>
          : filtered.length===0
            ? <div className="py-12 text-center">
                <div className="text-4xl mb-3">👤</div>
                <div className="text-muted text-sm">{employees.length===0?'No employees yet.':'No results match your search.'}</div>
                {employees.length===0&&canEdit&&(
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button onClick={openAdd} className="btn-primary text-sm">+ Add Employee</button>
                    <button onClick={()=>setShowImport(true)} className="btn-ghost text-sm">⬆ Bulk Import</button>
                  </div>
                )}
              </div>
            : filtered.map(emp=>(
              <div key={emp.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">{initials(emp.name)}</div>
                  <div className="min-w-0">
                    <button onClick={()=>setProfileEmp(emp)} className="text-sm font-medium text-text hover:text-accent truncate block text-left group">
                      {emp.name}<span className="opacity-0 group-hover:opacity-100 ml-1 text-xs text-accent transition-opacity">→</span>
                    </button>
                    <div className="text-xs text-muted">{emp.empId}</div>
                  </div>
                </div>
                <div className="text-sm text-muted truncate">{emp.department||'—'}</div>
                <div className="text-sm text-muted truncate">{emp.designation||'—'}</div>
                <div><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc[emp.status]||'text-muted'}`}>{emp.status||'Active'}</span></div>
                <div className="text-xs text-muted">{emp.doj?fmtDate(emp.doj):'—'}</div>
                <div className="flex gap-1">
                  {canEdit&&<button onClick={()=>openEdit(emp)} className="text-muted hover:text-accent text-sm p-1">✏️</button>}
                  {canDelete&&<button onClick={()=>setDeleteTarget(emp)} className="text-muted hover:text-red-400 text-sm p-1">🗑️</button>}
                </div>
              </div>
            ))
        }
      </div>

      {profileEmp&&<EmployeeProfile emp={profileEmp} tid={tid} onClose={()=>setProfileEmp(null)} onEdit={canEdit?()=>{setProfileEmp(null);openEdit(profileEmp);}:null}/>}
      {showImport&&<BulkImportModal tid={tid} onClose={()=>setShowImport(false)}/>}

      {showModal&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing?'Edit Employee':'Add Employee'}</h2>
              <button onClick={()=>setShowModal(false)} className="text-muted hover:text-text text-xl">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Employee ID *</label><input className="field-input" value={form.empId} onChange={e=>set('empId',e.target.value)} placeholder="EMP001"/></div>
                <div><label className="field-label">Full Name *</label><input className="field-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Full name"/></div>
                <div><label className="field-label">Department</label><select className="field-input" value={form.department} onChange={e=>set('department',e.target.value)}><option value="">Select…</option>{DEPTS.map(d=><option key={d}>{d}</option>)}</select></div>
                <div><label className="field-label">Designation</label><input className="field-input" value={form.designation} onChange={e=>set('designation',e.target.value)} placeholder="Job title"/></div>
                <div><label className="field-label">Date of Joining</label><input type="date" className="field-input" value={form.doj} onChange={e=>set('doj',e.target.value)}/></div>
                <div><label className="field-label">Date of Birth</label><input type="date" className="field-input" value={form.dob} onChange={e=>set('dob',e.target.value)}/></div>
                <div><label className="field-label">Gender</label><select className="field-input" value={form.gender} onChange={e=>set('gender',e.target.value)}>{['Male','Female','Other'].map(g=><option key={g}>{g}</option>)}</select></div>
                <div><label className="field-label">Blood Group</label><select className="field-input" value={form.bloodGroup} onChange={e=>set('bloodGroup',e.target.value)}><option value="">Select…</option>{BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}</select></div>
                <div><label className="field-label">Mobile</label><input className="field-input" value={form.mobile} onChange={e=>set('mobile',e.target.value)} placeholder="10-digit"/></div>
                <div><label className="field-label">Email</label><input type="email" className="field-input" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="employee@company.com"/></div>
                <div className="col-span-2"><label className="field-label">Address</label><textarea className="field-input h-16 resize-none" value={form.address} onChange={e=>set('address',e.target.value)}/></div>
                <div><label className="field-label">Status</label><select className="field-input" value={form.status} onChange={e=>set('status',e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Add Employee'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget&&(
        <div className="modal-backdrop" style={{zIndex:9999}}>
          <div className="modal-box w-full max-w-sm">
            <div className="modal-header"><h2 className="font-serif text-lg text-text">Delete Employee</h2></div>
            <div className="modal-body"><p className="text-sm text-muted">Remove <span className="text-text font-medium">{deleteTarget.name}</span>? This cannot be undone.</p></div>
            <div className="modal-footer">
              <button onClick={()=>setDeleteTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={handleDelete} className="btn-primary" style={{background:'#dc2626',borderColor:'#dc2626'}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
