import { useState, useRef } from 'react';
import { Download, Upload, FileText, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, upsertCompanies } from '../lib/db';

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

export default function ImportExportPage() {
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    const companies = await db.companies.toArray();

    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(companies, null, 2)], { type: 'application/json' });
      download(blob, 'companies.json');
    } else if (exportFormat === 'csv') {
      if (companies.length === 0) { setExporting(false); return; }
      const keys = Object.keys(companies[0]);
      const rows = [keys.join(','), ...companies.map(c =>
        keys.map(k => {
          const val = String((c as Record<string, unknown>)[k] ?? '');
          return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',')
      )];
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      download(blob, 'companies.csv');
    } else {
      const ws = XLSX.utils.json_to_sheet(companies);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Companies');
      XLSX.writeFile(wb, 'companies.xlsx');
    }

    setExporting(false);
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImported(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result;
        let rows: Record<string, unknown>[] = [];

        if (file.name.endsWith('.json')) {
          rows = JSON.parse(String(content));
        } else {
          const wb = XLSX.read(content, { type: file.name.endsWith('.csv') ? 'string' : 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws);
        }

        await upsertCompanies(rows);
        setImported(rows.length);
      } catch (err) {
        setImportError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    if (file.name.endsWith('.csv') || file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }

    // Reset input
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: STRIPE.textPrimary, marginBottom: 24 }}>Import / Export</h1>

      {/* Export */}
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: 24, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Download size={18} color={STRIPE.primary} />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary }}>Export Companies</h2>
        </div>
        <p style={{ fontSize: 13, color: STRIPE.textMuted, marginBottom: 20 }}>
          Download all synced companies as a file.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
          {(['csv', 'xlsx', 'json'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => setExportFormat(fmt)}
              style={{
                padding: '7px 16px', borderRadius: 8,
                border: `2px solid ${exportFormat === fmt ? STRIPE.primary : STRIPE.border}`,
                background: exportFormat === fmt ? '#EEF2FF' : STRIPE.card,
                color: exportFormat === fmt ? STRIPE.primary : STRIPE.textSecondary,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {fmt}
            </button>
          ))}
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: exporting ? '#E3E8EE' : STRIPE.primary,
              color: exporting ? STRIPE.textMuted : '#fff',
              fontSize: 14, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto',
            }}
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : `Export as ${exportFormat.toUpperCase()}`}
          </button>
        </div>
      </div>

      {/* Import */}
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: 24, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Upload size={18} color={STRIPE.primary} />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary }}>Import Companies</h2>
        </div>
        <p style={{ fontSize: 13, color: STRIPE.textMuted, marginBottom: 20 }}>
          Import from CSV, XLSX, or JSON. Rows with matching IDs will be updated.
        </p>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', border: `2px dashed ${STRIPE.border}`,
          borderRadius: 10, cursor: 'pointer',
          background: STRIPE.bg, transition: 'border-color 0.15s',
        }}>
          <FileText size={20} color={STRIPE.textMuted} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: STRIPE.textPrimary }}>Click to select file</div>
            <div style={{ fontSize: 12, color: STRIPE.textMuted }}>CSV, XLSX, or JSON</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </label>

        {imported !== null && (
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 8,
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <CheckCircle size={14} color={STRIPE.success} />
            <span style={{ fontSize: 14, color: '#065F46', fontWeight: 500 }}>
              {imported.toLocaleString()} companies imported.
            </span>
          </div>
        )}

        {importError && (
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 8,
            background: '#FEF2F2', border: '1px solid #FECACA',
            fontSize: 14, color: STRIPE.danger,
          }}>
            {importError}
          </div>
        )}
      </div>
    </div>
  );
}
