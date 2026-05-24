import { useState, useEffect } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { TagBadge } from '@/components/TagBadge';
import {
  fetchWorkspaceTags,
  createWorkspaceTag,
  deleteWorkspaceTag,
  updateTaskTags,
} from '@/lib/supabase';
import type { WorkspaceTag } from '@/types';

const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#84cc16', '#a855f7',
];

interface TaskTagsInputProps {
  taskId: string;
  workspaceId: string;
  currentTags: string[];
  currentUserId: string;
  readOnly?: boolean;
  onTagsChange?: (tags: string[]) => void;
}

export function TaskTagsInput({
  taskId,
  workspaceId,
  currentTags,
  currentUserId,
  readOnly = false,
  onTagsChange,
}: TaskTagsInputProps) {
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTag[]>([]);
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLOR_PALETTE[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWorkspaceTags(workspaceId)
      .then(setWorkspaceTags)
      .catch(() => toast.error('Erro ao carregar tags'));
  }, [workspaceId]);

  const appliedTags = workspaceTags.filter((t) => currentTags.includes(t.name));

  async function handleToggleTag(tagName: string) {
    const next = currentTags.includes(tagName)
      ? currentTags.filter((t) => t !== tagName)
      : [...currentTags, tagName];
    try {
      await updateTaskTags(taskId, next);
      onTagsChange?.(next);
    } catch {
      toast.error('Erro ao atualizar tags');
    }
  }

  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    if (workspaceTags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Já existe uma tag com esse nome');
      return;
    }
    setSaving(true);
    try {
      const tag = await createWorkspaceTag(workspaceId, name, newTagColor, currentUserId);
      setWorkspaceTags((prev) => [...prev, tag]);
      setNewTagName('');
      setNewTagColor(COLOR_PALETTE[0]);
      await handleToggleTag(tag.name);
    } catch {
      toast.error('Erro ao criar tag');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWorkspaceTag(tagId: string, tagName: string) {
    try {
      await deleteWorkspaceTag(tagId);
      setWorkspaceTags((prev) => prev.filter((t) => t.id !== tagId));
      if (currentTags.includes(tagName)) {
        await handleToggleTag(tagName);
      }
      toast.success('Tag removida do workspace');
    } catch {
      toast.error('Erro ao remover tag');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Tag className="w-4 h-4" />
          Tags
        </div>
        {!readOnly && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <Plus className="w-3 h-3" /> Gerenciar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-3" align="end">
              <p className="text-sm font-medium">Tags do workspace</p>

              {workspaceTags.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {workspaceTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleToggleTag(tag.name)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-xs">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {currentTags.includes(tag.name) && (
                          <span className="text-[10px] text-primary font-bold">✓</span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkspaceTag(tag.id, tag.name);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Criar nova tag</p>
                <Input
                  placeholder="Nome da tag…"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                        newTagColor === c ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewTagColor(c)}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  className="w-full h-7 text-xs"
                  disabled={!newTagName.trim() || saving}
                  onClick={handleCreateTag}
                >
                  {saving ? 'Criando…' : 'Criar e aplicar'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {appliedTags.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma tag aplicada.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {appliedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              name={tag.name}
              color={tag.color}
              onRemove={readOnly ? undefined : () => handleToggleTag(tag.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
