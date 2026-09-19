import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  Columns3,
  Copy,
  Filter,
  FolderOpen,
  GripVertical,
  Layers,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Tags,
  Trash2,
  UserCircle,
  X,
} from 'lucide-react';
import {
  CustomField,
  CustomFieldType,
  CustomFieldValue,
  Folder,
  List,
  Space,
  StatusGroup,
  Task,
  TaskPriority,
  User,
  UserRole,
  WorkspaceTag,
} from '../../types';
import { TagBadge } from '@/components/TagBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
// DateFieldEditor exibe/edita SEMPRE em dd/mm/aaaa, independente do locale
// do navegador — ao contrário de um <input type="date"> cru, que muda de
// formato conforme o locale (dd/mm no navegador em pt-BR, mm/dd em en-US).
// Ver issue #102, achado 1.
import { DateFieldEditor } from '@/components/DateFieldEditor';
import { parseLocalDate, formatDateBR } from '@/lib/dates';
import { supabase, reorderTasksInList } from '@/lib/supabase';
import * as taskRepo from '@/lib/taskRepo';
import { useIsMobile } from '@/hooks/use-mobile';

interface TableViewProps {
  tasks: Task[];
  allTasks?: Task[];
  customFields: CustomField[];
  fieldValues: CustomFieldValue[];
  users: User[];
  lists?: List[];
  folders?: Folder[];
  spaces?: Space[];
  activeListId?: string | null;
  activeScope?: { type: string; id: string | null; name: string };
  currentUser?: User;
  statusGroups?: StatusGroup[];
  onTaskClick: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void | boolean | Promise<void | boolean>;
  onUpdateFieldValue: (fieldId: string, taskId: string, value: any) => void | Promise<void>;
  onCreateTask?: (task: Partial<Task>) => void | Promise<void>;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (task: Task) => void;
  onBulkStatusChange?: (taskIds: string[], status: string) => void | Promise<void>;
  onBulkPriorityChange?: (taskIds: string[], priority: TaskPriority) => void | Promise<void>;
  onBulkMove?: (taskIds: string[], listId: string) => void | Promise<void>;
  onBulkDelete?: (taskIds: string[]) => void;
  workspaceTags?: WorkspaceTag[];
  hiddenTaskFieldIdsByList?: Record<string, string[]>;
  onHideTaskFieldForList?: (listId: string, fieldId: string) => void;
  // Issues #137/#143/#162/#163: `null` = acesso total (admin, mesmo
  // sentinela usado em App.tsx); um Set = ids de pasta liberados pro
  // usuário (via espaço ou pasta concedida direto). Usado só pra ESCONDER
  // ações que a RLS já bloquearia de qualquer jeito — nunca é a fonte de
  // verdade de permissão, só evita cliques que dariam em erro.
  allowedFolderIdSet?: Set<string> | null;
}

type ColumnDef = {
  id: string;
  label: string;
  kind: 'system' | 'context' | 'custom';
  required?: boolean;
  defaultWidth: number;
};

type TablePrefs = {
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  columnOrder: string[];
  stickyTitle: boolean;
  density: 'compact' | 'comfortable';
};

const DEFAULT_COLUMNS = ['title', 'status', 'priority', 'assignee', 'dueDate'];
// Issue #144: recorte de colunas mostrado abaixo do breakpoint mobile, além
// das colunas `required` (hoje só "title"). Ver uso em `effectiveVisibleColumns`.
const MOBILE_ESSENTIAL_COLUMNS = ['status', 'priority', 'dueDate'];
const DEFAULT_WIDTHS: Record<string, number> = {
  title: 320,
  status: 150,
  priority: 130,
  assignee: 190,
  dueDate: 150,
  tags: 210,
  space: 160,
  folder: 170,
  list: 180,
};

const PRIORITY_VALUES = Object.values(TaskPriority);
const PRIORITY_ORDER: Record<string, number> = {
  [TaskPriority.URGENTE]: 0,
  [TaskPriority.ALTA]: 1,
  [TaskPriority.MEDIA]: 2,
  [TaskPriority.BAIXA]: 3,
};

// parseLocalDate/formatDateBR agora vivem em lib/dates (issue #102, achado
// 3) — mantemos aqui só o wrapper com guarda de nulo que isOverdue e o
// filtro "próximos 7 dias" abaixo já esperam.
const parseDate = (value?: string) => (value ? parseLocalDate(value) : null);

const formatDate = (value?: string) => formatDateBR(value) || '-';

const toInputDate = (value?: string) => value?.split('T')[0] || '';

