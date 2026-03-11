import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';

const DEPTS = ['General','Engineering','Production','Safety','HR','Admin','Accounts','Security','Logistics','IT'];
const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
const STATUSES = ['Active','Inactive','Pending','On Leave'];
const EMPTY = { empId:'',name:'',department:'',designation:'',doj:'',dob:'',gender:'Male',bloodGroup:'',mobile:'',email:'',address:'',status:'Active' };

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
  const [viewEmp, setViewEmp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const tid = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['admin','doctor','nurse'].includes(role);
  const canDelete = role === 'admin';

  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(query(collection(db,'merchants',tid,'employees'),orderBy('createdAt','desc')),
      snap => { setEmployees(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      () => setLoading(false));
    return () => unsub();
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
        toast.success(`${form.name} added successfully.`);
      }
      setShowModal(false);
    } catch(e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db,'merchants',tid,'employees',deleteTarget.id));
      toast.success(`${deleteTarget.name} removed.`);
    } catch(e) { toast.error(e.message); } finally { setDeleteTarget(null); }
  };

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return (!q||e.name?.toLowerCase().includes(q)||e.empId?.toLowerCase().includes(q)||e.department?.toLowerCase().includes(q))
      && (!filterDept||e.department===filterDept) && (!filterStatus||e.status===filterStatus);
  });

  const sc = {Active:'text-accent bg-accent/10',Inactive:'text-muted bg-surface2',Pending:'text-amber-400 bg-amber-400/10','On Leave':'text-blue-400 bg-blue-400/10'};

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-3xl text-text">Employees</h1><p className="text-muted text-sm mt-0.5">{filtered.length} of {employees.length} employees</p></div>
        {canEdit && <button onClick={openAdd} className="btn-primary">+ Add Employee</button>}
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-64" placeholder="Search name, ID, department…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="field-input w-44" value={filterDept} onChange={e=>setFilterDept(e.target.value)}><option value="">All Departments</option>{DEPTS.map(d=><option key={d}>{d}</option>)}</select>
        <select className="field-input w-40" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
      </div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Employee','Department','Designation','Status','DOJ',''].map(h=><div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>)}
        </div>
        {loading ? <div className="py-12 text-center text-muted text-sm">Loading…</div>
        : filtered.length===0 ? <div className="py-12 text-center"><div className="text-4xl mb-3">👤</div><div className="text-muted text-sm">{employees.length===0?'No employees yet.':'No results.'}</div></div>
        : filtered.map(emp=>(
          <div key={emp.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">{initials(emp.name)}</div>
              <div className="min-w-0"><button onClick={()=>setViewEmp(emp)} className="text-sm font-medium text-text hover:text-accent truncate block text-left">{emp.name}</button><div className="text-xs text-muted">{emp.empId}</div></div>
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
        ))}
      </div>

      {showModal&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="modal-header"><h2 className="font-serif text-xl text-text">{editing?'Edit Employee':'Add Employee'}</h2><button onClick={()=>setShowModal(false)} className="text-muted hover:text-text text-xl">×</button></div>
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
            <div className="modal-footer"><button onClick={()=>setShowModal(false)} className="btn-ghost">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Add Employee'}</button></div>
          </div>
        </div>
      )}

      {viewEmp&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setViewEmp(null)}>
          <div className="modal-box w-full max-w-lg">
            <div className="modal-header"><h2 className="font-serif text-xl text-text">Employee Details</h2><button onClick={()=>setViewEmp(null)} className="text-muted hover:text-text text-xl">×</button></div>
            <div className="modal-body">
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green/20 to-green2/20 flex items-center justify-center text-xl font-bold text-accent">{initials(viewEmp.name)}</div>
                <div><div className="font-serif text-lg text-text">{viewEmp.name}</div><div className="text-sm text-muted">{viewEmp.empId} · {viewEmp.designation||'Staff'}</div><span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${sc[viewEmp.status]||'text-muted'}`}>{viewEmp.status}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[['Department',viewEmp.department],['Blood Group',viewEmp.bloodGroup],['Date of Joining',fmtDate(viewEmp.doj)],['Date of Birth',fmtDate(viewEmp.dob)],['Gender',viewEmp.gender],['Mobile',viewEmp.mobile],['Email',viewEmp.email],['Address',viewEmp.address]].map(([l,v])=>v?(<div key={l} className={l==='Address'||l==='Email'?'col-span-2':''}><div className="text-muted text-xs mb-0.5">{l}</div><div className="text-text">{v}</div></div>):null)}
              </div>
            </div>
            <div className="modal-footer">{canEdit&&<button onClick={()=>{setViewEmp(null);openEdit(viewEmp);}} className="btn-ghost">Edit</button>}<button onClick={()=>setViewEmp(null)} className="btn-primary">Close</button></div>
          </div>
        </div>
      )}

      {deleteTarget&&(
        <div className="modal-backdrop" style={{zIndex:9999}}>
          <div className="modal-box w-full max-w-sm">
            <div className="modal-header"><h2 className="font-serif text-lg text-text">Delete Employee</h2></div>
            <div className="modal-body"><p className="text-sm text-muted">Remove <span className="text-text font-medium">{deleteTarget.name}</span>? This cannot be undone.</p></div>
            <div className="modal-footer"><button onClick={()=>setDeleteTarget(null)} className="btn-ghost">Cancel</button><button onClick={handleDelete} className="btn-primary" style={{background:'#dc2626',borderColor:'#dc2626'}}>Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
