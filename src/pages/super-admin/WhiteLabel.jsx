import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';

const PRESET_THEMES = [
  { id: 'sage',     label: 'OHC Green',    primary: '#52b788', dark: '#2d6a4f', bg: '#f0f4f8', accent: '#74c69d' },
  { id: 'navy',     label: 'Corporate Navy', primary: '#1e3a5f', dark: '#0f2440', bg: '#f0f4f8', accent: '#3b82f6' },
  { id: 'crimson',  label: 'Medical Red',  primary: '#c0392b', dark: '#922b21', bg: '#fdf2f2', accent: '#e74c3c' },
  { id: 'violet',   label: 'Modern Violet',primary: '#7c3aed', dark: '#5b21b6', bg: '#f5f3ff', accent: '#8b5cf6' },
  { id: 'teal',     label: 'Clinical Teal',primary: '#0d9488', dark: '#0f766e', bg: '#f0fdfa', accent: '#14b8a6' },
  { id: 'amber',    label: 'Warm Amber',   primary: '#d97706', dark: '#b45309', bg: '#fffbeb', accent: '#f59e0b' },
];

const FONT_OPTIONS = [
  { id: 'plus-jakarta', label: 'Plus Jakarta Sans', preview: 'Aa' },
  { id: 'inter',        label: 'Inter',              preview: 'Aa' },
  { id: 'poppins',      label: 'Poppins',            preview: 'Aa' },
  { id: 'dm-sans',      label: 'DM Sans',            preview: 'Aa' },
];

const EMPTY_BRAND = {
  appName: '', tagline: '', supportEmail: '', supportPhone: '', website: '',
  primaryColor: '#52b788', darkColor: '#2d6a4f', bgColor: '#f0f4f8', accentColor: '#74c69d',
  fontBody: 'plus-jakarta', fontDisplay: 'plus-jakarta',
  showPoweredBy: true, footerText: '',
  logoUrl: '', faviconUrl: '',
};

function ColorSwatch({ color, label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-white"/>
        </div>
        <input value={value} onChange={e => onChange(e.target.value)}
          className="input flex-1 font-mono text-sm" placeholder="#000000"/>
      </div>
    </div>
  );
}

function BrandPreview({ brand }) {
  const primary = brand.primaryColor || '#52b788';
  const bg = brand.bgColor || '#f0f4f8';
  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-md" style={{ background: bg }}>
      {/* Nav bar */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: primary }}>
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white text-xs font-bold">
          {(brand.appName||'OHC')[0]}
        </div>
        <div>
          <div className="text-white text-sm font-bold">{brand.appName || 'OHC Command'}</div>
          <div className="text-white/70 text-[10px]">{brand.tagline || 'Occupational Health Centre'}</div>
        </div>
      </div>
      {/* Content mockup */}
      <div className="p-4 space-y-2">
        <div className="h-3 rounded" style={{ background: primary, width: '60%', opacity: 0.2 }}/>
        <div className="h-2 rounded bg-gray-200 w-full"/>
        <div className="h-2 rounded bg-gray-200 w-4/5"/>
        <div className="flex gap-2 mt-3">
          <div className="h-8 rounded-lg flex-1 flex items-center justify-center text-white text-xs font-medium" style={{ background: primary }}>
            Button
          </div>
          <div className="h-8 rounded-lg flex-1 border-2 flex items-center justify-center text-xs font-medium" style={{ borderColor: primary, color: primary }}>
            Outline
          </div>
        </div>
      </div>
      {/* Footer */}
      {brand.showPoweredBy && (
        <div className="px-4 py-2 border-t border-gray-200 text-[9px] text-gray-400 text-center">
          {brand.footerText || 'Powered by OHC Command Platform'}
        </div>
      )}
    </div>
  );
}

