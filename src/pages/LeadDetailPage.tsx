import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Building2, Mail, Phone, ExternalLink } from 'lucide-react';
import { db, type Company } from '../lib/db';

// ─── Design tokens ────────────────────────────────────────────────────────────

const S = {
  bg:            '#F6F9FC',
  card:          '#FFFFFF',
  border:        '#E3E8EE',
  primary:       '#635BFF',
  textPrimary:   '#0A2540',
  textSecondary: '#425466',
  textMuted:     '#8898aa',
};

// ─── Status / score badges ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  New:                { bg: '#EEF2FF', color: '#635BFF' },
  Contacted:          { bg: '#FEF9C3', color: '#92400e' },
  Booked:             { bg: '#D1FAE5', color: '#065F46' },
  'Bad Fit':          { bg: '#FEE2E2', color: '#991B1B' },
  'Not Interested':   { bg: '#F3F4F6', color: '#6B7280' },
  'Existing Partner': { bg: '#E0F2FE', color: '#0369A1' },
  'Low Interest':     { bg: '#FEF3C7', color: '#92400e' },
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtCurrency(val: unknown): string {
  if (val == null || val === '') return '—';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return '—';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

function fmtNum(val: unknown): string {
  if (val == null || val === '') return '—';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return '—';
  return num.toLocaleString();
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`, borderRadius: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 20, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${S.border}`,
        fontSize: 13, fontWeight: 700, color: S.textPrimary, letterSpacing: '0.01em',
      }}>
        {title}
      </div>
      <div style={{ padding: '18px 20px' }}>
        {children}
      </div>
    </div>
  );
}

function KVRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 14 }}>
      <span style={{ color: S.textMuted, minWidth: 140, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ color: S.textPrimary, wordBreak: 'break-word' }}>{value || <span style={{ color: S.textMuted }}>—</span>}</span>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: '1 1 140px', minWidth: 120,
      background: S.bg, border: `1px solid ${S.border}`, borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: S.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: S.textPrimary }}>{value}</div>
    </div>
  );
}

// ─── Director/contact table ───────────────────────────────────────────────────

interface ContactRow {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
}

