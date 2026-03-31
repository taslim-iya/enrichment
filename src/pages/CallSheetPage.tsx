import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db, type Lead, type TeamMember, type LeadAssignment } from '@/lib/db';
import { getScoreColor, getStatusColor, formatPhone, ALL_STATUSES } from '@/lib/constants';
import { PhoneCall, ExternalLink, CheckCheck } from 'lucide-react';

interface CallLead extends Lead {
  assignedMember?: TeamMember;
}

export default function CallSheetPage() {
  const [leads, setLeads] = useState<CallLead[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.team_members.toArray().then(setTeamMembers).catch(() => {});
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const assignments: LeadAssignment[] = await db.lead_assignments.toArray();
      const allLeads = await db.leads.where('status').anyOf(['New', 'Contacted', 'Low Interest']).toArray();

      const callLeads: CallLead[] = await Promise.all(
        allLeads.map(async (l) => {
          const assign = assignments.find((a) => a.lead_id === l.id);
          if (assign) {
            const member = await db.team_members.get(assign.team_member_id);
            return { ...l, assignedMember: member };
          }
          return l;
        })
      );

      // Sort by quality_score desc
      callLeads.sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0));
      setLeads(callLeads);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (leadId: number, status: string) => {
    await db.leads.update(leadId, { status, updated_at: new Date().toISOString() });
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status } : l));
  };

  const filtered = selectedMember === 'all'
    ? leads
    : selectedMember === 'unassigned'
    ? leads.filter((l) => !l.assignedMember)
    : leads.filter((l) => l.assignedMember?.id === parseInt(selectedMember));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#f7f8f8]">For Me</h1>
          <p className="text-[#95a2b3] mt-1">Your call sheet — leads to contact today</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter by member" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {teamMembers.filter((m) => m.active).map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[#f7f8f8]">{filtered.length}</p>
            <p className="text-xs text-[#95a2b3]">Total on sheet</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[#6C63FF]">{filtered.filter((l) => l.status === 'New').length}</p>
            <p className="text-xs text-[#95a2b3]">Not yet contacted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[#00D4AA]">{filtered.filter((l) => l.quality_score && l.quality_score >= 70).length}</p>
            <p className="text-xs text-[#95a2b3]">High quality (70+)</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <p className="text-[#95a2b3] text-center py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <PhoneCall className="w-12 h-12 mx-auto mb-4 text-[#95a2b3]/30" />
            <p className="text-[#95a2b3]">No leads on your call sheet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <Card key={lead.id} className="hover:border-[#6C63FF]/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/leads/${lead.id}`} className="font-semibold text-[#f7f8f8] hover:text-[#6C63FF]">
                        {lead.company_name}
                      </Link>
                      {lead.quality_score != null && (
                        <Badge className={`text-xs border font-bold ${getScoreColor(lead.quality_score)}`}>
                          {lead.quality_score}
                        </Badge>
                      )}
                      <Badge className={`text-xs border ${getStatusColor(lead.status)}`}>{lead.status}</Badge>
                      {lead.state && <span className="text-xs font-mono text-[#95a2b3]">{lead.state}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#95a2b3]">
                      {lead.contact_name && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-[#f7f8f8]">{lead.contact_name}</span>
                          {lead.contact_title && <span>— {lead.contact_title}</span>}
                        </span>
                      )}
                      {(lead.mobile_phone || lead.phone_hq) && (
                        <span className="font-mono text-green-400 flex items-center gap-1">
                          <PhoneCall className="w-3 h-3" />
                          {formatPhone(lead.mobile_phone || lead.phone_hq)}
                        </span>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="text-blue-400 hover:text-blue-300 text-xs">{lead.email}</a>
                      )}
                    </div>
                    {lead.human_notes && (
                      <p className="mt-2 text-xs text-[#95a2b3] line-clamp-2">{lead.human_notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.assignedMember && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: lead.assignedMember.avatar_color ?? '#6b7280' }}
                        title={lead.assignedMember.name}>
                        {lead.assignedMember.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => handleStatusChange(lead.id!, 'Contacted')}>
                      <PhoneCall className="w-3.5 h-3.5 mr-1" />Called
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleStatusChange(lead.id!, 'Booked')}>
                      <CheckCheck className="w-3.5 h-3.5 mr-1" />Booked
                    </Button>
                    <Link to={`/leads/${lead.id}`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {ALL_STATUSES.map((s) => {
          const count = filtered.filter((l) => l.status === s).length;
          return count > 0 ? (
            <Badge key={s} className={`text-xs border cursor-pointer ${getStatusColor(s)}`}>
              {s}: {count}
            </Badge>
          ) : null;
        })}
      </div>
    </div>
  );
}
