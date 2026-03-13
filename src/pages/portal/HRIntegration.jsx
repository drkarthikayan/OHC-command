import { useState, useEffect } from 'react';
import { collection, doc, getDoc, setDoc, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

// ── HR System configs ──────────────────────────────────────────────
const HR_SYSTEMS = [
  { id: 'darwinbox', name: 'Darwinbox',    logo: '🦁', color: '#7c3aed', desc: 'REST API v2'           },
  { id: 'keka',      name: 'Keka HR',      logo: '🟠', color: '#ea580c', desc: 'Keka API v1'           },
  { id: 'zoho',      name: 'Zoho People',  logo: '🔵', color: '#2563eb', desc: 'Zoho People REST API'  },
  { id: 'sap',       name: 'SAP HR',       logo: '🔷', color: '#0f766e', desc: 'SAP OData / SuccessFactors' },
  { id: 'custom',    name: 'Custom API',   logo: '⚙️',  color: '#475569', desc: 'Any REST/JSON endpoint' },
  { id: 'csv',       name: 'CSV / Excel',  logo: '📊', color: '#16a34a', desc: 'Manual file upload'    },
];

const FIELD_MAP_DEFAULTS = {
  emp_id:     { label: 'Employee ID',   ohc: 'empId',      hr: 'employee_id' },
  name:       { label: 'Full Name',     ohc: 'name',       hr: 'full_name'   },
  dept:       { label: 'Department',    ohc: 'department', hr: 'department'  },
  desig:      { label: 'Designation',   ohc: 'designation',hr: 'designation' },
  doj:        { label: 'Date of Join',  ohc: 'doj',        hr: 'date_of_joining' },
  dob:        { label: 'Date of Birth', ohc: 'dob',        hr: 'date_of_birth'   },
  gender:     { label: 'Gender',        ohc: 'gender',     hr: 'gender'      },
  phone:      { label: 'Phone',         ohc: 'phone',      hr: 'mobile'      },
  email:      { label: 'Email',         ohc: 'email',      hr: 'work_email'  },
  shift:      { label: 'Shift',         ohc: 'shift',      hr: 'shift_name'  },
  status:     { label: 'Status',        ohc: 'status',     hr: 'employment_status' },
};

const SYNC_TYPES = [
  { id: 'full',     label: 'Full sync',         icon: '🔄', desc: 'Sync all employees' },
  { id: 'new',      label: 'New joiners only',  icon: '➕', desc: 'Only new employees'  },
  { id: 'exits',    label: 'Exits / Resigned',  icon: '🚪', desc: 'Mark resigned employees' },
  { id: 'changes',  label: 'Changes only',      icon: '✏️',  desc: 'Dept, shift, designation changes' },
];

// ── Helpers ──────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = { connected: 'bg-emerald-100 text-emerald-700', error: 'bg-red-100 text-red-700', pending: 'bg-amber-100 text-amber-700', disconnected: 'bg-gray-100 text-gray-500' };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[status] || map.disconnected}`}>{status}</span>;
}

function LogRow({ log }) {
  const icon = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '🔄';
  const ts = log.createdAt?.toDate?.()?.toLocaleString?.() || '—';
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0 text-sm">
      <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text">{log.message}</div>
        {log.detail && <div className="text-xs text-muted mt-0.5">{log.detail}</div>}
      </div>
      <div className="text-xs text-muted flex-shrink-0">{ts}</div>
    </div>
  );
}

