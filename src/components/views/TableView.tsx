import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, ArrowUpDown, ChevronDown, CheckCircle2, 
  Circle, MoreHorizontal, Plus, GripVertical, Settings2
} from "lucide-react";
import { Task, CustomField, CustomFieldValue, Profile } from '../../types';
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
}

export const TableView: React.FC<TableViewProps> = ({
  tasks,
  customFields,
  fieldValues,
  users,
  onTaskClick,
  onUpdateTask,
  onUpdateFieldValue
}) => {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['title', 'status', 'priority', 'assignee', 'dueDate']);

  const columns = useMemo(() => {
    const base = [
      { id: 'title', label: 'Nome da Tarefa', width: 'flex-1 min-w-[300px]' },
      { id: 'status', label: 'Status', width: 'w-[150px]' },
      { id: 'priority', label: 'Prioridade', width: 'w-[120px]' },
      { id: 'assignee', label: 'Responsável', width: 'w-[180px]' },
      { id: 'dueDate', label: 'Prazo', width: 'w-[150px]' },
    ];

    const custom = customFields.map(f => ({
      id: `cf_${f.id}`,
      label: f.name,
      width: 'w-[150px]'
    }));

    return [...base, ...custom].filter(c => visibleColumns.includes(c.id) || c.id === 'title');
  }, [customFields, visibleColumns]);

  const getFieldValue = (taskId: string, fieldId: string) => {
    return fieldValues.find(v => v.entityId === taskId && v.fieldId === fieldId)?.value;
  };

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
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-muted/50 z-10">
            <tr>
              <th className="w-10 p-2 border-b border-r bg-muted/30"></th>
              {columns.map(col => (
                <th key={col.id} className={`${col.width} p-3 text-left text-xs font-semibold text-muted-foreground uppercase border-b border-r`}>
                  {col.label}
                </th>
              ))}
              <th className="w-10 p-2 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr 
                key={task.id} 
                className="group hover:bg-muted/30 transition-colors border-b last:border-0 cursor-pointer"
                onClick={() => onTaskClick(task.id)}
              >
                <td className="p-2 border-r text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-4 h-4 text-muted-foreground mx-auto" />
                </td>
                
                {/* Title Column */}
                {columns.find(c => c.id === 'title') && (
                  <td className="p-3 border-r font-medium border-l-4 border-l-transparent group-hover:border-l-primary transition-all">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-muted-foreground group-hover:border-primary flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTask(task.id, { status: 'Concluído' });
                        }}
                      >
                        <div className="w-2 h-2 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="truncate">{task.title}</span>
                    </div>
                  </td>
                )}

                {/* Status Column */}
                {columns.find(c => c.id === 'status') && (
                  <td className="p-3 border-r">
                    <Badge variant="outline" className="font-normal border-muted-foreground/30">
                      {task.status}
                    </Badge>
                  </td>
                )}

                {/* Priority Column */}
                {columns.find(c => c.id === 'priority') && (
                  <td className="p-3 border-r">
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
                  <td className="p-3 border-r text-sm text-muted-foreground">
                    {users.find(u => u.id === task.mainAssigneeId)?.name || 'Sem responsável'}
                  </td>
                )}

                {/* Due Date Column */}
                {columns.find(c => c.id === 'dueDate') && (
                  <td className="p-3 border-r text-sm text-muted-foreground">
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
                  
                  return (
                    <td key={col.id} className="p-3 border-r text-sm text-muted-foreground">
                      {field?.type === 'currency' ? `R$ ${val || '0,00'}` :
                       field?.type === 'progress' ? `${val || 0}%` :
                       String(val || '-')}
                    </td>
                  );
                })}

                <td className="p-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground mx-auto" />
                </td>
              </tr>
            ))}
            
            {/* New Task Row */}
            <tr className="border-b last:border-0">
               <td className="p-2 border-r"></td>
               <td className="p-3 border-r" colSpan={columns.length}>
                  <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Plus className="w-4 h-4" /> Adicionar tarefa
                  </button>
               </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
