/**
 * Client-side enrichment sources for E1.
 * All sources use OpenAI gpt-4o-mini for analysis since E1 is 100% client-side.
 */

import type { Company } from './db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrichmentSourceResult {
  source: string;
  fields_updated: string[];
  data: Record<string, unknown>;
  raw_response?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 800
): Promise<string> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

function companyContext(company: Company): string {
  return [
    company.company_name && `Company: ${company.company_name}`,
    company.website && `Website: ${company.website}`,
    company.industry && `Industry: ${company.industry}`,
    company.geography && `Geography: ${company.geography}`,
    company.description && `Description: ${company.description}`,
    company.employees && `Employees: ${company.employees}`,
    company.revenue && `Revenue: $${Number(company.revenue) / 1e6}M`,
  ].filter(Boolean).join('\n');
}

function parseJsonFromText(text: string): unknown {
  // Try to extract JSON from AI response
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1] || jsonMatch[0]); } catch { /* fall through */ }
  }
  try { return JSON.parse(text); } catch { /* fall through */ }
  return null;
}

// ─── 1. Company Website Analysis ─────────────────────────────────────────────

export async function enrichCompanyWebsite(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are a B2B research analyst. Analyse company websites and extract business intelligence. Always respond with valid JSON.',
    `Analyse this company and provide a comprehensive website/company summary.

${ctx}

Respond with JSON in this exact format:
{
  "summary": "2-3 sentence summary of what the company does and their value proposition",
  "team_size_indicator": "small/medium/large/enterprise based on what you know",
  "tech_mentioned": ["array", "of", "technologies", "used"],
  "social_links": {
    "linkedin": "URL or null",
    "twitter": "URL or null",
    "facebook": "URL or null",
    "github": "URL or null"
  },
  "contact_info": {
    "email": "general contact email or null",
    "phone": "main phone or null",
    "address": "HQ address or null"
  },
  "founding_year": "year or null",
  "key_products": ["main", "products", "or", "services"]
}`,
    900
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const data: Record<string, unknown> = parsed || { summary: raw };

  return {
    source: 'company-website',
    fields_updated: ['website_analysis'],
    data: { website_analysis: parsed?.summary || raw, ...data },
    raw_response: raw,
  };
}

// ─── 2. Email Pattern Discovery ───────────────────────────────────────────────

export async function enrichEmailDiscovery(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const domain = (company.website || '')
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/.*$/, '')
    .trim();

  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are a B2B email research specialist. Identify likely email patterns for companies. Always respond with valid JSON.',
    `Identify the most likely email patterns and example addresses for this company.

${ctx}
Domain: ${domain || 'unknown'}

Common patterns: firstname.lastname@domain.com, f.lastname@domain, firstnamelastname@domain, firstname@domain, flastname@domain

Respond with JSON:
{
  "most_likely_pattern": "e.g. firstname.lastname@domain",
  "confidence": "high/medium/low",
  "patterns": ["firstname.lastname@domain", "f.lastname@domain"],
  "example_emails": ["john.smith@domain.com"],
  "general_emails": ["info@domain.com", "contact@domain.com", "hello@domain.com"],
  "notes": "any relevant notes about this company's email format"
}`,
    600
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const patterns = (parsed?.patterns as string[]) || [];
  const examples = (parsed?.example_emails as string[]) || [];
  const general = (parsed?.general_emails as string[]) || [];

  return {
    source: 'email-discovery',
    fields_updated: ['email_patterns'],
    data: {
      email_patterns: [...patterns, ...examples, ...general],
      email_pattern_primary: parsed?.most_likely_pattern || null,
      email_pattern_confidence: parsed?.confidence || null,
    },
    raw_response: raw,
  };
}

// ─── 3. Funding & Investors ───────────────────────────────────────────────────

export async function enrichFunding(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are a venture capital and funding research analyst. Research company funding history. Always respond with valid JSON.',
    `Research the funding history, investors, and financial backing for this company.

${ctx}

Respond with JSON:
{
  "summary": "brief funding summary",
  "total_raised": "total amount raised or null",
  "last_round": {
    "type": "Series A/B/Seed/etc or null",
    "amount": "amount or null",
    "date": "date or null",
    "investors": ["investor names"]
  },
  "all_rounds": [
    {"type": "round type", "amount": "amount", "date": "date", "investors": []}
  ],
  "investors": ["all known investor names"],
  "is_public": false,
  "ticker": "stock ticker if public or null",
  "valuation": "last known valuation or null",
  "bootstrapped": false
}`,
    900
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const summary = parsed?.summary
    ? `${parsed.summary}${parsed.total_raised ? ` Total raised: ${parsed.total_raised}.` : ''}`
    : raw;

  return {
    source: 'funding',
    fields_updated: ['funding_info'],
    data: {
      funding_info: summary,
      funding_detail: parsed || null,
    },
    raw_response: raw,
  };
}

