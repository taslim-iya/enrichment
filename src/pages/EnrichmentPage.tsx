import { useState, useEffect } from 'react';
import { db, type Lead, type EnrichmentLog } from '../lib/db';
import { useSettingsStore } from '../lib/store';
import { Zap, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function EnrichmentPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<EnrichmentLog[]>([]);
  const { apiKeys } = useSettingsStore();

  useEffect(() => {
    Promise.all([
      db.leads.toArray(),
      db.enrichment_log.orderBy('created_at').reverse().limit(50).toArray(),
    ]).then(([l, lg]) => {
      setLeads(l);
      setLogs(lg);
    });
  }, []);

  const enrichedCount = leads.filter((l) => l.enrichment_completeness && l.enrichment_completeness > 0).length;
  const avgScore = leads.filter((l) => l.quality_score != null).length > 0
    ? Math.round(leads.reduce((acc, l) => acc + (l.quality_score ?? 0), 0) / leads.filter((l) => l.quality_score != null).length)
    : 0;
  const successLogs = logs.filter((l) => l.success).length;
  const failLogs = logs.filter((l) => !l.success).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0A2540' }}>Enrichment Engine</h1>
          <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>AI-powered lead enrichment and scoring</p>
        </div>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#635BFF', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          disabled={!apiKeys.openai && !apiKeys.anthropic}
        >
          <Zap size={16} /> Run Enrichment
        </button>
      </div>

      {/* API Key warning */}
      {!apiKeys.openai && !apiKeys.anthropic && (
        <div style={{ background: '#FFFBEB', border: '1px solid #f59e0b', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>API Keys Required</p>
            <p style={{ fontSize: 13, color: '#78350f' }}>Add your OpenAI or Anthropic API key in Settings to enable enrichment.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Leads', value: leads.length, borderColor: '#635BFF' },
          { label: 'Enriched', value: enrichedCount, borderColor: '#059669' },
          { label: 'Avg Score', value: avgScore || '—', borderColor: '#3b82f6' },
          { label: 'Log Entries', value: logs.length, borderColor: '#8898aa' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', border: '1px solid #E3E8EE', borderLeft: `3px solid ${stat.borderColor}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#0A2540', marginTop: 4 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Top leads needing enrichment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', marginBottom: 12 }}>Needs Enrichment</h2>
          <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {leads.filter((l) => !l.enrichment_completeness || l.enrichment_completeness < 30).slice(0, 10).length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8898aa' }}>
                <CheckCircle size={28} style={{ marginBottom: 8, color: '#059669' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: '#425466' }}>All leads enriched!</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F6F9FC' }}>
                    {['Company', 'Completeness', ''].map((col) => (
                      <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E3E8EE' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.filter((l) => !l.enrichment_completeness || l.enrichment_completeness < 30).slice(0, 10).map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #E3E8EE' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F6F9FC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                    >
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#0A2540' }}>{lead.company_name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: '#E3E8EE', borderRadius: 3 }}>
                            <div style={{ width: `${lead.enrichment_completeness ?? 0}%`, height: '100%', background: '#635BFF', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#8898aa', fontWeight: 600, minWidth: 30 }}>{lead.enrichment_completeness ?? 0}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button style={{ background: 'none', border: '1px solid #635BFF', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#635BFF', cursor: 'pointer', fontWeight: 600 }}>
                          Enrich
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Enrichment Log */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', marginBottom: 12 }}>Recent Activity</h2>
          <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {logs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8898aa' }}>
                <Clock size={28} style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: '#425466' }}>No activity yet</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Enrichment logs will appear here.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {logs.map((log) => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: '1px solid #F6F9FC' }}>
                    {log.success
                      ? <CheckCircle size={16} style={{ color: '#059669', marginTop: 1, flexShrink: 0 }} />
                      : <XCircle size={16} style={{ color: '#E25950', marginTop: 1, flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>{log.source}</p>
                      <p style={{ fontSize: 12, color: '#8898aa' }}>
                        {log.entity_type} #{log.entity_id}
                        {log.duration_ms ? ` · ${log.duration_ms}ms` : ''}
                      </p>
                      {log.error && <p style={{ fontSize: 12, color: '#E25950', marginTop: 2 }}>{log.error}</p>}
                    </div>
                    <span style={{ fontSize: 11, color: '#8898aa', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
