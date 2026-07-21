import type {
  Automation,
  AutomationAction,
  AutomationCondition,
  Task,
} from '../types';
import { supabase } from './supabase';

export interface AutomationContext {
  previousTask?: Partial<Task>;
  triggerType: string;
  workspaceId: string;
  currentUserId: string;
}

export interface AutomationCallbacks {
  onChangeStatus?:    (taskId: string, status: string)   => Promise<void> | void;
  onChangePriority?:  (taskId: string, priority: string) => Promise<void> | void;
  onAddAssignee?:     (taskId: string, userId: string)   => Promise<void> | void;
  onRemoveAssignee?:  (taskId: string, userId: string)   => Promise<void> | void;
  onPostComment?:     (taskId: string, text: string)     => Promise<void> | void;
  onAddTag?:          (taskId: string, tag: string)      => Promise<void> | void;
  onRemoveTag?:       (taskId: string, tag: string)      => Promise<void> | void;
  onCreateTask?:      (taskData: Partial<Task>)          => Promise<void> | void;
  onCreateSubtask?:   (parentId: string, taskData: Partial<Task>) => Promise<void> | void;
  onSendNotification?:(message: string, userId?: string) => void;
}

export class AutomationEngine {
  constructor(private automations: Automation[]) {}

  async evaluate(
    task: Task,
    context: AutomationContext,
    callbacks: AutomationCallbacks
  ): Promise<void> {
    const applicable = this.automations.filter(
      (a) =>
        a.enabled &&
        a.trigger_type === context.triggerType &&
        (a.list_id === null || a.list_id === task.listId)
    );

    for (const automation of applicable) {
      try {
        const triggered = this.checkTrigger(automation, task, context);
        if (!triggered) continue;

        const conditionsMet = this.checkConditions(automation.conditions, task);
        if (!conditionsMet) {
          await this.writeLog(automation.id, task.id, context.triggerType, 'skipped', []);
          continue;
        }

        const actionsTaken: AutomationAction[] = [];
        for (const action of automation.actions) {
          await this.executeAction(action, task, callbacks);
          actionsTaken.push(action);
        }

        await this.writeLog(automation.id, task.id, context.triggerType, 'success', actionsTaken);

        await supabase
          .from('automations')
          .update({ run_count: (automation.run_count ?? 0) + 1 })
          .eq('id', automation.id);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.writeLog(automation.id, task.id, context.triggerType, 'error', [], msg);
        console.error(`[AutomationEngine] Error in "${automation.name}":`, err);
      }
    }
  }

  private checkTrigger(
    automation: Automation,
    task: Task,
    context: AutomationContext
  ): boolean {
    const cfg = automation.trigger_config ?? {};
    const prev = context.previousTask;

    switch (automation.trigger_type) {
      case 'status_changed':
        if (cfg.from && prev?.status !== cfg.from) return false;
        if (cfg.to && task.status !== cfg.to) return false;
        return prev?.status !== task.status;

      case 'priority_changed':
        if (cfg.from && prev?.priority !== cfg.from) return false;
        if (cfg.to && task.priority !== cfg.to) return false;
        return prev?.priority !== task.priority;

      case 'assignee_changed':
        return prev?.mainAssigneeId !== task.mainAssigneeId;

      case 'due_date_arrives': {
        if (!task.dueDate) return false;
        const daysAhead = cfg.days_before ?? 0;
        // task.dueDate é "YYYY-MM-DD" (sem hora); `new Date(string)` interpreta
        // isso como meia-noite UTC, que em fusos atrás de UTC cai no dia
        // anterior ao ler os componentes locais abaixo. Parseamos manualmente.
        const [dueY, dueM, dueD] = task.dueDate.split('T')[0].split('-').map(Number);
        const due = new Date(dueY, dueM - 1, dueD);
        const target = new Date();
        target.setDate(target.getDate() + daysAhead);
        return (
          due.getFullYear() === target.getFullYear() &&
          due.getMonth() === target.getMonth() &&
          due.getDate() === target.getDate()
        );
      }

      case 'task_created':
        return context.triggerType === 'task_created';

      case 'task_moved':
        return prev?.listId !== task.listId;

      case 'custom_field_changed':
        return context.triggerType === 'custom_field_changed';

      default:
        return false;
    }
  }

  private checkConditions(conditions: AutomationCondition[], task: Task): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((cond) => {
      const taskValue = String((task as unknown as Record<string, unknown>)[cond.field] ?? '');
      switch (cond.operator) {
        case 'equals':       return taskValue === cond.value;
        case 'not_equals':   return taskValue !== cond.value;
        case 'contains':     return taskValue.toLowerCase().includes((cond.value ?? '').toLowerCase());
        case 'is_empty':     return !taskValue || taskValue === '[]';
        case 'is_not_empty': return !!taskValue && taskValue !== '[]';
        default:             return true;
      }
    });
  }

  private async executeAction(
    action: AutomationAction,
    task: Task,
    cb: AutomationCallbacks
  ): Promise<void> {
    const cfg = action.config as Record<string, string>;
    switch (action.type) {
      case 'change_status':    await cb.onChangeStatus?.(task.id, cfg.status);            break;
      case 'change_priority':  await cb.onChangePriority?.(task.id, cfg.priority);        break;
      case 'add_assignee':     await cb.onAddAssignee?.(task.id, cfg.userId);             break;
      case 'remove_assignee':  await cb.onRemoveAssignee?.(task.id, cfg.userId);          break;
      case 'post_comment':     await cb.onPostComment?.(task.id, cfg.text);               break;
      case 'add_tag':          await cb.onAddTag?.(task.id, cfg.tag);                     break;
      case 'remove_tag':       await cb.onRemoveTag?.(task.id, cfg.tag);                  break;
      case 'send_notification': cb.onSendNotification?.(cfg.message, cfg.userId);         break;
      case 'create_task':      await cb.onCreateTask?.({ title: cfg.title, listId: cfg.listId }); break;
      case 'create_subtask':   await cb.onCreateSubtask?.(task.id, { title: cfg.title }); break;
    }
  }

  private async writeLog(
    automationId: string,
    taskId: string,
    triggeredBy: string,
    status: 'success' | 'error' | 'skipped',
    actionsTaken: AutomationAction[],
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabase.from('automation_logs').insert({
        automation_id: automationId,
        task_id: taskId,
        triggered_by: triggeredBy,
        status,
        actions_taken: actionsTaken,
        error_message: errorMessage ?? null,
      });
    } catch (err) {
      console.warn('[AutomationEngine] Failed to write log:', err);
    }
  }

  // ── Static helpers mantidos para compatibilidade ──────────
  static evaluateConditions(task: Task, conditions: AutomationCondition[]): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((cond) => {
      const taskValue = (task as unknown as Record<string, unknown>)[cond.field];
      switch (cond.operator) {
        case 'equals':     return taskValue === cond.value;
        case 'not_equals': return taskValue !== cond.value;
        case 'contains':   return String(taskValue).includes(cond.value ?? '');
        default:           return true;
      }
    });
  }
}
