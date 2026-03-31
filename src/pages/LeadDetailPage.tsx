import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Building2, Mail, Phone, ExternalLink, Search, Loader2, Newspaper, Users, TrendingUp, Sparkles } from 'lucide-react';
import { db, type Company } from '../lib/db';
import { useSettingsStore } from '../lib/store';

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

function ContactsTable({ rows, showLinkedIn = false, companyId, companyName, companyDomain, isDirector, onRefresh }: {
  rows: ContactRow[]; showLinkedIn?: boolean; companyId?: number; companyName?: string; companyDomain?: string; isDirector?: boolean; onRefresh?: () => void;
}) {
  const [enrichingIdx, setEnrichingIdx] = useState<number | null>(null);
  const { apolloKey } = useSettingsStore();

  const enrichPerson = async (row: ContactRow, idx: number) => {
    if (!row.name) return;
    setEnrichingIdx(idx);
    try {
      const key = apolloKey || 'p_k86JQdDzCm5G3aZqH6zg';
      // Try Apollo people search by name + domain
      const domain = companyDomain?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') || '';
      const params = new URLSearchParams({ api_key: key });
      if (row.name) {
        const parts = row.name.trim().split(/\s+/);
        if (parts.length >= 2) { params.set('first_name', parts[0]); params.set('last_name', parts.slice(1).join(' ')); }
        else { params.set('first_name', parts[0]); }
      }
      if (domain) params.set('organization_domain', domain);
      if (companyName) params.set('organization_name', companyName);

      const resp = await fetch(`https://api.apollo.io/api/v1/people/match?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        const person = data.person || data;
        const enriched: Partial<ContactRow> = {};
        if (person.email) enriched.email = person.email;
        if (person.phone_numbers?.[0]?.sanitized_number) enriched.phone = person.phone_numbers[0].sanitized_number;
        if (person.linkedin_url) enriched.linkedin_url = person.linkedin_url;
        if (person.title) enriched.title = person.title;

        if (companyId && Object.keys(enriched).length > 0) {
          const company = await db.companies.get(companyId);
          if (company) {
            const arr = isDirector ? [...(company.directors || [])] : [...(company.contacts || [])];
            if (arr[idx]) {
              arr[idx] = { ...arr[idx], ...enriched };
              const update = isDirector ? { directors: arr } : { contacts: arr };
              await db.companies.update(companyId, update);
              onRefresh?.();
            }
          }
        }
      }
    } catch (e) { console.error('Enrich error:', e); }
    setEnrichingIdx(null);
  };

  if (!rows.length) return <div style={{ fontSize: 14, color: S.textMuted }}>No records.</div>;

  const thStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: S.textMuted, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${S.border}` };
  const tdStyle = { padding: '10px 12px', fontSize: 13, borderBottom: `1px solid ${S.border}` };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: S.bg }}>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Phone</th>
            <th style={thStyle}>LinkedIn</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const bb = i === rows.length - 1 ? 'none' : `1px solid ${S.border}`;
            const hasContact = r.email || r.phone || r.linkedin_url;
            return (
              <tr key={i}>
                <td style={{ ...tdStyle, fontWeight: 600, color: S.textPrimary, borderBottom: bb }}>{r.name || '—'}</td>
                <td style={{ ...tdStyle, color: S.textSecondary, borderBottom: bb }}>{r.title || '—'}</td>
                <td style={{ ...tdStyle, borderBottom: bb }}>
                  {r.email ? <a href={`mailto:${r.email}`} style={{ color: S.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={12} /> {r.email}</a> : <span style={{ color: S.textMuted }}>—</span>}
                </td>
                <td style={{ ...tdStyle, borderBottom: bb }}>
                  {r.phone ? <a href={`tel:${r.phone}`} style={{ color: S.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {r.phone}</a> : <span style={{ color: S.textMuted }}>—</span>}
                </td>
                <td style={{ ...tdStyle, borderBottom: bb }}>
                  {r.linkedin_url ? <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0A66C2', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ExternalLink size={12} /> LinkedIn</a> : <span style={{ color: S.textMuted }}>—</span>}
                </td>
                <td style={{ ...tdStyle, borderBottom: bb }}>
                  <button
                    disabled={enrichingIdx === i}
                    onClick={() => enrichPerson(r, i)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: hasContact ? '#EEF2FF' : S.primary,
                      color: hasContact ? S.primary : '#fff',
                      border: hasContact ? `1px solid ${S.primary}33` : 'none',
                      borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600,
                      cursor: enrichingIdx === i ? 'wait' : 'pointer', opacity: enrichingIdx === i ? 0.6 : 1,
                    }}
                  >
                    {enrichingIdx === i ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Enriching...</> : <><Search size={12} /> {hasContact ? 'Re-enrich' : 'Enrich'}</>}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Company Intelligence ─────────────────────────────────────────────────────

interface InsightSection {
  title: string;
  icon: React.ReactNode;
  key: string;
  prompt: string;
}

function CompanyIntelligence({ company, onUpdate }: { company: Company; onUpdate: () => void }) {
  const { openaiKey } = useSettingsStore();
  const [insights, setInsights] = useState<Record<string, string>>(() => {
    // Load cached insights from company object
    const cached = (company as any).__insights;
    return cached && typeof cached === 'object' ? cached : {};
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [personQuery, setPersonQuery] = useState('');
  const [personResult, setPersonResult] = useState<string | null>(null);
  const [personLoading, setPersonLoading] = useState(false);

  const apiKey = openaiKey || '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';

  const companyCtx = `Company: ${company.company_name || ''}\nIndustry: ${company.industry || ''}\nGeography: ${company.geography || ''}\nWebsite: ${company.website || ''}\nDescription: ${company.description || ''}\nEmployees: ${company.employees || ''}\nRevenue: ${company.revenue || ''}\nYear Inc: ${company.year_incorporated || ''}`;

  const sections: InsightSection[] = [
    {
      title: 'Company News & Events',
      icon: <Newspaper size={16} />,
      key: 'news',
      prompt: `Search your knowledge for the latest news, press releases, events, mergers, acquisitions, funding rounds, partnerships, and significant developments for this company. Include dates where possible. If you can't find specific recent news, provide the most recent known developments and general industry news that would affect them.\n\n${companyCtx}\n\nProvide 5-10 bullet points of news/events, each on its own line starting with a dash. Include approximate dates. Be specific and factual.`,
    },
    {
      title: 'Company Culture & Values',
      icon: <Users size={16} />,
      key: 'culture',
      prompt: `Research this company's culture, values, work environment, and reputation. Include: employee reviews sentiment, company values/mission, work-life balance reputation, diversity initiatives, notable awards or certifications, Glassdoor-type insights, and any public controversies.\n\n${companyCtx}\n\nProvide detailed bullet points about their culture and work environment. Be specific.`,
    },
    {
      title: 'Market Position & Competitors',
      icon: <TrendingUp size={16} />,
      key: 'market',
      prompt: `Analyse this company's market position, competitive landscape, market share, key competitors, strengths/weaknesses, and industry trends affecting them. Include specific competitor names and how they compare.\n\n${companyCtx}\n\nProvide detailed analysis in bullet points.`,
    },
    {
      title: 'Technology & Digital Presence',
      icon: <Globe size={16} />,
      key: 'tech',
      prompt: `Research this company's technology stack, digital presence, website quality, social media activity, tech blog/content, job postings for tech roles, and overall digital maturity. What technologies do they likely use? What does their online presence tell us about them?\n\n${companyCtx}\n\nProvide detailed bullet points about their tech and digital presence.`,
    },
    {
      title: 'Sales Intelligence & Talking Points',
      icon: <Sparkles size={16} />,
      key: 'sales',
      prompt: `As a B2B sales intelligence analyst, create actionable talking points for approaching this company. Include: potential pain points based on their industry/size, likely budget indicators, best approach angle, decision-making structure insights, potential objections and rebuttals, and personalised conversation openers.\n\n${companyCtx}\n\nProvide 8-10 specific, actionable talking points for a sales call.`,
    },
  ];

  const runInsight = async (section: InsightSection) => {
    setLoading(section.key);
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a B2B intelligence analyst. Provide detailed, specific, actionable insights. Never say you cannot access the internet — use your training knowledge. Be direct and factual.' },
            { role: 'user', content: section.prompt },
          ],
          max_tokens: 1000,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || 'No insights found.';
        const updated = { ...insights, [section.key]: text };
        setInsights(updated);
        // Cache on company
        if (company.id) {
          await db.companies.update(company.id, { __insights: updated } as any);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(null);
  };

  const runAllInsights = async () => {
    for (const section of sections) {
      await runInsight(section);
    }
  };

  // Person research
  const researchPerson = async () => {
    if (!personQuery.trim()) return;
    setPersonLoading(true);
    setPersonResult(null);
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a B2B intelligence analyst specialising in people research. Provide detailed professional profiles based on your knowledge.' },
            { role: 'user', content: `Research this person who works at ${company.company_name} (${company.industry || 'unknown industry'}, ${company.geography || ''}):\n\nName: ${personQuery}\n\nProvide everything you can find or infer:\n- Professional background and career history\n- LinkedIn profile summary\n- Role and responsibilities\n- Social media presence (LinkedIn, Twitter/X, Facebook if public)\n- Published articles, speaking engagements, or public appearances\n- Education background\n- Interests and connections relevant to B2B outreach\n- Best approach for reaching out to this person\n- Conversation starters based on their background\n\nBe specific. If you're uncertain about details, say so but still provide your best analysis.` },
          ],
          max_tokens: 1200,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setPersonResult(data.choices?.[0]?.message?.content || 'No results found.');
      }
    } catch (e) { console.error(e); }
    setPersonLoading(false);
  };

  const cardStyle: React.CSSProperties = { background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20, marginBottom: 12 };

  return (
    <Card title="Intelligence & Research">
      {/* Run All button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={runAllInsights} disabled={loading !== null}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: S.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          <Search size={14} /> Research All Sections
        </button>
      </div>

      {/* Insight sections */}
      {sections.map(section => (
        <div key={section.key} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: insights[section.key] ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: S.primary }}>{section.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: S.textPrimary }}>{section.title}</span>
            </div>
            <button onClick={() => runInsight(section)} disabled={loading !== null}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, border: `1px solid ${S.border}`, background: insights[section.key] ? '#EEF2FF' : S.bg, color: insights[section.key] ? S.primary : S.textSecondary, fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
              {loading === section.key ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Researching...</> : insights[section.key] ? <><Search size={12} /> Refresh</> : <><Search size={12} /> Research</>}
            </button>
          </div>
          {insights[section.key] && (
            <div style={{ fontSize: 13, lineHeight: 1.7, color: S.textSecondary, whiteSpace: 'pre-wrap', borderTop: `1px solid ${S.border}`, paddingTop: 12 }}>
              {insights[section.key]}
            </div>
          )}
        </div>
      ))}

      {/* Person Research */}
      <div style={{ ...cardStyle, background: '#FAFBFE' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ color: '#7C3AED' }}><Users size={16} /></span>
          <span style={{ fontWeight: 700, fontSize: 14, color: S.textPrimary }}>Person Research</span>
        </div>
        <p style={{ fontSize: 13, color: S.textMuted, margin: '0 0 12px' }}>
          Search for a director or contact — finds their LinkedIn, social media, background, and best outreach approach.
        </p>

        {/* Quick buttons for directors */}
        {company.directors && (company.directors as any[]).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {(company.directors as { name: string }[]).map((d, i) => (
              <button key={i} onClick={() => { setPersonQuery(d.name); setPersonResult(null); }}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${S.border}`, background: personQuery === d.name ? '#EEF2FF' : '#fff', color: personQuery === d.name ? S.primary : S.textSecondary, fontSize: 12, cursor: 'pointer' }}>
                {d.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={personQuery}
            onChange={e => setPersonQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && researchPerson()}
            placeholder="Enter person's name..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={researchPerson} disabled={personLoading || !personQuery.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 13, fontWeight: 600, cursor: personLoading ? 'wait' : 'pointer', opacity: personLoading ? 0.7 : 1 }}>
            {personLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Searching...</> : <><Search size={14} /> Research</>}
          </button>
        </div>

        {personResult && (
          <div style={{ marginTop: 16, padding: 16, background: '#fff', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 13, lineHeight: 1.7, color: S.textSecondary, whiteSpace: 'pre-wrap' }}>
            {personResult}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [notes, setNotes]     = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const loadCompany = useCallback(() => {
    if (!id) return;
    db.companies.get(Number(id)).then(c => {
      setCompany(c ?? null);
      setNotes(String(c?.notes || ''));
    });
  }, [id]);

  useEffect(() => { loadCompany(); }, [loadCompany]);

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
  const directors = Array.isArray(company.directors) ? company.directors as { name: string; title: string; email?: string; phone?: string; linkedin_url?: string }[] : [];
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
      <Card title={`Directors (${directorRows.length})`}>
        {directorRows.length > 0 ? (
          <ContactsTable rows={directorRows} showLinkedIn={true} companyId={company.id} companyName={company.company_name} companyDomain={company.website} isDirector onRefresh={loadCompany} />
        ) : (
          <div style={{ fontSize: 14, color: S.textMuted, padding: '12px 0' }}>
            No directors found. Re-sync from DealFlow or use Apollo enrichment to find contacts.
          </div>
        )}
      </Card>

      {/* ── Contacts card ── */}
      {contacts.length > 0 && (
        <Card title="Contacts">
          <ContactsTable rows={contacts} showLinkedIn={true} companyId={company.id} companyName={company.company_name} companyDomain={company.website} isDirector={false} onRefresh={loadCompany} />
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
      {/* ── Intelligence / Research ── */}
      <CompanyIntelligence company={company} onUpdate={loadCompany} />

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
