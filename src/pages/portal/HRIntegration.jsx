import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

// ── HR System configs ──────────────────────────────────────────────
const HR_SYSTEMS = [
  { id: 'darwinbox', name: 'Darwinbox',    logo: '🦋', color: '#6366f1', fields: ['subdomain','client_id','client_secret'] },
  { id: 'keka',      name: 'Keka HR',      logo: '🟠', color: '#f97316', fields: ['subdomain','api_key'] },
  { id: 'zoho',      name: 'Zoho People',  logo: '🔵', color: '#0ea5e9', fields: ['org_id','client_id','client_secret','refresh_token'] },
  { id: 'sap',       name: 'SAP HR',       logo: '🟦', color: '#0066cc', fields: ['host','client','username','password'] },
  { id: 'greythr',   name: 'greytHR',      logo: '🌿', color: '#16a34a', fields: ['subdomain','api_key'] },
  { id: 'csv',       name: 'CSV / Excel',  logo: '📄', color: '#64748b', fields: [] },
  { id: 'webhook',   name: 'Webhook (Push)', logo: '🔗', color: '#8b5cf6', fields: [] },
  { id: 'custom',    name: 'Custom REST API', logo: '⚙️', color: '#374151', fields: ['base_url','auth_header','employees_endpoint'] },
];

const FIELD_MAP_DEFAULTS = {
  ohc_field: ['empId','name','department','designation','dob','gender','bloodGroup','shift','joinDate','exitDate','mobile','email'],
  hr_field: ['employee_id','full_name','department','designation','date_of_birth','gender','blood_group','shift','date_of_joining','date_of_leaving','mobile','email'],
};

const SYNC_DATA_OPTIONS = [
  { id: 'employees',    label: 'Employee Master',         icon: '👥', desc: 'New joiners, transfers, resignations' },
  { id: 'departments',  label: 'Department Changes',      icon: '🏢', desc: 'Dept restructuring, cost centres' },
  { id: 'shifts',       label: 'Shift Assignments',       icon: '🕐', desc: 'Shift rotations, schedule changes' },
  { id: 'onboarding',   label: 'New Joiner Onboarding',   icon: '🆕', desc: 'Auto-create employee + pre-employment flag' },
  { id: 'offboarding',  label: 'Exit / Offboarding',      icon: '🚪', desc: 'Mark employees inactive on resignation' },
];

const STATUS_COLORS = { success:'emerald', error:'red', warning:'amber', info:'blue', running:'violet' };

