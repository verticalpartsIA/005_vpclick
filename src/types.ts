
export enum UserRole {
  ADMIN = 'ADMIN',
  GESTOR = 'GESTOR',
  COLABORADOR = 'COLABORADOR'
}

export type StatusType = 'START' | 'ACTIVE' | 'DONE' | 'CANCELLED';

export interface StatusOption {
  id: string;
  groupId: string;
  label: string;
  color: string;
  type: StatusType;
  orderIndex: number;
}

export interface StatusGroup {
  id: string;
  name: string;
  options: StatusOption[];
}

export enum TaskPriority {
  BAIXA = 'Baixa',
  MEDIA = 'Média',
  ALTA = 'Alta',
  URGENTE = 'Urgente'
}

export enum CustomFieldType {
  DROPDOWN = 'Lista Suspensa',
  TEXT = 'Texto',
  TEXTAREA = 'Área de Texto',
  DATE = 'Data',
  NUMBER = 'Número',
  LABELS = 'Rótulos',
  CHECKBOX = 'Caixa de Seleção',
  MONEY = 'Dinheiro',
  WEBSITE = 'Site'
}

export interface CustomFieldOption {
  id: string;
  label: string;
  color: string;
  icon?: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  isMandatory: boolean;
  defaultValue?: any;
  config?: {
    options?: CustomFieldOption[];
    currency?: string;
    precision?: number;
    allowTime?: boolean;
    min?: number;
    max?: number;
  };
  target: 'TASK' | 'LIST' | 'PROJECT';
  visibleTo: UserRole[];
  createdBy: string;
  createdAt: string;
}

export interface CustomFieldValue {
  fieldId: string;
  entityId: string; // ID da Tarefa, Lista ou Projeto
  value: any;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  email: string;
  theme?: string;
}

export interface ExtensionLog {
  id: string;
  oldDate: string;
  newDate: string;
  reason: string;
  updatedBy: string;
  timestamp: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  timestamp: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  type: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: TaskPriority;
  mainAssigneeId: string;
  secondaryAssigneeIds: string[];
  startDate: string;
  dueDate: string;
  extensionCount: number;
  extensionHistory: ExtensionLog[];
  checklists: ChecklistItem[];
  comments: Comment[];
  attachments: Attachment[];
  activities: TaskActivity[];
  listId: string;
  projectId: string;
  parentId?: string;
  createdAt?: string;
  dependencies?: TaskDependency[];
  tags?: string[];
}

// ── Task Dependencies ─────────────────────────────────────
export type DependencyType = 'blocks' | 'blocked_by' | 'relates_to';

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
  type: DependencyType;
  created_by: string | null;
  created_at: string;
  depends_on_task?: Pick<Task, 'id' | 'title' | 'status' | 'priority'>;
}

export interface List {
  id: string;
  name: string;
  folderId: string;
  statusGroupId: string;
}

export interface Folder {
  id: string;
  name: string;
  spaceId: string;
}

export interface Space {
  id: string;
  name: string;
  workspaceId: string;
  color: string;
  icon?: string;
}

export interface Workspace {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  department: string;
  managerId: string;
  status: 'Ativo' | 'Pausado' | 'Concluído';
  lists: string[];
}

export interface Doc {
  id: string;
  title: string;
  content: string;
  headerImage?: string;
  folderId: string;
  createdBy: string;
  attachments: Attachment[];
}

export interface WorkspaceTag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

// ── Automations ───────────────────────────────────────────

export type AutomationTriggerType =
  | 'status_changed'
  | 'priority_changed'
  | 'assignee_changed'
  | 'due_date_arrives'
  | 'task_created'
  | 'task_moved'
  | 'custom_field_changed';

export type AutomationActionType =
  | 'change_status'
  | 'change_priority'
  | 'add_assignee'
  | 'remove_assignee'
  | 'post_comment'
  | 'add_tag'
  | 'remove_tag'
  | 'send_notification'
  | 'create_task'
  | 'create_subtask';

export type AutomationConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'is_empty'
  | 'is_not_empty';

export interface AutomationCondition {
  field: string;
  operator: AutomationConditionOperator;
  value?: string;
}

export interface AutomationAction {
  type: AutomationActionType;
  config: Record<string, unknown>;
}

export interface AutomationTriggerConfig {
  from?: string;
  to?: string;
  field_id?: string;
  days_before?: number;
}

export interface Automation {
  id: string;
  workspace_id: string | null;
  list_id: string | null;
  name: string;
  enabled: boolean;
  trigger_type: AutomationTriggerType;
  trigger_config: AutomationTriggerConfig;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  run_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  task_id: string | null;
  triggered_by: string;
  status: 'success' | 'error' | 'skipped';
  actions_taken: AutomationAction[];
  error_message: string | null;
  executed_at: string;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'status' | 'prazo' | 'equipe' | 'qualidade';
  icon: string;
  trigger_type: AutomationTriggerType;
  trigger_config: AutomationTriggerConfig;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}
