import { useState } from 'react';
import { Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, ExternalLink, Bot, Zap, Globe } from 'lucide-react';
import { useSettingsStore } from '../lib/store';
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

      {/* ── 5. About ──────────────────────────────────────── */}
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