// ─── 4. Google Business Profile ───────────────────────────────────────────────

export async function enrichGoogleBusiness(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are a local business research analyst. Research Google Business profiles and online reviews. Always respond with valid JSON.',
    `Research the Google Business Profile, ratings, and online reviews for this company.

${ctx}

Respond with JSON:
{
  "summary": "brief profile summary",
  "rating": 4.5,
  "review_count": 120,
  "address": "full address or null",
  "phone": "phone number or null",
  "hours": "business hours or null",
  "categories": ["business categories"],
  "maps_url": "Google Maps URL or null",
  "recent_reviews_summary": "summary of review sentiment",
  "verified": true
}`,
    700
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const summary = parsed
    ? `${parsed.summary || ''}${parsed.rating ? ` Rating: ${parsed.rating}/5` : ''}${parsed.review_count ? ` (${parsed.review_count} reviews)` : ''}`.trim()
    : raw;

  return {
    source: 'google-business',
    fields_updated: ['google_business'],
    data: {
      google_business: summary || raw,
      google_business_detail: parsed || null,
    },
    raw_response: raw,
  };
}

// ─── 5. Job Postings & Hiring Signals ────────────────────────────────────────

export async function enrichJobPostings(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are a B2B hiring intelligence analyst. Research company job postings and hiring signals. Always respond with valid JSON.',
    `Research current job postings and hiring signals for this company.

${ctx}

Respond with JSON:
{
  "summary": "brief hiring summary",
  "is_hiring": true,
  "open_roles_estimate": 5,
  "hiring_signal": "actively hiring/selective/not hiring/unknown",
  "departments_hiring": ["Engineering", "Sales"],
  "key_roles": ["specific job titles"],
  "growth_indicator": "growing/stable/contracting/unknown",
  "job_boards": ["LinkedIn", "Greenhouse", "Lever", "Indeed"],
  "recent_hires": ["notable recent hires or roles filled"],
  "notes": "any relevant hiring notes"
}`,
    700
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const summary = parsed?.summary
    ? `${parsed.summary}. Signal: ${parsed.hiring_signal || 'unknown'}. Departments: ${(parsed.departments_hiring as string[] || []).join(', ')}`
    : raw;

  return {
    source: 'job-postings',
    fields_updated: ['job_postings'],
    data: {
      job_postings: summary,
      job_postings_detail: parsed || null,
    },
    raw_response: raw,
  };
}

// ─── 6. LinkedIn Company Profile ─────────────────────────────────────────────

export async function enrichLinkedInCompany(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are a LinkedIn research analyst. Research company LinkedIn profiles and employee data. Always respond with valid JSON.',
    `Research this company's LinkedIn presence, employee count, and recent activity.

${ctx}

Respond with JSON:
{
  "summary": "LinkedIn profile summary",
  "linkedin_url": "company LinkedIn URL or null",
  "employee_count_linkedin": 150,
  "follower_count": 5000,
  "specialties": ["specialty 1", "specialty 2"],
  "recent_posts_summary": "summary of recent LinkedIn activity",
  "key_executives_visible": ["CEO name", "CTO name"],
  "company_type": "Public/Private/Non-profit",
  "founded": "year",
  "hq_location": "city, country"
}`,
    700
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const linkedinUrl = parsed?.linkedin_url as string | null;

  return {
    source: 'linkedin-company',
    fields_updated: ['linkedin_company'],
    data: {
      linkedin_company: parsed?.summary || raw,
      linkedin_url: linkedinUrl || company.website,
      linkedin_company_detail: parsed || null,
    },
    raw_response: raw,
  };
}

// ─── 7. Phone Validation ─────────────────────────────────────────────────────

const PHONE_PATTERNS = [
  /^\+?1?\s?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}$/,  // US/CA
  /^\+44\s?\d{10}$/,                                      // UK
  /^\+49\s?[\d\s]{9,12}$/,                               // Germany
  /^\+33\s?[\d\s]{9}$/,                                  // France
  /^\+61\s?[\d\s]{9}$/,                                  // Australia
  /^\+\d{1,3}[\s\-]?\d{6,14}$/,                         // Generic international
];

function quickValidatePhone(phone: string): 'valid' | 'suspicious' | 'invalid' {
  const cleaned = phone.replace(/\s/g, '');
  const digits = cleaned.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) return 'invalid';

  const suspiciousPatterns = [
    /^(\d)\1{6,}$/, // repeated digits: 1111111
    /^(012345|123456|000000|999999)/,
    /^(555)/,  // US test numbers
  ];
  if (suspiciousPatterns.some(p => p.test(digits))) return 'suspicious';

  if (PHONE_PATTERNS.some(p => p.test(cleaned))) return 'valid';

  // Reasonable length with country code = probably valid
  if (digits.length >= 10 && digits.length <= 15) return 'valid';

  return 'suspicious';
}