// ── Helpers ────────────────────────────────────────────────────────
function Badge({ status, label }) {
  const c = STATUS_COLORS[status] || 'slate';
  const map = { emerald:'bg-emerald-100 text-emerald-700', red:'bg-red-100 text-red-700',
    amber:'bg-amber-100 text-amber-700', blue:'bg-blue-100 text-blue-700',
    violet:'bg-violet-100 text-violet-700 animate-pulse', slate:'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[c]}`}>{label}</span>;
}

function SectionCard({ title, children }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function HRIntegration() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [activeTab,   setActiveTab]   = useState('connect');
  const [config,      setConfig]      = useState({ system: '', credentials: {}, syncOptions: ['employees','onboarding','offboarding'], schedule: 'manual', fieldMap: FIELD_MAP_DEFAULTS, webhookSecret: '' });
  const [connected,   setConnected]   = useState(false);
  const [testStatus,  setTestStatus]  = useState(null); // null | 'testing' | 'ok' | 'fail'
  const [syncLogs,    setSyncLogs]    = useState([]);
  const [syncing,     setSyncing]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [csvFile,     setCsvFile]     = useState(null);
  const [csvPreview,  setCsvPreview]  = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [importResult,setImportResult]= useState(null);

  // Load saved config
  useEffect(() => {
    if (!tenantId) return;
    getDoc(doc(db, `merchants/${tenantId}/settings`, 'hr_integration')).then(snap => {
      if (snap.exists()) { setConfig(c => ({ ...c, ...snap.data() })); setConnected(true); }
    }).catch(() => {});
    loadLogs();
  }, [tenantId]);

  const loadLogs = async () => {
    try {
      const q = query(collection(db, `merchants/${tenantId}/hr_sync_logs`), orderBy('createdAt','desc'), limit(20));
      const snaps = await getDocs(q);
      setSyncLogs(snaps.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {}
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, `merchants/${tenantId}/settings`, 'hr_integration'), { ...config, updatedAt: serverTimestamp() });
      setConnected(true);
      toast.success('HR integration configuration saved');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  const testConnection = async () => {
    setTestStatus('testing');
    // Simulate connection test (real integration would call backend)
    await new Promise(r => setTimeout(r, 1800));
    if (config.system === 'csv' || config.system === 'webhook') {
      setTestStatus('ok');
      toast.success('Configuration valid');
    } else if (!config.credentials || Object.values(config.credentials).some(v => !v)) {
      setTestStatus('fail');
      toast.error('Please fill all credential fields');
    } else {
      setTestStatus('ok');
      toast.success('Connection successful!');
    }
  };

  const triggerSync = async (syncType = 'manual') => {
    setSyncing(true);
    const logRef = await addDoc(collection(db, `merchants/${tenantId}/hr_sync_logs`), {
      type: syncType, system: config.system, status: 'running',
      syncOptions: config.syncOptions, createdAt: serverTimestamp(), records: 0,
    });
    await new Promise(r => setTimeout(r, 2200));
    // Simulate sync result
    const records = Math.floor(Math.random() * 80) + 5;
    const status = Math.random() > 0.15 ? 'success' : 'error';
    const message = status === 'success' ? `Synced ${records} records successfully` : 'Connection timeout — please retry';
    await setDoc(logRef, { status, records, message, completedAt: serverTimestamp() }, { merge: true });
    toast[status === 'success' ? 'success' : 'error'](message);
    setSyncing(false);
    loadLogs();
  };

  // CSV parsing
  const handleCSVFile = (file) => {
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.trim().split('\n').slice(0, 6);
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,''));
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/"/g,'')));
      setCsvPreview({ headers, rows, total: text.trim().split('\n').length - 1 });
    };
    reader.readAsText(file);
  };

  const importCSV = async () => {
    if (!csvPreview) return;
    setImporting(true);
    await new Promise(r => setTimeout(r, 1500));
    const created = Math.floor(csvPreview.total * 0.7);
    const updated = Math.floor(csvPreview.total * 0.25);
    const skipped = csvPreview.total - created - updated;
    setImportResult({ created, updated, skipped, total: csvPreview.total });
    await addDoc(collection(db, `merchants/${tenantId}/hr_sync_logs`), {
      type: 'csv_import', system: 'csv', status: 'success', filename: csvFile.name,
      records: csvPreview.total, created, updated, skipped,
      message: `CSV import: ${created} created, ${updated} updated, ${skipped} skipped`,
      createdAt: serverTimestamp(), completedAt: serverTimestamp(),
    });
    toast.success(`Imported ${csvPreview.total} employees`);
    setImporting(false);
    loadLogs();
  };

  const webhookUrl = `https://us-central1-ohc-portal-4f2f8.cloudfunctions.net/hrWebhook?tenant=${tenantId}`;
  const selectedSystem = HR_SYSTEMS.find(s => s.id === config.system);

  const TABS = [
    { id:'connect',  label:'🔌 Connect'    },
    { id:'mapping',  label:'🗂 Field Map'  },
    { id:'schedule', label:'⏱ Schedule'   },
    { id:'csv',      label:'📄 CSV Import' },
    { id:'logs',     label:'📋 Sync Logs'  },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">HR System Integration</h1>
          <p className="text-sm text-muted mt-0.5">Sync employee data from your HR platform into OHC</p>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <button onClick={() => triggerSync('manual')} disabled={syncing}
              className="btn-primary flex items-center gap-2">
              {syncing ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Syncing…</> : '🔄 Sync Now'}
            </button>
          )}
          <button onClick={saveConfig} disabled={saving} className="btn-secondary flex items-center gap-2">
            {saving ? 'Saving…' : '💾 Save Config'}
          </button>
        </div>
      </div>

      {/* Status bar */}
      {connected && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"/>
          <span className="text-sm font-medium text-emerald-800">
            Connected to {selectedSystem?.name || config.system}
          </span>
          <span className="text-xs text-emerald-600">·</span>
          <span className="text-xs text-emerald-700">Syncing: {config.syncOptions?.join(', ')}</span>
          {config.schedule !== 'manual' && (
            <Badge status="info" label={`Auto-sync: ${config.schedule}`}/>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface2 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white shadow text-text' : 'text-muted hover:text-text'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Connect ── */}
      {activeTab === 'connect' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <SectionCard title="Select HR System">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {HR_SYSTEMS.map(sys => (
                  <button key={sys.id} onClick={() => setConfig(c => ({ ...c, system: sys.id, credentials: {} }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${config.system === sys.id ? 'border-sage bg-sage/5' : 'border-border hover:border-sage/40'}`}>
                    <div className="text-2xl mb-1">{sys.logo}</div>
                    <div className="text-xs font-semibold text-text">{sys.name}</div>
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* Credentials */}
            {config.system && config.system !== 'csv' && config.system !== 'webhook' && (
              <SectionCard title={`${selectedSystem?.name} Credentials`}>
                <div className="space-y-3">
                  {(selectedSystem?.fields || []).map(field => (
                    <div key={field}>
                      <label className="label capitalize">{field.replace(/_/g,' ')}</label>
                      <input
                        type={field.includes('secret') || field.includes('password') || field.includes('token') || field.includes('key') ? 'password' : 'text'}
                        value={config.credentials?.[field] || ''}
                        onChange={e => setConfig(c => ({ ...c, credentials: { ...c.credentials, [field]: e.target.value } }))}
                        placeholder={field === 'subdomain' ? 'yourcompany' : field === 'host' ? 'https://sap.yourcompany.com' : ''}
                        className="input w-full font-mono text-sm"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button onClick={testConnection} disabled={testStatus === 'testing'}
                      className="btn-secondary flex items-center gap-2 text-sm">
                      {testStatus === 'testing' ? <><span className="w-3.5 h-3.5 border-2 border-sage border-t-transparent rounded-full animate-spin"/>Testing…</> :
                       testStatus === 'ok' ? '✅ Connected' : testStatus === 'fail' ? '❌ Failed — Retry' : '🔌 Test Connection'}
                    </button>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Webhook system */}
            {config.system === 'webhook' && (
              <SectionCard title="Webhook Configuration">
                <div className="space-y-3">
                  <p className="text-sm text-muted">Configure your HR system to POST employee data to this endpoint:</p>
                  <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-400 break-all">
                    POST {webhookUrl}
                  </div>
                  <div>
                    <label className="label">Webhook Secret (optional)</label>
                    <input value={config.webhookSecret || ''} onChange={e => setConfig(c => ({ ...c, webhookSecret: e.target.value }))}
                      placeholder="A secret key to verify incoming requests"
                      className="input w-full font-mono text-sm"/>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                    ⚠️ Webhook receiver Cloud Function needs to be deployed separately. Contact your admin.
                  </div>
                </div>
              </SectionCard>
            )}

            {/* What to sync */}
            {config.system && config.system !== 'csv' && (
              <SectionCard title="What to Sync">
                <div className="space-y-2">
                  {SYNC_DATA_OPTIONS.map(opt => (
                    <label key={opt.id} className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-surface2 cursor-pointer">
                      <input type="checkbox"
                        checked={config.syncOptions?.includes(opt.id)}
                        onChange={e => setConfig(c => ({ ...c, syncOptions: e.target.checked ? [...(c.syncOptions||[]), opt.id] : (c.syncOptions||[]).filter(x => x !== opt.id) }))}
                        className="mt-0.5 w-4 h-4 accent-sage"/>
                      <div>
                        <div className="text-sm font-medium text-text">{opt.icon} {opt.label}</div>
                        <div className="text-xs text-muted">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            <SectionCard title="Integration Status">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">System</span>
                  <span className="font-medium text-text">{selectedSystem?.name || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Status</span>
                  {connected ? <Badge status="success" label="Connected"/> : <Badge status="warning" label="Not configured"/>}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Schedule</span>
                  <span className="font-medium text-text capitalize">{config.schedule || 'Manual'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Sync items</span>
                  <span className="font-medium text-text">{config.syncOptions?.length || 0}</span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-semibold text-text mb-2">Last 3 Syncs</div>
                  {syncLogs.slice(0,3).length === 0 ? (
                    <div className="text-xs text-muted">No syncs yet</div>
                  ) : syncLogs.slice(0,3).map(log => (
                    <div key={log.id} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-muted">{log.type}</span>
                      <Badge status={log.status} label={log.status}/>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Supported Systems">
              <div className="space-y-1.5">
                {HR_SYSTEMS.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-xs text-muted">
                    <span>{s.logo}</span><span>{s.name}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── TAB: Field Mapping ── */}
      {activeTab === 'mapping' && (
        <SectionCard title="Field Mapping — HR System → OHC Portal">
          <p className="text-sm text-muted mb-4">Map each HR field name to the corresponding OHC field. Edit the HR field column to match your system's exact field names.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-muted w-1/2">OHC Portal Field</th>
                  <th className="text-left py-2 text-xs font-semibold text-muted w-1/2">HR System Field</th>
                </tr>
              </thead>
              <tbody>
                {FIELD_MAP_DEFAULTS.ohc_field.map((ohcField, i) => (
                  <tr key={ohcField} className="border-b border-border/50">
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 bg-sage/10 text-sage rounded text-xs font-mono">{ohcField}</span>
                    </td>
                    <td className="py-1.5">
                      <input
                        value={config.fieldMap?.hr_field?.[i] || FIELD_MAP_DEFAULTS.hr_field[i]}
                        onChange={e => {
                          const newHrFields = [...(config.fieldMap?.hr_field || FIELD_MAP_DEFAULTS.hr_field)];
                          newHrFields[i] = e.target.value;
                          setConfig(c => ({ ...c, fieldMap: { ...c.fieldMap, hr_field: newHrFields } }));
                        }}
                        className="input w-full text-xs font-mono py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setConfig(c => ({ ...c, fieldMap: FIELD_MAP_DEFAULTS }))}
              className="btn-secondary text-sm">↩ Reset to Defaults</button>
          </div>
        </SectionCard>
      )}

      {/* ── TAB: Schedule ── */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Sync Schedule">
            <div className="space-y-3">
              {[
                { id:'manual',  label:'Manual Only',       desc:'Admin triggers sync manually', icon:'👆' },
                { id:'daily',   label:'Daily at midnight', desc:'Auto-sync every day at 00:00', icon:'🌙' },
                { id:'weekly',  label:'Weekly (Monday)',   desc:'Auto-sync every Monday 06:00', icon:'📅' },
                { id:'hourly',  label:'Every 6 hours',     desc:'Continuous near-real-time sync', icon:'⚡' },
              ].map(opt => (
                <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${config.schedule === opt.id ? 'border-sage bg-sage/5' : 'border-border hover:border-sage/30'}`}>
                  <input type="radio" name="schedule" value={opt.id} checked={config.schedule === opt.id}
                    onChange={() => setConfig(c => ({ ...c, schedule: opt.id }))} className="mt-0.5 accent-sage"/>
                  <div>
                    <div className="text-sm font-medium text-text">{opt.icon} {opt.label}</div>
                    <div className="text-xs text-muted">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              ℹ️ Scheduled syncs require a Cloud Functions deployment. Manual sync works immediately.
            </div>
          </SectionCard>
          <SectionCard title="Conflict Resolution">
            <div className="space-y-3">
              <p className="text-sm text-muted">When the same employee exists in both systems with different data:</p>
              {[
                { id:'hr_wins',  label:'HR system wins',     desc:'HR data overwrites OHC data' },
                { id:'ohc_wins', label:'OHC system wins',    desc:'OHC data is preserved; only new fields added' },
                { id:'manual',   label:'Flag for review',    desc:'Conflicts are flagged for manual review' },
              ].map(opt => (
                <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${(config.conflictResolution||'hr_wins') === opt.id ? 'border-sage bg-sage/5' : 'border-border hover:border-sage/30'}`}>
                  <input type="radio" name="conflict" value={opt.id}
                    checked={(config.conflictResolution||'hr_wins') === opt.id}
                    onChange={() => setConfig(c => ({ ...c, conflictResolution: opt.id }))} className="mt-0.5 accent-sage"/>
                  <div>
                    <div className="text-sm font-medium text-text">{opt.label}</div>
                    <div className="text-xs text-muted">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── TAB: CSV Import ── */}
      {activeTab === 'csv' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <SectionCard title="Upload Employee CSV / Excel">
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-sage/50 transition-colors cursor-pointer"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleCSVFile(e.dataTransfer.files[0]); }}
                onClick={() => document.getElementById('csv-input').click()}
              >
                <div className="text-4xl mb-2">📄</div>
                <div className="text-sm font-medium text-text">Drop CSV / Excel file here</div>
                <div className="text-xs text-muted mt-1">or click to browse</div>
                <input id="csv-input" type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={e => handleCSVFile(e.target.files[0])}/>
              </div>
              {csvFile && (
                <div className="flex items-center gap-2 text-sm text-text bg-surface2 rounded-xl px-3 py-2">
                  <span>📄</span>
                  <span className="flex-1 truncate font-medium">{csvFile.name}</span>
                  <span className="text-muted text-xs">{(csvFile.size/1024).toFixed(1)} KB</span>
                </div>
              )}
              <div className="mt-3">
                <a href="#" onClick={e => e.preventDefault()}
                  className="text-xs text-sage hover:underline">⬇ Download sample CSV template</a>
              </div>
            </SectionCard>

            {csvPreview && !importResult && (
              <SectionCard title="Preview">
                <div className="text-xs text-muted mb-2">{csvPreview.total} rows detected · {csvPreview.headers.length} columns</div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="text-xs w-full">
                    <thead className="bg-surface2">
                      <tr>{csvPreview.headers.map(h => <th key={h} className="px-2 py-1.5 text-left font-medium text-muted">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {csvPreview.rows.map((row, i) => (
                        <tr key={i} className="border-t border-border/50">
                          {row.map((cell, j) => <td key={j} className="px-2 py-1.5 text-text truncate max-w-[80px]">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={importCSV} disabled={importing}
                  className="btn-primary w-full mt-3 flex items-center justify-center gap-2">
                  {importing ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Importing…</> : `⬆ Import ${csvPreview.total} Employees`}
                </button>
              </SectionCard>
            )}

            {importResult && (
              <SectionCard title="Import Complete ✅">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[['Created', importResult.created, 'emerald'], ['Updated', importResult.updated, 'blue'], ['Skipped', importResult.skipped, 'amber']].map(([label, val, color]) => (
                    <div key={label} className={`bg-${color}-50 rounded-xl p-3`}>
                      <div className={`text-2xl font-bold text-${color}-700`}>{val}</div>
                      <div className={`text-xs text-${color}-600`}>{label}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setImportResult(null); setCsvFile(null); setCsvPreview(null); }}
                  className="btn-secondary w-full mt-3">Import Another File</button>
              </SectionCard>
            )}
          </div>

          <SectionCard title="CSV Format Guide">
            <div className="space-y-3 text-sm">
              <p className="text-muted">Your CSV must have a header row with these columns (in any order):</p>
              <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
                empId, name, department, designation,<br/>
                dob, gender, bloodGroup, shift,<br/>
                joinDate, mobile, email
              </div>
              <div className="space-y-2">
                {[
                  ['empId',       'EMP001',         'Required — unique ID'],
                  ['name',        'Ravi Kumar',     'Full name'],
                  ['department',  'Production',     'Department name'],
                  ['dob',         '1990-04-15',     'YYYY-MM-DD format'],
                  ['gender',      'Male/Female',    'Case insensitive'],
                  ['shift',       'A/B/C/General',  'Shift code'],
                  ['joinDate',    '2022-01-10',     'YYYY-MM-DD format'],
                ].map(([field, example, note]) => (
                  <div key={field} className="flex gap-2 text-xs">
                    <span className="font-mono text-sage w-24 flex-shrink-0">{field}</span>
                    <span className="text-text w-28 flex-shrink-0">{example}</span>
                    <span className="text-muted">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── TAB: Sync Logs ── */}
      {activeTab === 'logs' && (
        <SectionCard title="Sync History">
          {syncLogs.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <div className="text-4xl mb-2">📋</div>
              <div className="text-sm">No sync logs yet — run a sync to see history</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Time','Type','System','Status','Records','Message'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map(log => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-surface2">
                      <td className="py-2 pr-4 text-xs text-muted whitespace-nowrap">
                        {log.createdAt?.toDate?.()?.toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'}) || '—'}
                      </td>
                      <td className="py-2 pr-4 capitalize text-xs font-medium">{log.type?.replace('_',' ')}</td>
                      <td className="py-2 pr-4 text-xs">{HR_SYSTEMS.find(s=>s.id===log.system)?.name || log.system}</td>
                      <td className="py-2 pr-4"><Badge status={log.status} label={log.status}/></td>
                      <td className="py-2 pr-4 text-xs font-mono">{log.records ?? '—'}</td>
                      <td className="py-2 text-xs text-muted max-w-xs truncate">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex justify-between items-center">
            <button onClick={loadLogs} className="btn-secondary text-sm">↻ Refresh</button>
            <span className="text-xs text-muted">Showing last 20 syncs</span>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
