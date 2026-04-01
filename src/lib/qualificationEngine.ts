/**
 * Qualification Engine for E1
 * Scores companies against configurable criteria
 */

export interface QualificationCriteria {
  id: string;
  name: string;
  revenue_min?: number;
  revenue_max?: number;
  employees_min?: number;
  employees_max?: number;
  min_years_incorporated?: number;
  max_years_incorporated?: number;
  target_industries?: string[];
  exclude_industries?: string[];
  require_linkedin?: boolean;
  website_preference: 'professional' | 'non-professional' | 'any';
  target_geographies?: string[];
  weights: {
    revenue: number;
    employees: number;
    company_age: number;
    industry: number;
    linkedin: number;
    website: number;
    geography: number;
  };
  auto_qualify_score: number;
  auto_reject_score: number;
  created_at: string;
}

export interface QualBreakdown {
  criterion: string;
  score: number;
  weight: number;
  reason: string;
}

export interface QualificationResult {
  score: number;
  status: 'qualified' | 'unqualified' | 'review';
  breakdown: QualBreakdown[];
  ai_website_assessment?: string;
}

export const DEFAULT_CRITERIA: QualificationCriteria = {
  id: 'default',
  name: 'Default',
  website_preference: 'any',
  weights: { revenue: 15, employees: 15, company_age: 10, industry: 20, linkedin: 10, website: 15, geography: 15 },
  auto_qualify_score: 70,
  auto_reject_score: 30,
  created_at: new Date().toISOString(),
};

function currentYear() { return new Date().getFullYear(); }

export function qualifyCompany(
  company: Record<string, unknown>,
  criteria: QualificationCriteria,
): QualificationResult {
  const breakdown: QualBreakdown[] = [];
  const w = criteria.weights;
  const totalWeight = w.revenue + w.employees + w.company_age + w.industry + w.linkedin + w.website + w.geography;
  if (totalWeight === 0) return { score: 0, status: 'review', breakdown: [] };

  // Revenue
  const rev = Number(company.revenue) || 0;
  let revScore = 50;
  if (criteria.revenue_min != null || criteria.revenue_max != null) {
    const inMin = criteria.revenue_min == null || rev >= criteria.revenue_min;
    const inMax = criteria.revenue_max == null || rev <= criteria.revenue_max;
    revScore = inMin && inMax ? 100 : rev > 0 ? 30 : 0;
  } else if (rev > 0) {
    revScore = 70;
  }
  breakdown.push({ criterion: 'Revenue', score: revScore, weight: w.revenue, reason: rev > 0 ? `${(rev / 1000).toFixed(0)}k` : 'No data' });

  // Employees
  const emp = Number(company.employees) || 0;
  let empScore = 50;
  if (criteria.employees_min != null || criteria.employees_max != null) {
    const inMin = criteria.employees_min == null || emp >= criteria.employees_min;
    const inMax = criteria.employees_max == null || emp <= criteria.employees_max;
    empScore = inMin && inMax ? 100 : emp > 0 ? 30 : 0;
  } else if (emp > 0) {
    empScore = 70;
  }
  breakdown.push({ criterion: 'Employees', score: empScore, weight: w.employees, reason: emp > 0 ? `${emp}` : 'No data' });

  // Company age
  const yearInc = String(company.year_incorporated || '');
  const year = parseInt(yearInc) || 0;
  let ageScore = 50;
  if (year > 0) {
    const age = currentYear() - year;
    const minOk = criteria.min_years_incorporated == null || age >= criteria.min_years_incorporated;
    const maxOk = criteria.max_years_incorporated == null || age <= criteria.max_years_incorporated;
    ageScore = minOk && maxOk ? 100 : 30;
    breakdown.push({ criterion: 'Company Age', score: ageScore, weight: w.company_age, reason: `${age} years` });
  } else {
    breakdown.push({ criterion: 'Company Age', score: 0, weight: w.company_age, reason: 'No data' });
  }

  // Industry
  const industry = String(company.industry || '').toLowerCase();
  let indScore = 50;
  if (criteria.exclude_industries?.some(e => industry.includes(e.toLowerCase()))) {
    indScore = 0;
  } else if (criteria.target_industries?.length) {
    indScore = criteria.target_industries.some(t => industry.includes(t.toLowerCase())) ? 100 : 20;
  }
  breakdown.push({ criterion: 'Industry', score: indScore, weight: w.industry, reason: industry || 'Unknown' });

  // LinkedIn
  const hasLinkedin = Boolean(company.linkedin_url || (Array.isArray(company.directors) && (company.directors as Array<Record<string, string>>).some(d => d.linkedin_url)));
  let linkScore = criteria.require_linkedin ? (hasLinkedin ? 100 : 0) : (hasLinkedin ? 80 : 50);
  breakdown.push({ criterion: 'LinkedIn', score: linkScore, weight: w.linkedin, reason: hasLinkedin ? 'Found' : 'Not found' });

  // Website
  const website = String(company.website || '');
  let webScore = website ? 60 : 0;
  // Simple heuristic: non-professional = basic domain, no HTTPS, simple TLD
  if (website && criteria.website_preference !== 'any') {
    const looksBasic = !website.includes('https') || website.endsWith('.co.uk') || !website.includes('www');
    if (criteria.website_preference === 'non-professional') {
      webScore = looksBasic ? 100 : 40; // Non-professional preferred = basic sites score higher
    } else {
      webScore = looksBasic ? 40 : 100;
    }
  }
  breakdown.push({ criterion: 'Website', score: webScore, weight: w.website, reason: website || 'None' });

  // Geography
  const geo = String(company.geography || '').toLowerCase();
  let geoScore = 50;
  if (criteria.target_geographies?.length) {
    geoScore = criteria.target_geographies.some(g => geo.includes(g.toLowerCase())) ? 100 : 20;
  }
  breakdown.push({ criterion: 'Geography', score: geoScore, weight: w.geography, reason: geo || 'Unknown' });

  // Weighted average
  const weightedSum = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0);
  const score = Math.round(weightedSum / totalWeight);

  const status: QualificationResult['status'] =
    score >= criteria.auto_qualify_score ? 'qualified' :
    score <= criteria.auto_reject_score ? 'unqualified' : 'review';

  return { score, status, breakdown };
}

// AI website assessment using OpenAI
export async function assessWebsiteWithAI(
  website: string,
  preference: 'professional' | 'non-professional' | 'any',
  apiKey: string
): Promise<string> {
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Assess the professionalism of a business website. Rate it as professional or non-professional and explain why in 2 sentences.' },
          { role: 'user', content: `Website: ${website}\nPreference: ${preference === 'non-professional' ? 'Client prefers non-professional/basic websites (these are better leads for them)' : 'Client prefers professional websites'}` }
        ],
        max_tokens: 200,
      }),
    });
    if (!resp.ok) return 'Assessment unavailable';
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || 'No assessment';
  } catch {
    return 'Assessment failed';
  }
}
