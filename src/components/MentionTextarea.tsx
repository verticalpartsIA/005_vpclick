import React, { useMemo, useRef, useState } from 'react';
import { Team, User } from '../types';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  users: User[];
  teams: Team[];
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  id: string;
  name: string;
  kind: 'user' | 'team';
  avatar?: string;
  color?: string;
}

/**
 * Textarea de comentário com autocomplete de menções estilo ClickUp:
 * digite "@" seguido do nome para mencionar um usuário ou uma Equipe.
 */
export function MentionTextarea({ value, onChange, onSubmit, users, teams, placeholder, className }: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const teamItems: Suggestion[] = teams
      .filter((t) => t.name.toLowerCase().includes(q))
      .map((t) => ({ id: t.id, name: t.name, kind: 'team', color: t.color }));
    const userItems: Suggestion[] = users
      .filter((u) => u.name.toLowerCase().includes(q))
      .map((u) => ({ id: u.id, name: u.name, kind: 'user', avatar: u.avatar }));
    return [...teamItems, ...userItems].slice(0, 8);
  }, [mentionQuery, users, teams]);

  const detectMention = (text: string, caret: number) => {
    const upToCaret = text.slice(0, caret);
    const atIndex = upToCaret.lastIndexOf('@');
    // o "@" precisa estar no início ou após espaço/quebra, e a consulta não pode conter quebra de linha
    if (atIndex >= 0 && (atIndex === 0 || /[\s(]/.test(upToCaret[atIndex - 1]))) {
      const query = upToCaret.slice(atIndex + 1);
      if (!query.includes('\n') && query.length <= 40) {
        setMentionQuery(query);
        setMentionStart(atIndex);
        setHighlightIndex(0);
        return;
      }
    }
    setMentionQuery(null);
  };

  const insertMention = (s: Suggestion) => {
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, mentionStart)}@${s.name} ${value.slice(caret)}`;
    onChange(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = mentionStart + s.name.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[highlightIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative">
      {mentionQuery !== null && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-72 max-h-64 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-[120] animate-in fade-in zoom-in-95 duration-100">
          <p className="px-3 py-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mencionar</p>
          {suggestions.map((s, i) => (
            <button
              key={`${s.kind}-${s.id}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(s); }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left ${i === highlightIndex ? 'bg-orange-50' : ''}`}
            >
              {s.kind === 'team' ? (
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: s.color || '#8b5cf6' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </span>
              ) : (
                <img src={s.avatar || `https://picsum.photos/seed/${s.id}/100`} className="w-6 h-6 rounded-full shrink-0" alt="" />
              )}
              <span className="text-gray-700 truncate">{s.name}</span>
              {s.kind === 'team' && <span className="ml-auto text-[10px] font-bold text-purple-500 uppercase shrink-0">Equipe</span>}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
        className={className}
        onKeyDown={handleKeyDown}
      ></textarea>
    </div>
  );
}