export async function enrichPhoneValidation(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  // Collect all phones from company
  const phones: string[] = [];
  if (company.phone) phones.push(String(company.phone));
  if ((company as Record<string, unknown>).director_phone) phones.push(String((company as Record<string, unknown>).director_phone));
  if ((company as Record<string, unknown>).contact_phone) phones.push(String((company as Record<string, unknown>).contact_phone));

  const contacts = Array.isArray(company.contacts) ? company.contacts as { phone?: string }[] : [];
  contacts.forEach(c => { if (c.phone) phones.push(c.phone); });
  const directors = Array.isArray(company.directors) ? company.directors as { phone?: string }[] : [];
  directors.forEach(d => { if (d.phone) phones.push(d.phone); });

  const uniquePhones = [...new Set(phones.filter(Boolean))];

  if (uniquePhones.length === 0) {
    return {
      source: 'phone-validation',
      fields_updated: ['phone_validation'],
      data: { phone_validation: {}, phone_validation_summary: 'No phones to validate' },
    };
  }

  // Quick regex validation first
  const regexResults: Record<string, string> = {};
  uniquePhones.forEach(p => { regexResults[p] = quickValidatePhone(p); });

  // Use AI to validate suspicious ones and confirm
  const suspiciousPhones = uniquePhones.filter(p => regexResults[p] === 'suspicious');
  let aiResults: Record<string, string> = {};

  if (suspiciousPhones.length > 0) {
    try {
      const raw = await callOpenAI(
        apiKey,
        'You are a phone number validation expert. Always respond with valid JSON.',
        `Validate these phone numbers. For each, respond with "valid", "suspicious", or "invalid".
Consider: correct digit count, valid country code, proper format, obvious test numbers.

Phones: ${suspiciousPhones.map((p, i) => `${i}. ${p}`).join('\n')}

Respond with JSON: {"results": [{"index": 0, "status": "valid"}]}`,
        300
      );
      const parsed = parseJsonFromText(raw) as { results?: { index: number; status: string }[] } | null;
      parsed?.results?.forEach(r => {
        if (suspiciousPhones[r.index]) {
          aiResults[suspiciousPhones[r.index]] = r.status;
        }
      });
    } catch { /* use regex results */ }
  }

  const finalResults: Record<string, string> = {};
  uniquePhones.forEach(p => {
    finalResults[p] = aiResults[p] || regexResults[p];
  });

  const validCount = Object.values(finalResults).filter(v => v === 'valid').length;
  const summary = `${validCount}/${uniquePhones.length} valid`;

  return {
    source: 'phone-validation',
    fields_updated: ['phone_validation'],
    data: {
      phone_validation: finalResults,
      phone_validation_summary: summary,
    },
  };
}

// ─── 8. SEC Edgar Filings ────────────────────────────────────────────────────

export async function enrichSecEdgar(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are an SEC filings research analyst. Research public company filings and regulatory submissions. Always respond with valid JSON.',
    `Research SEC EDGAR filings and regulatory submissions for this company (if it is a US public company or has SEC filing obligations).

${ctx}

Respond with JSON:
{
  "is_public": false,
  "ticker": "AAPL or null",
  "cik": "SEC CIK number or null",
  "recent_filings": [
    {"type": "10-K", "date": "2024-01-15", "description": "Annual report"}
  ],
  "latest_10k_summary": "key highlights from latest annual report or null",
  "latest_10q_summary": "key highlights from latest quarterly report or null",
  "material_events": ["significant 8-K filings or events"],
  "auditor": "audit firm name or null",
  "fiscal_year_end": "December 31 or null",
  "notes": "any relevant notes, e.g. private company so no SEC filings"
}`,
    700
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const summary = parsed?.is_public === false
    ? 'Private company — no SEC filings required'
    : parsed?.latest_10k_summary as string || raw;

  return {
    source: 'sec-edgar',
    fields_updated: ['sec_filings'],
    data: {
      sec_filings: summary,
      sec_detail: parsed || null,
    },
    raw_response: raw,
  };
}

// ─── 9. Social Media Signals ──────────────────────────────────────────────────

