import { useState } from 'react';
import { db } from '../../config/firebase';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

const PLANS = [
  { id: 'basic',      label: 'Basic',      price: 2999,  color: 'border-slate-300',   badge: 'bg-slate-100 text-slate-700',   features: ['Up to 200 employees','OPD & Pharmacy','Basic reports','Email support'] },
  { id: 'standard',  label: 'Standard',   price: 4999,  color: 'border-blue-300',    badge: 'bg-blue-100 text-blue-700',     features: ['Up to 500 employees','All clinical modules','MIS reports','Priority support'] },
  { id: 'premium',   label: 'Premium',    price: 7999,  color: 'border-emerald-400', badge: 'bg-emerald-100 text-emerald-700',features: ['Up to 1500 employees','IHI Trend Charts','WhatsApp alerts','Dedicated support'] },
  { id: 'enterprise',label: 'Enterprise', price: 14999, color: 'border-purple-400',  badge: 'bg-purple-100 text-purple-700', features: ['Unlimited employees','White-label option','API access','SLA guarantee'] },
];

const INDUSTRIES = ['Manufacturing','Pharmaceutical','Chemical','Textile','Automobile','IT/ITES','Healthcare','Construction','Mining','Food Processing','Logistics','Other'];
const STATES = ['Tamil Nadu','Karnataka','Maharashtra','Gujarat','Andhra Pradesh','Telangana','Kerala','Rajasthan','Uttar Pradesh','Delhi','Other'];

const STEPS = [
  { id: 1, label: 'Company',  icon: '🏢', desc: 'Basic company details'   },
  { id: 2, label: 'OHC Setup',icon: '🏥', desc: 'OHC centre configuration' },
  { id: 3, label: 'Plan',     icon: '💎', desc: 'Subscription plan'        },
  { id: 4, label: 'Admin',    icon: '👤', desc: 'First admin user'         },
  { id: 5, label: 'Review',   icon: '✅', desc: 'Confirm & launch'         },
];

const EMPTY = {
  // Step 1
  name: '', industry: '', employeeCount: '', address: '', city: '', state: 'Tamil Nadu', pincode: '', gstNumber: '', contactPerson: '', email: '', phone: '',
  // Step 2
  ohcName: '', doctorName: '', nurseName: '', workingHours: '08:00-17:00', shifts: ['General'], hasPharmacy: true, hasLab: false, modules: ['opd','pharmacy','employees','certificates'],
  // Step 3
  plan: 'standard', billingCycle: 'monthly',
  // Step 4
  adminName: '', adminEmail: '', adminPhone: '', adminStaffId: '', adminPassword: '',
};

