import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const APPT_TYPES = [
  'OPD Consultation','Pre-Employment Medical','Periodic Health Exam',
  'Fitness Certificate','Follow-up Visit','Vaccination','Eye Test',
  'Audiometry','Spirometry','ECG','Blood Test','X-Ray','Physiotherapy','Other',
];

const STATUS_CFG = {
  scheduled:  { label:'Scheduled',  bg:'bg-blue-100',    txt:'text-blue-700',    dot:'bg-blue-400'    },
  confirmed:  { label:'Confirmed',  bg:'bg-emerald-100', txt:'text-emerald-700', dot:'bg-emerald-400' },
  completed:  { label:'Completed',  bg:'bg-slate-100',   txt:'text-slate-600',   dot:'bg-slate-400'   },
  cancelled:  { label:'Cancelled',  bg:'bg-red-100',     txt:'text-red-700',     dot:'bg-red-400'     },
  noshow:     { label:'No Show',    bg:'bg-orange-100',  txt:'text-orange-700',  dot:'bg-orange-400'  },
};

const SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30',
];

const EMPTY_FORM = {
  employeeName:'', employeeId:'', department:'', phone:'',
  date: new Date().toISOString().split('T')[0],
  time:'09:00', type:'OPD Consultation', doctor:'', notes:'', status:'scheduled',
};

