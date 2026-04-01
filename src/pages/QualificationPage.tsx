import { useState, useEffect } from 'react';
import { Shield, Play, Save, Plus, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../lib/store';
import { db, type Company } from '../lib/db';
import {
  qualifyCompany, assessWebsiteWithAI,
  DEFAULT_CRITERIA, type QualificationCriteria, type QualificationResult
} from '../lib/qualificationEngine';

const S = {
  bg: '#F6F9FC', card: '#FFFFFF', border: '#E3E8EE', primary: '#635BFF',
  text: '#0A2540', textSec: '#425466', textMuted: '#8898aa',
  success: '#059669', danger: '#E25950', warning: '#F59E0B',
};

const STORE_KEY = 'corgi-qual-criteria-v1';

function loadCriteria(): QualificationCriteria[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}
function saveCriteria(c: QualificationCriteria[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(c));
}

export default function QualificationPage() {
  const { openaiApiKey } = useSettingsStore();
  const [criteriaList, setCriteriaList] = useState<QualificationCriteria[]>(loadCriteria);
  const [activeCriteria, setActiveCriteria] = useState<QualificationCriteria>(DEFAULT_CRITERIA);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ company: Company; result: QualificationResult }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => { saveCriteria(criteriaList); }, [criteriaList]);

  async function runQualification() {
    setRunning(true);
    setResults([]);
    const companies = await db.companies.toArray();
    setProgress({ current: 0, total: companies.length });
    const out: typeof results = [];
    for (let i = 0; i < companies.length; i++) {
      const result = qualifyCompany(companies[i] as Record<string, unknown>, activeCriteria);
      out.push({ company: companies[i], result });
      if (i % 50 === 0) {
        setProgress({ current: i, total: companies.length });
        setResults([...out]);
      }
    }
    setResults(out);
    setProgress({ current: companies.length, total: companies.length });

    // Save scores back to DB
    for (const { company, result } of out) {
      await db.companies.update(company.id!, {
        qualification_score: result.score,
        qualification_reason: result.status,
      });
    }
    setRunning(false);
  }

  function saveCriteriaProfile() {
    const exists = criteriaList.find(c => c.id === activeCriteria.id);
    if (exists) {
      setCriteriaList(criteriaList.map(c => c.id === activeCriteria.id ? activeCriteria : c));
    } else {
      setCriteriaList([...criteriaList, { ...activeCriteria, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
    }
    setEditing(false);
  }

  const qualified = results.filter(r => r.result.status === 'qualified').length;
  const unqualified = results.filter(r => r.result.status === 'unqualified').length;
  const review = results.filter(r => r.result.status === 'review').length;

  const statusColor = (s: string) => s === 'qualified' ? S.success : s === 'unqualified' ? S.danger : S.warning;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Shield size={24} color={S.primary} />
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text }}>Qualification Engine</h1>
          <p style={{ fontSize: 13, color: S.textMuted }}>Score and qualify companies against configurable criteria</p>
        </div>
      </div>

      {/* Criteria Selection */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: S.text }}>Criteria Profile</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {criteriaList.length > 0 && (
              <select
                style={{ border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13 }}
                onChange={e => {
                  const found = criteriaList.find(c => c.id === e.target.value);
                  if (found) setActiveCriteria(found);
                }}
              >
                <option value="">Load saved profile...</option>
                {criteriaList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <button
              onClick={() => setEditing(!editing)}
              style={{ background: S.primary + '10', color: S.primary, border: `1px solid ${S.primary}30`, borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
            >
              {editing ? 'Close Editor' : 'Edit Criteria'}
            </button>
          </div>
        </div>

        {editing && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: S.textMuted, display: 'block', marginBottom: 4 }}>Profile Name</label>
              <input value={activeCriteria.name} onChange={e => setActiveCriteria({ ...activeCriteria, name: e.target.value })}
                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.textMuted, display: 'block', marginBottom: 4 }}>Website Preference</label>
              <select value={activeCriteria.website_preference} onChange={e => setActiveCriteria({ ...activeCriteria, website_preference: e.target.value as 'professional' | 'non-professional' | 'any' })}
                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
                <option value="any">Any</option>
                <option value="professional">Professional</option>
                <option value="non-professional">Non-Professional (scores higher)</option>
              </select>
            </div>
            {(['revenue_min', 'revenue_max', 'employees_min', 'employees_max', 'min_years_incorporated', 'max_years_incorporated'] as const).map(field => (
              <div key={field}>
                <label style={{ fontSize: 12, color: S.textMuted, display: 'block', marginBottom: 4 }}>
                  {field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </label>
                <input type="number" value={activeCriteria[field] ?? ''} onChange={e => setActiveCriteria({ ...activeCriteria, [field]: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13 }} placeholder="Any" />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, color: S.textMuted, display: 'block', marginBottom: 4 }}>Target Industries (comma-separated)</label>
              <input value={activeCriteria.target_industries?.join(', ') || ''} onChange={e => setActiveCriteria({ ...activeCriteria, target_industries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13 }} placeholder="e.g. Software, SaaS, Fintech" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, color: S.textMuted, display: 'block', marginBottom: 4 }}>Target Geographies (comma-separated)</label>
              <input value={activeCriteria.target_geographies?.join(', ') || ''} onChange={e => setActiveCriteria({ ...activeCriteria, target_geographies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                style={{ width: '100%', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13 }} placeholder="e.g. United Kingdom, London" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, color: S.textMuted, display: 'block', marginBottom: 8 }}>Weights</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(activeCriteria.weights).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <label style={{ fontSize: 11, color: S.textMuted, textTransform: 'capitalize' }}>{k.replace('_', ' ')}</label>
                    <input type="number" value={v} min={0} max={100}
                      onChange={e => setActiveCriteria({ ...activeCriteria, weights: { ...activeCriteria.weights, [k]: Number(e.target.value) } })}
                      style={{ width: 60, border: `1px solid ${S.border}`, borderRadius: 6, padding: '4px 6px', fontSize: 13, textAlign: 'center' }} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={saveCriteriaProfile}
                style={{ background: S.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={14} /> Save Profile
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={runQualification} disabled={running}
            style={{ background: S.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: running ? 0.6 : 1 }}>
            {running ? <><Loader2 size={16} className="animate-spin" /> Running...</> : <><Play size={16} /> Qualify All Companies</>}
          </button>
          {running && <span style={{ fontSize: 13, color: S.textMuted, alignSelf: 'center' }}>{progress.current} / {progress.total}</span>}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ background: S.success + '10', border: `1px solid ${S.success}30`, borderRadius: 8, padding: '12px 16px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: S.success }}>{qualified}</div>
              <div style={{ fontSize: 12, color: S.textMuted }}>Qualified</div>
            </div>
            <div style={{ background: S.warning + '10', border: `1px solid ${S.warning}30`, borderRadius: 8, padding: '12px 16px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: S.warning }}>{review}</div>
              <div style={{ fontSize: 12, color: S.textMuted }}>Review</div>
            </div>
            <div style={{ background: S.danger + '10', border: `1px solid ${S.danger}30`, borderRadius: 8, padding: '12px 16px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: S.danger }}>{unqualified}</div>
              <div style={{ fontSize: 12, color: S.textMuted }}>Unqualified</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                <th style={{ textAlign: 'left', padding: 10, color: S.textMuted, fontWeight: 500 }}>Company</th>
                <th style={{ textAlign: 'left', padding: 10, color: S.textMuted, fontWeight: 500 }}>Industry</th>
                <th style={{ textAlign: 'center', padding: 10, color: S.textMuted, fontWeight: 500 }}>Score</th>
                <th style={{ textAlign: 'center', padding: 10, color: S.textMuted, fontWeight: 500 }}>Status</th>
                <th style={{ textAlign: 'center', padding: 10, color: S.textMuted, fontWeight: 500 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 200).map(({ company, result }) => (
                <>
                  <tr key={company.id} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === company.id ? null : company.id!)}>
                    <td style={{ padding: 10, color: S.text, fontWeight: 500 }}>{company.company_name}</td>
                    <td style={{ padding: 10, color: S.textSec }}>{company.industry || '—'}</td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: statusColor(result.status) }}>{result.score}</span>
                    </td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, fontWeight: 600, color: statusColor(result.status), background: statusColor(result.status) + '15' }}>
                        {result.status}
                      </span>
                    </td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      {expandedId === company.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                  </tr>
                  {expandedId === company.id && (
                    <tr key={`${company.id}-detail`}>
                      <td colSpan={5} style={{ padding: '8px 10px 16px 10px', background: S.bg }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                          {result.breakdown.map(b => (
                            <div key={b.criterion} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 10 }}>
                              <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 4 }}>{b.criterion}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 18, fontWeight: 700, color: b.score >= 70 ? S.success : b.score >= 40 ? S.warning : S.danger }}>{b.score}</span>
                                <span style={{ fontSize: 11, color: S.textMuted }}>w:{b.weight}</span>
                              </div>
                              <div style={{ fontSize: 11, color: S.textSec, marginTop: 2 }}>{b.reason}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
