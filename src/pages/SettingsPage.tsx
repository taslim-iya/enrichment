import { useState } from 'react';
import { Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '../lib/store';
import { upsertCompanies } from '../lib/db';
import { startDealFlowSync } from '../lib/sync';

const STRIPE = {
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

export default function SettingsPage() {
  const { dealflowUrl, apiKey, lastSyncTime, lastSyncCount, setDealflowUrl, setApiKey, setLastSync } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [localUrl, setLocalUrl] = useState(dealflowUrl);
  const [localKey, setLocalKey] = useState(apiKey);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncDone, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setDealflowUrl(localUrl);
    setApiKey(localKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: STRIPE.textPrimary, marginBottom: 24 }}>Settings</h1>

      {/* DealFlow Connection */}
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: 24, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 4 }}>
          DealFlow Connection
        </h2>
        <p style={{ fontSize: 13, color: STRIPE.textMuted, marginBottom: 20 }}>
          Connect to your DealFlow account to sync companies assigned to you.
        </p>

        {/* DealFlow URL */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: STRIPE.textSecondary, marginBottom: 6 }}>
            DealFlow URL
          </label>
          <input
            type="url"
            value={localUrl}
            onChange={e => setLocalUrl(e.target.value)}
            placeholder="https://dealflowa9.netlify.app"
            style={{
              width: '100%', padding: '10px 14px',
              border: `1px solid ${STRIPE.border}`, borderRadius: 8,
              fontSize: 14, color: STRIPE.textPrimary, background: STRIPE.bg,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* API Key */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: STRIPE.textSecondary, marginBottom: 6 }}>
            API Key
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={localKey}
              onChange={e => setLocalKey(e.target.value)}
              placeholder="Enter your DealFlow API key"
              style={{
                width: '100%', padding: '10px 42px 10px 14px',
                border: `1px solid ${STRIPE.border}`, borderRadius: 8,
                fontSize: 14, color: STRIPE.textPrimary, background: STRIPE.bg,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: STRIPE.textMuted, display: 'flex', alignItems: 'center',
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p style={{ fontSize: 12, color: STRIPE.textMuted, marginTop: 6 }}>
            Your API key is stored locally in your browser and never sent to any server.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleSave}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: saved ? '#D1FAE5' : STRIPE.primary,
              color: saved ? '#065F46' : '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {saved ? <><CheckCircle size={14} /> Saved!</> : 'Save Settings'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !localKey}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: `1px solid ${STRIPE.border}`,
              background: STRIPE.card,
              color: syncing || !localKey ? STRIPE.textMuted : STRIPE.textPrimary,
              fontSize: 14, fontWeight: 600,
              cursor: syncing || !localKey ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? `Syncing…` : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Sync Progress */}
      {syncing && syncTotal > 0 && (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, color: STRIPE.textSecondary, marginBottom: 8 }}>
            Syncing… {syncProgress.toLocaleString()} / {syncTotal.toLocaleString()} companies
          </div>
          <div style={{ height: 6, background: '#E3E8EE', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((syncProgress / syncTotal) * 100)}%`,
              background: STRIPE.primary, borderRadius: 3, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Sync Done */}
      {syncDone && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12,
          padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <CheckCircle size={16} color={STRIPE.success} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#065F46' }}>Sync complete!</div>
            <div style={{ fontSize: 13, color: '#047857' }}>
              {(lastSyncCount || 0).toLocaleString()} companies synced.
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {syncError && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
          padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} color={STRIPE.danger} />
          <div style={{ fontSize: 14, color: STRIPE.danger }}>{syncError}</div>
        </div>
      )}

      {/* Sync Status */}
      {lastSyncTime && !syncDone && (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: '14px 20px',
        }}>
          <div style={{ fontSize: 13, color: STRIPE.textMuted }}>Last synced</div>
          <div style={{ fontSize: 14, color: STRIPE.textSecondary, fontWeight: 500, marginTop: 4 }}>
            {new Date(lastSyncTime).toLocaleString()} — {(lastSyncCount || 0).toLocaleString()} companies
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
