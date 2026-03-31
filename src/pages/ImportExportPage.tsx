import { useState, useRef } from 'react';
import { db, type Lead } from '../lib/db';
import { Upload, Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';

type ImportResult = { added: number; skipped: number; errors: string[] };

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (vals[i] ?? '').replace(/^"|"$/g, '').trim();
    });
    return row;
  });
}

export default function ImportExportPage() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [exportMsg, setExportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    setImporting(true);
    setResult(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      let added = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const row of rows) {
        const companyName = row['company_name'] || row['company'] || row['name'];
        if (!companyName) { skipped++; continue; }
        try {
          const existing = await db.leads.where('company_name').equalsIgnoreCase(companyName).first();
          if (existing) { skipped++; continue; }
          const now = new Date().toISOString();
          await db.leads.add({
            company_name: companyName,
            website: row['website'] || row['domain'] || undefined,
            domain: row['domain'] || undefined,
            contact_name: row['contact_name'] || row['contact'] || row['first_name'] ? `${row['first_name'] ?? ''} ${row['last_name'] ?? ''}`.trim() || undefined : undefined,
            contact_title: row['contact_title'] || row['title'] || undefined,
            mobile_phone: row['mobile_phone'] || row['phone'] || row['mobile'] || undefined,
            phone_hq: row['phone_hq'] || row['hq_phone'] || undefined,
            email: row['email'] || undefined,
            city: row['city'] || undefined,
            state: row['state'] || undefined,
            industry: row['industry'] || undefined,
            status: row['status'] || 'New',
            human_notes: row['notes'] || row['human_notes'] || undefined,
            created_at: now,
            updated_at: now,
          });
          added++;
        } catch (err) {
          errors.push(`${companyName}: ${String(err)}`);
        }
      }
      setResult({ added, skipped, errors });
    } catch (err) {
      setResult({ added: 0, skipped: 0, errors: [String(err)] });
    }
    setImporting(false);
  };

  const handleExport = async () => {
    const leads = await db.leads.toArray();
    if (leads.length === 0) { setExportMsg('No leads to export.'); return; }
    const headers = ['id', 'company_name', 'website', 'contact_name', 'contact_title', 'mobile_phone', 'phone_hq', 'email', 'city', 'state', 'industry', 'status', 'quality_score', 'human_notes', 'created_at'];
    const rows = leads.map((l) =>
      headers.map((h) => {
        const val = (l as Record<string, unknown>)[h];
        if (val == null) return '';
        const s = String(val);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corgi-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg(`Exported ${leads.length} leads.`);
    setTimeout(() => setExportMsg(''), 3000);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0A2540' }}>Import & Export</h1>
        <p style={{ fontSize: 13, color: '#8898aa', marginTop: 2 }}>Bulk import leads from CSV or export your database</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Import Card */}
        <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,91,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={20} style={{ color: '#635BFF' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540' }}>Import CSV</h2>
              <p style={{ fontSize: 13, color: '#8898aa' }}>Upload a CSV file with lead data</p>
            </div>
          </div>

          {/* Drop zone */}
          <div
            style={{ border: '2px dashed #E3E8EE', borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', background: '#F6F9FC', marginBottom: 16 }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleImport(file);
            }}
          >
            <FileText size={28} style={{ color: '#8898aa', marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#425466' }}>
              {importing ? 'Importing...' : 'Drop CSV here or click to browse'}
            </p>
            <p style={{ fontSize: 12, color: '#8898aa', marginTop: 4 }}>Supports: company_name, website, contact_name, email, phone, city, state, industry, status</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            style={{ width: '100%', background: '#635BFF', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {importing ? 'Importing...' : 'Choose File'}
          </button>

          {result && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: result.errors.length > 0 ? '#FFF1F0' : '#F0FFF4', border: `1px solid ${result.errors.length > 0 ? '#fecaca' : '#bbf7d0'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {result.errors.length === 0
                  ? <CheckCircle size={16} style={{ color: '#059669' }} />
                  : <AlertCircle size={16} style={{ color: '#E25950' }} />
                }
                <p style={{ fontSize: 14, fontWeight: 700, color: result.errors.length === 0 ? '#059669' : '#E25950' }}>
                  Import Complete
                </p>
              </div>
              <p style={{ fontSize: 13, color: '#425466' }}>✅ Added: {result.added}</p>
              <p style={{ fontSize: 13, color: '#425466' }}>⏭ Skipped: {result.skipped}</p>
              {result.errors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#E25950', marginBottom: 4 }}>Errors ({result.errors.length}):</p>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} style={{ fontSize: 11, color: '#8898aa' }}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Card */}
        <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={20} style={{ color: '#059669' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A2540' }}>Export CSV</h2>
              <p style={{ fontSize: 13, color: '#8898aa' }}>Download all leads as a CSV file</p>
            </div>
          </div>

          <div style={{ padding: '20px 0', borderTop: '1px solid #F6F9FC', borderBottom: '1px solid #F6F9FC', marginBottom: 20 }}>
            {[
              'All lead fields (company, contact, phone, email)',
              'Location data (city, state)',
              'Status and quality scores',
              'Your notes and enrichment data',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <CheckCircle size={14} style={{ color: '#059669', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#425466' }}>{item}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleExport}
            style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Download size={16} /> Export All Leads
          </button>

          {exportMsg && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#F0FFF4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#059669', fontWeight: 600, textAlign: 'center' }}>
              {exportMsg}
            </div>
          )}
        </div>
      </div>

      {/* CSV Format Guide */}
      <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 12, padding: 24, marginTop: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0A2540', marginBottom: 12 }}>CSV Format Guide</h3>
        <div style={{ background: '#F6F9FC', borderRadius: 8, padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#425466', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          company_name,website,contact_name,contact_title,email,mobile_phone,city,state,industry,status
        </div>
        <p style={{ fontSize: 12, color: '#8898aa', marginTop: 10 }}>
          Only <strong>company_name</strong> is required. Duplicate companies (by name) are skipped automatically.
        </p>
      </div>
    </div>
  );
}
