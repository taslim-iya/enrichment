import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Search, Building2, Globe, Users,
  ChevronUp, ChevronDown, SlidersHorizontal, X,
} from 'lucide-react';
import { db, type Company, upsertCompanies } from '../lib/db';
import { useSettingsStore } from '../lib/store';
import { startDealFlowSync } from '../lib/sync';

// ─── Design tokens ───────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

const STRIPE = {
  bg: '#F6F9FC',
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  success: '#059669',
  danger: '#E25950',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
  tableHeaderBg: '#F6F9FC',
  tableRowHover: '#F0F2F5',
};

// ─── Column config ───────────────────────────────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  default: boolean;
  width: number;
  format?: 'currency' | 'number' | 'date';
}

const ALL_COLUMNS: ColDef[] = [
  { key: 'company_name',       label: 'Company Name',   default: true,  width: 220 },
  { key: 'timezone',           label: 'Timezone',       default: true,  width: 100 },
  { key: 'geography',          label: 'State/Country',  default: true,  width: 130 },
  { key: 'industry',           label: 'Industry',       default: true,  width: 160 },
  { key: 'nace',               label: 'NACE Code',      default: false, width: 100 },
  { key: 'sic_code',           label: 'SIC Code',       default: false, width: 100 },
  { key: 'employees',          label: 'Employees',      default: true,  width: 100, format: 'number' },
  { key: 'revenue',            label: 'Revenue',        default: true,  width: 120, format: 'currency' },
  { key: 'profit_before_tax',  label: 'P/L Before Tax', default: true,  width: 130, format: 'currency' },
  { key: 'total_assets',       label: 'Total Assets',   default: false, width: 130, format: 'currency' },
  { key: 'equity',             label: 'Equity',         default: false, width: 120, format: 'currency' },
  { key: 'website',            label: 'Website',        default: true,  width: 180 },
  { key: 'description',        label: 'Description',    default: false, width: 260 },
  { key: 'address',            label: 'Address',        default: false, width: 200 },
  { key: 'directors_list',     label: 'Directors',      default: true,  width: 250 },
  { key: 'director_name',      label: 'Primary Director', default: false, width: 150 },
  { key: 'director_title',     label: 'Director Title', default: false, width: 130 },
  { key: 'contacts_list',      label: 'Contacts',       default: true,  width: 280 },
  { key: 'contact_email',      label: 'Contact Email',  default: true,  width: 200 },
  { key: 'contact_phone',      label: 'Contact Phone',  default: true,  width: 140 },
  { key: 'contact_linkedin',   label: 'LinkedIn',       default: true,  width: 180 },
  { key: 'year_incorporated',  label: 'Year Inc.',      default: true,  width: 90 },
  { key: 'status',             label: 'Status',         default: true,  width: 120 },
  { key: 'score',              label: 'Score',          default: false, width: 80,  format: 'number' },
  { key: 'qualification_score', label: 'Q. Score',      default: false, width: 80,  format: 'number' },
  { key: 'source',             label: 'Source',         default: true,  width: 120 },
  { key: 'tags',               label: 'Tags',           default: false, width: 160 },
  { key: 'notes',              label: 'Notes',          default: false, width: 200 },
  { key: 'created_at',         label: 'Created',        default: false, width: 100, format: 'date' },
  { key: 'updated_at',         label: 'Updated',        default: false, width: 100, format: 'date' },
  { key: 'assigned_to',        label: 'Assigned To',    default: true,  width: 140 },
];

