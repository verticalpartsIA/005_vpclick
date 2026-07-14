/**
 * VP Click — Edge Function: ask-ai (v3 — modo Raio-X + Ação)
 * IA da tarefa e do workspace (Anthropic Claude) com a chave protegida no backend.
 *
 * v2: a IA tem ferramentas para consultar o banco em tempo real —
 * usuários, tarefas (por responsável/situação/texto) e estatísticas.
 * v3: a IA também pode EXECUTAR ações — mudar status/prioridade/
 * responsável, comentar, prorrogar prazo e criar tarefas/subtarefas.
 * Permissões espelham o app: ADMIN/GESTOR enxergam e alteram tudo;
 * COLABORADOR só enxerga/altera as próprias tarefas.
 *
 * Deploy:
 *   supabase functions deploy ask-ai --project-ref sfpnjwllcmentoocylow
 * Secrets: ANTHROPIC_API_KEY
 */

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Heurísticas compartilhadas com o app ──────────────────────
const DONE_KEYWORDS = ['conclu', 'done', 'closed', 'complete', 'finaliz', 'pronto', 'aprovado', 'fechado', 'realizada', 'entregue'];
const CANCEL_KEYWORDS = ['cancel', 'recusad'];
const NOT_STARTED_KEYWORDS = ['a fazer', 'aberto', 'novo', 'rascunho', 'planejada', 'pendente', 'backlog', 'to do', 'todo'];

