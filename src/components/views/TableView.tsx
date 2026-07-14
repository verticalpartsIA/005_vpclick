import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Filter, ArrowUpDown, CheckCircle2,
  MoreHorizontal, Plus, GripVertical, Settings2, AlertTriangle
} from "lucide-react";
import { Task, CustomField, CustomFieldValue, Profile, WorkspaceTag } from '../../types';
import { TagBadge } from '@/components/TagBadge';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TableViewProps {
  tasks: Task[];
  customFields: CustomField[];
  fieldValues: CustomFieldValue[];
  users: Profile[];
  onTaskClick: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onUpdateFieldValue: (taskId: string, fieldId: string, value: any) => void;
  workspaceTags?: WorkspaceTag[];
}

const DEFAULT_WIDTHS: Record<string, number> = {
  title: 320,
  status: 150,
  priority: 120,
  assignee: 180,
  dueDate: 150,
};

export const TableView: React.FC<TableViewProps> = ({
  tasks,
  customFields,
  fieldValues,
  users,
  onTaskClick,
  onUpdateTask,
  onUpdateFieldValue,
  workspaceTags = [],
}) => {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['title', 'status', 'priority', 'assignee', 'dueDate']);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS);
  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  // ── Filtros e ordenação ──────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'dueDate' | 'priority' | 'title' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const allStatuses = useMemo(() => [...new Set(tasks.map(t => t.status).filter(Boolean))], [tasks]);
  const PRIORITY_ORDER: Record<string, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };

  const displayedTasks = useMemo(() => {
    let result = tasks;
    if (filterStatus.length > 0) result = result.filter(t => filterStatus.includes(t.status));
    if (filterPriority.length > 0) result = result.filter(t => filterPriority.includes(t.priority));
    if (sortField === 'dueDate') result = [...result].sort((a, b) => {
      const av = a.dueDate || '9999', bv = b.dueDate || '9999';
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    if (sortField === 'priority') result = [...result].sort((a, b) => {
      const av = PRIORITY_ORDER[a.priority] ?? 99, bv = PRIORITY_ORDER[b.priority] ?? 99;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    if (sortField === 'title') result = [...result].sort((a, b) =>
      sortDir === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
    );
    return result;
  }, [tasks, filterStatus, filterPriority, sortField, sortDir]);

  const activeFilterCount = filterStatus.length + filterPriority.length;

  const columns = useMemo(() => {
    const base = [
      { id: 'title', label: 'Nome da Tarefa' },
      { id: 'status', label: 'Status' },
      { id: 'priority', label: 'Prioridade' },
      { id: 'assignee', label: 'Responsável' },
      { id: 'dueDate', label: 'Prazo' },
    ];

    const custom = customFields.map(f => ({
      id: `cf_${f.id}`,
      label: f.name,
    }));

    return [...base, ...custom].filter(c => visibleColumns.includes(c.id) || c.id === 'title');
  }, [customFields, visibleColumns]);

  const getFieldValue = (taskId: string, fieldId: string) => {
    return fieldValues.find(v => v.entityId === taskId && v.fieldId === fieldId)?.value;
  };

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[colId] ?? 150;
    resizingRef.current = { colId, startX: e.clientX, startWidth };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + delta);
      setColumnWidths(prev => ({ ...prev, [resizingRef.current!.colId]: newWidth }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Table Header Controls */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 relative">
          {/* Filtros */}
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => { setShowFilterMenu(p => !p); setShowSortMenu(false); }}
              className={activeFilterCount > 0 ? 'border-primary text-primary' : ''}>
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {activeFilterCount > 0 && <span className="ml-1.5 bg-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>}
            </Button>
            {showFilterMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border rounded-xl shadow-lg z-30 w-64 p-3 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</p>
                  <div className="flex flex-wrap gap-1">
                    {allStatuses.map(s => (
                      <button key={s} onClick={() => setFilterStatus(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
                        className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all ${filterStatus.includes(s) ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Prioridade</p>
                  <div className="flex flex-wrap gap-1">
                    {['URGENTE', 'ALTA', 'MEDIA', 'BAIXA'].map(p => (
                      <button key={p} onClick={() => setFilterPriority(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                        className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all ${filterPriority.includes(p) ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={() => { setFilterStatus([]); setFilterPriority([]); }} className="text-[11px] text-red-400 hover:text-red-600 font-semibold w-full text-right">Limpar filtros</button>
                )}
              </div>
            )}
          </div>

          {/* Ordenar */}
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => { setShowSortMenu(p => !p); setShowFilterMenu(false); }}
              className={sortField ? 'border-primary text-primary' : ''}>
              <ArrowUpDown className="w-4 h-4 mr-2" /> Ordenar
              {sortField && <span className="ml-1.5 text-[10px] font-semibold opacity-70">{sortDir === 'asc' ? '↑' : '↓'}</span>}
            </Button>
            {showSortMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border rounded-xl shadow-lg z-30 w-48 py-1">
                {([['title', 'Nome'], ['dueDate', 'Prazo'], ['priority', 'Prioridade']] as const).map(([field, label]) => (
                  <button key={field} onClick={() => {
                    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                    else { setSortField(field); setSortDir('asc'); }
                    setShowSortMenu(false);
                  }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${sortField === field ? 'font-bold text-primary' : 'text-gray-700'}`}>
                    {label}
                    {sortField === field && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ))}
                {sortField && <button onClick={() => { setSortField(null); setShowSortMenu(false); }} className="w-full text-left px-4 py-2 text-[11px] text-red-400 hover:text-red-600 font-semibold">Remover ordenação</button>}
              </div>
            )}
          </div>

          {/* Clique fora fecha os menus */}
          {(showFilterMenu || showSortMenu) && (
            <div className="fixed inset-0 z-20" onClick={() => { setShowFilterMenu(false); setShowSortMenu(false); }} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="w-4 h-4 mr-2" /> Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {['status', 'priority', 'assignee', 'dueDate', ...customFields.map(f => `cf_${f.id}`)].map(colId => (
                <DropdownMenuItem
                  key={colId}
                  className="flex items-center justify-between"
                  onClick={() => setVisibleColumns(prev =>
                    prev.includes(colId) ? prev.filter(p => p !== colId) : [...prev, colId]
                  )}
                >
                  {colId.startsWith('cf_') ? customFields.find(f => `cf_${f.id}` === colId)?.name : colId}
                  {visibleColumns.includes(colId) && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
          <thead className="sticky top-0 bg-muted/80 z-10">
            <tr>
              <th className="p-2 border border-border bg-muted/60" style={{ width: 36 }}></th>
              {columns.map(col => {
                const w = columnWidths[col.id] ?? 150;
                return (
                  <th
                    key={col.id}
                    className="p-0 text-left border border-border bg-muted/60 relative select-none"
                    style={{ width: w, minWidth: w, maxWidth: w }}
                  >
                    <div className="flex items-center px-3 py-2.5 gap-1 overflow-hidden">
                      <span className="text-xs font-semibold text-muted-foreground uppercase truncate flex-1">
                        {col.label}
                      </span>
                    </div>
                    {/* Resize handle */}
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-20"
                      onMouseDown={(e) => handleResizeMouseDown(e, col.id)}
                    />
                  </th>
                );
              })}
              <th className="p-2 border border-border bg-muted/60" style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {displayedTasks.map((task, rowIndex) => (
              <tr
                key={task.id}
                className="group hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onTaskClick(task.id)}
              >
                <td className="p-2 border border-border text-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 36 }}>
                  <GripVertical className="w-4 h-4 text-muted-foreground mx-auto" />
                </td>

                {/* Title Column */}
                {columns.find(c => c.id === 'title') && (
                  <td
                    className="p-3 border border-border font-medium border-l-4 border-l-transparent group-hover:border-l-primary transition-all overflow-hidden"
                    style={{ width: columnWidths['title'] ?? 320, maxWidth: columnWidths['title'] ?? 320 }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 shrink-0 rounded-full border border-muted-foreground group-hover:border-primary flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTask(task.id, { status: 'Concluído' });
                        }}
                      >
                        <div className="w-2 h-2 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {task.dependencies?.some(d => d.type === 'blocked_by') && (
                        <span title="Tarefa bloqueada" className="inline-flex items-center shrink-0">
                          <AlertTriangle className="w-3 h-3 text-amber-400 mr-1" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="truncate block">{task.title}</span>
                        {(task.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(task.tags ?? []).map((tagName) => {
                              const tag = workspaceTags.find((t) => t.name === tagName);
                              if (!tag) return null;
                              return <TagBadge key={tagName} name={tag.name} color={tag.color} size="xs" />;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                )}

                {/* Status Column */}
                {columns.find(c => c.id === 'status') && (
                  <td
                    className="p-3 border border-border overflow-hidden"
                    style={{ width: columnWidths['status'] ?? 150, maxWidth: columnWidths['status'] ?? 150 }}
                  >
                    <Badge variant="outline" className="font-normal border-muted-foreground/30 truncate max-w-full">
                      {task.status}
                    </Badge>
                  </td>
                )}

                {/* Priority Column */}
                {columns.find(c => c.id === 'priority') && (
                  <td
                    className="p-3 border border-border overflow-hidden"
                    style={{ width: columnWidths['priority'] ?? 120, maxWidth: columnWidths['priority'] ?? 120 }}
                  >
                    <span className={`text-sm font-medium ${
                      task.priority === 'Urgente' ? 'text-destructive' :
                      task.priority === 'Alta' ? 'text-orange-500' :
                      task.priority === 'Media' ? 'text-blue-500' : 'text-muted-foreground'
                    }`}>
                      {task.priority || 'Normal'}
                    </span>
                  </td>
                )}

                {/* Assignee Column */}
                {columns.find(c => c.id === 'assignee') && (
                  <td
                    className="p-3 border border-border text-sm text-muted-foreground overflow-hidden"
                    style={{ width: columnWidths['assignee'] ?? 180, maxWidth: columnWidths['assignee'] ?? 180 }}
                  >
                    <span className="truncate block">
                      {users.find(u => u.id === task.mainAssigneeId)?.name || 'Sem responsável'}
                    </span>
                  </td>
                )}

                {/* Due Date Column */}
                {columns.find(c => c.id === 'dueDate') && (
                  <td
                    className="p-3 border border-border text-sm text-muted-foreground overflow-hidden"
                    style={{ width: columnWidths['dueDate'] ?? 150, maxWidth: columnWidths['dueDate'] ?? 150 }}
                  >
                    {task.dueDate && !isNaN(new Date(task.dueDate).getTime())
                      ? (() => {
                          // "YYYY-MM-DD" interpretado como UTC cai no dia anterior
                          // em fusos atrás de UTC — parseamos como data local.
                          const [y, m, d] = task.dueDate.split('T')[0].split('-').map(Number);
                          return format(new Date(y, m - 1, d), 'dd MMM yyyy', { locale: ptBR });
                        })()
                      : '-'}
                  </td>
                )}

                {/* Custom Fields Columns */}
                {columns.filter(c => c.id.startsWith('cf_')).map(col => {
                  const fieldId = col.id.replace('cf_', '');
                  const field = customFields.find(f => f.id === fieldId);
                  const val = getFieldValue(task.id, fieldId);
                  const w = columnWidths[col.id] ?? 150;

                  return (
                    <td
                      key={col.id}
                      className="p-3 border border-border text-sm text-muted-foreground overflow-hidden"
                      style={{ width: w, maxWidth: w }}
                    >
                      <span className="truncate block">
                        {field?.type === 'currency' ? `R$ ${val || '0,00'}` :
                         field?.type === 'progress' ? `${val || 0}%` :
                         String(val || '-')}
                      </span>
                    </td>
                  );
                })}

                <td className="p-2 border border-border text-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 36 }}>
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground mx-auto" />
                </td>
              </tr>
            ))}

            {/* New Task Row */}
            <tr>
               <td className="p-2 border border-border" style={{ width: 36 }}></td>
               <td className="p-3 border border-border" colSpan={columns.length}>
                  <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Plus className="w-4 h-4" /> Adicionar tarefa
                  </button>
               </td>
               <td className="p-2 border border-border" style={{ width: 36 }}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
