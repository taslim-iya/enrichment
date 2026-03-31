import { useState, useEffect } from 'react';
import { db, type Lead } from '../lib/db';
import { BarChart2 } from 'lucide-react';

export default function SourcesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    db.leads.toArray().then(setLeads);
  }, []);

  // Group leads by source
  const sourceCounts: Record<string, number> = {};
  for (const lead of leads) {
    const src = lead.source || 'Unknown';
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
  }
  const sources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...sources.map(([, c]) => c), 1);

  // Group leads by state
  const stateCounts: Record<string, number> = {};
  for (const lead of leads) {
    const st = lead.state || 'Unknown';
    stateCounts[st] = (stateCounts[st] ?? 0) + 1;
  }
  const states = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Group by industry
  const industryCounts: Record<string, number> = {};
  for (const lead of leads) {
    const ind = lead.industry || 'Other';
    industryCounts[ind] = (industryCounts[ind] ?? 0) + 1;
  }
  const industries = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0A2540' }}>Sources</h1>
        <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>Analyze where your leads come from</p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Leads', value: leads.length, borderColor: '#635BFF' },
          { label: 'Unique Sources', value: sources.length, borderColor: '#059669' },
          { label: 'States Covered', value: Object.keys(stateCounts).filter(s => s !== 'Unknown').length, borderColor: '#3b82f6' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', border: '1px solid #E3E8EE', borderLeft: `3px solid ${stat.borderColor}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#0A2540', marginTop: 4 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Lead Sources */}
        <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', marginBottom: 20 }}>By Source</h2>
          {sources.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8898aa' }}>
              <BarChart2 size={28} style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 14 }}>No source data yet</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {sources.map(([src, count]) => (
                <div key={src}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>{src}</span>
                    <span style={{ fontSize: 13, color: '#8898aa' }}>{count} ({Math.round(count / leads.length * 100)}%)</span>
                  </div>
                  <div style={{ height: 6, background: '#E3E8EE', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: '#635BFF', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By State */}
        <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', marginBottom: 20 }}>Top States</h2>
          {states.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8898aa' }}>
              <p style={{ fontSize: 14 }}>No location data yet</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {states.map(([state, count], i) => (
                <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#8898aa', width: 20, textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540', width: 40 }}>{state}</span>
                  <div style={{ flex: 1, height: 6, background: '#E3E8EE', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(count / states[0][1]) * 100}%`, background: '#3b82f6', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#8898aa', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By Industry */}
      <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', marginBottom: 20 }}>By Industry</h2>
        {industries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#8898aa' }}>
            <p style={{ fontSize: 14 }}>No industry data yet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {industries.map(([industry, count]) => (
              <div key={industry} style={{ background: '#F6F9FC', border: '1px solid #E3E8EE', borderRadius: 10, padding: '16px 20px' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>{count}</p>
                <p style={{ fontSize: 12, color: '#8898aa', marginTop: 2, textTransform: 'capitalize' }}>{industry.replace(/_/g, ' ')}</p>
                <p style={{ fontSize: 11, color: '#8898aa', marginTop: 4 }}>{Math.round(count / leads.length * 100)}%</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
