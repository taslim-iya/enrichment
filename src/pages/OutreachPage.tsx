import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Play, Pause, CheckCircle, ChevronDown, ChevronRight, Mail, Phone, ExternalLink, X } from 'lucide-react';
import { useOutreachStore, type OutreachSequence, type OutreachStep, type OutreachEntry } from '../lib/outreachStore';
import { db, type Company } from '../lib/db';

// ─── Design tokens ────────────────────────────────────────────────────────────

const S = {
  bg: '#F6F9FC',
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  success: '#059669',
  danger: '#E25950',
  warning: '#F59E0B',
  purple: '#7C3AED',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function interpolateTemplate(template: string, company: Company): string {
  const contacts = Array.isArray(company.contacts) ? company.contacts : [];
  const primaryContact = contacts[0];
  return template
    .replace(/\{\{company_name\}\}/g, company.company_name || '')
    .replace(/\{\{contact_name\}\}/g, primaryContact?.name || '')
    .replace(/\{\{contact_title\}\}/g, primaryContact?.title || '')
    .replace(/\{\{industry\}\}/g, company.industry || '');
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  email: <Mail size={14} />,
  call: <Phone size={14} />,
  linkedin: <ExternalLink size={14} />,
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:     { bg: '#F3F4F6', color: '#6B7280' },
  in_progress: { bg: '#EEF2FF', color: '#635BFF' },
  completed:   { bg: '#D1FAE5', color: '#065F46' },
  paused:      { bg: '#FEF3C7', color: '#92400E' },
  bounced:     { bg: '#FEE2E2', color: '#991B1B' },
  replied:     { bg: '#EDE9FE', color: '#5B21B6' },
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'sequences' | 'today';

// ─── Step editor ──────────────────────────────────────────────────────────────

function StepEditor({
  step,
  index,
  onUpdate,
  onDelete,
}: {
  step: OutreachStep;
  index: number;
  onUpdate: (s: OutreachStep) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      background: S.bg,
      border: `1px solid ${S.border}`,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: S.primary, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </div>
        <select
          value={step.type}
          onChange={e => onUpdate({ ...step, type: e.target.value as OutreachStep['type'] })}
          style={{
            padding: '5px 8px', borderRadius: 6, border: `1px solid ${S.border}`,
            fontSize: 12, background: S.card, color: S.textPrimary, cursor: 'pointer',
          }}
        >
          <option value="email">Email</option>
          <option value="call">Call</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: S.textMuted }}>Day</span>
          <input
            type="number"
            min={0}
            value={step.delay_days}
            onChange={e => onUpdate({ ...step, delay_days: parseInt(e.target.value) || 0 })}
            style={{
              width: 56, padding: '5px 8px', borderRadius: 6,
              border: `1px solid ${S.border}`, fontSize: 12,
              background: S.card, color: S.textPrimary,
            }}
          />
        </div>
        <button
          onClick={onDelete}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            cursor: 'pointer', color: S.danger, padding: 4,
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {step.type === 'email' && (
        <input
          type="text"
          placeholder="Subject: e.g. Quick question about {{company_name}}"
          value={step.subject || ''}
          onChange={e => onUpdate({ ...step, subject: e.target.value })}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '7px 10px', borderRadius: 6, border: `1px solid ${S.border}`,
            fontSize: 12, marginBottom: 8, background: S.card, color: S.textPrimary,
          }}
        />
      )}

      <textarea
        placeholder={`Template… Variables: {{company_name}}, {{contact_name}}, {{contact_title}}, {{industry}}`}
        value={step.template}
        onChange={e => onUpdate({ ...step, template: e.target.value })}
        rows={3}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '7px 10px', borderRadius: 6, border: `1px solid ${S.border}`,
          fontSize: 12, background: S.card, color: S.textPrimary,
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

// ─── Sequence card ────────────────────────────────────────────────────────────

