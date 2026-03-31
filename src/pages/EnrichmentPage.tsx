import { useState, useEffect } from 'react';
import { Zap, Clock, AlertCircle } from 'lucide-react';
import { db, type EnrichmentLog } from '../lib/db';

const STRIPE = {
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  success: '#059669',
  danger: '#E25950',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
  bg: '#F6F9FC',
};

export default function EnrichmentPage() {
  const [logs, setLogs] = useState<EnrichmentLog[]>([]);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    db.enrichment_log.orderBy('created_at').reverse().limit(20).toArray().then(setLogs);
  }, []);

  const handleEnrich = async () => {
    setEnriching(true);
    // Placeholder — would hit Apollo API or similar
    const companies = await db.companies.toArray();
    const toEnrich = companies.filter(c => !c.email && !c.director_email).slice(0, 5);

    for (const company of toEnrich) {
      await db.enrichment_log.add({
        entity_type: 'company',
        entity_id: company.id!,
        source: 'apollo',
        success: false,
        error: 'Apollo API not configured',
        duration_ms: 0,
        created_at: new Date().toISOString(),
      });
    }

    const updated = await db.enrichment_log.orderBy('created_at').reverse().limit(20).toArray();
    setLogs(updated);
    setEnriching(false);
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: STRIPE.textPrimary }}>Enrichment</h1>
        <button
          onClick={handleEnrich}
          disabled={enriching}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: enriching ? '#E3E8EE' : STRIPE.primary,
            color: enriching ? STRIPE.textMuted : '#fff',
            fontSize: 14, fontWeight: 600, cursor: enriching ? 'not-allowed' : 'pointer',
          }}
        >
          <Zap size={14} />
          {enriching ? 'Enriching…' : 'Enrich Companies'}
        </button>
      </div>

      {/* Info Card */}
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: 24, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Zap size={20} color={STRIPE.primary} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 4 }}>
              Automatic Enrichment
            </div>
            <p style={{ fontSize: 13, color: STRIPE.textMuted, lineHeight: 1.6 }}>
              Enrichment automatically fills in missing contact details, emails, and phone numbers
              for your synced companies using Apollo and other data sources. Configure your Apollo API
              key to activate enrichment.
            </p>
          </div>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: '#FEF3C7', border: '1px solid #FDE68A',
        }}>
          <AlertCircle size={12} color="#92400e" />
          <span style={{ fontSize: 12, color: '#92400e', fontWeight: 500 }}>
            Apollo API key not configured — enrichment is in placeholder mode
          </span>
        </div>
      </div>

      {/* Activity Log */}
      <h2 style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 12 }}>
        Recent Activity
      </h2>

      {logs.length === 0 ? (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: '40px', textAlign: 'center',
        }}>
          <Clock size={32} color={STRIPE.border} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, color: STRIPE.textMuted }}>No enrichment activity yet.</div>
        </div>
      ) : (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {logs.map((log, i) => (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', padding: '12px 20px',
              borderBottom: i < logs.length - 1 ? `1px solid ${STRIPE.border}` : 'none',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4,
                background: log.success ? STRIPE.success : STRIPE.danger,
                marginRight: 12, flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: STRIPE.textPrimary }}>
                  {log.entity_type} #{log.entity_id} — <span style={{ color: STRIPE.textMuted }}>{log.source}</span>
                </div>
                {log.error && (
                  <div style={{ fontSize: 12, color: STRIPE.danger, marginTop: 2 }}>{log.error}</div>
                )}
              </div>
              <div style={{ fontSize: 12, color: STRIPE.textMuted }}>
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