const isDone = (status: string) => DONE_KEYWORDS.some((k) => (status || '').toLowerCase().includes(k));
const isCancelled = (status: string) => CANCEL_KEYWORDS.some((k) => (status || '').toLowerCase().includes(k));
const isNotStarted = (status: string) => NOT_STARTED_KEYWORDS.some((k) => (status || '').toLowerCase().includes(k));
const isLate = (t: { due_date: string | null; status: string }) =>
  !!t.due_date && !isDone(t.status) && !isCancelled(t.status) && new Date(t.due_date) < new Date();

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'listar_usuarios',
    description: 'Lista os usuários ativos do VP Click (id, nome, papel). Use para descobrir o nome completo/id de alguém citado na pergunta (ex: "José") antes de buscar tarefas.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'buscar_tarefas',
    description:
      'Busca tarefas do workspace. Use sempre que a pergunta envolver tarefas, prazos, andamento ou pessoas. Retorna título, status, situação (concluída/atrasada/não iniciada), prioridade, responsável, acompanhantes, datas, prorrogações e lista. Chame quantas vezes precisar com filtros diferentes.',
    input_schema: {
      type: 'object',
      properties: {
        responsavel: { type: 'string', description: 'Nome (ou parte do nome) do responsável. Omita para todas as pessoas.' },
        situacao: {
          type: 'string',
          enum: ['todas', 'abertas', 'concluidas', 'atrasadas', 'prorrogadas', 'nao_iniciadas'],
          description: 'Filtro de situação. Padrão: todas.',
        },
        texto: { type: 'string', description: 'Busca por trecho do título da tarefa.' },
        limite: { type: 'integer', description: 'Máximo de tarefas retornadas (padrão 30, máx 60).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'estatisticas_tarefas',
    description:
      'Retorna contagens agregadas das tarefas (total, abertas, concluídas, atrasadas, prorrogadas, não iniciadas), no geral ou de uma pessoa. Use para perguntas de visão geral/desempenho.',
    input_schema: {
      type: 'object',
      properties: {
        responsavel: { type: 'string', description: 'Nome (ou parte) do responsável. Omita para o workspace inteiro.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'listar_listas',
    description: 'Lista as listas/projetos do workspace (id, nome e pasta). Use para descobrir em qual lista criar uma tarefa nova.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'atualizar_tarefa',
    description:
      'Executa mudanças reais numa tarefa existente: status, prioridade, responsável principal, comentário e/ou prorrogação de prazo. ' +
      'Descubra o id certo com buscar_tarefas ANTES de chamar esta ferramenta — nunca invente um id. ' +
      'Preencha só os campos que devem mudar.',
    input_schema: {
      type: 'object',
      properties: {
        tarefa_id: { type: 'string', description: 'id (uuid) da tarefa, obtido via buscar_tarefas.' },
        novo_status: { type: 'string', description: 'Novo status, usando exatamente o texto de algum status já visto em buscar_tarefas/estatisticas_tarefas para essa tarefa/lista.' },
        nova_prioridade: { type: 'string', enum: ['Baixa', 'Media', 'Alta', 'Urgente'] },
        novo_responsavel: { type: 'string', description: 'Nome (ou parte) do novo responsável principal.' },
        comentario: { type: 'string', description: 'Texto a adicionar como comentário na tarefa.' },
        nova_data_limite: { type: 'string', description: 'Nova data de entrega, formato YYYY-MM-DD. Isso conta como uma prorrogação.' },
        motivo_prorrogacao: { type: 'string', description: 'Obrigatório junto com nova_data_limite — motivo da mudança de prazo. Se o usuário não deu um motivo, pergunte antes de chamar a ferramenta.' },
      },
      required: ['tarefa_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'criar_tarefa',
    description: 'Cria uma tarefa (ou subtarefa) nova. Use listar_listas e/ou listar_usuarios antes se precisar confirmar a lista ou o responsável.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        lista_id: { type: 'string', description: 'id (uuid) da lista onde a tarefa deve entrar, obtido via listar_listas.' },
        responsavel: { type: 'string', description: 'Nome (ou parte) do responsável principal. Opcional.' },
        prazo: { type: 'string', description: 'Data de entrega, formato YYYY-MM-DD. Opcional.' },
        prioridade: { type: 'string', enum: ['Baixa', 'Media', 'Alta', 'Urgente'] },
        tarefa_pai_id: { type: 'string', description: 'Se for subtarefa, id (uuid) da tarefa pai.' },
      },
      required: ['titulo', 'lista_id'],
      additionalProperties: false,
    },
  },
];

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

    const { context, question, history } = await req.json();
    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'Pergunta vazia' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Perfil e permissões ───────────────────────────────────
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profile } = await admin.from('profiles').select('name, role').eq('id', user.id).single();
    const userName: string = profile?.name || 'Usuário';
    const userRole: string = profile?.role || 'COLABORADOR';
    const isPrivileged = userRole === 'ADMIN' || userRole === 'GESTOR';

    // Cache de perfis para resolver nomes
    const { data: allProfiles } = await admin
      .from('profiles').select('id, name, role, email').eq('is_active', true);
    const profiles = (allProfiles || []).filter((p: any) => p.name && !String(p.email || '').includes('@vpclick.test'));
    const nameOf = (id: string | null) => profiles.find((p: any) => p.id === id)?.name || null;

    const { data: allLists } = await admin.from('lists').select('id, name');
    const listNameOf = (id: string | null) => (allLists || []).find((l: any) => l.id === id)?.name || null;

    // ── Implementação das ferramentas ─────────────────────────
    const fetchTasks = async (responsavel?: string) => {
      let ids: string[] | null = null;
      if (!isPrivileged) {
        ids = [user.id]; // COLABORADOR: só as próprias tarefas
      } else if (responsavel) {
        const matches = profiles.filter((p: any) =>
          p.name.toLowerCase().includes(responsavel.toLowerCase()));
        if (matches.length === 0) return { erro: `Nenhum usuário encontrado com nome parecido com "${responsavel}".` };
        ids = matches.map((p: any) => p.id);
      }
      // Pagina de 1000 em 1000 (até 5000) para estatísticas corretas
      const all: any[] = [];
      for (let page = 0; page < 5; page++) {
        let q = admin.from('tasks')
          .select('id, title, status, priority, start_date, due_date, extension_count, created_at, main_assignee_id, secondary_assignee_ids, parent_id, list_id')
          .order('due_date', { ascending: true, nullsFirst: false })
          .range(page * 1000, page * 1000 + 999);
        if (ids) {
          const parts = ids.flatMap((id) => [`main_assignee_id.eq.${id}`, `secondary_assignee_ids.cs.{${id}}`]);
          q = q.or(parts.join(','));
        }
        const { data, error } = await q;
        if (error) return { erro: error.message };
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return { tarefas: all };
    };

    const mapTask = (t: any) => ({
      id: t.id,
      titulo: t.title,
      status: t.status,
      situacao: isDone(t.status) ? 'concluída' : isCancelled(t.status) ? 'cancelada'
        : isLate(t) ? 'ATRASADA' : isNotStarted(t.status) ? 'não iniciada' : 'em andamento',
      prioridade: t.priority,
      responsavel: nameOf(t.main_assignee_id) || 'Sem responsável',
      acompanhantes: (t.secondary_assignee_ids || []).map(nameOf).filter(Boolean),
      inicio: t.start_date?.slice(0, 10) || null,
      prazo: t.due_date?.slice(0, 10) || null,
      prorrogacoes: t.extension_count || 0,
      lista: listNameOf(t.list_id),
      e_subtarefa: !!t.parent_id,
      criada_em: t.created_at?.slice(0, 10),
    });

    const runTool = async (name: string, input: any): Promise<unknown> => {
      if (name === 'listar_usuarios') {
        if (!isPrivileged) return { aviso: 'Você só tem visão das suas próprias tarefas.', usuarios: profiles.map((p: any) => ({ nome: p.name, papel: p.role })) };
        return { usuarios: profiles.map((p: any) => ({ nome: p.name, papel: p.role })) };
      }
      if (name === 'buscar_tarefas' || name === 'estatisticas_tarefas') {
        const res = await fetchTasks(input?.responsavel);
        if ('erro' in res) return res;
        let rows = (res.tarefas as any[]).map(mapTask);
        if (input?.texto) rows = rows.filter((r) => r.titulo.toLowerCase().includes(String(input.texto).toLowerCase()));

        if (name === 'estatisticas_tarefas') {
          return {
            escopo: input?.responsavel || (isPrivileged ? 'workspace inteiro' : userName),
            total: rows.length,
            concluidas: rows.filter((r) => r.situacao === 'concluída').length,
            atrasadas: rows.filter((r) => r.situacao === 'ATRASADA').length,
            em_andamento: rows.filter((r) => r.situacao === 'em andamento').length,
            nao_iniciadas: rows.filter((r) => r.situacao === 'não iniciada').length,
            canceladas: rows.filter((r) => r.situacao === 'cancelada').length,
            prorrogadas: rows.filter((r) => r.prorrogacoes > 0).length,
          };
        }

        const sit = input?.situacao || 'todas';
        if (sit === 'abertas') rows = rows.filter((r) => r.situacao === 'em andamento' || r.situacao === 'não iniciada' || r.situacao === 'ATRASADA');
        else if (sit === 'concluidas') rows = rows.filter((r) => r.situacao === 'concluída');
        else if (sit === 'atrasadas') rows = rows.filter((r) => r.situacao === 'ATRASADA');
        else if (sit === 'prorrogadas') rows = rows.filter((r) => r.prorrogacoes > 0);
        else if (sit === 'nao_iniciadas') rows = rows.filter((r) => r.situacao === 'não iniciada');

        const limite = Math.min(Math.max(Number(input?.limite) || 30, 1), 60);
        return { total_encontrado: rows.length, exibindo: Math.min(rows.length, limite), tarefas: rows.slice(0, limite) };
      }

      if (name === 'listar_listas') {
        const { data: listsData } = await admin.from('lists').select('id, name, folder_id');
        const { data: foldersData } = await admin.from('folders').select('id, name');
        const folderNameOf = (id: string | null) => (foldersData || []).find((f: any) => f.id === id)?.name || null;
        return {
          listas: (listsData || []).map((l: any) => ({ id: l.id, nome: l.name, pasta: folderNameOf(l.folder_id) })),
        };
      }

      const resolveResponsavel = (nome: string): { id: string; name: string } | { erro: string } => {
        const matches = profiles.filter((p: any) => p.name.toLowerCase().includes(nome.toLowerCase()));
        if (matches.length === 0) return { erro: `Nenhum usuário encontrado com nome parecido com "${nome}".` };
        if (matches.length > 1) return { erro: `Mais de um usuário corresponde a "${nome}": ${matches.map((m: any) => m.name).join(', ')}. Peça pra especificar.` };
        return { id: matches[0].id, name: matches[0].name };
      };

      const normalizePriority = (p: string): string | null => {
        const n = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (n === 'baixa') return 'Baixa';
        if (n === 'media') return 'Média';
        if (n === 'alta') return 'Alta';
        if (n === 'urgente') return 'Urgente';
        return null;
      };

      if (name === 'atualizar_tarefa') {
        const tarefaId = input?.tarefa_id;
        if (!tarefaId) return { erro: 'tarefa_id é obrigatório.' };
        const { data: task, error: taskError } = await admin.from('tasks').select('*').eq('id', tarefaId).single();
        if (taskError || !task) return { erro: 'Tarefa não encontrada. Confira o id com buscar_tarefas.' };

        const podeEditar = isPrivileged || task.main_assignee_id === user.id || (task.secondary_assignee_ids || []).includes(user.id);
        if (!podeEditar) return { erro: 'Você só pode alterar tarefas em que é responsável (principal ou acompanhante).' };

        const mudancas: string[] = [];

        if (input?.novo_status && input.novo_status !== task.status) {
          await admin.from('tasks').update({ status: input.novo_status }).eq('id', tarefaId);
          await admin.from('task_activities').insert({ task_id: tarefaId, user_id: user.id, type: 'STATUS_CHANGE', old_value: task.status, new_value: input.novo_status });
          mudancas.push(`status: "${task.status}" → "${input.novo_status}"`);
        }

        if (input?.nova_prioridade) {
          const p = normalizePriority(input.nova_prioridade);
          if (!p) return { erro: `Prioridade inválida: "${input.nova_prioridade}". Use Baixa, Média, Alta ou Urgente.` };
          if (p !== task.priority) {
            await admin.from('tasks').update({ priority: p }).eq('id', tarefaId);
            await admin.from('task_activities').insert({ task_id: tarefaId, user_id: user.id, type: 'PRIORITY_CHANGE', old_value: task.priority, new_value: p });
            mudancas.push(`prioridade: "${task.priority}" → "${p}"`);
          }
        }

        if (input?.novo_responsavel) {
          const r = resolveResponsavel(input.novo_responsavel);
          if ('erro' in r) return r;
          if (r.id !== task.main_assignee_id) {
            await admin.from('tasks').update({ main_assignee_id: r.id }).eq('id', tarefaId);
            await admin.from('task_activities').insert({ task_id: tarefaId, user_id: user.id, type: 'MAIN_RESPONSIBLE_CHANGE', old_value: nameOf(task.main_assignee_id), new_value: r.name });
            mudancas.push(`responsável: "${nameOf(task.main_assignee_id) || 'sem responsável'}" → "${r.name}"`);
          }
        }

        if (input?.comentario) {
          await admin.from('task_comments').insert({ task_id: tarefaId, user_id: user.id, text: input.comentario });
          mudancas.push('comentário adicionado');
        }

        if (input?.nova_data_limite) {
          if (!input?.motivo_prorrogacao) return { erro: 'Pra prorrogar o prazo é preciso um motivo (motivo_prorrogacao). Pergunte ao usuário qual é o motivo antes de tentar de novo.' };
          await admin.from('tasks').update({ due_date: input.nova_data_limite, extension_count: (task.extension_count || 0) + 1 }).eq('id', tarefaId);
          await admin.from('task_extension_logs').insert({ task_id: tarefaId, old_date: task.due_date, new_date: input.nova_data_limite, reason: input.motivo_prorrogacao, updated_by: user.id });
          mudancas.push(`prazo: "${task.due_date?.slice(0, 10) || 'sem prazo'}" → "${input.nova_data_limite}" (motivo: ${input.motivo_prorrogacao})`);
        }

        if (mudancas.length === 0) return { aviso: 'Nenhum campo válido foi enviado, nada foi alterado.' };
        return { ok: true, tarefa: task.title, mudancas };
      }

      if (name === 'criar_tarefa') {
        if (!input?.titulo || !input?.lista_id) return { erro: 'titulo e lista_id são obrigatórios.' };
        let mainAssigneeId: string | null = null;
        if (input?.responsavel) {
          const r = resolveResponsavel(input.responsavel);
          if ('erro' in r) return r;
          mainAssigneeId = r.id;
        }
        let priority: string | null = null;
        if (input?.prioridade) {
          priority = normalizePriority(input.prioridade);
          if (!priority) return { erro: `Prioridade inválida: "${input.prioridade}".` };
        }
        const { data: created, error: createError } = await admin
          .from('tasks')
          .insert({
            title: input.titulo,
            list_id: input.lista_id,
            main_assignee_id: mainAssigneeId,
            due_date: input?.prazo || null,
            priority: priority || undefined,
            parent_id: input?.tarefa_pai_id || null,
            created_by: user.id,
          })
          .select('id, title')
          .single();
        if (createError || !created) return { erro: `Falha ao criar tarefa: ${createError?.message || 'erro desconhecido'}` };
        return { ok: true, tarefa_id: created.id, titulo: created.title };
      }

      return { erro: `Ferramenta desconhecida: ${name}` };
    };

    // ── Prompt ────────────────────────────────────────────────
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
    const system = `Você é o assistente de IA do VP Click, a ferramenta de gestão de tarefas da VerticalParts.

Quem está falando com você: ${userName} (papel: ${userRole}). Chame a pessoa pelo primeiro nome, em tom cordial e direto.
Hoje é ${hoje}.

Você tem MODO RAIO-X: ferramentas para consultar usuários, tarefas, listas e estatísticas do sistema em tempo real.
- Use as ferramentas sempre que a pergunta envolver tarefas, pessoas, prazos, andamento ou números — não responda de memória.
- Se um nome citado for ambíguo ou não existir, use listar_usuarios para conferir e diga as opções.
- ${isPrivileged ? 'Este usuário é ' + userRole + ' e enxerga/altera as tarefas de TODOS.' : 'Este usuário é COLABORADOR: só enxerga as PRÓPRIAS tarefas (como responsável principal ou acompanhante) e só pode alterar essas mesmas tarefas — se pedir dados ou mudança em tarefa de outra pessoa, explique educadamente a limitação.'}
- "Já iniciou?": tarefa com situação "não iniciada" = ainda não começou; "em andamento"/"concluída" = já começou.
- Datas no formato brasileiro (dd/mm/aaaa). Destaque atrasos e prorrogações.
- Responda em português do Brasil, conciso e organizado (use listas quando ajudar). Não invente dados.
- Quando sugerir subtarefas ou checklists (sem pedido explícito de criar de verdade), devolva uma lista com um item por linha começando com "- ".

Você também tem MODO AÇÃO: ferramentas para EXECUTAR mudanças reais — atualizar_tarefa (status, prioridade, responsável, comentário, prorrogação de prazo) e criar_tarefa.
- Sempre encontre o id certo da tarefa (buscar_tarefas) e, se precisar, da lista (listar_listas) ou do responsável (listar_usuarios) ANTES de chamar a ferramenta de ação. Nunca invente um id.
- Quando o pedido for claro e específico o bastante para identificar a tarefa (e a lista, no caso de criação), EXECUTE a ação diretamente — não peça confirmação antes. Depois de executar, explique em 1-2 frases o que foi feito.
- Só pergunte antes de agir quando o pedido for genuinamente ambíguo: mais de uma tarefa parecida encontrada, nome de responsável não encontrado/ambíguo, prorrogação de prazo sem motivo informado, ou criação de tarefa sem saber em qual lista.
- Se uma ferramenta de ação retornar erro, explique o problema ao usuário em vez de tentar de novo às cegas.`;

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
        ? `<contexto_da_tarefa_aberta>\n${String(context).slice(0, 30000)}\n</contexto_da_tarefa_aberta>\n\n${question}`
        : question,
    });

    // ── Loop agêntico (até 6 rodadas de ferramentas) ──────────
    let response = await anthropic.messages.create({
      model: 'claude-opus-4-8', max_tokens: 4096,
      thinking: { type: 'adaptive' }, output_config: { effort: 'medium' },
      system, tools: TOOLS, messages,
    });

    for (let i = 0; i < 6 && response.stop_reason === 'tool_use'; i++) {
      messages.push({ role: 'assistant', content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          let out: unknown;
          try { out = await runTool(block.name, block.input); }
          catch (e) { out = { erro: String(e) }; }
          results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) });
        }
      }
      messages.push({ role: 'user', content: results });
      response = await anthropic.messages.create({
        model: 'claude-opus-4-8', max_tokens: 4096,
        thinking: { type: 'adaptive' }, output_config: { effort: 'medium' },
        system, tools: TOOLS, messages,
      });
    }

    const answer = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n');

    return new Response(JSON.stringify({ answer: answer || 'Não consegui montar uma resposta. Tente reformular a pergunta.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ask-ai] erro:', err);
    return new Response(JSON.stringify({ error: 'Falha ao consultar a IA. Tente novamente.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
