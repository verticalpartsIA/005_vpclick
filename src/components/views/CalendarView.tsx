import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, 
  Search, Filter, Calendar as CalendarIcon, 
  ChevronDown, MoreHorizontal 
} from "lucide-react";
import { Task, Profile } from '../../types';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  format, addMonths, subMonths, startOfMonth, 
  endOfMonth, startOfWeek, endOfWeek, isSameMonth, 
  isSameDay, addDays, eachDayOfInterval 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarViewProps {
  tasks: Task[];
  users: Profile[];
  onTaskClick: (taskId: string) => void;
  onAddTaskAtDate: (date: Date) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  users,
  onTaskClick,
  onAddTaskAtDate
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getDayTasks = (day: Date) => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return isSameDay(taskDate, day);
    });
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-background"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 hover:bg-background"
                onClick={() => setCurrentDate(new Date())}
            >
              Hoje
            </Button>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-background"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="flex items-center bg-muted rounded-lg p-1 mr-4">
              <Button variant="ghost" size="sm" className="h-8 px-3 bg-background shadow-sm">Mês</Button>
              <Button variant="ghost" size="sm" className="h-8 px-3">Semana</Button>
              <Button variant="ghost" size="sm" className="h-8 px-3">Dia</Button>
           </div>
           <Button variant="outline" size="sm">
             <Filter className="w-4 h-4 mr-2" /> Filtros
           </Button>
           <Button size="sm" className="bg-primary hover:bg-primary/90">
             <Plus className="w-4 h-4 mr-2" /> Tarefa
           </Button>
        </div>
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto grid grid-cols-7 auto-rows-fr">
        {calendarDays.map((day, idx) => {
          const dayTasks = getDayTasks(day);
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, monthStart);

          return (
            <div 
              key={day.toISOString()} 
              className={`min-h-[140px] border-b border-r p-2 flex flex-col gap-1 transition-colors relative group
                ${!isCurrentMonth ? 'bg-muted/10 text-muted-foreground/50' : 'bg-background'}
                hover:bg-muted/20
              `}
              onDoubleClick={() => onAddTaskAtDate(day)}
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
                    onClick={() => onAddTaskAtDate(day)}
                >
                    <Plus className="w-3 h-3" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                {dayTasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={(e) => { e.stopPropagation(); onTaskClick(task.id); }}
                    className={`text-[11px] p-1.5 rounded border border-l-4 truncate cursor-pointer transition-all hover:scale-[1.02]
                      ${task.priority === 'Urgente' ? 'border-destructive bg-destructive/5 text-destructive-foreground' : 
                        task.priority === 'Alta' ? 'border-orange-500 bg-orange-500/5 text-orange-700' :
                        'border-primary bg-primary/5 text-primary-foreground'}
                    `}
                  >
                    <div className="flex items-center gap-1">
                       <div className={`w-1.5 h-1.5 rounded-full ${
                          task.status === 'Concluído' ? 'bg-green-500' : 'bg-blue-500'
                       }`} />
                       <span className={task.status === 'Concluído' ? 'line-through opacity-70' : ''}>
                         {task.title}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