const MODULES = [
  { id:'opd',           label:'OPD / Visits',         icon:'🏥', required: true  },
  { id:'pharmacy',      label:'Pharmacy',              icon:'💊', required: false },
  { id:'employees',     label:'Employee Management',   icon:'👥', required: true  },
  { id:'certificates',  label:'Fitness Certificates',  icon:'📋', required: false },
  { id:'pre-employment',label:'Pre-Employment Exam',   icon:'🔬', required: false },
  { id:'periodic',      label:'Periodic Health Exam',  icon:'🩺', required: false },
  { id:'injury',        label:'Injury Register',       icon:'⚠️', required: false },
  { id:'referrals',     label:'Referral Management',   icon:'🔗', required: false },
  { id:'emergency-sop', label:'Emergency SOP',         icon:'🚨', required: false },
  { id:'compliance',    label:'Compliance Calendar',   icon:'🛡️', required: false },
  { id:'appointments',  label:'Appointments',          icon:'📅', required: false },
  { id:'mis-report',    label:'MIS Reports',           icon:'📊', required: false },
];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2,10);
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((s, i) => {
        const done   = s.id < current;
        const active = s.id === current;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                done   ? 'bg-sage text-white shadow-md' :
                active ? 'bg-white border-2 border-sage shadow-lg scale-110' :
                         'bg-surface2 border-2 border-border text-muted'
              }`}>
                {done ? '✓' : s.icon}
              </div>
              <div className={`text-xs mt-1 font-medium ${active ? 'text-sage' : done ? 'text-text' : 'text-muted'}`}>{s.label}</div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${done ? 'bg-sage' : 'bg-border'}`}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingWizard({ onClose, onComplete }) {
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [done, setDone]   = useState(false);
  const [newTenantId, setNewTenantId] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleModule = (id) => {
    const mod = MODULES.find(m => m.id === id);
    if (mod?.required) return;
    set('modules', form.modules.includes(id) ? form.modules.filter(m => m !== id) : [...form.modules, id]);
  };
  const toggleShift = (s) => set('shifts', form.shifts.includes(s) ? form.shifts.filter(x=>x!==s) : [...form.shifts, s]);

  const validate = () => {
    if (step === 1) {
      if (!form.name.trim())          { toast.error('Company name required'); return false; }
      if (!form.email.trim())         { toast.error('Email required'); return false; }
      if (!form.contactPerson.trim()) { toast.error('Contact person required'); return false; }
    }
    if (step === 2) {
      if (!form.ohcName.trim())    { toast.error('OHC centre name required'); return false; }
      if (!form.doctorName.trim()) { toast.error('Doctor name required'); return false; }
    }
    if (step === 4) {
      if (!form.adminName.trim())     { toast.error('Admin name required'); return false; }
      if (!form.adminEmail.trim())    { toast.error('Admin email required'); return false; }
      if (!form.adminStaffId.trim())  { toast.error('Staff ID required'); return false; }
      if (form.adminPassword.length < 6) { toast.error('Password min 6 chars'); return false; }
    }
    return true;
  };

  const next = () => { if (validate()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const launch = async () => {
    setSaving(true);
    try {
      const tenantId = slugify(form.name);
      const plan = PLANS.find(p => p.id === form.plan);

      // 1. Create tenant doc
      await setDoc(doc(db, 'merchants', tenantId), {
        id: tenantId, name: form.name, email: form.email, phone: form.phone,
        address: form.address, city: form.city, state: form.state, pincode: form.pincode,
        industry: form.industry, employeeCount: parseInt(form.employeeCount) || 0,
        gstNumber: form.gstNumber, contactPerson: form.contactPerson,
        plan: form.plan, monthlyFee: plan?.price || 4999, billingCycle: form.billingCycle,
        status: 'trial', trialEnds: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        ohcName: form.ohcName, doctorName: form.doctorName, nurseName: form.nurseName,
        workingHours: form.workingHours, shifts: form.shifts,
        hasPharmacy: form.hasPharmacy, hasLab: form.hasLab,
        modules: form.modules,
        createdAt: serverTimestamp(), onboardedAt: serverTimestamp(),
      });

      // 2. Create first admin user
      const pwHash = btoa(form.adminPassword); // base64 — same pattern as existing staff auth
      await setDoc(doc(db, `merchants/${tenantId}/users`, form.adminStaffId), {
        staffId: form.adminStaffId, name: form.adminName, email: form.adminEmail,
        phone: form.adminPhone, role: 'admin', password: pwHash,
        tenantId, status: 'active', createdAt: serverTimestamp(),
      });

      // 3. Seed pharmacy stock placeholder
      if (form.hasPharmacy) {
        await setDoc(doc(db, `merchants/${tenantId}/settings`, 'config'), {
          tenantId, ohcName: form.ohcName, doctorName: form.doctorName,
          modules: form.modules, shifts: form.shifts, setupComplete: true,
        });
      }

      setNewTenantId(tenantId);
      setDone(true);
      toast.success(`${form.name} onboarded successfully!`);
    } catch (e) {
      console.error(e);
      toast.error('Onboarding failed: ' + e.message);
    }
    setSaving(false);
  };

  if (done) return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-display font-bold text-text mb-2">Tenant Launched!</h2>
        <p className="text-muted text-sm mb-4">{form.name} is live on OHC Command</p>
        <div className="bg-surface2 rounded-xl p-4 text-left text-xs space-y-2 mb-6">
          <div className="flex justify-between"><span className="text-muted">Tenant ID</span><span className="font-mono font-bold text-text">{newTenantId}</span></div>
          <div className="flex justify-between"><span className="text-muted">Admin ID</span><span className="font-bold text-text">{form.adminStaffId}</span></div>
          <div className="flex justify-between"><span className="text-muted">Plan</span><span className="font-bold text-text capitalize">{form.plan}</span></div>
          <div className="flex justify-between"><span className="text-muted">Trial ends</span><span className="font-bold text-text">{new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('en-IN')}</span></div>
          <div className="flex justify-between"><span className="text-muted">Portal URL</span><span className="font-bold text-sage truncate">ohc-portal-4f2f8.web.app/portal</span></div>
        </div>
        <button onClick={() => { onComplete?.(); onClose?.(); }}
          className="btn-primary w-full">Done — View Tenants</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-text">Onboard New Tenant</h2>
              <p className="text-sm text-muted">Step {step} of {STEPS.length} — {STEPS[step-1].desc}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface2 hover:bg-border flex items-center justify-center text-muted">✕</button>
          </div>
          <StepIndicator current={step} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">

          {/* ── STEP 1: Company ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Company Name *</label>
                  <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Acme Industries Pvt. Ltd." className="input w-full text-lg font-medium"/>
                </div>
                <div>
                  <label className="label">Industry</label>
                  <select value={form.industry} onChange={e=>set('industry',e.target.value)} className="input w-full">
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Total Employees</label>
                  <input type="number" value={form.employeeCount} onChange={e=>set('employeeCount',e.target.value)} placeholder="e.g. 450" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Contact Person *</label>
                  <input value={form.contactPerson} onChange={e=>set('contactPerson',e.target.value)} placeholder="HR Manager / MD Name" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="hr@company.com" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 98765 43210" className="input w-full"/>
                </div>
                <div>
                  <label className="label">GST Number</label>
                  <input value={form.gstNumber} onChange={e=>set('gstNumber',e.target.value)} placeholder="29AAAAA0000A1Z5" className="input w-full"/>
                </div>
                <div className="col-span-2">
                  <label className="label">Address</label>
                  <input value={form.address} onChange={e=>set('address',e.target.value)} placeholder="Street / Area" className="input w-full"/>
                </div>
                <div>
                  <label className="label">City</label>
                  <input value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Chennai" className="input w-full"/>
                </div>
                <div>
                  <label className="label">State</label>
                  <select value={form.state} onChange={e=>set('state',e.target.value)} className="input w-full">
                    {STATES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: OHC Setup ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">OHC Centre Name *</label>
                  <input value={form.ohcName} onChange={e=>set('ohcName',e.target.value)} placeholder="e.g. Acme OHC / Plant Medical Centre" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Doctor Name *</label>
                  <input value={form.doctorName} onChange={e=>set('doctorName',e.target.value)} placeholder="Dr. Firstname Lastname" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Staff Nurse</label>
                  <input value={form.nurseName} onChange={e=>set('nurseName',e.target.value)} placeholder="Nurse Name" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Working Hours</label>
                  <input value={form.workingHours} onChange={e=>set('workingHours',e.target.value)} placeholder="08:00-17:00" className="input w-full"/>
                </div>
              </div>
              <div>
                <label className="label mb-2">Shifts</label>
                <div className="flex gap-2 flex-wrap">
                  {['General','Morning','Afternoon','Night'].map(s=>(
                    <button key={s} onClick={()=>toggleShift(s)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${form.shifts.includes(s) ? 'border-sage bg-sage/10 text-sage' : 'border-border bg-white text-muted'}`}>
                      {s==='General'?'☀️':s==='Morning'?'🌅':s==='Afternoon'?'🌤️':'🌙'} {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.hasPharmacy} onChange={e=>set('hasPharmacy',e.target.checked)} className="w-4 h-4 accent-sage"/>
                  <span className="text-sm text-text font-medium">💊 Has Pharmacy</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.hasLab} onChange={e=>set('hasLab',e.target.checked)} className="w-4 h-4 accent-sage"/>
                  <span className="text-sm text-text font-medium">🔬 Has In-house Lab</span>
                </label>
              </div>
              <div>
                <label className="label mb-2">Enable Modules</label>
                <div className="grid grid-cols-2 gap-2">
                  {MODULES.map(m=>(
                    <label key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      form.modules.includes(m.id) ? 'border-sage bg-sage/5' : 'border-border bg-white'
                    } ${m.required ? 'opacity-70' : ''}`}>
                      <input type="checkbox" checked={form.modules.includes(m.id)} onChange={()=>toggleModule(m.id)} className="w-4 h-4 accent-sage"/>
                      <span className="text-sm">{m.icon}</span>
                      <span className="text-sm font-medium text-text">{m.label}</span>
                      {m.required && <span className="text-[10px] text-muted ml-auto">required</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Plan ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {PLANS.map(p=>(
                  <button key={p.id} onClick={()=>set('plan',p.id)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all ${form.plan===p.id ? `${p.color} bg-white shadow-lg scale-[1.02]` : 'border-border bg-white hover:border-sage/40'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${p.badge}`}>{p.label}</span>
                      {form.plan===p.id && <span className="text-sage text-lg">✓</span>}
                    </div>
                    <div className="text-2xl font-bold text-text mb-0.5">₹{p.price.toLocaleString('en-IN')}<span className="text-sm font-normal text-muted">/mo</span></div>
                    <div className="text-xs text-muted mb-3">+18% GST</div>
                    <ul className="space-y-1">
                      {p.features.map(f=><li key={f} className="text-xs text-muted flex items-center gap-1.5"><span className="text-sage">✓</span>{f}</li>)}
                    </ul>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                {['monthly','quarterly','annual'].map(bc=>(
                  <button key={bc} onClick={()=>set('billingCycle',bc)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 capitalize transition-all ${form.billingCycle===bc ? 'border-sage bg-sage/10 text-sage' : 'border-border bg-white text-muted'}`}>
                    {bc}
                    {bc==='quarterly' && <div className="text-[10px] text-emerald-600 font-bold">Save 5%</div>}
                    {bc==='annual'    && <div className="text-[10px] text-emerald-600 font-bold">Save 15%</div>}
                  </button>
                ))}
              </div>
              <div className="bg-surface2 rounded-xl p-4 text-sm">
                <div className="flex justify-between mb-1"><span className="text-muted">Plan</span><span className="font-bold capitalize">{form.plan}</span></div>
                <div className="flex justify-between mb-1"><span className="text-muted">Monthly fee</span><span className="font-bold">₹{PLANS.find(p=>p.id===form.plan)?.price.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between mb-1"><span className="text-muted">GST (18%)</span><span>₹{Math.round((PLANS.find(p=>p.id===form.plan)?.price||0)*0.18).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between font-bold border-t border-border pt-2 mt-2">
                  <span>Total / month</span>
                  <span className="text-sage">₹{Math.round((PLANS.find(p=>p.id===form.plan)?.price||0)*1.18).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-xs text-muted mt-2">30-day free trial. First invoice after trial ends.</div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Admin User ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                This admin account will be the first login for <strong>{form.name}</strong>. They can create additional staff users from within the portal.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Admin Full Name *</label>
                  <input value={form.adminName} onChange={e=>set('adminName',e.target.value)} placeholder="Full name of the first admin" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" value={form.adminEmail} onChange={e=>set('adminEmail',e.target.value)} placeholder="admin@company.com" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input value={form.adminPhone} onChange={e=>set('adminPhone',e.target.value)} placeholder="+91 98765 43210" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Staff ID (Login ID) *</label>
                  <input value={form.adminStaffId} onChange={e=>set('adminStaffId',e.target.value)} placeholder="e.g. ADM001" className="input w-full font-mono"/>
                </div>
                <div>
                  <label className="label">Password *</label>
                  <input type="password" value={form.adminPassword} onChange={e=>set('adminPassword',e.target.value)} placeholder="Min 6 characters" className="input w-full"/>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Review ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label:'Company',        val: form.name },
                  { label:'Industry',       val: form.industry || '—' },
                  { label:'Employees',      val: form.employeeCount || '—' },
                  { label:'Contact',        val: form.contactPerson },
                  { label:'Email',          val: form.email },
                  { label:'City / State',   val: `${form.city||'—'}, ${form.state}` },
                  { label:'OHC Name',       val: form.ohcName },
                  { label:'Doctor',         val: form.doctorName },
                  { label:'Shifts',         val: form.shifts.join(', ') },
                  { label:'Modules',        val: `${form.modules.length} enabled` },
                  { label:'Plan',           val: `${form.plan} — ₹${PLANS.find(p=>p.id===form.plan)?.price.toLocaleString('en-IN')}/mo` },
                  { label:'Admin ID',       val: form.adminStaffId },
                ].map(r => (
                  <div key={r.label} className="bg-surface2 rounded-xl p-3 flex flex-col">
                    <span className="text-xs text-muted">{r.label}</span>
                    <span className="font-medium text-text mt-0.5 truncate">{r.val}</span>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
                <strong>Ready to launch!</strong> This will create the tenant in Firestore and provision the admin account. A 30-day trial starts immediately.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border flex justify-between items-center bg-surface2">
          <button onClick={step === 1 ? onClose : back} className="btn-secondary">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{step} / {STEPS.length}</span>
            {step < 5 ? (
              <button onClick={next} className="btn-primary px-8">Next →</button>
            ) : (
              <button onClick={launch} disabled={saving} className="btn-primary px-8 bg-emerald-600 hover:bg-emerald-700">
                {saving ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Launching…</span>
                ) : '🚀 Launch Tenant'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
