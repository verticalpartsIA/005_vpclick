import { useState, useEffect, useCallback, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import * as taskRepo from '../lib/taskRepo';

// Para os CONTADORES, "concluído" inclui fechado/cancelado — predicado próprio,
// distinto do isDoneLikeStatus do taskService (que é sobre bloquear o fecho de
// uma tarefa). Mantidos separados de propósito.
const isCountedAsDone = (status: string) => {
  const s = (status || '').toLowerCase();
  return s.includes('conclu') || s.includes('aprovado') || s.includes('fechado') || s.includes('done') || s.includes('cancel');
};

// Índice leve (list_id + status) de TODAS as tarefas visíveis, e os contadores
// por lista derivados dele. Fica fora do escopo ativo de propósito: os badges da
// sidebar e o progresso da SpaceOverview não zeram para listas não carregadas.
// `refreshTaskCountIndex` é exposto para o realtime do App religar a contagem.
export function useTaskCountIndex(session: Session | null, listIds: string[] | null) {
  const [taskCountIndex, setTaskCountIndex] = useState<{ listId: string | null; status: string }[]>([]);

  // Chave estável por conteúdo: evita recarregar a cada render (o chamador passa
  // lists.map(...), que muda de identidade mas não de conteúdo). `null` = sem
  // filtro; string (possivelmente '') = filtrar por essas listas. Ordena para
  // não depender da ordem das listas.
  const listIdsKey = useMemo(
    () => (listIds === null ? null : [...listIds].sort().join(',')),
    [listIds],
  );

  const refreshTaskCountIndex = useCallback(async () => {
    if (!session) return;
    const ids = listIdsKey === null ? null : (listIdsKey ? listIdsKey.split(',') : []);
    setTaskCountIndex(await taskRepo.fetchTaskCountIndex(ids));
  }, [session, listIdsKey]);

  useEffect(() => { refreshTaskCountIndex(); }, [refreshTaskCountIndex]);

  // Badges de tarefas abertas por lista (ClickUp-style).
  const listTaskCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of taskCountIndex) {
      if (!t.listId) continue;
      if (!isCountedAsDone(t.status)) map.set(t.listId, (map.get(t.listId) || 0) + 1);
    }
    return map;
  }, [taskCountIndex]);

  // Progresso { done, total } por lista (Space Overview).
  const listProgressMap = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of taskCountIndex) {
      if (!t.listId) continue;
      const cur = map.get(t.listId) || { done: 0, total: 0 };
      map.set(t.listId, { done: cur.done + (isCountedAsDone(t.status) ? 1 : 0), total: cur.total + 1 });
    }
    return map;
  }, [taskCountIndex]);

  return { listTaskCounts, listProgressMap, refreshTaskCountIndex };
}
