import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Filter, Layers, X
} from "lucide-react";
import { Task, User, List } from '../../types';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  format, addDays, subDays,
  differenceInDays, eachDayOfInterval, isWeekend, isToday, startOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

type GanttScale = 'day' | 'week' | 'month' | 'quarter';
type GanttGroupBy = 'none' | 'assignee' | 'status' | 'list';

interface GanttFilters {
  assigneeId: string;
  priority: string;
  status: string;
  listId: string;
  tag: string;
  overdueOnly: boolean;
}

const EMPTY_FILTERS: GanttFilters = { assigneeId: '', priority: '', status: '', listId: '', tag: '', overdueOnly: false };

// Densidade padrão (px/dia) de cada escala — o zoom fino (+/-) continua livre
// a partir daí; a escala só define o agrupamento do cabeçalho e o intervalo
// de dias carregado (mês/trimestre precisam enxergar mais dias de uma vez).
const SCALE_CONFIG: Record<GanttScale, { defaultZoom: number; minZoom: number; maxZoom: number; totalDays: number; label: string }> = {
  day: { defaultZoom: 30, minZoom: 15, maxZoom: 100, totalDays: 60, label: 'Dia' },
  week: { defaultZoom: 12, minZoom: 6, maxZoom: 40, totalDays: 180, label: 'Semana' },
  month: { defaultZoom: 4, minZoom: 2, maxZoom: 15, totalDays: 365, label: 'Mês' },
  quarter: { defaultZoom: 1.5, minZoom: 0.8, maxZoom: 6, totalDays: 730, label: 'Trimestre' },
};

const isDoneLikeStatus = (status: string) => {
  const s = (status || '').toLowerCase();
  return s.includes('conclu') || s.includes('aprovado') || s.includes('fechado') || s.includes('done') || s.includes('cancel');
};

interface GanttViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  // Mesmo formato de handleUpdateTask (App.tsx) usado pela TableView, só que
  // aqui o resultado importa: em falha precisamos desfazer a posição/tamanho
  // da barra que já tinha sido movida/redimensionada na tela (ver
  // dateOverrides abaixo — item 6 do Codex_Gantt_01/02: "restaurar as datas
  // anteriores").
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => Promise<boolean> | void;
  users?: User[];
  lists?: List[];
}

// `startDate`/`dueDate` são "YYYY-MM-DD" (sem hora); `new Date(string)`
// interpreta isso como meia-noite UTC, que em fusos atrás de UTC cai no dia
// anterior ao comparar com datas locais. Parseamos/formatamos manualmente
// para não deslocar um dia (mesmo cuidado do resto do app, ver App.tsx).
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type DragMode = 'move' | 'resize-left' | 'resize-right';

interface DragState {
  taskId: string;
  mode: DragMode;
  startX: number;
  originalStart: Date;
  originalEnd: Date;
  currentDeltaDays: number;
}

interface VisualRow {
  type: 'group-header' | 'task';
  key: string;
  groupLabel?: string;
  groupCount?: number;
  task?: Task;
}

