// Extraído de components/views/MyTasksView.tsx pra permitir lazy-loading dessa
// view: App.tsx chama recordRecentTaskId sincronamente (ao abrir uma tarefa),
// então essa função não pode viver só dentro de um módulo carregado sob
// demanda — senão toda abertura de tarefa dispararia o download do chunk da
// MyTasksView, mesmo pra quem nunca visita essa aba.
function recentTasksKey(userId: string) {
  return `vp-click-recent-tasks-${userId}`;
}

/** Lê os ids de tarefa vistos recentemente (gravados pelo App ao abrir uma tarefa). */
export function readRecentTaskIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(recentTasksKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Grava um id de tarefa como "visto recentemente" (mais recente primeiro, sem duplicar, até 15). */
export function recordRecentTaskId(userId: string, taskId: string) {
  try {
    const ids = readRecentTaskIds(userId);
    const next = [taskId, ...ids.filter((id) => id !== taskId)].slice(0, 15);
    localStorage.setItem(recentTasksKey(userId), JSON.stringify(next));
  } catch {
    // localStorage indisponível (modo privado, quota etc.) — não é crítico, ignora.
  }
}
