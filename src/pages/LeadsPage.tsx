import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, Building2, Globe, Users, ChevronUp, ChevronDown } from 'lucide-react';
import { db, type Company, upsertCompanies } from '../lib/db';
import { useSettingsStore } from '../lib/store';
import { startDealFlowSync } from '../lib/sync';

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

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  New: { bg: '#EEF2FF', color: '#635BFF' },
  Contacted: { bg: '#FEF9C3', color: '#92400e' },
  Booked: { bg: '#D1FAE5', color: '#065F46' },
  'Bad Fit': { bg: '#FEE2E2', color: '#991B1B' },
  'Not Interested': { bg: '#F3F4F6', color: '#6B7280' },
  'Existing Partner': { bg: '#E0F2FE', color: '#0369A1' },
  'Low Interest': { bg: '#FEF3C7', color: '#92400e' },
};

function StatusBadge({ status }: { status?: string }) {
  const s = STATUS_COLORS[status || 'New'] || { bg: '#F3F4F6', color: '#6B7280' };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {status || 'New'}
    </span>
  );
}

type SortKey = keyof Company | '';
type SortDir = 'asc' | 'desc';

export default function LeadsPage() {
  const navigate = useNavigate();
  const { dealflowUrl, apiKey, setLastSync } = useSettingsStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterGeo, setFilterGeo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('company_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncError, setSyncError] = useState('');

  const loadCompanies = async () => {
    const all = await db.companies.toArray();
    setCompanies(all);
  };

  useEffect(() => { loadCompanies(); }, []);

  const industries = useMemo(() => [...new Set(companies.map(c => c.industry).filter(Boolean))].sort() as string[], [companies]);
  const geos = useMemo(() => [...new Set(companies.map(c => c.geography || c.state).filter(Boolean))].sort() as string[], [companies]);
  const statuses = useMemo(() => [...new Set(companies.map(c => c.status).filter(Boolean))].sort() as string[], [companies]);

  const filtered = useMemo(() => {
    let list = companies;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.company_name?.toLowerCase().includes(q) ||
        c.director?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.geography?.toLowerCase().includes(q)
      );
    }
    if (filterIndustry) list = list.filter(c => c.industry === filterIndustry);
    if (filterGeo) list = list.filter(c => c.geography === filterGeo || c.state === filterGeo);
    if (filterStatus) list = list.filter(c => c.status === filterStatus);

    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = String(a[sortKey as keyof Company] || '').toLowerCase();
        const bv = String(b[sortKey as keyof Company] || '').toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [companies, search, filterIndustry, filterGeo, filterStatus, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleSync = () => {
    if (!apiKey) {
      setSyncError('Please set your API key in Settings first.');
      return;
    }
    setSyncing(true);
    setSyncProgress(0);
    setSyncTotal(0);
    setSyncError('');

    startDealFlowSync(
      dealflowUrl,
      apiKey,
      async (batch, sent, total) => {
        setSyncProgress(sent);
        setSyncTotal(total);
        await upsertCompanies(batch);
      },
      async (total) => {
        setSyncing(false);
        setSyncProgress(total);
        setLastSync(new Date().toISOString(), total);
        await loadCompanies();
      },
      (err) => {
        setSyncing(false);
        setSyncError(err);
      }
    );
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: 4 }} />
      : <ChevronDown size={12} style={{ marginLeft: 4 }} />;
  };

  const withContacts = companies.filter(c => c.director || c.contact_name).length;

  return (
    <div>
      {/* Header */}
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
          {syncing ? `Syncing… ${syncProgress.toLocaleString()}${syncTotal ? `/${syncTotal.toLocaleString()}` : ''}` : 'Sync'}
        </button>
      </div>

      {/* Sync progress */}
      {syncing && syncTotal > 0 && (
        <div style={{ marginBottom: 16, background: STRIPE.card, border: `1px solid ${STRIPE.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, color: STRIPE.textSecondary, marginBottom: 8 }}>
            Syncing companies from DealFlow… {syncProgress.toLocaleString()} / {syncTotal.toLocaleString()}
          </div>
          <div style={{ height: 6, background: '#E3E8EE', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((syncProgress / syncTotal) * 100)}%`,
              background: STRIPE.primary,
              borderRadius: 3,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Error */}
      {syncError && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA', color: STRIPE.danger,
          fontSize: 13,
        }}>
          {syncError}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { icon: Building2, label: 'Total', value: companies.length.toLocaleString() },
          { icon: Globe, label: 'Industries', value: industries.length.toString() },
          { icon: Globe, label: 'Geographies', value: geos.length.toString() },
          { icon: Users, label: 'With Contacts', value: withContacts.toLocaleString() },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{
              flex: 1, background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
              borderRadius: 12, padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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

      {/* Filters */}
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: '16px 20px', marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: STRIPE.textMuted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies…"
            style={{
              width: '100%', padding: '8px 12px 8px 32px',
              border: `1px solid ${STRIPE.border}`, borderRadius: 8,
              fontSize: 14, color: STRIPE.textPrimary, background: STRIPE.bg,
              outline: 'none',
            }}
          />
        </div>
        {[
          { label: 'Industry', value: filterIndustry, onChange: setFilterIndustry, options: industries },
          { label: 'Geography', value: filterGeo, onChange: setFilterGeo, options: geos },
          { label: 'Status', value: filterStatus, onChange: setFilterStatus, options: statuses },
        ].map(f => (
          <select
            key={f.label}
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            style={{
              flex: '0 0 160px', padding: '8px 12px',
              border: `1px solid ${STRIPE.border}`, borderRadius: 8,
              fontSize: 14, color: f.value ? STRIPE.textPrimary : STRIPE.textMuted,
              background: STRIPE.bg, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">{f.label}: All</option>
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
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
            Go to Settings to connect your DealFlow account.
          </div>
        </div>
      ) : (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ background: STRIPE.tableHeaderBg, borderBottom: `1px solid ${STRIPE.border}` }}>
                  {[
                    { label: 'Company Name', key: 'company_name' as SortKey },
                    { label: 'State/Country', key: 'geography' as SortKey },
                    { label: 'Industry', key: 'industry' as SortKey },
                    { label: 'Employees', key: 'employees' as SortKey },
                    { label: 'Revenue', key: 'revenue' as SortKey },
                    { label: 'P/L', key: 'profit' as SortKey },
                    { label: 'Assets', key: 'assets' as SortKey },
                    { label: 'Status', key: 'status' as SortKey },
                    { label: 'Director', key: 'director' as SortKey },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '11px 16px', textAlign: 'left', fontSize: 12,
                        fontWeight: 600, color: STRIPE.textMuted, cursor: 'pointer',
                        userSelect: 'none', whiteSpace: 'nowrap',
                        letterSpacing: '0.02em',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {col.label}
                        <SortIcon col={col.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/leads/${c.id}`)}
                    style={{
                      borderBottom: i < filtered.length - 1 ? `1px solid ${STRIPE.border}` : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = STRIPE.tableRowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: STRIPE.textPrimary }}>
                      {c.company_name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: STRIPE.textSecondary }}>
                      {c.geography || c.state || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: STRIPE.textSecondary }}>
                      {c.industry || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: STRIPE.textSecondary }}>
                      {c.employees || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: STRIPE.textSecondary }}>
                      {c.revenue || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: STRIPE.textSecondary }}>
                      {c.profit || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: STRIPE.textSecondary }}>
                      {c.assets || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: STRIPE.textSecondary }}>
                      {c.director || c.contact_name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && companies.length > 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: STRIPE.textMuted, fontSize: 14 }}>
              No companies match your filters.
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
