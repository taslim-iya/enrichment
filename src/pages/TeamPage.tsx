import { useState, useEffect } from 'react';
import { db, type TeamMember } from '../lib/db';
import { UserPlus, Trash2, Users } from 'lucide-react';

const AVATAR_COLORS = ['#635BFF', '#059669', '#E25950', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

function Avatar({ name, color }: { name: string; color?: string }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const bg = color ?? AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', background: bg, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('SDR');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.team_members.toArray().then(setMembers);
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const id = await db.team_members.add({
      name: newName.trim(),
      email: newEmail.trim() || undefined,
      role: newRole,
      avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      active: true,
      created_at: new Date().toISOString(),
    });
    const all = await db.team_members.toArray();
    setMembers(all);
    setNewName('');
    setNewEmail('');
    setNewRole('SDR');
    setShowAdd(false);
    setSaving(false);
  };

  const handleToggleActive = async (member: TeamMember) => {
    await db.team_members.update(member.id!, { active: !member.active });
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, active: !m.active } : m));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this team member?')) return;
    await db.team_members.delete(id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const active = members.filter((m) => m.active);
  const inactive = members.filter((m) => !m.active);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0A2540' }}>Team</h1>
          <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>Manage your sales team members</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#635BFF', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <UserPlus size={16} /> Add Member
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Members', value: members.length, borderColor: '#635BFF' },
          { label: 'Active', value: active.length, borderColor: '#059669' },
          { label: 'Inactive', value: inactive.length, borderColor: '#8898aa' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', border: '1px solid #E3E8EE', borderLeft: `3px solid ${stat.borderColor}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#0A2540', marginTop: 4 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Add Member Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0A2540', marginBottom: 20 }}>Add Team Member</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Name *</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 14 }} placeholder="Full name" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Email</label>
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 14 }} placeholder="email@company.com" type="email" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8898aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E3E8EE', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
                  {['SDR', 'AE', 'Manager', 'Admin', 'Other'].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={handleAdd} disabled={saving || !newName.trim()} style={{ flex: 1, background: '#635BFF', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Adding...' : 'Add Member'}
              </button>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: '#F6F9FC', color: '#425466', border: '1px solid #E3E8EE', padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 60, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <Users size={36} style={{ color: '#8898aa', marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#425466' }}>No team members yet</p>
          <p style={{ fontSize: 13, color: '#8898aa', marginTop: 4 }}>Add your first team member to get started.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {members.map((member, i) => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                borderBottom: i < members.length - 1 ? '1px solid #E3E8EE' : 'none',
                opacity: member.active ? 1 : 0.5,
              }}
            >
              <Avatar name={member.name} color={member.avatar_color} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#0A2540' }}>{member.name}</p>
                <p style={{ fontSize: 12, color: '#8898aa', marginTop: 1 }}>
                  {member.role}{member.email ? ` · ${member.email}` : ''}
                </p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                background: member.active ? '#ECFDF5' : '#F6F9FC',
                color: member.active ? '#059669' : '#8898aa',
              }}>
                {member.active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => handleToggleActive(member)}
                style={{ background: 'none', border: '1px solid #E3E8EE', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#425466', cursor: 'pointer' }}
              >
                {member.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => handleDelete(member.id!)}
                style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: '#E25950' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
