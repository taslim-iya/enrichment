import { useState } from 'react';
import { useSettingsStore } from '../lib/store';
import { Key, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 28, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #E3E8EE' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function ApiKeyField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', padding: '9px 40px 9px 12px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 14, background: '#fff', color: '#0A2540' }}
        />
        <button
          onClick={() => setShow(!show)}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8898aa', display: 'flex', alignItems: 'center' }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {value && (
        <p style={{ fontSize: 11, color: '#059669', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle size={11} /> Key configured
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { apiKeys, setApiKeys, dealflowUrl, setDealflowUrl } = useSettingsStore();
  const [openaiKey, setOpenaiKey] = useState(apiKeys.openai);
  const [anthropicKey, setAnthropicKey] = useState(apiKeys.anthropic);
  const [dfUrl, setDfUrl] = useState(dealflowUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKeys({ openai: openaiKey, anthropic: anthropicKey });
    setDealflowUrl(dfUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0A2540' }}>Settings</h1>
          <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>Configure API keys and preferences</p>
        </div>
        <button
          onClick={handleSave}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: saved ? '#059669' : '#635BFF', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <Section title="AI API Keys" subtitle="Keys are stored locally in your browser only — never sent to any server.">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: '#FFFBEB', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <p style={{ fontSize: 13, color: '#78350f' }}>Your API keys are stored locally using browser storage (IndexedDB + localStorage). They are never transmitted to external servers.</p>
        </div>
        <ApiKeyField label="OpenAI API Key" value={openaiKey} onChange={setOpenaiKey} placeholder="sk-..." />
        <ApiKeyField label="Anthropic API Key" value={anthropicKey} onChange={setAnthropicKey} placeholder="sk-ant-..." />
      </Section>

      <Section title="Integrations" subtitle="Connect external tools and services.">
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>DealFlow URL</label>
          <input
            value={dfUrl}
            onChange={(e) => setDfUrl(e.target.value)}
            placeholder="https://dealflowa9.netlify.app"
            style={{ width: '100%', maxWidth: 480, padding: '9px 12px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 14, background: '#fff', color: '#0A2540' }}
          />
          <p style={{ fontSize: 12, color: '#8898aa', marginTop: 4 }}>The DealFlow app URL shown in the DealFlow page iframe.</p>
        </div>
      </Section>

      <Section title="About" subtitle="Corgi Enrichment v2.0">
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { label: 'Version', value: '2.0.0' },
            { label: 'Storage', value: 'IndexedDB (local)' },
            { label: 'Framework', value: 'React + Vite' },
            { label: 'Database', value: 'Dexie.js' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #F6F9FC' }}>
              <span style={{ fontSize: 13, color: '#8898aa' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>{value}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
