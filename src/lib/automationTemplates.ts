import type { AutomationTemplate } from '../types';

/**
 * SESSION_04 — Tarefa 5
 * Templates de automação prontos para uso.
 * O usuário escolhe um template e aplica na lista ativa.
 */
export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'tpl_status_done_notify',
    name: 'Notificar quando concluído',
    description: 'Envia uma notificação quando o status da tarefa muda para Concluído.',
    category: 'status',
    icon: '🎉',
    trigger_type: 'status_changed',
    trigger_config: { to: 'Concluído' },
    conditions: [],
    actions: [
      {
        type: 'send_notification',
        config: { message: 'Tarefa concluída com sucesso!' },
      },
    ],
  },
  {
    id: 'tpl_priority_urgent_assignee',
    name: 'Urgente → Adicionar responsável',
    description: 'Quando a prioridade muda para Urgente, adiciona um responsável à tarefa.',
    category: 'equipe',
    icon: '🚨',
    trigger_type: 'priority_changed',
    trigger_config: { to: 'Urgente' },
    conditions: [],
    actions: [
      {
        type: 'add_assignee',
        config: { userId: '' },
      },
    ],
  },
  {
    id: 'tpl_created_set_status',
    name: 'Tarefa criada → Definir status',
    description: 'Ao criar uma nova tarefa, define automaticamente o status inicial.',
    category: 'status',
    icon: '✨',
    trigger_type: 'task_created',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        type: 'change_status',
        config: { status: 'A fazer' },
      },
    ],
  },
  {
    id: 'tpl_due_date_notify',
    name: 'Prazo chegando → Notificar',
    description: 'Envia uma notificação 1 dia antes do prazo da tarefa.',
    category: 'prazo',
    icon: '⏰',
    trigger_type: 'due_date_arrives',
    trigger_config: { days_before: 1 },
    conditions: [],
    actions: [
      {
        type: 'send_notification',
        config: { message: 'Atenção: o prazo desta tarefa é amanhã!' },
      },
    ],
  },
  {
    id: 'tpl_moved_change_status',
    name: 'Tarefa movida → Alterar status',
    description: 'Quando a tarefa é movida para outra lista, atualiza o status para Em andamento.',
    category: 'status',
    icon: '📦',
    trigger_type: 'task_moved',
    trigger_config: {},
    conditions: [],
    actions: [
      {
        type: 'change_status',
        config: { status: 'Em andamento' },
      },
    ],
  },
  {
    id: 'tpl_review_add_tag',
    name: 'Em revisão → Adicionar tag',
    description: 'Quando o status muda para Em revisão, adiciona a tag "revisão" automaticamente.',
    category: 'qualidade',
    icon: '🔍',
    trigger_type: 'status_changed',
    trigger_config: { to: 'Em revisão' },
    conditions: [],
    actions: [
      {
        type: 'add_tag',
        config: { tag: 'revisão' },
      },
    ],
  },
];
