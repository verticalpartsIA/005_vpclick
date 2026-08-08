// taskService — regras de NEGÓCIO de tarefas (camada de domínio).
//
// Não toca em React (nada de setState/toast) e não fala snake_case com o banco
// — orquestra o taskRepo e os helpers de dados. Aqui vivem os invariantes e
// decisões de domínio, testáveis isoladamente. O App/hook chama estas funções e
// cuida do estado e da UX.
import { List, StatusGroup, Task, DuplicateTaskOptions, CustomFieldValue, TaskPriority } from '../types';
import { supabase, isTaskBlocked, hasUnresolvedAssignedComments } from './supabase';
import * as taskRepo from './taskRepo';

// Palavras que fazem um status "contar como concluído" (fechamento, aprovação,
// finalização, cancelamento implícito etc.).
const DONE_KEYWORDS = ['conclu', 'done', 'closed', 'complete', 'finaliz', 'pronto', 'aprovado'];

export function isDoneLikeStatus(status: string): boolean {
  const s = status.toLowerCase();
  return DONE_KEYWORDS.some((kw) => s.includes(kw));
}

// Status inicial de uma tarefa nova: primeiro option do grupo de status da
// lista, ou 'A fazer' como fallback (sem lista, lista inexistente, ou grupo sem
// options).
export function resolveDefaultStatus(
  listId: string | null | undefined,
  lists: List[],
  statusGroups: StatusGroup[],
): string {
  if (!listId) return 'A fazer';
  const list = lists.find((l) => l.id === listId);
  if (!list) return 'A fazer';
  const group = statusGroups.find((g) => g.id === list.statusGroupId);
  if (group && group.options.length > 0) return group.options[0].label;
  return 'A fazer';
}

// Motivo que IMPEDE fechar a tarefa (dependência pendente ou comentário
// atribuído não resolvido), ou null se pode fechar. Invariante compartilhado
// por TODO caminho que grava status direto (edição avulsa, drag no Kanban,
// edição em massa) — se cada um replicasse a regra, um deles a driblaria.
export async function getTaskCloseBlockReason(taskId: string): Promise<string | null> {
  const [bloqueada, temComentarioPendente] = await Promise.all([
    isTaskBlocked(taskId),
    hasUnresolvedAssignedComments(taskId),
  ]);
  if (bloqueada) return 'Esta tarefa está bloqueada por outra que ainda não foi concluída.';
  if (temComentarioPendente) return 'Esta tarefa tem comentários atribuídos ainda não resolvidos.';
  return null;
}

// Copia os custom_field_values de uma entidade para outra. (custom_field_values
// é de outro domínio — fields; acessado aqui só pela orquestração da
// duplicação. Migra para um fieldsRepo no futuro.)
async function copyCustomFields(
  fromEntityId: string,
  toEntityId: string,
  fieldValuesByEntity: (entityId: string) => CustomFieldValue[],
): Promise<{ added: CustomFieldValue[] } | { error: string }> {
  const original = fieldValuesByEntity(fromEntityId);
  if (original.length === 0) return { added: [] };
  const { error } = await supabase.from('custom_field_values').insert(
    original.map((v) => ({ field_id: v.fieldId, entity_id: toEntityId, value: v.value })),
  );
  if (error) return { error: error.message };
  return { added: original.map((v) => ({ ...v, entityId: toEntityId })) };
}

// Constrói o input de clone de uma tarefa a partir das opções de duplicação.
function cloneInputFrom(
  task: Task,
  options: DuplicateTaskOptions,
  fallbackAssigneeId: string,
  createdBy: string,
  parentId: string | null,
  overrides: { title?: string; projectId?: string | null } = {},
): taskRepo.TaskCloneInput {
  return {
    title: overrides.title ?? task.title,
    description: options.includeDescription ? (task.description || '') : '',
    status: task.status,
    priority: options.includePriority ? task.priority : TaskPriority.MEDIA,
    mainAssigneeId: options.includeAssignees ? task.mainAssigneeId : fallbackAssigneeId,
    secondaryAssigneeIds: options.includeAssignees ? (task.secondaryAssigneeIds || []) : [],
    startDate: options.includeDates ? (task.startDate || null) : null,
    dueDate: options.includeDates ? (task.dueDate || null) : null,
    listId: options.listId,
    projectId: overrides.projectId !== undefined ? overrides.projectId : (task.projectId || null),
    parentId,
    tags: options.includeTags ? (task.tags || []) : [],
    createdBy,
  };
}

// Orquestra a duplicação de uma tarefa (e, conforme as opções, subtarefas,
// checklists e custom fields). Devolve as tarefas criadas e os valores de campo
// a adicionar no estado. As regras de UI (validação, toasts, estado otimista)
// ficam no chamador.
export async function duplicateTask(
  sourceTask: Task,
  options: DuplicateTaskOptions,
  ctx: {
    currentUserId: string;
    subtasks: Task[];
    fieldValuesByEntity: (entityId: string) => CustomFieldValue[];
  },
): Promise<{ tasks: Task[]; fieldValues: CustomFieldValue[] } | { error: string }> {
  const cloneRes = await taskRepo.insertTaskClone(
    cloneInputFrom(sourceTask, options, ctx.currentUserId, ctx.currentUserId, null, { title: options.title.trim() }),
  );
  if ('error' in cloneRes) return { error: cloneRes.error };
  const duplicatedTask = cloneRes.task;

  const tasks: Task[] = [duplicatedTask];
  const fieldValues: CustomFieldValue[] = [];

  if (options.includeChecklists) {
    const r = await taskRepo.copyChecklists(sourceTask.id, duplicatedTask.id);
    if ('error' in r) return { error: r.error };
    duplicatedTask.checklists = r.items;
  }
  if (options.includeCustomFields) {
    const cf = await copyCustomFields(sourceTask.id, duplicatedTask.id, ctx.fieldValuesByEntity);
    if ('error' in cf) return { error: cf.error };
    fieldValues.push(...cf.added);
  }

  if (options.includeSubtasks) {
    for (const subtask of ctx.subtasks) {
      const subRes = await taskRepo.insertTaskClone(
        cloneInputFrom(subtask, options, ctx.currentUserId, ctx.currentUserId, duplicatedTask.id, {
          projectId: subtask.projectId || sourceTask.projectId || null,
        }),
      );
      if ('error' in subRes) return { error: `Não foi possível duplicar a subtarefa "${subtask.title}": ${subRes.error}` };
      const dupSub = subRes.task;

      if (options.includeChecklists) {
        const r = await taskRepo.copyChecklists(subtask.id, dupSub.id);
        if ('error' in r) return { error: r.error };
        dupSub.checklists = r.items;
      }
      if (options.includeCustomFields) {
        const cf = await copyCustomFields(subtask.id, dupSub.id, ctx.fieldValuesByEntity);
        if ('error' in cf) return { error: cf.error };
        fieldValues.push(...cf.added);
      }
      tasks.push(dupSub);
    }
  }

  await taskRepo.insertActivity(duplicatedTask.id, ctx.currentUserId, 'TASK_DUPLICATED', sourceTask.id, sourceTask.title);
  return { tasks, fieldValues };
}
