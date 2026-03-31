import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSettingsStore } from '@/lib/store';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import {
  ArrowLeftRight, Download, Loader2, CheckCircle, AlertCircle,
  ExternalLink, Settings2, Upload, RefreshCw, Key,
} from 'lucide-react';

interface ImportResult {
  imported: number;
  duplicates: number;
  errors: string[];
}

interface SyncRecord {
  type: 'pull' | 'push';
  count: number;
  date: string;
  source: string;
}

export default function DealFlowPage() {
  const { dealflowUrl, setDealflowUrl } = useSettingsStore();
  const [urlInput, setUrlInput] = useState(dealflowUrl);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<ImportResult | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImportResult | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>(() => {
    try {
      const s = localStorage.getItem('corgi-dealflow-history');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
  const [ingestKey] = useState(() => {
    let k = localStorage.getItem('corgi-ingest-key');
    if (!k) {
      k = `corgi_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      localStorage.setItem('corgi-ingest-key', k);
    }
    return k;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveConfig = () => {
    setDealflowUrl(urlInput);
    alert('Configuration saved.');
  };

  const addHistory = (record: SyncRecord) => {
    setSyncHistory((prev) => {
      const updated = [record, ...prev].slice(0, 50);
      localStorage.setItem('corgi-dealflow-history', JSON.stringify(updated));
      return updated;
    });
  };

  const pullFromDealFlow = async () => {
    setPulling(true);
    setPullResult(null);
    try {
      const res = await fetch(`${dealflowUrl}/api/companies`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const companies = await res.json();
      const arr = Array.isArray(companies) ? companies : companies.companies ?? companies.data ?? [];
      let imported = 0;
      let duplicates = 0;
      const errors: string[] = [];

      for (const c of arr) {
        const name = c.company_name || c.name || c.companyName;
        if (!name) continue;
        const existing = await db.leads.where('company_name').equalsIgnoreCase(name).first();
        if (existing) { duplicates++; continue; }
        try {
          await db.leads.add({
            company_name: name,
            website: c.website,
            state: c.state,
            industry: c.industry,
            contact_name: c.contact_name || c.contactName,
            email: c.email,
            mobile_phone: c.phone || c.mobile_phone,
            source: 'dealflow',
            status: 'New',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          imported++;
        } catch (e) {
          errors.push(`${name}: ${String(e)}`);
        }
      }

      setPullResult({ imported, duplicates, errors });
      addHistory({ type: 'pull', count: imported, date: new Date().toISOString(), source: 'DealFlow API' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull failed';
      setPullResult({ imported: 0, duplicates: 0, errors: [msg] });
    } finally {
      setPulling(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const buffer = await uploadFile.arrayBuffer();
      const wb = XLSX.read(buffer);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      let imported = 0;
      let duplicates = 0;
      const errors: string[] = [];

      for (const row of rows) {
        const name = String(row['Company Name'] || row['company_name'] || row['Company'] || row['name'] || '').trim();
        if (!name) continue;
        const existing = await db.leads.where('company_name').equalsIgnoreCase(name).first();
        if (existing) { duplicates++; continue; }
        try {
          await db.leads.add({
            company_name: name,
            website: String(row['Website'] || row['website'] || ''),
            state: String(row['State'] || row['state'] || ''),
            industry: String(row['Industry'] || row['industry'] || ''),
            contact_name: String(row['Contact Name'] || row['contact_name'] || ''),
            email: String(row['Email'] || row['email'] || ''),
            mobile_phone: String(row['Phone'] || row['phone'] || row['mobile_phone'] || ''),
            quality_score: parseInt(String(row['Score'] || row['quality_score'] || '0'), 10) || undefined,
            source: `dealflow:${uploadFile.name}`,
            status: 'New',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          imported++;
        } catch (e) {
          errors.push(`${name}: ${String(e)}`);
        }
      }

      setUploadResult({ imported, duplicates, errors });
      addHistory({ type: 'push', count: imported, date: new Date().toISOString(), source: `File: ${uploadFile.name}` });
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadResult({ imported: 0, duplicates: 0, errors: [msg] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-[#f7f8f8]">DealFlow Integration</h1>
        <p className="text-[#95a2b3] mt-1">Pull data from DealFlow or upload files directly</p>
      </div>

      {/* Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4" />Connection Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>DealFlow URL</Label>
            <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveConfig}>Save Configuration</Button>
            <a href={dealflowUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" />Open DealFlow
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Ingest key */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Key className="w-4 h-4" />Ingest API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[#95a2b3]">Reference key for DealFlow integration identification.</p>
          <div className="flex gap-2">
            <Input value={ingestKey} readOnly className="font-mono text-xs flex-1" />
            <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(ingestKey)}>Copy</Button>
            <Button variant="secondary" size="icon" onClick={() => {
              const k = `corgi_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
              localStorage.setItem('corgi-ingest-key', k);
              window.location.reload();
            }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pull */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <Download className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#f7f8f8]">Pull from DealFlow</h3>
              <p className="text-sm text-[#95a2b3]">Fetch companies from the DealFlow API</p>
            </div>
            <Button onClick={pullFromDealFlow} disabled={pulling}>
              {pulling ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Pulling...</> : <><Download className="w-4 h-4 mr-2" />Pull Companies</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-500/10">
              <Upload className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#f7f8f8]">Upload File</h3>
              <p className="text-sm text-[#95a2b3]">Import from XLSX or CSV</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="flex-1 text-sm text-[#f7f8f8] file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#1a1a24] file:text-[#f7f8f8] file:text-sm hover:file:bg-[#252535]" />
            <Button onClick={handleFileUpload} disabled={!uploadFile || uploading}>
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importing...</> : <><Upload className="w-4 h-4 mr-2" />Import</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {(pullResult || uploadResult) && (
        <ResultCard result={(pullResult || uploadResult)!} />
      )}

      {/* Sync History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" />Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          {syncHistory.length > 0 ? (
            <div className="divide-y divide-[#1f1f2e]">
              {syncHistory.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs border ${r.type === 'pull' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                      {r.type === 'pull' ? 'Pull' : 'Push'}
                    </Badge>
                    <span className="text-sm text-[#f7f8f8]">{r.count} leads</span>
                    <span className="text-xs text-[#95a2b3]">{r.source}</span>
                  </div>
                  <span className="text-xs text-[#95a2b3]">{new Date(r.date).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#95a2b3] text-center py-6">No sync history.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultCard({ result }: { result: { imported: number; duplicates: number; errors: string[] } }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${result.imported > 0 ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
            {result.imported > 0 ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-[#f7f8f8]">Import Complete</h3>
            <div className="flex gap-4 mt-2">
              <div className="text-center px-3 py-1 rounded bg-green-500/10 border border-green-500/20">
                <p className="text-xl font-bold text-green-400">{result.imported}</p>
                <p className="text-xs text-[#95a2b3]">Imported</p>
              </div>
              <div className="text-center px-3 py-1 rounded bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xl font-bold text-yellow-400">{result.duplicates}</p>
                <p className="text-xs text-[#95a2b3]">Duplicates</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 text-xs text-red-400 space-y-1">
                {result.errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
