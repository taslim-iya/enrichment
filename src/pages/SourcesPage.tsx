import { useState, useEffect, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { db, type Company } from '../lib/db';

const STRIPE = {
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  success: '#059669',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
  bg: '#F6F9FC',
};

const PALETTE = ['#635BFF', '#059669', '#E25950', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function BarChart({ data, label }: { data: [string, number][]; label: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(([, v]) => v));

  return (
    <div style={{
      background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
      borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 20 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.slice(0, 15).map(([key, count], i) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 120, fontSize: 12, color: STRIPE.textSecondary,
              textAlign: 'right', flexShrink: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {key}
            </div>
            <div style={{ flex: 1, height: 22, background: '#F0F2F5', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round((count / max) * 100)}%`,
                background: PALETTE[i % PALETTE.length],
                borderRadius: 4,
                transition: 'width 0.5s ease',
                display: 'flex', alignItems: 'center', paddingLeft: 8,
                minWidth: count > 0 ? 30 : 0,
              }}>
                <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                  {count > 0 ? count.toLocaleString() : ''}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: STRIPE.textMuted, flexShrink: 0, width: 50 }}>
              {count.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SourcesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    db.companies.toArray().then(setCompanies);
  }, []);

  const byIndustry = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of companies) {
      const k = c.industry || 'Unknown';
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [companies]);

  const byGeo = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of companies) {
      const k = c.geography || c.state || 'Unknown';
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [companies]);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of companies) {
      const k = c.status || 'Unknown';
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [companies]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: STRIPE.textPrimary }}>Sources & Analytics</h1>
        <span style={{ background: '#EEF2FF', color: '#635BFF', padding: '2px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
          {companies.length.toLocaleString()} companies
        </span>
      </div>

      {companies.length === 0 ? (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: '60px 40px', textAlign: 'center',
        }}>
          <BarChart3 size={40} color={STRIPE.border} style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 8 }}>No data yet</div>
          <div style={{ fontSize: 14, color: STRIPE.textMuted }}>
            Sync companies from DealFlow to see analytics.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 20 }}>
          <BarChart data={byIndustry} label="Companies by Industry" />
          <BarChart data={byGeo} label="Companies by Geography" />
          <BarChart data={byStatus} label="Companies by Status" />
        </div>
      )}
    </div>
  );
}
