import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  ArrowUpDown,
  ArrowLeftRight,
  Settings,
  Dog,
  Zap,
  PhoneCall,
  UserCircle,
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/lib/store';
import { Button } from './ui/button';
import { Input } from './ui/input';

const navItems = [
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/call-sheet', label: 'For Me', icon: PhoneCall },
  { href: '/sources', label: 'Engine', icon: Zap },
  { href: '/team', label: 'Team', icon: UserCircle },
  { href: '/dealflow', label: 'DealFlow', icon: ArrowLeftRight },
  { href: '/import-export', label: 'Import & Export', icon: ArrowUpDown },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function JarvisPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { apiKeys } = useSettingsStore();

  const send = async () => {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const key = apiKeys.anthropic;
      if (!key) {
        setMessages([...newMessages, { role: 'assistant', content: 'Please set your Anthropic API key in Settings first.' }]);
        return;
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          system: 'You are Jarvis, an AI assistant for the Corgi Lead Enrichment Tool. Help users with their lead management, prospecting strategies, and CRM tasks.',
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text ?? 'No response.';
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Error contacting API. Check your key in Settings.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-64 z-50 w-96 flex flex-col shadow-2xl"
      style={{
        height: '480px',
        background: '#0f0f14',
        border: '1px solid #1f1f2e',
        borderBottom: 'none',
        borderRadius: '12px 12px 0 0',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1f1f2e' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(108,99,255,0.15)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#6C63FF' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#f7f8f8' }}>Jarvis AI</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
          style={{ color: '#5c6370' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#95a2b3')}
          onMouseLeave={e => (e.currentTarget.style.color = '#5c6370')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center space-y-1 pt-10">
            <p className="text-sm font-medium" style={{ color: '#95a2b3' }}>Hi, I'm Jarvis.</p>
            <p className="text-xs" style={{ color: '#5c6370' }}>Ask me about your leads, prospecting,<br />or CRM strategies.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] rounded-xl px-3 py-2 text-sm"
              style={
                m.role === 'user'
                  ? { background: '#6C63FF', color: '#fff' }
                  : { background: '#1a1a26', color: '#e8eaed' }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2" style={{ background: '#1a1a26' }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#5c6370' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3" style={{ borderTop: '1px solid #1f1f2e' }}>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask Jarvis..."
            className="flex-1 text-sm"
            disabled={loading}
          />
          <Button size="icon" onClick={send} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [jarvisOpen, setJarvisOpen] = useState(false);

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-full w-64 flex flex-col z-50"
        style={{
          background: '#0E0E14',
          borderRight: '1px solid #1a1a24',
        }}
      >
        {/* ── Logo ───────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid #1a1a24' }}
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{ background: 'rgba(108,99,255,0.15)' }}
          >
            <Dog className="w-4 h-4" style={{ color: '#6C63FF' }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight" style={{ color: '#f7f8f8' }}>
              Corgi
            </div>
            <div className="text-[11px]" style={{ color: '#5c6370' }}>
              Enrichment
            </div>
          </div>
        </div>

        {/* ── Nav ────────────────────────────────────── */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {/* Jarvis button */}
          <button
            onClick={() => setJarvisOpen((v) => !v)}
            className={cn(
              'w-full flex items-center gap-3 py-2.5 pr-4 pl-5 text-sm font-medium',
              'transition-colors duration-100 relative border-l-2',
              jarvisOpen
                ? 'border-[#6C63FF] text-[#f7f8f8]'
                : 'border-transparent text-[#5c6370] hover:text-[#c0c9d5]'
            )}
            style={jarvisOpen ? { background: 'rgba(108,99,255,0.06)' } : undefined}
          >
            <MessageCircle className="w-[15px] h-[15px] shrink-0" />
            <span>Jarvis</span>
            {jarvisOpen && (
              <span
                className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(108,99,255,0.2)', color: '#a09dff' }}
              >
                AI
              </span>
            )}
          </button>

          {/* Separator */}
          <div className="mx-4 my-2" style={{ height: '1px', background: '#1a1a24' }} />

          {/* Route nav items */}
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 py-2.5 pr-4 pl-5 text-sm font-medium',
                    'transition-colors duration-100 border-l-2',
                    isActive
                      ? 'border-[#6C63FF] text-[#f7f8f8]'
                      : 'border-transparent text-[#5c6370] hover:text-[#c0c9d5]'
                  )
                }
                style={({ isActive }) =>
                  isActive ? { background: 'rgba(108,99,255,0.06)' } : undefined
                }
              >
                <Icon className="w-[15px] h-[15px] shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Footer ─────────────────────────────────── */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid #1a1a24' }}>
          <p className="text-[11px] font-medium" style={{ color: '#3a3a50' }}>
            Corgi Insurance Enrichment
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: '#2e2e42' }}>v2.0.0</p>
        </div>
      </aside>

      {jarvisOpen && <JarvisPanel onClose={() => setJarvisOpen(false)} />}
    </>
  );
}
