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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" /> Filtros
          </Button>
          <Button variant="outline" size="sm">
            <ArrowUpDown className="w-4 h-4 mr-2" /> Ordenar
          </Button>
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
            {tasks.map((task, rowIndex) => (
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
                      ? format(new Date(task.dueDate), 'dd MMM yyyy', { locale: ptBR })
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
