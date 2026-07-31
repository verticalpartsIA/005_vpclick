import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL e Anon Key são obrigatórios. Verifique o arquivo .env');
}

// Cliente público (para autenticação de usuários)
// NUNCA crie um cliente com a service_role key aqui: qualquer env VITE_* é
// embutida em texto claro no bundle JS público. Operações privilegiadas
// (auth.admin.*, SSO, bypass de RLS) vivem em Supabase Edge Functions
// (ver supabase/functions/sso-exchange e supabase/functions/admin-user-management).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'vp-click-user-auth', // Garante que a chave de armazenamento seja única
        // Por padrão, o supabase-js serializa auth.getSession()/refresh entre
        // TODAS as abas do mesmo storageKey via navigator.locks (10s de timeout).
        // Uma aba em segundo plano que o navegador throttla (comportamento padrão
        // pra economizar CPU) pode segurar esse lock sem conseguir liberá-lo a
        // tempo — toda aba ATIVA que dependa da mesma chave trava por até 10s e
        // falha com "Acquiring an exclusive Navigator LockManager lock ... timed
        // out" (issues #38, #41). processLock serializa só DENTRO da mesma aba,
        // sem esperar outras abas — elimina esse travamento cruzado. O trade-off
        // aceito: duas abas podem, raramente, tentar renovar o token ao mesmo
        // tempo; o pior caso é uma delas precisar buscar sessão de novo, não um
        // travamento de 10s pro usuário.
        lock: processLock,
    },
});

export default supabase;

// ── Task Dependencies ─────────────────────────────────────
import type { TaskDependency, DependencyType, WorkspaceTag } from '../types';

export async function fetchTaskDependencies(taskId: string): Promise<TaskDependency[]> {
  const { data, error } = await supabase
    .from('task_dependencies')
    .select(`
      *,
      depends_on_task:tasks!depends_on_id (id, title, status, priority)
    `)
    .eq('task_id', taskId);

  if (error) throw error;
  return (data ?? []) as TaskDependency[];
}

export async function addTaskDependency(
  taskId: string,
  dependsOnId: string,
  type: DependencyType,
  createdBy: string
): Promise<TaskDependency> {
  const { data, error } = await supabase
    .from('task_dependencies')
    .insert({ task_id: taskId, depends_on_id: dependsOnId, type, created_by: createdBy })
    .select(`*, depends_on_task:tasks!depends_on_id (id, title, status, priority)`)
    .single();

  if (error) throw error;
  return data as TaskDependency;
}

export async function removeTaskDependency(dependencyId: string): Promise<void> {
  const { error } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('id', dependencyId);

  if (error) throw error;
}

export async function isTaskBlocked(taskId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('task_dependencies')
    .select(`depends_on_task:tasks!depends_on_id (id, status)`)
    .eq('task_id', taskId)
    .eq('type', 'blocked_by');

  if (error || !data) return false;

  return data.some((dep: any) => {
    const status: string = dep.depends_on_task?.status ?? '';
    const doneKeywords = ['conclu', 'done', 'closed', 'complete', 'finaliz', 'pronto', 'aprovado'];
    return !doneKeywords.some(kw => status.toLowerCase().includes(kw));
  });
}

// ── Workspace Tags ─────────────────────────────────────────
export async function fetchWorkspaceTags(workspaceId: string): Promise<WorkspaceTag[]> {
  const { data, error } = await supabase
    .from('workspace_tags')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name');

  if (error) throw error;
  return (data ?? []) as WorkspaceTag[];
}

export async function createWorkspaceTag(
  workspaceId: string,
  name: string,
  color: string,
  createdBy: string
): Promise<WorkspaceTag> {
  const { data, error } = await supabase
    .from('workspace_tags')
    .insert({ workspace_id: workspaceId, name, color, created_by: createdBy })
    .select()
    .single();

  if (error) throw error;
  return data as WorkspaceTag;
}

export async function deleteWorkspaceTag(tagId: string): Promise<void> {
  const { error } = await supabase
    .from('workspace_tags')
    .delete()
    .eq('id', tagId);

  if (error) throw error;
}

export async function updateTaskTags(taskId: string, tagNames: string[]): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ tags: tagNames })
    .eq('id', taskId);

  if (error) throw error;
}

// ── Automations ────────────────────────────────────────────
import type { Automation, AutomationLog } from '../types';

export async function fetchAutomations(workspaceId: string): Promise<Automation[]> {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Automation[];
}

export async function fetchAutomationsByList(listId: string): Promise<Automation[]> {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Automation[];
}

export async function createAutomation(
  automation: Omit<Automation, 'id' | 'run_count' | 'created_at' | 'updated_at'>
): Promise<Automation> {
  const { data, error } = await supabase
    .from('automations')
    .insert(automation)
    .select()
    .single();

  if (error) throw error;
  return data as Automation;
}

export async function updateAutomation(
  id: string,
  changes: Partial<Pick<Automation, 'name' | 'enabled' | 'trigger_type' | 'trigger_config' | 'conditions' | 'actions'>>
): Promise<void> {
  const { error } = await supabase
    .from('automations')
    .update(changes)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAutomation(id: string): Promise<void> {
  const { error } = await supabase
    .from('automations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchAutomationLogs(
  automationId: string,
  limit = 50
): Promise<AutomationLog[]> {
  const { data, error } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('automation_id', automationId)
    .order('executed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AutomationLog[];
}
