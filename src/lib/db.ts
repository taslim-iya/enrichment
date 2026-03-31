import Dexie, { type Table } from 'dexie';

export interface Company {
  id?: number;
  dealflow_id?: string | number;
  company_name: string;
  website?: string;
  domain?: string;
  industry?: string;
  geography?: string;
  state?: string;
  country?: string;
  description?: string;
  status?: string;
  revenue?: string | number;
  employees?: string | number;
  profit?: string | number;
  assets?: string | number;
  equity?: string | number;
  director?: string;
  director_phone?: string;
  director_email?: string;
  contact_name?: string;
  contact_title?: string;
  contact_phone?: string;
  contact_email?: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  updated_at: string;
  created_at: string;
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

class CorgiDB extends Dexie {
  companies!: Table<Company>;
  leads!: Table<Lead>;
  team_members!: Table<TeamMember>;
  lead_assignments!: Table<LeadAssignment>;
  enrichment_log!: Table<EnrichmentLog>;
  call_sheet!: Table<CallSheetEntry>;

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
  }
}

export const db = new CorgiDB();

// Upsert companies from DealFlow sync
export async function upsertCompanies(rawCompanies: Record<string, unknown>[]): Promise<void> {
  const now = new Date().toISOString();
  for (const raw of rawCompanies) {
    const dealflow_id = String(raw.id || raw.dealflow_id || '');
    const mapped: Company = {
      dealflow_id,
      company_name: String(raw.company_name || raw.name || ''),
      website: raw.website as string | undefined,
      domain: raw.domain as string | undefined,
      industry: raw.industry as string | undefined,
      geography: (raw.geography || raw.state || raw.country) as string | undefined,
      state: raw.state as string | undefined,
      country: raw.country as string | undefined,
      description: raw.description as string | undefined,
      status: (raw.status as string) || 'New',
      revenue: raw.revenue as string | number | undefined,
      employees: (raw.employees || raw.employee_count) as string | number | undefined,
      profit: (raw.profit_before_tax || raw.profit) as string | number | undefined,
      assets: (raw.total_assets || raw.assets) as string | number | undefined,
      equity: raw.equity as string | number | undefined,
      director: (raw.director_name || raw.director || raw.contact_name) as string | undefined,
      director_phone: (raw.director_phone || raw.phone || raw.mobile_phone) as string | undefined,
      director_email: (raw.director_email || raw.email) as string | undefined,
      contact_name: (raw.director_name || raw.contact_name) as string | undefined,
      contact_title: (raw.director_title || raw.contact_title) as string | undefined,
      contact_phone: (raw.contact_phone || raw.phone) as string | undefined,
      contact_email: (raw.contact_email || raw.email) as string | undefined,
      phone: (raw.phone || raw.phone_hq) as string | undefined,
      email: raw.email as string | undefined,
      source: raw.source as string | undefined,
      notes: raw.notes as string | undefined,
      updated_at: (raw.updated_at as string) || now,
      created_at: (raw.created_at as string) || now,
    };

    if (dealflow_id) {
      const existing = await db.companies.where('dealflow_id').equals(dealflow_id).first();
      if (existing && existing.id != null) {
        await db.companies.update(existing.id, mapped);
      } else {
        await db.companies.add(mapped);
      }
    } else {
      await db.companies.add(mapped);
    }
  }
}
