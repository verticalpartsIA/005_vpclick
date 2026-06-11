import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIPanelProps {
  /** Contexto textual da tarefa aberta (omitir no modo global/workspace) */
  context?: string;
  onClose: () => void;
}

const TASK_ACTIONS: { label: string; prompt: string }[] = [
  { label: '📋 Resumir tarefa', prompt: 'Resuma a situação atual desta tarefa em até 5 linhas, destacando prazo, responsável e pendências.' },
  { label: '💬 Resumir comentários', prompt: 'Resuma a discussão dos comentários desta tarefa: decisões tomadas, pendências e quem está com a bola.' },
  { label: '✅ Sugerir subtarefas', prompt: 'Sugira de 3 a 7 subtarefas práticas para concluir esta tarefa, uma por linha começando com "- ".' },
  { label: '✍️ Melhorar descrição', prompt: 'Reescreva a descrição desta tarefa de forma clara e completa, pronta para colar no campo de descrição.' },
];

const WORKSPACE_ACTIONS: { label: string; prompt: string }[] = [
  { label: '🩻 Visão geral (Raio-X)', prompt: 'Me dê uma visão geral do andamento das tarefas: totais, concluídas, em andamento, atrasadas e prorrogadas. Destaque o que merece atenção.' },
  { label: '⏰ Tarefas atrasadas', prompt: 'Quais tarefas estão atrasadas, de quem são e há quanto tempo venceram? Ordene da mais crítica para a menos crítica.' },
  { label: '🔁 Prorrogadas', prompt: 'Quais tarefas já foram prorrogadas e quantas vezes? Quem são os responsáveis?' },
  { label: '👤 Desempenho por pessoa', prompt: 'Monte um resumo de desempenho por pessoa: quantas tarefas cada um tem, quantas concluiu e quantas estão atrasadas.' },
];

export function AIPanel({ context, onClose }: AIPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: q }]);

    const { data, error } = await supabase.functions.invoke('ask-ai', {
      body: { context, question: q, history: messages },
    });

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: error || data?.error
          ? '⚠️ Não consegui consultar a IA agora. Verifique se a função "ask-ai" está publicada e tente novamente.'
          : (data.answer as string),
      },
    ]);
    setLoading(false);
  };

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div onClick={(e) => e.stopPropagation()} className="absolute inset-y-0 right-0 w-[420px] max-w-full bg-white border-l shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-200">
      <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-purple-50 to-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h3 className="text-sm font-bold text-purple-700">IA do VP Click</h3>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-purple-100 text-gray-400 hover:text-purple-600 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium">
              {context
                ? 'A IA conhece o contexto desta tarefa e pode consultar todas as tarefas do sistema (modo Raio-X). Comece com uma ação rápida ou pergunte algo:'
                : 'Modo Raio-X: a IA consulta as tarefas do sistema em tempo real. Pergunte coisas como "O José já iniciou a tarefa X?" ou use uma ação rápida:'}
            </p>
            {(context ? TASK_ACTIONS : WORKSPACE_ACTIONS).map((a) => (
              <button
                key={a.label}
                onClick={() => ask(a.prompt)}
                className="w-full text-left px-4 py-3 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] px-4 py-2.5 bg-purple-600 text-white text-sm rounded-2xl rounded-br-sm whitespace-pre-wrap'
                  : 'max-w-[95%] px-4 py-3 bg-gray-50 border border-gray-100 text-gray-800 text-sm rounded-2xl rounded-bl-sm whitespace-pre-wrap group relative'
              }
            >
              {m.content}
              {m.role === 'assistant' && (
                <button
                  onClick={() => copy(m.content)}
                  title="Copiar resposta"
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-white border shadow-sm rounded-lg px-2 py-0.5 text-[10px] font-bold text-gray-500 hover:text-purple-600 transition-all"
                >
                  Copiar
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-purple-500 text-sm font-medium">
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:120ms]" />
            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:240ms]" />
            <span className="ml-1">Pensando...</span>
          </div>
        )}
      </div>

      <div className="p-4 border-t shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={2}
            placeholder={context ? 'Pergunte algo sobre esta tarefa...' : 'Ex: O Marcus já iniciou a proposta da ACME?'}
            className="flex-1 px-3 py-2 text-sm border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
