import { Workspace, User, UserRole, Space, Folder, List, Project, Task, TaskPriority, CustomField, CustomFieldType, CustomFieldValue } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Ricardo Admin', email: 'ricardo@nexus.com', avatar: 'https://picsum.photos/seed/u1/100', role: UserRole.ADMIN },
  { id: 'u2', name: 'Ana Gestora', email: 'ana@nexus.com', avatar: 'https://picsum.photos/seed/u2/100', role: UserRole.GESTOR },
  { id: 'u3', name: 'Bruno Colab', email: 'bruno@nexus.com', avatar: 'https://picsum.photos/seed/u3/100', role: UserRole.COLABORADOR },
];

export const INITIAL_WORKSPACE: Workspace = { id: '00000000-0000-0000-0000-000000000001', name: 'VERTICALPARTS' };

export const MOCK_SPACES: Space[] = [
  { id: 's1', name: 'Comercial', workspaceId: '00000000-0000-0000-0000-000000000001', color: '#ffce05', icon: 'Chart' },
  { id: 's2', name: 'Engenharia', workspaceId: '00000000-0000-0000-0000-000000000001', color: '#3b82f6', icon: 'Settings' },
  { id: 's3', name: 'Marketing', workspaceId: '00000000-0000-0000-0000-000000000001', color: '#ec4899', icon: 'Users' },
];

export const MOCK_FOLDERS: Folder[] = [
  { id: 'f1', name: 'Projetos 2026', spaceId: 's1' },
  { id: 'f2', name: 'Clientes Ativos', spaceId: 's1' },
];

export const MOCK_LISTS: List[] = [
  { id: 'l1', name: 'Vendas Q1', folderId: 'f1', statusGroupId: 'sg-default' },
  { id: 'l2', name: 'Expansão LATAM', folderId: 'f1', statusGroupId: 'sg-default' },
];

export const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'Sistema Novo ERP', department: 'Engenharia', managerId: 'u2', status: 'Ativo', lists: ['l1', 'l2'] },
];

export const MOCK_CUSTOM_FIELDS: CustomField[] = [
  {
    id: 'cf1',
    name: 'Valor do Contrato',
    type: CustomFieldType.MONEY,
    isMandatory: true,
    target: 'TASK',
    visibleTo: [UserRole.ADMIN, UserRole.GESTOR],
    config: { currency: 'BRL' },
    createdBy: 'u1',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'cf2',
    name: 'Departamento Responsável',
    type: CustomFieldType.DROPDOWN,
    isMandatory: false,
    target: 'TASK',
    visibleTo: [UserRole.ADMIN, UserRole.GESTOR, UserRole.COLABORADOR],
    config: {
      options: [
        { id: 'dept_marketing', label: 'Marketing', color: '#db2777' },
        { id: 'dept_financeiro', label: 'ADM / Financeiro', color: '#eab308' },
        { id: 'dept_comercial', label: 'Comercial', color: '#9333ea' },
        { id: 'dept_pcp', label: 'PCP', color: '#3b82f6' },
        { id: 'dept_almoxarifado', label: 'Almoxarifado', color: '#991b1b' },
        { id: 'dept_expedicao', label: 'Expedição', color: '#ea580c' },
        { id: 'dept_compras', label: 'Compras', color: '#854d0e' },
        { id: 'dept_metodos', label: 'Métodos e Processos', color: '#ec4899' },
        { id: 'dept_automacao', label: 'Automação', color: '#1e3a8a' },
        { id: 'dept_engenharia', label: 'Engenharia', color: '#16a34a' },
        { id: 'dept_ims', label: 'IMS', color: '#7f1d1d' },
        { id: 'dept_rh', label: 'RH', color: '#a855f7' },
        { id: 'dept_logistica', label: 'Logistica', color: '#facc15' },
        { id: 'dept_qualidade', label: 'Qualidade', color: '#60a5fa' },
        { id: 'dept_operacao', label: 'Operação', color: '#93c5fd' },
        { id: 'dept_motorista', label: 'Motorista', color: '#f472b6' },
        { id: 'dept_geral', label: 'Geral', color: '#6b7280' }
      ]
    },
    createdBy: 'u1',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'cf_status',
    name: 'STATUS',
    type: CustomFieldType.DROPDOWN,
    isMandatory: false,
    target: 'TASK',
    visibleTo: [UserRole.ADMIN, UserRole.GESTOR, UserRole.COLABORADOR],
    config: {
      options: [
        { id: 'st1', label: 'ÓTIMO-EM USO', color: '#0D9488', icon: 'CircleDashed' },
        { id: 'st2', label: 'ATIVOS', color: '#94A3B8', icon: 'Clock' },
        { id: 'st3', label: 'SOLICITAR TROCA-EM USO', color: '#F59E0B', icon: 'Clock' },
        { id: 'st4', label: 'TROCAR-NÃO ESTÁ EM USO', color: '#EA580C', icon: 'Timer' },
        { id: 'st5', label: 'ÓTIMO-ESTOQUE', color: '#2DD4BF', icon: 'Timer' },
        { id: 'st6', label: 'USADO-ESTOQUE', color: '#3B82F6', icon: 'Clock' },
        { id: 'st7', label: 'PENDENTE DE ANÁLISE TI', color: '#991B1B', icon: 'Clock' },
        { id: 'st8', label: 'DESCARTADO', color: '#7F1D1D', icon: 'CheckCircle2' },
        { id: 'st9', label: 'CONCLUÍDO', color: '#10B981', icon: 'CheckCircle2' }
      ]
    },
    createdBy: 'u1',
    createdAt: '2024-02-18T00:00:00Z'
  },
  {
    id: 'cf_equipamento',
    name: 'EQUIPAMENTO',
    type: CustomFieldType.DROPDOWN,
    isMandatory: false,
    target: 'TASK',
    visibleTo: [UserRole.ADMIN, UserRole.GESTOR, UserRole.COLABORADOR],
    config: {
      options: [
        { id: 'eq1', label: 'TECLADO', color: '#5695ED' },
        { id: 'eq2', label: 'MOUSE', color: '#517BAD' },
        { id: 'eq3', label: 'TELA', color: '#5EBDD3' },
        { id: 'eq4', label: 'NOTEBOOK', color: '#000080' },
        { id: 'eq5', label: 'CPU', color: '#6C7A8B' },
        { id: 'eq6', label: 'TV', color: '#1E39F6' },
        { id: 'eq7', label: 'IMPRESSORA', color: '#D45D12' },
        { id: 'eq8', label: 'CELULAR', color: '#67C777' }
      ]
    },
    createdBy: 'u1',
    createdAt: '2024-02-18T00:00:00Z'
  }
];

