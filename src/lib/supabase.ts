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
import type { TaskDependency, DependencyType } from '../types';

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
