export const ALL_STATUSES = [
  'New',
  'Contacted',
  'Booked',
  'Bad Fit',
  'Not Interested',
  'Existing Partner',
  'Low Interest',
];

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export const ALL_INDUSTRIES = [
  'trucking', 'logistics', 'construction', 'healthcare', 'manufacturing',
  'retail', 'technology', 'finance', 'real_estate', 'agriculture',
  'energy', 'education', 'hospitality', 'non_profit', 'other',
];

export const INDUSTRY_LABELS: Record<string, string> = {
  trucking: 'Trucking',
  logistics: 'Logistics',
  construction: 'Construction',
  healthcare: 'Healthcare',
  manufacturing: 'Manufacturing',
  retail: 'Retail',
  technology: 'Technology',
  finance: 'Finance',
  real_estate: 'Real Estate',
  agriculture: 'Agriculture',
  energy: 'Energy',
  education: 'Education',
  hospitality: 'Hospitality',
  non_profit: 'Non-Profit',
  other: 'Other',
};

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1')
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return phone;
}

// Legacy exports kept for compatibility
export function getScoreColor(_score: number | null | undefined): string {
  return '';
}

export function getStatusColor(_status: string | null | undefined): string {
  return '';
}

export const AVATAR_COLORS = [
  '#635BFF', '#059669', '#E25950', '#f59e0b',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
];
