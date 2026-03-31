import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type Lead, type TeamMember, type LeadAssignment } from '../lib/db';
import { formatPhone } from '../lib/constants';
import { PhoneCall, CheckCircle, XCircle } from 'lucide-react';

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  New: { bg: '#E8F5E9', color: '#2E7D32' },
  Contacted: { bg: '#E3F2FD', color: '#1565C0' },
  Booked: { bg: '#E0F2F1', color: '#00695C' },
  'Bad Fit': { bg: '#FFEBEE', color: '#C62828' },
  'Not Interested': { bg: '#FFF3E0', color: '#E65100' },
  'Existing Partner': { bg: '#F3E5F5', color: '#7B1FA2' },
  'Low Interest': { bg: '#FFFDE7', color: '#F57F17' },
};

export default function CallSheetPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [assignments, setAssignments] = useState<LeadAssignment[]>([]);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      db.leads.toArray(),
      db.team_members.toArray(),
      db.lead_assignments.toArray(),
    ]).then(([l, m, a]) => {
      setLeads(l);
      setMembers(m.filter((m) => m.active));
      setAssignments(a);
    });
  }, []);

  const myAssignments = selectedMember
    ? assignments.filter((a) => a.team_member_id === selectedMember)
    : [];
  const myLeadIds = new Set(myAssignments.map((a) => a.lead_id));
  const myLeads = leads.filter((l) => l.id != null && myLeadIds.has(l.id!));

  const newCount = myLeads.filter((l) => l.status === 'New').length;
  const contactedCount = myLeads.filter((l) => l.status === 'Contacted').length;
  const bookedCount = myLeads.filter((l) => l.status === 'Booked').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0A2540' }}>Call Sheet</h1>
          <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>Your assigned leads to call today</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, color: '#425466', fontWeight: 500 }}>View as:</label>
          <select
            value={selectedMember ?? ''}
            onChange={(e) => setSelectedMember(e.target.value ? parseInt(e.target.value) : null)}
            style={{ padding: '9px 14px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 13, background: '#fff', color: '#0A2540', cursor: 'pointer' }}
          >
            <option value="">Select team member...</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedMember ? (
        <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 60, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#425466' }}>Select a team member</p>
          <p style={{ fontSize: 13, color: '#8898aa', marginTop: 4 }}>Choose a team member above to see their call sheet.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Assigned', value: myLeads.length, borderColor: '#635BFF' },
              { label: 'New', value: newCount, borderColor: '#059669' },
              { label: 'Contacted', value: contactedCount, borderColor: '#3b82f6' },
            ].map((stat) => (
              <div key={stat.label} style={{ background: '#fff', border: '1px solid #E3E8EE', borderLeft: `3px solid ${stat.borderColor}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#0A2540', marginTop: 4 }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Lead List */}
          {myLeads.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 60, textAlign: 'center' }}>
              <PhoneCall size={32} style={{ color: '#8898aa', marginBottom: 12 }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: '#425466' }}>No leads assigned</p>
              <p style={{ fontSize: 13, color: '#8898aa', marginTop: 4 }}>Assign leads to this team member from the Leads page.</p>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F6F9FC' }}>
                    {['#', 'Company', 'Contact', 'Phone', 'Status', 'Notes', ''].map((col) => (
                      <th key={col} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E3E8EE' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myLeads.map((lead, i) => {
                    const badge = STATUS_BADGE[lead.status] ?? { bg: '#F6F9FC', color: '#425466' };
                    return (
                      <tr
                        key={lead.id}
                        style={{ borderBottom: '1px solid #E3E8EE', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F6F9FC')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                      >
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#8898aa', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '14px 16px', fontSize: 14, color: '#0A2540', fontWeight: 600 }}>{lead.company_name}</td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#425466' }}>
                          <div>{lead.contact_name || '—'}</div>
                          {lead.contact_title && <div style={{ fontSize: 12, color: '#8898aa' }}>{lead.contact_title}</div>}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#425466', whiteSpace: 'nowrap' }}>
                          {formatPhone(lead.mobile_phone || lead.phone_hq) || '—'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: badge.bg, color: badge.color }}>
                            {lead.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#8898aa', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.human_notes || '—'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={() => navigate(`/leads/${lead.id}`)}
                            style={{ background: 'none', border: '1px solid #E3E8EE', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#635BFF', cursor: 'pointer' }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