export default function WhiteLabel() {
  const [tenants, setTenants]   = useState([]);
  const [selTenant, setSelTenant] = useState(null);
  const [brand, setBrand]       = useState(EMPTY_BRAND);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [activeTab, setActiveTab] = useState('brand'); // brand | theme | advanced

  useEffect(() => {
    getDocs(collection(db, 'merchants')).then(snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadBrand = async (tenant) => {
    setSelTenant(tenant);
    try {
      const snap = await getDoc(doc(db, `merchants/${tenant.id}/settings`, 'branding'));
      if (snap.exists()) {
        setBrand({ ...EMPTY_BRAND, ...snap.data() });
      } else {
        setBrand({ ...EMPTY_BRAND, appName: tenant.name || '', supportEmail: tenant.email || '' });
      }
    } catch (e) {
      setBrand({ ...EMPTY_BRAND, appName: tenant.name || '' });
    }
  };

  const set = (k, v) => setBrand(b => ({ ...b, [k]: v }));

  const applyPreset = (preset) => {
    setBrand(b => ({ ...b, primaryColor: preset.primary, darkColor: preset.dark, bgColor: preset.bg, accentColor: preset.accent }));
    toast.success(`Applied ${preset.label} theme`);
  };

  const handleSave = async () => {
    if (!selTenant) return;
    setSaving(true);
    try {
      await setDoc(doc(db, `merchants/${selTenant.id}/settings`, 'branding'), {
        ...brand, tenantId: selTenant.id, updatedAt: serverTimestamp(),
      });
      // Also update tenant doc with appName/colors for portal header
      await updateDoc(doc(db, 'merchants', selTenant.id), {
        brandAppName: brand.appName, brandPrimary: brand.primaryColor,
        brandBg: brand.bgColor, brandAccent: brand.accentColor,
        updatedAt: serverTimestamp(),
      });
      toast.success('Brand settings saved!');
    } catch (e) {
      toast.error('Save failed: ' + e.message);
    }
    setSaving(false);
  };

  const handleReset = () => {
    if (!selTenant) return;
    setBrand({ ...EMPTY_BRAND, appName: selTenant.name || '' });
    toast('Reset to defaults');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-text">White-label Branding</h1>
        <p className="text-muted text-sm mt-0.5">Customise the portal appearance per tenant</p>
      </div>

      {/* Tenant selector */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text mb-3">Select Tenant</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tenants.map(t => (
            <button key={t.id} onClick={() => loadBrand(t)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                selTenant?.id === t.id ? 'border-sage bg-sage/5' : 'border-border hover:border-sage/40 bg-white'
              }`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold mb-2"
                style={{ background: t.brandPrimary || '#52b788' }}>
                {(t.name||'?')[0].toUpperCase()}
              </div>
              <div className="text-sm font-medium text-text truncate">{t.name}</div>
              <div className="text-xs text-muted capitalize">{t.plan || 'basic'}</div>
              {t.brandAppName && <div className="text-[10px] text-sage mt-1 truncate">"{t.brandAppName}"</div>}
            </button>
          ))}
        </div>
      </div>

      {selTenant ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: settings */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-surface2 rounded-xl p-1">
              {[
                { id:'brand',    label:'🏷️ Brand Identity' },
                { id:'theme',    label:'🎨 Color Theme'    },
                { id:'advanced', label:'⚙️ Advanced'       },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === t.id ? 'bg-white shadow text-text' : 'text-muted hover:text-text'
                  }`}>{t.label}</button>
              ))}
            </div>

            {/* Brand tab */}
            {activeTab === 'brand' && (
              <div className="card p-5 space-y-4">
                <div>
                  <label className="label">App / Portal Name</label>
                  <input value={brand.appName} onChange={e => set('appName', e.target.value)}
                    placeholder="e.g. Daimler OHC Portal" className="input w-full text-lg font-medium"/>
                </div>
                <div>
                  <label className="label">Tagline</label>
                  <input value={brand.tagline} onChange={e => set('tagline', e.target.value)}
                    placeholder="e.g. Your Health, Our Priority" className="input w-full"/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Support Email</label>
                    <input value={brand.supportEmail} onChange={e => set('supportEmail', e.target.value)}
                      placeholder="ohc@company.com" className="input w-full"/>
                  </div>
                  <div>
                    <label className="label">Support Phone</label>
                    <input value={brand.supportPhone} onChange={e => set('supportPhone', e.target.value)}
                      placeholder="+91 98765 43210" className="input w-full"/>
                  </div>
                </div>
                <div>
                  <label className="label">Website URL</label>
                  <input value={brand.website} onChange={e => set('website', e.target.value)}
                    placeholder="https://company.com" className="input w-full"/>
                </div>
                <div>
                  <label className="label">Logo URL</label>
                  <input value={brand.logoUrl} onChange={e => set('logoUrl', e.target.value)}
                    placeholder="https://cdn.company.com/logo.png" className="input w-full"/>
                  <div className="text-xs text-muted mt-1">Hosted image URL — recommended 200×50px PNG with transparent background</div>
                </div>
              </div>
            )}

            {/* Theme tab */}
            {activeTab === 'theme' && (
              <div className="card p-5 space-y-5">
                {/* Presets */}
                <div>
                  <label className="label mb-2">Quick Presets</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_THEMES.map(p => (
                      <button key={p.id} onClick={() => applyPreset(p)}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-border hover:border-sage/40 bg-white transition-all">
                        <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: p.primary }}/>
                        <span className="text-xs font-medium text-text">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom colors */}
                <div className="grid grid-cols-2 gap-4">
                  <ColorSwatch label="Primary Color" value={brand.primaryColor} onChange={v => set('primaryColor', v)}/>
                  <ColorSwatch label="Dark Variant"  value={brand.darkColor}    onChange={v => set('darkColor', v)}/>
                  <ColorSwatch label="Background"    value={brand.bgColor}      onChange={v => set('bgColor', v)}/>
                  <ColorSwatch label="Accent"        value={brand.accentColor}  onChange={v => set('accentColor', v)}/>
                </div>

                {/* Font */}
                <div>
                  <label className="label mb-2">Body Font</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_OPTIONS.map(f => (
                      <button key={f.id} onClick={() => set('fontBody', f.id)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          brand.fontBody === f.id ? 'border-sage bg-sage/5' : 'border-border bg-white'
                        }`}>
                        <div className="text-lg font-bold text-text">{f.preview}</div>
                        <div className="text-xs text-muted">{f.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Advanced tab */}
            {activeTab === 'advanced' && (
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between p-3 bg-surface2 rounded-xl">
                  <div>
                    <div className="text-sm font-medium text-text">Show "Powered by OHC Command"</div>
                    <div className="text-xs text-muted">Display platform credit in portal footer</div>
                  </div>
                  <button onClick={() => set('showPoweredBy', !brand.showPoweredBy)}
                    className={`relative w-11 h-6 rounded-full transition-all ${brand.showPoweredBy ? 'bg-sage' : 'bg-border'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${brand.showPoweredBy ? 'left-6' : 'left-1'}`}/>
                  </button>
                </div>
                <div>
                  <label className="label">Custom Footer Text</label>
                  <input value={brand.footerText} onChange={e => set('footerText', e.target.value)}
                    placeholder="e.g. © 2025 Daimler India Commercial Vehicles. Confidential." className="input w-full"/>
                </div>
                <div>
                  <label className="label">Favicon URL</label>
                  <input value={brand.faviconUrl} onChange={e => set('faviconUrl', e.target.value)}
                    placeholder="https://cdn.company.com/favicon.ico" className="input w-full"/>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  <strong>Note:</strong> Color and font changes apply to new sessions. Staff must refresh their browser to see branding updates. Custom domain mapping is available on Enterprise plan.
                </div>
                {/* CSS export */}
                <div>
                  <label className="label">Generated CSS Variables</label>
                  <pre className="bg-surface2 rounded-xl p-3 text-xs font-mono text-muted overflow-x-auto whitespace-pre-wrap">{`:root {
  --color-primary: ${brand.primaryColor};
  --color-primary-dark: ${brand.darkColor};
  --color-bg: ${brand.bgColor};
  --color-accent: ${brand.accentColor};
  --font-body: '${FONT_OPTIONS.find(f=>f.id===brand.fontBody)?.label || 'Plus Jakarta Sans'}';
}`}</pre>
                </div>
              </div>
            )}

            {/* Save / Reset */}
            <div className="flex justify-between">
              <button onClick={handleReset} className="btn-secondary text-sm">Reset to Default</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Saving…</> : '💾 Save Branding'}
              </button>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text mb-3">Live Preview</h3>
              <BrandPreview brand={brand}/>
            </div>

            {/* Brand summary card */}
            <div className="card p-4 text-xs space-y-2">
              <div className="font-semibold text-text mb-2">Brand Summary</div>
              <div className="flex justify-between"><span className="text-muted">Tenant</span><span className="font-medium truncate ml-2">{selTenant.name}</span></div>
              <div className="flex justify-between"><span className="text-muted">App Name</span><span className="font-medium">{brand.appName || '—'}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted">Primary</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded" style={{ background: brand.primaryColor }}/>
                  <span className="font-mono">{brand.primaryColor}</span>
                </div>
              </div>
              <div className="flex justify-between"><span className="text-muted">Font</span><span>{FONT_OPTIONS.find(f=>f.id===brand.fontBody)?.label}</span></div>
              <div className="flex justify-between"><span className="text-muted">Powered by</span><span>{brand.showPoweredBy ? 'Shown' : 'Hidden'}</span></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center text-muted">
          <div className="text-4xl mb-3">🎨</div>
          <div className="font-medium text-text">Select a tenant above to configure their branding</div>
          <div className="text-sm mt-1">Each tenant can have their own app name, colors, logo and footer</div>
        </div>
      )}
    </div>
  );
}
