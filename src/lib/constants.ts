export const STATUS_COLORS: Record<string, string> = {
  New: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  Contacted: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Booked: 'bg-green-500/20 text-green-300 border-green-500/30',
  'Bad Fit': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Not Interested': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Existing Partner': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Low Interest': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

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

export function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined)
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  if (score >= 70) return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (score >= 40)
    return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  return 'bg-red-500/20 text-red-300 border-red-500/30';
}

export function getStatusColor(status: string | null | undefined): string {
  return (
    STATUS_COLORS[status ?? 'New'] ?? STATUS_COLORS['New']
  );
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1')
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return phone;
}

export const AVATAR_COLORS = [
  '#6C63FF', '#00D4AA', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4',
];
