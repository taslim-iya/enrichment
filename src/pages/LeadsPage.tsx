import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type Lead } from '../lib/db';
import { ALL_STATUSES, INDUSTRY_LABELS, formatPhone } from '../lib/constants';

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  New: { bg: '#E8F5E9', color: '#2E7D32' },
  Contacted: { bg: '#E3F2FD', color: '#1565C0' },
  Booked: { bg: '#E0F2F1', color: '#00695C' },
  Qualified: { bg: '#F3E5F5', color: '#7B1FA2' },
  Won: { bg: '#E0F2F1', color: '#00695C' },
  Lost: { bg: '#FFEBEE', color: '#C62828' },
  'Bad Fit': { bg: '#FFEBEE', color: '#C62828' },
  'Not Interested': { bg: '#FFF3E0', color: '#E65100' },
  'Existing Partner': { bg: '#F3E5F5', color: '#7B1FA2' },
  'Low Interest': { bg: '#FFFDE7', color: '#F57F17' },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_BADGE[status] ?? { bg: '#F6F9FC', color: '#425466' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return <span style={{ color: '#8898aa', fontSize: 13 }}>—</span>;
  const color = score >= 70 ? '#059669' : score >= 40 ? '#f59e0b' : '#E25950';
  const bg = score >= 70 ? '#ECFDF5' : score >= 40 ? '#FFFBEB' : '#FFF1F0';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {score}
    </span>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    db.leads.toArray().then(setLeads);
  }, []);

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      l.company_name?.toLowerCase().includes(q) ||
      l.contact_name?.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q) ||
      l.state?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || l.status === statusFilter;
    const matchIndustry = !industryFilter || l.industry === industryFilter;
    return matchSearch && matchStatus && matchIndustry;
  });

  const total = leads.length;
  const newCount = leads.filter((l) => l.status === 'New').length;
  const contactedCount = leads.filter((l) => l.status === 'Contacted').length;
  const bookedCount = leads.filter((l) => l.status === 'Booked').length;

  const stats = [
    { label: 'Total Leads', value: total, borderColor: '#635BFF' },
    { label: 'New', value: newCount, borderColor: '#059669' },
    { label: 'Contacted', value: contactedCount, borderColor: '#3b82f6' },
    { label: 'Booked', value: bookedCount, borderColor: '#8b5cf6' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0A2540' }}>Leads</h1>
          <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>Manage your lead database</p>
        </div>
        <button
          style={{
            background: '#635BFF',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.background = '#5851db')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.background = '#635BFF')}
        >
          + Add Lead
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: '#fff',
              border: '1px solid #E3E8EE',
              borderLeft: `3px solid ${stat.borderColor}`,
              borderRadius: 12,
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {stat.label}
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#0A2540', marginTop: 4 }}>
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #E3E8EE',
            borderRadius: 8,
            fontSize: 14,
            background: '#fff',
            color: '#0A2540',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            border: '1px solid #E3E8EE',
            borderRadius: 8,
            fontSize: 13,
            background: '#fff',
            color: '#425466',
            cursor: 'pointer',
          }}
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            border: '1px solid #E3E8EE',
            borderRadius: 8,
            fontSize: 13,
            background: '#fff',
            color: '#425466',
            cursor: 'pointer',
          }}
        >
          <option value="">All Industries</option>
          {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <p style={{ fontSize: 13, color: '#8898aa', marginBottom: 12 }}>
        {filtered.length.toLocaleString()} {filtered.length === 1 ? 'lead' : 'leads'}
        {search || statusFilter || industryFilter ? ' (filtered)' : ''}
      </p>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8898aa' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🐕</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#425466' }}>No leads found</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              {search || statusFilter || industryFilter ? 'Try adjusting your filters.' : 'Import leads or add one manually.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F6F9FC' }}>
                {['Company', 'Contact', 'Location', 'Industry', 'Phone', 'Status', 'Score'].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#8898aa',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      borderBottom: '1px solid #E3E8EE',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  style={{ borderBottom: '1px solid #E3E8EE', cursor: 'pointer' }}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F6F9FC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                >
                  <td style={{ padding: '14px 16px', fontSize: 14, color: '#0A2540', fontWeight: 600 }}>
                    {lead.company_name}
                    {lead.website && (
                      <a
                        href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginLeft: 6, fontSize: 11, color: '#635BFF', textDecoration: 'none' }}
                      >
                        ↗
                      </a>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#425466' }}>
                    <div>{lead.contact_name || '—'}</div>
                    {lead.contact_title && (
                      <div style={{ fontSize: 12, color: '#8898aa' }}>{lead.contact_title}</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#425466' }}>
                    {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#425466' }}>
                    {INDUSTRY_LABELS[lead.industry ?? ''] ?? lead.industry ?? '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#425466', whiteSpace: 'nowrap' }}>
                    {formatPhone(lead.mobile_phone || lead.phone_hq) || '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <StatusBadge status={lead.status} />
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <ScoreBadge score={lead.quality_score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
