import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useSettingsStore } from '@/lib/store';
import { Zap, Globe, Search, Phone, Link2, Database, AlertCircle } from 'lucide-react';

const SOURCES = [
  {
    id: 'apollo',
    name: 'Apollo.io',
    description: 'Contact discovery, email finding, company enrichment',
    icon: Database,
    status: 'configured_externally',
    fields: ['company_name', 'contact_name', 'email', 'phone', 'employee_count'],
  },
  {
    id: 'company-website',
    name: 'Company Website',
    description: 'Scrapes the company website for contact info and description',
    icon: Globe,
    status: 'active',
    fields: ['description', 'phone_hq', 'email', 'linkedin_url'],
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Searches the web for recent news and company information',
    icon: Search,
    status: 'active',
    fields: ['recent_news', 'hiring_signals', 'description'],
  },
  {
    id: 'phone-validation',
    name: 'Phone Validation',
    description: 'Validates and formats phone numbers',
    icon: Phone,
    status: 'active',
    fields: ['mobile_phone', 'phone_hq'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'LinkedIn company and contact data (requires manual auth)',
    icon: Link2,
    status: 'manual',
    fields: ['linkedin_url', 'employee_count', 'founded_year', 'description'],
  },
];

export default function SourcesPage() {
  const { apiKeys, setApiKeys } = useSettingsStore();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-[#f7f8f8]">Enrichment Engine</h1>
        <p className="text-[#95a2b3] mt-1">Configure enrichment sources and API keys</p>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300">
              This is a client-side app. API keys are stored in your browser's localStorage (encrypted via Zustand persist).
              Never use production keys in shared environments.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Anthropic API Key</Label>
              <Input
                type="password"
                value={apiKeys.anthropic}
                onChange={(e) => setApiKeys({ anthropic: e.target.value })}
                placeholder="sk-ant-..."
              />
              <p className="text-xs text-[#95a2b3] mt-1">Used for Jarvis AI and AI filter features</p>
            </div>
            <div>
              <Label>OpenAI API Key</Label>
              <Input
                type="password"
                value={apiKeys.openai}
                onChange={(e) => setApiKeys({ openai: e.target.value })}
                placeholder="sk-..."
              />
              <p className="text-xs text-[#95a2b3] mt-1">Alternative AI provider</p>
            </div>
          </div>
          <Button size="sm" onClick={() => alert('Keys saved to localStorage via Zustand.')}>Save Keys</Button>
        </CardContent>
      </Card>

      {/* Sources */}
      <div>
        <h2 className="text-xl font-semibold text-[#f7f8f8] mb-4">Data Sources</h2>
        <div className="space-y-4">
          {SOURCES.map((source) => {
            const Icon = source.icon;
            const statusColor = source.status === 'active'
              ? 'bg-green-500/20 text-green-300 border-green-500/30'
              : source.status === 'manual'
              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
              : 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            const statusLabel = source.status === 'active' ? 'Active'
              : source.status === 'manual' ? 'Manual'
              : 'External Config';

            return (
              <Card key={source.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[#6C63FF]/10">
                        <Icon className="w-5 h-5 text-[#6C63FF]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#f7f8f8]">{source.name}</span>
                          <Badge className={`text-xs border ${statusColor}`}>{statusLabel}</Badge>
                        </div>
                        <p className="text-sm text-[#95a2b3] mt-0.5">{source.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {source.fields.map((f) => (
                            <span key={f} className="text-[10px] bg-[#1a1a24] text-[#95a2b3] px-1.5 py-0.5 rounded font-mono">{f}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-[#f7f8f8] mb-2">About Client-Side Enrichment</h3>
          <p className="text-sm text-[#95a2b3]">
            This v2 app is fully client-side. Enrichment that requires server-side APIs (Apollo, LinkedIn scraping, etc.)
            must be done through the original backend or by importing pre-enriched CSV/XLSX files via the Import & Export page.
            The Jarvis AI feature works directly in your browser using the Anthropic API key you configure above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
