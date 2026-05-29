import { useState } from 'react';
import { API_BASE, useApi } from '../../hooks/useApi';
import { useScreenNav } from '../../hooks/useNavigate';
import { usePersona } from '../../hooks/usePersona';
import type { LearningArticle, LearningCategoryGroup, LearningResponse } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

interface ExpandedState {
  [id: string]: { loading: boolean; content: string[] | null; error: string | null };
}

export function LearningScreen() {
  const { go } = useScreenNav();
  const { data } = useApi<LearningResponse>('/api/v1/learning');
  const { headers } = usePersona();
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const toggle = async (article: LearningArticle) => {
    const current = expanded[article.id];
    if (current && current.content !== null) {
      // Already loaded — flip open/closed.
      setExpanded((e) => ({ ...e, [article.id]: { ...current, content: current.content } }));
      // Use a sentinel: presence of `_open` to indicate visibility.
      setOpenIds((set) => {
        const next = new Set(set);
        if (next.has(article.id)) next.delete(article.id);
        else next.add(article.id);
        return next;
      });
      return;
    }
    if (current?.loading) return;
    setExpanded((e) => ({ ...e, [article.id]: { loading: true, content: null, error: null } }));
    setOpenIds((set) => new Set(set).add(article.id));
    try {
      const res = await fetch(API_BASE + '/api/v1/learning/' + encodeURIComponent(article.id), { headers });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const full = (await res.json()) as LearningArticle;
      setExpanded((e) => ({ ...e, [article.id]: { loading: false, content: full.content, error: null } }));
    } catch (err) {
      setExpanded((e) => ({ ...e, [article.id]: { loading: false, content: null, error: String(err) } }));
    }
  };

  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  return (
    <div className="screen active">
      <BackHeader title="Learn" />
      <div style={{ flex: 1, padding: 16 }}>
        <div style={{ background: 'var(--navy-deep)', borderRadius: 'var(--r-lg)', padding: 20, marginBottom: 16, color: 'white' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 6 }}>
            Financial learning
          </div>
          <div style={{ fontFamily: 'var(--font)', fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 4 }}>
            Short reads, written for hospitality
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            15 articles across 5 topics. Tap any card to expand the full guide.
          </div>
        </div>

        {data ? (
          data.categories.map((g) => (
            <Group key={g.category} group={g} expanded={expanded} openIds={openIds} onToggle={toggle} />
          ))
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>
        )}

        <button className="btn btn-navy" onClick={() => go('coach')}>
          <Icon name="robot" /> Ask your money coach
        </button>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

interface GroupProps {
  group: LearningCategoryGroup;
  expanded: ExpandedState;
  openIds: Set<string>;
  onToggle: (a: LearningArticle) => void;
}

function Group({ group, expanded, openIds, onToggle }: GroupProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>
        {group.emoji} {group.label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {group.articles.map((a) => {
          const open = openIds.has(a.id);
          const state = expanded[a.id];
          return (
            <div
              key={a.id}
              className="learn-card"
              style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 14, cursor: 'pointer' }}
              onClick={() => onToggle(a)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45, marginBottom: 6 }}>
                    {a.summary}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.readTimeMinutes} min read</div>
                </div>
                <Icon
                  name="chevronD"
                  size={18}
                  color="var(--text-3)"
                  style={{ transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : undefined }}
                />
              </div>
              {open && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  {state?.loading && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</div>}
                  {state?.error && <div style={{ fontSize: 12, color: 'var(--orange-text)' }}>Could not load article. Try again later.</div>}
                  {state?.content?.map((p, i) => (
                    <p key={i} style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.55, margin: '0 0 10px' }}>
                      {p}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
