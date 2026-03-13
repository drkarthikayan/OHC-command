import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const PRESET_THEMES = [
  { name: 'OHC Green',    sage: '#52b788', sage2: '#4a8070', accent: '#74c69d', text: '#1e293b', bg: '#f0f4f8' },
  { name: 'Royal Blue',   sage: '#3b82f6', sage2: '#2563eb', accent: '#60a5fa', text: '#1e293b', bg: '#f0f4ff' },
  { name: 'Deep Purple',  sage: '#7c3aed', sage2: '#6d28d9', accent: '#a78bfa', text: '#1e293b', bg: '#f5f3ff' },
  { name: 'Crimson',      sage: '#dc2626', sage2: '#b91c1c', accent: '#f87171', text: '#1e293b', bg: '#fff1f2' },
  { name: 'Amber',        sage: '#d97706', sage2: '#b45309', accent: '#fbbf24', text: '#1e293b', bg: '#fffbeb' },
  { name: 'Teal',         sage: '#0d9488', sage2: '#0f766e', accent: '#2dd4bf', text: '#1e293b', bg: '#f0fdfa' },
  { name: 'Slate Dark',   sage: '#475569', sage2: '#334155', accent: '#94a3b8', text: '#f8fafc', bg: '#0f172a' },
  { name: 'Forest',       sage: '#166534', sage2: '#14532d', accent: '#4ade80', text: '#1e293b', bg: '#f0fdf4' },
];

const DEFAULT_BRANDING = {
  companyDisplayName: '',
  tagline: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#52b788',
  primaryDark: '#4a8070',
  accentColor: '#74c69d',
  textColor: '#1e293b',
  bgColor: '#f0f4f8',
  fontHeading: 'Plus Jakarta Sans',
  fontBody: 'Plus Jakarta Sans',
  showPoweredBy: true,
  customFooter: '',
  supportEmail: '',
  supportPhone: '',
};

function ColorPicker({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5"/>
        <input value={value} onChange={e => onChange(e.target.value)}
          className="input flex-1 font-mono text-sm" placeholder="#000000"/>
      </div>
    </div>
  );
}

function PreviewPortal({ branding }) {
  const bg    = branding.bgColor    || '#f0f4f8';
  const sage  = branding.primaryColor || '#52b788';
  const sage2 = branding.primaryDark  || '#4a8070';
  const text  = branding.textColor  || '#1e293b';
  const name  = branding.companyDisplayName || 'Your Company OHC';
  const tag   = branding.tagline || 'Occupational Health Centre';

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-lg" style={{ background: bg, minHeight: 200 }}>
      {/* Sidebar preview */}
      <div className="flex h-48">
        <div className="w-40 flex flex-col" style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0' }}>
          {/* Logo area */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="w-7 h-7 rounded object-cover"/>
              ) : (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: sage }}>
                  {name[0]?.toUpperCase() || 'O'}
                </div>
              )}
              <div>
                <div className="text-[10px] font-bold truncate" style={{ color: text, maxWidth: 90 }}>{name}</div>
                <div className="text-[8px] text-gray-400 truncate" style={{ maxWidth: 90 }}>{tag}</div>
              </div>
            </div>
          </div>
          {/* Nav items */}
          {['Dashboard','Employees','OPD / Visits','Pharmacy'].map((item, i) => (
            <div key={item} className="flex items-center gap-2 px-3 py-2 text-[9px]"
              style={{ background: i === 0 ? sage + '18' : 'transparent', color: i === 0 ? sage : '#94a3b8', fontWeight: i === 0 ? 600 : 400 }}>
              <div className="w-2 h-2 rounded-sm" style={{ background: i === 0 ? sage : '#e2e8f0' }}/>
              {item}
            </div>
          ))}
        </div>
        {/* Content area */}
        <div className="flex-1 p-3" style={{ background: bg }}>
          <div className="text-[10px] font-bold mb-2" style={{ color: text }}>Dashboard</div>
          <div className="grid grid-cols-2 gap-1.5">
            {['OPD Today','Employees','Alerts','Reports'].map(card => (
              <div key={card} className="rounded-lg p-2 bg-white border border-gray-100">
                <div className="text-[8px] text-gray-400">{card}</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: sage }}>—</div>
              </div>
            ))}
          </div>
          <div className="mt-2 h-1.5 rounded-full" style={{ background: sage, width: '60%', opacity: 0.3 }}/>
        </div>
      </div>
      {/* Footer */}
      {branding.showPoweredBy && (
        <div className="text-center py-1.5 text-[8px] text-gray-400 border-t border-gray-100 bg-white">
          {branding.customFooter || 'Powered by OHC Command'}
        </div>
      )}
    </div>
  );
}