/* ── Mini calendar ── */
function MiniCalendar({ appointments, selDate, onSelect }) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const apptDates = new Set(appointments.map(a => a.date));
  const today = new Date().toISOString().split('T')[0];

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDate(new Date(year, month-1))} className="w-7 h-7 rounded hover:bg-surface2 flex items-center justify-center text-muted">‹</button>
        <span className="text-sm font-semibold text-text">{MONTHS[month]} {year}</span>
        <button onClick={() => setViewDate(new Date(year, month+1))} className="w-7 h-7 rounded hover:bg-surface2 flex items-center justify-center text-muted">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {['S','M','T','W','T','F','S'].map((d,i) => (
          <div key={i} className="text-[10px] text-muted font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i}/>;
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const isToday = dateStr === today;
          const isSel = dateStr === selDate;
          const hasAppt = apptDates.has(dateStr);
          return (
            <button key={i} onClick={() => onSelect(dateStr)}
              className={`relative w-full aspect-square rounded-lg text-xs flex items-center justify-center transition-all ${
                isSel ? 'bg-sage text-white font-bold' :
                isToday ? 'bg-sage/20 text-sage font-bold' :
                'hover:bg-surface2 text-text'
              }`}>
              {d}
              {hasAppt && !isSel && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sage"/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Appointments() {
  const { tenant, user } = useAuthStore();
  const tenantId = tenant?.id;

  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [empSearch, setEmpSearch]       = useState('');
  const [empSugg, setEmpSugg]           = useState([]);
  const [saving, setSaving]             = useState(false);
  const [selDate, setSelDate]           = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [view, setView]                 = useState('calendar'); // calendar | list

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [empSnap, apptSnap] = await Promise.all([
          getDocs(collection(db, `merchants/${tenantId}/employees`)),
          getDocs(query(collection(db, `merchants/${tenantId}/appointments`), orderBy('date','asc'))),
        ]);
        setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAppointments(apptSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { toast.error('Failed to load'); }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  useEffect(() => {
    if (!empSearch.trim()) { setEmpSugg([]); return; }
    const q = empSearch.toLowerCase();
    setEmpSugg(employees.filter(e =>
      e.name?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q)
    ).slice(0,6));
  }, [empSearch, employees]);

  const pickEmp = (emp) => {
    setForm(f => ({ ...f, employeeName: emp.name||'', employeeId: emp.employeeId||emp.id, department: emp.department||'', phone: emp.phone||'' }));
    setEmpSearch(emp.name||''); setEmpSugg([]);
  };

  const handleSave = async () => {
    if (!form.employeeName || !form.date || !form.time || !form.type) {
      toast.error('Employee, date, time and type required'); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, tenantId, createdAt: serverTimestamp(), bookedBy: user?.name || 'staff' };
      const ref = await addDoc(collection(db, `merchants/${tenantId}/appointments`), payload);
      setAppointments(prev => [...prev, { id: ref.id, ...payload, createdAt: new Date() }].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)));
      toast.success('Appointment booked');
      setShowForm(false); setForm(EMPTY_FORM); setEmpSearch('');
    } catch(e) { toast.error('Failed to book'); }
    setSaving(false);
  };

  const updateStatus = async (appt, newStatus) => {
    try {
      await updateDoc(doc(db, `merchants/${tenantId}/appointments`, appt.id), { status: newStatus, updatedAt: serverTimestamp() });
      setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: newStatus } : a));
      toast.success('Status updated');
    } catch(e) { toast.error('Update failed'); }
  };

  // Booked slots for selected date
  const bookedSlots = new Set(appointments.filter(a => a.date === selDate && a.status !== 'cancelled').map(a => a.time));

  // Today's appointments
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.date === today).sort((a,b) => a.time.localeCompare(b.time));

  // Filtered list
  const listAppts = appointments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  }).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  // Stats
  const stats = {
    today:    todayAppts.length,
    upcoming: appointments.filter(a => a.date > today && a.status === 'scheduled').length,
    completed:appointments.filter(a => a.status === 'completed').length,
    noshow:   appointments.filter(a => a.status === 'noshow').length,
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
          <h1 className="text-2xl font-display font-bold text-text">Appointment Booking</h1>
          <p className="text-sm text-muted mt-0.5">{appointments.length} total appointments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView(v => v === 'calendar' ? 'list' : 'calendar')}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-white text-text hover:bg-surface2">
            {view === 'calendar' ? '📋 List View' : '📅 Calendar View'}
          </button>
          <button onClick={() => { setShowForm(true); setForm({ ...EMPTY_FORM, date: selDate }); setEmpSearch(''); }}
            className="btn-primary flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
            Book Appointment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"Today's",    val: stats.today,     color:'text-sage',       bg:'bg-sage/5'    },
          { label:'Upcoming',   val: stats.upcoming,  color:'text-blue-600',   bg:'bg-blue-50'   },
          { label:'Completed',  val: stats.completed, color:'text-slate-600',  bg:'bg-slate-50'  },
          { label:'No Shows',   val: stats.noshow,    color:'text-orange-600', bg:'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-border`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Calendar */}
          <div className="space-y-4">
            <MiniCalendar appointments={appointments} selDate={selDate} onSelect={setSelDate}/>

            {/* Today's queue */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-text mb-3">
                Today's Queue <span className="text-xs font-normal text-muted ml-1">({todayAppts.length})</span>
              </h3>
              {todayAppts.length === 0 ? (
                <div className="text-center text-muted text-xs py-4">No appointments today</div>
              ) : todayAppts.map(a => {
                const sc = STATUS_CFG[a.status] || STATUS_CFG.scheduled;
                return (
                  <div key={a.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                    <div className="text-xs font-mono font-bold text-sage w-12">{a.time}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-text truncate">{a.employeeName}</div>
                      <div className="text-[10px] text-muted">{a.type}</div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sc.bg} ${sc.txt}`}>{sc.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected date slots */}
          <div className="md:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text">
                {selDate === today ? "Today" : selDate} — Available Slots
              </h3>
              <span className="text-xs text-muted">{bookedSlots.size} booked · {SLOTS.length - bookedSlots.size} free</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SLOTS.map(slot => {
                const appt = appointments.find(a => a.date === selDate && a.time === slot && a.status !== 'cancelled');
                const isBooked = !!appt;
                return (
                  <button key={slot} onClick={() => {
                    if (!isBooked) { setShowForm(true); setForm({ ...EMPTY_FORM, date: selDate, time: slot }); setEmpSearch(''); }
                  }}
                    className={`relative rounded-xl p-2.5 text-left transition-all border ${
                      isBooked
                        ? 'bg-sage/10 border-sage/30 cursor-default'
                        : 'bg-white border-border hover:border-sage hover:bg-sage/5 cursor-pointer'
                    }`}>
                    <div className={`text-xs font-bold ${isBooked ? 'text-sage' : 'text-text'}`}>{slot}</div>
                    {appt ? (
                      <div className="mt-0.5">
                        <div className="text-[10px] text-sage font-medium truncate">{appt.employeeName}</div>
                        <div className="text-[10px] text-muted truncate">{appt.type}</div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted mt-0.5">Free</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input text-sm w-36">
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface2 border-b border-border text-xs text-muted uppercase">
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Date & Time</th>
                  <th className="text-left px-4 py-3">Doctor</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listAppts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted py-10">
                    <div className="text-2xl mb-1">📅</div>No appointments
                  </td></tr>
                ) : listAppts.map(a => {
                  const sc = STATUS_CFG[a.status] || STATUS_CFG.scheduled;
                  return (
                    <tr key={a.id} className="border-b border-border hover:bg-surface2">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text">{a.employeeName}</div>
                        <div className="text-xs text-muted">{a.department}</div>
                      </td>
                      <td className="px-4 py-3 text-text text-xs">{a.type}</td>
                      <td className="px-4 py-3">
                        <div className="text-text">{a.date}</div>
                        <div className="text-xs text-sage font-mono font-bold">{a.time}</div>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{a.doctor || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.txt}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select value={a.status} onChange={e => updateStatus(a, e.target.value)}
                          className="input text-xs py-1 w-28">
                          {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Book Appointment Drawer ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)}/>
          <div className="relative ml-auto w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-sage text-white">
              <div>
                <h2 className="text-lg font-display font-bold">Book Appointment</h2>
                <p className="text-xs text-white/70">{form.date} at {form.time}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Employee */}
              <div>
                <label className="label">Employee *</label>
                <div className="relative">
                  <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="Search by name or ID…" className="input w-full"/>
                  {empSugg.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-border rounded-lg shadow-lg z-10 mt-1">
                      {empSugg.map(e => (
                        <button key={e.id} onClick={() => pickEmp(e)} className="w-full text-left px-3 py-2.5 hover:bg-surface2 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-sage/20 text-sage flex items-center justify-center text-xs font-bold">{(e.name||'?')[0].toUpperCase()}</div>
                          <div><div className="text-sm font-medium">{e.name}</div><div className="text-xs text-muted">{e.department}</div></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.phone && <div className="text-xs text-muted mt-1">📞 {form.phone}</div>}
              </div>
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} className="input w-full"/>
                </div>
                <div>
                  <label className="label">Time Slot *</label>
                  <select value={form.time} onChange={e => setForm(f=>({...f,time:e.target.value}))} className="input w-full">
                    {SLOTS.map(s => {
                      const taken = appointments.find(a => a.date === form.date && a.time === s && a.status !== 'cancelled');
                      return <option key={s} value={s}>{s}{taken ? ' — Booked' : ''}</option>;
                    })}
                  </select>
                </div>
              </div>
              {/* Type & Doctor */}
              <div>
                <label className="label">Appointment Type *</label>
                <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} className="input w-full">
                  {APPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Doctor / Staff</label>
                <input value={form.doctor} onChange={e => setForm(f=>({...f,doctor:e.target.value}))} placeholder="Dr. Name (optional)" className="input w-full"/>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Any special instructions…" className="input w-full resize-none"/>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-surface2">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Booking…' : '📅 Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
