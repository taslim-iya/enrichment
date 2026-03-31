import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { db, type Lead, type Contact } from '@/lib/db';
import { ALL_STATUSES, getStatusColor, getScoreColor, formatPhone, INDUSTRY_LABELS } from '@/lib/constants';
import {
  ArrowLeft, ExternalLink, Save, Loader2, Link2, Phone, Mail,
  Building2, MapPin,  Globe, User, FileText,
} from 'lucide-react';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editIndustry, setEditIndustry] = useState('');

  useEffect(() => {
    if (!id) return;
    const leadId = parseInt(id);
    Promise.all([
      db.leads.get(leadId),
      db.contacts.where('lead_id').equals(leadId).toArray(),
    ]).then(([l, c]) => {
      if (l) {
        setLead(l);
        setEditStatus(l.status);
        setEditNotes(l.human_notes ?? '');
        setEditName(l.contact_name ?? '');
        setEditTitle(l.contact_title ?? '');
        setEditEmail(l.email ?? '');
        setEditPhone(l.mobile_phone ?? '');
        setEditWebsite(l.website ?? '');
        setEditIndustry(l.industry ?? '');
      }
      setContacts(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!lead?.id) return;
    setSaving(true);
    await db.leads.update(lead.id, {
      status: editStatus,
      human_notes: editNotes,
      contact_name: editName,
      contact_title: editTitle,
      email: editEmail,
      mobile_phone: editPhone,
      website: editWebsite,
      industry: editIndustry,
      updated_at: new Date().toISOString(),
    });
    setLead((prev) => prev ? {
      ...prev, status: editStatus, human_notes: editNotes,
      contact_name: editName, contact_title: editTitle,
      email: editEmail, mobile_phone: editPhone,
      website: editWebsite, industry: editIndustry,
    } : prev);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[#95a2b3]" />
    </div>
  );

  if (!lead) return (
    <div className="text-center py-20">
      <p className="text-[#95a2b3] text-lg">Lead not found.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate('/leads')}>
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Leads
      </Button>
    </div>
  );

  const enrichmentData = lead.enrichment_data as Record<string, unknown> | null;
  const recentNews = Array.isArray(lead.recent_news) ? lead.recent_news : [];
  const scoreBreakdown = lead.score_breakdown as Record<string, unknown> | null;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link to="/leads" className="mt-1 text-[#95a2b3] hover:text-[#f7f8f8]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#f7f8f8' }}>{lead.company_name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge className={`text-sm border ${getStatusColor(lead.status)}`}>{lead.status}</Badge>
              {lead.quality_score != null && (
                <Badge className={`text-sm border font-bold ${getScoreColor(lead.quality_score)}`}>
                  Score: {lead.quality_score}
                </Badge>
              )}
              {lead.industry && (
                <Badge className="text-sm bg-[#6C63FF]/20 text-[#a09dff] border-[#6C63FF]/30">
                  {INDUSTRY_LABELS[lead.industry] ?? lead.industry}
                </Badge>
              )}
              {lead.verified && (
                <Badge className="text-sm bg-green-500/20 text-green-300 border-green-500/30">Verified</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead.website && (
            <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="w-4 h-4 mr-2" />Website</Button>
            </a>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="enrichment">Enrichment</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Company Info */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />Company Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#95a2b3] text-xs">Founded</p>
                    <p className="text-[#f7f8f8]">{lead.founded_year ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[#95a2b3] text-xs">Employees</p>
                    <p className="text-[#f7f8f8]">{lead.employee_count ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[#95a2b3] text-xs">Location</p>
                    <p className="text-[#f7f8f8] flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{[lead.city, lead.state].filter(Boolean).join(', ') || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#95a2b3] text-xs">Source</p>
                    <p className="text-[#f7f8f8]">{lead.source ?? '-'}</p>
                  </div>
                </div>
                {enrichmentData?.description ? (
                  <div>
                    <p className="text-[#95a2b3] text-xs mb-1">Description</p>
                    <p className="text-[#f7f8f8]/80 text-xs">{String(enrichmentData.description)}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-2">
                  {lead.linkedin_url && (
                    <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                      <Link2 className="w-3.5 h-3.5" />LinkedIn
                    </a>
                  )}
                  {lead.website && (
                    <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                      <Globe className="w-3.5 h-3.5" />Website
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Edit Form */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Edit Lead</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Industry</Label>
                  <Input value={editIndustry} onChange={(e) => setEditIndustry(e.target.value)} placeholder="e.g. trucking" />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://..." />
                </div>
              </CardContent>
            </Card>

            {/* Primary Contact */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" />Primary Contact</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Contact name" />
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Job title" />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#95a2b3] shrink-0" />
                    <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@company.com" className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label>Phone</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#95a2b3] shrink-0" />
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(555) 555-5555" className="flex-1" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Signals */}
            {(lead.hiring_signals || recentNews.length > 0) && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Signals</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {lead.hiring_signals && (
                    <div>
                      <p className="text-xs text-[#95a2b3] uppercase mb-1">Hiring Signals</p>
                      <p className="text-sm text-[#f7f8f8]/80">{lead.hiring_signals}</p>
                    </div>
                  )}
                  {recentNews.length > 0 && (
                    <div>
                      <p className="text-xs text-[#95a2b3] uppercase mb-1">Recent News</p>
                      <div className="space-y-1">
                        {recentNews.slice(0, 5).map((n, i) => (
                          <div key={i} className="text-xs">
                            {n.url ? (
                              <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{n.title ?? 'News'}</a>
                            ) : <p className="text-[#f7f8f8]/80">{n.title ?? 'News'}</p>}
                            {n.date && <p className="text-[#5c6370] text-[10px]">{n.date}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          {contacts.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-[#1a1a24] border-b border-[#1f1f2e]">
                    <tr>
                      {['Name', 'Title', 'Email', 'Phone', 'Source', 'Verified'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-[#95a2b3]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f1f2e]">
                    {contacts.map((c, i) => (
                      <tr key={i} className="hover:bg-[#1a1a24]/50">
                        <td className="px-4 py-3 text-[#f7f8f8] font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-[#95a2b3]">{c.title ?? '-'}</td>
                        <td className="px-4 py-3">{c.email ? <a href={`mailto:${c.email}`} className="text-blue-400 hover:text-blue-300">{c.email}</a> : '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.phone ? formatPhone(c.phone) : '-'}</td>
                        <td className="px-4 py-3 text-[#95a2b3] text-xs">{c.source ?? '-'}</td>
                        <td className="px-4 py-3">{c.verified ? <Badge className="text-xs bg-green-500/20 text-green-300 border-green-500/30">Yes</Badge> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-[#95a2b3]">No contacts for this lead.</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="enrichment" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Enrichment Data</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#95a2b3]">Completeness</p>
                  <p className="text-[#f7f8f8]">{lead.enrichment_completeness != null ? `${lead.enrichment_completeness}%` : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#95a2b3]">Data Sources</p>
                  <p className="text-[#f7f8f8] text-xs">{lead.data_sources_hit || '-'}</p>
                </div>
                {enrichmentData && Object.entries(enrichmentData).slice(0, 6).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-[#95a2b3] capitalize">{k.replace(/_/g, ' ')}</p>
                    <p className="text-[#f7f8f8] text-xs truncate">{String(v)}</p>
                  </div>
                ))}
              </div>
              {scoreBreakdown && (
                <>
                  <Separator className="my-4" />
                  <p className="text-xs font-semibold text-[#95a2b3] uppercase mb-2">Score Breakdown</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(scoreBreakdown).map(([k, v]) => (
                      <div key={k} className="text-xs bg-[#1a1a24] rounded px-2 py-1">
                        <span className="text-[#95a2b3]">{k.replace(/_/g, ' ')}: </span>
                        <span className="text-[#f7f8f8] font-medium">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Your Notes</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about this lead..." className="min-h-32" />
              </div>
              {lead.agent_notes && (
                <div>
                  <Label>Agent Notes (read-only)</Label>
                  <p className="text-sm text-[#95a2b3] whitespace-pre-line bg-[#1a1a24]/50 rounded p-3 border-l-2 border-[#1f1f2e]">
                    {lead.agent_notes}
                  </p>
                </div>
              )}
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {saved ? 'Saved!' : 'Save Notes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
