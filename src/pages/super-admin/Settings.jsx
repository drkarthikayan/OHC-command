import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const FIREBASE_INFO = [
  { label: 'Project ID',       value: 'ohc-portal-4f2f8' },
  { label: 'Hosting URL',      value: 'ohc-portal-4f2f8.web.app' },
  { label: 'Firestore Region', value: 'asia-south1' },
  { label: 'Auth Domain',      value: 'ohc-portal-4f2f8.firebaseapp.com' },
];

export default function SettingsPage() {
  const [cfg, setCfg] = useState({ trialDays: 14, supportEmail: 'support@ohcportal.in', gstPct: 18 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'config', 'superAdmin')).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setCfg(c => ({
          trialDays:    d.trialDays    || c.trialDays,
          supportEmail: d.supportEmail || c.supportEmail,
          gstPct:       d.gstPct       || c.gstPct,
        }));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'superAdmin'), {
        ...cfg,
        trialDays: parseInt(cfg.trialDays) || 14,
        gstPct: parseInt(cfg.gstPct) || 18,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-text">Platform Settings</h1>
        <p className="text-muted text-sm mt-0.5">Saved to Firestore /config/superAdmin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Firebase Project Info */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <span>🔥</span>
            <h3 className="text-sm font-semibold text-text">Firebase Project</h3>
            <span className="ml-auto text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full">Read-only</span>
          </div>
          <div className="p-4 space-y-3">
            {FIREBASE_INFO.map(f => (
              <div key={f.label}>
                <label className="field-label">{f.label}</label>
                <input className="field-input opacity-60 cursor-not-allowed" value={f.value} readOnly />
              </div>
            ))}
          </div>
        </div>

        {/* Platform Config */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <span>⚙️</span>
            <h3 className="text-sm font-semibold text-text">Platform Config</h3>
          </div>
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted text-sm">Loading…</div>
            ) : (
              <>
                <div>
                  <label className="field-label">Default Trial Period (days)</label>
                  <input
                    type="number" className="field-input" min="1" max="90"
                    value={cfg.trialDays}
                    onChange={e => set('trialDays', e.target.value)}
                  />
                  <p className="text-xs text-muted mt-1">New tenants get this many days free</p>
                </div>
                <div>
                  <label className="field-label">Support Email</label>
                  <input
                    type="email" className="field-input"
                    value={cfg.supportEmail}
                    onChange={e => set('supportEmail', e.target.value)}
                    placeholder="support@ohcportal.in"
                  />
                  <p className="text-xs text-muted mt-1">Shown on invoices and email footers</p>
                </div>
                <div>
                  <label className="field-label">Default GST %</label>
                  <input
                    type="number" className="field-input" min="0" max="28"
                    value={cfg.gstPct}
                    onChange={e => set('gstPct', e.target.value)}
                  />
                  <p className="text-xs text-muted mt-1">Applied by default in invoice wizard</p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary w-full justify-center disabled:opacity-50 mt-2"
                >
                  {saving ? 'Saving…' : saved ? '✓ Saved!' : '💾 Save to Firestore'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Role Reference */}
        <div className="card overflow-hidden md:col-span-2">
          <div className="card-header">
            <span>👥</span>
            <h3 className="text-sm font-semibold text-text">Role Permissions Reference</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface2 border-b border-border">
                  {['Role', 'Employees', 'OPD', 'Pharmacy', 'Certificates', 'Users', 'Settings'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { role: '⚡ Super Admin', emp: 'Full', opd: 'Full', ph: 'Full', cert: 'Full', users: 'Full', settings: 'Full' },
                  { role: '🔐 OHC Admin',   emp: 'Full', opd: 'Full', ph: 'Full', cert: 'Full', users: 'Manage', settings: 'Edit' },
                  { role: '👨‍⚕️ Doctor',      emp: 'Read', opd: 'Full', ph: 'Read', cert: 'Full', users: 'Read', settings: '—' },
                  { role: '💉 Nurse',        emp: 'Read', opd: 'Full', ph: 'Read', cert: '—',    users: 'Read', settings: '—' },
                  { role: '💊 Pharmacy',     emp: 'Read', opd: 'Read', ph: 'Full', cert: '—',    users: 'Read', settings: '—' },
                  { role: '👤 Staff',        emp: 'Read', opd: 'Read', ph: 'Read', cert: '—',    users: '—',    settings: '—' },
                ].map(r => (
                  <tr key={r.role} className="border-b border-border/50 last:border-0 hover:bg-surface2/30">
                    <td className="px-4 py-3 font-medium text-text">{r.role}</td>
                    {[r.emp, r.opd, r.ph, r.cert, r.users, r.settings].map((v, i) => (
                      <td key={i} className="px-4 py-3">
                        <span className={`text-xs font-medium ${
                          v === 'Full' ? 'text-accent' :
                          v === 'Read' ? 'text-blue' :
                          v === 'Manage' || v === 'Edit' ? 'text-amber' :
                          'text-muted'
                        }`}>{v}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card overflow-hidden md:col-span-2 border-red/20">
          <div className="card-header border-red/20">
            <span>⚠️</span>
            <h3 className="text-sm font-semibold text-red">Danger Zone</h3>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-text">Export All Data</div>
              <div className="text-xs text-muted mt-0.5">Download a JSON backup of all tenant and user data</div>
            </div>
            <button className="btn-ghost text-xs opacity-50 cursor-not-allowed" disabled>Coming soon</button>
          </div>
        </div>

      </div>
    </div>
  );
}