export default function BrandingSettings() {
  const { tenant, setTenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [activeTab, setActiveTab] = useState('identity');
  const logoInputRef = useRef();

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, `merchants/${tenantId}/settings`, 'branding'));
        if (snap.exists()) setBranding({ ...DEFAULT_BRANDING, ...snap.data() });
        else setBranding({ ...DEFAULT_BRANDING, companyDisplayName: tenant?.name || '' });
      } catch(e) { toast.error('Failed to load branding'); }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const set = (k, v) => setBranding(b => ({ ...b, [k]: v }));

  const applyPreset = (preset) => {
    setBranding(b => ({ ...b, primaryColor: preset.sage, primaryDark: preset.sage2, accentColor: preset.accent, textColor: preset.text, bgColor: preset.bg }));
    toast.success(`Theme "${preset.name}" applied`);
  };

  const applyToDOM = (b) => {
    const root = document.documentElement;
    root.style.setProperty('--color-sage',    b.primaryColor);
    root.style.setProperty('--color-sage2',   b.primaryDark);
    root.style.setProperty('--color-accent',  b.accentColor);
    root.style.setProperty('--color-bg',      b.bgColor);
    root.style.setProperty('--color-text',    b.textColor);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const payload = { ...branding, tenantId, updatedAt: serverTimestamp() };
      await setDoc(doc(db, `merchants/${tenantId}/settings`, 'branding'), payload);
      // Update tenant doc display name if changed
      if (branding.companyDisplayName) {
        await setDoc(doc(db, 'merchants', tenantId), { displayName: branding.companyDisplayName }, { merge: true });
        setTenant({ ...tenant, displayName: branding.companyDisplayName });
      }
      applyToDOM(branding);
      toast.success('Branding saved & applied!');
    } catch(e) { toast.error('Save failed'); }
    setSaving(false);
  };

  const handleLogoUrl = (url) => {
    set('logoUrl', url);
  };

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
          <h1 className="text-2xl font-display font-bold text-text">White-label Branding</h1>
          <p className="text-sm text-muted mt-0.5">Customize your portal's look and feel</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? (
            <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Saving…</span>
          ) : '💾 Save & Apply Branding'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Settings panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-surface2 p-1 rounded-xl w-fit">
            {[
              { id:'identity', label:'🏢 Identity' },
              { id:'colors',   label:'🎨 Colors'   },
              { id:'contact',  label:'📞 Contact'  },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white shadow text-text' : 'text-muted hover:text-text'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Identity tab */}
          {activeTab === 'identity' && (
            <div className="card p-5 space-y-4">
              <div>
                <label className="label">Display Name (shown in portal)</label>
                <input value={branding.companyDisplayName} onChange={e => set('companyDisplayName', e.target.value)}
                  placeholder={tenant?.name || 'Your Company OHC'}
                  className="input w-full text-lg font-medium"/>
                <p className="text-xs text-muted mt-1">Replaces "OHC Command" in the sidebar header</p>
              </div>
              <div>
                <label className="label">Tagline</label>
                <input value={branding.tagline} onChange={e => set('tagline', e.target.value)}
                  placeholder="Occupational Health Centre" className="input w-full"/>
              </div>
              <div>
                <label className="label">Logo URL</label>
                <input value={branding.logoUrl} onChange={e => handleLogoUrl(e.target.value)}
                  placeholder="https://yourcompany.com/logo.png" className="input w-full font-mono text-sm"/>
                <p className="text-xs text-muted mt-1">Paste a publicly accessible image URL (PNG/SVG recommended, square, min 64×64px)</p>
                {branding.logoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={branding.logoUrl} alt="Logo preview" className="w-12 h-12 rounded-xl object-cover border border-border"
                      onError={e => { e.target.style.display='none'; }}/>
                    <span className="text-xs text-muted">Logo preview</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={branding.showPoweredBy} onChange={e => set('showPoweredBy', e.target.checked)} className="w-4 h-4 accent-sage"/>
                  <span className="text-sm font-medium text-text">Show "Powered by OHC Command" footer</span>
                </label>
              </div>
              {!branding.showPoweredBy && (
                <div>
                  <label className="label">Custom Footer Text</label>
                  <input value={branding.customFooter} onChange={e => set('customFooter', e.target.value)}
                    placeholder="© 2026 Your Company. All rights reserved." className="input w-full"/>
                </div>
              )}
            </div>
          )}

          {/* Colors tab */}
          {activeTab === 'colors' && (
            <div className="card p-5 space-y-5">
              {/* Preset themes */}
              <div>
                <label className="label mb-3">Quick Preset Themes</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_THEMES.map(preset => (
                    <button key={preset.name} onClick={() => applyPreset(preset)}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border hover:border-sage/50 hover:bg-surface2 transition-all group">
                      <div className="flex gap-1">
                        <div className="w-4 h-4 rounded-full" style={{ background: preset.sage }}/>
                        <div className="w-4 h-4 rounded-full" style={{ background: preset.accent }}/>
                        <div className="w-4 h-4 rounded-full" style={{ background: preset.bg, border: '1px solid #e2e8f0' }}/>
                      </div>
                      <span className="text-[10px] text-muted group-hover:text-text">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <label className="label mb-3">Custom Colors</label>
                <div className="grid grid-cols-2 gap-4">
                  <ColorPicker label="Primary (buttons, active nav)" value={branding.primaryColor} onChange={v => set('primaryColor', v)}/>
                  <ColorPicker label="Primary Dark (hover states)"   value={branding.primaryDark}  onChange={v => set('primaryDark', v)}/>
                  <ColorPicker label="Accent (highlights, badges)"   value={branding.accentColor}  onChange={v => set('accentColor', v)}/>
                  <ColorPicker label="Background"                    value={branding.bgColor}       onChange={v => set('bgColor', v)}/>
                  <ColorPicker label="Text Color"                    value={branding.textColor}     onChange={v => set('textColor', v)}/>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                💡 Click <strong>Save & Apply Branding</strong> to see changes reflected across the portal. The preview on the right updates instantly.
              </div>
            </div>
          )}

          {/* Contact tab */}
          {activeTab === 'contact' && (
            <div className="card p-5 space-y-4">
              <div>
                <label className="label">Support Email</label>
                <input value={branding.supportEmail} onChange={e => set('supportEmail', e.target.value)}
                  placeholder="ohc@yourcompany.com" className="input w-full"/>
                <p className="text-xs text-muted mt-1">Shown in help/support sections and PDF report footers</p>
              </div>
              <div>
                <label className="label">Support Phone</label>
                <input value={branding.supportPhone} onChange={e => set('supportPhone', e.target.value)}
                  placeholder="+91 98765 43210" className="input w-full"/>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                These details appear on printed reports (MIS, Annual Health Report, Statutory Forms) in the footer.
              </div>
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Live Preview</h3>
            <span className="text-xs text-muted">Updates as you type</span>
          </div>
          <PreviewPortal branding={branding} />

          {/* Color swatches summary */}
          <div className="card p-4">
            <div className="text-xs font-semibold text-text mb-3">Current Palette</div>
            <div className="space-y-2">
              {[
                { label:'Primary',    val: branding.primaryColor },
                { label:'Dark',       val: branding.primaryDark  },
                { label:'Accent',     val: branding.accentColor  },
                { label:'Background', val: branding.bgColor      },
                { label:'Text',       val: branding.textColor    },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border border-border flex-shrink-0" style={{ background: s.val }}/>
                  <span className="text-xs text-muted w-20">{s.label}</span>
                  <span className="text-xs font-mono text-text">{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
