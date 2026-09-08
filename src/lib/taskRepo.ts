// taskRepo — porta de LEITURA de tarefas (Ports & Adapters).
//
// Concentra todo o acesso ao Supabase para *ler* tarefas: paginação (teto de
// ~1000 linhas do PostgREST), hidratação de sub-entidades em lotes, busca
// server-side, índice de contagem e carga sob demanda do detalhe. O App
// consome uma interface pequena e não conhece nomes de coluna nem o formato
// das linhas — esse conhecimento vive aqui. RLS continua sendo o portão de
// visibilidade no servidor.
//
// Sem React: são funções puras de acesso a dados, testáveis por si só (troque
// `supabase` por um fake no teste). Cobre leitura, escrita (nível-tarefa e
// sub-entidades), duplicação, dashboard e ações em massa. A orquestração e as
// regras de negócio continuam no App (viram um TaskService na Fase 2).
import { supabase } from './supabase';
import { CustomFieldValue, FormDef, FormMapsTo, FormQuestion, FormQuestionType, FormSubmission, Goal, GoalTarget, GoalTargetType, MindMapAccess, MindMapDef, Portfolio, Task, TaskPriority, TaskRecurrenceRule, TimeEntry, TimeTrackingBucket, UserCapacity, UserTimeOff, WhiteboardAccess, WhiteboardDef, WorkloadBucket } from '../types';

const PAGE_SIZE = 1000;
export const INITIAL_TASK_PAGE_SIZE = 100;
// Um único .in('task_id', [milhares de UUIDs]) gera uma URL de dezenas de
// milhares de caracteres e o servidor responde 400. Quebramos em lotes de 150
// IDs (URL segura) e concatenamos os resultados.
const SUBENTITY_CHUNK = 150;
const TASK_ROW_SELECT = [
  'id',
  'title',
  'description',
  'status',
  'priority',
  'main_assignee_id',
  'secondary_assignee_ids',
  'start_date',
  'due_date',
  'extension_count',
  'list_id',
  'project_id',
  'parent_id',
  'created_at',
  'created_by',
  'tags',
  'is_milestone',
  'recurrence_rule_id',
  'recurrence_parent_task_id',
  'recurrence_sequence',
  'scheduled_occurrence_at',
  'archived_at',
  'archived_by',
  'deleted_at',
  'deleted_by',
  'purge_after',
  'deletion_reason_code',
  'deletion_reason_text',
  'estimated_hours',
].join(',');

// ── Formato cru das linhas do banco (snake_case) ────────────────────────────
export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  main_assignee_id: string;
  secondary_assignee_ids: string[] | null;
  start_date: string | null;
  due_date: string | null;
  extension_count: number | null;
  list_id: string | null;
  project_id: string | null;
  parent_id: string | null;
  created_at: string;
  created_by: string | null;
  tags: string[] | null;
  is_milestone: boolean | null;
  recurrence_rule_id: string | null;
  recurrence_parent_task_id: string | null;
  recurrence_sequence: number | null;
  scheduled_occurrence_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  purge_after: string | null;
  deletion_reason_code: string | null;
  deletion_reason_text: string | null;
  estimated_hours: number | string | null;
}
interface AttachmentRow { id: string; task_id: string; name: string; url: string; type: string; size: number; uploaded_at: string; }
interface CommentRow {
  id: string; task_id: string; user_id: string; text: string; created_at: string; updated_at: string | null;
  parent_comment_id: string | null; assigned_to: string | null; assigned_by: string | null;
  resolved_at: string | null; resolved_by: string | null;
}
interface ExtensionLogRow { id: string; task_id: string; old_date: string | null; new_date: string | null; reason: string | null; updated_by: string | null; created_at: string; }
interface ChecklistRow { id: string; task_id: string; text: string; completed: boolean; }
interface ActivityRow { id: string; task_id: string; user_id: string; type: string; old_value: string | null; new_value: string | null; created_at: string; }
interface WatcherRow { task_id: string; user_id: string; }
interface CountRow { id: string; list_id: string | null; status: string }
export interface TaskCountSummary { listId: string | null; status: string; count: number }
interface TaskCountSummaryRow { list_id: string | null; status: string; total_count: number | string }
export interface DashboardSummaryRow {
  listId: string | null;
  mainAssigneeId: string | null;
  status: string;
  priority: string;
  healthKey: string;
  isExtended: boolean;
  count: number;
}
interface DashboardSummaryDbRow {
  list_id: string | null;
  main_assignee_id: string | null;
  status: string;
  priority: string;
  health_key: string;
  is_extended: boolean;
  count: number | string;
}
interface CustomFieldValueRow { field_id: string; entity_id: string; value: unknown }

// Resposta genérica do PostgREST usada nas assinaturas dos builders paginados.
type PostgrestResult<T> = { data: T[] | null; error: unknown };

// ── Mapeadores DB (snake_case) → domínio (camelCase) ────────────────────────
const mapAttachment = (a: AttachmentRow) => ({
  id: a.id, name: a.name, url: a.url, type: a.type, size: a.size, uploadedAt: a.uploaded_at,
});
const mapComment = (c: CommentRow) => ({
  id: c.id, userId: c.user_id, text: c.text, timestamp: c.created_at, updatedAt: c.updated_at || undefined,
  parentCommentId: c.parent_comment_id || undefined,
  assignedTo: c.assigned_to || undefined,
  assignedBy: c.assigned_by || undefined,
  resolvedAt: c.resolved_at || undefined,
  resolvedBy: c.resolved_by || undefined,
});
const mapLog = (l: ExtensionLogRow) => ({
  id: l.id, oldDate: l.old_date, newDate: l.new_date, reason: l.reason, updatedBy: l.updated_by, timestamp: l.created_at,
});
const mapChecklist = (ck: ChecklistRow) => ({ id: ck.id, text: ck.text, completed: ck.completed });
const mapActivity = (act: ActivityRow) => ({
  id: act.id, taskId: act.task_id, userId: act.user_id, type: act.type,
  oldValue: act.old_value, newValue: act.new_value, createdAt: act.created_at,
});

// Campos de nível-tarefa (sem sub-entidades).
const mapTaskCore = (d: TaskRow) => ({
  id: d.id,
  title: d.title,
  description: d.description || '',
  status: d.status,
  priority: d.priority as TaskPriority,
  mainAssigneeId: d.main_assignee_id,
  secondaryAssigneeIds: d.secondary_assignee_ids || [],
  startDate: d.start_date,
  dueDate: d.due_date,
  extensionCount: d.extension_count || 0,
  listId: d.list_id,
  projectId: d.project_id,
  parentId: d.parent_id,
  createdAt: d.created_at,
  createdBy: d.created_by || undefined,
  tags: d.tags || [],
  isMilestone: d.is_milestone ?? false,
  recurrenceRuleId: d.recurrence_rule_id || undefined,
  recurrenceParentTaskId: d.recurrence_parent_task_id || undefined,
  recurrenceSequence: d.recurrence_sequence ?? undefined,
  scheduledOccurrenceAt: d.scheduled_occurrence_at || undefined,
  archivedAt: d.archived_at || undefined,
  archivedBy: d.archived_by || undefined,
  deletedAt: d.deleted_at || undefined,
  deletedBy: d.deleted_by || undefined,
  purgeAfter: d.purge_after || undefined,
  deletionReasonCode: d.deletion_reason_code || undefined,
  deletionReasonText: d.deletion_reason_text || undefined,
  estimatedHours: d.estimated_hours != null ? Number(d.estimated_hours) : undefined,
});

// Task "shell": campos preenchidos, sub-entidades vazias. Usado nas listagens,
// que escalam a milhares de tarefas justamente por não hidratar tudo — o
// detalhe é carregado sob demanda ao abrir a tarefa (ver fetchTaskDetails).
export function mapRowToTaskShell(d: TaskRow): Task {
  return {
    ...mapTaskCore(d),
    extensionHistory: [],
    checklists: [],
    comments: [],
    attachments: [],
    activities: [],
    watcherIds: [],
  } as Task;
}

// Paginação genérica: busca todas as páginas de `build` até esgotar.
//
// Com `countQuery`: pede a contagem exata primeiro (uma consulta leve, sem
// linhas — `head: true`) e, sabendo o total, dispara TODAS as páginas de
// dados em paralelo via Promise.all, em vez de uma atrás da outra. Sem isso,
// um escopo grande (ex.: pasta com ~3400 tarefas = 4 páginas de 1000) somava
// a latência de cada página em série — ~16s observados em produção pra essa
// pasta específica (achado em 2026-09-06, /equipamentos/02-projeto-em-
// andamento). Se a contagem falhar por qualquer motivo, cai pro loop
// sequencial de sempre — nunca fica sem dado por causa dessa otimização.
async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<PostgrestResult<T>>,
  label: string,
  startFrom = 0,
  countQuery?: () => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<T[]> {
  if (countQuery) {
    try {
      const { count, error: countError } = await countQuery();
      if (!countError && typeof count === 'number') {
        if (count <= startFrom) return [];
        const pageStarts: number[] = [];
        for (let from = startFrom; from < count; from += PAGE_SIZE) pageStarts.push(from);
        const pages = await Promise.all(pageStarts.map((from) => build(from, from + PAGE_SIZE - 1)));
        const all: T[] = [];
        for (const { data: page, error } of pages) {
          if (error) {
            console.error(`taskRepo.${label}: erro ao paginar (paralelo):`, error);
            throw error;
          }
          if (page) all.push(...page);
        }
        return all;
      }
    } catch (err) {
      console.error(`taskRepo.${label}: contagem falhou, caindo para paginação sequencial:`, err);
    }
  }

  let all: T[] = [];
  let from = startFrom;
  while (true) {
    const { data: page, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`taskRepo.${label}: erro ao paginar:`, error);
      // Propaga o erro em vez de devolver o que já foi acumulado (possivelmente
      // vazio): um resultado parcial silencioso é indistinguível de "sem
      // tarefas" para quem chama, e a tela fica vazia até um F5 manual.
      throw error;
    }
    if (!page || page.length === 0) break;
    all = all.concat(page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// Ponto único da cláusula "tarefa normal" (issue #185 seção 29): toda
// consulta de VIEW comum (Lista/Kanban/Tabela/Calendário/Gantt/Minhas
// Tarefas/busca) passa por aqui, pra nunca esquecer de esconder arquivadas/
// lixeira em algum caminho novo. Abrir uma tarefa específica por id
// (fetchTaskDetails) NÃO usa isso — precisa continuar acessível pra
// desarquivar/restaurar mesmo estando fora das views normais.
function selectNormalTasks() {
  return supabase.from('tasks').select(TASK_ROW_SELECT).is('archived_at', null).is('deleted_at', null);
}

async function fetchTaskRowsRange(
  listIds: string[] | null,
  from: number,
  to: number,
  label: string,
): Promise<TaskRow[]> {
  const q = selectNormalTasks();
  const { data, error } = await (listIds ? q.in('list_id', listIds) : q)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    console.error(`taskRepo.${label}: erro ao carregar página:`, error);
    throw error;
  }
  return (data || []) as TaskRow[];
}

async function fetchTaskRowsBySingleListRange(
  listId: string,
  from: number,
  to: number,
  label: string,
): Promise<TaskRow[]> {
  const { data, error } = await selectNormalTasks()
    .eq('list_id', listId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    console.error(`taskRepo.${label}: erro ao carregar página:`, error);
    throw error;
  }
  return (data || []) as TaskRow[];
}

// Linhas cruas de `tasks` no escopo. `listIds === null` = todas as visíveis
// (RLS restringe); caso contrário, filtra por esse conjunto de listas.
export function fetchTaskRowsByListIds(listIds: string[] | null): Promise<TaskRow[]> {
  return fetchAllPages<TaskRow>(
    (from, to) => {
      const q = selectNormalTasks();
      return (listIds ? q.in('list_id', listIds) : q)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to);
    },
    'fetchTaskRowsByListIds',
    0,
    async () => {
      const q = supabase.from('tasks').select('id', { count: 'exact', head: true }).is('archived_at', null).is('deleted_at', null);
      const { count, error } = await (listIds ? q.in('list_id', listIds) : q);
      return { count, error };
    },
  );
}

