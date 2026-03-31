import { NavLink } from 'react-router-dom';
import {
  Users,
  PhoneCall,
  Zap,
  UserCircle,
  ArrowLeftRight,
  ArrowUpDown,
  Settings,
  MessageCircle,
} from 'lucide-react';

const navItems = [
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/call-sheet', icon: PhoneCall, label: 'For Me' },
  { to: '/enrichment', icon: Zap, label: 'Engine' },
  { to: '/team', icon: UserCircle, label: 'Team' },
  { to: '/dealflow', icon: ArrowUpDown, label: 'DealFlow' },
  { to: '/import-export', icon: ArrowLeftRight, label: 'Import & Export' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside
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
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid #E3E8EE',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🐕</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', lineHeight: 1.2 }}>
              Corgi
            </div>
            <div style={{ fontSize: 12, color: '#8898aa', lineHeight: 1.2 }}>
              Enrichment
            </div>
          </div>
        </div>
      </div>

      {/* Jarvis Chat Button */}
      <div style={{ padding: '12px 12px 4px' }}>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(99,91,255,0.08)',
            border: '1px solid rgba(99,91,255,0.2)',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#635BFF',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <MessageCircle size={16} />
          Ask Jarvis
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 40,
              padding: '0 12px',
              marginBottom: 2,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#635BFF' : '#425466',
              background: isActive ? 'rgba(99,91,255,0.08)' : 'transparent',
              borderLeft: isActive ? '3px solid #635BFF' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            })}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (!el.getAttribute('aria-current')) {
                el.style.background = '#F6F9FC';
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'transparent';
              }
            }}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid #E3E8EE',
          fontSize: 11,
          color: '#8898aa',
        }}
      >
        v2.0
      </div>
    </aside>
  );
}
