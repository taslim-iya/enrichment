import Dexie, { type Table } from 'dexie';

export interface Company {
  id?: number;
  dealflow_id: string;
  company_name: string;
  geography?: string;
  industry?: string;
  nace?: string;
  employees?: number;
  revenue?: number;
  profit_before_tax?: number;
  total_assets?: number;
  equity?: number;
  website?: string;
  description?: string;
  address?: string;
  director_name?: string;
  director_title?: string;
  year_incorporated?: string;
  tags?: string[];
  notes?: string;
  status?: string;
  score?: number;
  source?: string;
  directors?: { name: string; title: string }[];
  contacts?: { name: string; title: string; email?: string; phone?: string; linkedin_url?: string }[];
  qualification_score?: number;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
  // Legacy compat fields
  domain?: string;
  state?: string;
  country?: string;
  profit?: string | number;
  assets?: string | number;
  director?: string;
  director_phone?: string;
  director_email?: string;
  contact_name?: string;
  contact_title?: string;
  contact_phone?: string;
  contact_email?: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

export interface Lead {
  id?: number;
  company_name: string;
  website?: string;
  domain?: string;
  contact_name?: string;
  contact_title?: string;
  mobile_phone?: string;
  phone_hq?: string;
  email?: string;
  city?: string;
  state?: string;
  industry?: string;
  specialization?: string;
  estimated_size?: string;
  quality_score?: number;
  source?: string;
  status: string;
  human_notes?: string;
  agent_notes?: string;
  enrichment_data?: Record<string, unknown>;
  verified?: boolean;
  employee_count?: string;
  founded_year?: number;
  linkedin_url?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id?: number;
  name: string;
  email?: string;
  role: string;
  avatar_color?: string;
  active: boolean;
  created_at: string;
}

export interface LeadAssignment {
  id?: number;
  lead_id: number;
  team_member_id: number;
  assigned_at: string;
  notes?: string;
}

export interface EnrichmentLog {
  id?: number;
  entity_type: string;
  entity_id: number;
  source: string;
  success: boolean;
  fields_updated?: string;
  error?: string;
  duration_ms?: number;
  created_at: string;
}

export interface CallSheetEntry {
  id?: number;
  company_id: number;
  called: boolean;
  notes?: string;
  added_at: string;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// ─── Timezone derivation ────────────────────────────────────────────────────

const PST_STATES = new Set(['CA', 'WA', 'OR', 'NV', 'AK', 'HI']);
const MST_STATES = new Set(['CO', 'AZ', 'NM', 'UT', 'MT', 'ID', 'WY']);
const CST_STATES = new Set([
  'TX', 'IL', 'MN', 'WI', 'IA', 'MO', 'KS', 'NE', 'OK',
  'SD', 'ND', 'LA', 'AR', 'MS', 'AL', 'TN',
]);
const EST_STATES = new Set([
  'NY', 'MA', 'CT', 'NJ', 'PA', 'MD', 'DC', 'VA', 'NC',
  'SC', 'GA', 'FL', 'OH', 'MI', 'IN', 'KY', 'WV', 'DE',
  'RI', 'NH', 'VT', 'ME',
]);
const CET_COUNTRIES = new Set([
  'GERMANY', 'DE', 'FRANCE', 'FR', 'SPAIN', 'ES', 'ITALY', 'IT',
  'NETHERLANDS', 'NL', 'BELGIUM', 'BE', 'AUSTRIA', 'AT', 'POLAND', 'PL',
  'CZECH REPUBLIC', 'CZECH', 'HUNGARY', 'HU', 'SLOVAKIA', 'SK',
  'SLOVENIA', 'SI', 'CROATIA', 'HR', 'SWITZERLAND', 'CH',
  'DENMARK', 'DK', 'SWEDEN', 'SE', 'NORWAY', 'NO',
  'FINLAND', 'FI', 'PORTUGAL', 'PT', 'LUXEMBOURG', 'LU',
]);
const GMT_COUNTRIES = new Set([
  'UK', 'GB', 'UNITED KINGDOM', 'ENGLAND', 'WALES', 'SCOTLAND', 'IRELAND', 'IE',
]);

export function deriveTimezone(raw: Record<string, unknown>): string {
  if (raw.timezone && String(raw.timezone).trim()) return String(raw.timezone).trim();
  const geo = String(raw.geography || raw.state || raw.country || '').trim().toUpperCase();
  if (!geo) return '';
  if (PST_STATES.has(geo)) return 'PST';
  if (MST_STATES.has(geo)) return 'MST';
  if (CST_STATES.has(geo)) return 'CST';
  if (EST_STATES.has(geo)) return 'EST';
  if (GMT_COUNTRIES.has(geo)) return 'GMT';
  if (CET_COUNTRIES.has(geo)) return 'CET';
  if (geo === 'CHINA' || geo === 'CN') return 'GMT+8';
  if (geo === 'JAPAN' || geo === 'JP') return 'JST';
  if (geo === 'INDIA' || geo === 'IN') return 'IST';
  if (geo === 'AUSTRALIA' || geo === 'AU') return 'AEST';
  if (geo === 'SINGAPORE' || geo === 'SG') return 'SGT';
  if (geo === 'UAE' || geo === 'AE' || geo === 'UNITED ARAB EMIRATES') return 'GST';
  if (geo === 'SOUTH KOREA' || geo === 'KR') return 'KST';
  if (geo === 'BRAZIL' || geo === 'BR') return 'BRT';
  if (geo === 'CANADA' || geo === 'CA') return 'ET/PT';
  return '';
}

// ─── Database ────────────────────────────────────────────────────────────────

class CorgiDB extends Dexie {
  companies!: Table<Company>;
  leads!: Table<Lead>;
  team_members!: Table<TeamMember>;
  lead_assignments!: Table<LeadAssignment>;
  enrichment_log!: Table<EnrichmentLog>;
  call_sheet!: Table<CallSheetEntry>;
  chat_messages!: Table<ChatMessage>;