const isOverdue = (task: Task) => {
  const due = parseDate(task.dueDate);
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(23, 59, 59, 999);
  return due < today && !task.status?.toLowerCase().includes('conclu');
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Issue #165: filtro de contexto (Space/Pasta/Lista) combin\u00e1vel com os
// demais filtros da Tabela, independente de qual seja o "escopo" ativo
// (contexto atual, agregado, ou a sele\u00e7\u00e3o manual de listas abaixo). Extra\u00edda
// como fun\u00e7\u00e3o pura (em vez de inline no useMemo de displayedTasks) pra dar
// pra testar sem montar o componente inteiro.
export function taskMatchesContextFilters(
  context: { list?: { id: string } | null; folder?: { id: string } | null; space?: { id: string } | null },
  filters: { spaceId?: string; folderId?: string; listId?: string }
): boolean {
  if (filters.listId && context.list?.id !== filters.listId) return false;
  if (filters.folderId && context.folder?.id !== filters.folderId) return false;
  if (filters.spaceId && context.space?.id !== filters.spaceId) return false;
  return true;
}

// Issue #165: resolve o conjunto de tarefas do escopo ativo. Uma sele\u00e7\u00e3o
// manual de listas espec\u00edficas (`multiListIds` n\u00e3o vazio) tem prioridade
// sobre o `scopeId` cl\u00e1ssico (Contexto atual/Todos os contextos/Space/
// Pasta/Lista) \u2014 os dois mecanismos n\u00e3o se combinam, escolher listas
// espec\u00edficas substitui o escopo hier\u00e1rquico enquanto estiver ativo.
export function resolveScopedTasks<T>(
  scopeId: string,
  scopeOptions: { id: string; taskSource: T[] }[],
  fallbackTasks: T[],
  multiListIds: string[],
  multiListTasks: T[]
): T[] {
  if (multiListIds.length > 0) return multiListTasks;
  return scopeOptions.find((option) => option.id === scopeId)?.taskSource ?? fallbackTasks;
}

export const TableView: React.FC<TableViewProps> = ({
  tasks,
  allTasks,
  customFields,
  fieldValues,
  users,
  lists = [],
  folders = [],
  spaces = [],
  activeListId = null,
  activeScope,
  currentUser,
  statusGroups = [],
  onTaskClick,
  onUpdateTask,
  onUpdateFieldValue,
  onCreateTask,
  onDeleteTask,
  onDuplicateTask,
  onBulkStatusChange,
  onBulkPriorityChange,
  onBulkMove,
  onBulkDelete,
  workspaceTags = [],
  hiddenTaskFieldIdsByList = {},
  onHideTaskFieldForList,
  allowedFolderIdSet = null,
}) => {
  const scopeOptions = useMemo(() => {
    const source = allTasks || tasks;
    const options: { id: string; label: string; taskSource: Task[] }[] = [
      { id: 'current', label: activeScope?.name || 'Contexto atual', taskSource: tasks },
    ];

    if (source.length > tasks.length) {
      options.push({ id: 'all', label: 'Todos os contextos autorizados', taskSource: source });
    }

    spaces.forEach((space) => {
      const folderIds = folders.filter((folder) => folder.spaceId === space.id).map((folder) => folder.id);
      const listIds = lists.filter((list) => folderIds.includes(list.folderId)).map((list) => list.id);
      const taskSource = source.filter((task) => listIds.includes(task.listId));
      if (taskSource.length > 0) options.push({ id: `space:${space.id}`, label: `Space: ${space.name}`, taskSource });
    });

    folders.forEach((folder) => {
      const listIds = lists.filter((list) => list.folderId === folder.id).map((list) => list.id);
      const taskSource = source.filter((task) => listIds.includes(task.listId));
      if (taskSource.length > 0) options.push({ id: `folder:${folder.id}`, label: `Pasta: ${folder.name}`, taskSource });
    });

    lists.forEach((list) => {
      const taskSource = source.filter((task) => task.listId === list.id);
      if (taskSource.length > 0 || list.id === activeListId) options.push({ id: `list:${list.id}`, label: `Lista: ${list.name}`, taskSource });
    });

    return options.filter((option, index, arr) => arr.findIndex((item) => item.id === option.id) === index);
  }, [activeListId, activeScope?.name, allTasks, folders, lists, spaces, tasks]);

  const [scopeId, setScopeId] = useState(activeListId ? `list:${activeListId}` : 'current');

  useEffect(() => {
    setScopeId(activeListId ? `list:${activeListId}` : 'current');
  }, [activeListId, activeScope?.id, activeScope?.type]);

  // Issue #165: "Listas específicas" — multi-seleção arbitrária de Lists,
  // sem depender de compartilharem Space/Pasta. Diferente do escopo
  // hierárquico acima (que só reagrupa tarefas já carregadas pela navegação
  // atual em `tasks`/`allTasks`), busca as tarefas dessas listas direto do
  // Supabase, então funciona mesmo pra listas fora do contexto de navegação
  // atual. RLS (tasks_select) filtra o resultado normalmente — pedir uma
  // lista sem acesso simplesmente não traz linha nenhuma dela, não é um
  // buraco de segurança novo.
  const [multiListIds, setMultiListIds] = useState<string[]>([]);
  const [multiListSearch, setMultiListSearch] = useState('');
  const [multiListTasks, setMultiListTasks] = useState<Task[]>([]);
  const [isMultiListLoading, setIsMultiListLoading] = useState(false);

  useEffect(() => {
    if (multiListIds.length === 0) {
      setMultiListTasks([]);
      return;
    }
    let cancelled = false;
    setIsMultiListLoading(true);
    (async () => {
      try {
        const firstRows = await taskRepo.fetchInitialTaskRowsByListIds(multiListIds);
        if (cancelled) return;
        let rows = firstRows;
        if (firstRows.length >= taskRepo.INITIAL_TASK_PAGE_SIZE) {
          const remainingRows = await taskRepo.fetchRemainingTaskRowsByListIds(multiListIds);
          if (cancelled) return;
          rows = [...firstRows, ...remainingRows];
        }
        setMultiListTasks(rows.map(taskRepo.mapRowToTaskShell));
      } catch (err) {
        console.error('Erro ao carregar tarefas das listas selecionadas:', err);
        if (!cancelled) toast.error('Não foi possível carregar as tarefas das listas selecionadas.');
      } finally {
        if (!cancelled) setIsMultiListLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [multiListIds]);

  const scopedTasks = useMemo(
    () => resolveScopedTasks(scopeId, scopeOptions, tasks, multiListIds, multiListTasks),
    [scopeId, scopeOptions, tasks, multiListIds, multiListTasks]
  );

  const taskFields = useMemo(() => {
    return customFields.filter((field) => {
      if (field.target !== 'TASK') return false;
      const visibleTo = field.visibleTo || [];
      return !currentUser?.role || visibleTo.length === 0 || visibleTo.includes(currentUser.role);
    });
  }, [customFields, currentUser?.role]);

  const allColumns = useMemo<ColumnDef[]>(() => {
    // Issue #165: colunas de contexto (Space/Pasta/Lista) também aparecem
    // com uma seleção manual de "Listas específicas" ativa — as tarefas
    // exibidas podem vir de listas em pastas/spaces diferentes, então
    // esconder essas colunas deixaria o contexto de cada linha invisível.
    const contextColumns: ColumnDef[] = scopeId === 'current' && activeListId && multiListIds.length === 0
      ? []
      : [
          { id: 'space', label: 'Space', kind: 'context', defaultWidth: DEFAULT_WIDTHS.space },
          { id: 'folder', label: 'Pasta', kind: 'context', defaultWidth: DEFAULT_WIDTHS.folder },
          { id: 'list', label: 'Lista', kind: 'context', defaultWidth: DEFAULT_WIDTHS.list },
        ];

    return [
      { id: 'title', label: 'Nome da Tarefa', kind: 'system', required: true, defaultWidth: DEFAULT_WIDTHS.title },
      ...contextColumns,
      { id: 'status', label: 'Status', kind: 'system', defaultWidth: DEFAULT_WIDTHS.status },
      { id: 'priority', label: 'Prioridade', kind: 'system', defaultWidth: DEFAULT_WIDTHS.priority },
      { id: 'assignee', label: 'Responsável', kind: 'system', defaultWidth: DEFAULT_WIDTHS.assignee },
      { id: 'dueDate', label: 'Prazo', kind: 'system', defaultWidth: DEFAULT_WIDTHS.dueDate },
      { id: 'tags', label: 'Tags', kind: 'system', defaultWidth: DEFAULT_WIDTHS.tags },
      ...taskFields.map((field) => ({ id: `cf_${field.id}`, label: field.name, kind: 'custom' as const, defaultWidth: 170 })),
    ];
  }, [activeListId, multiListIds, scopeId, taskFields]);

  const prefsKey = `vp_table_prefs_${currentUser?.id || 'anon'}_${scopeId}`;
  const defaultPrefs = useMemo<TablePrefs>(() => ({
    visibleColumns: allColumns.map((column) => column.id).filter((id) => DEFAULT_COLUMNS.includes(id) || id.startsWith('cf_') || id === 'list'),
    columnWidths: DEFAULT_WIDTHS,
    columnOrder: allColumns.map((column) => column.id),
    stickyTitle: true,
    density: 'comfortable',
  }), [allColumns]);

  const [prefs, setPrefs] = useState<TablePrefs>(defaultPrefs);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<TaskPriority[]>([]);
  const [filterAssignee, setFilterAssignee] = useState('');
  // Issue #139: era valor único (string) mesmo o filtro se comportando como
  // "combinável" no resto do app — agora aceita múltiplos valores de verdade
  // (toggle, mesmo padrão já usado pelo filtro de Status).
  const [filterTag, setFilterTag] = useState<string[]>([]);
  const [filterDue, setFilterDue] = useState('');
  // Issue #165: filtro dedicado por contexto (Space/Pasta/Lista) — antes só
  // dava pra "achar" o contexto pela busca textual, que casa com o NOME e
  // não distingue contexto de conteúdo. Cada um é single-select porque é
  // hierárquico (escolher uma Lista já implica o Space/Pasta dela).
  const [filterSpaceId, setFilterSpaceId] = useState('');
  const [filterFolderId, setFilterFolderId] = useState('');
  const [filterListId, setFilterListId] = useState('');
  // Issue #139: antes só dava pra filtrar por 1 campo customizado por vez;
  // agora é uma lista de filtros combináveis (AND entre eles, como os demais).
  const [customFilters, setCustomFilters] = useState<{ fieldId: string; value: string }[]>([]);
  const [sortField, setSortField] = useState<'dueDate' | 'priority' | 'title' | 'list' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [rowOrder, setRowOrder] = useState<string[]>([]);
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ taskId: string; field: string } | null>(null);
  const [inlineDraft, setInlineDraft] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskListId, setNewTaskListId] = useState(activeListId || '');
  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);
  const rowOrderKey = `vp_table_row_order_${currentUser?.id || 'anon'}_${scopeId}`;

  // Issue #140: localStorage sozinho não sobrevive a troca de
  // navegador/dispositivo nem a limpeza de dados do site. Lê do cache local
  // primeiro (pinta na hora, sem esperar rede) e depois reconcilia com o
  // backend (table_view_prefs, por usuário+escopo — fonte de verdade pra
  // sincronizar entre dispositivos). Local continua sendo escrito também,
  // como cache rápido, não como única fonte.
  useEffect(() => {
    let cancelled = false;
    try {
      const saved = localStorage.getItem(prefsKey);
      setPrefs(saved ? { ...defaultPrefs, ...JSON.parse(saved) } : defaultPrefs);
    } catch {
      setPrefs(defaultPrefs);
    }
    if (!currentUser?.id) return;
    supabase
      .from('table_view_prefs')
      .select('prefs')
      .eq('user_id', currentUser.id)
      .eq('scope_id', scopeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data?.prefs) return;
        setPrefs({ ...defaultPrefs, ...(data.prefs as Partial<TablePrefs>) });
      });
    return () => { cancelled = true; };
  }, [currentUser?.id, defaultPrefs, prefsKey, scopeId]);

  useEffect(() => {
    try {
      localStorage.setItem(prefsKey, JSON.stringify(prefs));
    } catch {
      // Preferencias visuais continuam funcionais na sessao mesmo sem storage.
    }
    if (!currentUser?.id) return;
    // Debounce: resize de coluna dispara mudança de prefs a cada pixel
    // arrastado — sem isso, cada frame do drag viraria uma escrita no banco.
    const timeout = setTimeout(() => {
      supabase
        .from('table_view_prefs')
        .upsert(
          { user_id: currentUser.id, scope_id: scopeId, prefs, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,scope_id' }
        )
        .then(({ error }) => {
          if (error) console.error('Erro ao salvar preferências da Tabela:', error);
        });
    }, 600);
    return () => clearTimeout(timeout);
  }, [currentUser?.id, prefs, prefsKey, scopeId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(rowOrderKey);
      if (saved) {
        setRowOrder(JSON.parse(saved));
        return;
      }
    } catch {
      // cai no fallback do backend abaixo
    }
    // Issue #138: sem cache local (primeiro acesso neste navegador, ou dados
    // limpos), usa a ordem já persistida no backend (sort_index) como ponto
    // de partida — é o que faz a ordem sobreviver a troca de dispositivo.
    const withOrder = scopedTasks.filter((task) => task.sortIndex != null);
    if (withOrder.length === 0) {
      setRowOrder([]);
      return;
    }
    const ordered = [...withOrder].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)).map((task) => task.id);
    const withoutOrder = scopedTasks.filter((task) => task.sortIndex == null).map((task) => task.id);
    setRowOrder([...ordered, ...withoutOrder]);
  }, [rowOrderKey, scopedTasks]);

  useEffect(() => {
    setNewTaskListId(activeListId || '');
  }, [activeListId]);

  const fieldValueMap = useMemo(() => {
    const map = new Map<string, any>();
    fieldValues.forEach((value) => map.set(`${value.entityId}:${value.fieldId}`, value.value));
    return map;
  }, [fieldValues]);

  const getFieldValue = useCallback((taskId: string, fieldId: string) => fieldValueMap.get(`${taskId}:${fieldId}`), [fieldValueMap]);
  const listById = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);
  const taskById = useMemo(() => new Map(scopedTasks.map((task) => [task.id, task])), [scopedTasks]);
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const spaceById = useMemo(() => new Map(spaces.map((space) => [space.id, space])), [spaces]);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const getTaskContext = useCallback((task: Task) => {
    const list = listById.get(task.listId);
    const folder = list ? folderById.get(list.folderId) : undefined;
    const space = folder ? spaceById.get(folder.spaceId) : undefined;
    return { list, folder, space };
  }, [folderById, listById, spaceById]);

  // Issues #137/#143/#162/#163: só pra ESCONDER ações que a RLS de qualquer
  // jeito bloquearia (evita cliques que dão em erro) — nunca é a fonte de
  // verdade. Cobre 4 das 5 condições reais de tasks_upd (ADMIN/GESTOR,
  // responsável principal/secundário, criador, acesso à lista via
  // pasta/espaço); a 5ª (observador) não dá pra checar aqui porque a linha
  // "leve" que a Tabela recebe não traz watcherIds (só carregado sob
  // demanda ao abrir o detalhe) — um observador puro, sem nenhuma das
  // outras 4 condições, pode ver uma ação escondida que o backend na
  // verdade permitiria. Caso raro e sem risco de segurança (só esconde
  // ação de mais, nunca de menos do que a RLS já barraria).
  const canEditTaskInTable = useCallback((task: Task) => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GESTOR) return true;
    if (task.mainAssigneeId === currentUser.id) return true;
    if ((task.secondaryAssigneeIds || []).includes(currentUser.id)) return true;
    if (task.createdBy === currentUser.id) return true;
    if (allowedFolderIdSet === null) return true;
    const list = listById.get(task.listId);
    return Boolean(list && allowedFolderIdSet.has(list.folderId));
  }, [allowedFolderIdSet, currentUser, listById]);

  // Issue #162: criar tarefa depende só de acesso à LISTA (tasks_ins =
  // can_access_list), não das condições de dono/responsável acima.
  const canCreateInList = useCallback((listId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GESTOR) return true;
    if (allowedFolderIdSet === null) return true;
    const list = listById.get(listId);
    return Boolean(list && allowedFolderIdSet.has(list.folderId));
  }, [allowedFolderIdSet, currentUser, listById]);

  const availableStatuses = useMemo(() => {
    const fromGroups = statusGroups.flatMap((group) => group.options.map((option) => option.label));
    const fromTasks = scopedTasks.map((task) => task.status).filter(Boolean);
    return Array.from(new Set([...fromGroups, ...fromTasks]));
  }, [scopedTasks, statusGroups]);

  const availableTags = useMemo(() => {
    const fromTasks = scopedTasks.flatMap((task) => task.tags || []);
    const fromWorkspace = workspaceTags.map((tag) => tag.name);
    return Array.from(new Set([...fromWorkspace, ...fromTasks])).filter(Boolean);
  }, [scopedTasks, workspaceTags]);

  // Visibilidade de colunas de campo personalizado é compartilhada entre todos
  // os usuários da lista (list_column_prefs), não mais um "protótipo local"
  // por navegador — é essa a fonte que evita a tabela quase infinita.
  const hiddenFieldIdsForList = useMemo(
    () => (activeListId && hiddenTaskFieldIdsByList[activeListId]) || [],
    [activeListId, hiddenTaskFieldIdsByList]
  );

  const visibleColumns = useMemo(() => {
    const available = new Set(allColumns.map((column) => column.id));
    const orderedIds = [
      ...prefs.columnOrder.filter((id) => available.has(id)),
      ...allColumns.map((column) => column.id).filter((id) => !prefs.columnOrder.includes(id)),
    ];
    return orderedIds
      .map((id) => allColumns.find((column) => column.id === id))
      .filter((column): column is ColumnDef => Boolean(column))
      .filter((column) => {
        if (column.required) return true;
        if (column.kind === 'custom') return !hiddenFieldIdsForList.includes(column.id.slice(3));
        return prefs.visibleColumns.includes(column.id);
      });
  }, [allColumns, prefs.columnOrder, prefs.visibleColumns, hiddenFieldIdsForList]);

  // Issue #144: abaixo do breakpoint mobile, renderiza só um recorte
  // essencial de colunas — a alternativa (todas as colunas com as mesmas
  // larguras mínimas de desktop) força scroll horizontal constante e
  // dificulta achar a informação principal. É um filtro só de EXIBIÇÃO,
  // aplicado por cima de `visibleColumns`: nunca mexe em `prefs`, então a
  // preferência de colunas do usuário (persistida em table_view_prefs) não
  // é alterada nem sobrescrita — ao voltar pro desktop, tudo volta como
  // estava configurado.
  const isMobile = useIsMobile();
  const effectiveVisibleColumns = useMemo(() => {
    if (!isMobile) return visibleColumns;
    return visibleColumns.filter((column) => column.required || MOBILE_ESSENTIAL_COLUMNS.includes(column.id));
  }, [visibleColumns, isMobile]);

  const hasActiveFilters = Boolean(search || filterStatus.length || filterPriority.length || filterAssignee || filterTag.length || filterDue || filterSpaceId || filterFolderId || filterListId || customFilters.some((filter) => filter.fieldId && filter.value));

  const displayedTasks = useMemo(() => {
    let result = scopedTasks.filter((task) => !task.parentId);

    if (search) {
      const query = normalize(search);
      result = result.filter((task) => {
        const context = getTaskContext(task);
        const customValues = taskFields.map((field) => {
          const value = getFieldValue(task.id, field.id);
          const option = field.config?.options?.find((item) => item.id === value);
          return option?.label || value;
        });
        return normalize([
          task.title,
          task.status,
          task.priority,
          userById.get(task.mainAssigneeId)?.name,
          context.list?.name,
          context.folder?.name,
          context.space?.name,
          ...(task.tags || []),
          ...customValues,
        ].join(' ')).includes(query);
      });
    }

    if (filterStatus.length > 0) result = result.filter((task) => filterStatus.includes(task.status));
    if (filterPriority.length > 0) result = result.filter((task) => filterPriority.includes(task.priority));
    if (filterAssignee) result = result.filter((task) => task.mainAssigneeId === filterAssignee || task.secondaryAssigneeIds?.includes(filterAssignee));
    if (filterTag.length > 0) result = result.filter((task) => task.tags?.some((tag) => filterTag.includes(tag)));
    if (filterSpaceId || filterFolderId || filterListId) {
      result = result.filter((task) => taskMatchesContextFilters(getTaskContext(task), { spaceId: filterSpaceId, folderId: filterFolderId, listId: filterListId }));
    }
    if (filterDue === 'overdue') result = result.filter(isOverdue);
    if (filterDue === 'without') result = result.filter((task) => !task.dueDate);
    if (filterDue === 'with') result = result.filter((task) => Boolean(task.dueDate));
    if (filterDue === 'week') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      result = result.filter((task) => {
        const due = parseDate(task.dueDate);
        return due && due >= today && due <= nextWeek;
      });
    }

    const activeCustomFilters = customFilters.filter((filter) => filter.fieldId && filter.value);
    if (activeCustomFilters.length > 0) {
      result = result.filter((task) =>
        activeCustomFilters.every(({ fieldId, value }) => {
          const query = normalize(value);
          const field = taskFields.find((item) => item.id === fieldId);
          const fieldValue = getFieldValue(task.id, fieldId);
          const option = field?.config?.options?.find((item) => item.id === fieldValue);
          return normalize(option?.label || fieldValue).includes(query);
        })
      );
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        let av: string | number = '';
        let bv: string | number = '';
        if (sortField === 'priority') {
          av = PRIORITY_ORDER[a.priority] ?? 99;
          bv = PRIORITY_ORDER[b.priority] ?? 99;
        } else if (sortField === 'dueDate') {
          av = a.dueDate || '9999-12-31';
          bv = b.dueDate || '9999-12-31';
        } else if (sortField === 'list') {
          av = getTaskContext(a).list?.name || '';
          bv = getTaskContext(b).list?.name || '';
        } else {
          av = a.title || '';
          bv = b.title || '';
        }
        const comparison = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? comparison : -comparison;
      });
    } else if (rowOrder.length > 0 && !hasActiveFilters) {
      const order = new Map(rowOrder.map((id, index) => [id, index]));
      result = [...result].sort((a, b) => (order.get(a.id) ?? 999999) - (order.get(b.id) ?? 999999));
    }

    return result;
  }, [customFilters, filterAssignee, filterDue, filterFolderId, filterListId, filterPriority, filterSpaceId, filterStatus, filterTag, getFieldValue, getTaskContext, hasActiveFilters, rowOrder, scopedTasks, search, sortDir, sortField, taskFields, userById]);

  useEffect(() => {
    setSelectedTaskIds((prev) => {
      const visible = new Set(displayedTasks.map((task) => task.id));
      const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [displayedTasks]);

  const resetFilters = () => {
    setSearch('');
    setFilterStatus([]);
    setFilterPriority([]);
    setFilterAssignee('');
    setFilterTag([]);
    setFilterDue('');
    setFilterSpaceId('');
    setFilterFolderId('');
    setFilterListId('');
    setCustomFilters([]);
  };

  const toggleFilterTag = (tag: string) => {
    setFilterTag((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const addCustomFilter = () => {
    setCustomFilters((prev) => [...prev, { fieldId: '', value: '' }]);
  };

  const updateCustomFilter = (index: number, patch: Partial<{ fieldId: string; value: string }>) => {
    setCustomFilters((prev) => prev.map((filter, i) => (i === index ? { ...filter, ...patch } : filter)));
  };

  const removeCustomFilter = (index: number) => {
    setCustomFilters((prev) => prev.filter((_, i) => i !== index));
  };

  // Issue #137: choque único de permissão pra toda edição de célula (inline
  // e em lote, que passam por aqui) — evita repetir a checagem em cada tipo
  // de coluna/editor.
  const commitTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    const task = taskById.get(taskId);
    if (task && !canEditTaskInTable(task)) {
      toast.error('Você não tem permissão para editar esta tarefa.');
      return;
    }
    try {
      await onUpdateTask(taskId, updates);
    } catch {
      toast.error('Não foi possível salvar a alteração.');
    }
  };

  const commitFieldUpdate = async (taskId: string, fieldId: string, value: any) => {
    const task = taskById.get(taskId);
    if (task && !canEditTaskInTable(task)) {
      toast.error('Você não tem permissão para editar esta tarefa.');
      return;
    }
    try {
      await onUpdateFieldValue(fieldId, taskId, value);
    } catch {
      toast.error('Não foi possível salvar o campo customizado.');
    }
  };

  const startInlineEdit = (taskId: string, field: string, value: unknown) => {
    setEditing({ taskId, field });
    setInlineDraft(String(value ?? ''));
  };

  const finishInlineEdit = async () => {
    if (!editing) return;
    const { taskId, field } = editing;
    const draft = inlineDraft.trim();
    setEditing(null);
    if (field === 'title' && draft) {
      await commitTaskUpdate(taskId, { title: draft });
    } else if (field.startsWith('cf_')) {
      await commitFieldUpdate(taskId, field.replace('cf_', ''), draft);
    }
  };

  // Issue #144: Pointer Events (em vez de mouse-only) fazem o mesmo handler
  // funcionar com mouse, caneta e toque — sem isso, redimensionar coluna era
  // impossível em tablet/celular. `setPointerCapture` no próprio elemento
  // evita perder o arraste quando o dedo/cursor sai da faixa fina do handle.
  const handleResizeMouseDown = useCallback((e: React.PointerEvent<HTMLDivElement>, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = prefs.columnWidths[colId] ?? allColumns.find((column) => column.id === colId)?.defaultWidth ?? 150;
    resizingRef.current = { colId, startX: e.clientX, startWidth };
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const handlePointerMove = (ev: PointerEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(resizingRef.current.colId === 'title' ? 220 : 90, resizingRef.current.startWidth + delta);
      setPrefs((prev) => ({ ...prev, columnWidths: { ...prev.columnWidths, [resizingRef.current!.colId]: newWidth } }));
    };

    const handlePointerUp = (ev: PointerEvent) => {
      resizingRef.current = null;
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener('pointermove', handlePointerMove);
      handle.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    handle.addEventListener('pointermove', handlePointerMove);
    handle.addEventListener('pointerup', handlePointerUp);
  }, [allColumns, prefs.columnWidths]);

  const reorderColumn = (targetId: string) => {
    if (!draggedColumnId || draggedColumnId === targetId || draggedColumnId === 'title') return;
    setPrefs((prev) => {
      const availableIds = allColumns.map((column) => column.id);
      const current = prev.columnOrder.filter((id) => availableIds.includes(id));
      const from = current.indexOf(draggedColumnId);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      current.splice(from, 1);
      current.splice(to, 0, draggedColumnId);
      return { ...prev, columnOrder: current };
    });
  };

  const canReorderRows = !sortField && !hasActiveFilters;
  const reorderRow = async (targetId: string) => {
    if (!draggedRowId || draggedRowId === targetId || !canReorderRows) return;
    const previousIds = rowOrder.length > 0 ? rowOrder : displayedTasks.map((task) => task.id);
    const currentIds = displayedTasks.map((task) => task.id);
    const from = currentIds.indexOf(draggedRowId);
    const to = currentIds.indexOf(targetId);
    if (from < 0 || to < 0) return;
    currentIds.splice(from, 1);
    currentIds.splice(to, 0, draggedRowId);
    setRowOrder(currentIds);
    try {
      localStorage.setItem(rowOrderKey, JSON.stringify(currentIds));
    } catch {
      toast.error('A ordem foi alterada, mas não foi possível salvar a preferência local.');
    }

    // Issue #138: persiste no backend (sort_index) pra sobreviver a
    // reload/troca de dispositivo. sort_index é por lista — um escopo
    // agregando várias listas (ex.: "Todos os contextos") precisa de uma
    // chamada por lista, cada uma só com a ordem relativa das SUAS tarefas
    // dentro da sequência nova. Atualização otimista com rollback: se
    // qualquer lista falhar em persistir, desfaz a mudança local inteira.
    const taskById = new Map(scopedTasks.map((task) => [task.id, task]));
    const idsByList = new Map<string, string[]>();
    currentIds.forEach((id) => {
      const listId = taskById.get(id)?.listId;
      if (!listId) return;
      const arr = idsByList.get(listId) || [];
      arr.push(id);
      idsByList.set(listId, arr);
    });
    const results = await Promise.all(
      Array.from(idsByList.entries()).map(([listId, ids]) => reorderTasksInList(listId, ids))
    );
    if (results.some((result) => result === null)) {
      setRowOrder(previousIds);
      try {
        localStorage.setItem(rowOrderKey, JSON.stringify(previousIds));
      } catch {
        // preferência local não é crítica pro rollback funcionar
      }
      toast.error('Não foi possível salvar a nova ordem. A ordem anterior foi restaurada.');
    }
  };

  const toggleColumn = (columnId: string) => {
    if (columnId.startsWith('cf_')) {
      // Campo personalizado: visibilidade é compartilhada (list_column_prefs),
      // não local — todo mundo que abre essa lista vê a mesma coisa.
      if (activeListId && onHideTaskFieldForList) onHideTaskFieldForList(activeListId, columnId.slice(3));
      return;
    }
    setPrefs((prev) => ({
      ...prev,
      visibleColumns: prev.visibleColumns.includes(columnId)
        ? prev.visibleColumns.filter((id) => id !== columnId)
        : [...prev.visibleColumns, columnId],
    }));
  };

  const toggleSelected = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Issue #143: só seleciona (e portanto só permite ação em lote sobre)
  // tarefas que o usuário pode editar — evita marcar tudo e a ação falhar
  // silenciosamente por linha na RLS.
  const selectAllVisible = () => {
    const visibleIds = displayedTasks.filter(canEditTaskInTable).map((task) => task.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedTaskIds.has(id));
    setSelectedTaskIds(allSelected ? new Set() : new Set(visibleIds));
  };

  const runBulkUpdate = async (updates: Partial<Task>) => {
    const ids = Array.from(selectedTaskIds);
    await Promise.all(ids.map((id) => commitTaskUpdate(id, updates)));
    setSelectedTaskIds(new Set());
  };

  const runBulkTagAdd = async (tagName: string) => {
    const ids = Array.from(selectedTaskIds);
    await Promise.all(ids.map((id) => {
      const task = scopedTasks.find((item) => item.id === id);
      const tags = Array.from(new Set([...(task?.tags || []), tagName]));
      return commitTaskUpdate(id, { tags });
    }));
    setSelectedTaskIds(new Set());
  };

  const createInlineTask = async () => {
    if (!onCreateTask || !newTaskTitle.trim()) return;
    const targetListId = newTaskListId || activeListId || (scopeId.startsWith('list:') ? scopeId.replace('list:', '') : '');
    if (!targetListId) {
      toast.error('Escolha uma lista para criar a tarefa.');
      return;
    }
    // Issue #162: criar depende de acesso à lista (tasks_ins), não das
    // condições de dono/responsável de canEditTaskInTable.
    if (!canCreateInList(targetListId)) {
      toast.error('Você não tem permissão para criar tarefas nesta lista.');
      return;
    }
    await onCreateTask({ title: newTaskTitle.trim(), listId: targetListId });
    setNewTaskTitle('');
  };

  const copyTaskLink = async (taskId: string) => {
    const link = `${window.location.origin}${window.location.pathname}?task=${taskId}`;
    await navigator.clipboard?.writeText(link);
    toast.success('Link da tarefa copiado.');
  };

  const renderCustomValue = (task: Task, field: CustomField) => {
    const value = getFieldValue(task.id, field.id);
    if (field.type === CustomFieldType.FORMULA) return <span className="text-xs text-muted-foreground">Calculado</span>;
    if (field.type === CustomFieldType.CHECKBOX) {
      return <input type="checkbox" checked={Boolean(value)} onClick={(e) => e.stopPropagation()} onChange={(e) => commitFieldUpdate(task.id, field.id, e.target.checked)} className="h-4 w-4 rounded border-border" />;
    }
    if (field.type === CustomFieldType.DROPDOWN) {
      return (
        <select value={value || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => commitFieldUpdate(task.id, field.id, e.target.value)} className="h-8 w-full rounded border border-border bg-background px-2 text-xs">
          <option value="">-</option>
          {field.config?.options?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      );
    }
    if (field.type === CustomFieldType.DATE) {
      return (
        <span onClick={(e) => e.stopPropagation()}>
          <DateFieldEditor
            value={toInputDate(value)}
            onCommit={(v) => commitFieldUpdate(task.id, field.id, v)}
            className="h-8 w-full rounded border border-border bg-background px-2 text-xs"
          />
        </span>
      );
    }
    if (field.type === CustomFieldType.PROGRESS) {
      return <input type="number" min={0} max={100} value={value ?? 0} onClick={(e) => e.stopPropagation()} onChange={(e) => commitFieldUpdate(task.id, field.id, Number(e.target.value))} className="h-8 w-full rounded border border-border bg-background px-2 text-xs" />;
    }
    if (field.type === CustomFieldType.RATING) {
      return (
        <select value={value || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => commitFieldUpdate(task.id, field.id, e.target.value)} className="h-8 w-full rounded border border-border bg-background px-2 text-xs">
          <option value="">-</option>
          {[1, 2, 3, 4, 5].map((star) => <option key={star} value={star}>{star}</option>)}
        </select>
      );
    }

    const inputType = [CustomFieldType.NUMBER, CustomFieldType.MONEY, CustomFieldType.CURRENCY].includes(field.type) ? 'number' : 'text';
    return editing?.taskId === task.id && editing.field === `cf_${field.id}` ? (
      <input autoFocus type={inputType} value={inlineDraft} onClick={(e) => e.stopPropagation()} onChange={(e) => setInlineDraft(e.target.value)} onBlur={finishInlineEdit} onKeyDown={(e) => { if (e.key === 'Enter') finishInlineEdit(); if (e.key === 'Escape') setEditing(null); }} className="h-8 w-full rounded border border-primary bg-background px-2 text-sm outline-none" />
    ) : (
      <button type="button" onClick={(e) => { e.stopPropagation(); startInlineEdit(task.id, `cf_${field.id}`, value); }} className="block h-8 w-full truncate rounded px-2 text-left text-sm hover:bg-muted">
        {field.type === CustomFieldType.MONEY || field.type === CustomFieldType.CURRENCY ? `${field.config?.currency || 'R$'} ${value || '0'}` : String(value || '-')}
      </button>
    );
  };

  const renderCell = (task: Task, column: ColumnDef) => {
    const width = prefs.columnWidths[column.id] ?? column.defaultWidth;
    const stickyClass = column.id === 'title' && prefs.stickyTitle ? 'sticky left-[44px] z-[2] bg-background shadow-[8px_0_10px_-12px_rgba(0,0,0,0.45)]' : '';
    const baseClass = `${prefs.density === 'compact' ? 'px-2 py-1.5' : 'px-3 py-2.5'} border border-border align-middle overflow-hidden ${stickyClass}`;

    if (column.id === 'title') {
      return (
        <td key={column.id} className={`${baseClass} font-medium`} style={{ width, minWidth: width, maxWidth: width }}>
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/40 hover:border-primary" onClick={(e) => { e.stopPropagation(); commitTaskUpdate(task.id, { status: 'Concluído' }); }} title="Marcar como concluída" />
            {task.dependencies?.some((dependency) => dependency.type === 'blocked_by') && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
            <div className="min-w-0 flex-1">
              {editing?.taskId === task.id && editing.field === 'title' ? (
                <input autoFocus value={inlineDraft} onClick={(e) => e.stopPropagation()} onChange={(e) => setInlineDraft(e.target.value)} onBlur={finishInlineEdit} onKeyDown={(e) => { if (e.key === 'Enter') finishInlineEdit(); if (e.key === 'Escape') setEditing(null); }} className="h-8 w-full rounded border border-primary bg-background px-2 text-sm outline-none" />
              ) : (
                <button type="button" onClick={(e) => { e.stopPropagation(); startInlineEdit(task.id, 'title', task.title); }} className="block w-full truncate rounded px-1 text-left hover:bg-muted">{task.title}</button>
              )}
              {(task.tags ?? []).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {(task.tags ?? []).map((tagName) => {
                    const tag = workspaceTags.find((item) => item.name === tagName);
                    return tag ? <TagBadge key={tagName} name={tag.name} color={tag.color} size="xs" /> : null;
                  })}
                </div>
              )}
            </div>
          </div>
        </td>
      );
    }

    if (column.id === 'status') {
      return <td key={column.id} className={baseClass} style={{ width, minWidth: width, maxWidth: width }}><select value={task.status || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => commitTaskUpdate(task.id, { status: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-xs">{availableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>;
    }

    if (column.id === 'priority') {
      return <td key={column.id} className={baseClass} style={{ width, minWidth: width, maxWidth: width }}><select value={task.priority || TaskPriority.MEDIA} onClick={(e) => e.stopPropagation()} onChange={(e) => commitTaskUpdate(task.id, { priority: e.target.value as TaskPriority })} className="h-8 w-full rounded border border-border bg-background px-2 text-xs">{PRIORITY_VALUES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></td>;
    }

    if (column.id === 'assignee') {
      return <td key={column.id} className={baseClass} style={{ width, minWidth: width, maxWidth: width }}><select value={task.mainAssigneeId || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => commitTaskUpdate(task.id, { mainAssigneeId: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-xs"><option value="">Sem responsável</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></td>;
    }

    if (column.id === 'dueDate') {
      return (
        <td key={column.id} className={baseClass} style={{ width, minWidth: width, maxWidth: width }} title={formatDate(task.dueDate)}>
          <span onClick={(e) => e.stopPropagation()}>
            <DateFieldEditor
              value={toInputDate(task.dueDate)}
              onCommit={(v) => commitTaskUpdate(task.id, { dueDate: v })}
              className="h-8 w-full rounded border border-border bg-background px-2 text-xs"
            />
          </span>
        </td>
      );
    }

    if (column.id === 'tags') {
      return (
        <td key={column.id} className={baseClass} style={{ width, minWidth: width, maxWidth: width }}>
          <select value="" onClick={(e) => e.stopPropagation()} onChange={(e) => { const tag = e.target.value; if (!tag) return; const nextTags = task.tags?.includes(tag) ? task.tags.filter((item) => item !== tag) : [...(task.tags || []), tag]; commitTaskUpdate(task.id, { tags: nextTags }); e.target.value = ''; }} className="h-8 w-full rounded border border-border bg-background px-2 text-xs">
            <option value="">{(task.tags || []).length ? task.tags.join(', ') : 'Adicionar tag'}</option>
            {availableTags.map((tag) => <option key={tag} value={tag}>{task.tags?.includes(tag) ? 'Remover ' : 'Adicionar '}{tag}</option>)}
          </select>
        </td>
      );
    }

    if (column.id === 'list' || column.id === 'folder' || column.id === 'space') {
      const context = getTaskContext(task);
      const label = column.id === 'list' ? context.list?.name : column.id === 'folder' ? context.folder?.name : context.space?.name;
      return <td key={column.id} className={baseClass} style={{ width, minWidth: width, maxWidth: width }}><span className="block truncate text-sm text-muted-foreground">{label || '-'}</span></td>;
    }

    if (column.id.startsWith('cf_')) {
      const fieldId = column.id.replace('cf_', '');
      const field = taskFields.find((item) => item.id === fieldId);
      return <td key={column.id} className={baseClass} style={{ width, minWidth: width, maxWidth: width }} onClick={(e) => e.stopPropagation()}>{field ? renderCustomValue(task, field) : '-'}</td>;
    }

    return null;
  };

  // Virtualização de linhas: o workspace de produção tem milhares de tarefas
  // (~8 mil), e sem isso o escopo "Dashboard" (sem filtro de lista) montava
  // uma <tr> real por tarefa de uma vez só — ordenar ou redimensionar coluna
  // forçava o React a reconciliar milhares de linhas complexas (avatar,
  // dropdowns, campos customizados) na mesma tarefa síncrona, travando a
  // aba (e, em máquinas com menos memória, o navegador inteiro). Só as
  // linhas realmente visíveis (+ overscan) viram <tr> de verdade agora;
  // altura de linha é medida de verdade (measureElement), não fixa, porque
  // varia com densidade e com a tag de tarefas quebrando pra 2 linhas.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const estimateRowSize = useCallback(() => (prefs.density === 'compact' ? 40 : 56), [prefs.density]);
  const rowVirtualizer = useVirtualizer({
    count: displayedTasks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: estimateRowSize,
    overscan: 12,
    measureElement: (element) => element?.getBoundingClientRect().height ?? estimateRowSize(),
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar na tabela" className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <select value={scopeId} disabled={multiListIds.length > 0} onChange={(e) => setScopeId(e.target.value)} className="h-9 max-w-[260px] rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50">
            {scopeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          {/* Issue #165: "Listas específicas" — agrega Lists arbitrárias
              (não precisam compartilhar Space/Pasta), tipo Table View do
              Trello. Substitui o escopo hierárquico acima enquanto ativo
              (por isso o <select> fica desabilitado); busca as tarefas
              dessas listas direto do backend, então funciona mesmo fora do
              contexto de navegação atual. */}
          <DropdownMenu onOpenChange={(open) => { if (!open) setMultiListSearch(''); }}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={multiListIds.length > 0 ? 'border-primary text-primary' : ''}>
                <Layers className="mr-2 h-4 w-4" />
                {multiListIds.length > 0 ? `${multiListIds.length} lista${multiListIds.length > 1 ? 's' : ''}${isMultiListLoading ? '…' : ''}` : 'Listas específicas'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <div className="sticky top-0 z-10 bg-popover p-1">
                <input
                  type="text"
                  autoFocus
                  value={multiListSearch}
                  onChange={(e) => setMultiListSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Buscar lista..."
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {(() => {
                  const query = multiListSearch.trim().toLowerCase();
                  const groups = spaces
                    .map((space) => ({
                      space,
                      listOptions: lists
                        .filter((list) => folderById.get(list.folderId)?.spaceId === space.id)
                        .filter((list) => !query || list.name.toLowerCase().includes(query)),
                    }))
                    .filter((group) => group.listOptions.length > 0);
                  if (groups.length === 0) {
                    return <div className="px-2 py-3 text-xs text-gray-400 text-center">Nenhuma lista encontrada.</div>;
                  }
                  return groups.map(({ space, listOptions }) => (
                    <div key={space.id}>
                      <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-bold uppercase text-muted-foreground">{space.name}</p>
                      {listOptions.map((list) => (
                        <DropdownMenuCheckboxItem
                          key={list.id}
                          checked={multiListIds.includes(list.id)}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={(checked) => setMultiListIds((prev) => checked ? [...prev, list.id] : prev.filter((id) => id !== list.id))}
                          className="text-xs"
                        >
                          {list.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  ));
                })()}
              </div>
              {multiListIds.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMultiListIds([]); }} className="text-xs text-muted-foreground">
                    <RotateCcw className="mr-2 h-4 w-4" />Limpar seleção
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={hasActiveFilters ? 'border-primary text-primary' : ''}><Filter className="mr-2 h-4 w-4" />Filtros{hasActiveFilters && <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">ativo</span>}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80 space-y-3 p-3">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase text-muted-foreground">Status</p>
                <div className="flex flex-wrap gap-1">
                  {availableStatuses.map((status) => <button key={status} type="button" onClick={() => setFilterStatus((prev) => prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status])} className={`rounded-full border px-2 py-1 text-[11px] ${filterStatus.includes(status) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{status}</button>)}
                </div>
              </div>
              <div>
                {/* Issue #139: era um <select> de valor único — agora, mesmo
                    padrão de toggle do Status acima, dá pra combinar mais de
                    uma prioridade no filtro. */}
                <p className="mb-1.5 text-[10px] font-bold uppercase text-muted-foreground">Prioridade</p>
                <div className="flex flex-wrap gap-1">
                  {PRIORITY_VALUES.map((priority) => <button key={priority} type="button" onClick={() => setFilterPriority((prev) => prev.includes(priority) ? prev.filter((item) => item !== priority) : [...prev, priority])} className={`rounded-full border px-2 py-1 text-[11px] ${filterPriority.includes(priority) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{priority}</button>)}
                </div>
              </div>
              {availableTags.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {availableTags.map((tag) => <button key={tag} type="button" onClick={() => toggleFilterTag(tag)} className={`rounded-full border px-2 py-1 text-[11px] ${filterTag.includes(tag) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{tag}</button>)}
                  </div>
                </div>
              )}
              <div>
                {/* Issue #165: filtro dedicado por contexto — antes só dava
                    pra "achar" o contexto pela busca textual (casa com o
                    NOME, não distingue contexto de conteúdo). Cada select
                    reseta os de baixo ao mudar, pra nunca ficar numa
                    combinação impossível (ex.: pasta de um space diferente
                    do escolhido). */}
                <p className="mb-1.5 text-[10px] font-bold uppercase text-muted-foreground">Contexto</p>
                <div className="grid grid-cols-3 gap-2">
                  <select value={filterSpaceId} onChange={(e) => { setFilterSpaceId(e.target.value); setFilterFolderId(''); setFilterListId(''); }} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Space</option>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select>
                  <select value={filterFolderId} onChange={(e) => { setFilterFolderId(e.target.value); setFilterListId(''); }} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Pasta</option>{folders.filter((folder) => !filterSpaceId || folder.spaceId === filterSpaceId).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
                  <select value={filterListId} onChange={(e) => setFilterListId(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Lista</option>{lists.filter((list) => (!filterFolderId || list.folderId === filterFolderId) && (!filterSpaceId || folderById.get(list.folderId)?.spaceId === filterSpaceId)).map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Responsável</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
                <select value={filterDue} onChange={(e) => setFilterDue(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Prazo</option><option value="overdue">Atrasadas</option><option value="week">Próximos 7 dias</option><option value="with">Com prazo</option><option value="without">Sem prazo</option></select>
              </div>
              <div className="space-y-2">
                {/* Issue #139: antes só dava pra filtrar por 1 campo
                    customizado de cada vez — agora é uma lista, combinável
                    (AND) com os demais filtros. */}
                {customFilters.map((filter, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <select value={filter.fieldId} onChange={(e) => updateCustomFilter(index, { fieldId: e.target.value })} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Campo customizado</option>{taskFields.filter((field) => field.type !== CustomFieldType.FORMULA).map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select>
                    <input value={filter.value} onChange={(e) => updateCustomFilter(index, { value: e.target.value })} placeholder="Valor" className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
                    <button type="button" onClick={() => removeCustomFilter(index)} className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted" aria-label="Remover filtro de campo customizado"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addCustomFilter} className="w-full justify-center text-muted-foreground"><Plus className="mr-2 h-4 w-4" />Adicionar filtro de campo</Button>
              </div>
              {hasActiveFilters && <Button variant="ghost" size="sm" onClick={resetFilters} className="w-full justify-center text-muted-foreground"><RotateCcw className="mr-2 h-4 w-4" />Limpar filtros</Button>}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={sortField ? 'border-primary text-primary' : ''}><ArrowUpDown className="mr-2 h-4 w-4" />Ordenar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {([['title', 'Nome'], ['dueDate', 'Prazo'], ['priority', 'Prioridade'], ['list', 'Lista']] as const).map(([field, label]) => <DropdownMenuItem key={field} onClick={() => { if (sortField === field) setSortDir((dir) => dir === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc'); } }}><span className="flex-1">{label}</span>{sortField === field && <span className="text-xs">{sortDir === 'asc' ? 'A-Z' : 'Z-A'}</span>}</DropdownMenuItem>)}
              {sortField && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setSortField(null)}>Remover ordenação</DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPrefs((prev) => ({ ...prev, density: prev.density === 'compact' ? 'comfortable' : 'compact' }))}>{prefs.density === 'compact' ? 'Confortável' : 'Compacta'}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Settings2 className="mr-2 h-4 w-4" />Colunas</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 w-64 overflow-y-auto">
              <DropdownMenuItem onClick={() => setPrefs((prev) => ({ ...prev, stickyTitle: !prev.stickyTitle }))}><Columns3 className="mr-2 h-4 w-4" /><span className="flex-1">Fixar nome</span>{prefs.stickyTitle && <CheckCircle2 className="h-4 w-4 text-primary" />}</DropdownMenuItem>
              <DropdownMenuSeparator />
              {allColumns.filter((column) => !column.required).map((column) => {
                const isVisible = column.kind === 'custom'
                  ? !hiddenFieldIdsForList.includes(column.id.slice(3))
                  : prefs.visibleColumns.includes(column.id);
                return (
                  <DropdownMenuItem key={column.id} onClick={() => toggleColumn(column.id)}>
                    <span className="flex-1 truncate">{column.label}</span>
                    {isVisible && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPrefs(defaultPrefs)}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <span>{displayedTasks.length} de {scopedTasks.length} tarefas</span>
          {search && <Badge variant="outline">Busca: {search}</Badge>}
          {filterPriority.map((priority) => <Badge key={priority} variant="outline">{priority}</Badge>)}
          {filterAssignee && <Badge variant="outline"><UserCircle className="mr-1 h-3 w-3" />{userById.get(filterAssignee)?.name}</Badge>}
          {filterTag.map((tag) => <Badge key={tag} variant="outline"><Tags className="mr-1 h-3 w-3" />{tag}</Badge>)}
          {filterDue && <Badge variant="outline"><Calendar className="mr-1 h-3 w-3" />{filterDue}</Badge>}
          {filterSpaceId && <Badge variant="outline"><Layers className="mr-1 h-3 w-3" />{spaceById.get(filterSpaceId)?.name}</Badge>}
          {filterFolderId && <Badge variant="outline"><FolderOpen className="mr-1 h-3 w-3" />{folderById.get(filterFolderId)?.name}</Badge>}
          {filterListId && <Badge variant="outline"><Layers className="mr-1 h-3 w-3" />{listById.get(filterListId)?.name}</Badge>}
          {customFilters.filter((filter) => filter.fieldId && filter.value).map((filter, index) => (
            <Badge key={`${filter.fieldId}-${index}`} variant="outline">{taskFields.find((field) => field.id === filter.fieldId)?.name}: {filter.value}</Badge>
          ))}
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted"><X className="h-3 w-3" />Limpar</button>
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <table className="border-collapse text-left" style={{ width: 'max-content', minWidth: '100%' }}>
          <thead className="sticky top-0 z-20 bg-muted">
            <tr>
              <th className="sticky left-0 z-30 border border-border bg-muted p-0" style={{ width: 44, minWidth: 44 }}>
                {/* Issue #144: label preenchendo os 44px da célula em vez de
                    só o checkbox (16px) — área de toque confiável em mobile. */}
                <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                  <input type="checkbox" checked={displayedTasks.length > 0 && displayedTasks.every((task) => selectedTaskIds.has(task.id))} onChange={selectAllVisible} className="h-4 w-4 rounded border-border" aria-label="Selecionar tarefas visíveis" />
                </label>
              </th>
              {effectiveVisibleColumns.map((column) => {
                const width = prefs.columnWidths[column.id] ?? column.defaultWidth;
                const stickyClass = column.id === 'title' && prefs.stickyTitle ? 'sticky left-[44px] z-30 shadow-[8px_0_10px_-12px_rgba(0,0,0,0.45)]' : '';
                return (
                  <th key={column.id} draggable={!column.required} onDragStart={(e) => { setDraggedColumnId(column.id); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => { e.preventDefault(); setDragOverColumnId(column.id); }} onDrop={(e) => { e.preventDefault(); reorderColumn(column.id); setDraggedColumnId(null); setDragOverColumnId(null); }} onDragEnd={() => { setDraggedColumnId(null); setDragOverColumnId(null); }} className={`relative select-none border border-border bg-muted p-0 ${stickyClass} ${dragOverColumnId === column.id ? 'ring-2 ring-primary/40' : ''}`} style={{ width, minWidth: width, maxWidth: width }}>
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      {!column.required && <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <span className="flex-1 truncate text-xs font-semibold uppercase text-muted-foreground">{column.label}</span>
                    </div>
                    <div className="absolute right-0 top-0 z-40 h-full w-3 touch-none cursor-col-resize hover:bg-primary/40" onPointerDown={(e) => handleResizeMouseDown(e, column.id)} />
                  </th>
                );
              })}
              <th className="sticky right-0 z-30 border border-border bg-muted px-2 py-2" style={{ width: 48, minWidth: 48 }} />
            </tr>
          </thead>
          <tbody style={{ position: 'relative', height: `${rowVirtualizer.getTotalSize()}px` }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const task = displayedTasks[virtualRow.index];
              if (!task) return null;
              return (
                <tr
                  key={task.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  draggable={canReorderRows}
                  onDragStart={(e) => { if (!canReorderRows) { e.preventDefault(); toast.info('Remova filtros e ordenação para reordenar linhas.'); return; } setDraggedRowId(task.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { if (!canReorderRows) return; e.preventDefault(); setDragOverRowId(task.id); }}
                  onDrop={(e) => { e.preventDefault(); reorderRow(task.id); setDraggedRowId(null); setDragOverRowId(null); }}
                  onDragEnd={() => { setDraggedRowId(null); setDragOverRowId(null); }}
                  onClick={() => onTaskClick(task.id)}
                  className={`group cursor-pointer hover:bg-muted/40 ${dragOverRowId === task.id ? 'outline outline-2 outline-primary/40' : ''}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                >
                  <td className="sticky left-0 z-10 border border-border bg-background px-1 py-2 text-center group-hover:bg-muted/40" style={{ width: 44, minWidth: 44 }}>
                    <div className="flex items-center justify-center gap-0.5">
                      <GripVertical className={`h-4 w-4 shrink-0 ${canReorderRows ? 'text-muted-foreground' : 'text-muted-foreground/30'}`} />
                      {/* Issue #144: label aumenta a área de toque do checkbox
                          sem mudar a largura fixa da célula (44px, compartida
                          com o ícone de arrastar). */}
                      <label className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task.id)}
                          disabled={!canEditTaskInTable(task)}
                          title={canEditTaskInTable(task) ? undefined : 'Você não tem permissão para editar esta tarefa'}
                          onChange={() => toggleSelected(task.id)}
                          className="h-4 w-4 rounded border-border disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </label>
                    </div>
                  </td>
                  {effectiveVisibleColumns.map((column) => renderCell(task, column))}
                  <td className="sticky right-0 z-10 border border-border bg-background px-2 py-2 text-center group-hover:bg-muted/40" style={{ width: 48, minWidth: 48 }} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><button type="button" className="rounded p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Ações da tarefa"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => onTaskClick(task.id)}>Abrir tarefa</DropdownMenuItem>
                        {/* Issue #163: "Editar detalhes"/Duplicar/Mover/Excluir escondidos
                            quando o usuário não pode editar a tarefa — "Abrir"/"Copiar
                            link" continuam sempre disponíveis (visualizar é mais
                            permissivo que editar, mesma lógica da RLS tasks_select). */}
                        {canEditTaskInTable(task) && <DropdownMenuItem onClick={() => onTaskClick(task.id)}>Editar detalhes</DropdownMenuItem>}
                        {canEditTaskInTable(task) && onDuplicateTask && <DropdownMenuItem onClick={() => onDuplicateTask(task)}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => copyTaskLink(task.id)}><Copy className="mr-2 h-4 w-4" />Copiar link</DropdownMenuItem>
                        {canEditTaskInTable(task) && onBulkMove && <><DropdownMenuSeparator />{lists.map((list) => <DropdownMenuItem key={list.id} onClick={() => onBulkMove([task.id], list.id)}><FolderOpen className="mr-2 h-4 w-4" />Mover para {list.name}</DropdownMenuItem>)}</>}
                        {canEditTaskInTable(task) && onDeleteTask && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => onDeleteTask(task.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tbody>
            {displayedTasks.length === 0 && <tr><td colSpan={effectiveVisibleColumns.length + 2} className="border border-border px-4 py-12 text-center text-sm text-muted-foreground">Nenhuma tarefa encontrada na Tabela.</td></tr>}
            <tr className="bg-muted/20">
              <td className="sticky left-0 z-10 border border-border bg-muted/20 px-2 py-2" style={{ width: 44, minWidth: 44 }} />
              <td className={`${prefs.stickyTitle ? 'sticky left-[44px] z-10 bg-muted/20' : ''} border border-border px-3 py-2`} style={{ minWidth: prefs.columnWidths.title ?? DEFAULT_WIDTHS.title }}>
                <div className="flex min-w-[260px] items-center gap-2"><Plus className="h-4 w-4 shrink-0 text-muted-foreground" /><input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createInlineTask(); if (e.key === 'Escape') setNewTaskTitle(''); }} placeholder="Adicionar tarefa" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary" /></div>
              </td>
              <td className="border border-border px-3 py-2" colSpan={Math.max(effectiveVisibleColumns.length - 1, 1)}>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={newTaskListId} onChange={(e) => setNewTaskListId(e.target.value)} className="h-9 max-w-[240px] rounded-md border border-border bg-background px-2 text-sm"><option value="">Escolher lista</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select>
                  <Button size="sm" onClick={createInlineTask} disabled={!newTaskTitle.trim() || !onCreateTask}><Check className="mr-2 h-4 w-4" />Criar</Button>
                </div>
              </td>
              <td className="sticky right-0 z-10 border border-border bg-muted/20 px-2 py-2" />
            </tr>
          </tbody>
        </table>
      </div>

      {selectedTaskIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-md border border-border bg-foreground px-3 py-2 text-background shadow-2xl">
          <span className="whitespace-nowrap text-sm font-medium">{selectedTaskIds.size} selecionada(s)</span>
          {onBulkStatusChange && <select defaultValue="" onChange={(e) => { if (!e.target.value) return; onBulkStatusChange(Array.from(selectedTaskIds), e.target.value); setSelectedTaskIds(new Set()); e.target.value = ''; }} className="h-8 rounded border border-white/20 bg-black/20 px-2 text-sm"><option value="" disabled>Status</option>{availableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>}
          {onBulkPriorityChange && <select defaultValue="" onChange={(e) => { if (!e.target.value) return; onBulkPriorityChange(Array.from(selectedTaskIds), e.target.value as TaskPriority); setSelectedTaskIds(new Set()); e.target.value = ''; }} className="h-8 rounded border border-white/20 bg-black/20 px-2 text-sm"><option value="" disabled>Prioridade</option>{PRIORITY_VALUES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>}
          <select defaultValue="" onChange={(e) => e.target.value && runBulkUpdate({ mainAssigneeId: e.target.value })} className="h-8 rounded border border-white/20 bg-black/20 px-2 text-sm"><option value="" disabled>Responsável</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
          <DateFieldEditor value="" onCommit={(v) => v && runBulkUpdate({ dueDate: v })} className="h-8 rounded border border-white/20 bg-black/20 px-2 text-sm text-background" ariaLabel="Definir prazo para os selecionados" />
          <select defaultValue="" onChange={(e) => e.target.value && runBulkTagAdd(e.target.value)} className="h-8 rounded border border-white/20 bg-black/20 px-2 text-sm"><option value="" disabled>Tag</option>{availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
          {onBulkMove && <select defaultValue="" onChange={(e) => { if (!e.target.value) return; onBulkMove(Array.from(selectedTaskIds), e.target.value); setSelectedTaskIds(new Set()); e.target.value = ''; }} className="h-8 rounded border border-white/20 bg-black/20 px-2 text-sm"><option value="" disabled>Mover</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select>}
          {(onBulkDelete || onDeleteTask) && <button type="button" onClick={() => { const ids = Array.from(selectedTaskIds); if (onBulkDelete) onBulkDelete(ids); else if (ids.length === 1 && onDeleteTask) onDeleteTask(ids[0]); setSelectedTaskIds(new Set()); }} className="rounded px-2 py-1 text-sm text-red-300 hover:bg-white/10">Excluir</button>}
          <button type="button" onClick={() => setSelectedTaskIds(new Set())} className="rounded p-1.5 hover:bg-white/10" aria-label="Limpar seleção"><X className="h-4 w-4" /></button>
        </div>
      )}

      {!canReorderRows && <div className="border-t px-3 py-2 text-xs text-muted-foreground">Reordenação de linhas fica disponível quando filtros e ordenação estão limpos.</div>}
    </div>
  );
};
