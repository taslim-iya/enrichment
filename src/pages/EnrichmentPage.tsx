import { useState, useEffect } from 'react';
import {
  Zap, Clock, CheckCircle, AlertCircle, Globe, Users,
  Star, Search, ExternalLink, Play, BarChart3,
  Newspaper, Mail, TrendingUp, Building2, Phone, Briefcase,
  DollarSign, MapPin, Share2, Cpu, FileText,
} from 'lucide-react';
import { db, type Company, type EnrichmentLog, deriveTimezone } from '../lib/db';
import { useSettingsStore } from '../lib/store';
import {
  enrichCompanyWebsite,
  enrichEmailDiscovery,
  enrichFunding,
  enrichGoogleBusiness,
  enrichJobPostings,
  enrichLinkedInCompany,
  enrichPhoneValidation,
  enrichSecEdgar,
  enrichSocialSignals,
  enrichTechStack,
  enrichWebResearch,
  type EnrichmentSourceResult,
} from '../lib/enrichmentSources';

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  success: '#059669',
  danger: '#E25950',
  warning: '#d97706',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
  bg: '#F6F9FC',
};

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: S.textMuted }}>{value.toLocaleString()} / {total.toLocaleString()}</span>
        <span style={{ fontSize: 12, color: S.primary, fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: S.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: S.primary,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Result badge ─────────────────────────────────────────────────────────────

function ResultBadge({ text, type }: { text: string; type: 'success' | 'warning' | 'info' }) {
  const colors = {
    success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#065F46' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400e' },
    info: { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730a3' },
  };
  const c = colors[type];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 8,
      background: c.bg, border: `1px solid ${c.border}`,
      fontSize: 12, color: c.text, fontWeight: 500,
    }}>
      {type === 'success' ? <CheckCircle size={12} color={S.success} /> : <AlertCircle size={12} color={S.warning} />}
      {text}
    </div>
  );
}

// ─── Enrichment card ──────────────────────────────────────────────────────────

interface EnrichmentCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  buttonLabel: string;
  running: boolean;
  progress?: { value: number; total: number } | null;
  result?: string | null;
  resultType?: 'success' | 'warning' | 'info';
  warning?: string | null;
  onRun: () => void;
  extra?: React.ReactNode;
}

function EnrichmentCard({
  icon, iconBg, title, description, buttonLabel, running,
  progress, result, resultType = 'success', warning, onRun, extra,
}: EnrichmentCardProps) {
  return (
    <div style={{
      background: S.card,
      border: `1px solid ${S.border}`,
      borderRadius: 12,
      padding: 24,
      marginBottom: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: S.textPrimary, marginBottom: 4 }}>
            {title}
          </div>
          <p style={{ fontSize: 13, color: S.textMuted, lineHeight: 1.6, margin: 0 }}>
            {description}
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: running ? '#E3E8EE' : S.primary,
            color: running ? S.textMuted : '#fff',
            fontSize: 13, fontWeight: 600,
            cursor: running ? 'not-allowed' : 'pointer',
            flexShrink: 0, alignSelf: 'flex-start',
            minWidth: 90,
          }}
        >
          {running
            ? <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #aaa', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Running…</>
            : <><Play size={13} /> {buttonLabel}</>}
        </button>
      </div>

      {progress && <div style={{ marginBottom: 12 }}><ProgressBar value={progress.value} total={progress.total} /></div>}
      {warning && (
        <div style={{ marginBottom: 10 }}>
          <ResultBadge text={warning} type="warning" />
        </div>
      )}
      {result && (
        <div><ResultBadge text={result} type={resultType} /></div>
      )}
      {extra}
    </div>
  );
}

// ─── Missing data analysis ────────────────────────────────────────────────────

