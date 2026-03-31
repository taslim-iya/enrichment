import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { db, type TeamMember } from '@/lib/db';
import { AVATAR_COLORS } from '@/lib/constants';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-300 border-red-500/30',
  manager: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  member: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export default function TeamPage() {
  const [members, setMembers] = useState<(TeamMember & { assigned_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [saving, setSaving] = useState(false);

  const loadMembers = async () => {
    const all = await db.team_members.toArray();
    const withCounts = await Promise.all(all.map(async (m) => {
      const count = await db.lead_assignments.where('team_member_id').equals(m.id!).count();
      return { ...m, assigned_count: count };
    }));
    setMembers(withCounts);
    setLoading(false);
  };

  useEffect(() => { loadMembers(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setRole('member');
    setDialogOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditingId(m.id!);
    setName(m.name);
    setEmail(m.email ?? '');
    setRole(m.role);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    if (editingId) {
      await db.team_members.update(editingId, { name, email: email || undefined, role });
    } else {
      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      await db.team_members.add({ name, email: email || undefined, role, avatar_color: color, active: true, created_at: now });
    }
    setDialogOpen(false);
    setSaving(false);
    loadMembers();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this team member? Their lead assignments will be deleted.')) return;
    await db.lead_assignments.where('team_member_id').equals(id).delete();
    await db.team_members.delete(id);
    loadMembers();
  };

  const handleToggleActive = async (m: TeamMember) => {
    await db.team_members.update(m.id!, { active: !m.active });
    loadMembers();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#f7f8f8' }}>Team</h1>
          <p className="text-[#95a2b3] mt-1">Manage team members and lead assignments</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />Add Member
        </Button>
      </div>

      {loading ? (
        <p className="text-[#95a2b3] text-center py-12">Loading...</p>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-[#95a2b3]/30" />
            <h3 className="text-lg font-semibold text-[#f7f8f8] mb-2">No team members yet</h3>
            <p className="text-[#95a2b3] text-sm mb-4">Add team members to start assigning leads.</p>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add First Member</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: member.avatar_color ?? '#6b7280' }}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#f7f8f8]">{member.name}</span>
                        <Badge className={`text-xs border ${ROLE_COLORS[member.role] ?? ROLE_COLORS.member}`}>{member.role}</Badge>
                        {!member.active && <Badge className="text-xs bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Inactive</Badge>}
                      </div>
                      {member.email && <p className="text-sm text-[#95a2b3]">{member.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#f7f8f8]">{member.assigned_count ?? 0}</p>
                      <p className="text-xs text-[#95a2b3]">assigned leads</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleToggleActive(member)} className="text-xs">
                        {member.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(member)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(member.id!)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Add'} Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
