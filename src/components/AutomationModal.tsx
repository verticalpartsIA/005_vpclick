/**
 * T604 — AutomationModal
 * T702 — Gerenciar automações existentes (listar, ativar/desativar, deletar)
 */

import React, { useState, useEffect } from 'react';
import { Zap, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

type TriggerType = 'status_changed' | 'priority_changed' | 'assignee_changed' | 'due_date_arrives';
type ActionType = 'change_status' | 'send_notification' | 'add_assignee';

interface AutomationAction {
  type: ActionType;
  params: Record<string, any>;
}

interface AutomationModalProps {
  listId: string;
  listName: string;
  currentUserId: string;
  onClose: () => void;
  onCreated: () => void;
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  status_changed: 'Status da tarefa muda',
  priority_changed: 'Prioridade muda',
  assignee_changed: 'Responsável muda',
  due_date_arrives: 'Prazo chega',
};

const ACTION_LABELS: Record<ActionType, string> = {
  change_status: 'Alterar status',
  send_notification: 'Enviar notificação',
  add_assignee: 'Adicionar responsável',
};

const STATUS_OPTIONS = ['A fazer', 'Em andamento', 'Em revisão', 'Concluído', 'Cancelado'];

export const AutomationModal: React.FC<AutomationModalProps> = ({
  listId,
  listName,
  currentUserId,
  onClose,
  onCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('list');
  const [automations, setAutomations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('status_changed');
  const [actions, setActions] = useState<AutomationAction[]>([
    { type: 'send_notification', params: { message: '' } },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAutomations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[AutomationModal] fetch error:', error);
        toast.error('Erro ao carregar automações: ' + error.message);
      }
      setAutomations(data || []);
    } catch (err) {
      console.error('[AutomationModal] fetch exception:', err);
      toast.error('Erro inesperado ao carregar automações.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAutomations(); }, []);

  const handleToggle = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('automations')
      .update({ is_active: !current })
      .eq('id', id);
    if (!error) {
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a));
    }
  };

  const handleDelete = async (id: string, automationName: string) => {
    if (!window.confirm(`Deletar automação "${automationName}"?`)) return;
    const { error } = await supabase.from('automations').delete().eq('id', id);
    if (!error) {
      setAutomations(prev => prev.filter(a => a.id !== id));
      toast.success('Automação removida.');
    }
  };

  const addAction = () => {
    setActions(prev => [...prev, { type: 'send_notification', params: { message: '' } }]);
  };

  const removeAction = (idx: number) => {
    setActions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, updates: Partial<AutomationAction>) => {
    setActions(prev =>
      prev.map((a, i) =>
        i === idx ? { ...a, ...updates, params: { ...a.params, ...(updates.params || {}) } } : a
      )
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Dê um nome à automação.'); return; }
    if (actions.length === 0) { toast.error('Adicione ao menos uma ação.'); return; }

    setIsSaving(true);
    const { error } = await supabase.from('automations').insert({
      name: name.trim(),
      list_id: listId,
      trigger_type: triggerType,
      trigger_params: {},
      conditions: [],
      actions,
      is_active: true,
      created_by: currentUserId,
    });
    setIsSaving(false);

    if (error) {
      console.error('[AutomationModal] save error:', error);
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success(`Automação "${name}" criada com sucesso!`);
      setName('');
      setActions([{ type: 'send_notification', params: { message: '' } }]);
      setTriggerType('status_changed');
      onCreated();
      await fetchAutomations();
      setActiveTab('list');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
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
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'list' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Automações {automations.length > 0 && `(${automations.length})`}
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'create' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            + Nova
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">

          {/* ── ABA LISTA ── */}
          {activeTab === 'list' && (
            <>
              {isLoading && (
                <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
              )}
              {!isLoading && automations.length === 0 && (
                <div className="text-center py-8 border border-dashed rounded-lg">
                  <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma automação criada ainda.</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-2 text-sm text-primary hover:underline"
                  >
                    Criar primeira automação
                  </button>
                </div>
              )}
              {!isLoading && automations.map(a => (
                <div key={a.id} className="border rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TRIGGER_LABELS[a.trigger_type as TriggerType] ?? a.trigger_type}
                    </p>
                  </div>

                  {/* Toggle ativo/inativo */}
                  <button
                    onClick={() => handleToggle(a.id, a.is_active)}
                    title={a.is_active ? 'Desativar' : 'Ativar'}
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${a.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${a.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>

                  {/* Deletar */}
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

          {/* ── ABA CRIAR ── */}
          {activeTab === 'create' && (
            <>
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

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Quando (Trigger)</label>
                <select
                  value={triggerType}
                  onChange={e => setTriggerType(e.target.value as TriggerType)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Então (Ações)</label>
                  <Button variant="outline" size="sm" onClick={addAction} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Adicionar ação
                  </Button>
                </div>

                {actions.map((action, idx) => (
                  <div key={idx} className="border rounded-lg p-3 flex flex-col gap-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <select
                        value={action.type}
                        onChange={e => updateAction(idx, { type: e.target.value as ActionType, params: {} })}
                        className="text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 flex-1"
                      >
                        {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      <Button variant="ghost" size="icon" className="ml-2 h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeAction(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {action.type === 'change_status' && (
                      <select
                        value={action.params.status || ''}
                        onChange={e => updateAction(idx, { params: { status: e.target.value } })}
                        className="text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="">Selecione o status…</option>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}

                    {action.type === 'send_notification' && (
                      <input
                        type="text"
                        value={action.params.message || ''}
                        onChange={e => updateAction(idx, { params: { message: e.target.value } })}
                        placeholder="Texto da notificação…"
                        className="text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    )}

                    {action.type === 'add_assignee' && (
                      <input
                        type="text"
                        value={action.params.userId || ''}
                        onChange={e => updateAction(idx, { params: { userId: e.target.value } })}
                        placeholder="UUID do usuário a adicionar…"
                        className="text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    )}
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
        {activeTab === 'create' && (
          <div className="flex items-center justify-end gap-3 p-5 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              <Zap className="w-4 h-4" />
              {isSaving ? 'Salvando…' : 'Criar Automação'}
            </Button>
          </div>
        )}
        {activeTab === 'list' && (
          <div className="flex items-center justify-end gap-3 p-5 border-t">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
};
