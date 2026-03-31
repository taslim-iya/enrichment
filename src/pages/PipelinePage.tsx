import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
};

// ─── Pipeline stages ──────────────────────────────────────────────────────────

interface Stage {
  key: string;
  label: string;
  color: string;
  textColor: string;
}

const STAGES: Stage[] = [
  { key: 'New',               label: 'New',               color: '#E3E8EE', textColor: '#425466' },
  { key: 'Researching',       label: 'Researching',       color: '#DBEAFE', textColor: '#1D4ED8' },
  { key: 'Contacted',         label: 'Contacted',         color: '#FEF3C7', textColor: '#92400E' },
  { key: 'Responded',         label: 'Responded',         color: '#D1FAE5', textColor: '#065F46' },
  { key: 'Meeting Scheduled', label: 'Meeting Scheduled', color: '#EDE9FE', textColor: '#5B21B6' },
  { key: 'Proposal Sent',     label: 'Proposal Sent',     color: '#FEE2E2', textColor: '#991B1B' },
  { key: 'Negotiating',       label: 'Negotiating',       color: '#FCE7F3', textColor: '#9D174D' },
  { key: 'Won',               label: 'Won',               color: '#059669', textColor: '#FFFFFF' },
  { key: 'Lost',              label: 'Lost',              color: '#E25950', textColor: '#FFFFFF' },
  { key: 'On Hold',           label: 'On Hold',           color: '#F3F4F6', textColor: '#6B7280' },
];