const DEFAULT_COL_KEYS = ALL_COLUMNS.filter(c => c.default).map(c => c.key);

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCell(value: unknown, format?: string): string {
  if (value == null || value === '' || value === undefined) return '—';
  if (format === 'currency') {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return '—';
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
    return `${sign}$${abs.toLocaleString()}`;
  }
  if (format === 'number') {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return '—';
    return num.toLocaleString();
  }
  if (format === 'date') {
    try { return new Date(String(value)).toLocaleDateString(); } catch { return String(value); }
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  New:                { bg: '#EEF2FF', color: '#635BFF' },
  Contacted:          { bg: '#FEF9C3', color: '#92400e' },
  Booked:             { bg: '#D1FAE5', color: '#065F46' },
  'Bad Fit':          { bg: '#FEE2E2', color: '#991B1B' },
  'Not Interested':   { bg: '#F3F4F6', color: '#6B7280' },
  'Existing Partner': { bg: '#E0F2FE', color: '#0369A1' },
  'Low Interest':     { bg: '#FEF3C7', color: '#92400e' },
};

function StatusBadge({ status }: { status?: string }) {
  const s = STATUS_COLORS[status || 'New'] || { bg: '#F3F4F6', color: '#6B7280' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {status || 'New'}
    </span>
  );
}

// ─── Cell renderer ───────────────────────────────────────────────────────────

function Cell({ col, company, width }: { col: ColDef; company: Company; width: number }) {
  const raw = company[col.key as keyof Company];

  if (col.key === 'company_name') {
    return (
      <td style={{ padding: '10px 16px', maxWidth: width, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' }}>
          <span style={{
            fontSize: 14, fontWeight: 600, color: STRIPE.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={String(company.company_name)}>
            {company.company_name}
          </span>
        </div>
      </td>
    );
  }

  if (col.key === 'status') {
    return (
      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
        <StatusBadge status={String(raw || '')} />
      </td>
    );
  }

  // Directors list — show up to 3
  if (col.key === 'directors_list') {
    const dirs = (company.directors as { name: string; title: string }[]) || [];
    const primary = company.director_name || company.director;
    const allDirs: { name: string; title: string }[] = [];
    if (dirs.length > 0) {
      allDirs.push(...dirs.slice(0, 3));
    } else if (primary) {
      allDirs.push({ name: String(primary), title: String(company.director_title || '') });
    }
    if (allDirs.length === 0) return <td style={{ padding: '10px 16px', fontSize: 13, color: STRIPE.textMuted }}>—</td>;
    return (
      <td style={{ padding: '8px 16px', maxWidth: width }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {allDirs.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: STRIPE.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d.name}
              </span>
              {d.title && (
                <span style={{ fontSize: 11, color: STRIPE.textMuted, whiteSpace: 'nowrap' }}>
                  {d.title}
                </span>
              )}
            </div>
          ))}
          {dirs.length > 3 && (
            <span style={{ fontSize: 11, color: STRIPE.primary, fontWeight: 500 }}>+{dirs.length - 3} more</span>
          )}
        </div>
      </td>
    );
  }

  // Contacts list — show up to 3 with email/phone
  if (col.key === 'contacts_list') {
    const contacts = (company.contacts as { name: string; title?: string; email?: string; phone?: string }[]) || [];
    if (contacts.length === 0) return <td style={{ padding: '10px 16px', fontSize: 13, color: STRIPE.textMuted }}>—</td>;
    return (
      <td style={{ padding: '8px 16px', maxWidth: width }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {contacts.slice(0, 3).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: STRIPE.textPrimary, whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
              {c.email && (
                <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: STRIPE.primary, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  {c.email}
                </a>
              )}
            </div>
          ))}
          {contacts.length > 3 && (
            <span style={{ fontSize: 11, color: STRIPE.primary, fontWeight: 500 }}>+{contacts.length - 3} more</span>
          )}
        </div>
      </td>
    );
  }

  // Contact email — first contact's email
  if (col.key === 'contact_email') {
    const contacts = (company.contacts as { email?: string }[]) || [];
    const email = contacts.find(c => c.email)?.email;
    if (!email) return <td style={{ padding: '10px 16px', fontSize: 13, color: STRIPE.textMuted }}>—</td>;
    return (
      <td style={{ padding: '10px 16px' }}>
        <a href={`mailto:${email}`} onClick={e => e.stopPropagation()} style={{ fontSize: 13, color: STRIPE.primary, textDecoration: 'none' }}>{email}</a>
      </td>
    );
  }

  // Contact phone — first contact's phone
  if (col.key === 'contact_phone') {
    const contacts = (company.contacts as { phone?: string }[]) || [];
    const phone = contacts.find(c => c.phone)?.phone;
    if (!phone) return <td style={{ padding: '10px 16px', fontSize: 13, color: STRIPE.textMuted }}>—</td>;
    return (
      <td style={{ padding: '10px 16px' }}>
        <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} style={{ fontSize: 13, color: STRIPE.textSecondary, textDecoration: 'none' }}>{phone}</a>
      </td>
    );
  }

  // Assigned To — show team member name(s)
  if (col.key === 'assigned_to') {
    const companyAssignments = ((window as any).__e1_assignments || []).filter((a: any) => a.lead_id === company.id);
    const memberMap: Record<number, string> = ((window as any).__e1_teamMembers || []).reduce((acc: any, m: any) => ({ ...acc, [m.id]: m.name }), {});
    const names = companyAssignments.map((a: any) => memberMap[a.team_member_id]).filter(Boolean);
    if (names.length === 0) return <td style={{ padding: '10px 16px', fontSize: 13, color: STRIPE.textMuted }}>—</td>;
    return (
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {names.map((n: string, i: number) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 500, color: STRIPE.primary, background: '#EEF2FF', borderRadius: 4, padding: '1px 8px' }}>{n}</span>
          ))}
        </div>
      </td>
    );
  }

  // LinkedIn — clickable link from contacts
  if (col.key === 'contact_linkedin') {
    const contacts = (company.contacts as { linkedin_url?: string }[]) || [];
    const url = contacts.find(c => c.linkedin_url)?.linkedin_url;
    if (!url) return <td style={{ padding: '10px 16px', fontSize: 13, color: STRIPE.textMuted }}>—</td>;
    return (
      <td style={{ padding: '10px 16px', maxWidth: width, overflow: 'hidden' }}>
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          style={{ fontSize: 13, color: '#0A66C2', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '') || 'View Profile'}
        </a>
      </td>
    );
  }

  // Website — clickable link
  if (col.key === 'website') {
    const url = company.website;
    if (!url) return <td style={{ padding: '10px 16px', fontSize: 13, color: STRIPE.textMuted }}>—</td>;
    const href = String(url).startsWith('http') ? String(url) : `https://${url}`;
    const display = String(url).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    return (
      <td style={{ padding: '10px 16px', maxWidth: width, overflow: 'hidden' }}>
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          style={{ fontSize: 13, color: STRIPE.primary, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
          title={String(url)}>
          {display}
        </a>
      </td>
    );
  }

  if (col.key === 'timezone') {
    const tz = company.timezone;
    if (!tz) return <td style={{ padding: '10px 16px', fontSize: 13, color: STRIPE.textMuted }}>—</td>;
    return (
      <td style={{ padding: '10px 16px' }}>
        <span style={{
          fontSize: 12, fontWeight: 600, color: '#635BFF',
          background: '#EEF2FF', borderRadius: 5, padding: '2px 8px',
          whiteSpace: 'nowrap',
        }}>
          {tz}
        </span>
      </td>
    );
  }

  const formatted = formatCell(raw, col.format);
  const isTruncatable = !col.format && formatted.length > 30;

  return (
    <td style={{ padding: '10px 16px', maxWidth: width, overflow: 'hidden' }}>
      <span
        title={isTruncatable ? formatted : undefined}
        style={{
          display: 'block',
          fontSize: 13,
          color: STRIPE.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {formatted}
      </span>
    </td>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';

export default function LeadsPage() {
  const navigate = useNavigate();
  const {
    dealflowUrl, apiKey, setLastSync,
    visibleColumns, setVisibleColumns,
    columnWidths, updateColumnWidth,
  } = useSettingsStore();

  const [companies, setCompanies]       = useState<Company[]>([]);
  const [search, setSearch]             = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterGeo, setFilterGeo]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTimezone, setFilterTimezone] = useState('');
  const [filterTeamMember, setFilterTeamMember] = useState('');
  const [teamMembers, setTeamMembers] = useState<{ id: number; name: string }[]>([]);
  const [assignments, setAssignments] = useState<{ lead_id: number; team_member_id: number }[]>([]);
  const [sortKey, setSortKey]           = useState('company_name');
  const [sortDir, setSortDir]           = useState<SortDir>('asc');
  const [page, setPage]                 = useState(1);
  const [syncing, setSyncing]           = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal]       = useState(0);
  const [syncError, setSyncError]       = useState('');
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const colPickerRef = useRef<HTMLDivElement>(null);
  const resizingRef  = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

  // Derive active columns, respecting custom order
  const activeCols = visibleColumns.length > 0 ? visibleColumns : DEFAULT_COL_KEYS;
  const { columnOrder, setColumnOrder } = useSettingsStore();
  const visibleColDefs = useMemo(() => {
    const cols = ALL_COLUMNS.filter(c => activeCols.includes(c.key));
    if (columnOrder.length > 0) {
      const orderMap = new Map(columnOrder.map((k, i) => [k, i]));
      cols.sort((a, b) => {
        const ai = orderMap.get(a.key) ?? 999;
        const bi = orderMap.get(b.key) ?? 999;
        return ai - bi;
      });
    }
    return cols;
  }, [activeCols, columnOrder]);

  // Drag-to-reorder state
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = (key: string) => { setDragCol(key); };
  const handleDragOver = (e: React.DragEvent, key: string) => { e.preventDefault(); setDragOverCol(key); };
  const handleDrop = (targetKey: string) => {
    if (!dragCol || dragCol === targetKey) { setDragCol(null); setDragOverCol(null); return; }
    const order = visibleColDefs.map(c => c.key);
    const fromIdx = order.indexOf(dragCol);
    const toIdx = order.indexOf(targetKey);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, dragCol);
    setColumnOrder(order);
    setDragCol(null);
    setDragOverCol(null);
  };

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadCompanies = useCallback(async () => {
    const all = await db.companies.toArray();
    setCompanies(all);
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => {
    (async () => {
      const members = await db.team_members.toArray();
      setTeamMembers(members.filter(m => m.active).map(m => ({ id: m.id!, name: m.name })));
      const assigns = await db.lead_assignments.toArray();
      setAssignments(assigns.map(a => ({ lead_id: a.lead_id, team_member_id: a.team_member_id })));
    })();
  }, []);
  useEffect(() => { setPage(1); }, [search, filterIndustry, filterGeo, filterStatus, filterTimezone, filterTeamMember]);

  // ── Close column picker on outside click ──────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Resizable columns ─────────────────────────────────────────────────────

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { col, startX, startWidth } = resizingRef.current;
      const newWidth = Math.max(60, startWidth + (e.clientX - startX));
      updateColumnWidth(col, newWidth);
    };
    const onUp = () => { resizingRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [updateColumnWidth]);

  const startResize = useCallback((col: string, e: React.MouseEvent, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { col, startX: e.clientX, startWidth: currentWidth };
  }, []);

  // ── Filters & sort ────────────────────────────────────────────────────────

  const industries = useMemo(
    () => [...new Set(companies.map(c => c.industry).filter(Boolean))].sort() as string[],
    [companies],
  );
  const geos = useMemo(
    () => [...new Set(companies.map(c => c.geography || c.state).filter(Boolean))].sort() as string[],
    [companies],
  );
  const statuses = useMemo(
    () => [...new Set(companies.map(c => c.status).filter(Boolean))].sort() as string[],
    [companies],
  );
  const timezones = useMemo(
    () => [...new Set(companies.map(c => c.timezone).filter(Boolean))].sort() as string[],
    [companies],
  );

  const filtered = useMemo(() => {
    let list = companies;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.company_name?.toLowerCase().includes(q) ||
        c.director_name?.toLowerCase().includes(q) ||
        c.director?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.geography?.toLowerCase().includes(q) ||
        c.timezone?.toLowerCase().includes(q),
      );
    }
    if (filterIndustry) list = list.filter(c => c.industry === filterIndustry);
    if (filterGeo)      list = list.filter(c => c.geography === filterGeo || c.state === filterGeo);
    if (filterStatus)   list = list.filter(c => c.status === filterStatus);
    if (filterTimezone) list = list.filter(c => c.timezone === filterTimezone);
    if (filterTeamMember) {
      const memberAssignedIds = new Set(assignments.filter(a => a.team_member_id === Number(filterTeamMember)).map(a => a.lead_id));
      list = list.filter(c => c.id && memberAssignedIds.has(c.id));
    }

    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = a[sortKey as keyof Company];
        const bv = b[sortKey as keyof Company];
        // numeric sort for number fields
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        const as = String(av || '').toLowerCase();
        const bs = String(bv || '').toLowerCase();
        const cmp = as.localeCompare(bs);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [companies, search, filterIndustry, filterGeo, filterStatus, filterTimezone, sortKey, sortDir]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleSync = () => {
    if (!apiKey) { setSyncError('Please set your API key in Settings first.'); return; }
    setSyncing(true); setSyncProgress(0); setSyncTotal(0); setSyncError('');
    startDealFlowSync(
      dealflowUrl, apiKey,
      async (batch, sent, total) => {
        setSyncProgress(sent); setSyncTotal(total);
        await upsertCompanies(batch);
      },
      async (total) => {
        setSyncing(false); setSyncProgress(total);
        setLastSync(new Date().toISOString(), total);
        await loadCompanies();
      },
      (err) => { setSyncing(false); setSyncError(err); },
    );
  };

  const toggleColumn = (key: string) => {
    const next = activeCols.includes(key)
      ? activeCols.filter(k => k !== key)
      : [...activeCols, key];
    // preserve ALL_COLUMNS order
    setVisibleColumns(ALL_COLUMNS.map(c => c.key).filter(k => next.includes(k)));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.3, marginLeft: 3, fontSize: 10 }}>↕</span>;
    return sortDir === 'asc'
      ? <ChevronUp size={11} style={{ marginLeft: 3 }} />
      : <ChevronDown size={11} style={{ marginLeft: 3 }} />;
  };

  const withContacts = companies.filter(c =>
    c.director_name || c.director || c.contact_name ||
    (c.contacts && (c.contacts as unknown[]).length > 0)
  ).length;

  const filterBar = [
    { label: 'Industry',  value: filterIndustry,  onChange: setFilterIndustry,  options: industries },
    { label: 'Geography', value: filterGeo,        onChange: setFilterGeo,       options: geos },
    { label: 'Status',    value: filterStatus,     onChange: setFilterStatus,    options: statuses },
    { label: 'Timezone',  value: filterTimezone,   onChange: setFilterTimezone,  options: timezones },
    { label: 'Team Member', value: filterTeamMember, onChange: setFilterTeamMember, options: teamMembers.map(m => m.id!.toString()), optionLabels: teamMembers.reduce((acc, m) => ({ ...acc, [m.id!.toString()]: m.name }), {} as Record<string, string>) },
  ];

  // Expose to Cell renderer (Cell is outside this component scope)
  (window as any).__e1_assignments = assignments;
  (window as any).__e1_teamMembers = teamMembers;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: STRIPE.textPrimary }}>Companies</h1>
          <span style={{
            background: '#EEF2FF', color: '#635BFF',
            padding: '2px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600,
          }}>
            {companies.length.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Column picker */}
          <div ref={colPickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowColumnPicker(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 8,
                border: `1px solid ${STRIPE.border}`,
                background: showColumnPicker ? '#EEF2FF' : STRIPE.card,
                color: showColumnPicker ? STRIPE.primary : STRIPE.textSecondary,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={14} /> Columns
            </button>

            {showColumnPicker && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 200,
                background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
                borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: '12px 0', minWidth: 220, maxHeight: 420, overflowY: 'auto',
              }}>
                <div style={{
                  padding: '0 16px 10px', fontSize: 11, fontWeight: 700,
                  color: STRIPE.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  Toggle Columns
                </div>
                {ALL_COLUMNS.map(col => (
                  <label
                    key={col.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 16px', cursor: 'pointer', fontSize: 13,
                      color: activeCols.includes(col.key) ? STRIPE.textPrimary : STRIPE.textMuted,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = STRIPE.bg)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input
                      type="checkbox"
                      checked={activeCols.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      style={{ accentColor: STRIPE.primary, width: 14, height: 14 }}
                    />
                    <span style={{ fontWeight: activeCols.includes(col.key) ? 600 : 400 }}>
                      {col.label}
                    </span>
                  </label>
                ))}
                <div style={{ borderTop: `1px solid ${STRIPE.border}`, margin: '8px 0 0' }}>
                  <button
                    onClick={() => setVisibleColumns(DEFAULT_COL_KEYS)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 16px', fontSize: 12, color: STRIPE.primary,
                      background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: syncing ? '#E3E8EE' : STRIPE.primary,
              color: syncing ? STRIPE.textMuted : '#fff',
              fontSize: 14, fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing
              ? `Syncing… ${syncProgress.toLocaleString()}${syncTotal ? `/${syncTotal.toLocaleString()}` : ''}`
              : 'Sync'
            }
          </button>
        </div>
      </div>

      {/* ── Sync progress bar ── */}
      {syncing && syncTotal > 0 && (
        <div style={{
          marginBottom: 16, background: STRIPE.card,
          border: `1px solid ${STRIPE.border}`, borderRadius: 10, padding: 16,
        }}>
          <div style={{ fontSize: 13, color: STRIPE.textSecondary, marginBottom: 8 }}>
            Syncing companies from DealFlow… {syncProgress.toLocaleString()} / {syncTotal.toLocaleString()}
          </div>
          <div style={{ height: 6, background: '#E3E8EE', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((syncProgress / syncTotal) * 100)}%`,
              background: STRIPE.primary, borderRadius: 3, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {syncError && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA', color: STRIPE.danger, fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {syncError}
          <X size={14} style={{ cursor: 'pointer' }} onClick={() => setSyncError('')} />
        </div>
      )}

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { icon: Building2, label: 'Total',        value: companies.length.toLocaleString() },
          { icon: Globe,     label: 'Industries',   value: industries.length.toString() },
          { icon: Globe,     label: 'Geographies',  value: geos.length.toString() },
          { icon: Users,     label: 'With Contacts', value: withContacts.toLocaleString() },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{
              flex: 1, background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
              borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon size={14} color={STRIPE.textMuted} />
                <span style={{ fontSize: 12, color: STRIPE.textMuted, fontWeight: 500 }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: STRIPE.textPrimary }}>{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: '14px 18px', marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: STRIPE.textMuted,
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies, directors, timezone…"
            style={{
              width: '100%', padding: '8px 12px 8px 32px',
              border: `1px solid ${STRIPE.border}`, borderRadius: 8,
              fontSize: 13, color: STRIPE.textPrimary, background: STRIPE.bg, outline: 'none',
            }}
          />
        </div>
        {filterBar.map(f => (
          <select
            key={f.label}
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            style={{
              flex: '0 0 150px', padding: '8px 10px',
              border: `1px solid ${STRIPE.border}`, borderRadius: 8,
              fontSize: 13,
              color: f.value ? STRIPE.textPrimary : STRIPE.textMuted,
              background: STRIPE.bg, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">{f.label}: All</option>
            {f.options.map(o => <option key={o} value={o}>{(f as any).optionLabels?.[o] || o}</option>)}
          </select>
        ))}
        {(filterIndustry || filterGeo || filterStatus || filterTimezone || search) && (
          <button
            onClick={() => {
              setFilterIndustry(''); setFilterGeo('');
              setFilterStatus(''); setFilterTimezone(''); setSearch('');
            }}
            style={{
              padding: '7px 12px', borderRadius: 8,
              border: `1px solid ${STRIPE.border}`,
              background: 'none', color: STRIPE.textMuted,
              fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {companies.length === 0 ? (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: '60px 40px', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <Building2 size={40} color={STRIPE.border} style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 8 }}>
            No companies synced yet
          </div>
          <div style={{ fontSize: 14, color: STRIPE.textMuted }}>
            Go to Settings to connect your DealFlow account, then click Sync.
          </div>
        </div>
      ) : (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, tableLayout: 'fixed' }}>
              <colgroup>
                {visibleColDefs.map(col => (
                  <col key={col.key} style={{ width: columnWidths[col.key] || col.width }} />
                ))}
              </colgroup>
              <thead>
                <tr style={{ background: STRIPE.tableHeaderBg, borderBottom: `1px solid ${STRIPE.border}` }}>
                  {visibleColDefs.map(col => {
                    const colWidth = columnWidths[col.key] || col.width;
                    const isDragTarget = dragOverCol === col.key && dragCol !== col.key;
                    return (
                      <th
                        key={col.key}
                        draggable
                        onDragStart={() => handleDragStart(col.key)}
                        onDragOver={(e) => handleDragOver(e, col.key)}
                        onDrop={() => handleDrop(col.key)}
                        onDragEnd={() => { setDragCol(null); setDragOverCol(null); }}
                        onClick={() => handleSort(col.key)}
                        style={{
                          padding: '10px 16px 10px 16px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700, color: STRIPE.textMuted,
                          cursor: 'grab', userSelect: 'none', whiteSpace: 'nowrap',
                          borderLeft: isDragTarget ? `2px solid ${STRIPE.primary}` : 'none',
                          opacity: dragCol === col.key ? 0.5 : 1,
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                          position: 'relative', overflow: 'hidden',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {col.label}
                          <SortIcon col={col.key} />
                        </span>
                        {/* Resize handle */}
                        <span
                          onMouseDown={e => startResize(col.key, e, colWidth)}
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute', right: 0, top: 0, bottom: 0, width: 6,
                            cursor: 'col-resize', opacity: 0,
                            background: STRIPE.primary,
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, PAGE_SIZE * page).map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/leads/${c.id}`)}
                    style={{
                      borderBottom: `1px solid ${STRIPE.border}`,
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = STRIPE.tableRowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {visibleColDefs.map(col => (
                      <Cell key={col.key} col={col} company={c} width={columnWidths[col.key] || col.width} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Result count + Load More */}
          <div style={{
            padding: '10px 18px', borderTop: `1px solid ${STRIPE.border}`,
            fontSize: 12, color: STRIPE.textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>
              Showing {Math.min(PAGE_SIZE * page, filtered.length).toLocaleString()} of{' '}
              {filtered.length === companies.length
                ? `${companies.length.toLocaleString()} companies`
                : `${filtered.length.toLocaleString()} (${companies.length.toLocaleString()} total)`
              }
            </span>
            {PAGE_SIZE * page < filtered.length && (
              <button
                onClick={() => setPage(p => p + 1)}
                style={{
                  background: STRIPE.primary, color: '#fff', border: 'none',
                  padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Load More ({(filtered.length - PAGE_SIZE * page).toLocaleString()} remaining)
              </button>
            )}
            {filtered.length === 0 && companies.length > 0 && (
              <span style={{ color: STRIPE.textMuted }}>No companies match your filters.</span>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { color: #0A2540; }
      `}</style>
    </div>
  );
}