export function fetchInitialTaskRowsByListIds(listIds: string[] | null): Promise<TaskRow[]> {
  return fetchTaskRowsRange(listIds, 0, INITIAL_TASK_PAGE_SIZE - 1, 'fetchInitialTaskRowsByListIds');
}

// Issue #185, gota 3 ("mostrar arquivadas"): mesmo escopo (listIds) das
// consultas normais acima, só que o inverso de selectNormalTasks —
// archived_at NÃO nulo, deleted_at nulo (uma tarefa na lixeira não aparece
// aqui, ela terá sua própria view na gota da Lixeira). RLS (tasks_select)
// já restringe às linhas que o usuário pode acessar.
export function fetchArchivedTasksByListIds(listIds: string[] | null): Promise<TaskRow[]> {
  return fetchAllPages<TaskRow>(
    (from, to) => {
      const q = supabase.from('tasks').select(TASK_ROW_SELECT).not('archived_at', 'is', null).is('deleted_at', null);
      return (listIds ? q.in('list_id', listIds) : q)
        .order('archived_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to);
    },
    'fetchArchivedTasksByListIds',
  );
}

// Issue #185, gota 4 ("Lixeira"): mesmo escopo por listIds das consultas
// acima, só que deleted_at NÃO nulo (independente de archived_at — uma tarefa
// podia estar arquivada antes de ir pra lixeira, seção 13 da issue).
export function fetchTrashedTasksByListIds(listIds: string[] | null): Promise<TaskRow[]> {
  return fetchAllPages<TaskRow>(
    (from, to) => {
      const q = supabase.from('tasks').select(TASK_ROW_SELECT).not('deleted_at', 'is', null);
      return (listIds ? q.in('list_id', listIds) : q)
        .order('deleted_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to);
    },
    'fetchTrashedTasksByListIds',
  );
}

export function fetchRemainingTaskRowsByListIds(listIds: string[] | null): Promise<TaskRow[]> {
  return fetchAllPages<TaskRow>(
    (from, to) => {
      const q = selectNormalTasks();
      return (listIds ? q.in('list_id', listIds) : q)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to);
    },
    'fetchRemainingTaskRowsByListIds',
    INITIAL_TASK_PAGE_SIZE,
    async () => {
      const q = supabase.from('tasks').select('id', { count: 'exact', head: true }).is('archived_at', null).is('deleted_at', null);
      const { count, error } = await (listIds ? q.in('list_id', listIds) : q);
      return { count, error };
    },
  );
}

// Caminho quente da sidebar: quando o usuário abre UMA lista, deixa a consulta
// explícita em list_id = X para o Postgres usar o índice mais direto possível.
export function fetchTaskRowsByListId(listId: string): Promise<TaskRow[]> {
  return fetchAllPages<TaskRow>(
    (from, to) => selectNormalTasks()
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
    'fetchTaskRowsByListId',
    0,
    async () => {
      const { count, error } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .is('deleted_at', null)
        .eq('list_id', listId);
      return { count, error };
    },
  );
}

export function fetchInitialTaskRowsByListId(listId: string): Promise<TaskRow[]> {
  return fetchTaskRowsBySingleListRange(listId, 0, INITIAL_TASK_PAGE_SIZE - 1, 'fetchInitialTaskRowsByListId');
}

export function fetchRemainingTaskRowsByListId(listId: string): Promise<TaskRow[]> {
  return fetchAllPages<TaskRow>(
    (from, to) => selectNormalTasks()
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
    'fetchRemainingTaskRowsByListId',
    INITIAL_TASK_PAGE_SIZE,
    async () => {
      const { count, error } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .is('deleted_at', null)
        .eq('list_id', listId);
      return { count, error };
    },
  );
}

export function fetchMyTaskRows(userId: string): Promise<TaskRow[]> {
  return fetchAllPages<TaskRow>(
    (from, to) => selectNormalTasks()
      .or(`main_assignee_id.eq.${userId},secondary_assignee_ids.cs.{${userId}},created_by.eq.${userId}`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
    'fetchMyTaskRows',
  );
}

// Índice leve (list_id + status) de TODAS as tarefas visíveis — alimenta os
// contadores exatos por lista, independentes do escopo carregado.
// `listIds` (as listas acessíveis) filtra a busca por list_id: usa o índice
// idx_tasks_list_id em vez de varrer todas as ~7k tarefas avaliando a RLS
// can_access_task por linha (que sem filtro custa ~1,7s p/ não-admins). Como os
// badges só existem para listas acessíveis, filtrar por elas é equivalente e
// muito mais rápido. `null` = sem filtro (a RLS restringe; caminho antigo).
async function fetchTaskCountIndexFallback(listIds: string[] | null = null): Promise<TaskCountSummary[]> {
  if (listIds && listIds.length === 0) return [];
  const rows = await fetchAllPages<CountRow>(
    (from, to) => {
      const q = supabase.from('tasks').select('id, list_id, status').is('archived_at', null).is('deleted_at', null);
      return (listIds ? q.in('list_id', listIds) : q)
        .order('list_id', { ascending: true, nullsFirst: true })
        .order('status', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
    },
    'fetchTaskCountIndex',
  );
  const map = new Map<string, TaskCountSummary>();
  for (const row of rows) {
    const key = `${row.list_id ?? ''}::${row.status}`;
    const current = map.get(key) ?? { listId: row.list_id, status: row.status, count: 0 };
    current.count += 1;
    map.set(key, current);
  }
  return Array.from(map.values());
}

// Contadores agregados no banco: reduz o tráfego da sidebar de milhares de
// linhas para poucas linhas por lista/status. O fallback evita janela quebrada
// caso o front novo seja publicado antes da migration/RPC estar aplicada.
export async function fetchTaskCountIndex(listIds: string[] | null = null): Promise<TaskCountSummary[]> {
  if (listIds && listIds.length === 0) return [];

  const { data, error } = await supabase.rpc('get_task_counts_by_list', {
    p_list_ids: listIds,
  });

  if (!error) {
    return ((data || []) as TaskCountSummaryRow[]).map((row) => ({
      listId: row.list_id,
      status: row.status,
      count: Number(row.total_count) || 0,
    }));
  }

  console.warn('taskRepo.fetchTaskCountIndex: fallback sem RPC:', error);
  return fetchTaskCountIndexFallback(listIds);
}

export type DashboardPeriod = 'all' | '7d' | '30d' | '90d';

// Resumo agregado do Dashboard (visão global): uma célula por combinação de
// lista/responsável/status/prioridade/saúde/extensão, calculada no banco
// (get_dashboard_summary) — evita baixar uma linha por tarefa (chegando a
// dezenas de milhares) só pra montar os widgets do Dashboard. `null` sinaliza
// pro chamador que a função ainda não foi migrada pro banco (precisa aplicar
// supabase/migrations/20260829013000_dashboard_summary_rpc.sql manualmente
// em produção — mesma ressalva de outras RPCs deste arquivo); sem fallback
// client-side aqui porque ele exigiria baixar exatamente as milhares de
// linhas que esta função existe pra evitar.
export async function fetchDashboardSummary(period: DashboardPeriod): Promise<DashboardSummaryRow[] | null> {
  const { data, error } = await supabase.rpc('get_dashboard_summary', { p_period: period });
  if (error) {
    console.warn('taskRepo.fetchDashboardSummary: RPC indisponível:', error);
    return null;
  }
  return ((data ?? []) as DashboardSummaryDbRow[]).map((row) => ({
    listId: row.list_id,
    mainAssigneeId: row.main_assignee_id,
    status: row.status,
    priority: row.priority,
    healthKey: row.health_key,
    isExtended: row.is_extended,
    count: Number(row.count) || 0,
  }));
}

// Issue #187 (Workload/Capacidade), gota 2/3. Mesmo padrão de
// fetchDashboardSummary: agregação feita no Postgres (get_workload_summary,
// SECURITY INVOKER — respeita RLS de tasks linha a linha), nunca traz
// tarefa por tarefa pro cliente.
export async function fetchWorkloadSummary(
  listIds: string[] | null,
  periodStart: string,
  periodEnd: string,
): Promise<WorkloadBucket[]> {
  const { data, error } = await supabase.rpc('get_workload_summary', {
    p_list_ids: listIds,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });
  if (error) {
    console.error('taskRepo.fetchWorkloadSummary:', error);
    throw error;
  }
  return ((data ?? []) as { user_id: string; bucket_date: string; planned_hours: number | string; task_count: number | string }[]).map((row) => ({
    userId: row.user_id,
    bucketDate: row.bucket_date,
    plannedHours: Number(row.planned_hours) || 0,
    taskCount: Number(row.task_count) || 0,
  }));
}

export async function fetchUserCapacities(): Promise<UserCapacity[]> {
  const { data, error } = await supabase.from('user_capacity').select('user_id, weekly_hours');
  if (error) { console.error('taskRepo.fetchUserCapacities:', error); throw error; }
  return (data ?? []).map((r: any) => ({ userId: r.user_id, weeklyHours: Number(r.weekly_hours) }));
}

export async function upsertUserCapacity(userId: string, weeklyHours: number): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('user_capacity')
    .upsert({ user_id: userId, weekly_hours: weeklyHours, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchUserTimeOff(userIds?: string[]): Promise<UserTimeOff[]> {
  let q = supabase.from('user_time_off').select('id, user_id, start_date, end_date, reason').order('start_date', { ascending: false });
  if (userIds && userIds.length > 0) q = q.in('user_id', userIds);
  const { data, error } = await q;
  if (error) { console.error('taskRepo.fetchUserTimeOff:', error); throw error; }
  return (data ?? []).map((r: any) => ({ id: r.id, userId: r.user_id, startDate: r.start_date, endDate: r.end_date, reason: r.reason || undefined }));
}

export async function addUserTimeOff(userId: string, startDate: string, endDate: string, reason: string | null, createdBy: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('user_time_off').insert({ user_id: userId, start_date: startDate, end_date: endDate, reason, created_by: createdBy });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteUserTimeOff(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('user_time_off').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateTaskEstimatedHours(taskId: string, hours: number | null): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('tasks').update({ estimated_hours: hours }).eq('id', taskId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export interface ListColumnPrefs {
  listId: string;
  hiddenFieldIds: string[];
  hiddenStandardKeys: string[];
}

export async function fetchListColumnPrefs(listIds: string[]): Promise<ListColumnPrefs[]> {
  if (listIds.length === 0) return [];
  const { data, error } = await supabase
    .from('list_column_prefs')
    .select('list_id, hidden_field_ids, hidden_standard_keys')
    .in('list_id', listIds);
  if (error) { console.error('taskRepo.fetchListColumnPrefs:', error); throw error; }
  return (data ?? []).map((r: any) => ({
    listId: r.list_id,
    hiddenFieldIds: Array.isArray(r.hidden_field_ids) ? r.hidden_field_ids : [],
    hiddenStandardKeys: Array.isArray(r.hidden_standard_keys) ? r.hidden_standard_keys : [],
  }));
}

export async function upsertListColumnPrefs(
  listId: string,
  hiddenFieldIds: string[],
  hiddenStandardKeys: string[],
  updatedBy: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('list_column_prefs')
    .upsert(
      {
        list_id: listId,
        hidden_field_ids: hiddenFieldIds,
        hidden_standard_keys: hiddenStandardKeys,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: 'list_id' }
    );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Issue #186 (Time Tracking) — MVP: cronômetro + lançamento manual por
// tarefa. `startTimer`/`addManualTimeEntry` deixam o banco garantir a regra
// "no máximo um cronômetro rodando por usuário" (índice único parcial em
// task_time_entries) — o erro de constraint vira mensagem amigável aqui.
const mapTimeEntryRow = (r: any): TimeEntry => ({
  id: r.id,
  taskId: r.task_id,
  userId: r.user_id,
  startedAt: r.started_at,
  endedAt: r.ended_at || undefined,
  durationMinutes: r.duration_minutes ?? undefined,
  isBillable: r.is_billable,
  description: r.description || undefined,
  source: r.source,
});
const TIME_ENTRY_SELECT = 'id, task_id, user_id, started_at, ended_at, duration_minutes, is_billable, description, source';

export async function fetchTimeEntriesForTask(taskId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('task_time_entries')
    .select(TIME_ENTRY_SELECT)
    .eq('task_id', taskId)
    .order('started_at', { ascending: false });
  if (error) { console.error('taskRepo.fetchTimeEntriesForTask:', error); throw error; }
  return (data ?? []).map(mapTimeEntryRow);
}

// A tarefa em que o usuário tem um cronômetro rodando agora (se houver) —
// usada pro indicador "você já tem um cronômetro rodando em outra tarefa".
export async function fetchRunningTimer(userId: string): Promise<TimeEntry | null> {
  const { data, error } = await supabase
    .from('task_time_entries')
    .select(TIME_ENTRY_SELECT)
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle();
  if (error) { console.error('taskRepo.fetchRunningTimer:', error); throw error; }
  return data ? mapTimeEntryRow(data) : null;
}

export async function startTimer(taskId: string, userId: string, isBillable: boolean, description?: string): Promise<{ ok: true; entry: TimeEntry } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('task_time_entries')
    .insert({ task_id: taskId, user_id: userId, source: 'timer', is_billable: isBillable, description: description || null })
    .select(TIME_ENTRY_SELECT)
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Você já tem um cronômetro rodando em outra tarefa. Pare-o antes de iniciar um novo.' };
    return { ok: false, message: error.message };
  }
  return { ok: true, entry: mapTimeEntryRow(data) };
}

export async function stopTimer(entryId: string): Promise<{ ok: true; entry: TimeEntry } | { ok: false; message: string }> {
  const { data: current, error: fetchError } = await supabase.from('task_time_entries').select('started_at').eq('id', entryId).single();
  if (fetchError || !current) return { ok: false, message: fetchError?.message || 'Cronômetro não encontrado.' };
  const endedAt = new Date();
  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - new Date(current.started_at).getTime()) / 60000));
  const { data, error } = await supabase
    .from('task_time_entries')
    .update({ ended_at: endedAt.toISOString(), duration_minutes: durationMinutes, updated_at: endedAt.toISOString() })
    .eq('id', entryId)
    .select(TIME_ENTRY_SELECT)
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, entry: mapTimeEntryRow(data) };
}

export async function addManualTimeEntry(
  taskId: string,
  userId: string,
  startedAt: string,
  durationMinutes: number,
  isBillable: boolean,
  description: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const endedAt = new Date(new Date(startedAt).getTime() + durationMinutes * 60000).toISOString();
  const { error } = await supabase
    .from('task_time_entries')
    .insert({ task_id: taskId, user_id: userId, source: 'manual', started_at: startedAt, ended_at: endedAt, duration_minutes: durationMinutes, is_billable: isBillable, description });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateTimeEntry(
  entryId: string,
  updates: { durationMinutes?: number; isBillable?: boolean; description?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.durationMinutes !== undefined) patch.duration_minutes = updates.durationMinutes;
  if (updates.isBillable !== undefined) patch.is_billable = updates.isBillable;
  if (updates.description !== undefined) patch.description = updates.description;
  const { error } = await supabase.from('task_time_entries').update(patch).eq('id', entryId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteTimeEntry(entryId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('task_time_entries').delete().eq('id', entryId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchTimeTrackingSummary(listIds: string[] | null, periodStart: string, periodEnd: string): Promise<TimeTrackingBucket[]> {
  const { data, error } = await supabase.rpc('get_time_tracking_summary', { p_list_ids: listIds, p_period_start: periodStart, p_period_end: periodEnd });
  if (error) { console.error('taskRepo.fetchTimeTrackingSummary:', error); throw error; }
  return ((data ?? []) as any[]).map((r) => ({
    userId: r.user_id,
    entryDate: r.entry_date,
    actualMinutes: Number(r.actual_minutes) || 0,
    billableMinutes: Number(r.billable_minutes) || 0,
  }));
}

export async function fetchCustomFieldValuesByEntityIds(entityIds: string[]): Promise<CustomFieldValue[]> {
  const uniqueIds = Array.from(new Set(entityIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  // Mesmo motivo do fetchSubEntityInChunks: lotes são requisições
  // independentes, então disparamos em paralelo em vez de um atrás do outro.
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += SUBENTITY_CHUNK) {
    chunks.push(uniqueIds.slice(i, i + SUBENTITY_CHUNK));
  }
  const chunkResults = await Promise.all(chunks.map(async (slice) => {
    const { data, error } = await supabase
      .from('custom_field_values')
      .select('field_id, entity_id, value')
      .in('entity_id', slice);

    if (error) {
      console.error('taskRepo.fetchCustomFieldValuesByEntityIds: erro ao carregar lote:', error);
      return [];
    }
    return (data as CustomFieldValueRow[]) ?? [];
  }));
  const rows: CustomFieldValueRow[] = chunkResults.flat();

  return rows.map((v) => ({
    fieldId: v.field_id,
    entityId: v.entity_id,
    value: v.value,
  }));
}

// Busca server-side por título/descrição. A RPC faz a busca perto do banco,
// aplica `can_access_task` explicitamente e evita varrer a lista carregada no
// navegador. O fallback preserva o comportamento durante a janela de deploy em
// que o front novo pode chegar antes da migration.
export async function searchTaskRowsByTitle(term: string, limit = 200): Promise<TaskRow[]> {
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  const { data: rpcData, error: rpcError } = await supabase.rpc('search_tasks', {
    p_term: term,
    p_limit: limit,
  });

  if (!rpcError) return (rpcData || []) as TaskRow[];
  console.warn('taskRepo.searchTaskRowsByTitle: fallback sem RPC:', rpcError);

  const { data, error } = await selectNormalTasks()
    .ilike('title', pattern)
    .limit(limit);
  if (error) { console.error('taskRepo.searchTaskRowsByTitle: erro na busca:', error); return []; }
  return (data || []) as TaskRow[];
}

// Busca uma sub-entidade filtrando por task_id em lotes seguros de IDs. Os
// lotes são requisições independentes (o corte de 150 é só pra manter a URL
// dentro do limite, ver SUBENTITY_CHUNK) — disparar todos em paralelo em vez
// de um atrás do outro evita somar a latência de cada round-trip em série
// (ex.: uma pasta com ~3400 tarefas gera ~23 lotes; em série isso passava de
// meio minuto só nessa sub-entidade, achado em produção com /equipamentos/
// 02-projeto-em-andamento em 2026-09-06).
async function fetchSubEntityInChunks<T>(
  taskIds: string[],
  build: (ids: string[]) => PromiseLike<PostgrestResult<T>>,
  label: string,
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < taskIds.length; i += SUBENTITY_CHUNK) {
    const slice = taskIds.slice(i, i + SUBENTITY_CHUNK);
    if (slice.length > 0) chunks.push(slice);
  }
  const results = await Promise.all(chunks.map(async (slice, idx) => {
    const { data: part, error } = await build(slice);
    if (error) {
      console.error(`taskRepo.hydrateTaskRows: erro ao carregar ${label} (lote ${idx}):`, error);
      return [];
    }
    return part ?? [];
  }));
  return results.flat();
}

// Hidrata linhas de `tasks` em objetos Task completos, buscando as
// sub-entidades em lotes seguros de IDs (ver SUBENTITY_CHUNK).
export async function hydrateTaskRows(rows: TaskRow[]): Promise<Task[]> {
  if (!rows || rows.length === 0) return [];
  const taskIds = rows.map((d) => d.id);

  const [attData, commData, logData, checkData, actData, watchData] = await Promise.all([
    fetchSubEntityInChunks<AttachmentRow>(taskIds, (ids) => supabase.from('task_attachments').select('*').in('task_id', ids), 'task_attachments'),
    fetchSubEntityInChunks<CommentRow>(taskIds, (ids) => supabase.from('task_comments').select('*').in('task_id', ids).is('deleted_at', null), 'task_comments'),
    fetchSubEntityInChunks<ExtensionLogRow>(taskIds, (ids) => supabase.from('task_extension_logs').select('*').in('task_id', ids), 'task_extension_logs'),
    fetchSubEntityInChunks<ChecklistRow>(taskIds, (ids) => supabase.from('task_checklists').select('*').in('task_id', ids), 'task_checklists'),
    fetchSubEntityInChunks<ActivityRow>(taskIds, (ids) => supabase.from('task_activities').select('*').in('task_id', ids), 'task_activities'),
    fetchSubEntityInChunks<WatcherRow>(taskIds, (ids) => supabase.from('task_watchers').select('task_id, user_id').in('task_id', ids), 'task_watchers'),
  ]);

  return rows.map((d) => ({
    ...mapTaskCore(d),
    extensionHistory: logData.filter((l) => l.task_id === d.id).map(mapLog),
    checklists: checkData.filter((ck) => ck.task_id === d.id).map(mapChecklist),
    comments: commData.filter((c) => c.task_id === d.id).map(mapComment),
    attachments: attData.filter((a) => a.task_id === d.id).map(mapAttachment),
    activities: actData.filter((act) => act.task_id === d.id).map(mapActivity),
    watcherIds: watchData.filter((w) => w.task_id === d.id).map((w) => w.user_id),
  } as Task));
}

// Sub-entidades de UMA tarefa (lazy-load ao abrir o detalhe).
export async function fetchTaskDetails(taskId: string): Promise<Partial<Task>> {
  const [attRes, commRes, logRes, checkRes, actRes, watchRes] = await Promise.all([
    supabase.from('task_attachments').select('*').eq('task_id', taskId),
    supabase.from('task_comments').select('*').eq('task_id', taskId).is('deleted_at', null),
    supabase.from('task_extension_logs').select('*').eq('task_id', taskId),
    supabase.from('task_checklists').select('*').eq('task_id', taskId),
    supabase.from('task_activities').select('*').eq('task_id', taskId),
    supabase.from('task_watchers').select('task_id, user_id').eq('task_id', taskId),
  ]);
  return {
    attachments: ((attRes.data || []) as AttachmentRow[]).map(mapAttachment),
    comments: ((commRes.data || []) as CommentRow[]).map(mapComment),
    extensionHistory: ((logRes.data || []) as ExtensionLogRow[]).map(mapLog),
    checklists: ((checkRes.data || []) as ChecklistRow[]).map(mapChecklist),
    activities: ((actRes.data || []) as ActivityRow[]).map(mapActivity),
    watcherIds: ((watchRes.data || []) as WatcherRow[]).map((w) => w.user_id),
  } as Partial<Task>;
}

// ── Escrita (mutações de nível-tarefa) ──────────────────────────────────────
// Regras de negócio (status padrão, validações, automações, estado otimista)
// continuam no App; aqui vive só o acesso ao banco + mapeamento. As funções
// devolvem um resultado em domínio (Task ou ok/erro), sem expor o formato de
// erro do PostgREST ao chamador.

export interface NewTaskInput {
  id?: string;
  title: string;
  description?: string;
  status: string;
  priority: TaskPriority;
  mainAssigneeId: string;
  secondaryAssigneeIds?: string[];
  startDate: string;
  dueDate: string;
  listId: string | null;
  projectId?: string | null;
  parentId?: string | null;
  createdBy: string;
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Insere uma tarefa e devolve o Task recém-criado (sub-entidades vazias).
// Com RLS ativa, o INSERT pode passar e o RETURNING falhar no SELECT da linha
// recém-criada. Por isso geramos o id no cliente e gravamos sem `.select()`.
export async function insertTask(input: NewTaskInput): Promise<{ task: Task } | { error: string }> {
  const id = input.id || newUuid();
  const createdAt = new Date().toISOString();
  const { error } = await supabase
    .from('tasks')
    .insert({
      id,
      title: input.title,
      description: input.description ?? '',
      status: input.status,
      priority: input.priority,
      main_assignee_id: input.mainAssigneeId,
      secondary_assignee_ids: input.secondaryAssigneeIds ?? [],
      start_date: input.startDate || null,
      // `''` (sem data) precisa virar `null` — as colunas são `date`
      // nullable, e o Postgres rejeita `''` como data (mesmo ajuste feito em
      // updateTaskFields acima).
      due_date: input.dueDate || null,
      list_id: input.listId,
      project_id: input.projectId ?? null,
      parent_id: input.parentId ?? null,
      created_by: input.createdBy,
    });
  if (error) return { error: error.message ?? 'Falha ao criar tarefa.' };
  return {
    task: {
      id,
      title: input.title,
      description: input.description ?? '',
      status: input.status,
      priority: input.priority,
      mainAssigneeId: input.mainAssigneeId,
      secondaryAssigneeIds: input.secondaryAssigneeIds ?? [],
      startDate: input.startDate,
      dueDate: input.dueDate,
      extensionCount: 0,
      extensionHistory: [],
      checklists: [],
      comments: [],
      attachments: [],
      activities: [],
      listId: input.listId || '',
      projectId: input.projectId ?? null,
      parentId: input.parentId ?? undefined,
      createdAt,
      createdBy: input.createdBy,
      tags: [],
      watcherIds: [],
    },
  };
}

// Atualiza os campos de nível-tarefa (não mexe em sub-entidades).
//
// `main_assignee_id` (uuid) e `start_date`/`due_date` (date) são colunas
// nullable no banco, mas `Task` tipa esses campos como `string` (convenção
// já usada em outras telas pra representar "vazio" como `''`, ver
// TableView/KanbanView) — sem o `|| null` aqui, uma tentativa de limpar um
// desses campos mandaria `''` pro Postgres, que rejeita `''` como uuid/date
// (erro silencioso do lado do cliente, valor antigo nunca muda no banco).
export async function updateTaskFields(task: Task): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('tasks')
    .update({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      main_assignee_id: task.mainAssigneeId || null,
      secondary_assignee_ids: task.secondaryAssigneeIds,
      start_date: task.startDate || null,
      due_date: task.dueDate || null,
      list_id: task.listId,
      project_id: task.projectId,
      parent_id: task.parentId ?? null,
      extension_count: task.extensionCount,
      is_milestone: task.isMilestone ?? false,
      estimated_hours: task.estimatedHours ?? null,
    })
    .eq('id', task.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Issue #185, gota 2 — arquivar/desarquivar. Dimensão independente do
// `status` (nunca mexe nele): só marca/limpa archived_at/archived_by. RLS
// (tasks_upd) já cobre quem pode chamar isto — mesma permissão de editar a
// tarefa, como pede a seção 23 da issue pra COLABORADOR.
export async function archiveTask(taskId: string, userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('tasks')
    .update({ archived_at: new Date().toISOString(), archived_by: userId })
    .eq('id', taskId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function unarchiveTask(taskId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('tasks')
    .update({ archived_at: null, archived_by: null })
    .eq('id', taskId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

const TRASH_RETENTION_DAYS = 30;

// Issue #185, gota 4 — soft delete real (substitui o hard-delete direto que
// handleDeleteTask usava). Move a tarefa (e a árvore de subtarefas, mesma
// lógica de baixo-pra-cima de deleteTaskTree — aqui a ordem não importa por
// não esbarrar em FK, mas mantém a mesma forma pra reaproveitar a detecção de
// ciclo) pra "Lixeira": preenche deleted_at/deleted_by/purge_after (+30 dias,
// seção 8/11 da issue) e o motivo (seção 10). NUNCA mexe em status/archived_at
// — uma tarefa que já estava arquivada continua arquivada ao ser restaurada
// (seção 13).
export async function softDeleteTaskTree(
  taskId: string,
  userId: string,
  reasonCode: string | null,
  reasonText: string | null,
  visited = new Set<string>(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (visited.has(taskId)) {
    return { ok: false, message: 'Foi detectado um ciclo inválido entre tarefa e subtarefa.' };
  }
  visited.add(taskId);

  const { data: children, error: childrenError } = await supabase
    .from('tasks')
    .select('id')
    .eq('parent_id', taskId);
  if (childrenError) return { ok: false, message: childrenError.message };

  for (const child of children || []) {
    const result = await softDeleteTaskTree(child.id, userId, reasonCode, reasonText, visited);
    if (!result.ok) return result;
  }

  const deletedAt = new Date();
  const purgeAfter = new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('tasks')
    .update({
      deleted_at: deletedAt.toISOString(),
      deleted_by: userId,
      purge_after: purgeAfter.toISOString(),
      deletion_reason_code: reasonCode,
      deletion_reason_text: reasonText,
    })
    .eq('id', taskId)
    .select('id');
  if (error) return { ok: false, message: error.message };
  if (!data?.length) {
    return { ok: false, message: 'A tarefa não foi encontrada ou você não possui permissão para excluí-la.' };
  }
  return { ok: true };
}

// Restaura a árvore inteira (seção 16 da issue: restaurar o pai recompõe as
// subtarefas também) — limpa deleted_at/deleted_by/purge_after/motivo em
// cascata. Idempotente: limpar campos já nulos numa subtarefa que não estava
// na lixeira não tem efeito.
export async function restoreTaskTree(
  taskId: string,
  visited = new Set<string>(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (visited.has(taskId)) {
    return { ok: false, message: 'Foi detectado um ciclo inválido entre tarefa e subtarefa.' };
  }
  visited.add(taskId);

  const { data: children, error: childrenError } = await supabase
    .from('tasks')
    .select('id')
    .eq('parent_id', taskId);
  if (childrenError) return { ok: false, message: childrenError.message };

  for (const child of children || []) {
    const result = await restoreTaskTree(child.id, visited);
    if (!result.ok) return result;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ deleted_at: null, deleted_by: null, purge_after: null, deletion_reason_code: null, deletion_reason_text: null })
    .eq('id', taskId)
    .select('id');
  if (error) return { ok: false, message: error.message };
  if (!data?.length) {
    return { ok: false, message: 'A tarefa não foi encontrada ou você não possui permissão para restaurá-la.' };
  }
  return { ok: true };
}

// Exclui uma tarefa por id. Enquanto a migration que torna parent_id CASCADE
// não estiver aplicada em todos os ambientes, remove a árvore de subtarefas de
// baixo para cima para não esbarrar na FK tasks_parent_id_fkey (NO ACTION).
async function deleteTaskTree(taskId: string, visited = new Set<string>()): Promise<{ ok: true } | { ok: false; message: string }> {
  if (visited.has(taskId)) {
    return { ok: false, message: 'Foi detectado um ciclo inválido entre tarefa e subtarefa.' };
  }
  visited.add(taskId);

  const { data: children, error: childrenError } = await supabase
    .from('tasks')
    .select('id')
    .eq('parent_id', taskId);
  if (childrenError) return { ok: false, message: childrenError.message };

  for (const child of children || []) {
    const result = await deleteTaskTree(child.id, visited);
    if (!result.ok) return result;
  }

  const { data, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .select('id');
  if (error) return { ok: false, message: error.message };
  if (!data?.length) {
    return { ok: false, message: 'A tarefa não foi encontrada ou Você não possui permissão para excluí-la.' };
  }
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  return deleteTaskTree(taskId);
}

// Issue #185, gota 5 — "Excluir permanentemente". Reaproveita a mesma
// recursão de deleteTaskTree (bottom-up, já lida com a FK NO ACTION de
// parent_id). A RLS de DELETE (tasks_del) agora exige is_admin() E
// deleted_at IS NOT NULL — só funciona numa tarefa que já passou pelo soft
// delete (gota 4); chamar isto direto numa tarefa normal falha por RLS.
export async function permanentlyDeleteTask(taskId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  return deleteTaskTree(taskId);
}

// ── Escrita de sub-entidades ────────────────────────────────────────────────
// Padrão de retorno `{ <dado>?, error }` espelhando o próprio Supabase: o App
// checa `error` e cuida do estado otimista/toasts. `error` é uma mensagem em
// texto (o formato do PostgREST não vaza para o chamador).

export async function insertAttachment(
  taskId: string,
  att: { name?: string; url?: string; type?: string; size?: number },
): Promise<{ attachment: ReturnType<typeof mapAttachment> | null; error: string | null }> {
  const uploadedAt = new Date().toISOString();
  const attachmentRow: AttachmentRow = {
    id: newUuid(),
    task_id: taskId,
    name: att.name || 'Anexo',
    url: att.url || '',
    type: att.type || 'application/octet-stream',
    size: att.size ?? 0,
    uploaded_at: uploadedAt,
  };

  const { error } = await supabase
    .from('task_attachments')
    .insert({
      id: attachmentRow.id,
      task_id: attachmentRow.task_id,
      name: attachmentRow.name,
      url: attachmentRow.url,
      type: attachmentRow.type,
      size: attachmentRow.size,
      uploaded_at: attachmentRow.uploaded_at,
    });
  if (error) return { attachment: null, error: error.message ?? 'registro não criado' };
  return { attachment: mapAttachment(attachmentRow), error: null };
}

// Exclui a linha do anexo e o arquivo físico do Storage. `notFound` distingue
// "registro inexistente" de erro do banco.
export async function deleteAttachment(attachmentId: string): Promise<{ error: string | null; notFound?: boolean }> {
  const { data, error } = await supabase.from('task_attachments').delete().eq('id', attachmentId).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'registro não encontrado.', notFound: true };
  // A URL pública contém bucket + caminho.
  const url = (data[0] as AttachmentRow)?.url || '';
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (match) {
    const storagePath = decodeURIComponent(match[2]);
    const { error: storageError } = await supabase.storage.from(match[1]).remove([storagePath]);
    if (storageError) console.error('taskRepo.deleteAttachment: erro ao remover do Storage:', storageError);
  }
  return { error: null };
}

export async function insertComment(
  taskId: string,
  userId: string,
  text: string,
  parentCommentId?: string,
): Promise<{ comment: ReturnType<typeof mapComment> | null; error: string | null }> {
  const createdAt = new Date().toISOString();
  const commentRow: CommentRow = {
    id: newUuid(),
    task_id: taskId,
    user_id: userId,
    text,
    created_at: createdAt,
    updated_at: null,
    parent_comment_id: parentCommentId || null,
    assigned_to: null,
    assigned_by: null,
    resolved_at: null,
    resolved_by: null,
  };

  const { error } = await supabase
    .from('task_comments')
    .insert({
      id: commentRow.id,
      task_id: commentRow.task_id,
      user_id: commentRow.user_id,
      text: commentRow.text,
      created_at: commentRow.created_at,
      parent_comment_id: commentRow.parent_comment_id,
    });
  if (error) return { comment: null, error: error.message ?? 'registro não criado' };
  return { comment: mapComment(commentRow), error: null };
}

export async function updateCommentText(commentId: string, newText: string, updatedAt: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('task_comments').update({ text: newText, updated_at: updatedAt }).eq('id', commentId);
  return { error: error ? error.message : null };
}

// Soft delete do comentário E das respostas da thread (o soft delete não
// aciona o ON DELETE CASCADE, senão as respostas ficariam órfãs).
export async function softDeleteCommentThread(commentId: string, deletedAt: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('task_comments')
    .update({ deleted_at: deletedAt })
    .or(`id.eq.${commentId},parent_comment_id.eq.${commentId}`);
  return { error: error ? error.message : null };
}

export async function assignComment(commentId: string, assignedTo: string | null, assignedBy: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('task_comments')
    .update({ assigned_to: assignedTo, assigned_by: assignedBy, resolved_at: null, resolved_by: null })
    .eq('id', commentId);
  return { error: error ? error.message : null };
}

export async function resolveComment(commentId: string, resolvedBy: string, resolvedAt: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('task_comments').update({ resolved_at: resolvedAt, resolved_by: resolvedBy }).eq('id', commentId);
  return { error: error ? error.message : null };
}

export async function addWatcher(taskId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('task_watchers').insert({ task_id: taskId, user_id: userId });
  return { error: error ? error.message : null };
}

export async function removeWatcher(taskId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('task_watchers').delete().eq('task_id', taskId).eq('user_id', userId);
  return { error: error ? error.message : null };
}

export async function insertActivity(
  taskId: string,
  userId: string,
  type: string,
  oldValue?: string,
  newValue?: string,
): Promise<{ activity: ReturnType<typeof mapActivity> | null; error: string | null }> {
  const { data, error } = await supabase
    .from('task_activities')
    .insert({ task_id: taskId, user_id: userId, type, old_value: oldValue, new_value: newValue })
    .select()
    .single();
  if (error || !data) return { activity: null, error: error?.message ?? 'registro não criado' };
  return { activity: mapActivity(data as ActivityRow), error: null };
}

export async function insertExtensionLog(
  taskId: string,
  log: { oldDate: string | null; newDate: string | null; reason: string | null },
  updatedBy: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('task_extension_logs')
    .insert({ task_id: taskId, old_date: log.oldDate, new_date: log.newDate, reason: log.reason, updated_by: updatedBy });
  return { error: error ? error.message : null };
}

// ── Duplicação (clone de linha de tarefa) ───────────────────────────────────
// Distinto de insertTask: aceita tags/parent explícitos. Define created_by como
// quem executou a duplicação — a cópia é uma tarefa NOVA, então o criador é o
// duplicador (antes ficava nulo, o que aparecia como "Tarefa criada" sem autor).
// Usado tanto para a tarefa clonada quanto para as subtarefas.
export interface TaskCloneInput {
  title: string;
  description: string;
  status: string;
  priority: TaskPriority;
  mainAssigneeId: string;
  secondaryAssigneeIds: string[];
  startDate: string | null;
  dueDate: string | null;
  listId: string | null;
  projectId: string | null;
  parentId: string | null;
  tags: string[];
  createdBy: string;
}

export async function insertTaskClone(input: TaskCloneInput): Promise<{ task: Task } | { error: string }> {
  const id = newUuid();
  const createdAt = new Date().toISOString();
  const { error } = await supabase
    .from('tasks')
    .insert({
      id,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      main_assignee_id: input.mainAssigneeId,
      secondary_assignee_ids: input.secondaryAssigneeIds,
      start_date: input.startDate,
      due_date: input.dueDate,
      list_id: input.listId,
      project_id: input.projectId,
      parent_id: input.parentId,
      extension_count: 0,
      tags: input.tags,
      created_by: input.createdBy,
    });
  if (error) return { error: error.message ?? 'Falha ao duplicar tarefa.' };
  return {
    task: {
      id,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      mainAssigneeId: input.mainAssigneeId,
      secondaryAssigneeIds: input.secondaryAssigneeIds,
      startDate: input.startDate,
      dueDate: input.dueDate,
      extensionCount: 0,
      extensionHistory: [],
      checklists: [],
      comments: [],
      attachments: [],
      activities: [],
      listId: input.listId,
      projectId: input.projectId,
      parentId: input.parentId ?? undefined,
      createdAt,
      createdBy: input.createdBy,
      tags: input.tags,
      watcherIds: [],
    },
  };
}

// ── Regra de recorrência (issue #184, fase 3 — UI de configuração) ─────────
// RLS já garante acesso (task_recurrence_rules_select/ins/upd/del usam
// can_access_task/can_access_list, ver migration da fase 1) — sem
// auto-referência na policy de SELECT, então .insert().select() é seguro
// aqui (diferente de tasks/lists/folders, que precisaram de id-no-cliente).
interface RecurrenceRuleRow {
  id: string;
  task_id: string;
  list_id: string;
  created_by: string | null;
  enabled: boolean;
  frequency_type: string;
  interval: number;
  weekdays: number[];
  month_day: number | null;
  month_week: number | null;
  month_weekday: number | null;
  start_at: string;
  next_run_at: string | null;
  timezone: string;
  trigger_mode: string;
  days_after_complete: number | null;
  create_new_task: boolean;
  skip_weekends: boolean;
  skip_holidays: boolean;
  weekend_shift: string;
  end_mode: string;
  end_at: string | null;
  max_occurrences: number | null;
  occurrences_created: number;
  update_status_to: string | null;
  inherit_options: Record<string, boolean>;
  overlap_policy: string;
  misfire_policy: string;
  last_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRecurrenceRuleRow(r: RecurrenceRuleRow): TaskRecurrenceRule {
  return {
    id: r.id,
    taskId: r.task_id,
    listId: r.list_id,
    createdBy: r.created_by ?? undefined,
    enabled: r.enabled,
    frequencyType: r.frequency_type as TaskRecurrenceRule['frequencyType'],
    interval: r.interval,
    weekdays: r.weekdays || [],
    monthDay: r.month_day ?? undefined,
    monthWeek: r.month_week ?? undefined,
    monthWeekday: r.month_weekday ?? undefined,
    startAt: r.start_at,
    nextRunAt: r.next_run_at ?? undefined,
    timezone: r.timezone,
    triggerMode: r.trigger_mode as TaskRecurrenceRule['triggerMode'],
    daysAfterComplete: r.days_after_complete ?? undefined,
    createNewTask: r.create_new_task,
    skipWeekends: r.skip_weekends,
    skipHolidays: r.skip_holidays,
    weekendShift: r.weekend_shift as TaskRecurrenceRule['weekendShift'],
    endMode: r.end_mode as TaskRecurrenceRule['endMode'],
    endAt: r.end_at ?? undefined,
    maxOccurrences: r.max_occurrences ?? undefined,
    occurrencesCreated: r.occurrences_created,
    updateStatusTo: r.update_status_to ?? undefined,
    inheritOptions: r.inherit_options || {},
    overlapPolicy: r.overlap_policy as TaskRecurrenceRule['overlapPolicy'],
    misfirePolicy: r.misfire_policy as TaskRecurrenceRule['misfirePolicy'],
    lastGeneratedAt: r.last_generated_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchRecurrenceRuleForTask(taskId: string): Promise<TaskRecurrenceRule | null> {
  const { data, error } = await supabase
    .from('task_recurrence_rules')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRecurrenceRuleRow(data as RecurrenceRuleRow);
}

export interface RecurrenceRuleInput {
  taskId: string;
  listId: string;
  createdBy: string;
  frequencyType: TaskRecurrenceRule['frequencyType'];
  interval: number;
  weekdays: number[];
  monthDay?: number | null;
  monthWeek?: number | null;
  monthWeekday?: number | null;
  startAt: string;
  nextRunAt: string | null;
  timezone: string;
  skipWeekends: boolean;
  skipHolidays: boolean;
  weekendShift: TaskRecurrenceRule['weekendShift'];
  endMode: TaskRecurrenceRule['endMode'];
  endAt?: string | null;
  maxOccurrences?: number | null;
  inheritOptions: TaskRecurrenceRule['inheritOptions'];
  overlapPolicy: TaskRecurrenceRule['overlapPolicy'];
  misfirePolicy: TaskRecurrenceRule['misfirePolicy'];
}

// Cria ou substitui a regra de recorrência da tarefa (uma tarefa tem no
// máximo uma regra — upsert por task_id). Reseta occurrences_created/
// last_generated_at ao recriar porque muda os parâmetros do zero.
export async function upsertRecurrenceRule(
  input: RecurrenceRuleInput,
  existingRuleId: string | null,
): Promise<{ rule: TaskRecurrenceRule } | { error: string }> {
  const payload = {
    task_id: input.taskId,
    list_id: input.listId,
    created_by: input.createdBy,
    enabled: true,
    frequency_type: input.frequencyType,
    interval: input.interval,
    weekdays: input.weekdays,
    month_day: input.monthDay ?? null,
    month_week: input.monthWeek ?? null,
    month_weekday: input.monthWeekday ?? null,
    start_at: input.startAt,
    next_run_at: input.nextRunAt,
    timezone: input.timezone,
    trigger_mode: 'on_schedule',
    skip_weekends: input.skipWeekends,
    skip_holidays: input.skipHolidays,
    weekend_shift: input.weekendShift,
    end_mode: input.endMode,
    end_at: input.endAt ?? null,
    max_occurrences: input.maxOccurrences ?? null,
    inherit_options: input.inheritOptions,
    overlap_policy: input.overlapPolicy,
    misfire_policy: input.misfirePolicy,
  };

  const query = existingRuleId
    ? supabase.from('task_recurrence_rules').update(payload).eq('id', existingRuleId)
    : supabase.from('task_recurrence_rules').insert(payload);

  const { data, error } = await query.select('*').single();
  if (error || !data) return { error: error?.message ?? 'Falha ao salvar a regra de recorrência.' };
  return { rule: mapRecurrenceRuleRow(data as RecurrenceRuleRow) };
}

export async function setRecurrenceRuleEnabled(ruleId: string, enabled: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('task_recurrence_rules').update({ enabled }).eq('id', ruleId);
  return { error: error?.message ?? null };
}

export async function deleteRecurrenceRule(ruleId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('task_recurrence_rules').delete().eq('id', ruleId);
  return { error: error?.message ?? null };
}

// Copia os checklists de uma tarefa para outra. Devolve os itens já mapeados
// (ou lista vazia se a origem não tiver checklists).
export async function copyChecklists(
  fromTaskId: string,
  toTaskId: string,
): Promise<{ items: ReturnType<typeof mapChecklist>[] } | { error: string }> {
  const { data: src } = await supabase.from('task_checklists').select('text, completed').eq('task_id', fromTaskId);
  if (!src || src.length === 0) return { items: [] };
  const rows = (src as { text: string; completed: boolean }[]).map((it) => ({
    task_id: toTaskId, text: it.text, completed: it.completed,
  }));
  const { data: inserted, error } = await supabase.from('task_checklists').insert(rows).select();
  if (error) return { error: error.message };
  return { items: ((inserted || []) as ChecklistRow[]).map(mapChecklist) };
}

// ── Dashboard ───────────────────────────────────────────────────────────────
// Linha enxuta do Dashboard: só as colunas usadas (contadores, radar de saúde,
// performance por usuário). Evita baixar `description` (texto rico) das 7000+
// tarefas — payload gigante sem ganho visível.
interface DashboardRow {
  id: string; title: string; status: string; priority: string;
  main_assignee_id: string; start_date: string | null; due_date: string | null;
  extension_count: number | null; list_id: string | null; created_at: string;
}

// Carrega os dados do Dashboard: só as tarefas por trás de "Atividade
// Recente" (os widgets agregados vêm de fetchDashboardSummary/RPC) + a lista
// de listas para os rótulos.
// Antes isso paginava a tabela `tasks` INTEIRA (fetchAllPages) só pra achar
// as poucas tarefas citadas nas 200 atividades recentes — ~9 páginas de
// ~3-4s cada num workspace com 8 mil tarefas (30s+ medido ao vivo pra ADMIN,
// que não tem filtro de lista pra reduzir o total). As atividades JÁ dizem
// exatamente quais tarefas aparecem no widget: busca essas ≤200 tarefas por
// id em vez de escanear tudo — rápido independente do tamanho do workspace.
// `listIds` vira só um filtro extra defensivo (RLS já protege de qualquer
// forma); `null` = sem filtro adicional (ADMIN).
export async function fetchDashboardData(listIds: string[] | null): Promise<{ tasks: Task[]; lists: { id: string; name: string }[] }> {
  if (listIds !== null && listIds.length === 0) return { tasks: [], lists: [] };

  const [actResult, listsResult] = await Promise.all([
    supabase
      .from('task_activities')
      .select('id,task_id,user_id,type,old_value,new_value,created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('lists').select('id,name'),
  ]);

  const activities = (actResult.data || []) as ActivityRow[];
  const taskIds = Array.from(new Set(activities.map((a) => a.task_id)));
  if (taskIds.length === 0) return { tasks: [], lists: (listsResult.data || []) as { id: string; name: string }[] };

  let taskQuery = supabase
    .from('tasks')
    .select('id, title, status, priority, main_assignee_id, start_date, due_date, extension_count, list_id, created_at')
    .in('id', taskIds)
    .is('archived_at', null)
    .is('deleted_at', null);
  if (listIds) taskQuery = taskQuery.in('list_id', listIds);
  const { data: rowsData, error } = await taskQuery;
  if (error) {
    console.error('taskRepo.fetchDashboardData: erro ao carregar tarefas:', error);
    throw error;
  }
  const rows = (rowsData || []) as DashboardRow[];
  if (rows.length === 0) return { tasks: [], lists: (listsResult.data || []) as { id: string; name: string }[] };

  const actMap = new Map<string, ActivityRow[]>();
  activities.forEach((a) => {
    if (!actMap.has(a.task_id)) actMap.set(a.task_id, []);
    actMap.get(a.task_id)!.push(a);
  });

  const tasks = rows.map((d) => ({
    ...mapRowToTaskShell(d as TaskRow),
    activities: (actMap.get(d.id) || []).map(mapActivity),
  }));

  return { tasks, lists: (listsResult.data || []) as { id: string; name: string }[] };
}

// ── Ações em massa ──────────────────────────────────────────────────────────
export async function bulkUpdateStatus(ids: string[], status: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tasks').update({ status }).in('id', ids);
  return { error: error ? error.message : null };
}

export async function bulkUpdatePriority(ids: string[], priority: TaskPriority): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tasks').update({ priority }).in('id', ids);
  return { error: error ? error.message : null };
}

export async function bulkMove(ids: string[], listId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tasks').update({ list_id: listId }).in('id', ids);
  return { error: error ? error.message : null };
}

export async function bulkDelete(ids: string[]): Promise<{ error: string | null }> {
  for (const id of ids) {
    const result = await deleteTask(id);
    if (!result.ok) return { error: result.message };
  }
  return { error: null };
}

// ── Goals / OKRs (issue #188) ────────────────────────────────────────────────

function mapGoalTargetRow(r: any): GoalTarget {
  return {
    id: r.id,
    goalId: r.goal_id,
    type: r.type as GoalTargetType,
    name: r.name,
    unit: r.unit,
    startValue: r.start_value === null ? null : Number(r.start_value),
    targetValue: r.target_value === null ? null : Number(r.target_value),
    currentValue: r.current_value === null ? null : Number(r.current_value),
    isDone: r.is_done,
    taskId: r.task_id,
    orderIndex: r.order_index,
  };
}

function mapGoalRow(r: any): Goal {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    dueDate: r.due_date,
    access: r.access,
    createdBy: r.created_by,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
    ownerIds: (r.goal_owners || []).map((o: any) => o.user_id),
    targets: (r.goal_targets || []).map(mapGoalTargetRow).sort((a: GoalTarget, b: GoalTarget) => a.orderIndex - b.orderIndex),
  };
}

export async function fetchGoals(includeArchived = false): Promise<Goal[]> {
  let q = supabase
    .from('goals')
    .select('*, goal_owners(user_id), goal_targets(*)')
    .order('created_at', { ascending: false });
  if (!includeArchived) q = q.is('archived_at', null);
  const { data, error } = await q;
  if (error) { console.error('taskRepo.fetchGoals:', error); throw error; }
  return (data ?? []).map(mapGoalRow);
}

export async function createGoal(input: {
  name: string; description?: string | null; color: string; dueDate?: string | null;
  access: 'workspace' | 'private'; createdBy: string; ownerIds: string[];
}): Promise<{ ok: true; goal: Goal } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      name: input.name, description: input.description ?? null, color: input.color,
      due_date: input.dueDate ?? null, access: input.access, created_by: input.createdBy,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? 'Erro ao criar meta' };

  const ownerIds = Array.from(new Set(input.ownerIds));
  if (ownerIds.length > 0) {
    const { error: ownersError } = await supabase
      .from('goal_owners')
      .insert(ownerIds.map((userId) => ({ goal_id: data.id, user_id: userId })));
    if (ownersError) return { ok: false, message: ownersError.message };
  }

  return { ok: true, goal: mapGoalRow({ ...data, goal_owners: ownerIds.map((user_id) => ({ user_id })), goal_targets: [] }) };
}

export async function updateGoal(goalId: string, updates: {
  name?: string; description?: string | null; color?: string; dueDate?: string | null;
  access?: 'workspace' | 'private'; archivedAt?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
  if (updates.access !== undefined) payload.access = updates.access;
  if (updates.archivedAt !== undefined) payload.archived_at = updates.archivedAt;
  const { error } = await supabase.from('goals').update(payload).eq('id', goalId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateGoalOwners(goalId: string, ownerIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: delError } = await supabase.from('goal_owners').delete().eq('goal_id', goalId);
  if (delError) return { ok: false, message: delError.message };
  const uniqueIds = Array.from(new Set(ownerIds));
  if (uniqueIds.length === 0) return { ok: true };
  const { error: insError } = await supabase
    .from('goal_owners')
    .insert(uniqueIds.map((userId) => ({ goal_id: goalId, user_id: userId })));
  if (insError) return { ok: false, message: insError.message };
  return { ok: true };
}

export async function deleteGoal(goalId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('goals').delete().eq('id', goalId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function createGoalTarget(goalId: string, input: {
  type: GoalTargetType; name: string; unit?: string | null; startValue?: number | null;
  targetValue?: number | null; currentValue?: number | null; taskId?: string | null; orderIndex: number;
}): Promise<{ ok: true; target: GoalTarget } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('goal_targets')
    .insert({
      goal_id: goalId, type: input.type, name: input.name, unit: input.unit ?? null,
      start_value: input.startValue ?? null, target_value: input.targetValue ?? null,
      current_value: input.currentValue ?? null, task_id: input.taskId ?? null, order_index: input.orderIndex,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? 'Erro ao criar target' };
  return { ok: true, target: mapGoalTargetRow(data) };
}

export async function updateGoalTarget(targetId: string, updates: {
  name?: string; unit?: string | null; startValue?: number | null; targetValue?: number | null;
  currentValue?: number | null; isDone?: boolean; taskId?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.unit !== undefined) payload.unit = updates.unit;
  if (updates.startValue !== undefined) payload.start_value = updates.startValue;
  if (updates.targetValue !== undefined) payload.target_value = updates.targetValue;
  if (updates.currentValue !== undefined) payload.current_value = updates.currentValue;
  if (updates.isDone !== undefined) payload.is_done = updates.isDone;
  if (updates.taskId !== undefined) payload.task_id = updates.taskId;
  const { error } = await supabase.from('goal_targets').update(payload).eq('id', targetId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteGoalTarget(targetId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('goal_targets').delete().eq('id', targetId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// ── Portfolios (issue #189) ──────────────────────────────────────────────────

function mapPortfolioRow(r: any): Portfolio {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    dueDate: r.due_date,
    access: r.access,
    createdBy: r.created_by,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
    ownerIds: (r.portfolio_owners || []).map((o: any) => o.user_id),
    listIds: (r.portfolio_lists || [])
      .slice()
      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((l: any) => l.list_id),
  };
}

export async function fetchPortfolios(includeArchived = false): Promise<Portfolio[]> {
  let q = supabase
    .from('portfolios')
    .select('*, portfolio_owners(user_id), portfolio_lists(list_id, order_index)')
    .order('created_at', { ascending: false });
  if (!includeArchived) q = q.is('archived_at', null);
  const { data, error } = await q;
  if (error) { console.error('taskRepo.fetchPortfolios:', error); throw error; }
  return (data ?? []).map(mapPortfolioRow);
}

export async function createPortfolio(input: {
  name: string; description?: string | null; color: string; dueDate?: string | null;
  access: 'workspace' | 'private'; createdBy: string; ownerIds: string[]; listIds: string[];
}): Promise<{ ok: true; portfolio: Portfolio } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('portfolios')
    .insert({
      name: input.name, description: input.description ?? null, color: input.color,
      due_date: input.dueDate ?? null, access: input.access, created_by: input.createdBy,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? 'Erro ao criar portfolio' };

  const ownerIds = Array.from(new Set(input.ownerIds));
  if (ownerIds.length > 0) {
    const { error: ownersError } = await supabase
      .from('portfolio_owners')
      .insert(ownerIds.map((userId) => ({ portfolio_id: data.id, user_id: userId })));
    if (ownersError) return { ok: false, message: ownersError.message };
  }

  const listIds = Array.from(new Set(input.listIds));
  if (listIds.length > 0) {
    const { error: listsError } = await supabase
      .from('portfolio_lists')
      .insert(listIds.map((listId, i) => ({ portfolio_id: data.id, list_id: listId, order_index: i })));
    if (listsError) return { ok: false, message: listsError.message };
  }

  return {
    ok: true,
    portfolio: mapPortfolioRow({
      ...data,
      portfolio_owners: ownerIds.map((user_id) => ({ user_id })),
      portfolio_lists: listIds.map((list_id, i) => ({ list_id, order_index: i })),
    }),
  };
}

export async function updatePortfolio(portfolioId: string, updates: {
  name?: string; description?: string | null; color?: string; dueDate?: string | null;
  access?: 'workspace' | 'private'; archivedAt?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
  if (updates.access !== undefined) payload.access = updates.access;
  if (updates.archivedAt !== undefined) payload.archived_at = updates.archivedAt;
  const { error } = await supabase.from('portfolios').update(payload).eq('id', portfolioId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updatePortfolioOwners(portfolioId: string, ownerIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: delError } = await supabase.from('portfolio_owners').delete().eq('portfolio_id', portfolioId);
  if (delError) return { ok: false, message: delError.message };
  const uniqueIds = Array.from(new Set(ownerIds));
  if (uniqueIds.length === 0) return { ok: true };
  const { error: insError } = await supabase
    .from('portfolio_owners')
    .insert(uniqueIds.map((userId) => ({ portfolio_id: portfolioId, user_id: userId })));
  if (insError) return { ok: false, message: insError.message };
  return { ok: true };
}

export async function updatePortfolioLists(portfolioId: string, listIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: delError } = await supabase.from('portfolio_lists').delete().eq('portfolio_id', portfolioId);
  if (delError) return { ok: false, message: delError.message };
  const uniqueIds = Array.from(new Set(listIds));
  if (uniqueIds.length === 0) return { ok: true };
  const { error: insError } = await supabase
    .from('portfolio_lists')
    .insert(uniqueIds.map((listId, i) => ({ portfolio_id: portfolioId, list_id: listId, order_index: i })));
  if (insError) return { ok: false, message: insError.message };
  return { ok: true };
}

export async function deletePortfolio(portfolioId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('portfolios').delete().eq('id', portfolioId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// ── Forms (issue #190) ───────────────────────────────────────────────────────

function mapFormQuestionRow(r: any): FormQuestion {
  return {
    id: r.id,
    formId: r.form_id,
    orderIndex: r.order_index,
    type: r.type,
    mapsTo: r.maps_to,
    customFieldId: r.custom_field_id,
    label: r.label,
    helpText: r.help_text,
    isRequired: r.is_required,
    options: r.options,
  };
}

function mapFormRow(r: any): FormDef {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    listId: r.list_id,
    access: r.access,
    defaultAssigneeId: r.default_assignee_id,
    defaultStatus: r.default_status,
    defaultPriority: r.default_priority,
    submitLabel: r.submit_label,
    redirectUrl: r.redirect_url,
    allowResubmit: r.allow_resubmit,
    requireConsent: r.require_consent,
    consentText: r.consent_text,
    isActive: r.is_active,
    createdBy: r.created_by,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
    questions: (r.form_questions || []).map(mapFormQuestionRow).sort((a: FormQuestion, b: FormQuestion) => a.orderIndex - b.orderIndex),
    // PostgREST sempre devolve um agregado `(count)` como [{ count: N }],
    // mesmo select embedado — não confundir com a lista de linhas em si.
    submissionCount: r.form_submissions?.[0]?.count ?? 0,
  };
}

export async function fetchForms(includeArchived = false): Promise<FormDef[]> {
  let q = supabase
    .from('forms')
    .select('*, form_questions(*), form_submissions(count)')
    .order('created_at', { ascending: false });
  if (!includeArchived) q = q.is('archived_at', null);
  const { data, error } = await q;
  if (error) { console.error('taskRepo.fetchForms:', error); throw error; }
  return (data ?? []).map(mapFormRow);
}

export async function fetchFormById(formId: string): Promise<FormDef | null> {
  const { data, error } = await supabase
    .from('forms')
    .select('*, form_questions(*), form_submissions(count)')
    .eq('id', formId)
    .maybeSingle();
  if (error) { console.error('taskRepo.fetchFormById:', error); throw error; }
  return data ? mapFormRow(data) : null;
}

export async function createForm(input: {
  name: string; description?: string | null; listId: string;
  defaultAssigneeId?: string | null; defaultStatus?: string | null; defaultPriority?: string | null;
  submitLabel: string; redirectUrl?: string | null; allowResubmit: boolean;
  requireConsent: boolean; consentText?: string | null; createdBy: string;
}): Promise<{ ok: true; form: FormDef } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('forms')
    .insert({
      name: input.name, description: input.description ?? null, list_id: input.listId,
      default_assignee_id: input.defaultAssigneeId ?? null, default_status: input.defaultStatus ?? null,
      default_priority: input.defaultPriority ?? null, submit_label: input.submitLabel,
      redirect_url: input.redirectUrl ?? null, allow_resubmit: input.allowResubmit,
      require_consent: input.requireConsent, consent_text: input.consentText ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? 'Erro ao criar formulário' };
  return { ok: true, form: mapFormRow({ ...data, form_questions: [], form_submissions: [{ count: 0 }] }) };
}

export async function updateForm(formId: string, updates: {
  name?: string; description?: string | null; defaultAssigneeId?: string | null;
  defaultStatus?: string | null; defaultPriority?: string | null; submitLabel?: string;
  redirectUrl?: string | null; allowResubmit?: boolean; requireConsent?: boolean;
  consentText?: string | null; isActive?: boolean; archivedAt?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.defaultAssigneeId !== undefined) payload.default_assignee_id = updates.defaultAssigneeId;
  if (updates.defaultStatus !== undefined) payload.default_status = updates.defaultStatus;
  if (updates.defaultPriority !== undefined) payload.default_priority = updates.defaultPriority;
  if (updates.submitLabel !== undefined) payload.submit_label = updates.submitLabel;
  if (updates.redirectUrl !== undefined) payload.redirect_url = updates.redirectUrl;
  if (updates.allowResubmit !== undefined) payload.allow_resubmit = updates.allowResubmit;
  if (updates.requireConsent !== undefined) payload.require_consent = updates.requireConsent;
  if (updates.consentText !== undefined) payload.consent_text = updates.consentText;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  if (updates.archivedAt !== undefined) payload.archived_at = updates.archivedAt;
  const { error } = await supabase.from('forms').update(payload).eq('id', formId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteForm(formId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('forms').delete().eq('id', formId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function createFormQuestion(formId: string, input: {
  orderIndex: number; type: FormQuestionType; mapsTo?: FormMapsTo | null;
  customFieldId?: string | null; label: string; helpText?: string | null;
  isRequired: boolean; options?: string[] | null;
}): Promise<{ ok: true; question: FormQuestion } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('form_questions')
    .insert({
      form_id: formId, order_index: input.orderIndex, type: input.type, maps_to: input.mapsTo ?? null,
      custom_field_id: input.customFieldId ?? null, label: input.label, help_text: input.helpText ?? null,
      is_required: input.isRequired, options: input.options ?? null,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? 'Erro ao criar pergunta' };
  return { ok: true, question: mapFormQuestionRow(data) };
}

export async function updateFormQuestion(questionId: string, updates: {
  label?: string; helpText?: string | null; isRequired?: boolean; options?: string[] | null;
  mapsTo?: FormMapsTo | null; customFieldId?: string | null; orderIndex?: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload: Record<string, any> = {};
  if (updates.label !== undefined) payload.label = updates.label;
  if (updates.helpText !== undefined) payload.help_text = updates.helpText;
  if (updates.isRequired !== undefined) payload.is_required = updates.isRequired;
  if (updates.options !== undefined) payload.options = updates.options;
  if (updates.mapsTo !== undefined) payload.maps_to = updates.mapsTo;
  if (updates.customFieldId !== undefined) payload.custom_field_id = updates.customFieldId;
  if (updates.orderIndex !== undefined) payload.order_index = updates.orderIndex;
  const { error } = await supabase.from('form_questions').update(payload).eq('id', questionId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteFormQuestion(questionId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('form_questions').delete().eq('id', questionId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchFormSubmissions(formId: string): Promise<FormSubmission[]> {
  const { data, error } = await supabase
    .from('form_submissions')
    .select('id, form_id, task_id, answers, submitted_by, created_at')
    .eq('form_id', formId)
    .order('created_at', { ascending: false });
  if (error) { console.error('taskRepo.fetchFormSubmissions:', error); throw error; }
  return (data ?? []).map((r: any) => ({
    id: r.id, formId: r.form_id, taskId: r.task_id, answers: r.answers || {},
    submittedBy: r.submitted_by, createdAt: r.created_at,
  }));
}

// Envio de formulário: monta a tarefa a partir das respostas mapeadas,
// cria a tarefa (mesma insertTask usada em qualquer outro lugar do app —
// RLS normal, nada de bypass), grava os campos personalizados mapeados e
// registra a resposta com o task_id resultante (rastreabilidade).
export async function submitForm(input: {
  formId: string; listId: string; questions: FormQuestion[]; answers: Record<string, any>;
  defaultAssigneeId: string; defaultStatus: string; defaultPriority: TaskPriority;
  currentUserId: string;
}): Promise<{ ok: true; taskId: string } | { ok: false; message: string }> {
  let title = '';
  let description = '';
  let assigneeId = input.defaultAssigneeId;
  let priority = input.defaultPriority;
  let startDate = '';
  let dueDate = '';
  const customFieldAnswers: { fieldId: string; value: any }[] = [];

  for (const q of input.questions) {
    const value = input.answers[q.id];
    if (value === undefined || value === null || value === '') continue;
    switch (q.mapsTo) {
      case 'title': title = String(value); break;
      case 'description': description = String(value); break;
      case 'assignee': assigneeId = String(value); break;
      case 'priority': priority = value as TaskPriority; break;
      case 'start_date': startDate = String(value); break;
      case 'due_date': dueDate = String(value); break;
      case 'custom_field': if (q.customFieldId) customFieldAnswers.push({ fieldId: q.customFieldId, value }); break;
      default: break;
    }
  }
  if (!title.trim()) title = 'Nova tarefa via formulário';

  const result = await insertTask({
    title, description, status: input.defaultStatus, priority,
    mainAssigneeId: assigneeId, startDate, dueDate, listId: input.listId, createdBy: input.currentUserId,
  });
  if ('error' in result) return { ok: false, message: result.error };
  const taskId = result.task.id;

  for (const cf of customFieldAnswers) {
    const { error: cfError } = await supabase
      .from('custom_field_values')
      .upsert({ field_id: cf.fieldId, entity_id: taskId, value: cf.value }, { onConflict: 'field_id,entity_id' });
    if (cfError) console.error('taskRepo.submitForm: erro ao salvar campo personalizado', cfError);
  }

  const { error: subError } = await supabase
    .from('form_submissions')
    .insert({ form_id: input.formId, task_id: taskId, answers: input.answers, submitted_by: input.currentUserId });
  if (subError) return { ok: false, message: 'Tarefa criada, mas falha ao registrar a resposta: ' + subError.message };

  return { ok: true, taskId };
}

// ── Whiteboards (issue #191) ─────────────────────────────────────────────────

function mapWhiteboardRow(r: any): WhiteboardDef {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    access: r.access,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
    ownerIds: (r.whiteboard_owners || []).map((o: any) => o.user_id),
    linkedTaskCount: r.whiteboard_tasks?.[0]?.count ?? 0,
  };
}

// Lista SEM o snapshot do canvas (pode ser grande) — só metadados pro Hub.
export async function fetchWhiteboards(includeArchived = false): Promise<WhiteboardDef[]> {
  let q = supabase
    .from('whiteboards')
    .select('id, name, description, access, created_by, created_at, updated_at, archived_at, whiteboard_owners(user_id), whiteboard_tasks(count)')
    .order('updated_at', { ascending: false });
  if (!includeArchived) q = q.is('archived_at', null);
  const { data, error } = await q;
  if (error) { console.error('taskRepo.fetchWhiteboards:', error); throw error; }
  return (data ?? []).map(mapWhiteboardRow);
}

export async function createWhiteboard(input: {
  name: string; description?: string | null; access: WhiteboardAccess; createdBy: string; ownerIds: string[];
}): Promise<{ ok: true; whiteboard: WhiteboardDef } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('whiteboards')
    .insert({ name: input.name, description: input.description ?? null, access: input.access, created_by: input.createdBy })
    .select('id, name, description, access, created_by, created_at, updated_at, archived_at')
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? 'Erro ao criar quadro' };

  const ownerIds = Array.from(new Set(input.ownerIds));
  if (ownerIds.length > 0) {
    const { error: ownersError } = await supabase
      .from('whiteboard_owners')
      .insert(ownerIds.map((userId) => ({ whiteboard_id: data.id, user_id: userId })));
    if (ownersError) return { ok: false, message: ownersError.message };
  }

  return { ok: true, whiteboard: mapWhiteboardRow({ ...data, whiteboard_owners: ownerIds.map((user_id) => ({ user_id })), whiteboard_tasks: [{ count: 0 }] }) };
}

export async function updateWhiteboard(whiteboardId: string, updates: {
  name?: string; description?: string | null; access?: WhiteboardAccess; archivedAt?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.access !== undefined) payload.access = updates.access;
  if (updates.archivedAt !== undefined) payload.archived_at = updates.archivedAt;
  const { error } = await supabase.from('whiteboards').update(payload).eq('id', whiteboardId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateWhiteboardOwners(whiteboardId: string, ownerIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: delError } = await supabase.from('whiteboard_owners').delete().eq('whiteboard_id', whiteboardId);
  if (delError) return { ok: false, message: delError.message };
  const uniqueIds = Array.from(new Set(ownerIds));
  if (uniqueIds.length === 0) return { ok: true };
  const { error: insError } = await supabase
    .from('whiteboard_owners')
    .insert(uniqueIds.map((userId) => ({ whiteboard_id: whiteboardId, user_id: userId })));
  if (insError) return { ok: false, message: insError.message };
  return { ok: true };
}

export async function deleteWhiteboard(whiteboardId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('whiteboards').delete().eq('id', whiteboardId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Snapshot do canvas, buscado só na hora de abrir o quadro (não na listagem).
export async function fetchWhiteboardDocument(whiteboardId: string): Promise<any | null> {
  const { data, error } = await supabase.from('whiteboards').select('document').eq('id', whiteboardId).maybeSingle();
  if (error) { console.error('taskRepo.fetchWhiteboardDocument:', error); throw error; }
  return data?.document ?? null;
}

// Autosave: só grava o snapshot (não mexe em nome/acesso/etc.), qualquer um
// com acesso ao quadro pode salvar (é o ponto central de colaborar nele).
export async function saveWhiteboardDocument(whiteboardId: string, document: any): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('whiteboards').update({ document, updated_at: new Date().toISOString() }).eq('id', whiteboardId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchWhiteboardTaskIds(whiteboardId: string): Promise<string[]> {
  const { data, error } = await supabase.from('whiteboard_tasks').select('task_id').eq('whiteboard_id', whiteboardId);
  if (error) { console.error('taskRepo.fetchWhiteboardTaskIds:', error); throw error; }
  return (data ?? []).map((r: any) => r.task_id);
}

export async function linkWhiteboardTask(whiteboardId: string, taskId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('whiteboard_tasks').insert({ whiteboard_id: whiteboardId, task_id: taskId });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function unlinkWhiteboardTask(whiteboardId: string, taskId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('whiteboard_tasks').delete().eq('whiteboard_id', whiteboardId).eq('task_id', taskId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// ── Mapa Mental (issue #192) — modo "Forma livre" ────────────────────────
// Mesmo padrão de Whiteboards (issue #191): tabela própria + canvas tldraw.
// O modo "Tarefas" não tem funções aqui — é derivado ao vivo de `tasks`
// (já carregadas em memória no App) via parentId, ver moveTaskParent abaixo.

function mapMindMapRow(r: any): MindMapDef {
  return {
    id: r.id, name: r.name, description: r.description, access: r.access,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at, archivedAt: r.archived_at,
    ownerIds: (r.mind_map_owners || []).map((o: any) => o.user_id),
  };
}

export async function fetchMindMaps(includeArchived = false): Promise<MindMapDef[]> {
  let query = supabase.from('mind_maps').select('id, name, description, access, created_by, created_at, updated_at, archived_at, mind_map_owners(user_id)').order('created_at', { ascending: false });
  if (!includeArchived) query = query.is('archived_at', null);
  const { data, error } = await query;
  if (error) { console.error('taskRepo.fetchMindMaps:', error); return []; }
  return (data || []).map(mapMindMapRow);
}

export async function createMindMap(input: { name: string; description?: string | null; access: MindMapAccess; createdBy: string; ownerIds: string[] }): Promise<{ ok: true; mindMap: MindMapDef } | { ok: false; message: string }> {
  const { data, error } = await supabase.from('mind_maps').insert({ name: input.name, description: input.description ?? null, access: input.access, created_by: input.createdBy }).select().single();
  if (error || !data) return { ok: false, message: error?.message || 'Erro desconhecido' };
  if (input.ownerIds.length > 0) {
    const { error: ownersError } = await supabase.from('mind_map_owners').insert(input.ownerIds.map((userId) => ({ mind_map_id: data.id, user_id: userId })));
    if (ownersError) console.error('taskRepo.createMindMap: erro ao definir donos:', ownersError);
  }
  return { ok: true, mindMap: mapMindMapRow({ ...data, mind_map_owners: input.ownerIds.map((id) => ({ user_id: id })) }) };
}

export async function updateMindMap(mindMapId: string, updates: { name?: string; description?: string | null; access?: MindMapAccess; archivedAt?: string | null }): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.access !== undefined) payload.access = updates.access;
  if (updates.archivedAt !== undefined) payload.archived_at = updates.archivedAt;
  const { error } = await supabase.from('mind_maps').update(payload).eq('id', mindMapId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateMindMapOwners(mindMapId: string, ownerIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: delError } = await supabase.from('mind_map_owners').delete().eq('mind_map_id', mindMapId);
  if (delError) return { ok: false, message: delError.message };
  if (ownerIds.length === 0) return { ok: true };
  const { error } = await supabase.from('mind_map_owners').insert(ownerIds.map((userId) => ({ mind_map_id: mindMapId, user_id: userId })));
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteMindMap(mindMapId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('mind_maps').delete().eq('id', mindMapId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchMindMapDocument(mindMapId: string): Promise<any | null> {
  const { data, error } = await supabase.from('mind_maps').select('document').eq('id', mindMapId).single();
  if (error) { console.error('taskRepo.fetchMindMapDocument:', error); return null; }
  return data?.document ?? null;
}

export async function saveMindMapDocument(mindMapId: string, document: any): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('mind_maps').update({ document, updated_at: new Date().toISOString() }).eq('id', mindMapId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// ── Mapa Mental — modo "Tarefas" ─────────────────────────────────────────
// Busca dedicada por lista: o `tasks` já carregado no App só cobre o escopo
// de navegação atual (lista aberta, "Minhas Tarefas" etc.) — o Mapa Mental
// deixa escolher QUALQUER lista acessível, então precisa buscar por conta
// própria em vez de confiar no que já está em memória.
export async function fetchTasksForList(listId: string): Promise<Task[]> {
  const { data, error } = await selectNormalTasks().eq('list_id', listId).order('created_at', { ascending: true });
  if (error) { console.error('taskRepo.fetchTasksForList:', error); return []; }
  return (data || []).map(mapRowToTaskShell);
}

// Reparenta uma tarefa (vira subtarefa de outra, ou vira raiz com null).
// Prevenção de ciclo fica no chamador (App.tsx), que já tem a árvore inteira
// em memória — checar aqui exigiria outra ida ao banco sem necessidade.
export async function moveTaskParent(taskId: string, parentId: string | null): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('tasks').update({ parent_id: parentId }).eq('id', taskId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