export const GanttView: React.FC<GanttViewProps> = ({ tasks, onTaskClick, onUpdateTask, users = [], lists = [] }) => {
  const [scale, setScale] = useState<GanttScale>('day');
  const [zoomLevel, setZoomLevel] = useState(SCALE_CONFIG.day.defaultZoom); // pixels per day
  const [viewStart, setViewStart] = useState(subDays(new Date(), 7));
  const [groupBy, setGroupBy] = useState<GanttGroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<GanttFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sobrepõe otimisticamente as datas de tarefas recém-arrastadas/redimensio-
  // nadas, até `tasks` (prop, vinda do App) refletir a mesma tarefa já
  // salva — ou até a persistência falhar, quando é removido (rollback).
  const [dateOverrides, setDateOverrides] = useState<Record<string, { startDate: string; dueDate: string }>>({});

  const barRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef<Set<string>>(new Set());

  const handleScaleChange = (next: GanttScale) => {
    setScale(next);
    setZoomLevel(SCALE_CONFIG[next].defaultZoom);
  };

  const timelineDays = useMemo(() => {
    return eachDayOfInterval({
      start: viewStart,
      end: addDays(viewStart, SCALE_CONFIG[scale].totalDays),
    });
  }, [viewStart, scale]);

  // Cabeçalho: no dia-a-dia cada célula é um dia; nas escalas mais largas,
  // agrupa os dias em semana/mês/trimestre (célula única, com o rótulo do
  // período) — senão as células diárias ficariam pixels ilegíveis.
  const headerGroups = useMemo(() => {
    if (scale === 'day') return null;
    const keyFn = scale === 'week'
      ? (d: Date) => format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : scale === 'month'
        ? (d: Date) => format(d, 'yyyy-MM')
        : (d: Date) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    const groups: { key: string; days: Date[] }[] = [];
    for (const day of timelineDays) {
      const key = keyFn(day);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.days.push(day);
      else groups.push({ key, days: [day] });
    }
    return groups.map(g => {
      const first = g.days[0];
      const label = scale === 'week'
        ? `Sem ${format(first, 'dd/MM', { locale: ptBR })}`
        : scale === 'month'
          ? format(first, 'MMM yyyy', { locale: ptBR })
          : `T${Math.floor(first.getMonth() / 3) + 1} ${first.getFullYear()}`;
      return { key: g.key, label, width: g.days.length * zoomLevel };
    });
  }, [scale, timelineDays, zoomLevel]);

  // Opções de filtro derivadas das próprias tarefas visíveis — evita precisar
  // de mais props (statusGroups/workspaceTags) só pra listar os valores.
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const tags = new Set<string>();
    tasks.forEach(t => {
      if (t.status) statuses.add(t.status);
      (t.tags || []).forEach(tag => tags.add(tag));
    });
    return { statuses: Array.from(statuses).sort(), tags: Array.from(tags).sort() };
  }, [tasks]);

  const activeFilterCount = Object.values(filters).filter(v => v !== '' && v !== false).length;

  const filteredTasks = useMemo(() => {
    if (activeFilterCount === 0) return tasks;
    const today = formatLocalDate(new Date());
    return tasks.filter(t => {
      if (filters.assigneeId && t.mainAssigneeId !== filters.assigneeId && !t.secondaryAssigneeIds?.includes(filters.assigneeId)) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.listId && t.listId !== filters.listId) return false;
      if (filters.tag && !(t.tags || []).includes(filters.tag)) return false;
      if (filters.overdueOnly && !(t.dueDate && t.dueDate < today && !isDoneLikeStatus(t.status))) return false;
      return true;
    });
  }, [tasks, filters, activeFilterCount]);

  // Agrupamento é só uma projeção visual (Codex_Gantt_06): nunca move a
  // tarefa de lista/pasta nem altera dado nenhum, só decide em que "seção"
  // ela aparece e a ordem das linhas.
  const visualRows = useMemo((): VisualRow[] => {
    if (groupBy === 'none') {
      return filteredTasks.map(t => ({ type: 'task', key: t.id, task: t }));
    }
    const groups = new Map<string, { label: string; tasks: Task[] }>();
    filteredTasks.forEach(t => {
      let key: string;
      let label: string;
      if (groupBy === 'assignee') {
        key = t.mainAssigneeId || '__none__';
        label = users.find(u => u.id === t.mainAssigneeId)?.name || 'Sem responsável';
      } else if (groupBy === 'status') {
        key = t.status || '__none__';
        label = t.status || 'Sem status';
      } else {
        key = t.listId || '__none__';
        label = lists.find(l => l.id === t.listId)?.name || 'Sem lista';
      }
      if (!groups.has(key)) groups.set(key, { label, tasks: [] });
      groups.get(key)!.tasks.push(t);
    });
    const rows: VisualRow[] = [];
    Array.from(groups.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label, 'pt-BR'))
      .forEach(([key, group]) => {
        rows.push({ type: 'group-header', key: `group:${key}`, groupLabel: group.label, groupCount: group.tasks.length });
        if (!collapsedGroups.has(key)) {
          group.tasks.forEach(t => rows.push({ type: 'task', key: t.id, task: t }));
        }
      });
    return rows;
  }, [filteredTasks, groupBy, users, lists, collapsedGroups]);

  const taskRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    visualRows.forEach((row, idx) => { if (row.type === 'task' && row.task) map.set(row.task.id, idx); });
    return map;
  }, [visualRows]);

  const taskBars = useMemo(() => {
    return filteredTasks.filter(t => t.startDate || t.dueDate).map(task => {
      const override = dateOverrides[task.id];
      const startStr = override?.startDate ?? task.startDate;
      const endStr = override?.dueDate ?? task.dueDate;
      const start = startStr ? parseLocalDate(startStr) : parseLocalDate(endStr!);
      const end = endStr ? parseLocalDate(endStr) : parseLocalDate(startStr!);

      const left = differenceInDays(start, viewStart) * zoomLevel;
      const duration = Math.max(1, differenceInDays(end, start) + 1);
      const width = duration * zoomLevel;

      return {
        ...task,
        start,
        end,
        left,
        width,
        isOverlapping: left < 0 && (left + width) < 0
      };
    }).filter(b => !b.isOverlapping);
  }, [filteredTasks, viewStart, zoomLevel, dateOverrides]);

  const persistDates = useCallback(async (taskId: string, newStart: Date, newEnd: Date) => {
    const startDateStr = formatLocalDate(newStart);
    const dueDateStr = formatLocalDate(newEnd);

    // Otimista: aplica local antes de esperar a persistência (o próximo
    // render já mostra a barra na posição/tamanho final).
    setDateOverrides(prev => ({ ...prev, [taskId]: { startDate: startDateStr, dueDate: dueDateStr } }));

    if (!onUpdateTask) return;
    const ok = await onUpdateTask(taskId, { startDate: startDateStr, dueDate: dueDateStr });
    if (ok === false) {
      // Falha de persistência: restaura as datas anteriores (remove o
      // override — a barra volta a refletir `task.startDate/dueDate`, que
      // nunca chegaram a mudar no servidor nem no estado do App).
      setDateOverrides(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }, [onUpdateTask]);

  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const deltaPixels = e.clientX - drag.startX;
    const deltaDays = Math.round(deltaPixels / zoomLevel);
    if (deltaDays === drag.currentDeltaDays) return;
    drag.currentDeltaDays = deltaDays;

    const el = barRefs.current[drag.taskId];
    if (!el) return;

    if (drag.mode === 'move') {
      el.style.transform = `translateX(${deltaDays * zoomLevel}px)`;
    } else if (drag.mode === 'resize-right') {
      const newEnd = addDays(drag.originalEnd, deltaDays);
      const clampedEnd = newEnd < drag.originalStart ? drag.originalStart : newEnd;
      const newDuration = Math.max(1, differenceInDays(clampedEnd, drag.originalStart) + 1);
      el.style.width = `${newDuration * zoomLevel}px`;
    } else if (drag.mode === 'resize-left') {
      const newStart = addDays(drag.originalStart, deltaDays);
      const clampedStart = newStart > drag.originalEnd ? drag.originalEnd : newStart;
      const newDuration = Math.max(1, differenceInDays(drag.originalEnd, clampedStart) + 1);
      el.style.width = `${newDuration * zoomLevel}px`;
      el.style.transform = `translateX(${differenceInDays(clampedStart, drag.originalStart) * zoomLevel}px)`;
    }
  }, [zoomLevel]);

  const handleWindowMouseUp = useCallback(() => {
    const drag = dragStateRef.current;
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
    dragStateRef.current = null;
    if (!drag) return;

    const el = barRefs.current[drag.taskId];
    if (el) {
      el.style.transform = '';
      el.style.width = '';
    }

    if (drag.currentDeltaDays === 0) return; // clique simples, sem arrastar de verdade

    justDraggedRef.current.add(drag.taskId);

    let newStart = drag.originalStart;
    let newEnd = drag.originalEnd;
    if (drag.mode === 'move') {
      newStart = addDays(drag.originalStart, drag.currentDeltaDays);
      newEnd = addDays(drag.originalEnd, drag.currentDeltaDays);
    } else if (drag.mode === 'resize-right') {
      newEnd = addDays(drag.originalEnd, drag.currentDeltaDays);
      if (newEnd < newStart) newEnd = newStart;
    } else if (drag.mode === 'resize-left') {
      newStart = addDays(drag.originalStart, drag.currentDeltaDays);
      if (newStart > newEnd) newStart = newEnd;
    }

    persistDates(drag.taskId, newStart, newEnd);
  }, [handleWindowMouseMove, persistDates]);

  // Segurança: se o componente desmontar (trocou de view) no meio de um
  // arrasto, não deixa listeners de window vivos apontando pra um bar
  // desmontado.
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [handleWindowMouseMove, handleWindowMouseUp]);

  const startDrag = (e: React.MouseEvent, task: Task, mode: DragMode) => {
    if (!onUpdateTask) return; // sem permissão/serviço de update, barra fica só clicável
    e.preventDefault();
    e.stopPropagation();
    const bar = taskBars.find(b => b.id === task.id);
    if (!bar) return;
    dragStateRef.current = {
      taskId: task.id,
      mode,
      startX: e.clientX,
      originalStart: bar.start,
      originalEnd: bar.end,
      currentDeltaDays: 0,
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleBarClick = (taskId: string) => {
    // Suprime o clique que "sobra" logo depois de um arrasto de verdade —
    // sem isso, soltar a barra também abria o modal de detalhe da tarefa.
    if (justDraggedRef.current.has(taskId)) {
      justDraggedRef.current.delete(taskId);
      return;
    }
    onTaskClick(taskId);
  };

  const toggleGroupCollapsed = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const timelineWidth = scale === 'day'
    ? timelineDays.length * zoomLevel
    : (headerGroups || []).reduce((sum, g) => sum + g.width, 0);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Gantt Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setViewStart(subDays(viewStart, 7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewStart(subDays(new Date(), 7))}>Hoje</Button>
          <Button variant="outline" size="sm" onClick={() => setViewStart(addDays(viewStart, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold capitalize">
            {format(viewStart, 'MMMM yyyy', { locale: ptBR })}
          </span>
        </div>

        <div className="flex items-center gap-2">
           <div className="flex items-center bg-muted rounded-lg p-1">
              {(Object.keys(SCALE_CONFIG) as GanttScale[]).map(s => (
                <Button
                  key={s}
                  variant={scale === s ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleScaleChange(s)}
                >
                  {SCALE_CONFIG[s].label}
                </Button>
              ))}
           </div>
           <div className="flex items-center bg-muted rounded-lg p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(Math.max(SCALE_CONFIG[scale].minZoom, zoomLevel - SCALE_CONFIG[scale].defaultZoom * 0.15))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(Math.min(SCALE_CONFIG[scale].maxZoom, zoomLevel + SCALE_CONFIG[scale].defaultZoom * 0.15))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
           </div>

           <select
             value={groupBy}
             onChange={(e) => setGroupBy(e.target.value as GanttGroupBy)}
             className="h-8 text-xs border rounded-md px-2 bg-background"
             title="Agrupar por"
           >
             <option value="none">Sem agrupamento</option>
             <option value="assignee">Responsável</option>
             <option value="status">Status</option>
             <option value="list">Lista</option>
           </select>

           <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
             <PopoverTrigger asChild>
               <Button variant="outline" size="sm" className="gap-1.5">
                 <Filter className="w-4 h-4" /> Filtros
                 {activeFilterCount > 0 && (
                   <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                     {activeFilterCount}
                   </span>
                 )}
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-80 p-3 space-y-2" align="end">
               <div className="flex items-center justify-between">
                 <p className="text-sm font-semibold">Filtros</p>
                 {activeFilterCount > 0 && (
                   <button
                     onClick={() => setFilters(EMPTY_FILTERS)}
                     className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                   >
                     <X className="w-3 h-3" /> Limpar
                   </button>
                 )}
               </div>

               <select
                 value={filters.assigneeId}
                 onChange={(e) => setFilters(f => ({ ...f, assigneeId: e.target.value }))}
                 className="w-full h-8 text-xs border rounded-md px-2 bg-background"
               >
                 <option value="">Responsável (todos)</option>
                 {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
               </select>

               <select
                 value={filters.priority}
                 onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))}
                 className="w-full h-8 text-xs border rounded-md px-2 bg-background"
               >
                 <option value="">Prioridade (todas)</option>
                 <option value="Urgente">Urgente</option>
                 <option value="Alta">Alta</option>
                 <option value="Média">Média</option>
                 <option value="Baixa">Baixa</option>
               </select>

               <select
                 value={filters.status}
                 onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                 className="w-full h-8 text-xs border rounded-md px-2 bg-background"
               >
                 <option value="">Status (todos)</option>
                 {filterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
               </select>

               <select
                 value={filters.listId}
                 onChange={(e) => setFilters(f => ({ ...f, listId: e.target.value }))}
                 className="w-full h-8 text-xs border rounded-md px-2 bg-background"
               >
                 <option value="">Lista (todas)</option>
                 {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
               </select>

               {filterOptions.tags.length > 0 && (
                 <select
                   value={filters.tag}
                   onChange={(e) => setFilters(f => ({ ...f, tag: e.target.value }))}
                   className="w-full h-8 text-xs border rounded-md px-2 bg-background"
                 >
                   <option value="">Tag (todas)</option>
                   {filterOptions.tags.map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
               )}

               <label className="flex items-center gap-2 text-xs pt-1 cursor-pointer">
                 <input
                   type="checkbox"
                   checked={filters.overdueOnly}
                   onChange={(e) => setFilters(f => ({ ...f, overdueOnly: e.target.checked }))}
                 />
                 Só tarefas atrasadas
               </label>
             </PopoverContent>
           </Popover>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Task Labels Sidebar */}
        <div className="w-64 border-r flex flex-col bg-muted/5">
          <div className="h-16 border-b flex items-center px-4 font-semibold text-xs text-muted-foreground uppercase">
            Tarefa
          </div>
          <div className="flex-1 overflow-hidden">
            {visualRows.map(row => row.type === 'group-header' ? (
              <div
                key={row.key}
                className="h-10 border-b flex items-center px-3 text-xs font-semibold bg-muted/40 cursor-pointer select-none gap-1.5"
                onClick={() => toggleGroupCollapsed(row.key.replace(/^group:/, ''))}
              >
                <Layers className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="truncate">{row.groupLabel}</span>
                <span className="text-muted-foreground font-normal shrink-0">({row.groupCount})</span>
              </div>
            ) : (
              <div key={row.key} className="h-10 border-b flex items-center px-4 text-sm truncate hover:bg-muted/10 cursor-pointer transition-colors"
                onClick={() => onTaskClick(row.task!.id)}>
                {row.task!.title}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Grid */}
        <div className="flex-1 overflow-auto relative custom-scrollbar">
          {/* Timeline Header */}
          <div className="h-16 border-b flex sticky top-0 bg-background z-20" style={{ width: timelineWidth }}>
            {scale === 'day' ? timelineDays.map(day => (
              <div key={day.toISOString()}
                className={`flex-shrink-0 border-r text-[10px] flex flex-col items-center justify-center
                  ${isWeekend(day) ? 'bg-muted/30' : ''}
                  ${isToday(day) ? 'bg-primary/5' : ''}
                `}
                style={{ width: zoomLevel }}>
                <span className="text-muted-foreground">{format(day, 'eee', { locale: ptBR })}</span>
                <span className={`font-bold ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</span>
              </div>
            )) : (headerGroups || []).map(g => (
              <div key={g.key}
                className="flex-shrink-0 border-r text-[11px] font-semibold flex items-center justify-center capitalize"
                style={{ width: g.width }}>
                {g.label}
              </div>
            ))}
          </div>

          {/* Timeline Body */}
          <div className="relative" style={{ width: timelineWidth }}>
            {/* Grid Lines — só no dia-a-dia; nas escalas mais largas as linhas
                de grupo (semana/mês/trimestre) já servem de referência visual
                e uma linha por dia ficaria denso demais pra enxergar. */}
            {scale === 'day' && (
              <div className="absolute inset-0 flex pointer-events-none">
                 {timelineDays.map(day => (
                   <div key={`line-${day.toISOString()}`}
                      className={`border-r h-full ${isWeekend(day) ? 'bg-muted/10' : ''} ${isToday(day) ? 'border-primary/20' : ''}`}
                      style={{ width: zoomLevel }}
                   />
                 ))}
              </div>
            )}

            {/* Dependency arrows */}
            <svg
              className="absolute inset-0 pointer-events-none z-0"
              style={{ width: timelineWidth, height: visualRows.length * 40 }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
              </defs>
              {filteredTasks.flatMap((task) => {
                const dependencies = (task as any).dependencies || [];
                const targetIdx = taskRowIndex.get(task.id);
                if (targetIdx === undefined) return [];
                return dependencies.map((dep: any) => {
                  const sourceIdx = taskRowIndex.get(dep.depends_on_id);
                  if (sourceIdx === undefined) return null;

                  const sourceBar = taskBars.find(b => b.id === dep.depends_on_id);
                  const targetBar = taskBars.find(b => b.id === task.id);

                  if (!sourceBar || !targetBar) return null;

                  const x1 = sourceBar.left + sourceBar.width;
                  const y1 = (sourceIdx * 40) + 20; // 40 is row height, 20 is center
                  const x2 = targetBar.left;
                  const y2 = (targetIdx * 40) + 20;

                  // Simple path: ┐ then ┘
                  const midX = x1 + (x2 - x1) / 2;

                  return (
                    <path
                      key={`${dep.depends_on_id}-${task.id}`}
                      d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      markerEnd="url(#arrowhead)"
                      className="transition-all duration-300"
                    />
                  );
                });
              })}
            </svg>

            {/* Bars */}
            <div className="relative z-10 py-1">
              {visualRows.map((row) => {
                if (row.type === 'group-header') {
                  return <div key={row.key} className="h-10 border-b bg-muted/40" />;
                }
                const task = row.task!;
                const bar = taskBars.find(b => b.id === task.id);
                return (
                  <div key={row.key} className="h-10 border-b flex items-center relative group">
                    {bar && (
                      <div
                        ref={(el) => { barRefs.current[task.id] = el; }}
                        className={`absolute h-6 rounded-md shadow-sm flex items-center px-2 text-[10px] text-white font-medium transition-[filter] hover:brightness-110
                          ${onUpdateTask ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                          ${task.priority === 'Urgente' ? 'bg-destructive' : 'bg-primary'}
                        `}
                        style={{ left: bar.left, width: bar.width }}
                        onMouseDown={(e) => startDrag(e, task, 'move')}
                        onClick={() => handleBarClick(task.id)}
                      >
                         <span className="truncate pointer-events-none">{task.title}</span>

                         {/* Handles de redimensionar (início/fim) — só aparecem com
                             permissão de editar (onUpdateTask presente) e no hover,
                             pra manter a barra limpa no resto do tempo. */}
                         {onUpdateTask && (
                           <>
                             <div
                               role="presentation"
                               className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-l-md"
                               onMouseDown={(e) => startDrag(e, task, 'resize-left')}
                             />
                             <div
                               role="presentation"
                               className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-r-md"
                               onMouseDown={(e) => startDrag(e, task, 'resize-right')}
                             />
                           </>
                         )}

                         {/* Pontos de dependência (Codex_Gantt_03 — ainda decorativos) */}
                         <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-primary opacity-0 group-hover:opacity-100 pointer-events-none" />
                         <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-primary opacity-0 group-hover:opacity-100 pointer-events-none" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