export const MOCK_CUSTOM_FIELD_VALUES: CustomFieldValue[] = [
  { fieldId: 'cf1', entityId: 't1', value: 50000.00 },
  { fieldId: 'cf2', entityId: 't1', value: 'dept_pcp' },
  { fieldId: 'cf_status', entityId: 't1', value: 'st2' },
  { fieldId: 'cf_equipamento', entityId: 't1', value: 'eq1' }
];

export const MOCK_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Definição de Requisitos Iniciais',
    description: 'Levantamento completo dos requisitos funcionais do novo ERP corporativo.',
    status: 'Em andamento',
    priority: TaskPriority.ALTA,
    mainAssigneeId: 'u2',
    secondaryAssigneeIds: ['u3'],
    startDate: '2024-01-01',
    dueDate: '2024-01-20',
    extensionCount: 2,
    extensionHistory: [
      { id: 'ex1', oldDate: '2024-01-10', newDate: '2024-01-15', reason: 'Atraso na aprovação do stakeholder', updatedBy: 'u2', timestamp: '2024-01-09T10:00:00Z' },
      { id: 'ex2', oldDate: '2024-01-15', newDate: '2024-01-20', reason: 'Mudança de escopo técnica', updatedBy: 'u2', timestamp: '2024-01-14T15:30:00Z' }
    ],
    checklists: [
      { id: 'c1', text: 'Entrevistar stakeholders', completed: true },
      { id: 'c2', text: 'Desenhar fluxograma inicial', completed: false }
    ],
    comments: [
      { id: 'com1', userId: 'u1', text: 'Favor agilizar esta entrega.', timestamp: '2024-01-05T09:00:00Z' }
    ],
    attachments: [],
    activities: [],
    listId: 'l1',
    projectId: 'p1'
  },
  {
    id: 't2',
    title: 'Benchmarking de Concorrentes',
    description: 'Análise detalhada de 5 softwares similares no mercado.',
    status: 'A Fazer',
    priority: TaskPriority.MEDIA,
    mainAssigneeId: 'u3',
    secondaryAssigneeIds: [],
    startDate: '2024-01-05',
    dueDate: '2024-01-12',
    extensionCount: 0,
    extensionHistory: [],
    checklists: [],
    comments: [],
    attachments: [],
    activities: [],
    listId: 'l1',
    projectId: 'p1'
  },
  {
    id: 'st1',
    title: 'Ativos - Eletrônicos - Sub 1',
    description: 'Subtarefa de teste',
    status: 'Em andamento',
    priority: TaskPriority.MEDIA,
    mainAssigneeId: 'u2',
    secondaryAssigneeIds: [],
    startDate: '2024-02-18',
    dueDate: '2024-02-20',
    extensionCount: 0,
    extensionHistory: [],
    checklists: [],
    comments: [],
    attachments: [],
    activities: [],
    listId: 'l1',
    projectId: 'p1',
    parentId: 't1'
  },
  {
    id: 'st2',
    title: 'Ativos - Eletrônicos - Sub 2',
    description: 'Outra subtarefa',
    status: 'A Fazer',
    priority: TaskPriority.BAIXA,
    mainAssigneeId: 'u3',
    secondaryAssigneeIds: [],
    startDate: '2024-02-18',
    dueDate: '2024-02-21',
    extensionCount: 0,
    extensionHistory: [],
    checklists: [],
    comments: [],
    attachments: [],
    activities: [],
    listId: 'l1',
    projectId: 'p1',
    parentId: 't1'
  }
];