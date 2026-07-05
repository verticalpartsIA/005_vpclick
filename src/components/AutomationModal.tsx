/**
 * SESSION_04 — Tarefa 7
 * AutomationModal completo: templates, todos os triggers/actions,
 * colunas corretas (enabled, trigger_config), painel de logs.
 */

import React, { useState, useEffect } from 'react';
import {
  Zap, X, Plus, Trash2, History, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../lib/supabase';
import { createAutomation, deleteAutomation, updateAutomation } from '../lib/supabase';
import { AUTOMATION_TEMPLATES } from '../lib/automationTemplates';
import { AutomationLogPanel } from './AutomationLogPanel';
import { toast } from 'sonner';
import type {
  AutomationTriggerType,
  AutomationActionType,
  AutomationAction,
  AutomationTriggerConfig,
  AutomationTemplate,
} from '../types';

interface AutomationModalProps {
  listId: string;
  listName: string;
  currentUserId: string;
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
}

// ── Labels ──────────────────────────────────────────────────
const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  status_changed:       'Status da tarefa muda',
  priority_changed:     'Prioridade muda',
  assignee_changed:     'Responsável muda',
  due_date_arrives:     'Prazo chega',
  task_created:         'Tarefa é criada',
  task_moved:           'Tarefa é movida de lista',
  custom_field_changed: 'Campo personalizado muda',
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  change_status:    'Alterar status',
  change_priority:  'Alterar prioridade',
  add_assignee:     'Adicionar responsável',
  remove_assignee:  'Remover responsável',
  post_comment:     'Publicar comentário',
  add_tag:          'Adicionar tag',
  remove_tag:       'Remover tag',
  send_notification:'Enviar notificação',
  create_task:      'Criar nova tarefa',
  create_subtask:   'Criar subtarefa',
};

const CATEGORY_LABELS: Record<string, string> = {
  status:    '📋 Status',
  prazo:     '⏰ Prazo',
  equipe:    '👥 Equipe',
  qualidade: '🔍 Qualidade',
};

const STATUS_OPTIONS = ['A fazer', 'Em andamento', 'Em revisão', 'Concluído', 'Cancelado'];
const PRIORITY_OPTIONS = ['Baixa', 'Média', 'Alta', 'Urgente'];