  constructor() {
    super('corgi-enrichment-db');
    this.version(1).stores({
      leads: '++id, company_name, state, industry, status, quality_score, created_at',
    });
    this.version(2).stores({
      leads: '++id, company_name, state, industry, status, quality_score, created_at',
      team_members: '++id, name, email',
      lead_assignments: '++id, lead_id, team_member_id',
      enrichment_log: '++id, entity_id, source, created_at',
      companies: '++id, dealflow_id, company_name, industry, geography, status, revenue, employees, updated_at',
      call_sheet: '++id, company_id, called, added_at',
    });
    this.version(3).stores({
      leads: '++id, company_name, state, industry, status, quality_score, created_at',
      team_members: '++id, name, email',
      lead_assignments: '++id, lead_id, team_member_id',
      enrichment_log: '++id, entity_id, source, created_at',
      companies: '++id, dealflow_id, company_name, industry, geography, status, revenue, employees, timezone, updated_at',
      call_sheet: '++id, company_id, called, added_at',
    });
    this.version(4).stores({
      leads: '++id, company_name, state, industry, status, quality_score, created_at',
      team_members: '++id, name, email',
      lead_assignments: '++id, lead_id, team_member_id',
      enrichment_log: '++id, entity_id, source, created_at',
      companies: '++id, dealflow_id, company_name, industry, geography, status, revenue, employees, timezone, updated_at',
      call_sheet: '++id, company_id, called, added_at',
      chat_messages: '++id, role, created_at',
    });
  }
}

export const db = new CorgiDB();

// ─── Upsert ──────────────────────────────────────────────────────────────────

export async function upsertCompanies(rawCompanies: Record<string, unknown>[]): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', db.companies, async () => {
    for (const raw of rawCompanies) {
      const dealflow_id = String(raw.id || raw.dealflow_id || '');
      const timezone = deriveTimezone(raw);

      const company: Partial<Company> = {
        ...raw,
        dealflow_id,
        company_name: String(raw.company_name || raw.name || ''),
        source: (raw.source as string) || 'DealFlow',
        timezone,
        updated_at: (raw.updated_at as string) || now,
        created_at: (raw.created_at as string) || now,
        // Legacy compat aliases
        director: (raw.director_name || raw.director || raw.contact_name) as string | undefined,
        contact_name: (raw.director_name || raw.contact_name) as string | undefined,
        contact_title: (raw.director_title || raw.contact_title) as string | undefined,
        profit: (raw.profit_before_tax || raw.profit) as string | number | undefined,
        assets: (raw.total_assets || raw.assets) as string | number | undefined,
      };
      // Don't overwrite Dexie's auto-increment id
      delete (company as Record<string, unknown>).id;

      if (dealflow_id) {
        const existing = await db.companies.where('dealflow_id').equals(dealflow_id).first();
        if (existing?.id != null) {
          await db.companies.update(existing.id, company);
        } else {
          await db.companies.add(company as Company);
        }
      } else {
        await db.companies.add(company as Company);
      }
    }
  });
}
