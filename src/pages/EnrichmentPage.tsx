import { useState, useEffect } from 'react';
import {
  Zap, Clock, CheckCircle, AlertCircle, Globe, Users,
  Star, Search, ExternalLink, Play, BarChart3,
} from 'lucide-react';
import { db, type Company, type EnrichmentLog, deriveTimezone } from '../lib/db';
import { useSettingsStore } from '../lib/store';

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

  const anyRunning = tzRunning || missingRunning || apolloPeopleRunning || apolloCompanyRunning || aiScoreRunning;

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

      {/* ── Card 5: AI Scoring ───────────────────────────────── */}
      <EnrichmentCard
        icon={<Star size={20} color="#d97706" />}
        iconBg="#FFFBEB"
        title="AI Company Scoring"
        description="Uses GPT-4o mini to score companies 1–100 based on revenue, size, data completeness, and investment potential. Batches 20 companies per AI call. Processes up to 60 companies per run."
        buttonLabel="Score"
        running={aiScoreRunning}
        progress={aiScoreProgress}
        result={aiScoreResult}
        onRun={runAiScoring}
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