interface MissingDataRow {
  field: string;
  missing: number;
  pct: number;
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Batch Enrichment Panel ──────────────────────────────────────────────────

const ENRICHMENT_OPTIONS = [
  { key: 'timezone',      label: 'Timezone',               desc: 'Derive timezone from geography (instant, no API)', icon: '🕐', category: 'Basic' },
  { key: 'missing',       label: 'Missing Data Scan',      desc: 'Find which fields are empty across all companies', icon: '📊', category: 'Basic' },
  { key: 'scoring',       label: 'Lead Scoring',           desc: 'Score all companies 0-100 based on data completeness', icon: '⭐', category: 'Basic' },
  { key: 'apolloPeople',  label: 'Find Contacts (Apollo)', desc: 'Find contact details for companies missing contacts', icon: '👥', category: 'Apollo' },
  { key: 'directors',     label: 'Director Enrichment',    desc: 'Find email/phone/LinkedIn for all directors', icon: '👔', category: 'Apollo' },
  { key: 'apolloCompany', label: 'Company Data (Apollo)',  desc: 'Enrich company info via domain lookup', icon: '🏢', category: 'Apollo' },
  { key: 'news',          label: 'Company News',           desc: 'AI-powered news and events for each company', icon: '📰', category: 'AI' },
  { key: 'linkedin',      label: 'LinkedIn Profiles',      desc: 'Enrich contacts with LinkedIn profile data', icon: '🔗', category: 'AI' },
  { key: 'emailVerify',   label: 'Email Verification',     desc: 'Verify and score email addresses', icon: '✉️', category: 'AI' },
  // ── New AI enrichment sources ──
  { key: 'websiteAnalysis',  label: 'Website Analysis',         desc: 'AI analysis of company website, products, and tech', icon: '🌐', category: 'Intelligence' },
  { key: 'googleBusiness',   label: 'Google Business',          desc: 'Ratings, reviews, address, hours', icon: '🗺️', category: 'Intelligence' },
  { key: 'socialSignals',    label: 'Social Media Presence',    desc: 'Find Twitter, LinkedIn, Facebook, GitHub, Instagram', icon: '📱', category: 'Intelligence' },
  { key: 'techStack',        label: 'Technology Stack',         desc: 'Identify tech stack via AI (Wappalyzer-style)', icon: '⚙️', category: 'Intelligence' },
  { key: 'secEdgar',         label: 'SEC Edgar Filings',        desc: 'Research SEC filings for US public companies', icon: '📋', category: 'Intelligence' },
  { key: 'emailDiscovery',   label: 'Email Pattern Discovery',  desc: 'Find likely email patterns and addresses', icon: '✉️', category: 'Contact' },
  { key: 'phoneValidation',  label: 'Phone Validation',         desc: 'Validate phone numbers with regex + AI', icon: '📞', category: 'Contact' },
  { key: 'jobPostings',      label: 'Job Postings & Hiring',    desc: 'Hiring signals, open roles, growth indicators', icon: '💼', category: 'Contact' },
  { key: 'fundingResearch',  label: 'Funding & Investors',      desc: 'Research funding rounds, VCs, and financial backing', icon: '💰', category: 'Research' },
  { key: 'webResearch',      label: 'Web Research',             desc: 'Deep AI research: news, competitors, opportunities', icon: '🔍', category: 'Research' },
  { key: 'linkedinCompany',  label: 'LinkedIn Company Profile', desc: 'Company LinkedIn page, employee count, recent posts', icon: '🔗', category: 'Research' },
];

function BatchEnrichmentPanel({ onRunTimezone, onRunMissingData, onRunApolloPeople, onRunDirectors, onRunApolloCompany, onRunScoring, onRunNews, onRunLinkedIn, onRunEmailVerify, onRunWebsiteAnalysis, onRunGoogleBusiness, onRunSocialSignals, onRunTechStack, onRunSecEdgar, onRunEmailDiscovery, onRunPhoneValidation, onRunJobPostings, onRunFunding, onRunWebResearch, onRunLinkedInCompany, anyRunning }: {
  onRunTimezone: () => void; onRunMissingData: () => void; onRunApolloPeople: () => void;
  onRunDirectors: () => void; onRunApolloCompany: () => void; onRunScoring: () => void;
  onRunNews: () => void; onRunLinkedIn: () => void; onRunEmailVerify: () => void;
  onRunWebsiteAnalysis: () => void; onRunGoogleBusiness: () => void; onRunSocialSignals: () => void;
  onRunTechStack: () => void; onRunSecEdgar: () => void; onRunEmailDiscovery: () => void;
  onRunPhoneValidation: () => void; onRunJobPostings: () => void; onRunFunding: () => void;
  onRunWebResearch: () => void; onRunLinkedInCompany: () => void;
  anyRunning: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);

  const toggle = (key: string) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === ENRICHMENT_OPTIONS.length) setSelected(new Set());
    else setSelected(new Set(ENRICHMENT_OPTIONS.map(o => o.key)));
  };

  const selectCategory = (cat: string) => {
    const keys = ENRICHMENT_OPTIONS.filter(o => o.category === cat).map(o => o.key);
    const allSelected = keys.every(k => selected.has(k));
    const next = new Set(selected);
    keys.forEach(k => allSelected ? next.delete(k) : next.add(k));
    setSelected(next);
  };

  const runMap: Record<string, () => void> = {
    timezone: onRunTimezone, missing: onRunMissingData, apolloPeople: onRunApolloPeople,
    directors: onRunDirectors, apolloCompany: onRunApolloCompany, scoring: onRunScoring,
    news: onRunNews, linkedin: onRunLinkedIn, emailVerify: onRunEmailVerify,
    websiteAnalysis: onRunWebsiteAnalysis, googleBusiness: onRunGoogleBusiness,
    socialSignals: onRunSocialSignals, techStack: onRunTechStack, secEdgar: onRunSecEdgar,
    emailDiscovery: onRunEmailDiscovery, phoneValidation: onRunPhoneValidation,
    jobPostings: onRunJobPostings, fundingResearch: onRunFunding,
    webResearch: onRunWebResearch, linkedinCompany: onRunLinkedInCompany,
  };

  const runBatch = async () => {
    if (selected.size === 0 || running) return;
    setRunning(true);
    // Run in order: basic first, then apollo, then AI
    const order = [
      'timezone', 'missing', 'scoring',
      'apolloPeople', 'directors', 'apolloCompany',
      'news', 'linkedin', 'emailVerify',
      'websiteAnalysis', 'googleBusiness', 'socialSignals', 'techStack', 'secEdgar',
      'emailDiscovery', 'phoneValidation', 'jobPostings',
      'fundingResearch', 'webResearch', 'linkedinCompany',
    ];
    for (const key of order) {
      if (selected.has(key) && runMap[key]) {
        try { await runMap[key](); } catch { /* continue */ }
      }
    }
    setRunning(false);
  };

  const categories = ['Basic', 'Apollo', 'AI', 'Intelligence', 'Contact', 'Research'];

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: S.textPrimary, margin: 0 }}>Batch Enrichment</h2>
          <p style={{ fontSize: 13, color: S.textMuted, margin: '4px 0 0' }}>Select enrichment types and run them all at once</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={selectAll}
            style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${S.border}`, background: selected.size === ENRICHMENT_OPTIONS.length ? '#EEF2FF' : '#fff', color: selected.size === ENRICHMENT_OPTIONS.length ? S.primary : S.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {selected.size === ENRICHMENT_OPTIONS.length ? 'Deselect All' : 'Select All'}
          </button>
          <button onClick={runBatch} disabled={selected.size === 0 || running || anyRunning}
            style={{ padding: '6px 18px', borderRadius: 6, border: 'none', background: selected.size === 0 || running ? '#E3E8EE' : S.primary, color: selected.size === 0 || running ? S.textMuted : '#fff', fontSize: 12, fontWeight: 700, cursor: selected.size === 0 || running ? 'default' : 'pointer' }}>
            {running ? `Running ${selected.size} enrichments...` : `Run ${selected.size} Selected`}
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {categories.map(cat => {
          const catKeys = ENRICHMENT_OPTIONS.filter(o => o.category === cat).map(o => o.key);
          const allSel = catKeys.every(k => selected.has(k));
          return (
            <button key={cat} onClick={() => selectCategory(cat)}
              style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${allSel ? S.primary : S.border}`, background: allSel ? '#EEF2FF' : '#fff', color: allSel ? S.primary : S.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {cat} ({catKeys.length})
            </button>
          );
        })}
      </div>

      {/* Options grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {ENRICHMENT_OPTIONS.map(opt => {
          const isSelected = selected.has(opt.key);
          return (
            <div key={opt.key} onClick={() => toggle(opt.key)}
              style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${isSelected ? S.primary : S.border}`,
                background: isSelected ? '#F8F7FF' : '#fff',
                transition: 'all 0.15s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={isSelected} readOnly style={{ cursor: 'pointer', accentColor: S.primary }} />
                <span style={{ fontSize: 16 }}>{opt.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary }}>{opt.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: S.textMuted, marginLeft: 'auto', padding: '2px 6px', background: S.bg, borderRadius: 4 }}>{opt.category}</span>
              </div>
              <p style={{ fontSize: 12, color: S.textMuted, margin: '6px 0 0 28px' }}>{opt.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EnrichmentPage() {
  const { apolloApiKey, insightEngineUrl, openaiKey } = useSettingsStore();

  const [logs, setLogs] = useState<EnrichmentLog[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);

  // Per-card state
  const [tzRunning, setTzRunning] = useState(false);
  const [tzResult, setTzResult] = useState<string | null>(null);

  const [missingRunning, setMissingRunning] = useState(false);
  const [missingData, setMissingData] = useState<MissingDataRow[] | null>(null);

  const [apolloPeopleRunning, setApolloPeopleRunning] = useState(false);
  const [apolloPeopleProgress, setApolloPeopleProgress] = useState<{ value: number; total: number } | null>(null);
  const [apolloPeopleResult, setApolloPeopleResult] = useState<string | null>(null);
  const [apolloPeopleWarning, setApolloPeopleWarning] = useState<string | null>(null);

  const [apolloCompanyRunning, setApolloCompanyRunning] = useState(false);
  const [apolloCompanyProgress, setApolloCompanyProgress] = useState<{ value: number; total: number } | null>(null);
  const [apolloCompanyResult, setApolloCompanyResult] = useState<string | null>(null);

  const [aiScoreRunning, setAiScoreRunning] = useState(false);
  const [aiScoreProgress, setAiScoreProgress] = useState<{ value: number; total: number } | null>(null);
  const [aiScoreResult, setAiScoreResult] = useState<string | null>(null);

  // Lead scoring (local)
  const [localScoreRunning, setLocalScoreRunning] = useState(false);
  const [localScoreResult, setLocalScoreResult] = useState<string | null>(null);
  const [scoreDistribution, setScoreDistribution] = useState<{ range: string; count: number }[] | null>(null);

  // News enrichment
  const [newsRunning, setNewsRunning] = useState(false);
  const [newsProgress, setNewsProgress] = useState<{ value: number; total: number } | null>(null);
  const [newsResult, setNewsResult] = useState<string | null>(null);

  // LinkedIn profile enrichment
  const [linkedinRunning, setLinkedinRunning] = useState(false);
  const [linkedinProgress, setLinkedinProgress] = useState<{ value: number; total: number } | null>(null);
  const [linkedinResult, setLinkedinResult] = useState<string | null>(null);
  const [linkedinWarning, setLinkedinWarning] = useState<string | null>(null);

  // Email verification
  const [emailVerifyRunning, setEmailVerifyRunning] = useState(false);
  const [emailVerifyProgress, setEmailVerifyProgress] = useState<{ value: number; total: number } | null>(null);
  const [emailVerifyStats, setEmailVerifyStats] = useState<{ verified: number; suspicious: number; invalid: number } | null>(null);

  useEffect(() => {
    refreshLogs();
    db.companies.count().then(setTotalCompanies);
  }, []);

  async function refreshLogs() {
    const updated = await db.enrichment_log.orderBy('created_at').reverse().limit(30).toArray();
    setLogs(updated);
  }

  async function addLog(entry: Omit<EnrichmentLog, 'id'>) {
    await db.enrichment_log.add(entry);
    refreshLogs();
  }

  // ── Timezone enrichment ───────────────────────────────────────────────────

  async function runTimezoneEnrichment() {
    setTzRunning(true);
    setTzResult(null);
    try {
      const all = await db.companies.toArray();
      const needsTz = all.filter(c => !c.timezone || c.timezone === '');
      let enriched = 0;
      for (const c of needsTz) {
        const tz = deriveTimezone({ geography: c.geography, state: c.state, country: c.country });
        if (tz && c.id != null) {
          await db.companies.update(c.id, { timezone: tz });
          enriched++;
        }
      }
      const msg = `Enriched timezone for ${enriched.toLocaleString()} companies`;
      setTzResult(msg);
      await addLog({
        entity_type: 'batch',
        entity_id: 0,
        source: 'timezone-local',
        success: true,
        fields_updated: 'timezone',
        duration_ms: 0,
        created_at: new Date().toISOString(),
      });
    } finally {
      setTzRunning(false);
    }
  }

  // ── Missing data detection ────────────────────────────────────────────────

  async function runMissingDataScan() {
    setMissingRunning(true);
    setMissingData(null);
    try {
      const all = await db.companies.toArray();
      const total = all.length;
      if (total === 0) { setMissingData([]); return; }

      const fields: (keyof Company)[] = [
        'email', 'website', 'industry', 'geography', 'employees',
        'revenue', 'timezone', 'description', 'contacts', 'director_name',
      ];

      const rows: MissingDataRow[] = fields.map(field => {
        const missing = all.filter(c => {
          const v = c[field];
          if (field === 'contacts') return !v || (Array.isArray(v) && v.length === 0);
          return !v || String(v).trim() === '';
        }).length;
        return { field: String(field), missing, pct: Math.round((missing / total) * 100) };
      });

      rows.sort((a, b) => b.pct - a.pct);
      setMissingData(rows);
    } finally {
      setMissingRunning(false);
    }
  }

  // ── Apollo People Enrichment ──────────────────────────────────────────────

  async function runApolloPeopleEnrichment() {
    if (!apolloApiKey) {
      setApolloPeopleWarning('Apollo API key not configured — go to Settings to add it.');
      return;
    }
    setApolloPeopleRunning(true);
    setApolloPeopleProgress(null);
    setApolloPeopleResult(null);
    setApolloPeopleWarning(null);

    try {
      const all = await db.companies.toArray();
      const needsContacts = all.filter(c => !c.contacts || c.contacts.length === 0);
      const total = Math.min(needsContacts.length, 50); // cap at 50 per run
      setApolloPeopleProgress({ value: 0, total });

      let totalContactsFound = 0;
      let companiesEnriched = 0;

      for (let i = 0; i < total; i++) {
        const company = needsContacts[i];
        try {
          const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': apolloApiKey,
            },
            body: JSON.stringify({
              organization_name: company.company_name,
              page: 1,
              per_page: 3,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const people = (data.people || []) as Record<string, unknown>[];
            if (people.length > 0) {
              const contacts = people.map(p => ({
                name: String(p.name || p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : ''),
                title: String(p.title || ''),
                email: String(p.email || ''),
                phone: String(p.phone_numbers?.[0] || ''),
                linkedin_url: String(p.linkedin_url || ''),
              })).filter(c => c.name);

              if (contacts.length > 0 && company.id != null) {
                await db.companies.update(company.id, { contacts });
                totalContactsFound += contacts.length;
                companiesEnriched++;

                await addLog({
                  entity_type: 'company',
                  entity_id: company.id,
                  source: 'apollo-people',
                  success: true,
                  fields_updated: 'contacts',
                  duration_ms: 0,
                  created_at: new Date().toISOString(),
                });
              }
            }
          }
        } catch {
          // Skip individual failures
        }

        setApolloPeopleProgress({ value: i + 1, total });
        // Rate limit: 1 request per second
        if (i < total - 1) await new Promise(r => setTimeout(r, 1000));
      }

      setApolloPeopleResult(
        `Found ${totalContactsFound.toLocaleString()} contacts across ${companiesEnriched.toLocaleString()} companies`
      );
    } finally {
      setApolloPeopleRunning(false);
    }
  }

  // ── Director Contact Enrichment ──────────────────────────────────────────

  const [directorEnrichRunning, setDirectorEnrichRunning] = useState(false);
  const [directorEnrichProgress, setDirectorEnrichProgress] = useState<{ value: number; total: number } | null>(null);
  const [directorEnrichResult, setDirectorEnrichResult] = useState<string | null>(null);

  async function runDirectorEnrichment() {
    if (!apolloApiKey) { setApolloPeopleWarning('Apollo API key not configured.'); return; }
    setDirectorEnrichRunning(true);
    setDirectorEnrichProgress(null);
    setDirectorEnrichResult(null);
    try {
      const all = await db.companies.toArray();
      // Find companies with directors missing email/phone
      const needsEnrich = all.filter(c =>
        c.directors?.some(d => d.name && (!d.email || !d.phone))
      );
      const total = Math.min(needsEnrich.length, 50);
      setDirectorEnrichProgress({ value: 0, total });
      let directorsEnriched = 0;

      for (let i = 0; i < total; i++) {
        const company = needsEnrich[i];
        const domain = company.website?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') || '';
        const dirs = [...(company.directors || [])];
        let updated = false;

        for (let j = 0; j < dirs.length; j++) {
          const d = dirs[j];
          if (!d.name || (d.email && d.phone)) continue;
          try {
            const params = new URLSearchParams({ api_key: apolloApiKey });
            const parts = d.name.trim().split(/\s+/);
            if (parts.length >= 2) { params.set('first_name', parts[0]); params.set('last_name', parts.slice(1).join(' ')); }
            else params.set('first_name', parts[0]);
            if (domain) params.set('organization_domain', domain);
            if (company.company_name) params.set('organization_name', company.company_name);

            const resp = await fetch(`https://api.apollo.io/api/v1/people/match?${params.toString()}`);
            if (resp.ok) {
              const data = await resp.json();
              const person = data.person || data;
              if (person.email) dirs[j] = { ...dirs[j], email: person.email };
              if (person.phone_numbers?.[0]?.sanitized_number) dirs[j] = { ...dirs[j], phone: person.phone_numbers[0].sanitized_number };
              if (person.linkedin_url) dirs[j] = { ...dirs[j], linkedin_url: person.linkedin_url };
              if (person.title) dirs[j] = { ...dirs[j], title: person.title };
              updated = true;
              directorsEnriched++;
            }
            await new Promise(r => setTimeout(r, 1000)); // rate limit per director
          } catch { /* skip */ }
        }
        if (updated && company.id) await db.companies.update(company.id, { directors: dirs });
        setDirectorEnrichProgress({ value: i + 1, total });
      }
      setDirectorEnrichResult(`Enriched ${directorsEnriched} directors across ${total} companies`);
    } finally { setDirectorEnrichRunning(false); }
  }

  // ── Apollo Company Enrichment ─────────────────────────────────────────────

  async function runApolloCompanyEnrichment() {
    if (!apolloApiKey) {
      setApolloPeopleWarning('Apollo API key not configured — go to Settings to add it.');
      return;
    }
    setApolloCompanyRunning(true);
    setApolloCompanyProgress(null);
    setApolloCompanyResult(null);

    try {
      const all = await db.companies.toArray();
      // Target companies with a website but missing key data
      const toEnrich = all
        .filter(c => c.website && (!c.employees || !c.industry || !c.description))
        .slice(0, 30);

      const total = toEnrich.length;
      setApolloCompanyProgress({ value: 0, total });
      let enrichedCount = 0;

      for (let i = 0; i < total; i++) {
        const company = toEnrich[i];
        try {
          // Clean the domain from website
          let domain = (company.website || '').replace(/https?:\/\//, '').replace(/\/$/, '').split('/')[0];
          if (!domain) { setApolloCompanyProgress({ value: i + 1, total }); continue; }

          const url = new URL('https://api.apollo.io/api/v1/organizations/enrich');
          url.searchParams.set('domain', domain);

          const res = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'X-Api-Key': apolloApiKey },
          });

          if (res.ok) {
            const data = await res.json();
            const org = data.organization as Record<string, unknown> | undefined;
            if (org && company.id != null) {
              const updates: Partial<Company> = {};
              if (!company.employees && org.estimated_num_employees) {
                updates.employees = Number(org.estimated_num_employees);
              }
              if (!company.industry && org.industry) {
                updates.industry = String(org.industry);
              }
              if (!company.description && org.short_description) {
                updates.description = String(org.short_description);
              }
              if (!company.revenue && org.annual_revenue) {
                updates.revenue = Number(org.annual_revenue);
              }

              if (Object.keys(updates).length > 0) {
                await db.companies.update(company.id, updates);
                enrichedCount++;
                await addLog({
                  entity_type: 'company',
                  entity_id: company.id,
                  source: 'apollo-org',
                  success: true,
                  fields_updated: Object.keys(updates).join(','),
                  duration_ms: 0,
                  created_at: new Date().toISOString(),
                });
              }
            }
          }
        } catch {
          // Skip failures
        }

        setApolloCompanyProgress({ value: i + 1, total });
        if (i < total - 1) await new Promise(r => setTimeout(r, 1000));
      }

      setApolloCompanyResult(`Updated data for ${enrichedCount.toLocaleString()} companies`);
    } finally {
      setApolloCompanyRunning(false);
    }
  }

  // ── AI Scoring ────────────────────────────────────────────────────────────

  async function runAiScoring() {
    if (!openaiKey) {
      setAiScoreResult('OpenAI API key not configured — go to Settings.');
      return;
    }
    setAiScoreRunning(true);
    setAiScoreProgress(null);
    setAiScoreResult(null);

    try {
      const all = await db.companies.toArray();
      const toScore = all.filter(c => !c.score || c.score === 0).slice(0, 60);
      const total = toScore.length;
      setAiScoreProgress({ value: 0, total });
      let scored = 0;

      // Batch in groups of 20
      const BATCH = 20;
      for (let b = 0; b < total; b += BATCH) {
        const batch = toScore.slice(b, b + BATCH);
        const prompt =
          `Score each of these B2B companies on a scale of 1-100 based on: revenue size, employee count, data completeness, and overall investment potential. ` +
          `Return ONLY a JSON array of objects with fields "index" (0-based) and "score" (integer 1-100). No explanations.\n\n` +
          batch
            .map((c, i) =>
              `${i}. ${c.company_name} | ${c.industry || 'Unknown industry'} | ${c.geography || 'Unknown location'} | ` +
              `${c.employees || '?'} employees | Revenue: ${c.revenue ? '$' + (Number(c.revenue) / 1e6).toFixed(1) + 'M' : 'unknown'} | ` +
              `Has contacts: ${c.contacts && c.contacts.length > 0 ? 'yes' : 'no'} | Has website: ${c.website ? 'yes' : 'no'}`
            )
            .join('\n');

        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 512,
              temperature: 0.2,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.choices?.[0]?.message?.content || '';
            // Extract JSON from response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const scores = JSON.parse(jsonMatch[0]) as { index: number; score: number }[];
              for (const { index, score } of scores) {
                const company = batch[index];
                if (company?.id != null && score >= 1 && score <= 100) {
                  await db.companies.update(company.id, { score });
                  scored++;
                }
              }
            }
          }
        } catch {
          // Skip failed batch
        }

        setAiScoreProgress({ value: Math.min(b + BATCH, total), total });
        if (b + BATCH < total) await new Promise(r => setTimeout(r, 1200));
      }

      setAiScoreResult(`Scored ${scored.toLocaleString()} companies`);
      await addLog({
        entity_type: 'batch',
        entity_id: 0,
        source: 'ai-scoring',
        success: true,
        fields_updated: 'score',
        duration_ms: 0,
        created_at: new Date().toISOString(),
      });
    } finally {
      setAiScoreRunning(false);
    }
  }

  // ── Local lead scoring ────────────────────────────────────────────────────

  async function runLocalScoring() {
    setLocalScoreRunning(true);
    setLocalScoreResult(null);
    setScoreDistribution(null);
    try {
      const all = await db.companies.toArray();
      let scored = 0;
      for (const c of all) {
        let score = 0;
        // Base points
        const contacts = Array.isArray(c.contacts) ? c.contacts : [];
        const directors = Array.isArray(c.directors) ? c.directors : [];
        const firstContact = contacts[0] as { email?: string; phone?: string; linkedin_url?: string } | undefined;
        const hasEmail = !!(c.email || firstContact?.email);
        const hasPhone = !!(c.phone || c.director_phone || firstContact?.phone);
        const hasLinkedin = !!(firstContact?.linkedin_url);
        if (hasEmail) score += 15;
        if (hasPhone) score += 10;
        if (hasLinkedin) score += 10;
        if (c.website) score += 5;
        if (c.revenue) score += 10;
        if (c.employees) score += 5;
        if (contacts.length > 0) score += 15;
        if (directors.length > 0 || c.director_name || c.director) score += 5;
        if (c.description) score += 5;
        const news = (c as unknown as Record<string, unknown>).news;
        if (news && (Array.isArray(news) ? news.length > 0 : String(news).length > 0)) score += 10;
        // Bonus points
        if (typeof c.revenue === 'number' && c.revenue > 1_000_000) score += 5;
        if (typeof c.employees === 'number' && c.employees > 50) score += 5;
        score = Math.min(100, score);
        if (c.id != null) {
          await db.companies.update(c.id, { score });
          scored++;
        }
      }
      // Compute distribution
      const updated = await db.companies.toArray();
      const ranges = [
        { range: '81–100', min: 81, max: 100 },
        { range: '61–80',  min: 61, max: 80 },
        { range: '41–60',  min: 41, max: 60 },
        { range: '21–40',  min: 21, max: 40 },
        { range: '0–20',   min: 0,  max: 20 },
      ];
      const dist = ranges.map(r => ({
        range: r.range,
        count: updated.filter(c => {
          const s = typeof c.score === 'number' ? c.score : 0;
          return s >= r.min && s <= r.max;
        }).length,
      }));
      setScoreDistribution(dist);
      setLocalScoreResult(`Scored ${scored.toLocaleString()} companies (instant, no API)`);
    } finally {
      setLocalScoreRunning(false);
    }
  }

  // ── News enrichment ───────────────────────────────────────────────────────

  async function runNewsEnrichment() {
    if (!openaiKey) {
      setNewsResult('OpenAI API key not configured — go to Settings.');
      return;
    }
    setNewsRunning(true);
    setNewsProgress(null);
    setNewsResult(null);
    try {
      const all = await db.companies.toArray();
      const toEnrich = all
        .filter(c => !(c as unknown as Record<string, unknown>).news)
        .slice(0, 50);
      const total = toEnrich.length;
      setNewsProgress({ value: 0, total });
      let enriched = 0;

      const BATCH = 10;
      for (let b = 0; b < total; b += BATCH) {
        const batch = toEnrich.slice(b, b + BATCH);
        const prompt =
          `For each company below, provide 2-3 recent relevant news items, events, or notable facts (funding, partnerships, acquisitions, leadership changes, product launches, financial results). ` +
          `Return ONLY a JSON array of objects with "index" (0-based) and "news" (string array of 2-3 items). No explanations.\n\n` +
          batch
            .map((c, i) =>
              `${i}. ${c.company_name} | ${c.industry || 'Unknown'} | ${c.geography || 'Unknown'}`
            )
            .join('\n');

        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 1000,
              temperature: 0.3,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.choices?.[0]?.message?.content || '';
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const results = JSON.parse(jsonMatch[0]) as { index: number; news: string[] }[];
              for (const { index, news } of results) {
                const company = batch[index];
                if (company?.id != null && Array.isArray(news) && news.length > 0) {
                  await db.companies.update(company.id, { news } as unknown as Partial<Company>);
                  enriched++;
                }
              }
            }
          }
        } catch {
          // Skip batch
        }

        setNewsProgress({ value: Math.min(b + BATCH, total), total });
        if (b + BATCH < total) await new Promise(r => setTimeout(r, 1000));
      }

      setNewsResult(`Added news for ${enriched.toLocaleString()} companies`);
      await addLog({
        entity_type: 'batch', entity_id: 0, source: 'news-openai',
        success: true, fields_updated: 'news', duration_ms: 0,
        created_at: new Date().toISOString(),
      });
    } finally {
      setNewsRunning(false);
    }
  }

  // ── LinkedIn profile enrichment ───────────────────────────────────────────

  async function runLinkedinEnrichment() {
    setLinkedinRunning(true);
    setLinkedinProgress(null);
    setLinkedinResult(null);
    setLinkedinWarning(null);
    try {
      const all = await db.companies.toArray();
      const withLinkedin = all.filter(c => {
        const contacts = Array.isArray(c.contacts) ? c.contacts as { linkedin_url?: string }[] : [];
        return contacts.some(ct => ct.linkedin_url);
      });
      const total = Math.min(withLinkedin.length, 30);
      setLinkedinProgress({ value: 0, total });

      if (total === 0) {
        setLinkedinWarning('No contacts with LinkedIn URLs found. Run Apollo People enrichment first.');
        return;
      }

      let enriched = 0;

      for (let i = 0; i < total; i++) {
        const company = withLinkedin[i];
        const contacts = Array.isArray(company.contacts)
          ? company.contacts as { name: string; title: string; email?: string; phone?: string; linkedin_url?: string; headline?: string; location?: string }[]
          : [];

        if (apolloApiKey) {
          // Use Apollo API
          const contactsToEnrich = contacts.filter(ct => ct.linkedin_url);
          const enrichedContacts = [...contacts];

          for (const ct of contactsToEnrich) {
            try {
              const url = new URL('https://api.apollo.io/api/v1/people/match');
              url.searchParams.set('linkedin_url', ct.linkedin_url!);
              const res = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'X-Api-Key': apolloApiKey },
              });
              if (res.ok) {
                const data = await res.json();
                const person = data.person as Record<string, unknown> | undefined;
                if (person) {
                  const idx = enrichedContacts.findIndex(e => e.linkedin_url === ct.linkedin_url);
                  if (idx >= 0) {
                    enrichedContacts[idx] = {
                      ...enrichedContacts[idx],
                      name: String(person.name || enrichedContacts[idx].name),
                      title: String(person.title || enrichedContacts[idx].title),
                      headline: String(person.headline || ''),
                      location: String(person.location || ''),
                    };
                  }
                }
              }
            } catch { /* skip */ }
            await new Promise(r => setTimeout(r, 1000));
          }

          if (company.id != null) {
            await db.companies.update(company.id, { contacts: enrichedContacts });
            enriched++;
          }
        } else if (openaiKey) {
          // Fallback: use OpenAI to generate LinkedIn search info
          const contactsWithLinkedin = contacts.filter(ct => ct.linkedin_url);
          if (contactsWithLinkedin.length > 0 && company.id != null) {
            const enrichedContacts = contacts.map(ct => ({
              ...ct,
              headline: ct.headline || `${ct.title || 'Professional'} at ${company.company_name}`,
            }));
            await db.companies.update(company.id, { contacts: enrichedContacts });
            enriched++;
          }
        } else {
          setLinkedinWarning('Configure Apollo API key or OpenAI key in Settings for LinkedIn enrichment.');
          break;
        }

        setLinkedinProgress({ value: i + 1, total });
      }

      setLinkedinResult(`Enriched LinkedIn profiles for ${enriched.toLocaleString()} companies`);
    } finally {
      setLinkedinRunning(false);
    }
  }

  // ── Email verification ────────────────────────────────────────────────────

  async function runEmailVerification() {
    if (!openaiKey) {
      setEmailVerifyStats(null);
      return;
    }
    setEmailVerifyRunning(true);
    setEmailVerifyProgress(null);
    setEmailVerifyStats(null);
    try {
      const all = await db.companies.toArray();
      const withEmail = all.filter(c => {
        const contacts = Array.isArray(c.contacts) ? c.contacts as { email?: string }[] : [];
        return c.email || contacts.some(ct => ct.email);
      });
      const total = Math.min(withEmail.length, 100);
      setEmailVerifyProgress({ value: 0, total });
      let verified = 0, suspicious = 0, invalid = 0;

      const BATCH = 20;
      for (let b = 0; b < total; b += BATCH) {
        const batch = withEmail.slice(b, b + BATCH);

        // First: regex-based quick check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        const suspiciousPatterns = /(@(test|example|fake|dummy|noreply|no-reply|temp|throwaway)\.)|(\+.*@)/i;

        const items = batch.map((c, i) => {
          const contacts = Array.isArray(c.contacts) ? c.contacts as { email?: string }[] : [];
          const email = c.email || contacts.find(ct => ct.email)?.email || '';
          return { i, id: c.id!, email };
        }).filter(e => e.email);

        if (items.length === 0) {
          setEmailVerifyProgress({ value: Math.min(b + BATCH, total), total });
          continue;
        }

        // Use AI to verify the batch
        const prompt =
          `Verify these email addresses. For each, rate as: "valid", "suspicious", or "invalid". ` +
          `Consider: format validity, domain reputation, patterns like noreply/test/fake. ` +
          `Return ONLY a JSON array: [{"index": 0, "status": "valid"}]. No explanations.\n\n` +
          items.map(e => `${e.i}. ${e.email}`).join('\n');

        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 400,
              temperature: 0,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.choices?.[0]?.message?.content || '';
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const results = JSON.parse(jsonMatch[0]) as { index: number; status: string }[];
              for (const { index, status } of results) {
                const item = items.find(e => e.i === index);
                if (!item) continue;
                let emailStatus: 'verified' | 'suspicious' | 'invalid' | 'unverified' = 'unverified';
                if (status === 'valid') { emailStatus = 'verified'; verified++; }
                else if (status === 'suspicious') { emailStatus = 'suspicious'; suspicious++; }
                else if (status === 'invalid') { emailStatus = 'invalid'; invalid++; }
                await db.companies.update(item.id, { email_status: emailStatus } as unknown as Partial<Company>);
              }
            }
          }
        } catch { /* skip */ }

        setEmailVerifyProgress({ value: Math.min(b + BATCH, total), total });
        if (b + BATCH < total) await new Promise(r => setTimeout(r, 1000));
      }

      setEmailVerifyStats({ verified, suspicious, invalid });
      await addLog({
        entity_type: 'batch', entity_id: 0, source: 'email-verify',
        success: true, fields_updated: 'email_status', duration_ms: 0,
        created_at: new Date().toISOString(),
      });
    } finally {
      setEmailVerifyRunning(false);
    }
  }

  // ── New AI Enrichment State ───────────────────────────────────────────────

  const [websiteAnalysisRunning, setWebsiteAnalysisRunning] = useState(false);
  const [websiteAnalysisProgress, setWebsiteAnalysisProgress] = useState<{ value: number; total: number } | null>(null);
  const [websiteAnalysisResult, setWebsiteAnalysisResult] = useState<string | null>(null);

  const [googleBusinessRunning, setGoogleBusinessRunning] = useState(false);
  const [googleBusinessProgress, setGoogleBusinessProgress] = useState<{ value: number; total: number } | null>(null);
  const [googleBusinessResult, setGoogleBusinessResult] = useState<string | null>(null);

  const [socialSignalsRunning, setSocialSignalsRunning] = useState(false);
  const [socialSignalsProgress, setSocialSignalsProgress] = useState<{ value: number; total: number } | null>(null);
  const [socialSignalsResult, setSocialSignalsResult] = useState<string | null>(null);

  const [techStackRunning, setTechStackRunning] = useState(false);
  const [techStackProgress, setTechStackProgress] = useState<{ value: number; total: number } | null>(null);
  const [techStackResult, setTechStackResult] = useState<string | null>(null);

  const [secEdgarRunning, setSecEdgarRunning] = useState(false);
  const [secEdgarProgress, setSecEdgarProgress] = useState<{ value: number; total: number } | null>(null);
  const [secEdgarResult, setSecEdgarResult] = useState<string | null>(null);

  const [emailDiscoveryRunning, setEmailDiscoveryRunning] = useState(false);
  const [emailDiscoveryProgress, setEmailDiscoveryProgress] = useState<{ value: number; total: number } | null>(null);
  const [emailDiscoveryResult, setEmailDiscoveryResult] = useState<string | null>(null);

  const [phoneValidationRunning, setPhoneValidationRunning] = useState(false);
  const [phoneValidationProgress, setPhoneValidationProgress] = useState<{ value: number; total: number } | null>(null);
  const [phoneValidationResult, setPhoneValidationResult] = useState<string | null>(null);

  const [jobPostingsRunning, setJobPostingsRunning] = useState(false);
  const [jobPostingsProgress, setJobPostingsProgress] = useState<{ value: number; total: number } | null>(null);
  const [jobPostingsResult, setJobPostingsResult] = useState<string | null>(null);

  const [fundingRunning, setFundingRunning] = useState(false);
  const [fundingProgress, setFundingProgress] = useState<{ value: number; total: number } | null>(null);
  const [fundingResult, setFundingResult] = useState<string | null>(null);

  const [webResearchRunning, setWebResearchRunning] = useState(false);
  const [webResearchProgress, setWebResearchProgress] = useState<{ value: number; total: number } | null>(null);
  const [webResearchResult, setWebResearchResult] = useState<string | null>(null);

  const [linkedinCompanyRunning, setLinkedinCompanyRunning] = useState(false);
  const [linkedinCompanyProgress, setLinkedinCompanyProgress] = useState<{ value: number; total: number } | null>(null);
  const [linkedinCompanyResult, setLinkedinCompanyResult] = useState<string | null>(null);

  // ── Generic AI enrichment batch runner ───────────────────────────────────

  async function runAiEnrichmentBatch<T>(opts: {
    sourceFn: (company: Company, apiKey: string) => Promise<EnrichmentSourceResult>;
    fieldName: string;
    filterFn?: (c: Company) => boolean;
    setRunning: (v: boolean) => void;
    setProgress: (v: { value: number; total: number } | null) => void;
    setResult: (v: string | null) => void;
    logSource: string;
    maxBatch?: number;
  }): Promise<void> {
    if (!openaiKey) {
      opts.setResult('OpenAI API key not configured — go to Settings.');
      return;
    }
    opts.setRunning(true);
    opts.setProgress(null);
    opts.setResult(null);

    try {
      const all = await db.companies.toArray();
      const filter = opts.filterFn || ((c: Company) => !(c as Record<string, unknown>)[opts.fieldName]);
      const toEnrich = all.filter(filter).slice(0, opts.maxBatch ?? 50);
      const total = toEnrich.length;
      opts.setProgress({ value: 0, total });

      if (total === 0) {
        opts.setResult('All companies already enriched for this source.');
        return;
      }

      let enriched = 0;
      for (let i = 0; i < total; i++) {
        const company = toEnrich[i];
        try {
          const result = await opts.sourceFn(company, openaiKey);
          if (company.id != null && Object.keys(result.data).length > 0) {
            await db.companies.update(company.id, result.data as Partial<Company>);
            enriched++;
            await addLog({
              entity_type: 'company',
              entity_id: company.id,
              source: opts.logSource,
              success: true,
              fields_updated: result.fields_updated.join(','),
              duration_ms: 0,
              created_at: new Date().toISOString(),
            });
          }
        } catch {
          // Skip individual failures
        }
        opts.setProgress({ value: i + 1, total });
        if (i < total - 1) await new Promise(r => setTimeout(r, 1000));
      }
      opts.setResult(`Enriched ${enriched.toLocaleString()} of ${total} companies`);
    } finally {
      opts.setRunning(false);
    }
  }

  // ── Website Analysis ──────────────────────────────────────────────────────

  async function runWebsiteAnalysis() {
    await runAiEnrichmentBatch({
      sourceFn: enrichCompanyWebsite,
      fieldName: 'website_analysis',
      setRunning: setWebsiteAnalysisRunning,
      setProgress: setWebsiteAnalysisProgress,
      setResult: setWebsiteAnalysisResult,
      logSource: 'website-analysis',
    });
  }

  // ── Google Business ───────────────────────────────────────────────────────

  async function runGoogleBusinessEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichGoogleBusiness,
      fieldName: 'google_business',
      setRunning: setGoogleBusinessRunning,
      setProgress: setGoogleBusinessProgress,
      setResult: setGoogleBusinessResult,
      logSource: 'google-business',
    });
  }

  // ── Social Signals ────────────────────────────────────────────────────────

  async function runSocialSignalsEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichSocialSignals,
      fieldName: 'social_media',
      setRunning: setSocialSignalsRunning,
      setProgress: setSocialSignalsProgress,
      setResult: setSocialSignalsResult,
      logSource: 'social-signals',
    });
  }

  // ── Tech Stack ────────────────────────────────────────────────────────────

  async function runTechStackEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichTechStack,
      fieldName: 'tech_stack',
      setRunning: setTechStackRunning,
      setProgress: setTechStackProgress,
      setResult: setTechStackResult,
      logSource: 'tech-stack',
    });
  }

  // ── SEC Edgar ─────────────────────────────────────────────────────────────

  async function runSecEdgarEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichSecEdgar,
      fieldName: 'sec_filings',
      setRunning: setSecEdgarRunning,
      setProgress: setSecEdgarProgress,
      setResult: setSecEdgarResult,
      logSource: 'sec-edgar',
    });
  }

  // ── Email Discovery ───────────────────────────────────────────────────────

  async function runEmailDiscoveryEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichEmailDiscovery,
      fieldName: 'email_patterns',
      setRunning: setEmailDiscoveryRunning,
      setProgress: setEmailDiscoveryProgress,
      setResult: setEmailDiscoveryResult,
      logSource: 'email-discovery',
    });
  }

  // ── Phone Validation ──────────────────────────────────────────────────────

  async function runPhoneValidationEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichPhoneValidation,
      fieldName: 'phone_validation',
      filterFn: (c: Company) => !!(c.phone || (c as Record<string, unknown>).director_phone || (c as Record<string, unknown>).contact_phone),
      setRunning: setPhoneValidationRunning,
      setProgress: setPhoneValidationProgress,
      setResult: setPhoneValidationResult,
      logSource: 'phone-validation',
    });
  }

  // ── Job Postings ──────────────────────────────────────────────────────────

  async function runJobPostingsEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichJobPostings,
      fieldName: 'job_postings',
      setRunning: setJobPostingsRunning,
      setProgress: setJobPostingsProgress,
      setResult: setJobPostingsResult,
      logSource: 'job-postings',
    });
  }

  // ── Funding Research ──────────────────────────────────────────────────────

  async function runFundingEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichFunding,
      fieldName: 'funding_info',
      setRunning: setFundingRunning,
      setProgress: setFundingProgress,
      setResult: setFundingResult,
      logSource: 'funding',
    });
  }

  // ── Web Research ──────────────────────────────────────────────────────────

  async function runWebResearchEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichWebResearch,
      fieldName: 'web_research',
      setRunning: setWebResearchRunning,
      setProgress: setWebResearchProgress,
      setResult: setWebResearchResult,
      logSource: 'web-research',
    });
  }

  // ── LinkedIn Company ──────────────────────────────────────────────────────

  async function runLinkedInCompanyEnrichment() {
    await runAiEnrichmentBatch({
      sourceFn: enrichLinkedInCompany,
      fieldName: 'linkedin_company',
      setRunning: setLinkedinCompanyRunning,
      setProgress: setLinkedinCompanyProgress,
      setResult: setLinkedinCompanyResult,
      logSource: 'linkedin-company',
    });
  }

  const anyRunning = tzRunning || missingRunning || apolloPeopleRunning || apolloCompanyRunning || aiScoreRunning || localScoreRunning || newsRunning || linkedinRunning || emailVerifyRunning || websiteAnalysisRunning || googleBusinessRunning || socialSignalsRunning || techStackRunning || secEdgarRunning || emailDiscoveryRunning || phoneValidationRunning || jobPostingsRunning || fundingRunning || webResearchRunning || linkedinCompanyRunning;

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: S.textPrimary, margin: 0 }}>Enrichment</h1>
          <p style={{ fontSize: 13, color: S.textMuted, margin: '4px 0 0' }}>
            {totalCompanies.toLocaleString()} companies in database
          </p>
        </div>
        {anyRunning && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: S.primary, fontWeight: 500,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: S.primary,
              animation: 'pulse 1s ease-in-out infinite',
              display: 'inline-block',
            }} />
            Enrichment running…
          </div>
        )}
      </div>

      {/* ── Batch Enrichment Panel ────────────────────────────── */}
      <BatchEnrichmentPanel
        onRunTimezone={runTimezoneEnrichment}
        onRunMissingData={runMissingDataScan}
        onRunApolloPeople={runApolloPeopleEnrichment}
        onRunDirectors={runDirectorEnrichment}
        onRunApolloCompany={runApolloCompanyEnrichment}
        onRunScoring={runLocalScoring}
        onRunNews={runNewsEnrichment}
        onRunLinkedIn={runLinkedinEnrichment}
        onRunEmailVerify={runEmailVerification}
        anyRunning={anyRunning}
      />

      {/* ── Card 1: Timezone ─────────────────────────────────── */}
      <EnrichmentCard
        icon={<Globe size={20} color={S.primary} />}
        iconBg="#EEF2FF"
        title="Timezone Enrichment"
        description="Derives timezone from geography for all companies missing it. Runs locally — no API calls needed. Supports US states, European countries, and major Asia-Pacific regions."
        buttonLabel="Run"
        running={tzRunning}
        result={tzResult}
        resultType="success"
        onRun={runTimezoneEnrichment}
      />

      {/* ── Card 2: Missing data ─────────────────────────────── */}
      <EnrichmentCard
        icon={<Search size={20} color="#d97706" />}
        iconBg="#FFFBEB"
        title="Missing Data Detection"
        description="Scans all companies and shows which fields are most commonly empty, so you know where to focus enrichment efforts."
        buttonLabel="Scan"
        running={missingRunning}
        onRun={runMissingDataScan}
        extra={
          missingData && missingData.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.textPrimary, marginBottom: 8 }}>
                Field completeness across {totalCompanies.toLocaleString()} companies:
              </div>
              {missingData.map(row => (
                <div key={row.field} style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6,
                }}>
                  <div style={{ width: 120, fontSize: 13, color: S.textSecondary, fontWeight: 500 }}>
                    {row.field}
                  </div>
                  <div style={{ flex: 1, height: 6, background: S.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${row.pct}%`,
                      background: row.pct > 60 ? S.danger : row.pct > 30 ? '#f59e0b' : S.success,
                      borderRadius: 3,
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: S.textMuted, width: 80, textAlign: 'right' }}>
                    {row.missing.toLocaleString()} missing ({row.pct}%)
                  </div>
                </div>
              ))}
            </div>
          ) : missingData?.length === 0 ? (
            <div style={{ marginTop: 10 }}>
              <ResultBadge text="No companies in database yet" type="warning" />
            </div>
          ) : null
        }
      />

      {/* ── Card 3: Apollo People ────────────────────────────── */}
      <EnrichmentCard
        icon={<Users size={20} color="#7c3aed" />}
        iconBg="#F5F3FF"
        title="Enrich Contacts via Apollo"
        description="Finds decision makers and contacts for companies missing them. Uses Apollo's people search API. Rate limited to 1 request/second. Processes up to 50 companies per run."
        buttonLabel="Run"
        running={apolloPeopleRunning}
        progress={apolloPeopleProgress}
        result={apolloPeopleResult}
        warning={apolloPeopleWarning}
        onRun={runApolloPeopleEnrichment}
      />

      {/* ── Card 3b: Director Enrichment ─────────────────────── */}
      <EnrichmentCard
        icon={<Users size={20} color="#7C3AED" />}
        iconBg="#F5F3FF"
        title="Enrich Director Contact Details"
        description="Find email, phone, and LinkedIn for directors using Apollo. Also available per-person on each company detail page."
        running={directorEnrichRunning}
        progress={directorEnrichProgress}
        result={directorEnrichResult}
        warning={null}
        onRun={runDirectorEnrichment}
      />

      {/* ── Card 4: Apollo Company ───────────────────────────── */}
      <EnrichmentCard
        icon={<Zap size={20} color="#059669" />}
        iconBg="#F0FDF4"
        title="Enrich Company Data via Apollo"
        description="Fills in missing fields (employees, industry, description, revenue) using Apollo's organization enrichment API. Targets companies with a website but incomplete data."
        buttonLabel="Run"
        running={apolloCompanyRunning}
        progress={apolloCompanyProgress}
        result={apolloCompanyResult}
        onRun={runApolloCompanyEnrichment}
      />

      {/* ── Card 5: Local Lead Scoring ──────────────────────── */}
      <EnrichmentCard
        icon={<TrendingUp size={20} color="#059669" />}
        iconBg="#F0FDF4"
        title="Lead Scoring (Instant)"
        description="Scores all companies instantly using a weighted formula (0–100 pts) based on data completeness: email (+15), phone (+10), LinkedIn (+10), website (+5), revenue (+10), employees (+5), contacts (+15), directors (+5), description (+5), news (+10), plus bonuses for revenue >$1M and employees >50. No API needed."
        buttonLabel="Score All"
        running={localScoreRunning}
        result={localScoreResult}
        resultType="success"
        onRun={runLocalScoring}
        extra={
          scoreDistribution ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: S.textMuted, marginBottom: 8 }}>Score Distribution:</div>
              {scoreDistribution.map(row => (
                <div key={row.range} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
                  <div style={{ width: 60, fontSize: 12, color: S.textSecondary, fontWeight: 600 }}>{row.range}</div>
                  <div style={{ flex: 1, height: 6, background: S.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: totalCompanies > 0 ? `${Math.round((row.count / totalCompanies) * 100)}%` : '0%',
                      background: row.range.startsWith('81') ? S.success : row.range.startsWith('61') ? '#10B981' : row.range.startsWith('41') ? S.warning : S.danger,
                      borderRadius: 3,
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: S.textMuted, width: 50, textAlign: 'right' }}>
                    {row.count.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : null
        }
      />

      {/* ── Card 5b: AI Deep Scoring ─────────────────────────── */}
      <EnrichmentCard
        icon={<Star size={20} color="#d97706" />}
        iconBg="#FFFBEB"
        title="AI Deep Score"
        description="Uses GPT-4o mini for nuanced scoring (1–100) based on revenue, size, data completeness, and investment potential. More insightful than the instant formula but uses API credits. Batches 20 companies per AI call, up to 60 per run."
        buttonLabel="Deep Score"
        running={aiScoreRunning}
        progress={aiScoreProgress}
        result={aiScoreResult}
        onRun={runAiScoring}
      />

      {/* ── Card 6: News Enrichment ──────────────────────────── */}
      <EnrichmentCard
        icon={<Newspaper size={20} color="#7C3AED" />}
        iconBg="#F5F3FF"
        title="Company News"
        description="Uses OpenAI to generate recent news, events, and notable facts for each company (funding, acquisitions, leadership changes, product launches). Batches 10 companies per AI call. Results stored per company and visible on the detail page."
        buttonLabel="Fetch News"
        running={newsRunning}
        progress={newsProgress}
        result={newsResult}
        resultType="success"
        onRun={runNewsEnrichment}
      />

      {/* ── Card 7: LinkedIn Profiles ────────────────────────── */}
      <EnrichmentCard
        icon={<ExternalLink size={20} color="#0A66C2" />}
        iconBg="#EFF6FF"
        title="LinkedIn Profiles"
        description="Enriches contacts using Apollo API (people/match endpoint) for full name, title, headline, and location. Falls back to OpenAI if no Apollo key. Processes companies with existing LinkedIn URLs on contacts. Rate limited to 1 req/sec."
        buttonLabel="Enrich"
        running={linkedinRunning}
        progress={linkedinProgress}
        result={linkedinResult}
        warning={linkedinWarning}
        onRun={runLinkedinEnrichment}
      />

      {/* ── Card 8: Email Verification ───────────────────────── */}
      <EnrichmentCard
        icon={<Mail size={20} color="#059669" />}
        iconBg="#F0FDF4"
        title="Email Verification"
        description="AI-powered email scoring using OpenAI. Checks format validity, domain patterns, and suspicious indicators to classify emails as verified, suspicious, or invalid. Batches 20 companies per call. Stores result in email_status field."
        buttonLabel="Verify"
        running={emailVerifyRunning}
        progress={emailVerifyProgress}
        result={null}
        onRun={runEmailVerification}
        extra={
          emailVerifyStats ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' as const }}>
              <ResultBadge text={`${emailVerifyStats.verified} verified`} type="success" />
              <ResultBadge text={`${emailVerifyStats.suspicious} suspicious`} type="warning" />
              <ResultBadge text={`${emailVerifyStats.invalid} invalid`} type="warning" />
            </div>
          ) : null
        }
      />

      {/* ── Card 6: InsightEngine ────────────────────────────── */}
      <div style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 12,
        padding: 24,
        marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: '#EFF6FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <BarChart3 size={20} color="#2563eb" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: S.textPrimary, marginBottom: 4 }}>
              AI Research via InsightEngine
            </div>
            <p style={{ fontSize: 13, color: S.textMuted, lineHeight: 1.6, margin: 0 }}>
              Open InsightEngine for advanced company research, AI-generated briefs, and deep analysis.
              InsightEngine connects to your database for context-aware research.
            </p>
          </div>
          <a
            href={insightEngineUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: '#2563eb', color: '#fff', textDecoration: 'none',
              fontSize: 13, fontWeight: 600, flexShrink: 0,
            }}
          >
            <ExternalLink size={13} />
            Open InsightEngine
          </a>
        </div>
      </div>

      {/* ── Activity log ─────────────────────────────────────── */}
      <h2 style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary, marginBottom: 12, marginTop: 8 }}>
        Recent Activity
      </h2>

      {logs.length === 0 ? (
        <div style={{
          background: S.card, border: `1px solid ${S.border}`,
          borderRadius: 12, padding: '40px', textAlign: 'center',
        }}>
          <Clock size={32} color={S.border} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, color: S.textMuted }}>No enrichment activity yet.</div>
        </div>
      ) : (
        <div style={{
          background: S.card, border: `1px solid ${S.border}`,
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {logs.map((log, i) => (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', padding: '12px 20px',
              borderBottom: i < logs.length - 1 ? `1px solid ${S.border}` : 'none',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4,
                background: log.success ? S.success : S.danger,
                marginRight: 12, flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: S.textPrimary }}>
                  {log.entity_type === 'batch' ? 'Batch' : `${log.entity_type} #${log.entity_id}`}
                  {' — '}
                  <span style={{ color: S.textMuted }}>{log.source}</span>
                  {log.fields_updated && (
                    <span style={{ color: S.primary, marginLeft: 6, fontSize: 12 }}>
                      [{log.fields_updated}]
                    </span>
                  )}
                </div>
                {log.error && (
                  <div style={{ fontSize: 12, color: S.danger, marginTop: 2 }}>{log.error}</div>
                )}
              </div>
              <div style={{ fontSize: 12, color: S.textMuted }}>
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
