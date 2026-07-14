import React, { useMemo, useState } from 'react';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  Maximize2, Filter, Settings2, Plus, ArrowRight
} from "lucide-react";
import { Task } from '../../types';
import { Button } from "@/components/ui/button";
import { 
  format, startOfToday, addDays, subDays, 
  differenceInDays, startOfWeek, endOfWeek, 
  eachDayOfInterval, isWeekend, isToday 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GanttViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

export const GanttView: React.FC<GanttViewProps> = ({ tasks, onTaskClick }) => {
  const [zoomLevel, setZoomLevel] = useState(30); // pixels per day
  const [viewStart, setViewStart] = useState(subDays(startOfToday(), 7));

  const timelineDays = useMemo(() => {
    return eachDayOfInterval({
      start: viewStart,
      end: addDays(viewStart, 60),
    });
  }, [viewStart]);

  const taskBars = useMemo(() => {
    // task.startDate/dueDate são "YYYY-MM-DD" (sem hora); `new Date(string)`
    // interpreta isso como meia-noite UTC, que em fusos atrás de UTC cai no
    // dia anterior ao comparar com `viewStart` (local). Parseamos manualmente.
    const parseLocalDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    return tasks.filter(t => t.startDate || t.dueDate).map(task => {
      const start = task.startDate ? parseLocalDate(task.startDate) : parseLocalDate(task.dueDate!);
      const end = task.dueDate ? parseLocalDate(task.dueDate) : parseLocalDate(task.startDate!);
      
      const left = differenceInDays(start, viewStart) * zoomLevel;
      const duration = Math.max(1, differenceInDays(end, start) + 1);
      const width = duration * zoomLevel;

      return {
        ...task,
        left,
        width,
        isOverlapping: left < 0 && (left + width) < 0
      };
    }).filter(b => !b.isOverlapping);
  }, [tasks, viewStart, zoomLevel]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Gantt Toolbar */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setViewStart(subDays(viewStart, 7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewStart(new Date())}>Hoje</Button>
          <Button variant="outline" size="sm" onClick={() => setViewStart(addDays(viewStart, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold capitalize">
            {format(viewStart, 'MMMM yyyy', { locale: ptBR })}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="flex items-center bg-muted rounded-lg p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(Math.max(15, zoomLevel - 5))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(Math.min(100, zoomLevel + 5))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
           </div>
           <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" /> Filtros</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Task Labels Sidebar */}
        <div className="w-64 border-r flex flex-col bg-muted/5">
          <div className="h-16 border-b flex items-center px-4 font-semibold text-xs text-muted-foreground uppercase">
            Tarefa
          </div>
          <div className="flex-1 overflow-hidden">
            {tasks.map(task => (
              <div key={task.id} className="h-10 border-b flex items-center px-4 text-sm truncate hover:bg-muted/10 cursor-pointer transition-colors"
                onClick={() => onTaskClick(task.id)}>
                {task.title}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Grid */}
        <div className="flex-1 overflow-auto relative custom-scrollbar">
          {/* Timeline Header */}
          <div className="h-16 border-b flex sticky top-0 bg-background z-20" style={{ width: timelineDays.length * zoomLevel }}>
            {timelineDays.map(day => (
              <div key={day.toISOString()} 
                className={`flex-shrink-0 border-r text-[10px] flex flex-col items-center justify-center
                  ${isWeekend(day) ? 'bg-muted/30' : ''}
                  ${isToday(day) ? 'bg-primary/5' : ''}
                `}
                style={{ width: zoomLevel }}>
                <span className="text-muted-foreground">{format(day, 'eee', { locale: ptBR })}</span>
                <span className={`font-bold ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</span>
              </div>
            ))}
          </div>

          {/* Timeline Body */}
          <div className="relative" style={{ width: timelineDays.length * zoomLevel }}>
            {/* Grid Lines */}
            <div className="absolute inset-0 flex pointer-events-none">
               {timelineDays.map(day => (
                 <div key={`line-${day.toISOString()}`} 
                    className={`border-r h-full ${isWeekend(day) ? 'bg-muted/10' : ''} ${isToday(day) ? 'border-primary/20' : ''}`}
                    style={{ width: zoomLevel }} 
                 />
               ))}
            </div>

            {/* Dependency arrows */}
            <svg 
              className="absolute inset-0 pointer-events-none z-0" 
              style={{ width: timelineDays.length * zoomLevel, height: tasks.length * 40 }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
              </defs>
              {tasks.flatMap((task, taskIdx) => {
                const dependencies = (task as any).dependencies || [];
                return dependencies.map((dep: any) => {
                  const targetTaskIndex = tasks.findIndex(t => t.id === dep.depends_on_id);
                  if (targetTaskIndex === -1) return null;

                  const sourceBar = taskBars.find(b => b.id === dep.depends_on_id);
                  const targetBar = taskBars.find(b => b.id === task.id);

                  if (!sourceBar || !targetBar) return null;

                  const x1 = sourceBar.left + sourceBar.width;
                  const y1 = (targetTaskIndex * 40) + 20; // 40 is row height, 20 is center
                  const x2 = targetBar.left;
                  const y2 = (taskIdx * 40) + 20;

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
              {tasks.map((task, idx) => {
                const bar = taskBars.find(b => b.id === task.id);
                return (
                  <div key={task.id} className="h-10 border-b flex items-center relative group">
                    {bar && (
                      <div 
                        className={`absolute h-6 rounded-md shadow-sm flex items-center px-2 text-[10px] text-white font-medium cursor-pointer transition-all hover:brightness-110
                          ${task.priority === 'Urgente' ? 'bg-destructive' : 'bg-primary'}
                        `}
                        style={{ left: bar.left, width: bar.width }}
                        onClick={() => onTaskClick(task.id)}
                      >
                         <span className="truncate">{task.title}</span>
                         
                         {/* Dependency Handles (Mock for UI) */}
                         <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-primary opacity-0 group-hover:opacity-100" />
                         <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-primary opacity-0 group-hover:opacity-100" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* SVG arrows for dependencies would be rendered here */}
          </div>
        </div>
      </div>
    </div>
  );
};
