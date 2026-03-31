import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  PhoneCall, Phone, Mail, Globe, ExternalLink, Download,
  ChevronDown, ChevronUp, Search, Calendar, User,
} from 'lucide-react';
import { db, type Company, type TeamMember, type CallSheetEntry } from '../lib/db';

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

// ─── Call status config ───────────────────────────────────────────────────────

const CALL_STATUSES = [
  'Not Called',
  'Called - No Answer',
  'Called - Left Voicemail',
  'Called - Spoke to Gatekeeper',
  'Called - Spoke to Decision Maker',
  'Callback Scheduled',
  'Interested',
  'Not Interested',
  'Rejected',
  'Unqualified',
  'Wrong Number',
  'Do Not Call',
] as const;

type CallStatus = typeof CALL_STATUSES[number];

function statusColor(status: string): string {
  if (status === 'Not Called') return S.textMuted;
  if (status === 'Called - No Answer') return S.warning;
  if (status === 'Called - Left Voicemail') return S.warning;
  if (status === 'Called - Spoke to Gatekeeper') return '#d97706';
  if (status === 'Called - Spoke to Decision Maker') return S.success;
  if (status === 'Callback Scheduled') return S.purple;
  if (status === 'Interested') return S.primary;
  if (status === 'Not Interested') return S.textMuted;
  if (status === 'Rejected') return S.danger;
  if (status === 'Unqualified') return S.danger;
  if (status === 'Wrong Number') return S.danger;
  if (status === 'Do Not Call') return S.danger;
  return S.textMuted;
}