const STAGE_KEYS = STAGES.map(s => s.key);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(val: unknown): string {
  if (val == null || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return '';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

function scoreColor(score?: number): { bg: string; color: string } {
  if (!score) return { bg: '#F3F4F6', color: '#6B7280' };
  if (score >= 70) return { bg: '#D1FAE5', color: '#065F46' };
  if (score >= 40) return { bg: '#FEF3C7', color: '#92400E' };
  return { bg: '#FEE2E2', color: '#991B1B' };
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({
  company,
  onDragStart,
  onClick,
}: {
  company: Company;
  onDragStart: () => void;
  onClick: () => void;
}) {
  const contacts = Array.isArray(company.contacts) ? company.contacts : [];
  const primaryContact = contacts[0];
  const rev = fmtCurrency(company.revenue);
  const sc = scoreColor(company.score);
  const updatedAt = company.updated_at
    ? new Date(company.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 8,
        cursor: 'grab',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
    >
      {/* Company name */}
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: S.textPrimary,
        marginBottom: 4,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {company.company_name}
      </div>

      {/* Contact name */}
      {primaryContact?.name && (
        <div style={{ fontSize: 12, color: S.textSecondary, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {primaryContact.name}
          {primaryContact.title && <span style={{ color: S.textMuted }}> · {primaryContact.title}</span>}
        </div>
      )}

      {/* Revenue + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {rev && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: S.textSecondary,
            background: S.bg, borderRadius: 4, padding: '2px 6px',
            border: `1px solid ${S.border}`,
          }}>
            {rev}
          </span>
        )}
        {company.score != null && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: sc.bg, color: sc.color,
            borderRadius: 4, padding: '2px 6px',
          }}>
            {company.score}
          </span>
        )}
        {updatedAt && (
          <span style={{ fontSize: 10, color: S.textMuted, marginLeft: 'auto' }}>
            {updatedAt}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  companies,
  isDragOver,
  onDragOver,
  onDrop,
  onDragStart,
  onCardClick,
}: {
  stage: Stage;
  companies: Company[];
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragStart: (company: Company) => void;
  onCardClick: (id: number) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        minWidth: 220,
        maxWidth: 260,
        flex: '0 0 220px',
        background: isDragOver ? '#EEF2FF' : S.bg,
        border: `2px solid ${isDragOver ? S.primary : 'transparent'}`,
        borderRadius: 12,
        padding: '12px 10px',
        transition: 'border-color 0.15s, background 0.15s',
        minHeight: 200,
      }}
    >
      {/* Column header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 8,
            background: stage.color, color: stage.textColor,
            fontSize: 12, fontWeight: 700,
          }}>
            {stage.label}
          </div>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: S.textMuted,
            background: S.card, borderRadius: 20,
            padding: '2px 8px', border: `1px solid ${S.border}`,
          }}>
            {companies.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      {companies.map(c => (
        <KanbanCard
          key={c.id}
          company={c}
          onDragStart={() => onDragStart(c)}
          onClick={() => c.id && onCardClick(c.id)}
        />
      ))}

      {companies.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '24px 8px',
          fontSize: 12, color: S.textMuted,
          border: `1px dashed ${S.border}`, borderRadius: 8,
        }}>
          Drop here
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dragCompany, setDragCompany] = useState<Company | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterGeo, setFilterGeo] = useState('');
  const [teamMembers, setTeamMembers] = useState<{ id: number; name: string }[]>([]);
  const [filterTeamMember, setFilterTeamMember] = useState('');
  const [assignments, setAssignments] = useState<{ lead_id: number; team_member_id: number }[]>([]);

  useEffect(() => {
    db.companies.toArray().then(setCompanies);
    db.team_members.toArray().then(members =>
      setTeamMembers(members.filter(m => m.active).map(m => ({ id: m.id!, name: m.name })))
    );
    db.lead_assignments.toArray().then(rows =>
      setAssignments(rows.map(a => ({ lead_id: a.lead_id, team_member_id: a.team_member_id })))
    );
  }, []);

  const industries = useMemo(
    () => [...new Set(companies.map(c => c.industry).filter(Boolean))].sort() as string[],
    [companies]
  );
  const geos = useMemo(
    () => [...new Set(companies.map(c => c.geography || c.state).filter(Boolean))].sort() as string[],
    [companies]
  );

  const filteredCompanies = useMemo(() => {
    let list = companies;
    if (filterIndustry) list = list.filter(c => c.industry === filterIndustry);
    if (filterGeo) list = list.filter(c => c.geography === filterGeo || c.state === filterGeo);
    if (filterTeamMember) {
      const memberIds = new Set(
        assignments
          .filter(a => a.team_member_id === Number(filterTeamMember))
          .map(a => a.lead_id)
      );
      list = list.filter(c => c.id && memberIds.has(c.id));
    }
    return list;
  }, [companies, filterIndustry, filterGeo, filterTeamMember, assignments]);

  const grouped = useMemo(() => {
    const map: Record<string, Company[]> = {};
    for (const stage of STAGES) map[stage.key] = [];
    for (const c of filteredCompanies) {
      const s = c.status || 'New';
      const key = STAGE_KEYS.includes(s) ? s : 'New';
      map[key].push(c);
    }
    return map;
  }, [filteredCompanies]);

  const handleDragStart = (company: Company) => {
    setDragCompany(company);
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    setDragOverStage(stageKey);
  };

  const handleDrop = async (stageKey: string) => {
    if (!dragCompany || !dragCompany.id) return;
    if (dragCompany.status === stageKey) {
      setDragCompany(null);
      setDragOverStage(null);
      return;
    }
    await db.companies.update(dragCompany.id, { status: stageKey });
    setCompanies(prev =>
      prev.map(c => c.id === dragCompany.id ? { ...c, status: stageKey } : c)
    );
    setDragCompany(null);
    setDragOverStage(null);
  };

  const totalCount = filteredCompanies.length;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: S.textPrimary, margin: 0 }}>Pipeline</h1>
          <p style={{ fontSize: 13, color: S.textMuted, margin: '4px 0 0' }}>
            {totalCount.toLocaleString()} companies across {STAGES.length} stages
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 12, padding: '12px 16px', marginBottom: 20,
        display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center',
      }}>
        {[
          { label: 'Industry',    value: filterIndustry,    onChange: setFilterIndustry,   options: industries },
          { label: 'Geography',   value: filterGeo,         onChange: setFilterGeo,        options: geos },
        ].map(f => (
          <select
            key={f.label}
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            style={{
              flex: '0 0 150px', padding: '7px 10px',
              border: `1px solid ${S.border}`, borderRadius: 8,
              fontSize: 13, color: f.value ? S.textPrimary : S.textMuted,
              background: S.bg, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">{f.label}: All</option>
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <select
          value={filterTeamMember}
          onChange={e => setFilterTeamMember(e.target.value)}
          style={{
            flex: '0 0 150px', padding: '7px 10px',
            border: `1px solid ${S.border}`, borderRadius: 8,
            fontSize: 13, color: filterTeamMember ? S.textPrimary : S.textMuted,
            background: S.bg, outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">Team Member: All</option>
          {teamMembers.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {(filterIndustry || filterGeo || filterTeamMember) && (
          <button
            onClick={() => { setFilterIndustry(''); setFilterGeo(''); setFilterTeamMember(''); }}
            style={{
              padding: '7px 12px', borderRadius: 8,
              border: `1px solid ${S.border}`,
              background: 'none', color: S.textMuted,
              fontSize: 12, cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Kanban board */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 24,
          alignItems: 'flex-start',
        }}
        onDragEnd={() => { setDragCompany(null); setDragOverStage(null); }}
      >
        {STAGES.map(stage => (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            companies={grouped[stage.key] || []}
            isDragOver={dragOverStage === stage.key}
            onDragOver={e => handleDragOver(e, stage.key)}
            onDrop={() => handleDrop(stage.key)}
            onDragStart={handleDragStart}
            onCardClick={id => navigate(`/leads/${id}`)}
          />
        ))}
      </div>
    </div>
  );
}
