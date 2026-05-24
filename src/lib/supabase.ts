import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL e Anon Key são obrigatórios. Verifique o arquivo .env');
}

// Cliente público (para autenticação de usuários)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'vp-click-user-auth', // Garante que a chave de armazenamento seja única
    },
});

// AVISO: service role key tem acesso irrestrito ao banco.
// Mover para Edge Function ou backend dedicado antes de ir a produção pública.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: 'vp-click-admin-auth', // Evita conflito de instâncias
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
