/**
 * VP Click — Edge Function: summarize-meeting
 * Gera o resumo e os itens de ação de uma reunião (tabela `meetings`) a
 * partir das notas/transcrição coladas manualmente pelo usuário — mesmo
 * modelo (Claude, Anthropic) e mesmo padrão de auth do ask-ai, mas sem loop
 * agêntico: uma única chamada forçando o uso de uma tool pra sair com saída
 * estruturada (resumo + lista de itens de ação) em vez de texto livre.
 *
 * Deploy:
 *   supabase functions deploy summarize-meeting --project-ref sfpnjwllcmentoocylow
 * Secrets: ANTHROPIC_API_KEY (já configurado, compartilhado com ask-ai)
 */

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUMMARY_TOOL: Anthropic.Tool = {
  name: 'entregar_resumo',
  description: 'Entrega o resumo estruturado da reunião.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: {
        type: 'string',
        description: 'Resumo em markdown, português do Brasil: um parágrafo de visão geral seguido das principais decisões em bullets ("- ").',
      },
      itens_de_acao: {
        type: 'array',
        items: { type: 'string' },
        description: 'Itens de ação/tarefas combinadas na reunião, cada um uma frase curta e acionável (ex: "Enviar proposta atualizada pro cliente até sexta"). Lista vazia se não houver nenhum.',
      },
    },
    required: ['resumo', 'itens_de_acao'],
    additionalProperties: false,
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── Autenticação ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { meetingId } = await req.json();
    if (!meetingId || typeof meetingId !== 'string') {
      return new Response(JSON.stringify({ error: 'meetingId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: meeting, error: meetingError } = await admin
      .from('meetings')
      .select('id, title, notes')
      .eq('id', meetingId)
      .single();
    if (meetingError || !meeting) {
      return new Response(JSON.stringify({ error: 'Reunião não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!meeting.notes || !meeting.notes.trim()) {
      return new Response(JSON.stringify({ error: 'Cole as notas/transcrição da reunião antes de gerar o resumo.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
    const system = `Você resume reuniões de trabalho da VerticalParts pro VP Click. Leia as notas/transcrição colada e chame a ferramenta entregar_resumo com: um resumo em markdown (visão geral + principais decisões em bullets) e a lista de itens de ação combinados — cada um curto, acionável e sem numeração/prefixo. Se as notas não deixarem claro nenhum item de ação, devolva a lista vazia em vez de inventar um.`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8', max_tokens: 4096,
      thinking: { type: 'adaptive' }, output_config: { effort: 'medium' },
      system,
      tools: [SUMMARY_TOOL],
      tool_choice: { type: 'tool', name: 'entregar_resumo' },
      messages: [{
        role: 'user',
        content: `Título da reunião: ${meeting.title}\n\n<notas>\n${String(meeting.notes).slice(0, 60000)}\n</notas>`,
      }],
    });

    const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolBlock) {
      return new Response(JSON.stringify({ error: 'A IA não conseguiu gerar o resumo. Tente novamente.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const input = toolBlock.input as { resumo: string; itens_de_acao: string[] };
    const summary = input.resumo || '';
    const actionItems = (input.itens_de_acao || []).map((t) => t.trim()).filter(Boolean);

    const { error: updateError } = await admin
      .from('meetings')
      .update({ summary, updated_at: new Date().toISOString() })
      .eq('id', meetingId);
    if (updateError) throw updateError;

    // Regenerar troca só os itens que ainda não viraram tarefa de verdade —
    // um item já convertido (task_id preenchido) fica de fora da limpeza,
    // senão perderia o vínculo com a tarefa criada.
    await admin.from('meeting_action_items').delete().eq('meeting_id', meetingId).is('task_id', null);
    if (actionItems.length > 0) {
      await admin.from('meeting_action_items').insert(
        actionItems.map((text) => ({ meeting_id: meetingId, text }))
      );
    }

    const { data: items } = await admin
      .from('meeting_action_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });

    return new Response(JSON.stringify({ summary, actionItems: items || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[summarize-meeting] erro:', err);
    return new Response(JSON.stringify({ error: 'Falha ao gerar o resumo. Tente novamente.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