export async function enrichSocialSignals(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are a social media research analyst. Research company social media presence. Always respond with valid JSON.',
    `Research this company's social media presence across all major platforms.

${ctx}

Respond with JSON:
{
  "summary": "brief social media presence summary",
  "platforms": {
    "twitter": "URL or handle or null",
    "linkedin": "URL or null",
    "facebook": "URL or null",
    "instagram": "URL or null",
    "youtube": "URL or null",
    "github": "URL or null",
    "tiktok": "URL or null"
  },
  "most_active_platform": "platform name or null",
  "follower_estimates": {
    "twitter": 5000,
    "linkedin": 10000
  },
  "content_focus": "what type of content they post",
  "engagement_level": "high/medium/low/unknown"
}`,
    700
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const platforms = (parsed?.platforms as Record<string, string | null>) || {};
  const socialMedia: Record<string, string> = {};
  Object.entries(platforms).forEach(([k, v]) => {
    if (v) socialMedia[k] = v;
  });

  return {
    source: 'social-signals',
    fields_updated: ['social_media'],
    data: {
      social_media: socialMedia,
      social_media_summary: parsed?.summary || raw,
    },
    raw_response: raw,
  };
}

// ─── 10. Technology Stack (Wappalyzer-style) ──────────────────────────────────

// Tech categories from Wappalyzer signatures
const TECH_CATEGORIES = [
  'CMS', 'Analytics', 'CRM', 'E-commerce', 'Hosting', 'Marketing Automation',
  'JavaScript Framework', 'CSS Framework', 'Search', 'Payment Processing',
  'CDN', 'Security', 'Live Chat', 'Video', 'ERP', 'HR & Recruiting',
  'Data & BI', 'Cloud Platform', 'DevOps',
];

export async function enrichTechStack(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are a technology stack analyst. Identify company tech stacks based on their industry, size, and digital presence. Always respond with valid JSON.',
    `Identify the most likely technology stack for this company based on their profile.

${ctx}

Consider: CMS, analytics, CRM, e-commerce, hosting, marketing tools, frameworks.
Known tech stacks: WordPress, Shopify, HubSpot, Salesforce, React, Next.js, AWS, Cloudflare, Google Analytics, etc.

Tech categories to consider: ${TECH_CATEGORIES.join(', ')}

Respond with JSON:
{
  "tech_stack": ["WordPress", "Google Analytics", "HubSpot"],
  "by_category": {
    "CMS": ["WordPress"],
    "Analytics": ["Google Analytics"],
    "CRM": ["HubSpot"]
  },
  "confidence": "high/medium/low",
  "notes": "reasoning or notable observations"
}`,
    700
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const techStack = (parsed?.tech_stack as string[]) || [];

  return {
    source: 'tech-stack',
    fields_updated: ['tech_stack'],
    data: {
      tech_stack: techStack,
      tech_stack_by_category: parsed?.by_category || null,
      tech_stack_confidence: parsed?.confidence || null,
    },
    raw_response: raw,
  };
}

// ─── 11. General Web Research ─────────────────────────────────────────────────

export async function enrichWebResearch(
  company: Company,
  apiKey: string
): Promise<EnrichmentSourceResult> {
  const ctx = companyContext(company);
  const raw = await callOpenAI(
    apiKey,
    'You are a B2B research analyst with deep knowledge of companies and industries. Provide comprehensive research. Always respond with valid JSON.',
    `Provide comprehensive web research and intelligence on this company.

${ctx}

Respond with JSON:
{
  "summary": "comprehensive company overview",
  "key_facts": ["important fact 1", "fact 2"],
  "recent_news": ["news item 1", "news item 2"],
  "competitors": ["competitor 1", "competitor 2"],
  "market_position": "description of market position",
  "pain_points": ["likely pain point 1", "pain point 2"],
  "opportunities": ["sales opportunity 1", "opportunity 2"],
  "red_flags": ["any concerns"],
  "recommended_approach": "sales/outreach approach"
}`,
    1000
  );

  const parsed = parseJsonFromText(raw) as Record<string, unknown> | null;
  const summary = parsed?.summary as string || raw;

  return {
    source: 'web-research',
    fields_updated: ['web_research'],
    data: {
      web_research: summary,
      web_research_detail: parsed || null,
    },
    raw_response: raw,
  };
}

// ─── Batch runner helper ──────────────────────────────────────────────────────

export type EnrichmentSourceKey =
  | 'company-website'
  | 'email-discovery'
  | 'funding'
  | 'google-business'
  | 'job-postings'
  | 'linkedin-company'
  | 'phone-validation'
  | 'sec-edgar'
  | 'social-signals'
  | 'tech-stack'
  | 'web-research';

export const ENRICHMENT_SOURCE_MAP: Record<
  EnrichmentSourceKey,
  (company: Company, apiKey: string) => Promise<EnrichmentSourceResult>
> = {
  'company-website': enrichCompanyWebsite,
  'email-discovery': enrichEmailDiscovery,
  'funding': enrichFunding,
  'google-business': enrichGoogleBusiness,
  'job-postings': enrichJobPostings,
  'linkedin-company': enrichLinkedInCompany,
  'phone-validation': enrichPhoneValidation,
  'sec-edgar': enrichSecEdgar,
  'social-signals': enrichSocialSignals,
  'tech-stack': enrichTechStack,
  'web-research': enrichWebResearch,
};
