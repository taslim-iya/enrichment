import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { db } from '@/lib/db';
import { useSettingsStore } from '@/lib/store';
import { Settings, Key, Link2, Plus, Trash2, GripVertical } from 'lucide-react';

interface CustomField {
  id?: number;
  name: string;
  key: string;
  field_type: string;
  options?: string[];
  required: boolean;
  show_in_table: boolean;
  position: number;
}

export default function SettingsPage() {
  const { apiKeys, dealflowUrl, setApiKeys, setDealflowUrl } = useSettingsStore();
  const [openaiKey, setOpenaiKey] = useState(apiKeys.openai);
  const [anthropicKey, setAnthropicKey] = useState(apiKeys.anthropic);
  const [dfUrl, setDfUrl] = useState(dealflowUrl);
  const [saved, setSaved] = useState(false);

  // Custom fields
  const [fields, setFields] = useState<CustomField[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newField, setNewField] = useState({ name: '', field_type: 'text' });

  useEffect(() => {
    // Load custom field definitions from a simple localStorage store
    const stored = localStorage.getItem('corgi-custom-fields');
    if (stored) setFields(JSON.parse(stored));
  }, []);

  const saveSettings = () => {
    setApiKeys({ openai: openaiKey, anthropic: anthropicKey });
    setDealflowUrl(dfUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addField = () => {
    if (!newField.name.trim()) return;
    const key = newField.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const field: CustomField = {
      id: Date.now(),
      name: newField.name,
      key,
      field_type: newField.field_type,
      required: false,
      show_in_table: true,
      position: fields.length,
    };
    const updated = [...fields, field];
    setFields(updated);
    localStorage.setItem('corgi-custom-fields', JSON.stringify(updated));
    setNewField({ name: '', field_type: 'text' });
    setAddOpen(false);
  };

  const removeField = (id: number) => {
    const updated = fields.filter((f) => f.id !== id);
    setFields(updated);
    localStorage.setItem('corgi-custom-fields', JSON.stringify(updated));
  };

  const clearAllData = async () => {
    if (!confirm('This will delete ALL leads, contacts, team members, and assignments. Are you sure?')) return;
    await db.leads.clear();
    await db.contacts.clear();
    await db.team_members.clear();
    await db.lead_assignments.clear();
    await db.enrichment_log.clear();
    alert('All data cleared.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-[#95a2b3] mt-1">Configure API keys, integrations, and custom fields</p>
      </div>

      {/* API Keys */}
      <Card className="bg-[#0f0f14] border-[#1f1f2e]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-[#6C63FF]" />
            </div>
            <h2 className="text-lg font-semibold">API Keys</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[#95a2b3] mb-1 block">OpenAI API Key</label>
              <Input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="text-sm text-[#95a2b3] mb-1 block">Anthropic API Key</label>
              <Input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DealFlow Integration */}
      <Card className="bg-[#0f0f14] border-[#1f1f2e]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00D4AA]/20 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-[#00D4AA]" />
            </div>
            <h2 className="text-lg font-semibold">DealFlow Integration</h2>
          </div>

          <div>
            <label className="text-sm text-[#95a2b3] mb-1 block">DealFlow App URL</label>
            <Input
              value={dfUrl}
              onChange={(e) => setDfUrl(e.target.value)}
              placeholder="https://dealflowa9.netlify.app"
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Fields */}
      <Card className="bg-[#0f0f14] border-[#1f1f2e]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold">Custom Fields</h2>
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />Add Field
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-[#5c6370] text-center py-4">No custom fields defined yet.</p>
          ) : (
            <div className="space-y-2">
              {fields.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#09090b] border border-[#1f1f2e]">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-[#5c6370]" />
                    <span className="text-sm font-medium">{f.name}</span>
                    <Badge className="text-[10px] bg-[#1a1a24] text-[#95a2b3] border-[#1f1f2e]">{f.field_type}</Badge>
                    <code className="text-[10px] text-[#5c6370]">{f.key}</code>
                  </div>
                  <button onClick={() => removeField(f.id!)} className="p-1 rounded hover:bg-red-500/20 text-[#5c6370] hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={saveSettings}>
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
        <Button variant="outline" className="text-red-400 border-red-400/30 hover:bg-red-500/10" onClick={clearAllData}>
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All Data
        </Button>
      </div>

      {/* Add Field Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm bg-[#0f0f14] border-[#1f1f2e]">
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-[#95a2b3] mb-1 block">Field Name</label>
              <Input
                value={newField.name}
                onChange={(e) => setNewField((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Revenue Band"
              />
            </div>
            <div>
              <label className="text-sm text-[#95a2b3] mb-1 block">Type</label>
              <Select value={newField.field_type} onValueChange={(v) => setNewField((f) => ({ ...f, field_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={addField}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
