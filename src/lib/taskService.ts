// taskService — regras de NEGÓCIO de tarefas (camada de domínio).
//
// Não toca em React (nada de setState/toast) e não fala snake_case com o banco
// — orquestra o taskRepo e os helpers de dados. Aqui vivem os invariantes e
// decisões de domínio, testáveis isoladamente. O App/hook chama estas funções e
// cuida do estado e da UX.
import { List, StatusGroup } from '../types';
import { isTaskBlocked, hasUnresolvedAssignedComments } from './supabase';

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
