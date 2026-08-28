import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Filter, X, Pencil
} from "lucide-react";
import { Task, User, List, StatusGroup, TaskPriority, UserRole } from '../../types';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay,
  eachDayOfInterval, getDay, differenceInDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

type CalendarViewMode = 'month' | 'week' | 'day';

interface CalendarFilters {
  assigneeId: string;
  priority: string;
  status: string;
  tag: string;
  overdueOnly: boolean;
}
const EMPTY_FILTERS: CalendarFilters = { assigneeId: '', priority: '', status: '', tag: '', overdueOnly: false };

const isDoneLikeStatus = (status: string) => {
  const s = (status || '').toLowerCase();
  return s.includes('conclu') || s.includes('aprovado') || s.includes('fechado') || s.includes('done') || s.includes('cancel');
};

// `startDate`/`dueDate` são "YYYY-MM-DD" (sem hora); `new Date(string)`
// interpreta isso como meia-noite UTC, que em fusos atrás de UTC cai no dia
// anterior ao comparar com datas locais. Parseamos/formatamos manualmente
// para não deslocar um dia (mesmo cuidado do resto do app, ver GanttView).
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

// Não tenta desenhar um intervalo de anos (dado incoerente) em centenas de
// células — protege o grid contra travar por causa de uma data mal digitada.
const MAX_RANGE_DAYS = 366;

interface TaskRange { task: Task; start: Date; end: Date; }

