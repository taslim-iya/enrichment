import { useState, useEffect } from 'react';
import { Users, Plus, Trash2 } from 'lucide-react';
import { db, type TeamMember } from '../lib/db';
import { AVATAR_COLORS } from '../lib/constants';

const STRIPE = {
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  danger: '#E25950',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
  bg: '#F6F9FC',
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');

  const loadMembers = async () => {
    const all = await db.team_members.toArray();
    setMembers(all);
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
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {members.map((member, i) => (
            <div key={member.id} style={{
              display: 'flex', alignItems: 'center', padding: '14px 20px',
              borderBottom: i < members.length - 1 ? `1px solid ${STRIPE.border}` : 'none',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 20,
                background: member.avatar_color || STRIPE.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, fontWeight: 700,
                marginRight: 14, flexShrink: 0,
              }}>
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: STRIPE.textPrimary }}>{member.name}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: STRIPE.textMuted }}>{member.role}</span>
                  {member.email && (
                    <span style={{ fontSize: 12, color: STRIPE.textMuted }}>{member.email}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => member.id != null && handleDelete(member.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: STRIPE.textMuted, padding: 4,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
