import { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { Task } from '../types';
import * as taskRepo from '../lib/taskRepo';

// Estado do Dashboard global: todas as tarefas visíveis (projeção enxuta, com
// atividades recentes) + a lista de listas para rótulos. Recarrega ao entrar na
// view de Dashboard. É "fino": a carga de dados vive no taskRepo; aqui só mora
// o estado do React e o efeito de disparo.
export function useDashboard(session: Session | null, activeView: string) {
  const [dashboardTasks, setDashboardTasks] = useState<Task[]>([]);
  const [dashboardLists, setDashboardLists] = useState<{ id: string; name: string }[]>([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  const loadDashboardTasks = useCallback(async () => {
    if (!session) return;
    setIsDashboardLoading(true);
    try {
      const { tasks: dashTasks, lists: dashLists } = await taskRepo.fetchDashboardData();
      if (dashTasks.length > 0) {
        setDashboardTasks(dashTasks);
        setDashboardLists(dashLists);
      }
    } catch (err) {
      console.error('Erro ao carregar tarefas para Dashboard:', err);
    } finally {
      setIsDashboardLoading(false);
    }
  }, [session]);

  // Recarrega o Dashboard sempre que a view muda para Dashboard.
  useEffect(() => {
    if (activeView === 'Dashboard') {
      loadDashboardTasks();
    }
  }, [activeView, loadDashboardTasks]);

  return { dashboardTasks, dashboardLists, isDashboardLoading };
}
