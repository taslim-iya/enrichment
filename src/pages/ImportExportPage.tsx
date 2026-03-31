import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { db, type Lead } from '@/lib/db';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const LEAD_FIELD_OPTIONS = [
  { value: '__skip__', label: '-- Skip --' },
  { value: 'company_name', label: 'Company Name' },
  { value: 'website', label: 'Website' },
  { value: 'contact_name', label: 'Contact Name' },
  { value: 'contact_title', label: 'Contact Title' },
  { value: 'email', label: 'Email' },
  { value: 'mobile_phone', label: 'Mobile Phone' },
  { value: 'phone_hq', label: 'Phone HQ' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'industry', label: 'Industry' },
  { value: 'quality_score', label: 'Quality Score' },
  { value: 'status', label: 'Status' },
  { value: 'source', label: 'Source' },
  { value: 'employee_count', label: 'Employees' },
  { value: 'founded_year', label: 'Founded Year' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'hiring_signals', label: 'Hiring Signals' },
  { value: 'specialization', label: 'Specialization' },
  { value: 'estimated_size', label: 'Estimated Size' },
  { value: 'human_notes', label: 'Notes' },
];

// Auto-detect column mapping
function autoMap(header: string): string {
  const h = header.toLowerCase().trim();
  const map: Record<string, string> = {
    'company name': 'company_name', 'company': 'company_name', 'name': 'company_name',
    'website': 'website', 'url': 'website', 'domain': 'website',
    'contact name': 'contact_name', 'contact': 'contact_name',
    'contact title': 'contact_title', 'title': 'contact_title', 'job title': 'contact_title',
    'email': 'email', 'email address': 'email',
    'phone': 'mobile_phone', 'mobile': 'mobile_phone', 'mobile phone': 'mobile_phone', 'direct phone': 'mobile_phone',
    'phone hq': 'phone_hq', 'company phone': 'phone_hq',
    'city': 'city', 'state': 'state', 'location': 'city',
    'industry': 'industry', 'vertical': 'industry', 'industry/vertical': 'industry',
    'score': 'quality_score', 'quality score': 'quality_score', 'blueprint score': 'quality_score',
    'status': 'status',
    'source': 'source',
    'employees': 'employee_count', 'employee count': 'employee_count', 'number of employees': 'employee_count',
    'founded': 'founded_year', 'founded year': 'founded_year',
    'linkedin': 'linkedin_url', 'linkedin url': 'linkedin_url', 'company linkedin': 'linkedin_url',
    'hiring signals': 'hiring_signals',
    'specialization': 'specialization',
    'notes': 'human_notes',
  };
  return map[h] ?? '__skip__';
}

export default function ImportExportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'idle' | 'mapping' | 'importing' | 'done'>('idle');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [importCount, setImportCount] = useState(0);
  const [error, setError] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        if (json.length === 0) { setError('File is empty'); return; }
        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs);
        const autoMapping: Record<number, string> = {};
        hdrs.forEach((h, i) => { autoMapping[i] = autoMap(h); });
        setMapping(autoMapping);
        setRawRows(json);
        setStep('mapping');
      } catch {
        setError('Failed to parse file. Ensure it is a valid XLSX or CSV.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const doImport = async () => {
    setStep('importing');
    const now = new Date().toISOString();
    let count = 0;
    const batch: Lead[] = [];

    for (const row of rawRows) {
      const lead: Partial<Lead> = { status: 'New', created_at: now, updated_at: now };
      for (const [colIdx, field] of Object.entries(mapping)) {
        if (field === '__skip__') continue;
        const header = headers[Number(colIdx)];
        const val = row[header];
        if (val === null || val === undefined || val === '') continue;
        if (field === 'quality_score' || field === 'founded_year') {
          (lead as Record<string, unknown>)[field] = Number(val) || 0;
        } else {
          (lead as Record<string, unknown>)[field] = String(val);
        }
      }
      if (lead.company_name) {
        lead.domain = lead.website ? lead.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : undefined;
        batch.push(lead as Lead);
        count++;
      }
    }

    if (batch.length > 0) {
      // Insert in chunks of 500
      for (let i = 0; i < batch.length; i += 500) {
        await db.leads.bulkAdd(batch.slice(i, i + 500));
      }
    }
    setImportCount(count);
    setStep('done');
  };

  const exportCSV = async () => {
    const leads = await db.leads.toArray();
    const cols = ['company_name', 'website', 'contact_name', 'contact_title', 'email', 'mobile_phone', 'city', 'state', 'industry', 'quality_score', 'status', 'employee_count', 'source'];
    const header = cols.join(',');
    const rows = leads.map((l) =>
      cols.map((c) => {
        const v = (l as Record<string, unknown>)[c];
        if (v === null || v === undefined) return '';
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corgi-leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep('idle');
    setHeaders([]);
    setMapping({});
    setRawRows([]);
    setImportCount(0);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import & Export</h1>
        <p className="text-[#95a2b3] mt-1">Import leads from XLSX/CSV or export your data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Import */}
        <Card className="bg-[#0f0f14] border-[#1f1f2e]">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/20 flex items-center justify-center">
                <Upload className="w-5 h-5 text-[#6C63FF]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Import Leads</h2>
                <p className="text-xs text-[#95a2b3]">Upload XLSX or CSV files</p>
              </div>
            </div>

            {step === 'idle' && (
              <div>
                <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="mb-3" />
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm mt-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>
            )}

            {step === 'mapping' && (
              <div className="space-y-3">
                <p className="text-sm text-[#95a2b3]">
                  Map columns from your file ({rawRows.length.toLocaleString()} rows detected):
                </p>
                <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                  {headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-[#f7f8f8] w-40 truncate shrink-0" title={h}>{h}</span>
                      <span className="text-[#5c6370]">→</span>
                      <Select value={mapping[i] ?? '__skip__'} onValueChange={(v) => setMapping((m) => ({ ...m, [i]: v }))}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_FIELD_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={doImport}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Import {rawRows.length.toLocaleString()} rows
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    <X className="w-4 h-4 mr-1" />Cancel
                  </Button>
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="flex items-center gap-3 text-[#95a2b3]">
                <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
                Importing leads...
              </div>
            )}

            {step === 'done' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Imported {importCount.toLocaleString()} leads</span>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>Import more</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export */}
        <Card className="bg-[#0f0f14] border-[#1f1f2e]">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#00D4AA]/20 flex items-center justify-center">
                <Download className="w-5 h-5 text-[#00D4AA]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Export Leads</h2>
                <p className="text-xs text-[#95a2b3]">Download all leads as CSV</p>
              </div>
            </div>
            <Button onClick={exportCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export all leads to CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
