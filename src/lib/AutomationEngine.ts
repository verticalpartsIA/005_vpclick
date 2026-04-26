import { Task, CustomField } from '../types';

export interface AutomationTrigger {
  type: 'status_changed' | 'priority_changed' | 'assignee_changed' | 'due_date_arrives';
  params?: any;
}

export interface AutomationAction {
  type: 'change_status' | 'add_assignee' | 'send_notification' | 'create_task';
  params: any;
}

export interface Automation {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: any[];
  actions: AutomationAction[];
}

export class AutomationEngine {
  static evaluateConditions(task: Task, conditions: any[]): boolean {
    if (!conditions || conditions.length === 0) return true;
    
    return conditions.every(condition => {
      const { field, operator, value } = condition;
      const taskValue = (task as any)[field];

      switch (operator) {
        case 'equals': return taskValue === value;
        case 'not_equals': return taskValue !== value;
        case 'contains': return String(taskValue).includes(value);
        default: return true;
      }
    });
  }

  static async executeActions(task: Task, actions: AutomationAction[], context: { updateTask: Function, notify: Function }) {
    for (const action of actions) {
      switch (action.type) {
        case 'change_status':
          await context.updateTask(task.id, { status: action.params.status });
          break;
        case 'add_assignee':
          const newAssignees = Array.from(new Set([...(task.secondaryAssigneeIds || []), action.params.userId]));
          await context.updateTask(task.id, { secondaryAssigneeIds: newAssignees });
          break;
        case 'send_notification':
          context.notify(action.params.message);
          break;
      }
    }
  }
}
