import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { useSettingsStore } from '@/lib/store';

interface FilterParams {
  search?: string;
  stateFilter?: string;
  industryFilter?: string;
  statusFilter?: string;
  states?: string[];
  industries?: string[];
  statuses?: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  filters?: FilterParams;
}

interface AIChatProps {
  currentFilters: FilterParams;
  onApplyFilters: (filters: FilterParams) => void;
}

export function AIChat({ currentFilters, onApplyFilters }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { apiKeys } = useSettingsStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const key = apiKeys.anthropic;
      if (!key) {
        setMessages([...newMessages, { role: 'assistant', content: 'Set your Anthropic API key in Settings to use AI filters.' }]);
        return;
      }

      const systemPrompt = `You are a lead filter assistant. Current filters: ${JSON.stringify(currentFilters)}.
The user wants to filter/sort leads. Respond with JSON in this format:
{"filters": {"search": string, "states": string[], "industries": string[], "statuses": string[]}, "explanation": string}
Only include fields the user mentioned. Keep explanation under 50 words.`;

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
          max_tokens: 256,
          system: systemPrompt,
          messages: [{ role: 'user', content: query }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text ?? '{}';

      try {
        const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
        const filters: FilterParams = parsed.filters ?? {};
        setMessages([...newMessages, {
          role: 'assistant',
          content: parsed.explanation ?? 'Filters applied.',
          filters,
        }]);
        if (Object.keys(filters).length > 0) {
          onApplyFilters(filters);
        }
      } catch {
        setMessages([...newMessages, { role: 'assistant', content: 'I had trouble parsing that. Try rephrasing.' }]);
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Connection error. Check your API key in Settings.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-[#6C63FF] text-white shadow-lg hover:bg-[#5a52e0] transition-colors">
        <Sparkles className="w-5 h-5" />
        <span className="text-sm font-medium">AI Filter</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[500px] flex flex-col rounded-xl border border-[#1f1f2e] bg-[#0f0f14] shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f2e]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#6C63FF]" />
          <span className="text-sm font-semibold">AI Filter Assistant</span>
        </div>
        <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[#1a1a24] text-[#95a2b3]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[350px]">
        {messages.length === 0 && (
          <div className="text-center text-[#95a2b3] text-xs space-y-2 pt-8">
            <p className="font-medium">Try something like:</p>
            <p>"Show leads in Texas with score above 70"</p>
            <p>"Find unassigned leads in trucking industry"</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-[#6C63FF] text-white' : 'bg-[#1a1a24] text-[#f7f8f8]'}`}>
              <p>{msg.content}</p>
              {msg.filters && Object.keys(msg.filters).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {msg.filters.states?.map((s) => (
                    <Badge key={s} className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30">{s}</Badge>
                  ))}
                  {msg.filters.statuses?.map((s) => (
                    <Badge key={s} className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/30">{s}</Badge>
                  ))}
                </div>
              )}
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
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-[#1f1f2e]">
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe what you want to see..." className="flex-1 text-sm" disabled={loading} />
          <Button size="icon" onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
