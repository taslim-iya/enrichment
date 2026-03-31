import { useState, useEffect } from 'react';
import { ArrowLeftRight, RefreshCw, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { db, upsertCompanies } from '../lib/db';
import { useSettingsStore } from '../lib/store';
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

export default function DealFlowPage() {
  const { dealflowUrl, apiKey, lastSyncTime, lastSyncCount, setLastSync } = useSettingsStore();
  const [companyCount, setCompanyCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncDone, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState('');

  const isConnected = Boolean(apiKey);

  useEffect(() => {
    db.companies.count().then(setCompanyCount);
  }, [syncDone]);

  const handleSync = () => {
    if (!apiKey) { setSyncError('No API key set. Go to Settings.'); return; }
    setSyncing(true);
    setSyncProgress(0);
    setSyncTotal(0);
    setSyncDone(false);
    setSyncError('');

    startDealFlowSync(
      dealflowUrl,
      apiKey,
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
      <h1 style={{ fontSize: 24, fontWeight: 700, color: STRIPE.textPrimary, marginBottom: 24 }}>
        DealFlow Integration
      </h1>

      {/* Status Card */}
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: 24, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: isConnected ? '#F0FDF4' : '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowLeftRight size={20} color={isConnected ? STRIPE.success : STRIPE.danger} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: STRIPE.textPrimary }}>DealFlow</div>
              <div style={{ fontSize: 12, color: STRIPE.textMuted }}>{dealflowUrl}</div>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            background: isConnected ? '#F0FDF4' : '#FEF2F2',
          }}>
            {isConnected
              ? <><CheckCircle size={13} color={STRIPE.success} /><span style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>Connected</span></>
              : <><XCircle size={13} color={STRIPE.danger} /><span style={{ fontSize: 12, color: STRIPE.danger, fontWeight: 600 }}>Not connected</span></>
            }
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: STRIPE.bg, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: STRIPE.textMuted, fontWeight: 500, marginBottom: 4 }}>Companies Synced</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: STRIPE.textPrimary }}>{companyCount.toLocaleString()}</div>
          </div>
          <div style={{ background: STRIPE.bg, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: STRIPE.textMuted, fontWeight: 500, marginBottom: 4 }}>Last Sync</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: STRIPE.textPrimary }}>
              {lastSyncTime ? new Date(lastSyncTime).toLocaleDateString() : 'Never'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSync}
            disabled={syncing || !isConnected}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: syncing || !isConnected ? '#E3E8EE' : STRIPE.primary,
              color: syncing || !isConnected ? STRIPE.textMuted : '#fff',
              fontSize: 14, fontWeight: 600, cursor: syncing || !isConnected ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? `Syncing ${syncProgress.toLocaleString()}${syncTotal ? `/${syncTotal.toLocaleString()}` : ''}…` : 'Sync Now'}
          </button>
          <a
            href={`${dealflowUrl}/portal`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 8,
              border: `1px solid ${STRIPE.border}`,
              background: STRIPE.card, color: STRIPE.textPrimary,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} /> Open DealFlow Portal
          </a>
        </div>
      </div>

      {/* Sync Progress */}
      {syncing && syncTotal > 0 && (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, color: STRIPE.textSecondary, marginBottom: 8 }}>
            Syncing companies… {syncProgress.toLocaleString()} / {syncTotal.toLocaleString()}
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

      {syncDone && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12,
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <CheckCircle size={16} color={STRIPE.success} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#065F46' }}>
            Sync complete! {(lastSyncCount || 0).toLocaleString()} companies synced.
          </span>
        </div>
      )}

      {syncError && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
          padding: '14px 20px', fontSize: 14, color: STRIPE.danger,
        }}>
          {syncError}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
