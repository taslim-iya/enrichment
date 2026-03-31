import { useState } from 'react';
import { Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, ExternalLink, Bot, Zap, Globe, Plus, Trash2, Columns } from 'lucide-react';
import { useSettingsStore, type CustomColumn } from '../lib/store';
import { upsertCompanies } from '../lib/db';
import { startDealFlowSync } from '../lib/sync';

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  success: '#059669',
  danger: '#E25950',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
  bg: '#F6F9FC',
};

// ─── Reusable field components ────────────────────────────────────────────────

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: S.textSecondary }}>
        {children}
      </label>
      {hint && (
        <span style={{ fontSize: 12, color: S.textMuted }}>{hint}</span>
      )}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '10px 14px',
        border: `1px solid ${S.border}`,
        borderRadius: 8,
        fontSize: 14,
        color: S.textPrimary,
        background: S.bg,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

function SecretInput({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 42px 10px 14px',
          border: `1px solid ${S.border}`,
          borderRadius: 8,
          fontSize: 14,
          color: S.textPrimary,
          background: S.bg,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: S.textMuted, display: 'flex', alignItems: 'center',
        }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function SectionCard({
  icon, iconBg, title, description, children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: S.card,
      border: `1px solid ${S.border}`,
      borderRadius: 12,
      padding: 24,
      marginBottom: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: S.textPrimary }}>{title}</div>
          <div style={{ fontSize: 13, color: S.textMuted, marginTop: 2 }}>{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function CustomColumnsSection() {
  const { customColumns, addCustomColumn, deleteCustomColumn } = useSettingsStore();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CustomColumn['type']>('text');
  const [newOptions, setNewOptions] = useState('');
  const [newAiEnrichable, setNewAiEnrichable] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) { setError('Column name is required.'); return; }
    const key = slugify(name);
    if (!key) { setError('Invalid column name.'); return; }
    if (customColumns.find(c => c.key === key)) {
      setError(`A column with key "${key}" already exists.`);
      return;
    }
    const col: CustomColumn = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      key,
      type: newType,
      options: newType === 'dropdown' ? newOptions.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      aiEnrichable: newAiEnrichable,
      width: 140,
      created_at: new Date().toISOString(),
    };
    addCustomColumn(col);
    setNewName('');
    setNewType('text');
    setNewOptions('');
    setNewAiEnrichable(false);
    setError('');
  };

  const typeLabel = (t: CustomColumn['type']) => ({
    text: 'Text', number: 'Number', currency: 'Currency',
    date: 'Date', url: 'URL', email: 'Email', phone: 'Phone', dropdown: 'Dropdown',
  }[t] || t);

  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`,
      borderRadius: 12, padding: 24, marginBottom: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: '#F0FDF4',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Columns size={18} color={S.success} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: S.textPrimary }}>Custom Columns</div>
          <div style={{ fontSize: 13, color: S.textMuted, marginTop: 2 }}>
            Add custom fields that appear in the Leads table. Mark as AI Enrichable to fill them automatically.
          </div>
        </div>
      </div>

      {/* Existing columns */}
      {customColumns.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {customColumns.map(col => (
            <div key={col.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: S.bg,
              border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: S.textPrimary }}>{col.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span style={{
                    fontSize: 11, background: '#EEF2FF', color: S.primary,
                    padding: '1px 7px', borderRadius: 8, fontWeight: 500,
                  }}>{typeLabel(col.type)}</span>
                  <span style={{ fontSize: 11, color: S.textMuted }}>key: {col.key}</span>
                  {col.aiEnrichable && (
                    <span style={{
                      fontSize: 11, background: '#F0FDF4', color: S.success,
                      padding: '1px 7px', borderRadius: 8, fontWeight: 500,
                    }}>AI Enrichable</span>
                  )}
                  {col.options && col.options.length > 0 && (
                    <span style={{ fontSize: 11, color: S.textMuted }}>
                      [{col.options.slice(0, 3).join(', ')}{col.options.length > 3 ? '…' : ''}]
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteCustomColumn(col.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: S.textMuted, padding: 4,
                  display: 'flex', alignItems: 'center',
                }}
                title="Delete column"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new column form */}
      <div style={{ borderTop: customColumns.length > 0 ? `1px solid ${S.border}` : 'none', paddingTop: customColumns.length > 0 ? 20 : 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: S.textSecondary, marginBottom: 12 }}>Add Column</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.textSecondary, marginBottom: 4 }}>Column Name</label>
            <input
              value={newName}
              onChange={e => { setNewName(e.target.value); setError(''); }}
              placeholder="e.g. Funding Round"
              style={{
                width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`,
                borderRadius: 8, fontSize: 14, color: S.textPrimary, background: S.bg,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.textSecondary, marginBottom: 4 }}>Type</label>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as CustomColumn['type'])}
              style={{
                width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`,
                borderRadius: 8, fontSize: 14, color: S.textPrimary, background: S.bg,
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="currency">Currency</option>
              <option value="date">Date</option>
              <option value="url">URL</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="dropdown">Dropdown</option>
            </select>
          </div>
        </div>

        {newType === 'dropdown' && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.textSecondary, marginBottom: 4 }}>
              Options (comma-separated)
            </label>
            <input
              value={newOptions}
              onChange={e => setNewOptions(e.target.value)}
              placeholder="Option A, Option B, Option C"
              style={{
                width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`,
                borderRadius: 8, fontSize: 14, color: S.textPrimary, background: S.bg,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: S.textSecondary }}>
            <input
              type="checkbox"
              checked={newAiEnrichable}
              onChange={e => setNewAiEnrichable(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: S.primary }}
            />
            AI Enrichable — fill this field automatically via AI
          </label>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: S.danger, marginBottom: 10 }}>{error}</div>
        )}

        <button
          onClick={handleAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: S.primary, color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Column
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const {
    dealflowUrl, apiKey, lastSyncTime, lastSyncCount,
    openaiKey, apolloApiKey, insightEngineUrl,
    setDealflowUrl, setApiKey, setLastSync,
    setOpenaiKey, setApolloApiKey, setInsightEngineUrl,
  } = useSettingsStore();

  // DealFlow local state
  const [localUrl, setLocalUrl] = useState(dealflowUrl);
  const [localKey, setLocalKey] = useState(apiKey);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncDone, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState('');

  // OpenAI local state
  const [localOpenaiKey, setLocalOpenaiKey] = useState(openaiKey);

  // Apollo local state
  const [localApolloKey, setLocalApolloKey] = useState(apolloApiKey);

  // InsightEngine local state
  const [localInsightUrl, setLocalInsightUrl] = useState(insightEngineUrl);

  // Save feedback
  const [savedSection, setSavedSection] = useState<string | null>(null);

  const showSaved = (section: string) => {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2000);
  };

  const handleSaveDealflow = () => {
    setDealflowUrl(localUrl);
    setApiKey(localKey);
    showSaved('dealflow');
  };

  const handleSaveAI = () => {
    setOpenaiKey(localOpenaiKey);
    showSaved('ai');
  };

  const handleSaveApollo = () => {
    setApolloApiKey(localApolloKey);
    showSaved('apollo');
  };

  const handleSaveInsight = () => {
    setInsightEngineUrl(localInsightUrl);
    showSaved('insight');
  };

  const handleSync = () => {
    setDealflowUrl(localUrl);
    setApiKey(localKey);
    setSyncing(true);
    setSyncProgress(0);
    setSyncTotal(0);
    setSyncDone(false);
    setSyncError('');

    startDealFlowSync(
      localUrl,
      localKey,
      async (batch, sent, total) => {
        setSyncProgress(sent);
        setSyncTotal(total);
        await upsertCompanies(batch);
      },
      (total) => {
        setSyncing(false);
        setSyncDone(true);
        setLastSync(new Date().toISOString(), total);
      },
      (err) => {
        setSyncing(false);
        setSyncError(err);
      }
    );
  };

  function SaveButton({ section, onClick }: { section: string; onClick: () => void }) {
    const saved = savedSection === section;
    return (
      <button
        onClick={onClick}
        style={{
          padding: '9px 20px', borderRadius: 8, border: 'none',
          background: saved ? '#D1FAE5' : S.primary,
          color: saved ? '#065F46' : '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          transition: 'background 0.2s',
        }}
      >
        {saved ? <><CheckCircle size={14} /> Saved!</> : 'Save'}
      </button>
    );
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: S.textPrimary, marginBottom: 24 }}>Settings</h1>

      {/* ── 1. DealFlow Connection ─────────────────────────── */}
      <SectionCard
        icon={<RefreshCw size={18} color={S.primary} />}
        iconBg="#EEF2FF"
        title="DealFlow Connection"
        description="Connect to your DealFlow account to sync companies."
      >
        <div style={{ marginBottom: 16 }}>
          <FieldLabel hint="Base URL of your DealFlow instance">DealFlow URL</FieldLabel>
          <TextInput
            value={localUrl}
            onChange={setLocalUrl}
            placeholder="https://dealflowa9.netlify.app"
            type="url"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <FieldLabel hint="Your DealFlow API key is stored locally and never sent to any server">API Key</FieldLabel>
          <SecretInput
            value={localKey}
            onChange={setLocalKey}
            placeholder="Enter your DealFlow API key"
          />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <SaveButton section="dealflow" onClick={handleSaveDealflow} />
          <button
            onClick={handleSync}
            disabled={syncing || !localKey}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: `1px solid ${S.border}`,
              background: S.card,
              color: syncing || !localKey ? S.textMuted : S.textPrimary,
              fontSize: 14, fontWeight: 600,
              cursor: syncing || !localKey ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? `Syncing…` : 'Sync Now'}
          </button>
        </div>

        {/* Sync progress */}
        {syncing && syncTotal > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: S.textSecondary, marginBottom: 6 }}>
              Syncing… {syncProgress.toLocaleString()} / {syncTotal.toLocaleString()} companies
            </div>
            <div style={{ height: 6, background: S.border, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${syncTotal > 0 ? Math.round((syncProgress / syncTotal) * 100) : 0}%`,
                background: S.primary, borderRadius: 3, transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}

        {syncDone && (
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10,
            padding: '12px 16px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <CheckCircle size={16} color={S.success} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#065F46' }}>Sync complete!</div>
              <div style={{ fontSize: 13, color: '#047857' }}>
                {(lastSyncCount || 0).toLocaleString()} companies synced.
              </div>
            </div>
          </div>
        )}

        {syncError && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '12px 16px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertCircle size={16} color={S.danger} />
            <div style={{ fontSize: 14, color: S.danger }}>{syncError}</div>
          </div>
        )}

        {lastSyncTime && !syncDone && (
          <div style={{ marginTop: 14, fontSize: 13, color: S.textMuted }}>
            Last synced: {new Date(lastSyncTime).toLocaleString()} — {(lastSyncCount || 0).toLocaleString()} companies
          </div>
        )}
      </SectionCard>

      {/* ── 2. Apollo.io ──────────────────────────────────── */}
      <SectionCard
        icon={<Zap size={18} color="#7c3aed" />}
        iconBg="#F5F3FF"
        title="Apollo.io"
        description="Used for contact enrichment, company data, and people search."
      >
        <div style={{ marginBottom: 20 }}>
          <FieldLabel hint="Your Apollo API key — find it at apollo.io → Settings → Integrations">Apollo API Key</FieldLabel>
          <SecretInput
            value={localApolloKey}
            onChange={setLocalApolloKey}
            placeholder="p_k86JQdDzCm5G3aZqH6zg"
          />
        </div>
        <SaveButton section="apollo" onClick={handleSaveApollo} />
      </SectionCard>

      {/* ── 3. InsightEngine ──────────────────────────────── */}
      <SectionCard
        icon={<Globe size={18} color="#2563eb" />}
        iconBg="#EFF6FF"
        title="InsightEngine"
        description="Connect to InsightEngine for advanced company research and AI briefs."
      >
        <div style={{ marginBottom: 20 }}>
          <FieldLabel hint="Base URL of your InsightEngine instance">InsightEngine URL</FieldLabel>
          <TextInput
            value={localInsightUrl}
            onChange={setLocalInsightUrl}
            placeholder="https://insighta9.netlify.app"
            type="url"
          />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SaveButton section="insight" onClick={handleSaveInsight} />
          <a
            href={localInsightUrl || insightEngineUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 20px', borderRadius: 8,
              border: `1px solid ${S.border}`,
              background: S.card, color: S.textPrimary,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} />
            Open InsightEngine
          </a>
        </div>
      </SectionCard>

      {/* ── 4. OpenAI ─────────────────────────────────────── */}
      <SectionCard
        icon={<Bot size={18} color={S.primary} />}
        iconBg="#EEF2FF"
        title="AI (OpenAI)"
        description="Powers Jarvis chat, AI scoring, and industry classification."
      >
        <div style={{ marginBottom: 20 }}>
          <FieldLabel hint="Your OpenAI API key — stored locally in your browser">OpenAI API Key</FieldLabel>
          <SecretInput
            value={localOpenaiKey}
            onChange={setLocalOpenaiKey}
            placeholder="sk-proj-…"
          />
          <p style={{ fontSize: 12, color: S.textMuted, marginTop: 6 }}>
            Used for Jarvis chat, AI company scoring, and enrichment. Never leaves your browser.
          </p>
        </div>
        <SaveButton section="ai" onClick={handleSaveAI} />
      </SectionCard>

      {/* ── 5. Custom Columns ─────────────────────────────── */}
      <CustomColumnsSection />

      {/* ── 6. About ──────────────────────────────────────── */}
      <div style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: S.textPrimary, marginBottom: 16 }}>About</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: S.textMuted }}>Version</span>
            <span style={{ color: S.textPrimary, fontWeight: 500 }}>Corgi Enrichment v2</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: S.textMuted }}>Database</span>
            <span style={{ color: S.textPrimary, fontWeight: 500 }}>IndexedDB (Dexie v4)</span>
          </div>
          {lastSyncTime && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: S.textMuted }}>Last sync</span>
              <span style={{ color: S.textPrimary, fontWeight: 500 }}>
                {new Date(lastSyncTime).toLocaleString()}
              </span>
            </div>
          )}
          {lastSyncCount != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: S.textMuted }}>Companies synced</span>
              <span style={{ color: S.textPrimary, fontWeight: 500 }}>
                {lastSyncCount.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── 7. Danger Zone ──────────────────────────────────── */}
      <div style={{
        background: S.card,
        border: `2px solid ${S.danger}33`,
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: S.danger, marginBottom: 8 }}>Danger Zone</div>
        <p style={{ fontSize: 13, color: S.textMuted, margin: '0 0 16px' }}>These actions cannot be undone.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            onClick={async () => {
              if (!window.confirm('Delete ALL companies? This cannot be undone.')) return;
              if (!window.confirm('Are you absolutely sure? All company data, enrichment results, and notes will be lost.')) return;
              await db.companies.clear();
              alert('All companies deleted.');
            }}
            style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${S.danger}`, background: '#FEF2F2', color: S.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Delete All Companies
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('Clear all chat messages?')) return;
              await db.chat_messages.clear();
              alert('Chat history cleared.');
            }}
            style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.bg, color: S.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Clear Chat History
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('Clear all enrichment logs?')) return;
              await db.enrichment_log.clear();
              alert('Enrichment logs cleared.');
            }}
            style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.bg, color: S.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Clear Enrichment Logs
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('Reset ALL data? Companies, leads, team, call sheets, chat — everything?')) return;
              if (!window.confirm('Last chance. This wipes the entire database.')) return;
              await db.delete();
              window.location.reload();
            }}
            style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${S.danger}`, background: S.danger, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Factory Reset (Delete Everything)
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
