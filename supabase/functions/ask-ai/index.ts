/**
 * VP Click — Edge Function: ask-ai
 * IA da tarefa (Anthropic Claude) com a chave protegida no backend.
 *
 * Deploy:
 *   supabase functions deploy ask-ai --project-ref sfpnjwllcmentoocylow
 *
 * Secrets necessários (supabase secrets set --project-ref sfpnjwllcmentoocylow):
 *   ANTHROPIC_API_KEY=sk-ant-...
 *
 * A chave NUNCA vai para o frontend: o app chama esta função com o JWT do
 * usuário logado (supabase.functions.invoke), a função valida a sessão e
 * só então repassa a pergunta para a API da Anthropic.
 */

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `Você é o assistente de IA do VP Click, a ferramenta de gestão de tarefas da VerticalParts.
Responda sempre em português do Brasil, de forma direta e útil para o contexto de trabalho.
Você recebe o contexto de uma tarefa (título, descrição, status, prazo, responsáveis, subtarefas, comentários) e ajuda o usuário a:
resumir a situação, redigir/melhorar descrições, sugerir subtarefas ou itens de ação, resumir discussões dos comentários e responder perguntas sobre a tarefa.
Quando sugerir subtarefas ou checklists, devolva uma lista com um item por linha começando com "- ".
Não invente fatos que não estejam no contexto; se faltar informação, diga o que falta.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Autenticação: só usuários logados no VP Click podem usar a IA ──
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { context, question, history } = await req.json();
    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'Pergunta vazia' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    const messages: Anthropic.MessageParam[] = [];
    if (Array.isArray(history)) {
      for (const m of history.slice(-10)) {
        if ((m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()) {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    messages.push({
      role: 'user',
      content: context
        ? `<contexto_da_tarefa>\n${String(context).slice(0, 30000)}\n</contexto_da_tarefa>\n\n${question}`
        : question,
    });

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      messages,
    });

    const answer = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n');

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ask-ai] erro:', err);
    return new Response(JSON.stringify({ error: 'Falha ao consultar a IA. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
