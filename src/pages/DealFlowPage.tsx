import { useSettingsStore } from '../lib/store';
import { ExternalLink, Settings } from 'lucide-react';

export default function DealFlowPage() {
  const { dealflowUrl, setDealflowUrl } = useSettingsStore();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0A2540' }}>DealFlow</h1>
          <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>Your connected deal flow pipeline</p>
        </div>
        <a
          href={dealflowUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#635BFF', color: '#fff', textDecoration: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
        >
          <ExternalLink size={16} /> Open in New Tab
        </a>
      </div>

      {/* URL Config */}
      <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={16} style={{ color: '#8898aa', flexShrink: 0 }} />
          <label style={{ fontSize: 13, fontWeight: 600, color: '#425466', whiteSpace: 'nowrap' }}>DealFlow URL:</label>
          <input
            value={dealflowUrl}
            onChange={(e) => setDealflowUrl(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 13, background: '#F6F9FC', color: '#0A2540' }}
            placeholder="https://dealflowa9.netlify.app"
          />
        </div>
      </div>

      {/* Iframe embed */}
      <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', height: 'calc(100vh - 260px)', minHeight: 500 }}>
        <iframe
          src={dealflowUrl}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="DealFlow"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
