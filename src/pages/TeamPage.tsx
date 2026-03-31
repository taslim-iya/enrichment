import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, PhoneCall, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, type TeamMember } from '../lib/db';
import { AVATAR_COLORS } from '../lib/constants';

const STRIPE = {
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  danger: '#E25950',
  success: '#059669',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
  bg: '#F6F9FC',
};

interface MemberStats {
  assignedCount: number;
  callsMade: number;
}

export default function TeamPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberStats, setMemberStats] = useState<Record<number, MemberStats>>({});
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');

  const loadMembers = async () => {
    const all = await db.team_members.toArray();
    setMembers(all);

    // Load stats for each member
    const stats: Record<number, MemberStats> = {};
    for (const member of all) {
      if (member.id == null) continue;
      const assignments = await db.lead_assignments.where('team_member_id').equals(member.id).toArray();
      const callEntries = await db.call_sheet_entries.where('team_member_id').equals(member.id).toArray();
      const callsMade = callEntries.filter(e => e.status !== 'Not Called').length;
      stats[member.id] = { assignedCount: assignments.length, callsMade };
    }
    setMemberStats(stats);
  };

  useEffect(() => { loadMembers(); }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const colorIdx = members.length % AVATAR_COLORS.length;
    await db.team_members.add({
      name: name.trim(),
      email: email.trim() || undefined,
      role: role.trim() || 'Member',
      avatar_color: AVATAR_COLORS[colorIdx],
      active: true,
      created_at: new Date().toISOString(),
    });
    setName('');
    setEmail('');
    setRole('');
    setShowForm(false);
    loadMembers();
  };

  const handleDelete = async (id: number) => {
    await db.team_members.delete(id);
    loadMembers();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: STRIPE.textPrimary }}>Team</h1>
          <span style={{ background: '#EEF2FF', color: '#635BFF', padding: '2px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            {members.length}
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: STRIPE.primary, color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Member
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: 20, marginBottom: 20,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 16 }}>
            Add Team Member
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: STRIPE.textSecondary, marginBottom: 4 }}>Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                style={{
                  width: '100%', padding: '9px 12px', border: `1px solid ${STRIPE.border}`,
                  borderRadius: 8, fontSize: 14, color: STRIPE.textPrimary, background: STRIPE.bg,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: STRIPE.textSecondary, marginBottom: 4 }}>Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                type="email"
                style={{
                  width: '100%', padding: '9px 12px', border: `1px solid ${STRIPE.border}`,
                  borderRadius: 8, fontSize: 14, color: STRIPE.textPrimary, background: STRIPE.bg,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: STRIPE.textSecondary, marginBottom: 4 }}>Role</label>
            <input
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="Sales Rep"
              style={{
                width: '100%', padding: '9px 12px', border: `1px solid ${STRIPE.border}`,
                borderRadius: 8, fontSize: 14, color: STRIPE.textPrimary, background: STRIPE.bg,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleAdd}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: STRIPE.primary, color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Add Member
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: '9px 20px', borderRadius: 8,
                border: `1px solid ${STRIPE.border}`, background: STRIPE.card,
                color: STRIPE.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Members List */}
      {members.length === 0 ? (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: '60px 40px', textAlign: 'center',
        }}>
          <Users size={40} color={STRIPE.border} style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 8 }}>No team members yet</div>
          <div style={{ fontSize: 14, color: STRIPE.textMuted }}>Add your first team member to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {members.map((member) => {
            const stats = memberStats[member.id!] || { assignedCount: 0, callsMade: 0 };
            return (
              <div key={member.id} style={{
                background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
                borderRadius: 12, padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: 22,
                  background: member.avatar_color || STRIPE.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 18, fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {member.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: STRIPE.textPrimary }}>{member.name}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: 12, color: STRIPE.textMuted }}>{member.role}</span>
                    {member.email && (
                      <span style={{ fontSize: 12, color: STRIPE.textMuted }}>{member.email}</span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                      <Building2 size={12} color={STRIPE.textMuted} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: STRIPE.textPrimary }}>{stats.assignedCount}</span>
                    </div>
                    <div style={{ fontSize: 11, color: STRIPE.textMuted }}>Assigned</div>
                  </div>
                  <div style={{ width: 1, height: 32, background: STRIPE.border }} />
                  <div style={{ textAlign: 'center' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                      <PhoneCall size={12} color={STRIPE.success} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: STRIPE.success }}>{stats.callsMade}</span>
                    </div>
                    <div style={{ fontSize: 11, color: STRIPE.textMuted }}>Calls Made</div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => navigate(`/call-sheet?member=${member.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 7,
                      border: `1px solid ${STRIPE.primary}`,
                      background: '#EEF2FF', color: STRIPE.primary,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <PhoneCall size={12} /> View Call Sheet
                  </button>
                  <button
                    onClick={() => member.id != null && handleDelete(member.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: STRIPE.textMuted, padding: 6,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
