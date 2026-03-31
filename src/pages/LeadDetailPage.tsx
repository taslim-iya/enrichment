import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Building2, Users, DollarSign, Mail, Phone } from 'lucide-react';
import { db, type Company } from '../lib/db';

const STRIPE = {
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  New: { bg: '#EEF2FF', color: '#635BFF' },
  Contacted: { bg: '#FEF9C3', color: '#92400e' },
  Booked: { bg: '#D1FAE5', color: '#065F46' },
  'Bad Fit': { bg: '#FEE2E2', color: '#991B1B' },
  'Not Interested': { bg: '#F3F4F6', color: '#6B7280' },
};

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number | undefined; icon?: React.ComponentType<{ size?: number; color?: string }> }) {
  return (
    <div style={{
      background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {Icon && <Icon size={13} color={STRIPE.textMuted} />}
        <span style={{ fontSize: 12, color: STRIPE.textMuted, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: STRIPE.textPrimary }}>
        {value || <span style={{ color: STRIPE.textMuted, fontSize: 16 }}>—</span>}
      </div>
    </div>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (!id) return;
    db.companies.get(Number(id)).then(c => setCompany(c || null));
  }, [id]);

  if (!company) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px', color: STRIPE.textMuted }}>
        {company === null ? 'Company not found.' : 'Loading…'}
      </div>
    );
  }

  const statusStyle = STATUS_COLORS[company.status || 'New'] || { bg: '#F3F4F6', color: '#6B7280' };

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 24, background: 'none', border: 'none',
          cursor: 'pointer', color: STRIPE.primary, fontSize: 14, fontWeight: 500, padding: 0,
        }}
      >
        <ArrowLeft size={16} /> Back to Companies
      </button>

      {/* Overview Card */}
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: 24, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Building2 size={18} color={STRIPE.primary} />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: STRIPE.textPrimary }}>
                {company.company_name}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              {company.industry && (
                <span style={{ fontSize: 13, color: STRIPE.textSecondary }}>{company.industry}</span>
              )}
              {(company.geography || company.state) && (
                <span style={{ fontSize: 13, color: STRIPE.textMuted }}>
                  📍 {company.geography || company.state}
                </span>
              )}
            </div>
          </div>
          <span style={{
            padding: '4px 14px', borderRadius: 20,
            fontSize: 13, fontWeight: 600,
            background: statusStyle.bg, color: statusStyle.color,
          }}>
            {company.status || 'New'}
          </span>
        </div>

        {company.description && (
          <p style={{ fontSize: 14, color: STRIPE.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
            {company.description}
          </p>
        )}

        {company.website && (
          <a
            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: STRIPE.primary, textDecoration: 'none',
            }}
          >
            <Globe size={13} /> {company.website}
          </a>
        )}
      </div>

      {/* Financial Metrics */}
      <h2 style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 12 }}>
        Financial Metrics
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MetricCard label="Revenue" value={company.revenue} icon={DollarSign} />
        <MetricCard label="Profit / Loss" value={company.profit} icon={DollarSign} />
        <MetricCard label="Assets" value={company.assets} icon={DollarSign} />
        <MetricCard label="Equity" value={company.equity} icon={DollarSign} />
        <MetricCard label="Employees" value={company.employees} icon={Users} />
      </div>

      {/* Director / Contact */}
      <h2 style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 12 }}>
        Director / Contact
      </h2>
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: 20, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {(company.director || company.contact_name) ? (
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 8 }}>
              {company.director || company.contact_name}
            </div>
            {company.contact_title && (
              <div style={{ fontSize: 13, color: STRIPE.textMuted, marginBottom: 12 }}>{company.contact_title}</div>
            )}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
              {(company.director_phone || company.contact_phone || company.phone) && (
                <a href={`tel:${company.director_phone || company.contact_phone || company.phone}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: STRIPE.primary, textDecoration: 'none' }}>
                  <Phone size={13} />
                  {company.director_phone || company.contact_phone || company.phone}
                </a>
              )}
              {(company.director_email || company.contact_email || company.email) && (
                <a href={`mailto:${company.director_email || company.contact_email || company.email}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: STRIPE.primary, textDecoration: 'none' }}>
                  <Mail size={13} />
                  {company.director_email || company.contact_email || company.email}
                </a>
              )}
            </div>
          </div>
        ) : (
          <div style={{ color: STRIPE.textMuted, fontSize: 14 }}>No director or contact info available.</div>
        )}
      </div>

      {/* Notes */}
      {company.notes && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 12 }}>Notes</h2>
          <div style={{
            background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
            borderRadius: 12, padding: 20, fontSize: 14, color: STRIPE.textSecondary, lineHeight: 1.6,
          }}>
            {company.notes}
          </div>
        </>
      )}
    </div>
  );
}