function SequenceCard({
  seq,
  entries,
  companies,
  onDelete,
  onAssign,
}: {
  seq: OutreachSequence;
  entries: OutreachEntry[];
  companies: Company[];
  onDelete: () => void;
  onAssign: (companyId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const seqEntries = entries.filter(e => e.sequence_id === seq.id);
  const inProgress = seqEntries.filter(e => e.status === 'in_progress').length;
  const completed = seqEntries.filter(e => e.status === 'completed').length;

  const unassignedCompanies = companies.filter(
    c => !seqEntries.some(e => e.company_id === c.id)
  );

  return (
    <div style={{
      background: S.card,
      border: `1px solid ${S.border}`,
      borderRadius: 12,
      marginBottom: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', cursor: 'pointer',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown size={16} color={S.textMuted} /> : <ChevronRight size={16} color={S.textMuted} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: S.textPrimary }}>{seq.name}</div>
          <div style={{ fontSize: 12, color: S.textMuted, marginTop: 2 }}>
            {seq.steps.length} steps · {seqEntries.length} companies · {inProgress} active · {completed} done
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {seq.steps.map((step, i) => (
            <span key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: '50%',
              background: step.type === 'email' ? '#EEF2FF' : step.type === 'call' ? '#D1FAE5' : '#EDE9FE',
              color: step.type === 'email' ? S.primary : step.type === 'call' ? S.success : S.purple,
            }}>
              {STEP_ICONS[step.type]}
            </span>
          ))}
        </div>
        <button
          onClick={e => { e.stopPropagation(); setShowAssign(v => !v); }}
          style={{
            padding: '6px 12px', borderRadius: 7,
            background: S.primary, color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          + Assign
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: S.danger, padding: 4,
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Assign dropdown */}
      {showAssign && (
        <div style={{
          borderTop: `1px solid ${S.border}`,
          padding: '10px 18px',
          background: S.bg,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: S.textMuted, marginBottom: 8 }}>
            Assign company to this sequence:
          </div>
          {unassignedCompanies.length === 0 ? (
            <div style={{ fontSize: 13, color: S.textMuted }}>All companies already assigned.</div>
          ) : (
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
              {unassignedCompanies.slice(0, 50).map(c => (
                <button
                  key={c.id}
                  onClick={() => { onAssign(c.id!); setShowAssign(false); }}
                  style={{
                    padding: '4px 10px', borderRadius: 6,
                    border: `1px solid ${S.border}`,
                    background: S.card, color: S.textPrimary,
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {c.company_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expanded: entries */}
      {expanded && seqEntries.length > 0 && (
        <div style={{ borderTop: `1px solid ${S.border}` }}>
          {seqEntries.map(entry => {
            const company = companies.find(c => c.id === entry.company_id);
            const sc = STATUS_COLORS[entry.status] || STATUS_COLORS.pending;
            const stepInfo = seq.steps[entry.current_step];
            return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 18px',
                borderBottom: `1px solid ${S.border}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.textPrimary }}>
                    {company?.company_name || `Company #${entry.company_id}`}
                  </div>
                  {stepInfo && (
                    <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>
                      Step {entry.current_step + 1}: {stepInfo.type} (day {stepInfo.delay_days})
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: sc.bg, color: sc.color,
                  borderRadius: 5, padding: '2px 8px',
                }}>
                  {entry.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Today's actions ──────────────────────────────────────────────────────────

function TodayView({
  entries,
  sequences,
  companies,
  onAdvance,
}: {
  entries: OutreachEntry[];
  sequences: OutreachSequence[];
  companies: Company[];
  onAdvance: (entryId: string) => void;
}) {
  const today = new Date();
  const activeEntries = entries.filter(e => e.status === 'in_progress' || e.status === 'pending');

  const dueToday = activeEntries.filter(entry => {
    if (!entry.last_action_at && entry.status === 'pending') return true;
    if (!entry.last_action_at) return false;
    const seq = sequences.find(s => s.id === entry.sequence_id);
    const step = seq?.steps[entry.current_step];
    if (!step) return false;
    const lastAction = new Date(entry.last_action_at);
    const dueDate = new Date(lastAction);
    dueDate.setDate(dueDate.getDate() + step.delay_days);
    return dueDate <= today;
  });

  if (dueToday.length === 0) {
    return (
      <div style={{
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 12, padding: '40px', textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <CheckCircle size={32} color={S.success} style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary, marginBottom: 4 }}>
          All caught up!
        </div>
        <div style={{ fontSize: 13, color: S.textMuted }}>No actions due today.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: S.textPrimary, marginBottom: 12 }}>
        {dueToday.length} action{dueToday.length !== 1 ? 's' : ''} due today
      </div>
      {dueToday.map(entry => {
        const company = companies.find(c => c.id === entry.company_id);
        const seq = sequences.find(s => s.id === entry.sequence_id);
        const step = seq?.steps[entry.current_step];
        const sc = STATUS_COLORS[entry.status] || STATUS_COLORS.pending;
        const contacts = Array.isArray(company?.contacts) ? company!.contacts : [];
        const primaryContact = contacts[0];

        return (
          <div key={entry.id} style={{
            background: S.card, border: `1px solid ${S.border}`,
            borderRadius: 12, padding: 16, marginBottom: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: step?.type === 'email' ? '#EEF2FF' : step?.type === 'call' ? '#D1FAE5' : '#EDE9FE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: step?.type === 'email' ? S.primary : step?.type === 'call' ? S.success : S.purple,
                flexShrink: 0,
              }}>
                {step ? STEP_ICONS[step.type] : <Mail size={16} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.textPrimary }}>
                  {company?.company_name || `Company #${entry.company_id}`}
                </div>
                {primaryContact && (
                  <div style={{ fontSize: 12, color: S.textSecondary, marginTop: 2 }}>
                    {primaryContact.name} · {primaryContact.title}
                    {primaryContact.email && (
                      <a href={`mailto:${primaryContact.email}`} style={{ color: S.primary, marginLeft: 8, textDecoration: 'none' }}>
                        {primaryContact.email}
                      </a>
                    )}
                  </div>
                )}
                {step && (
                  <div style={{ fontSize: 12, color: S.textMuted, marginTop: 4 }}>
                    <strong>{seq?.name}</strong> · Step {entry.current_step + 1}: {step.type}
                    {step.subject && <span> — "{step.subject}"</span>}
                  </div>
                )}
                {step?.template && company && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px',
                    background: S.bg, borderRadius: 6, border: `1px solid ${S.border}`,
                    fontSize: 12, color: S.textSecondary, lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {interpolateTemplate(step.template, company)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: sc.bg, color: sc.color,
                  borderRadius: 5, padding: '2px 8px',
                }}>
                  {entry.status}
                </span>
                <button
                  onClick={() => onAdvance(entry.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 7,
                    background: S.success, color: '#fff', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <CheckCircle size={12} /> Done
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const { sequences, entries, addSequence, updateSequence, deleteSequence, addEntry, updateEntry, advanceEntry } = useOutreachStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [showBuilder, setShowBuilder] = useState(false);
  const [newSeqName, setNewSeqName] = useState('');
  const [newSeqSteps, setNewSeqSteps] = useState<OutreachStep[]>([
    { id: genId(), type: 'email', delay_days: 0, subject: '', template: 'Hi {{contact_name}},\n\nI wanted to reach out about {{company_name}}…' },
  ]);

  useEffect(() => {
    db.companies.toArray().then(setCompanies);
  }, []);

  const totalActive = useMemo(
    () => entries.filter(e => e.status === 'in_progress' || e.status === 'pending').length,
    [entries]
  );
  const totalCompleted = useMemo(
    () => entries.filter(e => e.status === 'completed' || e.status === 'replied').length,
    [entries]
  );

  const handleCreateSequence = () => {
    if (!newSeqName.trim()) return;
    addSequence({
      id: genId(),
      name: newSeqName.trim(),
      steps: newSeqSteps,
      created_at: new Date().toISOString(),
    });
    setNewSeqName('');
    setNewSeqSteps([{ id: genId(), type: 'email', delay_days: 0, subject: '', template: '' }]);
    setShowBuilder(false);
  };

  const handleAssign = (seqId: string, companyId: number) => {
    addEntry({
      id: genId(),
      company_id: companyId,
      sequence_id: seqId,
      current_step: 0,
      status: 'pending',
      started_at: new Date().toISOString(),
    });
  };

  const handleAdvance = (entryId: string) => {
    advanceEntry(entryId);
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'sequences', label: `Sequences (${sequences.length})` },
    { key: 'today', label: `Today's Actions` },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: S.textPrimary, margin: 0 }}>Outreach</h1>
          <p style={{ fontSize: 13, color: S.textMuted, margin: '4px 0 0' }}>
            Manage multi-step outreach sequences
          </p>
        </div>
        <button
          onClick={() => setShowBuilder(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, border: 'none',
            background: S.primary, color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> New Sequence
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Sequences',  value: sequences.length },
          { label: 'Active',     value: totalActive },
          { label: 'Completed',  value: totalCompleted },
          { label: 'Companies',  value: companies.length },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: 1, background: S.card, border: `1px solid ${S.border}`,
            borderRadius: 12, padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 11, color: S.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: S.textPrimary }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Sequence builder */}
      {showBuilder && (
        <div style={{
          background: S.card, border: `1px solid ${S.border}`,
          borderRadius: 12, padding: 20, marginBottom: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.textPrimary }}>New Sequence</h3>
            <button onClick={() => setShowBuilder(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.textMuted }}>
              <X size={16} />
            </button>
          </div>

          <input
            type="text"
            placeholder="Sequence name…"
            value={newSeqName}
            onChange={e => setNewSeqName(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px', borderRadius: 8, border: `1px solid ${S.border}`,
              fontSize: 14, marginBottom: 16, background: S.bg, color: S.textPrimary,
            }}
          />

          <div style={{ fontSize: 12, fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Steps
          </div>

          {newSeqSteps.map((step, i) => (
            <StepEditor
              key={step.id}
              step={step}
              index={i}
              onUpdate={updated => setNewSeqSteps(prev => prev.map(s => s.id === updated.id ? updated : s))}
              onDelete={() => setNewSeqSteps(prev => prev.filter(s => s.id !== step.id))}
            />
          ))}

          <button
            onClick={() => setNewSeqSteps(prev => [...prev, { id: genId(), type: 'email', delay_days: 0, subject: '', template: '' }])}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 7,
              border: `1px dashed ${S.border}`,
              background: 'none', color: S.textSecondary,
              fontSize: 13, cursor: 'pointer', marginBottom: 16,
            }}
          >
            <Plus size={13} /> Add Step
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleCreateSequence}
              disabled={!newSeqName.trim()}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: newSeqName.trim() ? S.primary : '#E3E8EE',
                color: newSeqName.trim() ? '#fff' : S.textMuted,
                fontSize: 13, fontWeight: 600,
                cursor: newSeqName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Create Sequence
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20,
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 10, padding: 4, width: 'fit-content',
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              background: tab === t.key ? S.primary : 'transparent',
              color: tab === t.key ? '#fff' : S.textSecondary,
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && (
        <div>
          {sequences.length === 0 ? (
            <div style={{
              background: S.card, border: `1px solid ${S.border}`,
              borderRadius: 12, padding: '48px 40px', textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <Play size={32} color={S.border} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary, marginBottom: 4 }}>
                No sequences yet
              </div>
              <div style={{ fontSize: 13, color: S.textMuted }}>
                Click "New Sequence" to create your first outreach campaign.
              </div>
            </div>
          ) : (
            sequences.map(seq => (
              <SequenceCard
                key={seq.id}
                seq={seq}
                entries={entries}
                companies={companies}
                onDelete={() => deleteSequence(seq.id)}
                onAssign={companyId => handleAssign(seq.id, companyId)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'sequences' && (
        <div>
          {sequences.length === 0 ? (
            <div style={{
              background: S.card, border: `1px solid ${S.border}`,
              borderRadius: 12, padding: '40px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, color: S.textMuted }}>No sequences created yet.</div>
            </div>
          ) : (
            sequences.map(seq => {
              const seqEntries = entries.filter(e => e.sequence_id === seq.id);
              return (
                <div key={seq.id} style={{
                  background: S.card, border: `1px solid ${S.border}`,
                  borderRadius: 12, padding: 16, marginBottom: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: S.textPrimary }}>{seq.name}</div>
                      <div style={{ fontSize: 12, color: S.textMuted, marginTop: 2 }}>
                        {seq.steps.length} steps · Created {new Date(seq.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: S.textMuted }}>
                      {(['pending', 'in_progress', 'completed', 'bounced', 'replied'] as const).map(status => {
                        const count = seqEntries.filter(e => e.status === status).length;
                        if (count === 0) return null;
                        const sc = STATUS_COLORS[status];
                        return (
                          <span key={status} style={{
                            background: sc.bg, color: sc.color,
                            borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                          }}>
                            {count} {status}
                          </span>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => deleteSequence(seq.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: S.danger, padding: 4,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Steps preview */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' as const }}>
                    {seq.steps.map((step, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 6,
                        background: step.type === 'email' ? '#EEF2FF' : step.type === 'call' ? '#D1FAE5' : '#EDE9FE',
                        color: step.type === 'email' ? S.primary : step.type === 'call' ? S.success : S.purple,
                        fontSize: 12, fontWeight: 500,
                      }}>
                        {STEP_ICONS[step.type]}
                        Day {step.delay_days}
                        {step.subject && ` — ${step.subject}`}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'today' && (
        <TodayView
          entries={entries}
          sequences={sequences}
          companies={companies}
          onAdvance={handleAdvance}
        />
      )}
    </div>
  );
}