interface CalendarViewProps {
  tasks: Task[];
  users: User[];
  onTaskClick: (taskId: string) => void;
  // Fluxo completo existente (abre o modal de tarefa com a data pré-
  // preenchida) — mantido como alternativa de descoberta e único jeito de
  // criar fora de um list/contexto único (Codex_Calendario_05: "não
  // substituir o modal completo").
  onAddTaskAtDate: (date: Date) => void;
  // Criação rápida (Codex_Calendario_05): só título, direto no dia. Só
  // oferecida quando há uma lista ativa inequívoca (activeListId) — evita
  // criar tarefa num contexto arbitrário quando o calendário agrega várias
  // listas (espaço/pasta/global).
  onCreateTask?: (data: Partial<Task>) => Promise<void> | void;
  // Mesmo contrato de handleUpdateTask (App.tsx) usado pelo GanttView: drag
  // (Codex_Calendario_01) e edição rápida (Codex_Calendario_06) precisam do
  // resultado pra decidir rollback.
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => Promise<boolean> | void;
  lists?: List[];
  statusGroups?: StatusGroup[];
  activeListId?: string | null;
  currentUser?: User;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  users,
  onTaskClick,
  onAddTaskAtDate,
  onCreateTask,
  onUpdateTask,
  lists = [],
  statusGroups = [],
  activeListId = null,
  currentUser,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Drag & drop entre dias (Codex_Calendario_01).
  const draggingTaskIdRef = useRef<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  // Sobrepõe otimisticamente o dueDate de uma tarefa recém-arrastada/editada,
  // até `tasks` (prop) refletir o mesmo valor já salvo — ou até a
  // persistência falhar, quando é removido (rollback). Mesmo padrão do
  // `dateOverrides` do GanttView.
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});

  // Criação rápida (Codex_Calendario_05) — só título, no dia clicado.
  const [quickCreateDay, setQuickCreateDay] = useState<string | null>(null);
  const [quickCreateTitle, setQuickCreateTitle] = useState('');

  // Edição rápida (Codex_Calendario_06) — sem sair do calendário nem abrir
  // o modal completo (que continua disponível clicando na tarefa).
  const [quickEditTaskId, setQuickEditTaskId] = useState<string | null>(null);
  const [quickDraft, setQuickDraft] = useState<{
    title: string; priority: TaskPriority; mainAssigneeId: string; status: string; dueDate: string;
  } | null>(null);
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);

  const canEditTask = (task: Task) => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GESTOR) return true;
    return task.mainAssigneeId === currentUser.id || (task.secondaryAssigneeIds || []).includes(currentUser.id);
  };

  // ── Filtros (Codex_Calendario_04) ─────────────────────────────────────
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
      if (filters.tag && !(t.tags || []).includes(filters.tag)) return false;
      if (filters.overdueOnly && !(t.dueDate && t.dueDate < today && !isDoneLikeStatus(t.status))) return false;
      return true;
    });
  }, [tasks, filters, activeFilterCount]);

  // ── Intervalo startDate/dueDate (Codex_Calendario_03) ─────────────────
  // Tarefa só com dueDate: comportamento atual (1 dia). Só com startDate:
  // também 1 dia, na própria startDate. Com os dois: aparece em cada dia do
  // intervalo (inclusive) — é isso que dá a "continuidade visual" entre
  // dias/semanas/meses no grid.
  const taskRanges = useMemo((): TaskRange[] => {
    const ranges: TaskRange[] = [];
    filteredTasks.forEach(task => {
      const dueStr = dateOverrides[task.id] ?? task.dueDate;
      const startStr = task.startDate;
      if (!dueStr && !startStr) return;
      const end = dueStr ? parseLocalDate(dueStr) : parseLocalDate(startStr!);
      const start = startStr ? parseLocalDate(startStr) : end;
      // Dado inconsistente (início depois do fim) ou override de drag que
      // ficou "antes" do início original: não trava, só normaliza a ordem.
      const [rangeStart, rangeEnd] = start <= end ? [start, end] : [end, start];
      if (differenceInDays(rangeEnd, rangeStart) > MAX_RANGE_DAYS) return;
      ranges.push({ task, start: rangeStart, end: rangeEnd });
    });
    return ranges;
  }, [filteredTasks, dateOverrides]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskRange[]>();
    taskRanges.forEach(range => {
      eachDayOfInterval({ start: range.start, end: range.end }).forEach(d => {
        const key = formatLocalDate(d);
        const list = map.get(key);
        if (list) list.push(range); else map.set(key, [range]);
      });
    });
    return map;
  }, [taskRanges]);

  const getDayRanges = (day: Date) => tasksByDay.get(formatLocalDate(day)) || [];

  // ── Visões Mês/Semana/Dia (Codex_Calendario_02) ───────────────────────
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const monthDays = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) }),
    [monthStart, monthEnd]
  );
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const goToPrevious = () => {
    if (viewMode === 'month') setCurrentDate(d => subMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subDays(d, 1));
  };
  const goToNext = () => {
    if (viewMode === 'month') setCurrentDate(d => addMonths(d, 1));
    else if (viewMode === 'week') setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addDays(d, 1));
  };
  const goToToday = () => setCurrentDate(new Date());

  const headerLabel = viewMode === 'day'
    ? format(currentDate, "d 'de' MMMM yyyy", { locale: ptBR })
    : viewMode === 'week'
      ? `${format(weekStart, 'd MMM', { locale: ptBR })} – ${format(weekEnd, 'd MMM yyyy', { locale: ptBR })}`
      : format(currentDate, 'MMMM yyyy', { locale: ptBR });

  // ── Drag & drop (Codex_Calendario_01) ──────────────────────────────────
  const handleTaskDragStart = (e: React.DragEvent, task: Task) => {
    if (!onUpdateTask || !canEditTask(task)) return;
    draggingTaskIdRef.current = task.id;
    setDraggingTaskId(task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const finishDrag = () => {
    draggingTaskIdRef.current = null;
    setDraggingTaskId(null);
    setDragOverDay(null);
  };

  const handleDayDragOver = (e: React.DragEvent, day: Date) => {
    if (!draggingTaskIdRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const key = formatLocalDate(day);
    setDragOverDay(prev => (prev === key ? prev : key));
  };

  const handleDayDrop = async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const taskId = draggingTaskIdRef.current || e.dataTransfer.getData('text/plain');
    finishDrag();
    const task = tasks.find(t => t.id === taskId);
    if (!task || !onUpdateTask || !canEditTask(task)) return;

    const newDueDate = formatLocalDate(day);
    if ((dateOverrides[taskId] ?? task.dueDate) === newDueDate) return; // soltou no mesmo dia

    const previousOverride = dateOverrides[taskId];
    setDateOverrides(prev => ({ ...prev, [taskId]: newDueDate }));
    const ok = await onUpdateTask(taskId, { dueDate: newDueDate });
    if (ok === false) {
      setDateOverrides(prev => {
        const next = { ...prev };
        if (previousOverride !== undefined) next[taskId] = previousOverride; else delete next[taskId];
        return next;
      });
    }
  };

  // ── Criação rápida (Codex_Calendario_05) ───────────────────────────────
  const openQuickCreate = (day: Date) => {
    if (!activeListId || !onCreateTask) return;
    setQuickCreateDay(formatLocalDate(day));
    setQuickCreateTitle('');
  };
  const closeQuickCreate = () => {
    setQuickCreateDay(null);
    setQuickCreateTitle('');
  };
  const confirmQuickCreate = async () => {
    const title = quickCreateTitle.trim();
    const day = quickCreateDay;
    closeQuickCreate();
    if (!title || !day || !onCreateTask || !activeListId) return;
    await onCreateTask({ title, dueDate: day, listId: activeListId });
  };

  // ── Edição rápida (Codex_Calendario_06) ────────────────────────────────
  // Escopa o status ao workflow (status group) da lista da própria tarefa —
  // mesmo raciocínio/achado do review aplicado no GanttView: usar
  // `filterOptions.statuses` (todas as listas visíveis) deixava salvar um
  // status de outro workflow, e a tarefa sumia do Kanban da sua lista.
  const quickEditStatusOptions = useMemo(() => {
    if (!quickEditTaskId) return [];
    const task = tasks.find(t => t.id === quickEditTaskId);
    const list = task ? lists.find(l => l.id === task.listId) : undefined;
    const group = list ? statusGroups.find(g => g.id === list.statusGroupId) : undefined;
    const labels = group ? group.options.map(o => o.label) : [];
    return quickDraft && !labels.includes(quickDraft.status) ? [quickDraft.status, ...labels] : labels;
  }, [quickEditTaskId, tasks, lists, statusGroups, quickDraft]);

  const openQuickEdit = (task: Task) => {
    if (!onUpdateTask || !canEditTask(task)) return;
    setQuickEditTaskId(task.id);
    setQuickDraft({
      title: task.title,
      priority: task.priority,
      mainAssigneeId: task.mainAssigneeId || '',
      status: task.status,
      dueDate: dateOverrides[task.id] ?? task.dueDate ?? '',
    });
  };
  const closeQuickEdit = () => {
    setQuickEditTaskId(null);
    setQuickDraft(null);
  };
  const saveQuickEdit = async () => {
    if (!quickDraft || !quickEditTaskId || savingQuickEdit || !onUpdateTask) return;
    const title = quickDraft.title.trim();
    if (!title) return;

    const taskId = quickEditTaskId;
    const previousOverride = dateOverrides[taskId];
    if (quickDraft.dueDate) {
      setDateOverrides(prev => ({ ...prev, [taskId]: quickDraft.dueDate }));
    }

    setSavingQuickEdit(true);
    const ok = await onUpdateTask(taskId, {
      title,
      priority: quickDraft.priority,
      mainAssigneeId: quickDraft.mainAssigneeId,
      status: quickDraft.status,
      dueDate: quickDraft.dueDate,
    });
    setSavingQuickEdit(false);

    if (ok === false) {
      setDateOverrides(prev => {
        const next = { ...prev };
        if (previousOverride !== undefined) next[taskId] = previousOverride; else delete next[taskId];
        return next;
      });
      return;
    }
    closeQuickEdit();
  };

  // ── Render de uma tarefa (chip) ────────────────────────────────────────
  // `standalone` (visão Dia) não tem grade de dias vizinhos pra "continuar"
  // visualmente — sempre arredondado, com o intervalo indicado por texto.
  const renderTaskChip = (task: Task, day: Date, start: Date, end: Date, standalone = false) => {
    const isRangeStart = isSameDay(day, start);
    const isRangeEnd = isSameDay(day, end);
    const isMultiDay = !isSameDay(start, end);
    const isRowStart = !standalone && getDay(day) === 0;
    const isRowEnd = !standalone && getDay(day) === 6;
    const connectsLeft = !standalone && !isRangeStart && !isRowStart;
    const connectsRight = !standalone && !isRangeEnd && !isRowEnd;
    const editable = !!onUpdateTask && canEditTask(task);
    const isDone = isDoneLikeStatus(task.status);

    return (
      <div
        key={`${task.id}-${formatLocalDate(day)}`}
        draggable={editable}
        onDragStart={(e) => handleTaskDragStart(e, task)}
        onDragEnd={finishDrag}
        onClick={(e) => { e.stopPropagation(); onTaskClick(task.id); }}
        title={isMultiDay ? `${task.title} (${format(start, 'dd/MM')} – ${format(end, 'dd/MM')})` : task.title}
        className={`text-[11px] p-1.5 border border-l-4 truncate transition-all relative group/chip
          ${editable ? 'cursor-grab active:cursor-grabbing hover:scale-[1.02]' : 'cursor-pointer'}
          ${connectsLeft ? '-ml-2 pl-3 rounded-l-none border-l-0' : 'rounded-l-md'}
          ${connectsRight ? '-mr-2 rounded-r-none' : 'rounded-r-md'}
          ${draggingTaskId === task.id ? 'opacity-40' : ''}
          ${task.priority === 'Urgente' ? 'border-destructive bg-destructive/5 text-destructive-foreground' :
            task.priority === 'Alta' ? 'border-orange-500 bg-orange-500/5 text-orange-700' :
            'border-primary bg-primary/5 text-primary-foreground'}
        `}
      >
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDone ? 'bg-green-500' : 'bg-blue-500'}`} />
          <span className={isDone ? 'line-through opacity-70' : ''}>{task.title}</span>
        </div>
        {standalone && isMultiDay && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {format(start, 'dd/MM', { locale: ptBR })} – {format(end, 'dd/MM', { locale: ptBR })}
          </div>
        )}

        {editable && (
          <Popover open={quickEditTaskId === task.id} onOpenChange={(open) => { if (!open) closeQuickEdit(); }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="absolute -top-1.5 right-0.5 hidden group-hover/chip:flex h-4 w-4 items-center justify-center rounded-full border bg-white text-gray-500 shadow-sm hover:text-gray-900 z-10"
                title="Edição rápida"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); openQuickEdit(task); }}
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-3 space-y-2"
              align="start"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {quickDraft && quickEditTaskId === task.id && (
                <>
                  <input
                    autoFocus
                    value={quickDraft.title}
                    onChange={(e) => setQuickDraft({ ...quickDraft, title: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveQuickEdit(); }}
                    className="w-full h-8 text-sm font-medium border rounded-md px-2"
                    placeholder="Título da tarefa"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={quickDraft.priority}
                      onChange={(e) => setQuickDraft({ ...quickDraft, priority: e.target.value as TaskPriority })}
                      className="h-8 text-xs border rounded-md px-2"
                    >
                      {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select
                      value={quickDraft.status}
                      onChange={(e) => setQuickDraft({ ...quickDraft, status: e.target.value })}
                      className="h-8 text-xs border rounded-md px-2"
                    >
                      {quickEditStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <select
                    value={quickDraft.mainAssigneeId}
                    onChange={(e) => setQuickDraft({ ...quickDraft, mainAssigneeId: e.target.value })}
                    className="w-full h-8 text-xs border rounded-md px-2"
                  >
                    <option value="">Sem responsável</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input
                    type="date"
                    value={quickDraft.dueDate}
                    onChange={(e) => setQuickDraft({ ...quickDraft, dueDate: e.target.value })}
                    className="w-full h-8 text-xs border rounded-md px-2"
                    title="Prazo"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeQuickEdit}>Cancelar</Button>
                    <Button size="sm" className="h-7 text-xs" disabled={savingQuickEdit || !quickDraft.title.trim()} onClick={saveQuickEdit}>
                      {savingQuickEdit ? 'Salvando…' : 'Salvar'}
                    </Button>
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  };

  // ── Render de uma célula-dia (Mês/Semana) ──────────────────────────────
  const renderDayCell = (day: Date) => {
    const dayRanges = getDayRanges(day);
    const isToday = isSameDay(day, new Date());
    const isCurrentMonth = viewMode !== 'month' || isSameMonth(day, monthStart);
    const dayKey = formatLocalDate(day);
    const isDragOver = dragOverDay === dayKey;
    const canQuickCreateHere = !!activeListId && !!onCreateTask;

    return (
      <div
        key={dayKey}
        className={`${viewMode === 'week' ? 'min-h-[360px]' : 'min-h-[140px]'} border-b border-r p-2 flex flex-col gap-1 transition-colors relative group
          ${!isCurrentMonth ? 'bg-muted/10 text-muted-foreground/50' : 'bg-background'}
          ${isDragOver ? 'bg-primary/10 ring-2 ring-inset ring-primary' : 'hover:bg-muted/20'}
        `}
        onDoubleClick={() => onAddTaskAtDate(day)}
        onDragOver={(e) => handleDayDragOver(e, day)}
        onDragLeave={() => setDragOverDay(prev => (prev === dayKey ? null : prev))}
        onDrop={(e) => handleDayDrop(e, day)}
      >
        <div className="flex justify-between items-start mb-1">
          <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
            ${isToday ? 'bg-primary text-primary-foreground' : ''}
          `}>
            {format(day, 'd')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            title={canQuickCreateHere ? 'Criar tarefa rápida' : 'Criar tarefa'}
            onClick={() => (canQuickCreateHere ? openQuickCreate(day) : onAddTaskAtDate(day))}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {quickCreateDay === dayKey && (
          <input
            autoFocus
            value={quickCreateTitle}
            onChange={(e) => setQuickCreateTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmQuickCreate();
              if (e.key === 'Escape') closeQuickCreate();
            }}
            onBlur={confirmQuickCreate}
            onClick={(e) => e.stopPropagation()}
            placeholder="Título da tarefa…"
            className="text-[11px] px-1.5 py-1 rounded border w-full outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
          {dayRanges.map(({ task, start, end }) => renderTaskChip(task, day, start, end))}
        </div>
      </div>
    );
  };

  // ── Render da visão Dia ─────────────────────────────────────────────────
  const renderDayView = () => {
    const day = currentDate;
    const dayKey = formatLocalDate(day);
    const dayRanges = getDayRanges(day);
    const isDragOver = dragOverDay === dayKey;
    const canQuickCreateHere = !!activeListId && !!onCreateTask;

    return (
      <div className="flex-1 overflow-auto p-4">
        <div
          className={`min-h-[240px] rounded-lg border-2 border-dashed p-3 transition-colors
            ${isDragOver ? 'border-primary bg-primary/5' : 'border-transparent'}
          `}
          onDragOver={(e) => handleDayDragOver(e, day)}
          onDragLeave={() => setDragOverDay(prev => (prev === dayKey ? null : prev))}
          onDrop={(e) => handleDayDrop(e, day)}
        >
          {quickCreateDay === dayKey ? (
            <input
              autoFocus
              value={quickCreateTitle}
              onChange={(e) => setQuickCreateTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmQuickCreate();
                if (e.key === 'Escape') closeQuickCreate();
              }}
              onBlur={confirmQuickCreate}
              placeholder="Título da nova tarefa…"
              className="w-full mb-3 px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <button
              onClick={() => (canQuickCreateHere ? openQuickCreate(day) : onAddTaskAtDate(day))}
              className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-4 h-4" /> {canQuickCreateHere ? 'Criar tarefa neste dia' : 'Criar tarefa'}
            </button>
          )}

          {dayRanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa neste dia.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dayRanges.map(({ task, start, end }) => renderTaskChip(task, day, start, end, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const visibleDays = viewMode === 'month' ? monthDays : weekDays;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Calendar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold capitalize">{headerLabel}</h2>
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={goToPrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-3 hover:bg-background" onClick={goToToday}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={goToNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-1 mr-4">
            {(['month', 'week', 'day'] as CalendarViewMode[]).map(m => (
              <Button
                key={m}
                variant="ghost"
                size="sm"
                className={`h-8 px-3 ${viewMode === m ? 'bg-background shadow-sm' : ''}`}
                onClick={() => setViewMode(m)}
              >
                {m === 'month' ? 'Mês' : m === 'week' ? 'Semana' : 'Dia'}
              </Button>
            ))}
          </div>

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

          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => onAddTaskAtDate(currentDate)}>
            <Plus className="w-4 h-4 mr-2" /> Tarefa
          </Button>
        </div>
      </div>

      {viewMode !== 'day' && (
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground uppercase">
              {day}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'day' ? (
        renderDayView()
      ) : (
        <div className={`flex-1 overflow-auto grid grid-cols-7 ${viewMode === 'month' ? 'auto-rows-fr' : ''}`}>
          {visibleDays.map(day => renderDayCell(day))}
        </div>
      )}
    </div>
  );
};
