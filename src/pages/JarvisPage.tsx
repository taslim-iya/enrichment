import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Trash2, Loader2 } from 'lucide-react';
import { db, type Company, type ChatMessage } from '../lib/db';
import { useSettingsStore } from '../lib/store';

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  pageBg: '#F6F9FC',
  card: '#FFFFFF',
  border: '#E3E8EE',
  primary: '#635BFF',
  primaryDark: '#4f46e5',
  success: '#059669',
  textPrimary: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#8898aa',
  userBubble: '#635BFF',
  aiBubble: '#F0F2F5',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countBy(arr: Company[], key: keyof Company): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = String(item[key] || 'Unknown');
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function top5(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k} (${v})`)
    .join(', ');
}

function sumField(arr: Company[], key: keyof Company): number {
  return arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
}

async function buildContext(userMessage: string): Promise<{ contextMessage: string; matchingCompanies: Company[] }> {
  const companies = await db.companies.toArray();
  if (companies.length === 0) {
    return {
      contextMessage: 'The database is currently empty. No companies have been synced yet.',
      matchingCompanies: [],
    };
  }

  const byIndustry = countBy(companies, 'industry');
  const byGeo = countBy(companies, 'geography');
  const byStatus = countBy(companies, 'status');
  const totalRevenue = sumField(companies, 'revenue');
  const withContacts = companies.filter(c => c.contacts && c.contacts.length > 0).length;
  const withEmail = companies.filter(c => c.email || c.director_email || c.contact_email).length;

  const contextMessage =
    `DATABASE SNAPSHOT: ${companies.length.toLocaleString()} companies total. ` +
    `Industries (${Object.keys(byIndustry).length} unique): ${top5(byIndustry)}. ` +
    `Geographies (${Object.keys(byGeo).length} unique): ${top5(byGeo)}. ` +
    `Statuses: ${JSON.stringify(byStatus)}. ` +
    `Total revenue: $${(totalRevenue / 1e6).toFixed(1)}M. ` +
    `With contacts: ${withContacts}. With email: ${withEmail}.`;

  // Find matching companies for search queries
  const query = userMessage.toLowerCase();
  let matchingCompanies: Company[] = [];
  if (
    query.includes('find') || query.includes('search') || query.includes('show') ||
    query.includes('list') || query.includes('which') || query.includes('who') ||
    query.includes('companies in') || query.includes('company')
  ) {
    // Extract search terms and filter
    const words = query.split(/\s+/).filter(w => w.length > 3);
    matchingCompanies = companies.filter(c => {
      const hay = [c.company_name, c.industry, c.geography, c.description, c.status]
        .join(' ')
        .toLowerCase();
      return words.some(w => hay.includes(w));
    }).slice(0, 20);
  }

  return { contextMessage, matchingCompanies };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Company mini-card ────────────────────────────────────────────────────────

function CompanyCard({ company }: { company: Company }) {
  return (
    <div style={{
      background: S.card,
      border: `1px solid ${S.border}`,
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 6,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: '#EEF2FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontSize: 14, fontWeight: 700, color: S.primary,
      }}>
        {(company.company_name || '?')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: S.textPrimary, marginBottom: 2 }}>
          {company.company_name}
        </div>
        <div style={{ fontSize: 12, color: S.textMuted, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {company.industry && <span>{company.industry}</span>}
          {company.geography && <span>📍 {company.geography}</span>}
          {company.employees && <span>👥 {company.employees.toLocaleString()}</span>}
          {company.revenue && <span>💰 ${(Number(company.revenue) / 1e6).toFixed(1)}M</span>}
        </div>
      </div>
      {company.status && (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12,
          background: company.status === 'active' ? '#D1FAE5' : '#F3F4F6',
          color: company.status === 'active' ? '#065F46' : S.textMuted,
        }}>
          {company.status}
        </span>
      )}
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: S.textMuted,
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  streaming = false,
}: {
  msg: ChatMessage;
  streaming?: boolean;
}) {
  const isUser = msg.role === 'user';
  const companies = (msg.metadata?.companies || []) as Company[];

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 10,
      marginBottom: 18,
      alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: isUser ? S.primary : '#EEF2FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isUser
          ? <User size={16} color="#fff" />
          : <Bot size={16} color={S.primary} />}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '75%', minWidth: 40 }}>
        {/* Bubble */}
        <div style={{
          padding: '10px 14px',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          background: isUser ? S.userBubble : S.aiBubble,
          color: isUser ? '#ffffff' : S.textPrimary,
          fontSize: 14,
          lineHeight: 1.6,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}>
          {streaming ? <TypingDots /> : msg.content || <TypingDots />}
          {streaming && msg.content && (
            <span>
              {msg.content}
              <span style={{ opacity: 0.5, animation: 'blink 0.8s step-end infinite' }}>▌</span>
            </span>
          )}
        </div>

        {/* Company cards embedded in AI messages */}
        {!isUser && companies.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: S.textMuted, marginBottom: 6, fontWeight: 500 }}>
              {companies.length} matching companies:
            </div>
            {companies.map((c, i) => <CompanyCard key={i} company={c} />)}
          </div>
        )}

        {/* Timestamp */}
        <div style={{
          fontSize: 11, color: S.textMuted, marginTop: 4,
          textAlign: isUser ? 'right' : 'left',
        }}>
          {formatTime(msg.created_at)}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JarvisPage() {
  const { openaiKey } = useSettingsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from IndexedDB
  useEffect(() => {
    db.chat_messages.orderBy('created_at').toArray().then(setMessages);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent, loading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    // Persist user message
    const userId = await db.chat_messages.add(userMsg);
    userMsg.id = userId;
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamContent('');

    try {
      const { contextMessage, matchingCompanies } = await buildContext(text);

      const systemPrompt =
        `You are Jarvis, an AI assistant for Corgi Enrichment — a B2B lead management platform. ` +
        `You have access to the user's company database and help them search leads, analyze data, ` +
        `find patterns, suggest outreach strategies, and answer questions about their companies.\n\n` +
        `${contextMessage}\n\n` +
        (matchingCompanies.length > 0
          ? `MATCHING COMPANIES FOR THIS QUERY:\n${matchingCompanies
              .map(c => `- ${c.company_name} | ${c.industry || 'N/A'} | ${c.geography || 'N/A'} | ${c.employees || '?'} employees | Revenue: ${c.revenue ? '$' + (Number(c.revenue) / 1e6).toFixed(1) + 'M' : 'N/A'} | Status: ${c.status || 'N/A'}`)
              .join('\n')}\n\n`
          : '') +
        `When presenting company lists, be concise and structured. When analyzing data, provide actionable insights. ` +
        `When asked to push leads to call sheet, confirm you'll do it and provide instructions. ` +
        `Keep responses focused and practical for a B2B sales professional.`;

      // Build conversation history (last 20 messages to stay within context)
      const historyMessages = messages.slice(-20).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const apiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...historyMessages,
        { role: 'user' as const, content: text },
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: apiMessages,
          stream: true,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI error ${response.status}: ${errText}`);
      }

      // Stream response
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || '';
            fullContent += delta;
            setStreamContent(fullContent);
          } catch {
            // Ignore malformed chunks
          }
        }
      }

      // Persist assistant message
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: fullContent,
        created_at: new Date().toISOString(),
        metadata: matchingCompanies.length > 0 ? { companies: matchingCompanies } : undefined,
      };
      const assistantId = await db.chat_messages.add(assistantMsg);
      assistantMsg.id = assistantId;
      setMessages(prev => [...prev, assistantMsg]);
      setStreamContent('');
    } catch (err) {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `⚠️ Error: ${err instanceof Error ? err.message : String(err)}`,
        created_at: new Date().toISOString(),
      };
      const errId = await db.chat_messages.add(errMsg);
      errMsg.id = errId;
      setMessages(prev => [...prev, errMsg]);
      setStreamContent('');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, openaiKey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = async () => {
    await db.chat_messages.clear();
    setMessages([]);
  };

  const isStreaming = loading && streamContent.length > 0;
  const isTyping = loading && streamContent.length === 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 64px)',
      maxWidth: 900,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: S.textPrimary, margin: 0 }}>
            Jarvis
          </h1>
          <p style={{ fontSize: 13, color: S.textMuted, margin: '4px 0 0' }}>
            AI assistant with access to your lead database
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${S.border}`,
                background: S.card, color: S.textMuted,
                fontSize: 13, cursor: 'pointer',
              }}
              title="Clear chat history"
            >
              <Trash2 size={14} />
              Clear
            </button>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: '#EEF2FF', color: S.primary,
            fontSize: 13, fontWeight: 500,
          }}>
            <Bot size={14} />
            GPT-4o mini
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1,
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        minHeight: 0,
      }}>
        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            minHeight: 0,
          }}
        >
          {messages.length === 0 && !loading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              paddingTop: 60,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: '#EEF2FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={28} color={S.primary} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: S.textPrimary }}>
                Hello, I'm Jarvis
              </div>
              <div style={{ fontSize: 14, color: S.textMuted, textAlign: 'center', maxWidth: 420, lineHeight: 1.6 }}>
                Your AI assistant for Corgi Enrichment. Ask me to search companies, analyse your pipeline,
                find missing data, or suggest outreach strategies.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' }}>
                {[
                  'Find tech companies in California',
                  'What industries do we have most leads in?',
                  'Give me a pipeline summary',
                  'Which companies have missing email?',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    style={{
                      padding: '7px 14px', borderRadius: 20,
                      border: `1px solid ${S.border}`,
                      background: S.card, color: S.textSecondary,
                      fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <MessageBubble
              msg={{
                role: 'assistant',
                content: streamContent,
                created_at: new Date().toISOString(),
              }}
              streaming
            />
          )}

          {/* Pure typing indicator (before first token) */}
          {isTyping && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'flex-start' }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: '#EEF2FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={16} color={S.primary} />
              </div>
              <div style={{
                padding: '12px 16px',
                borderRadius: '4px 16px 16px 16px',
                background: S.aiBubble,
                display: 'flex', alignItems: 'center',
              }}>
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{
          borderTop: `1px solid ${S.border}`,
          padding: '14px 16px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          flexShrink: 0,
          background: S.card,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Jarvis anything about your leads… (Enter to send, Shift+Enter for newline)"
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: `1.5px solid ${input ? S.primary : S.border}`,
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 14,
              color: S.textPrimary,
              background: S.pageBg,
              outline: 'none',
              lineHeight: 1.5,
              fontFamily: 'inherit',
              maxHeight: 120,
              overflowY: 'auto',
              transition: 'border-color 0.15s',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            style={{
              width: 42, height: 42,
              borderRadius: 10,
              border: 'none',
              background: input.trim() && !loading ? S.primary : '#E3E8EE',
              color: input.trim() && !loading ? '#fff' : S.textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            {loading
              ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={18} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
