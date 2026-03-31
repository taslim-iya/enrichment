import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuCheckboxItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIChat } from '@/components/AIChat';
import { db, type Lead, type Contact, type TeamMember, type LeadAssignment } from '@/lib/db';
import {
  ALL_STATUSES, US_STATES, ALL_INDUSTRIES, INDUSTRY_LABELS,
  getScoreColor, getStatusColor, formatPhone,
} from '@/lib/constants';
import { useSettingsStore } from '@/lib/store';
import {
  Search, ChevronLeft, ChevronRight, ExternalLink, ChevronDown, ChevronUp,
  ChevronRight as ChevronExpand, MoreHorizontal, PhoneCall, CheckCheck,
  XCircle, StickyNote, Zap, Download, X, Layers, Link2, Building2,
  MapPin, TrendingUp, Newspaper, ArrowUpDown, Columns3, UserPlus, Sparkles, Users,
} from 'lucide-react';

const PAGE_SIZE = 50;

interface LeadWithMeta extends Lead {
  contacts?: Contact[];
  assignment?: { team_member_id: number; member_name: string; avatar_color: string };
}

interface ColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'select', label: '', defaultWidth: 40, defaultVisible: true },
  { key: 'quality_score', label: 'Blueprint Score', defaultWidth: 100, defaultVisible: true },
  { key: 'company_name', label: 'Company Name', defaultWidth: 200, defaultVisible: true },
  { key: 'state', label: 'State', defaultWidth: 70, defaultVisible: true },
  { key: 'industry', label: 'Industry', defaultWidth: 150, defaultVisible: true },
  { key: 'website', label: 'Website', defaultWidth: 160, defaultVisible: true },
  { key: 'employee_count', label: 'Employees', defaultWidth: 100, defaultVisible: true },
  { key: 'contact_name', label: 'Contact', defaultWidth: 180, defaultVisible: true },
  { key: 'email', label: 'Email', defaultWidth: 200, defaultVisible: true },
  { key: 'phone', label: 'Phone', defaultWidth: 140, defaultVisible: true },
  { key: 'status', label: 'Status', defaultWidth: 130, defaultVisible: true },
  { key: 'assigned_to', label: 'Assigned To', defaultWidth: 140, defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultWidth: 100, defaultVisible: true },
  { key: 'founded_year', label: 'Founded', defaultWidth: 80, defaultVisible: false },
  { key: 'linkedin_url', label: 'LinkedIn', defaultWidth: 120, defaultVisible: false },
  { key: 'city', label: 'City', defaultWidth: 100, defaultVisible: false },
  { key: 'source', label: 'Source', defaultWidth: 120, defaultVisible: false },
  { key: 'verified', label: 'Verified', defaultWidth: 80, defaultVisible: false },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [aiFilterLabel, setAiFilterLabel] = useState('');
  const [stats, setStats] = useState({ total: 0, newCount: 0, qualified: 0, won: 0 });

  const { columnWidths, visibleColumns: storedVisibleCols, setVisibleColumns, updateColumnWidth } = useSettingsStore();

  const defaultVisible = new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
  const [visibleColumnsState, setVisibleColumnsState] = useState<Set<string>>(() => {
    if (storedVisibleCols.length > 0) return new Set(storedVisibleCols);
    return defaultVisible;
  });

  const effectiveWidths = useCallback((col: ColumnDef) => {
    return columnWidths[col.key] ?? col.defaultWidth;
  }, [columnWidths]);

  const [resizing, setResizing] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteLead, setNoteLead] = useState<LeadWithMeta | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMemberId, setAssignMemberId] = useState<string>('');

  // Fetch team members
  useEffect(() => {
    db.team_members.toArray().then(setTeamMembers).catch(() => {});
  }, []);

  // Fetch stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const all = await db.leads.toArray();
        setStats({
          total: all.length,
          newCount: all.filter((l) => l.status === 'New').length,
          qualified: all.filter((l) => l.status === 'Booked').length,
          won: all.filter((l) => l.status === 'Existing Partner').length,
        });
      } catch { /* ignore */ }
    };
    loadStats();
  }, [leads]); // re-run whenever leads change

  // Column resize
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const newW = Math.max(50, resizeStartW.current + diff);
      updateColumnWidth(resizing, newW);
    };
    const onUp = () => setResizing(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [resizing, updateColumnWidth]);

  const handleResizeStart = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(key);
    resizeStartX.current = e.clientX;
    resizeStartW.current = columnWidths[key] ?? (ALL_COLUMNS.find((c) => c.key === key)?.defaultWidth ?? 100);
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let collection = db.leads.orderBy(sortBy === 'created_at' ? 'created_at' : sortBy === 'quality_score' ? 'quality_score' : sortBy === 'company_name' ? 'company_name' : 'created_at');

      let all = await collection.toArray();

      if (sortDir === 'desc') all = all.reverse();

      // Filters
      if (search) {
        const q = search.toLowerCase();
        all = all.filter((l) =>
          l.company_name.toLowerCase().includes(q) ||
          (l.contact_name ?? '').toLowerCase().includes(q) ||
          (l.email ?? '').toLowerCase().includes(q) ||
          (l.website ?? '').toLowerCase().includes(q) ||
          (l.state ?? '').toLowerCase().includes(q)
        );
      }
      if (stateFilter) all = all.filter((l) => l.state === stateFilter);
      if (industryFilter) all = all.filter((l) => l.industry === industryFilter);
      if (statusFilter) all = all.filter((l) => l.status === statusFilter);

      setTotal(all.length);
      const paged = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

      // Attach contacts & assignments
      const leadsWithMeta: LeadWithMeta[] = await Promise.all(
        paged.map(async (l) => {
          const contacts = await db.contacts.where('lead_id').equals(l.id!).toArray();
          const assign: LeadAssignment | undefined = await db.lead_assignments.where('lead_id').equals(l.id!).first();
          let assignment: LeadWithMeta['assignment'] | undefined;
          if (assign) {
            const member = await db.team_members.get(assign.team_member_id);
            if (member) {
              assignment = {
                team_member_id: member.id!,
                member_name: member.name,
                avatar_color: member.avatar_color ?? '#6b7280',
              };
            }
          }
          return { ...l, contacts, assignment };
        })
      );

      setLeads(leadsWithMeta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, stateFilter, industryFilter, statusFilter, sortBy, sortDir]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  };

  const handleStatusChange = async (leadId: number, status: string) => {
    await db.leads.update(leadId, { status, updated_at: new Date().toISOString() });
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status } : l));
  };

  const handleAssign = async (leadId: number, memberId: number) => {
    await db.lead_assignments.where('lead_id').equals(leadId).delete();
    await db.lead_assignments.add({ lead_id: leadId, team_member_id: memberId, assigned_at: new Date().toISOString() });
    const member = teamMembers.find((m) => m.id === memberId);
    setLeads((prev) => prev.map((l) => l.id === leadId ? {
      ...l,
      assignment: member ? { team_member_id: member.id!, member_name: member.name, avatar_color: member.avatar_color ?? '#6b7280' } : undefined,
    } : l));
  };

  const handleBulkAssign = async () => {
    if (!assignMemberId || selectedIds.size === 0) return;
    const memberId = parseInt(assignMemberId);
    await Promise.all(Array.from(selectedIds).map((id) => handleAssign(id, memberId)));
    setSelectedIds(new Set());
    setAssignOpen(false);
  };

  const handleBulkStatus = async (status: string) => {
    await Promise.all(Array.from(selectedIds).map((id) => handleStatusChange(id, status)));
    setSelectedIds(new Set());
  };

  const handleExportCSV = () => {
    const sel = leads.filter((l) => selectedIds.has(l.id!));
    const rows = [
      ['Company', 'State', 'Industry', 'Website', 'Score', 'Status', 'Contact', 'Email', 'Phone'].join(','),
      ...sel.map((l) => [
        `"${(l.company_name ?? '').replace(/"/g, '""')}"`,
        l.state ?? '',
        l.industry ?? '',
        `"${(l.website ?? '').replace(/"/g, '""')}"`,
        l.quality_score ?? '',
        `"${(l.status ?? '').replace(/"/g, '""')}"`,
        `"${(l.contact_name ?? '').replace(/"/g, '""')}"`,
        `"${(l.email ?? '').replace(/"/g, '""')}"`,
        formatPhone(l.mobile_phone),
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleColumnVisibility = (key: string) => {
    setVisibleColumnsState((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      setVisibleColumns(Array.from(next));
      return next;
    });
  };

  const clearFilters = () => {
    setSearch(''); setSearchInput(''); setStateFilter('');
    setIndustryFilter(''); setStatusFilter(''); setAiFilterLabel(''); setPage(1);
  };

  const hasFilters = search || stateFilter || industryFilter || statusFilter;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeColumns = ALL_COLUMNS.filter((c) => visibleColumnsState.has(c.key));

  const handleAIFilters = (filters: {
    search?: string; states?: string[]; industries?: string[];
    statuses?: string[];
  }) => {
    if (filters.search !== undefined) { setSearchInput(filters.search); setSearch(filters.search); }
    if (filters.states?.length) setStateFilter(filters.states[0]);
    if (filters.industries?.length) setIndustryFilter(filters.industries[0]);
    if (filters.statuses?.length) setStatusFilter(filters.statuses[0]);
    setPage(1);
    setAiFilterLabel('AI filters applied');
    setTimeout(() => setAiFilterLabel(''), 5000);
  };

  const renderCell = (lead: LeadWithMeta, col: ColumnDef) => {
    const contacts = lead.contacts ?? [];
    const topContact = contacts[0];
    switch (col.key) {
      case 'select':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedIds.has(lead.id!)}
              onCheckedChange={() => {
                setSelectedIds((prev) => {
                  const n = new Set(prev);
                  if (n.has(lead.id!)) n.delete(lead.id!); else n.add(lead.id!);
                  return n;
                });
              }}
            />
          </div>
        );
      case 'quality_score': {
        const score = lead.quality_score;
        const scoreColor = score == null ? '#5c6370' : score >= 70 ? '#00D4AA' : score >= 40 ? '#f59e0b' : '#ef4444';
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tabular-nums w-7 text-right" style={{ color: scoreColor }}>
              {score ?? '—'}
            </span>
            {score != null && (
              <div className="w-10 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, score)}%`, background: scoreColor }}
                />
              </div>
            )}
          </div>
        );
      }
      case 'company_name':
        return (
          <div className="min-w-0">
            <Link to={`/leads/${lead.id}`} className="font-medium text-[#f7f8f8] hover:text-[#6C63FF] truncate block" onClick={(e) => e.stopPropagation()}>
              {lead.company_name}
            </Link>
            {lead.city && <p className="text-xs text-[#95a2b3] truncate">{lead.city}</p>}
          </div>
        );
      case 'state':
        return <span className="font-mono text-sm">{lead.state ?? '-'}</span>;
      case 'industry':
        return lead.industry ? (
          <Badge className="text-xs bg-[#6C63FF]/20 text-[#a09dff] border-[#6C63FF]/30">
            {INDUSTRY_LABELS[lead.industry] ?? lead.industry}
          </Badge>
        ) : <span className="text-xs text-[#95a2b3]">-</span>;
      case 'website':
        return lead.website ? (
          <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
            target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-xs truncate block"
            onClick={(e) => e.stopPropagation()}>
            {lead.domain ?? lead.website}
          </a>
        ) : <span className="text-xs text-[#95a2b3]">-</span>;
      case 'employee_count':
        return <span className="text-sm">{lead.employee_count ?? '-'}</span>;
      case 'contact_name': {
        const display = contacts.slice(0, 2);
        return (
          <div className="space-y-0.5">
            {display.length > 0 ? display.map((c, i) => (
              <div key={i} className="text-xs">
                <span className="text-[#f7f8f8]">{c.name}</span>
                {c.title && <span className="text-[#95a2b3]"> - {c.title}</span>}
              </div>
            )) : <span className="text-sm">{lead.contact_name ?? '-'}</span>}
            {contacts.length > 2 && <Badge className="text-[10px] bg-[#1a1a24] border-[#1f1f2e]">+{contacts.length - 2} more</Badge>}
          </div>
        );
      }
      case 'email': {
        const email = topContact?.email ?? lead.email;
        return email ? (
          <a href={`mailto:${email}`} className="text-xs text-blue-400 hover:text-blue-300 truncate block" onClick={(e) => e.stopPropagation()}>{email}</a>
        ) : <span className="text-xs text-[#95a2b3]">-</span>;
      }
      case 'phone': {
        const phone = topContact?.phone ?? lead.mobile_phone ?? lead.phone_hq;
        return phone ? (
          <span className="text-xs font-mono text-green-400">{formatPhone(phone)}</span>
        ) : <span className="text-xs text-[#95a2b3]">-</span>;
      }
      case 'status': {
        const statusDotColor: Record<string, string> = {
          New: '#6b7280',
          Contacted: '#3b82f6',
          Booked: '#00D4AA',
          'Bad Fit': '#ef4444',
          'Not Interested': '#f97316',
          'Low Interest': '#f59e0b',
          'Existing Partner': '#a855f7',
        };
        const dotColor = statusDotColor[lead.status ?? 'New'] ?? '#6b7280';
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 group">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: dotColor }}
                  />
                  <span className="text-xs font-medium" style={{ color: '#95a2b3' }}>
                    {lead.status}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: '#5c6370' }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {ALL_STATUSES.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleStatusChange(lead.id!, s)}>
                    <span
                      className="w-1.5 h-1.5 rounded-full mr-2 shrink-0"
                      style={{ background: statusDotColor[s] ?? '#6b7280' }}
                    />
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }
      case 'assigned_to':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 hover:opacity-80">
                  {lead.assignment ? (
                    <>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: lead.assignment.avatar_color }}>
                        {lead.assignment.member_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs">{lead.assignment.member_name}</span>
                    </>
                  ) : <span className="text-xs text-[#95a2b3]">Unassigned</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {teamMembers.filter((m) => m.active).map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => handleAssign(lead.id!, m.id!)}>
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: m.avatar_color ?? '#6b7280' }} />
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      case 'actions':
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => {
              setExpandedIds((prev) => {
                const n = new Set(prev);
                if (n.has(lead.id!)) n.delete(lead.id!); else n.add(lead.id!);
                return n;
              });
            }} className="p-1 rounded hover:bg-[#1a1a24] text-[#95a2b3]">
              <ChevronExpand className={`w-4 h-4 transition-transform ${expandedIds.has(lead.id!) ? 'rotate-90' : ''}`} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link to={`/leads/${lead.id}`}><ExternalLink className="w-4 h-4 mr-2" />View Details</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><Zap className="w-4 h-4 mr-2" />Re-enrich</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => alert('Enrichment requires API keys (see Sources page)')}>
                      <Layers className="w-4 h-4 mr-2" />Configure Sources
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleStatusChange(lead.id!, 'Contacted')}>
                  <PhoneCall className="w-4 h-4 mr-2" />Mark Contacted
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange(lead.id!, 'Booked')}>
                  <CheckCheck className="w-4 h-4 mr-2" />Mark Qualified
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange(lead.id!, 'Not Interested')} className="text-red-400">
                  <XCircle className="w-4 h-4 mr-2" />Not Interested
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setNoteLead(lead); setNoteText(lead.human_notes ?? ''); setNoteOpen(true); }}>
                  <StickyNote className="w-4 h-4 mr-2" />Add / Edit Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      case 'founded_year':
        return <span className="text-sm">{lead.founded_year ?? '-'}</span>;
      case 'linkedin_url':
        return lead.linkedin_url ? (
          <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300" onClick={(e) => e.stopPropagation()}>
            <Link2 className="w-4 h-4 inline mr-1" />LinkedIn
          </a>
        ) : <span className="text-xs text-[#95a2b3]">-</span>;
      case 'city':
        return <span className="text-sm">{lead.city ?? '-'}</span>;
      case 'source':
        return <span className="text-xs text-[#95a2b3]">{lead.source ?? '-'}</span>;
      case 'verified':
        return lead.verified ? (
          <Badge className="text-xs bg-green-500/20 text-green-300 border-green-500/30">Yes</Badge>
        ) : <span className="text-xs text-[#95a2b3]">No</span>;
      default:
        return null;
    }
  };

  const renderExpanded = (lead: LeadWithMeta) => {
    const contacts = lead.contacts ?? [];
    const news = Array.isArray(lead.recent_news) ? lead.recent_news : [];
    return (
      <tr key={`exp-${lead.id}`} className="border-b border-[#1f1f2e]/50">
        <td colSpan={activeColumns.length} className="p-0">
          <div className="bg-[#1a1a24]/30 px-6 py-4">
            <Tabs defaultValue="overview">
              <TabsList className="mb-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
                <TabsTrigger value="signals">Signals</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <h4 className="text-xs font-semibold text-[#95a2b3] uppercase mb-2 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />Company</h4>
                    <p className="text-[#95a2b3] text-xs">{lead.agent_notes || 'No notes.'}</p>
                    {lead.data_sources_hit && <p className="text-[#5c6370] text-xs mt-1">Sources: {lead.data_sources_hit}</p>}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#95a2b3] uppercase mb-2 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Location</h4>
                    <p className="text-[#95a2b3] text-xs">{[lead.city, lead.state].filter(Boolean).join(', ') || '-'}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#95a2b3] uppercase mb-2">Enrichment</h4>
                    {lead.enrichment_completeness != null && (
                      <p className="text-[#95a2b3] text-xs">Completeness: {lead.enrichment_completeness}%</p>
                    )}
                    {lead.founded_year && <p className="text-[#95a2b3] text-xs">Founded: {lead.founded_year}</p>}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="contacts">
                {contacts.length > 0 ? (
                  <div className="rounded-lg border border-[#1f1f2e] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1a1a24]">
                        <tr>
                          {['Name', 'Title', 'Email', 'Phone', 'Verified'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-[#95a2b3]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1f1f2e]">
                        {contacts.map((c, i) => (
                          <tr key={i} className="hover:bg-[#1a1a24]/50">
                            <td className="px-3 py-2 text-[#f7f8f8]">{c.name}</td>
                            <td className="px-3 py-2 text-[#95a2b3]">{c.title ?? '-'}</td>
                            <td className="px-3 py-2">{c.email ? <a href={`mailto:${c.email}`} className="text-blue-400">{c.email}</a> : '-'}</td>
                            <td className="px-3 py-2 font-mono text-xs">{c.phone ? formatPhone(c.phone) : '-'}</td>
                            <td className="px-3 py-2">{c.verified ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-[#95a2b3] py-4">No contacts.</p>}
              </TabsContent>
              <TabsContent value="signals">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-[#95a2b3] uppercase mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />Hiring Signals</h4>
                    <p className="text-xs text-[#f7f8f8]/80">{lead.hiring_signals || 'None detected.'}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#95a2b3] uppercase mb-2 flex items-center gap-1"><Newspaper className="w-3.5 h-3.5" />Recent News</h4>
                    {news.length > 0 ? news.slice(0, 3).map((n, i) => (
                      <p key={i} className="text-xs text-[#f7f8f8]/80">{n.title ?? '-'}</p>
                    )) : <p className="text-xs text-[#95a2b3]">None.</p>}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="notes">
                {lead.human_notes ? (
                  <p className="text-sm text-[#f7f8f8]/80 whitespace-pre-line bg-[#1a1a24]/50 rounded p-3">{lead.human_notes}</p>
                ) : (
                  <button className="text-[#95a2b3] text-sm hover:text-[#f7f8f8]"
                    onClick={() => { setNoteLead(lead); setNoteText(''); setNoteOpen(true); }}>
                    + Add a note...
                  </button>
                )}
                {lead.agent_notes && (
                  <div className="mt-3">
                    <p className="text-xs text-[#95a2b3] uppercase mb-1">Agent Notes</p>
                    <p className="text-xs text-[#95a2b3] bg-[#1a1a24]/30 rounded p-2 border-l-2 border-[#1f1f2e]">{lead.agent_notes}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </td>
      </tr>
    );
  };

  const SORTABLE = ['quality_score', 'company_name', 'state', 'created_at'];

  return (
    <div className="space-y-5">
      {/* ── Page header ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#f7f8f8' }}>Leads</h1>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(108,99,255,0.15)', color: '#a09dff' }}
            >
              {total.toLocaleString()}
            </span>
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: '#5c6370' }}>
            Insurance leads — enriched &amp; ready to contact
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Columns3 className="w-4 h-4 mr-1.5" />Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.filter((c) => c.key !== 'select').map((col) => (
                <DropdownMenuCheckboxItem key={col.key} checked={visibleColumnsState.has(col.key)}
                  onCheckedChange={() => toggleColumnVisibility(col.key)}
                  onSelect={(e) => e.preventDefault()}>
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Leads', value: stats.total, color: '#6C63FF', border: 'rgba(108,99,255,0.5)' },
          { label: 'New', value: stats.newCount, color: '#95a2b3', border: 'rgba(149,162,179,0.4)' },
          { label: 'Qualified', value: stats.qualified, color: '#00D4AA', border: 'rgba(0,212,170,0.5)' },
          { label: 'Partners', value: stats.won, color: '#a855f7', border: 'rgba(168,85,247,0.5)' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4 relative overflow-hidden"
            style={{
              background: '#0f0f14',
              border: '1px solid #1f1f2e',
              borderLeftColor: stat.border,
              borderLeftWidth: '3px',
            }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: '#5c6370' }}>
              {stat.label}
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: stat.color }}>
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-2 flex-1 min-w-64">
              <Input placeholder="Search company, contact, email..." value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="flex-1" />
              <Button onClick={handleSearch} size="icon" variant="secondary">
                <Search className="w-4 h-4" />
              </Button>
            </div>
            <Select value={stateFilter || 'all'} onValueChange={(v) => { setStateFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-28"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={industryFilter || 'all'} onValueChange={(v) => { setIndustryFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Industry" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {ALL_INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{INDUSTRY_LABELS[i]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-3.5 h-3.5 mr-1" />Clear</Button>
            )}
          </div>
          {aiFilterLabel && (
            <div className="mt-2">
              <Badge className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                <Sparkles className="w-3 h-3 mr-1" />{aiFilterLabel}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Table ───────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f1f2e' }}>
        <div className="overflow-x-auto">
          <table className="leads-table" style={{ minWidth: '100%' }}>
            <thead>
              <tr>
                {activeColumns.map((col) => {
                  const isSortable = SORTABLE.includes(col.key);
                  const isSorted = sortBy === col.key;
                  const w = effectiveWidths(col);
                  return (
                    <th key={col.key}
                      className={`relative select-none ${isSortable ? 'cursor-pointer' : ''}`}
                      style={{ width: `${w}px`, minWidth: `${w}px` }}
                      onClick={() => isSortable && handleSort(col.key)}>
                      <div className="flex items-center gap-1">
                        {col.key === 'select' ? (
                          <Checkbox
                            checked={leads.length > 0 && selectedIds.size === leads.length}
                            onCheckedChange={() => {
                              if (selectedIds.size === leads.length) setSelectedIds(new Set());
                              else setSelectedIds(new Set(leads.map((l) => l.id!)));
                            }}
                          />
                        ) : (
                          <span className="truncate" style={isSortable && isSorted ? { color: '#f7f8f8' } : undefined}>
                            {col.label}
                          </span>
                        )}
                        {isSortable && isSorted && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" style={{ color: '#6C63FF' }} /> : <ChevronDown className="w-3 h-3" style={{ color: '#6C63FF' }} />)}
                        {isSortable && !isSorted && <ArrowUpDown className="w-3 h-3 opacity-20" />}
                      </div>
                      {col.key !== 'select' && col.key !== 'actions' && (
                        <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#6C63FF]/40"
                          onMouseDown={(e) => handleResizeStart(col.key, e)} />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeColumns.length} className="p-12 text-center" style={{ color: '#5c6370' }}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-t-[#6C63FF] animate-spin" style={{ borderColor: '#2a2a3e', borderTopColor: '#6C63FF' }} />
                      <span className="text-sm">Loading leads…</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length} className="p-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1" style={{ background: 'rgba(108,99,255,0.1)' }}>
                        <Users className="w-5 h-5" style={{ color: '#6C63FF' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: '#95a2b3' }}>
                        {hasFilters ? 'No leads match your filters' : 'No leads yet'}
                      </p>
                      <p className="text-xs" style={{ color: '#5c6370' }}>
                        {hasFilters ? 'Try adjusting or clearing your filters.' : 'Import a CSV or add leads manually to get started.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : leads.flatMap((lead) => {
                const isExpanded = expandedIds.has(lead.id!);
                const isSelected = selectedIds.has(lead.id!);
                const row = (
                  <tr key={`row-${lead.id}`}
                    className={`cursor-pointer transition-colors duration-75 leads-table-row ${isSelected ? 'is-selected' : ''}`}
                    style={{
                      borderBottom: '1px solid rgba(31,31,46,0.6)',
                      background: isSelected
                        ? 'rgba(108,99,255,0.05)'
                        : isExpanded
                        ? '#141419'
                        : undefined,
                    }}
                    onMouseEnter={e => {
                      if (!isSelected && !isExpanded)
                        (e.currentTarget as HTMLTableRowElement).style.background = '#141419';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected && !isExpanded)
                        (e.currentTarget as HTMLTableRowElement).style.background = '';
                    }}
                    onClick={() => {
                      setExpandedIds((prev) => {
                        const n = new Set(prev);
                        if (n.has(lead.id!)) n.delete(lead.id!); else n.add(lead.id!);
                        return n;
                      });
                    }}>
                    {activeColumns.map((col) => (
                      <td key={col.key} className="p-3"
                        style={{ width: `${effectiveWidths(col)}px`, maxWidth: `${effectiveWidths(col)}px` }}>
                        {renderCell(lead, col)}
                      </td>
                    ))}
                  </tr>
                );
                return isExpanded ? [row, renderExpanded(lead)] : [row];
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#95a2b3]">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <span className="text-sm text-[#95a2b3]">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-64 right-0 z-40 border-t border-[#1f1f2e] bg-[#09090b]/95 backdrop-blur px-6 py-3 shadow-2xl">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold">{selectedIds.size} selected</span>
            <div className="h-4 w-px bg-[#1f1f2e]" />
            <Button size="sm" variant="secondary" onClick={() => handleBulkStatus('Contacted')}>
              <PhoneCall className="w-3.5 h-3.5 mr-1.5" />Mark Contacted
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleBulkStatus('Booked')}>
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />Mark Qualified
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />Assign
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5 mr-1.5" />Export CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="w-3.5 h-3.5 mr-1" />Clear
            </Button>
          </div>
        </div>
      )}

      {/* Note dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add / Edit Note</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Write your notes here..." className="min-h-32" autoFocus />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" disabled={noteSaving} onClick={async () => {
              if (!noteLead?.id) return;
              setNoteSaving(true);
              await db.leads.update(noteLead.id, { human_notes: noteText, updated_at: new Date().toISOString() });
              setLeads((prev) => prev.map((l) => l.id === noteLead.id ? { ...l, human_notes: noteText } : l));
              setNoteOpen(false);
              setNoteSaving(false);
            }}>
              {noteSaving ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign {selectedIds.size} Lead(s)</DialogTitle></DialogHeader>
          <Select value={assignMemberId} onValueChange={setAssignMemberId}>
            <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
            <SelectContent>
              {teamMembers.filter((m) => m.active).map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: m.avatar_color ?? '#6b7280' }} />
                    {m.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={handleBulkAssign} disabled={!assignMemberId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Chat */}
      <AIChat onApplyFilters={handleAIFilters} currentFilters={{ search, stateFilter, industryFilter, statusFilter }} />
    </div>
  );
}
