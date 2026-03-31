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
    <div className="fixed bottom-0 left-64 z-50 w-96 flex flex-col rounded-t-xl border border-[#1f1f2e] bg-[#0f0f14] shadow-2xl" style={{ height: '480px' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f2e]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#6C63FF]" />
          <span className="text-sm font-semibold">Jarvis AI</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#1a1a24] text-[#95a2b3]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-[#95a2b3] text-xs space-y-1 pt-8">
            <p className="font-medium">Hi! I'm Jarvis.</p>
            <p>Ask me anything about your leads, prospecting, or CRM strategies.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-[#6C63FF] text-white' : 'bg-[#1a1a24] text-[#f7f8f8]'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a24] rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#95a2b3]" />
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-[#1f1f2e]">
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
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#0f0f14] border-r border-[#1f1f2e] flex flex-col z-50">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#1f1f2e]">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#6C63FF]/20">
            <Dog className="w-5 h-5 text-[#6C63FF]" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#f7f8f8]">Corgi</div>
            <div className="text-xs text-[#95a2b3]">Enrichment Tool</div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {/* Jarvis item */}
          <button
            onClick={() => setJarvisOpen((v) => !v)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              jarvisOpen
                ? 'bg-[#6C63FF]/10 text-[#6C63FF]'
                : 'text-[#95a2b3] hover:bg-[#1a1a24] hover:text-[#f7f8f8]'
            )}
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            Jarvis
          </button>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[#6C63FF]/10 text-[#6C63FF]'
                      : 'text-[#95a2b3] hover:bg-[#1a1a24] hover:text-[#f7f8f8]'
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1f1f2e]">
          <p className="text-xs text-[#95a2b3]">Corgi Insurance Enrichment</p>
          <p className="text-xs text-[#5c6370]">v2.0.0</p>
        </div>
      </aside>

      {jarvisOpen && <JarvisPanel onClose={() => setJarvisOpen(false)} />}
    </>
  );
}