function statusBg(status: string): string {
  if (status === 'Not Called') return '#F3F4F6';
  if (status === 'Called - No Answer') return '#FFFBEB';
  if (status === 'Called - Left Voicemail') return '#FFFBEB';
  if (status === 'Called - Spoke to Gatekeeper') return '#FEF3C7';
  if (status === 'Called - Spoke to Decision Maker') return '#F0FDF4';
  if (status === 'Callback Scheduled') return '#F5F3FF';
  if (status === 'Interested') return '#EEF2FF';
  if (status === 'Not Interested') return '#F3F4F6';
  if (status === 'Rejected') return '#FEF2F2';
  if (status === 'Unqualified') return '#FEF2F2';
  if (status === 'Wrong Number') return '#FEF2F2';
  if (status === 'Do Not Call') return '#FEF2F2';
  return '#F3F4F6';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getContactInfo(c: Company) {
  const contact = c.contacts?.[0];
  return {
    name: contact?.name || c.director_name || c.contact_name || '',
    title: contact?.title || c.director_title || c.contact_title || '',
    phone: contact?.phone || c.director_phone || c.contact_phone || c.phone || '',
    email: contact?.email || c.director_email || c.contact_email || c.email || '',
    linkedin: contact?.linkedin_url || '',
  };
}

function formatRevenue(v?: number): string {
  if (!v) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(0)}K`;
  return `$${abs.toLocaleString()}`;
}

function isOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function isDueToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

// ─── Row component ────────────────────────────────────────────────────────────

interface RowProps {
  company: Company;
  entry: CallSheetEntry;
  onUpdate: (id: number, updates: Partial<CallSheetEntry>) => void;
}

function CallSheetRow({ company, entry, onUpdate }: RowProps) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState(entry.call_notes || '');
  const contact = getContactInfo(company);

  const handleStatusChange = (status: string) => {
    const now = new Date().toISOString();
    const isNewCall = status !== 'Not Called' && status !== entry.status;
    onUpdate(entry.id!, {
      status,
      last_called: isNewCall ? now : entry.last_called,
      call_count: isNewCall ? (entry.call_count || 0) + 1 : entry.call_count,
      updated_at: now,
    });
  };

  const handleNotesBlur = () => {
    setEditingNotes(false);
    if (localNotes !== entry.call_notes) {
      onUpdate(entry.id!, { call_notes: localNotes, updated_at: new Date().toISOString() });
    }
  };

  const handleFollowUpChange = (date: string) => {
    onUpdate(entry.id!, { follow_up_date: date || undefined, updated_at: new Date().toISOString() });
  };

  const rowBg = isOverdue(entry.follow_up_date)
    ? '#FFF7ED'
    : isDueToday(entry.follow_up_date)
    ? '#FFFBEB'
    : S.card;

  const rowBorder = isOverdue(entry.follow_up_date)
    ? '1px solid #FED7AA'
    : isDueToday(entry.follow_up_date)
    ? '1px solid #FDE68A'
    : `1px solid ${S.border}`;

  return (
    <div style={{
      background: rowBg,
      border: rowBorder,
      borderRadius: 10,
      padding: '14px 18px',
      marginBottom: 8,
    }}>
      {/* Top row: company name + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: S.textPrimary }}>
              {company.company_name}
            </span>
            {entry.call_count > 0 && (
              <span style={{
                background: '#EEF2FF', color: S.primary,
                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
              }}>
                {entry.call_count}× called
              </span>
            )}
            {isOverdue(entry.follow_up_date) && (
              <span style={{
                background: '#FEF2F2', color: S.danger,
                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
              }}>
                OVERDUE
              </span>
            )}
            {isDueToday(entry.follow_up_date) && !isOverdue(entry.follow_up_date) && (
              <span style={{
                background: '#FFFBEB', color: '#92400e',
                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
              }}>
                DUE TODAY
              </span>
            )}
          </div>
          {/* Company meta */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginTop: 4 }}>
            {company.industry && (
              <span style={{ fontSize: 12, color: S.textMuted }}>{company.industry}</span>
            )}
            {(company.geography || company.state) && (
              <span style={{ fontSize: 12, color: S.textMuted }}>{company.geography || company.state}</span>
            )}
            {company.revenue && (
              <span style={{ fontSize: 12, color: S.textMuted }}>{formatRevenue(company.revenue)}</span>
            )}
            {company.employees && (
              <span style={{ fontSize: 12, color: S.textMuted }}>{Number(company.employees).toLocaleString()} emp</span>
            )}
            {company.year_incorporated && (
              <span style={{ fontSize: 12, color: S.textMuted }}>Est. {company.year_incorporated}</span>
            )}
          </div>
        </div>

        {/* Status dropdown */}
        <div>
          <select
            value={entry.status}
            onChange={e => handleStatusChange(e.target.value)}
            style={{
              padding: '5px 10px',
              borderRadius: 8,
              border: `1px solid ${statusColor(entry.status)}`,
              background: statusBg(entry.status),
              color: statusColor(entry.status),
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              minWidth: 170,
            }}
          >
            {CALL_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contact row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 10, alignItems: 'center' }}>
        {contact.name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <User size={12} color={S.textMuted} />
            <span style={{ fontSize: 13, color: S.textSecondary, fontWeight: 500 }}>{contact.name}</span>
            {contact.title && (
              <span style={{ fontSize: 12, color: S.textMuted }}>· {contact.title}</span>
            )}
          </div>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: S.primary, textDecoration: 'none' }}
          >
            <Phone size={12} /> {contact.phone}
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: S.primary, textDecoration: 'none' }}
          >
            <Mail size={12} /> {contact.email}
          </a>
        )}
        {contact.linkedin && (
          <a
            href={contact.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#0A66C2', textDecoration: 'none' }}
          >
            <ExternalLink size={12} /> LinkedIn
          </a>
        )}
        {company.website && (
          <a
            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: S.textSecondary, textDecoration: 'none' }}
          >
            <Globe size={12} /> {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        )}
      </div>

      {/* Bottom row: notes + follow-up + last called */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'flex-start' }}>
        {/* Call notes */}
        <div style={{ flex: 2, minWidth: 200 }}>
          {editingNotes ? (
            <textarea
              value={localNotes}
              onChange={e => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              autoFocus
              placeholder="Call notes…"
              rows={2}
              style={{
                width: '100%', padding: '6px 10px',
                border: `1px solid ${S.primary}`,
                borderRadius: 6, fontSize: 13, color: S.textPrimary,
                background: '#fff', outline: 'none', resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <div
              onClick={() => setEditingNotes(true)}
              style={{
                padding: '6px 10px',
                background: localNotes ? '#F8FAFC' : 'transparent',
                border: `1px solid ${localNotes ? S.border : 'transparent'}`,
                borderRadius: 6, fontSize: 13,
                color: localNotes ? S.textSecondary : S.textMuted,
                cursor: 'text', minHeight: 32,
                fontStyle: localNotes ? 'normal' : 'italic',
              }}
            >
              {localNotes || 'Add call notes…'}
            </div>
          )}
        </div>

        {/* Follow-up date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Calendar size={12} color={S.textMuted} />
          <label style={{ fontSize: 12, color: S.textMuted }}>Follow-up:</label>
          <input
            type="date"
            value={entry.follow_up_date?.split('T')[0] || ''}
            onChange={e => handleFollowUpChange(e.target.value)}
            style={{
              padding: '4px 8px', borderRadius: 6,
              border: `1px solid ${S.border}`, fontSize: 12,
              color: S.textPrimary, background: '#fff', outline: 'none',
            }}
          />
        </div>

        {/* Last called */}
        {entry.last_called && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <PhoneCall size={12} color={S.textMuted} />
            <span style={{ fontSize: 12, color: S.textMuted }}>
              Last: {new Date(entry.last_called).toLocaleDateString()} {new Date(entry.last_called).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

type SortKey = 'company_name' | 'last_called' | 'follow_up_date' | 'status';

export default function CallSheetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [entries, setEntries] = useState<CallSheetEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [sortKey, setSortKey] = useState<SortKey>('company_name');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  // Load members on mount
  useEffect(() => {
    db.team_members.toArray().then(all => {
      setMembers(all);
      // Auto-select from query param
      const memberId = searchParams.get('member');
      if (memberId) {
        const id = parseInt(memberId, 10);
        if (!isNaN(id)) setSelectedMemberId(id);
      } else if (all.length > 0) {
        // don't auto-select; let user pick
      }
    });
  }, [searchParams]);

  // Load data when member changes
  useEffect(() => {
    if (selectedMemberId == null) return;
    loadData(selectedMemberId);
  }, [selectedMemberId]);

  const loadData = async (memberId: number) => {
    const [allCompanies, assignments, existingEntries] = await Promise.all([
      db.companies.toArray(),
      db.lead_assignments.where('team_member_id').equals(memberId).toArray(),
      db.call_sheet_entries.where('team_member_id').equals(memberId).toArray(),
    ]);

    const assignedIds = new Set(assignments.map(a => a.lead_id));
    const assignedCompanies = allCompanies.filter(c => c.id != null && assignedIds.has(c.id));

    // Ensure entries exist for all assigned companies
    const entryMap = new Map(existingEntries.map(e => [e.company_id, e]));
    const now = new Date().toISOString();
    const toCreate: Omit<CallSheetEntry, 'id'>[] = [];

    for (const company of assignedCompanies) {
      if (!entryMap.has(company.id!)) {
        toCreate.push({
          company_id: company.id!,
          team_member_id: memberId,
          status: 'Not Called',
          call_notes: '',
          call_count: 0,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (toCreate.length > 0) {
      const ids = await db.call_sheet_entries.bulkAdd(toCreate as CallSheetEntry[], { allKeys: true }) as number[];
      const newEntries = await db.call_sheet_entries.bulkGet(ids);
      for (const entry of newEntries) {
        if (entry) entryMap.set(entry.company_id, entry);
      }
    }

    const finalEntries = await db.call_sheet_entries.where('team_member_id').equals(memberId).toArray();

    setCompanies(assignedCompanies);
    setEntries(finalEntries);
    setPage(1);
  };

  const handleUpdate = async (id: number, updates: Partial<CallSheetEntry>) => {
    await db.call_sheet_entries.update(id, updates);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  // Compute stats
  const stats = useMemo(() => {
    const total = entries.length;
    const called = entries.filter(e => e.status !== 'Not Called').length;
    const notCalled = entries.filter(e => e.status === 'Not Called').length;
    const interested = entries.filter(e => e.status === 'Interested').length;
    const rejected = entries.filter(e => ['Rejected', 'Unqualified', 'Not Interested', 'Do Not Call'].includes(e.status)).length;
    const today = new Date().toDateString();
    const callbacksToday = entries.filter(e =>
      e.follow_up_date && new Date(e.follow_up_date).toDateString() === today
    ).length;
    return { total, called, notCalled, interested, rejected, callbacksToday };
  }, [entries]);

  // Filter + sort + search
  const companyMap = useMemo(() =>
    new Map(companies.map(c => [c.id!, c])),
    [companies]
  );

  const filtered = useMemo(() => {
    let rows = entries.map(entry => ({ entry, company: companyMap.get(entry.company_id)! }))
      .filter(r => r.company != null);

    if (filterStatus !== 'All') {
      rows = rows.filter(r => r.entry.status === filterStatus);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => {
        const c = r.company;
        const contact = getContactInfo(c);
        return (
          c.company_name.toLowerCase().includes(q) ||
          (c.industry || '').toLowerCase().includes(q) ||
          contact.name.toLowerCase().includes(q) ||
          (r.entry.call_notes || '').toLowerCase().includes(q)
        );
      });
    }

    rows.sort((a, b) => {
      let va: string | number = '';
      let vb: string | number = '';
      if (sortKey === 'company_name') {
        va = a.company.company_name;
        vb = b.company.company_name;
      } else if (sortKey === 'last_called') {
        va = a.entry.last_called || '';
        vb = b.entry.last_called || '';
      } else if (sortKey === 'follow_up_date') {
        va = a.entry.follow_up_date || '9999';
        vb = b.entry.follow_up_date || '9999';
      } else if (sortKey === 'status') {
        va = a.entry.status;
        vb = b.entry.status;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return rows;
  }, [entries, companyMap, filterStatus, search, sortKey, sortAsc]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  // CSV export
  const exportCSV = () => {
    const headers = [
      'Company', 'Industry', 'State/Country', 'Revenue', 'Employees',
      'Year Inc.', 'Contact Name', 'Contact Title', 'Phone', 'Email',
      'LinkedIn', 'Website', 'Status', 'Call Count', 'Last Called',
      'Follow-up Date', 'Call Notes',
    ];
    const rows = filtered.map(({ entry, company }) => {
      const contact = getContactInfo(company);
      return [
        company.company_name,
        company.industry || '',
        company.geography || company.state || '',
        formatRevenue(company.revenue),
        company.employees?.toString() || '',
        company.year_incorporated || '',
        contact.name,
        contact.title,
        contact.phone,
        contact.email,
        contact.linkedin,
        company.website || '',
        entry.status,
        entry.call_count.toString(),
        entry.last_called ? new Date(entry.last_called).toLocaleString() : '',
        entry.follow_up_date || '',
        entry.call_notes || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const memberName = members.find(m => m.id === selectedMemberId)?.name || 'team';
    a.download = `call-sheet-${memberName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        background: sortKey === k ? '#EEF2FF' : 'transparent',
        border: `1px solid ${sortKey === k ? S.primary : S.border}`,
        color: sortKey === k ? S.primary : S.textSecondary,
        padding: '4px 10px', borderRadius: 6, fontSize: 12,
        fontWeight: 500, cursor: 'pointer',
      }}
    >
      {label}
      {sortKey === k ? (
        sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
      ) : null}
    </button>
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: S.textPrimary, margin: 0 }}>Call Sheet</h1>
          {selectedMemberId && (
            <span style={{ background: '#EEF2FF', color: S.primary, padding: '2px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              {stats.total} companies
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
          {selectedMemberId && (
            <button
              onClick={exportCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                border: `1px solid ${S.border}`, background: S.card,
                color: S.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Download size={13} /> Export CSV
            </button>
          )}
          <select
            value={selectedMemberId ?? ''}
            onChange={e => {
              const id = parseInt(e.target.value, 10);
              setSelectedMemberId(isNaN(id) ? null : id);
              navigate(`/call-sheet${isNaN(id) ? '' : `?member=${id}`}`, { replace: true });
            }}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: `1px solid ${S.border}`, background: S.card,
              color: S.textPrimary, fontSize: 14, fontWeight: 500,
              cursor: 'pointer', outline: 'none', minWidth: 180,
            }}
          >
            <option value="">Select team member…</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* No member selected */}
      {!selectedMemberId && (
        <div style={{
          background: S.card, border: `1px solid ${S.border}`,
          borderRadius: 12, padding: '60px 40px', textAlign: 'center',
        }}>
          <PhoneCall size={40} color={S.border} style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary, marginBottom: 8 }}>
            Select a team member
          </div>
          <div style={{ fontSize: 14, color: S.textMuted }}>
            Choose a team member from the dropdown to view their call sheet.
          </div>
          {members.length === 0 && (
            <button
              onClick={() => navigate('/team')}
              style={{
                marginTop: 16, padding: '9px 20px', borderRadius: 8, border: 'none',
                background: S.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Add Team Members
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      {selectedMemberId && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Assigned', value: stats.total, color: S.textPrimary, bg: S.card },
              { label: 'Called', value: stats.called, color: S.success, bg: '#F0FDF4' },
              { label: 'Not Called', value: stats.notCalled, color: S.textMuted, bg: '#F9FAFB' },
              { label: 'Interested', value: stats.interested, color: S.primary, bg: '#EEF2FF' },
              { label: 'Rejected', value: stats.rejected, color: S.danger, bg: '#FEF2F2' },
              { label: 'Callbacks Today', value: stats.callbacksToday, color: S.purple, bg: '#F5F3FF' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: stat.bg, border: `1px solid ${S.border}`,
                borderRadius: 10, padding: '14px 16px', textAlign: 'center' as const,
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} color={S.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search companies, contacts, notes…"
                style={{
                  width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  border: `1px solid ${S.border}`, borderRadius: 8,
                  fontSize: 13, color: S.textPrimary, background: S.card,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              style={{
                padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${S.border}`, background: S.card,
                color: S.textPrimary, fontSize: 13, cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="All">All Statuses</option>
              {CALL_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Sort buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              <SortBtn k="company_name" label="Name" />
              <SortBtn k="follow_up_date" label="Follow-up" />
              <SortBtn k="last_called" label="Last Called" />
              <SortBtn k="status" label="Status" />
            </div>
          </div>

          {/* Results count */}
          <div style={{ fontSize: 13, color: S.textMuted, marginBottom: 12 }}>
            Showing {Math.min(paginated.length, filtered.length)} of {filtered.length} companies
            {filterStatus !== 'All' && ` · filtered by "${filterStatus}"`}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{
              background: S.card, border: `1px solid ${S.border}`,
              borderRadius: 12, padding: '40px', textAlign: 'center' as const,
            }}>
              <div style={{ fontSize: 14, color: S.textMuted }}>
                {entries.length === 0
                  ? 'No companies assigned to this team member. Assign companies on the Leads page.'
                  : 'No results match your filters.'}
              </div>
            </div>
          ) : (
            <>
              {paginated.map(({ entry, company }) => (
                <CallSheetRow
                  key={entry.id}
                  company={company}
                  entry={entry}
                  onUpdate={handleUpdate}
                />
              ))}

              {hasMore && (
                <div style={{ textAlign: 'center' as const, marginTop: 16 }}>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    style={{
                      padding: '10px 28px', borderRadius: 8,
                      border: `1px solid ${S.border}`, background: S.card,
                      color: S.textSecondary, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Load More ({filtered.length - paginated.length} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
