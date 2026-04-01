import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Building2,
  PhoneCall,
  Zap,
  Users,
  ArrowLeftRight,
  ArrowUpDown,
  BarChart3,
  Settings,
  LayoutDashboard,
  Send,
  Shield,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Jarvis Chat', icon: MessageCircle, path: '/jarvis' },
  { label: 'Companies', icon: Building2, path: '/leads' },
  { label: 'Call Sheet', icon: PhoneCall, path: '/call-sheet' },
  { label: 'Enrichment', icon: Zap, path: '/enrichment' },
  { label: 'Pipeline', icon: LayoutDashboard, path: '/pipeline' },
  { label: 'Outreach', icon: Send, path: '/outreach' },
  { label: 'Qualification', icon: Shield, path: '/qualification' },
  { label: 'Team', icon: Users, path: '/team' },
  { label: 'DealFlow', icon: ArrowLeftRight, path: '/dealflow' },
  { label: 'Import/Export', icon: ArrowUpDown, path: '/import-export' },
  { label: 'Sources', icon: BarChart3, path: '/sources' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 256,
        height: '100vh',
        background: '#FFFFFF',
        borderRight: '1px solid #E3E8EE',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid #E3E8EE',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0A2540', letterSpacing: '-0.3px' }}>
          🐕 Corgi
        </div>
        <div style={{ fontSize: 12, color: '#8898aa', marginTop: 2, fontWeight: 500 }}>
          Enrichment
        </div>
      </div>

      {/* Nav items */}
      <div style={{ padding: '12px 8px', flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === '/leads' && location.pathname.startsWith('/leads')) ||
            (item.path === '/jarvis' && location.pathname === '/chat');
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 12px',
                marginBottom: 2,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(99,91,255,0.08)' : 'transparent',
                color: isActive ? '#635BFF' : '#425466',
                textAlign: 'left',
                transition: 'background 0.12s, color 0.12s',
                borderLeft: isActive ? '3px solid #635BFF' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#F6F9FC';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }
              }}
            >
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #E3E8EE' }}>
        <div style={{ fontSize: 11, color: '#8898aa' }}>Corgi Enrichment v2</div>
      </div>
    </nav>
  );
}
