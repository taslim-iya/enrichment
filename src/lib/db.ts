import Dexie, { type Table } from 'dexie';

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
  hiring_signals?: string;
  recent_news?: Array<{ title?: string; url?: string; date?: string }>;
  score_breakdown?: Record<string, unknown>;
  enrichment_completeness?: number;
  data_sources_hit?: string;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id?: number;
  lead_id: number;
  name: string;
  title?: string;
  email?: string;
  email_confidence?: number;
  phone?: string;
  linkedin_url?: string;
  source?: string;
  verified?: boolean;
  created_at: string;
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
  assigned_by?: string;
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

class CorgiDB extends Dexie {
  leads!: Table<Lead>;
  contacts!: Table<Contact>;
  team_members!: Table<TeamMember>;
  lead_assignments!: Table<LeadAssignment>;
  enrichment_log!: Table<EnrichmentLog>;

  constructor() {
    super('corgi-enrichment-db');
    this.version(1).stores({
      leads: '++id, company_name, state, industry, status, quality_score, created_at',
      contacts: '++id, lead_id, name, email',
      team_members: '++id, name, email',
      lead_assignments: '++id, lead_id, team_member_id',
      enrichment_log: '++id, entity_id, source, created_at',
    });
  }
}

export const db = new CorgiDB();