function ContactsTable({ rows, showLinkedIn = false }: { rows: ContactRow[]; showLinkedIn?: boolean }) {
  if (!rows.length) return <div style={{ fontSize: 14, color: S.textMuted }}>No records.</div>;

  const tdStyle = { padding: '10px 12px', fontSize: 13, borderBottom: `1px solid ${S.border}` };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: S.bg }}>
            <th style={{ ...tdStyle, fontWeight: 700, color: S.textMuted, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
            <th style={{ ...tdStyle, fontWeight: 700, color: S.textMuted, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</th>
            {showLinkedIn && (
              <>
                <th style={{ ...tdStyle, fontWeight: 700, color: S.textMuted, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                <th style={{ ...tdStyle, fontWeight: 700, color: S.textMuted, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</th>
                <th style={{ ...tdStyle, fontWeight: 700, color: S.textMuted, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>LinkedIn</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ ...tdStyle, fontWeight: 600, color: S.textPrimary, borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${S.border}` }}>
                {r.name || '—'}
              </td>
              <td style={{ ...tdStyle, color: S.textSecondary, borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${S.border}` }}>
                {r.title || '—'}
              </td>
              {showLinkedIn && (
                <>
                  <td style={{ ...tdStyle, borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${S.border}` }}>
                    {r.email ? (
                      <a href={`mailto:${r.email}`} style={{ color: S.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={12} /> {r.email}
                      </a>
                    ) : <span style={{ color: S.textMuted }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${S.border}` }}>
                    {r.phone ? (
                      <a href={`tel:${r.phone}`} style={{ color: S.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={12} /> {r.phone}
                      </a>
                    ) : <span style={{ color: S.textMuted }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${S.border}` }}>
                    {r.linkedin_url ? (
                      <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer"
                        style={{ color: S.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={12} /> LinkedIn
                      </a>
                    ) : <span style={{ color: S.textMuted }}>—</span>}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [notes, setNotes]     = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    db.companies.get(Number(id)).then(c => {
      setCompany(c ?? null);
      setNotes(String(c?.notes || ''));
    });
  }, [id]);

  const saveNotes = async () => {
    if (!company?.id) return;
    await db.companies.update(company.id, { notes });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  if (company === undefined) {
    return <div style={{ textAlign: 'center', padding: '80px', color: S.textMuted }}>Loading…</div>;
  }
  if (company === null) {
    return <div style={{ textAlign: 'center', padding: '80px', color: S.textMuted }}>Company not found.</div>;
  }

  const statusStyle = STATUS_COLORS[company.status || 'New'] || { bg: '#F3F4F6', color: '#6B7280' };
  const tags = Array.isArray(company.tags) ? company.tags as string[] : [];
  const directors = Array.isArray(company.directors) ? company.directors as { name: string; title: string }[] : [];
  const contacts  = Array.isArray(company.contacts)  ? company.contacts  as ContactRow[] : [];

  // Fallback: synthesise a director row from flat fields if directors array is empty
  const directorRows = directors.length > 0
    ? directors
    : (company.director_name || company.director)
      ? [{ name: String(company.director_name || company.director || ''), title: String(company.director_title || company.contact_title || '') }]
      : [];

  return (
    <div style={{ maxWidth: 920, paddingBottom: 40 }}>

      {/* ── Back ── */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 24, background: 'none', border: 'none',
          cursor: 'pointer', color: S.primary, fontSize: 14, fontWeight: 500, padding: 0,
        }}
      >
        <ArrowLeft size={16} /> Companies
      </button>

      {/* ── Title row ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: S.textPrimary, margin: 0 }}>
            {company.company_name}
          </h1>
          {company.timezone && (
            <span style={{
              fontSize: 13, fontWeight: 700, color: S.primary,
              background: '#EEF2FF', borderRadius: 6, padding: '3px 10px',
            }}>
              {company.timezone}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: statusStyle.bg, color: statusStyle.color,
          }}>
            {company.status || 'New'}
          </span>
          {typeof company.score === 'number' && (
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: '#F0FDF4', color: '#15803d',
            }}>
              Score {company.score}
            </span>
          )}
          {typeof company.qualification_score === 'number' && (
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: '#F5F3FF', color: '#7C3AED',
            }}>
              Q. Score {company.qualification_score}
            </span>
          )}
          {tags.map(tag => (
            <span key={tag} style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: '#F3F4F6', color: S.textSecondary,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Overview card ── */}
      <Card title="Overview">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          <KVRow label="Industry"    value={company.industry} />
          <KVRow label="NACE Code"   value={company.nace} />
          <KVRow label="Geography"   value={company.geography || company.state} />
          <KVRow label="Year Inc."   value={company.year_incorporated} />
          <KVRow label="Address"     value={company.address} />
          <KVRow label="Timezone"    value={
            company.timezone
              ? <span style={{ fontWeight: 700, color: S.primary }}>{company.timezone}</span>
              : undefined
          } />
          <KVRow label="Source"      value={company.source} />
          <KVRow label="Website"     value={
            company.website ? (
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: S.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Globe size={12} /> {company.website}
              </a>
            ) : undefined
          } />
        </div>
        {company.description && (
          <div style={{
            marginTop: 12, paddingTop: 14, borderTop: `1px solid ${S.border}`,
            fontSize: 14, color: S.textSecondary, lineHeight: 1.7,
          }}>
            {String(company.description)}
          </div>
        )}
      </Card>

      {/* ── Financials card ── */}
      <Card title="Financials">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MetricBox label="Revenue"        value={fmtCurrency(company.revenue)} />
          <MetricBox label="P/L Before Tax" value={fmtCurrency(company.profit_before_tax ?? company.profit)} />
          <MetricBox label="Total Assets"   value={fmtCurrency(company.total_assets ?? company.assets)} />
          <MetricBox label="Equity"         value={fmtCurrency(company.equity)} />
          <MetricBox label="Employees"      value={fmtNum(company.employees)} />
        </div>
      </Card>

      {/* ── Directors card ── */}
      {directorRows.length > 0 && (
        <Card title="Directors">
          <ContactsTable rows={directorRows} showLinkedIn={false} />
        </Card>
      )}

      {/* ── Contacts card ── */}
      {contacts.length > 0 && (
        <Card title="Contacts">
          <ContactsTable rows={contacts} showLinkedIn={true} />
        </Card>
      )}

      {/* Fallback contact (flat fields, only if no contacts array) */}
      {contacts.length === 0 && (company.contact_email || company.director_email || company.director_phone || company.contact_phone) && (
        <Card title="Contact Details">
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {(company.director_phone || company.contact_phone || company.phone) && (
              <a
                href={`tel:${company.director_phone || company.contact_phone || company.phone}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: S.primary, textDecoration: 'none' }}
              >
                <Phone size={14} /> {String(company.director_phone || company.contact_phone || company.phone)}
              </a>
            )}
            {(company.director_email || company.contact_email || company.email) && (
              <a
                href={`mailto:${company.director_email || company.contact_email || company.email}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: S.primary, textDecoration: 'none' }}
              >
                <Mail size={14} /> {String(company.director_email || company.contact_email || company.email)}
              </a>
            )}
          </div>
        </Card>
      )}

      {/* ── Notes card ── */}
      <Card title="Notes">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes about this company…"
          rows={5}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', fontSize: 14, lineHeight: 1.6,
            border: `1px solid ${S.border}`, borderRadius: 8,
            color: S.textPrimary, background: S.bg,
            resize: 'vertical', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={saveNotes}
            style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: S.primary, color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Save Notes
          </button>
          {notesSaved && (
            <span style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>✓ Saved</span>
          )}
        </div>
      </Card>

      {/* ── Meta ── */}
      <div style={{ fontSize: 12, color: S.textMuted, display: 'flex', gap: 20, marginTop: 4 }}>
        {company.created_at && (
          <span>Created: {new Date(String(company.created_at)).toLocaleDateString()}</span>
        )}
        {company.updated_at && (
          <span>Updated: {new Date(String(company.updated_at)).toLocaleDateString()}</span>
        )}
        {company.dealflow_id && (
          <span>DealFlow ID: {company.dealflow_id}</span>
        )}
      </div>
    </div>
  );
}
