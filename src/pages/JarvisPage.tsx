import { MessageCircle } from 'lucide-react';

const STRIPE = {
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  textPrimary: '#0A2540',
  textMuted: '#8898aa',
};

export default function JarvisPage() {
  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: STRIPE.textPrimary, marginBottom: 24 }}>
        Jarvis Chat
      </h1>
      <div style={{
        background: STRIPE.card, border: `1px solid ${STRIPE.border}`,
        borderRadius: 12, padding: '60px 40px', textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <MessageCircle size={40} color={STRIPE.border} style={{ margin: '0 auto 16px' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: STRIPE.textPrimary, marginBottom: 8 }}>
          AI Chat Coming Soon
        </div>
        <div style={{ fontSize: 14, color: STRIPE.textMuted }}>
          Configure an AI API key to use the Jarvis assistant.
        </div>
      </div>
    </div>
  );
}