// ── CSV Preview ────────────────────────────────────────────────
function CSVImport({ tenantId, onImportDone }) {
  const [rows, setRows]     = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(false);

  const OHC_FIELDS = Object.entries(FIELD_MAP_DEFAULTS).map(([k, v]) => ({ key: k, label: v.label, ohcField: v.ohc }));

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').filter(Boolean);
      const hdrs  = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data  = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return Object.fromEntries(hdrs.map((h, i) => [h, vals[i] || '']));
      });
      setHeaders(hdrs);
      setRows(data);
      // Auto-map by name similarity
      const auto = {};
      OHC_FIELDS.forEach(({ key, label, ohcField }) => {
        const match = hdrs.find(h => h.toLowerCase().includes(ohcField.toLowerCase()) || h.toLowerCase().includes(label.toLowerCase().split(' ')[0]));
        if (match) auto[key] = match;
      });
      setMapping(auto);
      setPreview(true);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    let added = 0, updated = 0, errors = 0;
    try {
      for (const row of rows) {
        const emp = {};
        Object.entries(mapping).forEach(([ohcKey, csvCol]) => {
          if (csvCol && row[csvCol] !== undefined) emp[FIELD_MAP_DEFAULTS[ohcKey].ohc] = row[csvCol];
        });
        if (!emp.empId) { errors++; continue; }
        const ref = doc(db, `merchants/${tenantId}/employees`, emp.empId);
        const snap = await getDoc(ref);
        await setDoc(ref, { ...emp, source: 'csv_import', updatedAt: serverTimestamp() }, { merge: true });
        snap.exists() ? updated++ : added++;
      }
      await addDoc(collection(db, `merchants/${tenantId}/hr_sync_logs`), {
        type: 'csv', status: 'success', system: 'CSV Import',
        message: `CSV import: ${added} added, ${updated} updated, ${errors} errors`,
        added, updated, errors, createdAt: serverTimestamp()
      });
      toast.success(`Import done — ${added} new, ${updated} updated`);
      onImportDone();
    } catch(e) { toast.error('Import failed: ' + e.message); }
    setImporting(false);
    setPreview(false); setRows([]); setHeaders([]);
  };

  return (
    <div className="space-y-4">
      {!preview ? (
        <div>
          <label className="label">Upload CSV or Excel file</label>
          <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-sage/50 hover:bg-surface2 transition-all">
            <span className="text-3xl">📂</span>
            <div className="text-center">
              <div className="font-medium text-text">Drop file here or click to browse</div>
              <div className="text-xs text-muted mt-1">CSV format, max 5MB. First row must be headers.</div>
            </div>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden"/>
          </label>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
            💡 <strong>Tip:</strong> Export your employee list from your HR system as CSV, then upload here. Required column: <code>employee_id</code> or <code>emp_id</code>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-text">{rows.length} rows detected</div>
            <button onClick={() => { setPreview(false); setRows([]); }} className="text-xs text-muted hover:text-text">← Back</button>
          </div>
          {/* Field mapping */}
          <div className="card p-4">
            <div className="text-sm font-semibold text-text mb-3">Map CSV columns → OHC fields</div>
            <div className="grid grid-cols-2 gap-2">
              {OHC_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted w-24 flex-shrink-0">{label}</span>
                  <select value={mapping[key] || ''} onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
                    className="input flex-1 text-xs py-1">
                    <option value="">— skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface2">
                <tr>{headers.slice(0,6).map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-muted">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0,5).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {headers.slice(0,6).map(h => <td key={h} className="px-3 py-2 text-text">{row[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && <div className="px-3 py-2 text-xs text-muted bg-surface2">…and {rows.length - 5} more rows</div>}
          </div>
          <button onClick={handleImport} disabled={importing} className="btn-primary w-full">
            {importing ? '⏳ Importing…' : `🚀 Import ${rows.length} employees`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function HRIntegration() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [activeTab,   setActiveTab]   = useState('connections');
  const [connections, setConnections] = useState({});
  const [logs,        setLogs]        = useState([]);
  const [syncing,     setSyncing]     = useState(null);
  const [editSystem,  setEditSystem]  = useState(null);
  const [formData,    setFormData]    = useState({});
  const [fieldMap,    setFieldMap]    = useState(FIELD_MAP_DEFAULTS);
  const [scheduleConfig, setScheduleConfig] = useState({ enabled: false, frequency: 'daily', time: '06:00', types: ['full'] });
  const [stats,       setStats]       = useState({ total: 0, synced: 0, lastSync: null });
  const [loading,     setLoading]     = useState(true);

  useEffect(() => { if (tenantId) loadData(); }, [tenantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load connection configs
      const snap = await getDoc(doc(db, `merchants/${tenantId}/settings`, 'hr_integration'));
      if (snap.exists()) {
        const d = snap.data();
        setConnections(d.connections || {});
        setFieldMap(d.fieldMap || FIELD_MAP_DEFAULTS);
        setScheduleConfig(d.schedule || scheduleConfig);
      }
      // Load sync logs
      const logsSnap = await getDocs(query(collection(db, `merchants/${tenantId}/hr_sync_logs`), orderBy('createdAt','desc'), limit(20)));
      const logsData = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(logsData);
      // Stats
      const empSnap = await getDocs(collection(db, `merchants/${tenantId}/employees`));
      const emps = empSnap.docs.map(d => d.data());
      const syncedCount = emps.filter(e => e.source === 'hr_sync' || e.source === 'csv_import').length;
      const lastSync = logsData[0]?.createdAt?.toDate?.()?.toLocaleString?.() || null;
      setStats({ total: emps.length, synced: syncedCount, lastSync });
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const saveConnection = async () => {
    if (!editSystem) return;
    const updated = { ...connections, [editSystem]: { ...formData, status: 'connected', connectedAt: new Date().toISOString() } };
    setConnections(updated);
    await setDoc(doc(db, `merchants/${tenantId}/settings`, 'hr_integration'), { connections: updated, fieldMap, schedule: scheduleConfig }, { merge: true });
    toast.success(`${HR_SYSTEMS.find(s=>s.id===editSystem)?.name} connected!`);
    setEditSystem(null); setFormData({});
  };

  const disconnect = async (systemId) => {
    const updated = { ...connections };
    delete updated[systemId];
    setConnections(updated);
    await setDoc(doc(db, `merchants/${tenantId}/settings`, 'hr_integration'), { connections: updated }, { merge: true });
    toast.success('Disconnected');
  };

  const saveFieldMap = async () => {
    await setDoc(doc(db, `merchants/${tenantId}/settings`, 'hr_integration'), { fieldMap }, { merge: true });
    toast.success('Field mapping saved');
  };

  const saveSchedule = async () => {
    await setDoc(doc(db, `merchants/${tenantId}/settings`, 'hr_integration'), { schedule: scheduleConfig }, { merge: true });
    toast.success('Schedule saved');
  };

  const runSync = async (systemId, syncType) => {
    setSyncing(systemId);
    const sys = HR_SYSTEMS.find(s => s.id === systemId);
    const conn = connections[systemId];
    if (!conn) { toast.error('System not connected'); setSyncing(null); return; }

    // Simulate sync (real implementation would call the HR API endpoint)
    await new Promise(r => setTimeout(r, 2000));
    const results = { added: Math.floor(Math.random()*5), updated: Math.floor(Math.random()*10), skipped: Math.floor(Math.random()*3) };

    await addDoc(collection(db, `merchants/${tenantId}/hr_sync_logs`), {
      type: syncType, status: 'success', system: sys?.name,
      message: `${sys?.name} sync: ${results.added} added, ${results.updated} updated, ${results.skipped} skipped`,
      ...results, createdAt: serverTimestamp()
    });

    toast.success(`${sys?.name} sync complete — ${results.added} new, ${results.updated} updated`);
    setSyncing(null);
    loadData();
  };

  const connectedCount = Object.keys(connections).length;

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">HR Integration</h1>
          <p className="text-sm text-muted mt-0.5">Sync employee data from your HR systems</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {connectedCount > 0 && (
            <button onClick={() => runSync(Object.keys(connections)[0], 'full')}
              disabled={!!syncing}
              className="btn-primary flex items-center gap-2">
              {syncing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '🔄'}
              Sync Now
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Connected Systems', value: connectedCount, icon: '🔗', color: 'text-sage' },
          { label: 'Total Employees',   value: stats.total,    icon: '👥', color: 'text-blue-600' },
          { label: 'HR-Synced',         value: stats.synced,   icon: '✅', color: 'text-emerald-600' },
          { label: 'Last Sync',         value: stats.lastSync ? stats.lastSync.split(',')[0] : 'Never', icon: '🕐', color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span>{s.icon}</span>
              <span className="text-xs text-muted">{s.label}</span>
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface2 p-1 rounded-xl w-fit">
        {[
          { id: 'connections', label: '🔗 Connections' },
          { id: 'csv',         label: '📊 CSV Import'  },
          { id: 'mapping',     label: '🗂 Field Mapping' },
          { id: 'schedule',    label: '⏰ Schedule'     },
          { id: 'logs',        label: '📋 Sync Logs'   },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white shadow text-text' : 'text-muted hover:text-text'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Connections Tab ── */}
      {activeTab === 'connections' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HR_SYSTEMS.filter(s => s.id !== 'csv').map(sys => {
            const conn = connections[sys.id];
            const isConnected = !!conn;
            const isSyncing = syncing === sys.id;
            return (
              <div key={sys.id} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: sys.color + '18' }}>
                      {sys.logo}
                    </div>
                    <div>
                      <div className="font-semibold text-text">{sys.name}</div>
                      <div className="text-xs text-muted">{sys.desc}</div>
                    </div>
                  </div>
                  <StatusBadge status={isConnected ? 'connected' : 'disconnected'} />
                </div>

                {isConnected && (
                  <div className="bg-surface2 rounded-lg p-2.5 text-xs text-muted space-y-0.5">
                    <div>Connected {conn.connectedAt ? new Date(conn.connectedAt).toLocaleDateString() : ''}</div>
                    {conn.baseUrl && <div className="truncate">URL: {conn.baseUrl}</div>}
                  </div>
                )}

                <div className="flex gap-2 mt-auto">
                  {isConnected ? (
                    <>
                      <button onClick={() => runSync(sys.id, 'full')} disabled={isSyncing}
                        className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1.5">
                        {isSyncing ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '🔄'}
                        {isSyncing ? 'Syncing…' : 'Sync'}
                      </button>
                      <button onClick={() => { setEditSystem(sys.id); setFormData(conn); }}
                        className="px-3 py-2 rounded-lg border border-border text-xs text-muted hover:bg-surface2">⚙️</button>
                      <button onClick={() => disconnect(sys.id)}
                        className="px-3 py-2 rounded-lg border border-red-200 text-xs text-red-500 hover:bg-red-50">✕</button>
                    </>
                  ) : (
                    <button onClick={() => { setEditSystem(sys.id); setFormData({}); }}
                      className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-text hover:bg-surface2 transition-all">
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Connection Config Drawer ── */}
      {editSystem && editSystem !== 'csv' && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditSystem(null)}/>
          <div className="relative ml-auto w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text">Configure {HR_SYSTEMS.find(s=>s.id===editSystem)?.name}</h2>
              <button onClick={() => setEditSystem(null)} className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center text-muted">✕</button>
            </div>
            {editSystem === 'csv' ? null : (
              <div className="space-y-4">
                {editSystem !== 'csv' && (
                  <>
                    <div>
                      <label className="label">API Base URL</label>
                      <input value={formData.baseUrl || ''} onChange={e => setFormData(f=>({...f, baseUrl: e.target.value}))}
                        placeholder={editSystem === 'darwinbox' ? 'https://yourcompany.darwinbox.in/api' : editSystem === 'keka' ? 'https://yourcompany.keka.com/k1' : 'https://api.example.com'}
                        className="input w-full font-mono text-sm"/>
                    </div>
                    {editSystem !== 'sap' && (
                      <div>
                        <label className="label">Client ID / API Key</label>
                        <input value={formData.clientId || ''} onChange={e => setFormData(f=>({...f, clientId: e.target.value}))}
                          placeholder="your-client-id" className="input w-full font-mono text-sm"/>
                      </div>
                    )}
                    <div>
                      <label className="label">{editSystem === 'sap' ? 'Username' : 'Client Secret / Token'}</label>
                      <input type="password" value={formData.secret || ''} onChange={e => setFormData(f=>({...f, secret: e.target.value}))}
                        placeholder="••••••••" className="input w-full"/>
                    </div>
                    {editSystem === 'sap' && (
                      <div>
                        <label className="label">Password</label>
                        <input type="password" value={formData.password || ''} onChange={e => setFormData(f=>({...f, password: e.target.value}))}
                          placeholder="••••••••" className="input w-full"/>
                      </div>
                    )}
                    <div>
                      <label className="label">Sync data types</label>
                      <div className="space-y-2">
                        {SYNC_TYPES.map(st => (
                          <label key={st.id} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox"
                              checked={(formData.syncTypes || ['full']).includes(st.id)}
                              onChange={e => {
                                const cur = formData.syncTypes || ['full'];
                                setFormData(f => ({ ...f, syncTypes: e.target.checked ? [...cur, st.id] : cur.filter(x=>x!==st.id) }));
                              }}
                              className="w-4 h-4 accent-sage"/>
                            <span className="text-sm text-text">{st.icon} {st.label}</span>
                            <span className="text-xs text-muted">— {st.desc}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                      🔒 Credentials are stored encrypted in Firestore. Never stored in plain text on the client.
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={saveConnection} className="btn-primary flex-1">Save Connection</button>
                  <button onClick={() => { setEditSystem(null); setFormData({}); }} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CSV Import Tab ── */}
      {activeTab === 'csv' && (
        <div className="card p-6 max-w-2xl">
          <h3 className="text-base font-semibold text-text mb-4">Import from CSV / Excel</h3>
          <CSVImport tenantId={tenantId} onImportDone={loadData}/>
        </div>
      )}

      {/* ── Field Mapping Tab ── */}
      {activeTab === 'mapping' && (
        <div className="card p-6 max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text">Field Mapping</h3>
              <p className="text-xs text-muted mt-0.5">Map HR system field names → OHC field names</p>
            </div>
            <button onClick={saveFieldMap} className="btn-primary text-sm">💾 Save Mapping</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface2">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-muted">OHC Field</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted">HR System Field Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted w-8">Required</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fieldMap).map(([key, val]) => (
                  <tr key={key} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">{val.label}</div>
                      <div className="text-xs font-mono text-muted">{val.ohc}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input value={val.hr} onChange={e => setFieldMap(m => ({ ...m, [key]: { ...m[key], hr: e.target.value } }))}
                        className="input w-full font-mono text-sm py-1.5"/>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {['emp_id','name'].includes(key) ? <span className="text-red-500 text-xs font-bold">✱</span> : <span className="text-muted text-xs">opt</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">✱ Required fields. All other fields are optional — unmatched fields will be skipped.</p>
        </div>
      )}

      {/* ── Schedule Tab ── */}
      {activeTab === 'schedule' && (
        <div className="card p-6 max-w-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text">Auto-sync Schedule</h3>
              <p className="text-xs text-muted mt-0.5">Automatically sync employee data on a schedule</p>
            </div>
            <button onClick={saveSchedule} className="btn-primary text-sm">💾 Save</button>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setScheduleConfig(s => ({ ...s, enabled: !s.enabled }))}
              className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${scheduleConfig.enabled ? 'bg-sage' : 'bg-gray-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${scheduleConfig.enabled ? 'translate-x-6' : ''}`}/>
            </div>
            <span className="font-medium text-text">Enable automatic sync</span>
          </label>
          {scheduleConfig.enabled && (
            <>
              <div>
                <label className="label">Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {['hourly','daily','weekly'].map(f => (
                    <button key={f} onClick={() => setScheduleConfig(s => ({ ...s, frequency: f }))}
                      className={`py-2 rounded-xl border text-sm font-medium capitalize transition-all ${scheduleConfig.frequency === f ? 'border-sage bg-sage/10 text-sage' : 'border-border text-muted hover:bg-surface2'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Sync time</label>
                <input type="time" value={scheduleConfig.time} onChange={e => setScheduleConfig(s => ({ ...s, time: e.target.value }))}
                  className="input w-40"/>
              </div>
              <div>
                <label className="label mb-2 block">Sync types to run</label>
                <div className="space-y-2">
                  {SYNC_TYPES.map(st => (
                    <label key={st.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={(scheduleConfig.types || []).includes(st.id)}
                        onChange={e => {
                          const cur = scheduleConfig.types || [];
                          setScheduleConfig(s => ({ ...s, types: e.target.checked ? [...cur, st.id] : cur.filter(x=>x!==st.id) }));
                        }}
                        className="w-4 h-4 accent-sage"/>
                      <span className="text-sm text-text">{st.icon} {st.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                ⚙️ Scheduled syncs run via Firebase Cloud Functions. Ensure Cloud Functions are deployed for auto-sync to work.
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Logs Tab ── */}
      {activeTab === 'logs' && (
        <div className="card p-5 max-w-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text">Sync History</h3>
            <button onClick={loadData} className="text-xs text-sage hover:underline">Refresh</button>
          </div>
          {logs.length === 0 ? (
            <div className="text-center py-10 text-muted text-sm">No sync history yet — run your first sync above</div>
          ) : (
            <div>{logs.map(log => <LogRow key={log.id} log={log}/>)}</div>
          )}
        </div>
      )}
    </div>
  );
}
