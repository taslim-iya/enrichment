import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/db';
import { Zap, Database, Users, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

export default function EnrichmentPage() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    enrichedLeads: 0,
    totalContacts: 0,
    avgScore: 0,
    recentLogs: [] as Array<{ source: string; success: boolean; created_at: string; entity_id: number }>,
  });

  useEffect(() => {
    const load = async () => {
      const leads = await db.leads.toArray();
      const contacts = await db.contacts.count();
      const logs = await db.enrichment_log.orderBy('created_at').reverse().limit(20).toArray();
      const enriched = leads.filter((l) => l.enrichment_completeness && l.enrichment_completeness > 0).length;
      const scores = leads.filter((l) => l.quality_score).map((l) => l.quality_score!);
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      setStats({
        totalLeads: leads.length,
        enrichedLeads: enriched,
        totalContacts: contacts,
        avgScore: avg,
        recentLogs: logs,
      });
    };
    load();
  }, []);

  const enrichmentRate = stats.totalLeads > 0 ? Math.round((stats.enrichedLeads / stats.totalLeads) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Enrichment Dashboard</h1>
        <p className="text-[#95a2b3] mt-1">Overview of your data quality and enrichment progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0f0f14] border-[#1f1f2e]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Database className="w-4 h-4 text-[#6C63FF]" />
              <span className="text-xs text-[#95a2b3] uppercase tracking-wider font-medium">Total Leads</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalLeads.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0f0f14] border-[#1f1f2e]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-4 h-4 text-[#00D4AA]" />
              <span className="text-xs text-[#95a2b3] uppercase tracking-wider font-medium">Enriched</span>
            </div>
            <p className="text-2xl font-bold">{stats.enrichedLeads.toLocaleString()}</p>
            <p className="text-xs text-[#5c6370] mt-1">{enrichmentRate}% coverage</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0f0f14] border-[#1f1f2e]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-[#95a2b3] uppercase tracking-wider font-medium">Contacts</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalContacts.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0f0f14] border-[#1f1f2e]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-[#95a2b3] uppercase tracking-wider font-medium">Avg Score</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgScore}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-[#0f0f14] border-[#1f1f2e]">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#95a2b3]" />
            Recent Enrichment Activity
          </h2>
          {stats.recentLogs.length === 0 ? (
            <p className="text-sm text-[#5c6370] text-center py-8">No enrichment activity yet. Import leads to get started.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#09090b] border border-[#1f1f2e]">
                  <Badge className={`text-[10px] border ${log.success ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                    {log.success ? 'OK' : 'ERR'}
                  </Badge>
                  <span className="text-sm text-[#f7f8f8]">{log.source}</span>
                  <span className="text-xs text-[#5c6370]">Lead #{log.entity_id}</span>
                  <span className="text-xs text-[#5c6370] ml-auto">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
