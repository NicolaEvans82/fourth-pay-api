import { useEffect, useRef, useState, type FormEvent } from 'react';
import { API_BASE } from '../../hooks/useApi';
import { usePersona } from '../../hooks/usePersona';
import { useScreenNav } from '../../hooks/useNavigate';
import type { CoachMessage } from '../../types/api';
import { Icon } from '../shared/Icon';

interface DisplayMsg {
  type: 'bot' | 'user';
  // The bot bubble allows lightweight markdown (**bold** + line breaks).
  html: string;
  time: string;
  showAvatar?: boolean;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c),
  );
}
function renderMarkdown(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}
function nowHM(): string {
  const n = new Date();
  return `${n.getHours()}:${String(n.getMinutes()).padStart(2, '0')}`;
}

const PROMPTS = [
  'How do I save for a holiday?',
  'Am I on track for retirement?',
  "What benefits am I missing?",
  'Help me pay off my loan faster',
];

const PROMPT_LABELS = ['Save for holiday ✈️', 'Pension check 🏦', "Benefits I'm owed 💰", 'Pay off loan 📉'];

const INITIAL_BOT_HTML_TEMPLATE = (firstName: string) =>
  `Hi ${escapeHtml(firstName)}! I'm your Fourth Pay money coach 👋<br><br>I can see your finances in one place and I'm here to give you personalised, unbiased guidance. What can I help you with today?`;

export function CoachScreen() {
  const { go } = useScreenNav();
  const { persona, headers } = usePersona();
  const [history, setHistory] = useState<CoachMessage[]>([]);
  const [messages, setMessages] = useState<DisplayMsg[]>(() => [
    { type: 'bot', html: INITIAL_BOT_HTML_TEMPLATE(persona.firstName), time: '9:30 AM', showAvatar: true },
    {
      type: 'bot',
      html:
        "💡 <strong>Heads up:</strong> You've accessed £130 this month — more than last month. Want me to help you work out a budget so you rely on pay access less?",
      time: '9:30 AM',
    },
  ]);
  const [input, setInput] = useState('');
  const [inFlight, setInFlight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset coach state when persona changes — see the original
  // switchPersona impl: coach history is per-persona.
  useEffect(() => {
    setHistory([]);
    setMessages([
      { type: 'bot', html: INITIAL_BOT_HTML_TEMPLATE(persona.firstName), time: nowHM(), showAvatar: true },
    ]);
  }, [persona.firstName]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async (text: string) => {
    if (inFlight) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput('');
    setMessages((m) => [...m, { type: 'user', html: escapeHtml(trimmed), time: nowHM() }]);
    const newHistory: CoachMessage[] = [...history, { role: 'user', content: trimmed }];
    setHistory(newHistory);
    setInFlight(true);
    setMessages((m) => [...m, { type: 'bot', html: '<em>thinking…</em>', time: nowHM(), showAvatar: true }]);
    try {
      const res = await fetch(API_BASE + '/api/v1/coach/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ message: trimmed, conversationHistory: history }),
      });
      let replyHtml: string;
      let reply: string | null = null;
      if (!res.ok) {
        let msg = `Sorry, I had trouble responding (HTTP ${res.status}). Please try again in a moment.`;
        try {
          const j = await res.json();
          if (j && j.message) msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        } catch {}
        replyHtml = escapeHtml(msg);
        // Pop the failed user turn from history so the next request
        // doesn't include it (matches original behaviour).
        setHistory((h) => h.slice(0, -1));
      } else {
        const data = (await res.json()) as { reply: string };
        reply = data.reply;
        replyHtml = renderMarkdown(reply);
        setHistory((h) => [...h, { role: 'assistant', content: data.reply }]);
      }
      // Replace the placeholder bot message with the real reply.
      setMessages((m) => {
        const copy = [...m];
        const lastIdx = copy.length - 1;
        if (copy[lastIdx]?.type === 'bot') {
          copy[lastIdx] = { ...copy[lastIdx], html: replyHtml };
        }
        return copy;
      });
    } catch {
      setMessages((m) => {
        const copy = [...m];
        const lastIdx = copy.length - 1;
        if (copy[lastIdx]?.type === 'bot') {
          copy[lastIdx] = { ...copy[lastIdx], html: "Sorry, I couldn't reach the coach. Check your connection and try again." };
        }
        return copy;
      });
      setHistory((h) => h.slice(0, -1));
    } finally {
      setInFlight(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="screen active">
      <div className="dark-header-sm">
        <div className="screen-title-row" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="back-btn" onClick={() => go('home')}>
              <Icon name="back" />
            </button>
            <div className="screen-title">Money coach</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>AI · Online</span>
          </div>
        </div>
      </div>
      <div className="coach-messages" ref={scrollRef}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Today</span>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={'msg ' + m.type}>
            {m.type === 'bot' && m.showAvatar !== false && <div className="coach-bot-icon">AI</div>}
            <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: m.html }} />
            <div className="msg-time">{m.time}</div>
          </div>
        ))}
      </div>
      <div className="quick-prompts">
        {PROMPTS.map((p, i) => (
          <div key={p} className="quick-prompt" onClick={() => send(p)}>
            {PROMPT_LABELS[i]}
          </div>
        ))}
      </div>
      <form className="chat-input-row" onSubmit={onSubmit}>
        <input
          className="chat-input"
          type="text"
          placeholder="Ask me anything about money…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="chat-send" type="submit" disabled={inFlight}>
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  );
}
