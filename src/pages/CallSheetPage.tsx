import { useState, useEffect } from 'react';
import { PhoneCall, Plus, Check, Phone, Mail, Trash2 } from 'lucide-react';
import { db, type Company, type CallSheetEntry } from '../lib/db';

const STRIPE = {
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  success: '#059669',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
  bg: '#F6F9FC',
};

interface CallSheetItem {
  entry: CallSheetEntry;
  company: Company;
}

export default function CallSheetPage() {
  const [callSheet, setCallSheet] = useState<CallSheetItem[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const loadData = async () => {
    const entries = await db.call_sheet.toArray();
    const companies = await db.companies.toArray();
    const companyMap = new Map(companies.map(c => [c.id!, c]));
    const items: CallSheetItem[] = [];
    for (const entry of entries) {
      const company = companyMap.get(entry.company_id);
      if (company) items.push({ entry, company });
    }
    setCallSheet(items);
    setAllCompanies(companies);
  };

  useEffect(() => { loadData(); }, []);

  const addToCallSheet = async (company: Company) => {
    const existing = await db.call_sheet.where('company_id').equals(company.id!).first();
    if (!existing) {
      await db.call_sheet.add({
        company_id: company.id!,
        called: false,
        added_at: new Date().toISOString(),
      });
    }
    setShowPicker(false);
    setPickerSearch('');
    loadData();
  };

  const toggleCalled = async (entry: CallSheetEntry) => {
    if (entry.id != null) {
      await db.call_sheet.update(entry.id, { called: !entry.called });
      loadData();
    }
  };

  const removeFromSheet = async (entry: CallSheetEntry) => {
    if (entry.id != null) {
      await db.call_sheet.delete(entry.id);
      loadData();
    }
  };

  const inSheet = new Set(callSheet.map(i => i.entry.company_id));
  const pickerCompanies = allCompanies
    .filter(c => !inSheet.has(c.id!) &&
      (!pickerSearch || c.company_name.toLowerCase().includes(pickerSearch.toLowerCase())))
    .slice(0, 50);

  const called = callSheet.filter(i => i.entry.called).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: STRIPE.textPrimary }}>Call Sheet</h1>
          <span style={{ background: '#EEF2FF', color: '#635BFF', padding: '2px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            {called}/{callSheet.length}
          </span>
        </div>
        <button
          onClick={() => setShowPicker(!showPicker)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: STRIPE.primary, color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Companies
        </button>
      </div>

      {/* Picker */}
      {showPicker && (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: 20, marginBottom: 20,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 12 }}>
            Select companies to add
          </div>
          <input
            value={pickerSearch}
            onChange={e => setPickerSearch(e.target.value)}
            placeholder="Search companies…"
            style={{
              width: '100%', padding: '8px 12px', marginBottom: 12,
              border: `1px solid ${STRIPE.border}`, borderRadius: 8,
              fontSize: 14, color: STRIPE.textPrimary, background: STRIPE.bg,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {allCompanies.length === 0 ? (
            <div style={{ color: STRIPE.textMuted, fontSize: 14 }}>No companies synced yet. Sync from Settings first.</div>
          ) : pickerCompanies.length === 0 ? (
            <div style={{ color: STRIPE.textMuted, fontSize: 14 }}>All companies already added or no matches.</div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {pickerCompanies.map(c => (
                <div
                  key={c.id}
                  onClick={() => addToCallSheet(c)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    marginBottom: 4,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = STRIPE.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: STRIPE.textPrimary }}>{c.company_name}</div>
                    <div style={{ fontSize: 12, color: STRIPE.textMuted }}>{c.industry} · {c.geography || c.state}</div>
                  </div>
                  <Plus size={14} color={STRIPE.primary} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Call Sheet */}
      {callSheet.length === 0 ? (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, padding: '60px 40px', textAlign: 'center',
        }}>
          <PhoneCall size={40} color={STRIPE.border} style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 8 }}>
            Your call sheet is empty
          </div>
          <div style={{ fontSize: 14, color: STRIPE.textMuted }}>
            Add companies to start calling.
          </div>
        </div>
      ) : (
        <div style={{
          background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {callSheet.map((item, i) => (
            <div
              key={item.entry.id}
              style={{
                display: 'flex', alignItems: 'center', padding: '14px 20px',
                borderBottom: i < callSheet.length - 1 ? `1px solid ${STRIPE.border}` : 'none',
                background: item.entry.called ? '#F9FAFB' : STRIPE.card,
                opacity: item.entry.called ? 0.7 : 1,
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleCalled(item.entry)}
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: `2px solid ${item.entry.called ? STRIPE.success : STRIPE.border}`,
                  background: item.entry.called ? STRIPE.success : STRIPE.card,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', marginRight: 16, flexShrink: 0,
                }}
              >
                {item.entry.called && <Check size={12} color="#fff" strokeWidth={3} />}
              </button>

              {/* Company info */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 15, fontWeight: 600, color: STRIPE.textPrimary,
                  textDecoration: item.entry.called ? 'line-through' : 'none',
                  marginBottom: 4,
                }}>
                  {item.company.company_name}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
                  {(item.company.director || item.company.contact_name) && (
                    <span style={{ fontSize: 13, color: STRIPE.textSecondary }}>
                      👤 {item.company.director || item.company.contact_name}
                    </span>
                  )}
                  {(item.company.director_phone || item.company.contact_phone || item.company.phone) && (
                    <a
                      href={`tel:${item.company.director_phone || item.company.contact_phone || item.company.phone}`}
                      style={{ fontSize: 13, color: STRIPE.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <Phone size={12} />
                      {item.company.director_phone || item.company.contact_phone || item.company.phone}
                    </a>
                  )}
                  {(item.company.director_email || item.company.contact_email || item.company.email) && (
                    <a
                      href={`mailto:${item.company.director_email || item.company.contact_email || item.company.email}`}
                      style={{ fontSize: 13, color: STRIPE.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <Mail size={12} />
                      {item.company.director_email || item.company.contact_email || item.company.email}
                    </a>
                  )}
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={() => removeFromSheet(item.entry)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: STRIPE.textMuted, padding: 4, marginLeft: 8,
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