// ── Component ───────────────────────────────────────────────
export const AutomationModal: React.FC<AutomationModalProps> = ({
  listId,
  listName,
  currentUserId,
  workspaceId,
  onClose,
  onCreated,
}) => {
  type Tab = 'list' | 'templates' | 'create';
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [automations, setAutomations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Log panel
  const [logTarget, setLogTarget] = useState<{ id: string; name: string } | null>(null);

  // Create form state
  const [name, setName]             = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>('status_changed');
  const [triggerConfig, setTriggerConfig] = useState<AutomationTriggerConfig>({});
  const [actions, setActions]       = useState<AutomationAction[]>([
    { type: 'send_notification', config: { message: '' } },
  ]);
  const [isSaving, setIsSaving]     = useState(false);

  // ── Fetch ────────────────────────────────────────────────
  const fetchList = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false });
      if (error) {
        toast.error('Erro ao carregar automações: ' + error.message);
      }
      setAutomations(data ?? []);
    } catch (err) {
      toast.error('Erro inesperado ao carregar automações.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  // ── Toggle enabled ────────────────────────────────────────
  const handleToggle = async (id: string, current: boolean) => {
    try {
      await updateAutomation(id, { enabled: !current });
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !current } : a));
    } catch (err) {
      toast.error('Erro ao atualizar automação.');
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async (id: string, automationName: string) => {
    if (!window.confirm(`Deletar automação "${automationName}"?`)) return;
    try {
      await deleteAutomation(id);
      setAutomations(prev => prev.filter(a => a.id !== id));
      toast.success('Automação removida.');
    } catch (err) {
      toast.error('Erro ao remover automação.');
    }
  };

  // ── Actions helpers ───────────────────────────────────────
  const addAction = () => {
    setActions(prev => [...prev, { type: 'send_notification', config: { message: '' } }]);
  };

  const removeAction = (idx: number) => {
    setActions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateActionType = (idx: number, type: AutomationActionType) => {
    setActions(prev => prev.map((a, i) => i === idx ? { type, config: {} } : a));
  };

  const updateActionConfig = (idx: number, config: Record<string, string>) => {
    setActions(prev => prev.map((a, i) =>
      i === idx ? { ...a, config: { ...a.config, ...config } } : a
    ));
  };

  // ── Apply template ────────────────────────────────────────
  const applyTemplate = (tpl: AutomationTemplate) => {
    setName(tpl.name);
    setTriggerType(tpl.trigger_type);
    setTriggerConfig(tpl.trigger_config);
    setActions(tpl.actions.map(a => ({ ...a, config: { ...(a.config as Record<string, string>) } })));
    setActiveTab('create');
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { toast.error('Dê um nome à automação.'); return; }
    if (actions.length === 0) { toast.error('Adicione ao menos uma ação.'); return; }

    setIsSaving(true);
    try {
      await createAutomation({
        name: name.trim(),
        list_id: listId,
        workspace_id: workspaceId,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        conditions: [],
        actions,
        enabled: true,
        created_by: currentUserId,
      });
      toast.success(`Automação "${name}" criada!`);
      setName('');
      setActions([{ type: 'send_notification', config: { message: '' } }]);
      setTriggerType('status_changed');
      setTriggerConfig({});
      await fetchList();
      setActiveTab('list');
      onCreated();
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render action config fields ───────────────────────────
  const renderActionFields = (action: AutomationAction, idx: number) => {
    const cfg = action.config as Record<string, string>;
    switch (action.type) {
      case 'change_status':
        return (
          <select
            value={cfg.status || ''}
            onChange={e => updateActionConfig(idx, { status: e.target.value })}
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Selecione o status…</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        );

      case 'change_priority':
        return (
          <select
            value={cfg.priority || ''}
            onChange={e => updateActionConfig(idx, { priority: e.target.value })}
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Selecione a prioridade…</option>
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        );

      case 'add_assignee':
      case 'remove_assignee':
        return (
          <input
            type="text"
            value={cfg.userId || ''}
            onChange={e => updateActionConfig(idx, { userId: e.target.value })}
            placeholder="UUID do usuário…"
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        );

      case 'post_comment':
        return (
          <textarea
            value={cfg.text || ''}
            onChange={e => updateActionConfig(idx, { text: e.target.value })}
            placeholder="Texto do comentário…"
            rows={2}
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        );

      case 'add_tag':
      case 'remove_tag':
        return (
          <input
            type="text"
            value={cfg.tag || ''}
            onChange={e => updateActionConfig(idx, { tag: e.target.value })}
            placeholder="Nome da tag…"
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        );

      case 'send_notification':
        return (
          <input
            type="text"
            value={cfg.message || ''}
            onChange={e => updateActionConfig(idx, { message: e.target.value })}
            placeholder="Texto da notificação…"
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        );

      case 'create_task':
        return (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={cfg.title || ''}
              onChange={e => updateActionConfig(idx, { title: e.target.value })}
              placeholder="Título da nova tarefa…"
              className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <input
              type="text"
              value={cfg.listId || ''}
              onChange={e => updateActionConfig(idx, { listId: e.target.value })}
              placeholder="ID da lista destino (opcional)…"
              className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        );

      case 'create_subtask':
        return (
          <input
            type="text"
            value={cfg.title || ''}
            onChange={e => updateActionConfig(idx, { title: e.target.value })}
            placeholder="Título da subtarefa…"
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        );

      default:
        return null;
    }
  };

  // ── Render trigger config ─────────────────────────────────
  const renderTriggerConfig = () => {
    switch (triggerType) {
      case 'status_changed':
        return (
          <div className="flex gap-2">
            <select
              value={triggerConfig.from || ''}
              onChange={e => setTriggerConfig(prev => ({ ...prev, from: e.target.value || undefined }))}
              className="flex-1 text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">De qualquer status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronRight className="w-4 h-4 text-muted-foreground self-center shrink-0" />
            <select
              value={triggerConfig.to || ''}
              onChange={e => setTriggerConfig(prev => ({ ...prev, to: e.target.value || undefined }))}
              className="flex-1 text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Para qualquer status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        );

      case 'priority_changed':
        return (
          <div className="flex gap-2">
            <select
              value={triggerConfig.from || ''}
              onChange={e => setTriggerConfig(prev => ({ ...prev, from: e.target.value || undefined }))}
              className="flex-1 text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">De qualquer prioridade</option>
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronRight className="w-4 h-4 text-muted-foreground self-center shrink-0" />
            <select
              value={triggerConfig.to || ''}
              onChange={e => setTriggerConfig(prev => ({ ...prev, to: e.target.value || undefined }))}
              className="flex-1 text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Para qualquer prioridade</option>
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        );

      case 'due_date_arrives':
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={30}
              value={triggerConfig.days_before ?? 0}
              onChange={e => setTriggerConfig(prev => ({ ...prev, days_before: Number(e.target.value) }))}
              className="w-20 text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-center"
            />
            <span className="text-sm text-muted-foreground">dia(s) antes do prazo</span>
          </div>
        );

      default:
        return null;
    }
  };

  // Fecha o modal ao pressionar Escape (consistente com os demais modais do app)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── JSX ───────────────────────────────────────────────────
  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-card border rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Automações</h2>
                <p className="text-xs text-muted-foreground">Lista: {listName}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b shrink-0">
            {(['list', 'templates', 'create'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'list'      && `Ativas${automations.length > 0 ? ` (${automations.length})` : ''}`}
                {tab === 'templates' && '✨ Templates'}
                {tab === 'create'    && '+ Nova'}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">

            {/* ── ABA LISTA ─────────────────────────────── */}
            {activeTab === 'list' && (
              <>
                {isLoading && (
                  <div className="text-center py-8 text-sm text-muted-foreground">Carregando…</div>
                )}
                {!isLoading && automations.length === 0 && (
                  <div className="text-center py-8 border border-dashed rounded-lg">
                    <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma automação criada ainda.</p>
                    <button
                      onClick={() => setActiveTab('templates')}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Ver templates
                    </button>
                  </div>
                )}
                {!isLoading && automations.map(a => (
                  <div key={a.id} className="border rounded-lg p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {TRIGGER_LABELS[a.trigger_type as AutomationTriggerType] ?? a.trigger_type}
                        {a.run_count > 0 && (
                          <span className="ml-2 text-primary/70">· {a.run_count}× executada</span>
                        )}
                      </p>
                    </div>

                    {/* Histórico */}
                    <button
                      onClick={() => setLogTarget({ id: a.id, name: a.name })}
                      title="Ver histórico"
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    {/* Toggle enabled */}
                    <button
                      onClick={() => handleToggle(a.id, a.enabled)}
                      title={a.enabled ? 'Desativar' : 'Ativar'}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                        a.enabled ? 'bg-green-500' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        a.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(a.id, a.name)}
                      title="Deletar automação"
                      className="text-destructive hover:text-destructive/70 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* ── ABA TEMPLATES ─────────────────────────── */}
            {activeTab === 'templates' && (
              <>
                {Object.entries(CATEGORY_LABELS).map(([cat, catLabel]) => {
                  const items = AUTOMATION_TEMPLATES.filter(t => t.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">{catLabel}</p>
                      <div className="flex flex-col gap-2">
                        {items.map(tpl => (
                          <div
                            key={tpl.id}
                            className="border rounded-lg p-3 flex items-start gap-3 hover:bg-muted/40 transition-colors group"
                          >
                            <span className="text-xl shrink-0 mt-0.5">{tpl.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{tpl.name}</p>
                              <p className="text-xs text-muted-foreground">{tpl.description}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => applyTemplate(tpl)}
                            >
                              Usar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── ABA CRIAR ─────────────────────────────── */}
            {activeTab === 'create' && (
              <>
                {/* Nome */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Nome da automação</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Notificar quando concluído"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                {/* Trigger */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Quando (Trigger)</label>
                  <select
                    value={triggerType}
                    onChange={e => {
                      setTriggerType(e.target.value as AutomationTriggerType);
                      setTriggerConfig({});
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {(Object.entries(TRIGGER_LABELS) as [AutomationTriggerType, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  {/* Trigger config (from/to, days_before, etc) */}
                  {renderTriggerConfig() && (
                    <div className="mt-1">{renderTriggerConfig()}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Então (Ações)</label>
                    <Button variant="outline" size="sm" onClick={addAction} className="h-7 text-xs gap-1">
                      <Plus className="w-3 h-3" /> Adicionar ação
                    </Button>
                  </div>

                  {actions.map((action, idx) => (
                    <div key={idx} className="border rounded-lg p-3 flex flex-col gap-2 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <select
                          value={action.type}
                          onChange={e => updateActionType(idx, e.target.value as AutomationActionType)}
                          className="flex-1 text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {(Object.entries(ACTION_LABELS) as [AutomationActionType, string][]).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                          onClick={() => removeAction(idx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {renderActionFields(action, idx)}
                    </div>
                  ))}

                  {actions.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                      Nenhuma ação adicionada ainda.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-5 border-t shrink-0">
            {activeTab === 'create' ? (
              <>
                <Button variant="outline" onClick={() => setActiveTab('list')} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                  <Zap className="w-4 h-4" />
                  {isSaving ? 'Salvando…' : 'Criar Automação'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            )}
          </div>

        </div>
      </div>

      {/* Log panel (sobreposto) */}
      {logTarget && (
        <AutomationLogPanel
          automationId={logTarget.id}
          automationName={logTarget.name}
          onClose={() => setLogTarget(null)}
        />
      )}
    </>
  );
};
