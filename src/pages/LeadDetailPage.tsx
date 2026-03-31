import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, type Lead, type Contact } from '../lib/db';
import { ALL_STATUSES, INDUSTRY_LABELS, formatPhone } from '../lib/constants';
import { ArrowLeft, ExternalLink, Save, Loader2 } from 'lucide-react';

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

const fieldStyle = {
  label: { fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 14, background: '#fff', color: '#0A2540' },
  select: { width: '100%', padding: '9px 12px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 14, background: '#fff', color: '#0A2540', cursor: 'pointer' },
  textarea: { width: '100%', padding: '9px 12px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 14, background: '#fff', color: '#0A2540', resize: 'vertical' as const, minHeight: 100 },
};

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0A2540', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #E3E8EE' }}>
      {children}
    </h3>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'enrichment' | 'notes'>('overview');

  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editIndustry, setEditIndustry] = useState('');

  useEffect(() => {
    if (!id) return;
    const leadId = parseInt(id);
    Promise.all([
      db.leads.get(leadId),
      db.contacts.where('lead_id').equals(leadId).toArray(),
    ]).then(([l, c]) => {
      if (l) {
        setLead(l);
        setEditStatus(l.status);
        setEditNotes(l.human_notes ?? '');
        setEditName(l.contact_name ?? '');
        setEditTitle(l.contact_title ?? '');
        setEditEmail(l.email ?? '');
        setEditPhone(l.mobile_phone ?? l.phone_hq ?? '');
        setEditWebsite(l.website ?? '');
        setEditIndustry(l.industry ?? '');
      }
      setContacts(c);
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    if (!lead?.id) return;
    setSaving(true);
    const now = new Date().toISOString();
    await db.leads.update(lead.id, {
      status: editStatus,
      human_notes: editNotes,
      contact_name: editName,
      contact_title: editTitle,
      email: editEmail,
      mobile_phone: editPhone,
      website: editWebsite,
      industry: editIndustry,
      updated_at: now,
    });
    setLead((prev) => prev ? { ...prev, status: editStatus, human_notes: editNotes, contact_name: editName, contact_title: editTitle, email: editEmail, mobile_phone: editPhone, website: editWebsite, industry: editIndustry, updated_at: now } : prev);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#8898aa' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: '#8898aa' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#425466' }}>Lead not found</p>
        <button onClick={() => navigate('/leads')} style={{ marginTop: 16, background: '#635BFF', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Back to Leads
        </button>
      </div>
    );
  }

  const statusStyle = STATUS_BADGE[lead.status] ?? { bg: '#F6F9FC', color: '#425466' };
  const score = lead.quality_score;
  const scoreColor = score == null ? '#8898aa' : score >= 70 ? '#059669' : score >= 40 ? '#f59e0b' : '#E25950';

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'contacts', label: `Contacts (${contacts.length})` },
    { key: 'enrichment', label: 'Enrichment' },
    { key: 'notes', label: 'Notes' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => navigate('/leads')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#8898aa', fontSize: 13, padding: '6px 0' }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0A2540' }}>{lead.company_name}</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: statusStyle.bg, color: statusStyle.color }}>
              {lead.status}
            </span>
            {score != null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>Score: {score}</span>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>
            {[lead.city, lead.state].filter(Boolean).join(', ')}
            {lead.industry ? ` · ${INDUSTRY_LABELS[lead.industry] ?? lead.industry}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {lead.website && (
            <a
              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#425466', textDecoration: 'none', background: '#fff' }}
            >
              <ExternalLink size={14} /> Website
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: saved ? '#059669' : '#635BFF', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {saving ? <Loader2 size={14} /> : <Save size={14} />}
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E3E8EE', marginBottom: 24 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #635BFF' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#635BFF' : '#425466',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <SectionTitle>Contact Information</SectionTitle>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={fieldStyle.label}>Contact Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} style={fieldStyle.input} placeholder="Full name" />
              </div>
              <div>
                <label style={fieldStyle.label}>Title</label>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={fieldStyle.input} placeholder="Job title" />
              </div>
              <div>
                <label style={fieldStyle.label}>Email</label>
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={fieldStyle.input} placeholder="email@company.com" type="email" />
              </div>
              <div>
                <label style={fieldStyle.label}>Phone</label>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={fieldStyle.input} placeholder="(555) 555-5555" />
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>Company Information</SectionTitle>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={fieldStyle.label}>Website</label>
                <input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} style={fieldStyle.input} placeholder="https://company.com" />
              </div>
              <div>
                <label style={fieldStyle.label}>Industry</label>
                <select value={editIndustry} onChange={(e) => setEditIndustry(e.target.value)} style={fieldStyle.select}>
                  <option value="">Select industry...</option>
                  {Object.entries(INDUSTRY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={fieldStyle.label}>Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={fieldStyle.select}>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={fieldStyle.label}>City</label>
                  <input value={lead.city ?? ''} readOnly style={{ ...fieldStyle.input, background: '#F6F9FC', color: '#425466' }} />
                </div>
                <div>
                  <label style={fieldStyle.label}>State</label>
                  <input value={lead.state ?? ''} readOnly style={{ ...fieldStyle.input, background: '#F6F9FC', color: '#425466' }} />
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ gridColumn: '1 / -1' }}>
            <SectionTitle>Notes</SectionTitle>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              style={fieldStyle.textarea}
              placeholder="Add notes about this lead..."
            />
          </Card>
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div>
          {contacts.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#425466' }}>No contacts yet</p>
              <p style={{ fontSize: 13, color: '#8898aa', marginTop: 4 }}>Enrich this lead to find contacts.</p>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {contacts.map((c) => (
                <Card key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#0A2540' }}>{c.name}</p>
                      {c.title && <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>{c.title}</p>}
                    </div>
                    {c.verified && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 12 }}>Verified</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                    {c.email && <span style={{ fontSize: 13, color: '#635BFF' }}>✉ {c.email}</span>}
                    {c.phone && <span style={{ fontSize: 13, color: '#425466' }}>📞 {formatPhone(c.phone)}</span>}
                    {c.linkedin_url && (
                      <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#0A66C2', textDecoration: 'none' }}>in LinkedIn</a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enrichment Tab */}
      {activeTab === 'enrichment' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <SectionTitle>Enrichment Data</SectionTitle>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { label: 'Employee Count', value: lead.employee_count },
                { label: 'Founded Year', value: lead.founded_year?.toString() },
                { label: 'Enrichment Completeness', value: lead.enrichment_completeness != null ? `${lead.enrichment_completeness}%` : null },
                { label: 'Data Sources', value: lead.data_sources_hit },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #F6F9FC' }}>
                  <span style={{ fontSize: 13, color: '#8898aa' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>{value ?? '—'}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <SectionTitle>Recent News</SectionTitle>
            {!lead.recent_news?.length ? (
              <p style={{ fontSize: 13, color: '#8898aa' }}>No recent news found.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {lead.recent_news.map((n, i) => (
                  <div key={i} style={{ paddingBottom: 10, borderBottom: '1px solid #F6F9FC' }}>
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#635BFF', textDecoration: 'none', fontWeight: 500 }}>
                        {n.title}
                      </a>
                    ) : (
                      <p style={{ fontSize: 13, color: '#0A2540' }}>{n.title}</p>
                    )}
                    {n.date && <p style={{ fontSize: 11, color: '#8898aa', marginTop: 2 }}>{n.date}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
          {lead.hiring_signals && (
            <Card style={{ gridColumn: '1 / -1' }}>
              <SectionTitle>Hiring Signals</SectionTitle>
              <p style={{ fontSize: 13, color: '#425466', lineHeight: 1.6 }}>{lead.hiring_signals}</p>
            </Card>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <Card>
            <SectionTitle>Your Notes</SectionTitle>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              style={{ ...fieldStyle.textarea, minHeight: 160 }}
              placeholder="Add your notes about this lead..."
            />
          </Card>
          {lead.agent_notes && (
            <Card>
              <SectionTitle>AI Notes</SectionTitle>
              <p style={{ fontSize: 13, color: '#425466', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{lead.agent_notes}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
