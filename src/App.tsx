import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MoreHorizontal, FileText, ListPlus, Link as LinkIcon, Image as ImageIcon, Paperclip, AlertTriangle as AlertTriangleIcon, Tag, Copy, ArrowUpDown } from "lucide-react";
import {
  User, Task, Workspace, Space, Folder, List, Project,
  UserRole, StatusType, StatusOption, StatusGroup, TaskPriority, ExtensionLog, Comment, ChecklistItem, Attachment,
  CustomField, CustomFieldType, CustomFieldValue, CustomFieldOption, Doc, TaskActivity, WorkspaceTag, Team
} from './types';
// import { MOCK_USERS, INITIAL_WORKSPACE, MOCK_SPACES, MOCK_FOLDERS, MOCK_LISTS, MOCK_TASKS, MOCK_PROJECTS, MOCK_CUSTOM_FIELDS, MOCK_CUSTOM_FIELD_VALUES } from './mockData';
import { INITIAL_WORKSPACE, MOCK_PROJECTS } from './mockData'; // MOCK_PROJECTS temporário se ainda necessário
import { Icons, PRIORITY_COLORS, COLORS } from './constants';
import { WIKI_INTRO_HTML, WIKI_TEMPLATE_SECTIONS } from './wikiTemplate';
import AdminPanel from './pages/AdminPanel';
import LoginScreen from './pages/LoginScreen';
import ChangePasswordModal from './components/ChangePasswordModal';
import CreateListModal from './components/CreateListModal';
import compactLogoWhite from './assets/logo-verticalparts-white.png';
import bootLogoVideo from './assets/logo-limpo-video.mp4';
import { TableView } from './components/views/TableView';
import { CalendarView } from './components/views/CalendarView';
import { GanttView } from './components/views/GanttView';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as ReBarChart, PieChart, Pie, Cell } from 'recharts';
import { supabase, supabaseAdmin, isTaskBlocked } from './lib/supabase';
import { AutomationEngine, AutomationContext, AutomationCallbacks } from './lib/AutomationEngine';
import { startVersionCheck, formatBuildTimeShort } from './lib/versionCheck';
import { TaskDependencies } from './components/TaskDependencies';
import { NotificationBell } from './components/NotificationBell';
import { TeamsModal } from './components/TeamsModal';
import { MentionTextarea } from './components/MentionTextarea';
import { AIPanel } from './components/AIPanel';
import { MentionText, notifyMentions, notifyAssignment } from './lib/mentions';
import { TaskTagsInput } from './components/TaskTagsInput';
import { TagBadge } from './components/TagBadge';
import { AutomationModal } from './components/AutomationModal';
import { Session, createClient } from '@supabase/supabase-js';
import { Toaster, toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Checkbox } from "@/components/ui/checkbox";

// --- SSO CONFIGURATION ---
const CENTRAL_URL = "https://ubdkoqxfwcraftesgmbw.supabase.co";
const CENTRAL_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZGtvcXhmd2NyYWZ0ZXNnbWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjUwMjcsImV4cCI6MjA5MDY0MTAyN30.s1A15nFQVne94gbz0511L2IYvHdTcgYeL0H8YU80iI8";

const centralSupabase = createClient(CENTRAL_URL, CENTRAL_ANON);

const SSOHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// --- Types for Navigation Scope ---
type ScopeType = 'global' | 'space' | 'folder';
interface NavigationScope {
  type: ScopeType;
  id: string | null;
  name: string;
}

interface DuplicateTaskOptions {
  title: string;
  listId: string;
  includeDescription: boolean;
  includeAssignees: boolean;
  includeDates: boolean;
  includePriority: boolean;
  includeSubtasks: boolean;
  includeChecklists: boolean;
  includeTags: boolean;
  includeCustomFields: boolean;
}

type DuplicateTaskBooleanOption = Exclude<keyof DuplicateTaskOptions, 'title' | 'listId'>;

// --- Theme presets (HSL tokens) ---
type ThemePresetId = "claro" | "grafite" | "oceano" | "floresta" | "ameixa";
const THEME_PRESETS: Record<ThemePresetId, { label: string; vars: Record<string, string> }> = {
  claro: {
    label: "Claro",
    vars: {
      "--background": "0 0% 100%",
      "--foreground": "222.2 84% 4.9%",
      "--card": "0 0% 100%",
      "--card-foreground": "222.2 84% 4.9%",
      "--muted": "210 40% 96.1%",
      "--muted-foreground": "215.4 16.3% 46.9%",
      "--border": "214.3 31.8% 91.4%",
      "--input": "214.3 31.8% 91.4%",
      "--primary": "45 96% 51%",
      "--primary-foreground": "222.2 47.4% 11.2%",
      "--ring": "45 96% 51%",
      "--sidebar-background": "0 0% 98%",
      "--sidebar-foreground": "240 5.3% 26.1%",
      "--sidebar-accent": "240 4.8% 95.9%",
      "--sidebar-accent-foreground": "240 5.9% 10%",
      "--sidebar-border": "220 13% 91%",
    },
  },
  grafite: {
    label: "Grafite",
    vars: {
      "--background": "210 40% 98%",
      "--foreground": "222.2 84% 4.9%",
      "--card": "0 0% 100%",
      "--card-foreground": "222.2 84% 4.9%",
      "--muted": "210 40% 96.1%",
      "--muted-foreground": "215.4 16.3% 46.9%",
      "--border": "214.3 31.8% 91.4%",
      "--input": "214.3 31.8% 91.4%",
      "--primary": "210 100% 56%",
      "--primary-foreground": "210 40% 98%",
      "--ring": "210 100% 56%",
      "--sidebar-background": "222.2 47.4% 11.2%",
      "--sidebar-foreground": "210 40% 98%",
      "--sidebar-accent": "217.2 32.6% 17.5%",
      "--sidebar-accent-foreground": "210 40% 98%",
      "--sidebar-border": "217.2 32.6% 17.5%",
    },
  },
  oceano: {
    label: "Oceano",
    vars: {
      "--background": "204 45% 98%",
      "--foreground": "222.2 84% 4.9%",
      "--card": "0 0% 100%",
      "--card-foreground": "222.2 84% 4.9%",
      "--muted": "204 40% 94%",
      "--muted-foreground": "215.4 16.3% 46.9%",
      "--border": "205 30% 88%",
      "--input": "205 30% 88%",
      "--primary": "199 89% 48%",
      "--primary-foreground": "210 40% 98%",
      "--ring": "199 89% 48%",
      "--sidebar-background": "203 52% 14%",
      "--sidebar-foreground": "210 40% 98%",
      "--sidebar-accent": "203 45% 20%",
      "--sidebar-accent-foreground": "210 40% 98%",
      "--sidebar-border": "203 45% 20%",
    },
  },
  floresta: {
    label: "Floresta",
    vars: {
      "--background": "120 20% 98%",
      "--foreground": "222.2 84% 4.9%",
      "--card": "0 0% 100%",
      "--card-foreground": "222.2 84% 4.9%",
      "--muted": "120 15% 94%",
      "--muted-foreground": "215.4 16.3% 46.9%",
      "--border": "120 12% 88%",
      "--input": "120 12% 88%",
      "--primary": "142 72% 38%",
      "--primary-foreground": "210 40% 98%",
      "--ring": "142 72% 38%",
      "--sidebar-background": "148 45% 14%",
      "--sidebar-foreground": "210 40% 98%",
      "--sidebar-accent": "148 35% 20%",
      "--sidebar-accent-foreground": "210 40% 98%",
      "--sidebar-border": "148 35% 20%",
    },
  },
  ameixa: {
    label: "Ameixa",
    vars: {
      "--background": "280 30% 98%",
      "--foreground": "222.2 84% 4.9%",
      "--card": "0 0% 100%",
      "--card-foreground": "222.2 84% 4.9%",
      "--muted": "280 20% 94%",
      "--muted-foreground": "215.4 16.3% 46.9%",
      "--border": "275 18% 88%",
      "--input": "275 18% 88%",
      "--primary": "280 72% 52%",
      "--primary-foreground": "210 40% 98%",
      "--ring": "280 72% 52%",
      "--sidebar-background": "276 45% 14%",
      "--sidebar-foreground": "210 40% 98%",
      "--sidebar-accent": "276 35% 20%",
      "--sidebar-accent-foreground": "210 40% 98%",
      "--sidebar-border": "276 35% 20%",
    },
  },
};

// ── CommentItem: comentário com edição/exclusão inline ────────────────────
function CommentItem({ item, users, teams, isOwn, taskId, onEdit, onDelete, formatDate }: {
  item: any;
  users: any[];
  teams: any[];
  isOwn: boolean;
  taskId: string;
  onEdit: (taskId: string, commentId: string, text: string) => Promise<void>;
  onDelete: (taskId: string, commentId: string) => Promise<void>;
  formatDate: (d: string) => string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(item.text);
  const [saving, setSaving] = React.useState(false);
  const author = users.find((u: any) => u.id === item.userId);

  const handleSave = async () => {
    if (!editText.trim() || editText === item.text) { setEditing(false); return; }
    setSaving(true);
    await onEdit(taskId, item.id, editText.trim());
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="relative group/comment">
      <div className="absolute -left-[28px] top-0 w-6 h-6 rounded-full border-2 border-white shadow-sm overflow-hidden bg-white hover:scale-150 z-10 transition-all cursor-pointer">
        <img src={author?.avatar || `https://picsum.photos/seed/${item.userId}/100`} alt="" />
      </div>
      <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 ml-2 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-900">{author?.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-300">{formatDate(item.date)}{item.updatedAt ? ' · editado' : ''}</span>
            {isOwn && !editing && (
              <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                <button onClick={() => { setEditText(item.text); setEditing(true); }} className="text-[10px] text-gray-400 hover:text-blue-500 font-semibold px-1.5 py-0.5 rounded hover:bg-blue-50 transition-all">Editar</button>
                <button onClick={() => onDelete(taskId, item.id)} className="text-[10px] text-gray-400 hover:text-red-500 font-semibold px-1.5 py-0.5 rounded hover:bg-red-50 transition-all">Excluir</button>
              </div>
            )}
          </div>
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              className="w-full text-sm p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
              rows={3}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } if (e.key === 'Escape') setEditing(false); }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700 font-semibold px-2 py-1 rounded hover:bg-gray-100">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !editText.trim()} className="text-xs bg-orange-500 text-white font-bold px-3 py-1 rounded-lg hover:brightness-110 disabled:opacity-50">{saving ? '...' : 'Salvar'}</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 leading-relaxed">
            <MentionText text={item.text} users={users || []} teams={teams} />
          </p>
        )}
      </div>
    </div>
  );
}

// --- Global Context Mock-up ---
const FALLBACK_USER: User = {
  id: 'loading',
  name: 'Carregando...',
  email: '',
  avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  role: UserRole.COLABORADOR,
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User>(FALLBACK_USER);
  const [workspace] = useState<Workspace>(INITIAL_WORKSPACE);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // Tela de entrada mostra o vídeo do logo até ele terminar de tocar por
  // completo, mesmo que a verificação de sessão já tenha terminado antes.
  const [bootVideoEnded, setBootVideoEnded] = useState(false);
  useEffect(() => {
    // Segurança: se o vídeo não conseguir tocar por algum motivo (autoplay
    // bloqueado, formato não suportado, etc.), não travamos o usuário na
    // tela de carregamento pra sempre — o vídeo dura ~10s.
    const fallback = setTimeout(() => setBootVideoEnded(true), 12000);
    return () => clearTimeout(fallback);
  }, []);
  const [is2faVerified, setIs2faVerified] = useState(() => localStorage.getItem('vp_2fa_verified') === 'true');
  // Impede que getSession() libere a tela enquanto o SSO ainda está processando
  const isSSOProcessing = useRef(
    new URLSearchParams(window.location.search).get('sso_token') !== null
  );

  // Avisa quando uma nova versão foi publicada (deploy é um build estático,
  // sem invalidação — uma aba deixada aberta pode ficar rodando código
  // antigo por muito tempo). Ver src/lib/versionCheck.ts.
  useEffect(() => startVersionCheck(), []);

  // --- SSO LOGIC ---
  const handleSSOToken = useCallback(async (token: string) => {
    try {
      console.log("SSO: Iniciando validação de token...");
      
      const { data: { user: centralUser }, error: centralError } = await centralSupabase.auth.getUser(token);
      if (centralError || !centralUser) throw new Error("Token central inválido");

      console.log("SSO: Usuário central validado:", centralUser.email);

      // Busca o perfil completo na porta de entrada (vpsistema) com o token do
      // próprio usuário — é de lá que herdamos nome, avatar e nível.
      let centralProfile: { name?: string; avatar_url?: string; level?: string } | null = null;
      try {
        const centralAsUser = createClient(CENTRAL_URL, CENTRAL_ANON, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await centralAsUser
          .from('profiles')
          .select('name, avatar_url, level')
          .eq('id', centralUser.id)
          .maybeSingle();
        centralProfile = data;
      } catch (profileErr) {
        console.warn('SSO: não foi possível ler o perfil do vpsistema, usando metadados do Auth.', profileErr);
      }

      const centralName = centralProfile?.name
        || centralUser.user_metadata?.name
        || centralUser.email?.split('@')[0]
        || 'Usuário';
      const centralAvatar = centralProfile?.avatar_url || centralUser.user_metadata?.avatar || null;
      const centralLevel = centralProfile?.level || centralUser.user_metadata?.level;
      const mappedRole = centralLevel === 'Administrador'
        ? UserRole.ADMIN
        : (centralLevel === 'Lider' || centralLevel === 'Gestor')
          ? UserRole.GESTOR
          : UserRole.COLABORADOR;

      const { data: users, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('email', centralUser.email);

      let targetUserId;

      if (userError || !users || users.length === 0) {
        console.log("SSO: Usuário não existe no VPClick, criando...");
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: centralUser.email!,
          email_confirm: true,
          user_metadata: { name: centralName, avatar: centralAvatar, role: mappedRole }
        });

        if (createError) {
          // Usuário já existe no Auth mas sem perfil — recupera o id pelo email
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const existingAuthUser = list?.users?.find((u: any) => u.email === centralUser.email);
          if (!existingAuthUser) throw createError;
          targetUserId = existingAuthUser.id;
        } else {
          targetUserId = newUser.user?.id;
        }

        // Cria o perfil já herdando a identidade do vpsistema; o papel inicial
        // vem do nível de lá e pode ser ajustado depois no painel do VPClick.
        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
          id: targetUserId,
          name: centralName,
          email: centralUser.email,
          avatar: centralAvatar || `https://picsum.photos/seed/${targetUserId}/100`,
          role: mappedRole,
          is_active: true,
        }, { onConflict: 'id' });
        if (profileError) console.error('SSO: erro ao criar perfil herdado:', profileError);
      } else {
        targetUserId = users[0].id;
        // Identidade (nome/avatar) segue sincronizada com a porta de entrada;
        // papel e acessos continuam sendo configurados dentro do VPClick.
        const identity: Record<string, string> = { name: centralName };
        if (centralAvatar) identity.avatar = centralAvatar;
        const { error: syncError } = await supabaseAdmin.from('profiles').update(identity).eq('id', targetUserId);
        if (syncError) console.error('SSO: erro ao sincronizar identidade:', syncError);
      }

      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: centralUser.email!
      });

      if (linkError) throw linkError;

      const tokenHash = linkData?.properties?.hashed_token;
      if (!tokenHash) throw new Error("hashed_token ausente");

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });

      if (verifyError) throw verifyError;

      // SSO bypassa 2FA — marcar como verificado
      localStorage.setItem('vp_2fa_verified', 'true');
      setIs2faVerified(true);
    } catch (err) {
      console.error("SSO Error:", err);
      toast.error("Falha no login via SSO");
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('sso_token');
    if (ssoToken) {
      // Mantém loading enquanto SSO processa — evita redirect prematuro do LoginScreen
      setIsLoadingAuth(true);
      // Limpa a URL imediatamente para segurança
      const nextURL = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, nextURL);
      handleSSOToken(ssoToken).finally(() => {
        isSSOProcessing.current = false;
      });
    }
  }, [handleSSOToken]);

  // --- Persistence Handlers ---
  const uploadFile = useCallback(async (file: File, path: string, bucket: string = 'doc-files'): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (err: any) {
      console.error('Erro no upload:', err);
      const msg: string = err?.message || '';
      if (msg.includes('Bucket not found')) {
        toast.error(`Falha no upload: o bucket "${bucket}" não existe no Storage. Avise o administrador (migration 08).`);
      } else if (msg.includes('row-level security') || msg.includes('violates') || err?.statusCode === '403' || err?.status === 403) {
        toast.error('Falha no upload: sem permissão no Storage. Avise o administrador (políticas do bucket).');
      } else if (msg.includes('exceeded') || msg.includes('too large') || err?.statusCode === '413') {
        toast.error('Falha no upload: arquivo muito grande para o limite do bucket.');
      } else {
        toast.error(`Falha no upload do arquivo${msg ? `: ${msg}` : '.'}`);
      }
      return null;
    }
  }, []);

  const saveTaskAttachment = useCallback(async (taskId: string, attachment: Partial<Attachment>) => {
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          name: attachment.name,
          url: attachment.url,
          type: attachment.type,
          size: attachment.size
        })
        .select()
        .single();

      if (error || !data) {
        console.error('Erro ao salvar anexo:', error);
        toast.error(`Falha ao salvar o anexo${error ? `: ${error.message}` : '.'}`);
        return false;
      }

      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            attachments: [...(t.attachments || []), {
              id: data.id,
              name: data.name,
              url: data.url,
              type: data.type,
              size: data.size,
              uploadedAt: data.uploaded_at
            }]
          };
        }
        return t;
      }));
      return true;
    } catch (err: any) {
      console.error('Erro ao salvar anexo:', err);
      toast.error(`Falha ao salvar o anexo${err?.message ? `: ${err.message}` : '.'}`);
      return false;
    }
  }, []);

  const removeTaskAttachment = useCallback(async (taskId: string, attachmentId: string) => {
    const { data, error } = await supabaseAdmin
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId)
      .select();

    if (error) {
      console.error('Erro ao excluir anexo:', error);
      toast.error(`Falha ao excluir o anexo: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      toast.error('Falha ao excluir o anexo: registro não encontrado.');
      return;
    }

    // Remove o arquivo físico do Storage (a URL pública contém bucket + caminho)
    const url: string = (data[0] as any)?.url || '';
    const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (match) {
      const storagePath = decodeURIComponent(match[2]);
      const { error: storageError } = await supabaseAdmin.storage.from(match[1]).remove([storagePath]);
      if (storageError) console.error('Erro ao remover arquivo do Storage:', storageError);
    }

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          attachments: (t.attachments || []).filter(a => a.id !== attachmentId)
        };
      }
      return t;
    }));
    toast.success('Anexo excluído.');
  }, []);

  const saveTaskComment = useCallback(async (taskId: string, text: string) => {
    if (!currentUser) return false;
    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        user_id: currentUser.id,
        text: text
      })
      .select()
      .single();

    if (data && !error) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            comments: [...(t.comments || []), {
              id: data.id,
              userId: data.user_id,
              text: data.text,
              timestamp: data.created_at
            }]
          };
        }
        return t;
      }));
      return true;
    }
    return false;
  }, [currentUser]);

  const editTaskComment = useCallback(async (taskId: string, commentId: string, newText: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('task_comments')
      .update({ text: newText, updated_at: now })
      .eq('id', commentId);
    if (error) { toast.error('Erro ao editar comentário.'); return; }
    setTasks(prev => prev.map(t => t.id !== taskId ? t : {
      ...t,
      comments: (t.comments || []).map(c => c.id === commentId ? { ...c, text: newText, updatedAt: now } : c),
    }));
  }, []);

  const deleteTaskComment = useCallback(async (taskId: string, commentId: string) => {
    const { error } = await supabase
      .from('task_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId);
    if (error) { toast.error('Erro ao excluir comentário.'); return; }
    setTasks(prev => prev.map(t => t.id !== taskId ? t : {
      ...t,
      comments: (t.comments || []).filter(c => c.id !== commentId),
    }));
    toast.success('Comentário excluído.');
  }, []);

  // isWatching vem do call site para evitar referência circular com tasks
  const toggleWatcher = useCallback(async (taskId: string, isWatching: boolean) => {
    if (!currentUser || currentUser.id === 'loading') return;
    if (isWatching) {
      const { error } = await supabase.from('task_watchers').delete().eq('task_id', taskId).eq('user_id', currentUser.id);
      if (error) { toast.error('Erro ao parar de observar.'); return; }
      setTasks(prev => prev.map(t => t.id !== taskId ? t : { ...t, watcherIds: (t.watcherIds || []).filter(id => id !== currentUser.id) }));
    } else {
      const { error } = await supabase.from('task_watchers').insert({ task_id: taskId, user_id: currentUser.id });
      if (error) { toast.error('Erro ao observar tarefa.'); return; }
      setTasks(prev => prev.map(t => t.id !== taskId ? t : { ...t, watcherIds: [...(t.watcherIds || []), currentUser.id] }));
      toast.success('Você está observando esta tarefa.');
    }
  }, [currentUser]);

  const saveTaskActivity = useCallback(async (taskId: string, type: string, oldValue?: string, newValue?: string) => {
    if (!currentUser || currentUser.id === 'loading') return null;
    const { data, error } = await supabase
      .from('task_activities')
      .insert({
        task_id: taskId,
        user_id: currentUser.id,
        type: type,
        old_value: oldValue,
        new_value: newValue
      })
      .select()
      .single();

    if (data && !error) {
      const activity: TaskActivity = {
        id: data.id,
        taskId: data.task_id,
        userId: data.user_id,
        type: data.type,
        oldValue: data.old_value,
        newValue: data.new_value,
        createdAt: data.created_at
      };
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            activities: [activity, ...(t.activities || [])]
          };
        }
        return t;
      }));
      return activity;
    }
    return null;
  }, [currentUser]);

  const saveExtensionLog = useCallback(async (taskId: string, log: ExtensionLog) => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('task_extension_logs')
      .insert({
        task_id: taskId,
        old_date: log.oldDate,
        new_date: log.newDate,
        reason: log.reason,
        updated_by: currentUser.id
      })
      .select()
      .single();

    if (data && !error) {
      // update local state too if not already updated by caller
    }
  }, [currentUser]);

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setCurrentUser({
          id: data.id,
          name: data.name,
          email: data.email,
          avatar: data.avatar || `https://picsum.photos/seed/${data.id}/100`,
          role: data.role as UserRole,
          theme: data.theme,
        });
      } else {
        // Fallback: busca dados diretamente do Auth e tenta criar perfil se faltar
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const isGeovane = user.email === 'geovane.silva@verticalparts.com.br';
          const userData = {
            id: user.id,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
            email: user.email || '',
            avatar: user.user_metadata?.avatar || `https://picsum.photos/seed/${user.id}/100`,
            role: (isGeovane ? UserRole.ADMIN : (user.user_metadata?.role as UserRole)) || UserRole.COLABORADOR,
          };

          // Criar perfil no banco para evitar violações de FK em outras tabelas
          await supabase.from('profiles').insert([userData]).select();

          setCurrentUser(userData);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar perfil:', err);
      if (err?.message?.includes('LockManager')) {
        toast.error('O sistema detectou um conflito de sessão. Por favor, recarregue a página.');
      } else {
        toast.error('Erro ao carregar dados do usuário. Tente recarregar.');
      }
    }
  }, []);

  useEffect(() => {
    let authInitialized = false;

    // Fonte primária de auth: getSession ao montar
    supabase.auth.getSession().then(async ({ data: { session: s }, error }) => {
      if (error) {
        console.error("Erro ao obter sessão:", error);
      } else {
        setSession(s);
        if (s) {
          try {
            await loadUserProfile(s.user.id);
          } catch (err) {
            console.error("Erro ao carregar perfil durante getSession:", err);
          }
        }
      }
      if (!isSSOProcessing.current) setIsLoadingAuth(false);
      authInitialized = true;
    }).catch(err => {
      console.error("Erro fatal ao verificar sessão:", err);
      toast.error("Erro ao verificar sessão. Por favor, recarregue a página.");
      if (!isSSOProcessing.current) setIsLoadingAuth(false);
      authInitialized = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      // Ignorar eventos iniciais — getSession() já cuida do carregamento
      if (!authInitialized && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        return;
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setCurrentUser(FALLBACK_USER);
        setIs2faVerified(false);
        localStorage.removeItem('vp_2fa_verified');
        setIsLoadingAuth(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' && s) {
        // Apenas atualiza o token sem recarregar todo o perfil
        setSession(s);
        return;
      }

      // Outros eventos pós-login (ex: SIGNED_IN após logout/re-login)
      if (s) {
        setSession(s);
        try {
          await loadUserProfile(s.user.id);
        } catch (err) {
          console.error("Erro ao carregar perfil no onAuthStateChange:", err);
        }
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserProfile]);

  // Theme State (temas prontos)
  const [themePreset, setThemePreset] = useState<ThemePresetId>(() => {
    const saved = localStorage.getItem("vp_theme_preset") as ThemePresetId | null;
    return saved && saved in THEME_PRESETS ? saved : "claro";
  });
  const [uiScale, setUiScale] = useState(1); // 1 = 100%
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const applyThemePreset = useCallback((presetId: ThemePresetId) => {
    const preset = THEME_PRESETS[presetId];
    if (!preset) return;

    Object.entries(preset.vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, []);

  useEffect(() => {
    applyThemePreset(themePreset);
    localStorage.setItem("vp_theme_preset", themePreset);

    // Persist to Supabase if user is logged in
    if (currentUser && currentUser.id !== 'loading') {
      supabase.from('profiles').update({ theme: themePreset }).eq('id', currentUser.id)
        .then(({ error }) => {
          if (error) console.error('Erro ao salvar tema no perfil:', error);
        });
    }
  }, [themePreset, applyThemePreset, currentUser.id]);

  // Sync themePreset with currentUser when it's loaded
  useEffect(() => {
    if (currentUser.theme && currentUser.theme in THEME_PRESETS) {
      setThemePreset(currentUser.theme as ThemePresetId);
    }
  }, [currentUser.theme]);

  const [statusGroups, setStatusGroups] = useState<StatusGroup[]>([]);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [createListFolderId, setCreateListFolderId] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<CustomFieldValue[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTag[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ field: 'created' | 'title' | 'priority' | 'dueDate' | 'status'; direction: 'asc' | 'desc' }>({ field: 'created', direction: 'asc' });
  const [teams, setTeams] = useState<Team[]>([]);
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState(false);

  useEffect(() => {
    // localStorage.removeItem("vp_docs"); // Clean up old mock data if needed
  }, []);

  // Campos personalizados visíveis por Lista (protótipo local)
  const [hiddenTaskFieldIdsByList, setHiddenTaskFieldIdsByList] = useState<Record<string, string[]>>({});

  // Colunas padrão visíveis por Lista (protótipo local)
  type StandardColumnKey = "status" | "priority" | "assignee" | "extensions" | "dueDate";
  const [hiddenStandardColumnKeysByList, setHiddenStandardColumnKeysByList] = useState<Record<string, StandardColumnKey[]>>({});

  // Ordem das colunas por Lista (protótipo local)
  const [columnOrderByList, setColumnOrderByList] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem("vp_column_order");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem("vp_column_order", JSON.stringify(columnOrderByList));
  }, [columnOrderByList]);

  // Lista ativa (selecionada na sidebar) — afeta filtro e configuração de colunas por lista
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [activeView, setActiveView] = useState<'List' | 'Kanban' | 'Calendar' | 'Gantt' | 'Table' | 'Dashboard' | 'Admin' | 'Doc'>('Dashboard');
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [automationListId, setAutomationListId] = useState<string | null>(null);

  // --- Inline Rename / Confirm modal state ---
  const [renameModal, setRenameModal] = useState<{ title: string; defaultValue: string; placeholder?: string; onSubmit: (v: string) => void } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<NavigationScope>({ type: 'global', id: null, name: 'Dashboard' });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isFieldManagerOpen, setIsFieldManagerOpen] = useState(false);
  const [taskToDuplicate, setTaskToDuplicate] = useState<Task | null>(null);
  const [isDuplicatingTask, setIsDuplicatingTask] = useState(false);

  // New State for Creation Modals
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isCreateWikiModalOpen, setIsCreateWikiModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false); // New Task Modal State
  const [prefilledTaskData, setPrefilledTaskData] = useState<Partial<Task> | null>(null);
  const [targetSpaceId, setTargetSpaceId] = useState<string | null>(null);

  // User Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showGlobalAI, setShowGlobalAI] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Admin - carregado do Supabase
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [userAccess, setUserAccess] = useState<Record<string, { spaceIds: string[]; folderIds: string[] }>>({});

  // Tarefas globais para o Dashboard (sempre todas, sem filtro de escopo)
  const [dashboardTasks, setDashboardTasks] = useState<Task[]>([]);
  const [dashboardLists, setDashboardLists] = useState<{ id: string; name: string }[]>([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      // Carregar Spaces
      const { data: spacesData } = await supabase.from('spaces').select('*');
      if (spacesData) {
        setSpaces(spacesData.map((s: any) => ({
          id: s.id,
          name: s.name,
          workspaceId: s.workspace_id,
          color: s.color,
          icon: s.icon,
          isSystem: s.is_system ?? false,
        })));
      }

      // Carregar Folders
      const { data: foldersData } = await supabase.from('folders').select('*');
      if (foldersData) {
        setFolders(foldersData.map((f: any) => ({
          id: f.id,
          name: f.name,
          spaceId: f.space_id
        })));
      }

      // Carregar Lists
      const { data: listsData } = await supabase.from('lists').select('*');
      if (listsData) {
        setLists(listsData.map((l: any) => ({
          id: l.id,
          name: l.name,
          folderId: l.folder_id,
          statusGroupId: l.status_group_id
        })));
      }

      // Carregar Custom Fields
      const { data: fieldsData } = await supabase.from('custom_fields').select('*');
      if (fieldsData) {
        setCustomFields(fieldsData.map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type as CustomFieldType,
          isMandatory: f.is_mandatory,
          defaultValue: f.default_value,
          config: f.config,
          target: f.target,
          visibleTo: f.visible_to,
          createdBy: f.created_by,
          createdAt: f.created_at
        })));
      }

      // Carregar Custom Field Values
      const { data: valuesData } = await supabase.from('custom_field_values').select('*');
      if (valuesData) {
        setFieldValues(valuesData.map((v: any) => ({
          fieldId: v.field_id,
          entityId: v.entity_id,
          value: v.value
        })));
      }

      // Carregar Documentos
      const { data: docsData } = await supabase.from('docs').select('*');
      const { data: attachmentsData } = await supabase.from('doc_attachments').select('*');

      if (docsData) {
        setDocs(docsData.map((d: any) => {
          const docAttachments = (attachmentsData || [])
            .filter((a: any) => a.doc_id === d.id)
            .map((a: any) => ({
              id: a.id,
              name: a.name,
              url: a.url,
              type: a.type,
              size: a.size,
              uploadedAt: a.uploaded_at
            }));

          return {
            id: d.id,
            title: d.title,
            content: d.content || '',
            headerImage: d.header_image,
            folderId: d.folder_id,
            createdBy: d.created_by,
            attachments: docAttachments,
            parentId: d.parent_id,
            isWiki: d.is_wiki || false
          };
        }));
      }

      // Carregar Projetos
      const { data: projectsData } = await supabase.from('projects').select('*');
      if (projectsData) {
        setProjects(projectsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          department: p.department,
          managerId: p.manager_id,
          status: p.status,
          lists: []
        })));
      }

      // Carregar Workspace Tags
      const { data: tagsData } = await supabase
        .from('workspace_tags')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('name');
      if (tagsData) setWorkspaceTags(tagsData as WorkspaceTag[]);

      // Carregar User Access
      const { data: accessData } = await supabase.from('user_access').select('*');
      if (accessData) {
        const nextAccess: Record<string, { spaceIds: string[]; folderIds: string[] }> = {};
        accessData.forEach((a: any) => {
          nextAccess[a.user_id] = {
            spaceIds: a.space_ids || [],
            folderIds: a.folder_ids || [],
          };
        });
        setUserAccess(nextAccess);
      }

      // Carregar Equipes e membros
      const { data: teamsData } = await supabase.from('teams').select('*').order('name');
      const { data: teamMembersData } = await supabase.from('team_members').select('*');
      if (teamsData) {
        setTeams(teamsData.map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          color: t.color || '#8b5cf6',
          memberIds: (teamMembersData || []).filter((m: any) => m.team_id === t.id).map((m: any) => m.user_id),
        })));
      }

      // Carregar Status Groups e Options
      const { data: groupsData } = await supabase.from('task_status_groups').select('*');
      const { data: optionsData } = await supabase.from('task_status_options').select('*').order('order_index');

      if (groupsData && optionsData) {
        setStatusGroups(groupsData.map((g: any) => ({
          id: g.id,
          name: g.name,
          options: optionsData.filter((o: any) => o.group_id === g.id).map((o: any) => ({
            id: o.id,
            groupId: o.group_id,
            label: o.label,
            color: o.color,
            type: o.type as StatusType,
            orderIndex: o.order_index
          }))
        })));
      }

    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
    }
  }, []);

  const loadAllUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true);           // exclui usuários inativados
    if (data && data.length > 0) {
      const users: User[] = data
        .filter((d: any) => !d.email?.includes('@vpclick.test')) // exclui contas CI/teste
        .map((d: any) => ({
          id: d.id,
          name: d.name,
          email: d.email,
          avatar: d.avatar || `https://picsum.photos/seed/${d.id}/100`,
          role: d.role as UserRole,
          theme: d.theme,
        }));

      // Ensure the logged-in user is always in the list even if they have no profile
      if (currentUser.id !== 'loading' && !users.some(u => u.id === currentUser.id)) {
        users.push(currentUser);
      }

      setAdminUsers(users);
      // User Access agora é carregado no loadInitialData
    } else {
      setAdminUsers([currentUser]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (session) {
      loadAllUsers();
      loadInitialData();
    }
  }, [session, loadAllUsers, loadInitialData]);

  // Realtime: atualiza userAccess + recarrega spaces/folders quando admin alterar permissões
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const channel = supabase
      .channel(`user-access-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_access',
        filter: `user_id=eq.${userId}`
      }, async (payload: any) => {
        const row = payload.new || payload.old;
        if (row && payload.eventType !== 'DELETE') {
          // Atualiza acesso
          setUserAccess(prev => ({
            ...prev,
            [userId]: {
              spaceIds: row.space_ids || [],
              folderIds: row.folder_ids || [],
            }
          }));
          // Recarrega spaces e folders para garantir que novos espaços criados
          // após o login do usuário sejam incluídos no array
          const { data: spacesData } = await supabase.from('spaces').select('*');
          if (spacesData) {
            setSpaces(spacesData.map((s: any) => ({
              id: s.id, name: s.name, workspaceId: s.workspace_id, color: s.color, icon: s.icon, isSystem: s.is_system ?? false
            })));
          }
          const { data: foldersData } = await supabase.from('folders').select('*');
          if (foldersData) {
            setFolders(foldersData.map((f: any) => ({
              id: f.id, name: f.name, spaceId: f.space_id
            })));
          }
          const { data: listsData } = await supabase.from('lists').select('*');
          if (listsData) {
            setLists(listsData.map((l: any) => ({
              id: l.id, name: l.name, folderId: l.folder_id, statusGroupId: l.status_group_id
            })));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  const [searchQuery, setSearchQuery] = useState('');

  // Detect taskId in URL on load — abre a tarefa direto (deep link), sem
  // travar em somente-leitura: quem recebe o link já está autenticado no
  // app com seu próprio papel/permissão, não é um visitante externo.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('taskId');
    if (taskId) {
      setSelectedTaskId(taskId);
    }
  }, []);

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  const loadTasks = useCallback(async () => {
    if (!session) return;

    let query = supabaseAdmin.from('tasks').select('*');

    if (activeListId) {
      query = query.eq('list_id', activeListId);
    } else if (activeScope.type === 'folder' && activeScope.id) {
      // Buscar listas da pasta
      const folderListIds = lists.filter(l => l.folderId === activeScope.id).map(l => l.id);
      query = query.in('list_id', folderListIds);
    } else if (activeScope.type === 'space' && activeScope.id) {
      // Buscar pastas do espaço
      const spaceFolderIds = folders.filter(f => f.spaceId === activeScope.id).map(f => f.id);
      const spaceListIds = lists.filter(l => spaceFolderIds.includes(l.folderId)).map(l => l.id);
      query = query.in('list_id', spaceListIds);
    }

    const { data, error } = await query;

    if (data && !error) {
      const taskIds = data.map((d: any) => d.id);

      // Busca uma sub-entidade filtrando por task_id em LOTES.
      // Um único .in('task_id', [milhares de UUIDs]) gera uma URL de dezenas de
      // milhares de caracteres e o servidor responde 400 (Bad Request), fazendo
      // comentários/checklists/anexos/etc sumirem silenciosamente no escopo global.
      // Quebramos em lotes de 150 IDs (URL segura) e concatenamos os resultados.
      const fetchInChunks = async (
        build: (ids: string[]) => PromiseLike<{ data: any[] | null; error: any }>,
        label: string
      ): Promise<any[]> => {
        const CHUNK = 150;
        const out: any[] = [];
        for (let i = 0; i < taskIds.length; i += CHUNK) {
          const slice = taskIds.slice(i, i + CHUNK);
          if (slice.length === 0) continue;
          const { data: part, error: partErr } = await build(slice);
          if (partErr) {
            console.error(`loadTasks: erro ao carregar ${label} (lote ${i / CHUNK}):`, partErr);
            continue;
          }
          if (part) out.push(...part);
        }
        return out;
      };

      // Lotes rodam em paralelo por tabela
      const [attData, commData, logData, checkData, actData, watchData] = await Promise.all([
        fetchInChunks((ids) => supabaseAdmin.from('task_attachments').select('*').in('task_id', ids), 'task_attachments'),
        fetchInChunks((ids) => supabaseAdmin.from('task_comments').select('*').in('task_id', ids).is('deleted_at', null), 'task_comments'),
        fetchInChunks((ids) => supabaseAdmin.from('task_extension_logs').select('*').in('task_id', ids), 'task_extension_logs'),
        fetchInChunks((ids) => supabaseAdmin.from('task_checklists').select('*').in('task_id', ids), 'task_checklists'),
        fetchInChunks((ids) => supabaseAdmin.from('task_activities').select('*').in('task_id', ids), 'task_activities'),
        fetchInChunks((ids) => supabaseAdmin.from('task_watchers').select('task_id, user_id').in('task_id', ids), 'task_watchers'),
      ]);

      setTasks(data.map((d: any) => {
        const tAttachments = (attData || []).filter((a: any) => a.task_id === d.id).map((a: any) => ({
          id: a.id,
          name: a.name,
          url: a.url,
          type: a.type,
          size: a.size,
          uploadedAt: a.uploaded_at
        }));

        const tComments = (commData || []).filter((c: any) => c.task_id === d.id).map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          text: c.text,
          timestamp: c.created_at,
          updatedAt: c.updated_at || undefined,
        }));

        const tLogs = (logData || []).filter((l: any) => l.task_id === d.id).map((l: any) => ({
          id: l.id,
          oldDate: l.old_date,
          newDate: l.new_date,
          reason: l.reason,
          updatedBy: l.updated_by,
          timestamp: l.created_at
        }));

        const tChecklists = (checkData || []).filter((ck: any) => ck.task_id === d.id).map((ck: any) => ({
          id: ck.id,
          text: ck.text,
          completed: ck.completed
        }));

        const tActivities = (actData || []).filter((act: any) => act.task_id === d.id).map((act: any) => ({
          id: act.id,
          taskId: act.task_id,
          userId: act.user_id,
          type: act.type,
          oldValue: act.old_value,
          newValue: act.new_value,
          createdAt: act.created_at
        }));

        return {
          id: d.id,
          title: d.title,
          description: d.description || '',
          status: d.status as string,
          priority: d.priority as TaskPriority,
          mainAssigneeId: d.main_assignee_id,
          secondaryAssigneeIds: d.secondary_assignee_ids || [],
          startDate: d.start_date,
          dueDate: d.due_date,
          extensionCount: d.extension_count || 0,
          extensionHistory: tLogs,
          checklists: tChecklists,
          comments: tComments,
          attachments: tAttachments,
          activities: tActivities,
          listId: d.list_id,
          projectId: d.project_id,
          parentId: d.parent_id,
          createdAt: d.created_at,
          tags: d.tags || [],
          watcherIds: (watchData || []).filter((w: any) => w.task_id === d.id).map((w: any) => w.user_id),
        };
      }));
    }
  }, [session, activeListId, activeScope, lists, folders]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Mantém uma referência sempre atualizada de loadTasks para o realtime não
  // precisar recriar o canal a cada mudança de escopo.
  const loadTasksRef = useRef(loadTasks);
  useEffect(() => { loadTasksRef.current = loadTasks; }, [loadTasks]);

  // Realtime de tarefas e comentários: reflete alterações feitas por outros
  // usuários/abas sem precisar recarregar a página. As tabelas precisam estar na
  // publicação `supabase_realtime` (migration 11). Recarrega o escopo atual com
  // debounce para não disparar múltiplas vezes em rajadas de eventos.
  useEffect(() => {
    if (!session?.user?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { loadTasksRef.current?.(); }, 1200);
    };
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, scheduleReload)
      .subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // ── Dashboard global: carrega TODAS as tarefas sem filtro de escopo ─────────
  const loadDashboardTasks = useCallback(async () => {
    if (!session) return;
    setIsDashboardLoading(true);
    try {
      // Paginação manual: Supabase limita 1000 linhas por request por padrão
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page, error: pageErr } = await supabaseAdmin
          .from('tasks')
          .select('*')
          .range(from, from + pageSize - 1);
        if (pageErr || !page || page.length === 0) break;
        allData = [...allData, ...page];
        if (page.length < pageSize) break;
        from += pageSize;
      }
      const data = allData;
      if (data.length > 0) {
        // Atividades + listas em paralelo (evita IN com milhares de IDs)
        const [actResult, listsResult] = await Promise.all([
          supabaseAdmin
            .from('task_activities')
            .select('id,task_id,user_id,type,old_value,new_value,created_at')
            .order('created_at', { ascending: false })
            .limit(200),
          supabaseAdmin.from('lists').select('id,name'),
        ]);
        const actData = actResult.data;
        if (listsResult.data) setDashboardLists(listsResult.data);

        const actMap = new Map<string, any[]>();
        (actData || []).forEach((a: any) => {
          if (!actMap.has(a.task_id)) actMap.set(a.task_id, []);
          actMap.get(a.task_id)!.push(a);
        });

        setDashboardTasks(data.map((d: any) => ({
          id: d.id,
          title: d.title,
          description: d.description || '',
          status: d.status as string,
          priority: d.priority as TaskPriority,
          mainAssigneeId: d.main_assignee_id,
          secondaryAssigneeIds: d.secondary_assignee_ids || [],
          startDate: d.start_date,
          dueDate: d.due_date,
          extensionCount: d.extension_count || 0,
          extensionHistory: [],
          checklists: [],
          comments: [],
          attachments: [],
          activities: (actMap.get(d.id) || []).map((a: any) => ({
            id: a.id, taskId: a.task_id, userId: a.user_id,
            type: a.type, oldValue: a.old_value, newValue: a.new_value, createdAt: a.created_at
          })),
          listId: d.list_id,
          projectId: d.project_id,
          parentId: d.parent_id,
          createdAt: d.created_at,
          tags: d.tags || []
        })));
      }
    } catch (err) {
      console.error('Erro ao carregar tarefas para Dashboard:', err);
    } finally {
      setIsDashboardLoading(false);
    }
  }, [session]);

  // Recarrega dados do Dashboard sempre que a view muda para Dashboard
  useEffect(() => {
    if (activeView === 'Dashboard') {
      loadDashboardTasks();
    }
  }, [activeView, loadDashboardTasks]);

  const updateTask = useCallback(async (updatedTask: Task): Promise<boolean> => {
    try {
      const { error } = await supabaseAdmin
        .from('tasks')
        .update({
          title: updatedTask.title,
          description: updatedTask.description,
          status: updatedTask.status,
          priority: updatedTask.priority,
          main_assignee_id: updatedTask.mainAssigneeId,
          secondary_assignee_ids: updatedTask.secondaryAssigneeIds,
          start_date: updatedTask.startDate,
          due_date: updatedTask.dueDate,
          list_id: updatedTask.listId,
          project_id: updatedTask.projectId,
          parent_id: updatedTask.parentId ?? null,
          extension_count: updatedTask.extensionCount,
        })
        .eq('id', updatedTask.id);

      if (!error) {
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
        return true;
      } else {
        console.error('Erro ao atualizar tarefa:', error);
        toast.error('Erro ao salvar tarefa: ' + error.message);
        return false;
      }
    } catch (err) {
      console.error('Erro inesperado ao atualizar tarefa:', err);
      toast.error('Erro inesperado ao salvar tarefa.');
      return false;
    }
  }, []);

  const handleUpdateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (updates.status) {
      const newStatus = updates.status.toLowerCase();
      const isDone = ['conclu', 'done', 'closed', 'complete', 'finaliz', 'pronto', 'aprovado']
        .some(kw => newStatus.includes(kw));
      if (isDone) {
        const bloqueada = await isTaskBlocked(taskId);
        if (bloqueada) {
          toast.warning('Esta tarefa está bloqueada por outra que ainda não foi concluída.');
          return;
        }
      }
    }

    updateTask({ ...task, ...updates });
  }, [tasks, updateTask]);

  // --- Bulk Actions (T701) ---
  const handleBulkStatusChange = async (ids: string[], status: string) => {
    const { error } = await supabase.from('tasks').update({ status }).in('id', ids);
    if (!error) {
      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status } : t));
      toast.success(`${ids.length} tarefa(s) atualizadas para "${status}"`);
    } else {
      toast.error('Erro ao alterar status: ' + error.message);
    }
  };

  const handleBulkPriorityChange = async (ids: string[], priority: TaskPriority) => {
    const { error } = await supabase.from('tasks').update({ priority }).in('id', ids);
    if (!error) {
      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, priority } : t));
      toast.success(`${ids.length} tarefa(s) com prioridade alterada para "${priority}"`);
    } else {
      toast.error('Erro ao alterar prioridade: ' + error.message);
    }
  };

  const handleBulkDelete = (ids: string[]) => {
    setConfirmModal({
      message: `Excluir ${ids.length} tarefa(s) permanentemente?`,
      onConfirm: async () => {
        const { error } = await supabaseAdmin.from('tasks').delete().in('id', ids).select();
        if (!error) {
          setTasks(prev => prev.filter(t => !ids.includes(t.id)));
          toast.success(`${ids.length} tarefa(s) removidas.`);
        } else {
          toast.error('Erro ao deletar tarefas: ' + error.message);
        }
      }
    });
  };

  const handleBulkMove = async (ids: string[], listId: string) => {
    const { error } = await supabase.from('tasks').update({ list_id: listId }).in('id', ids);
    if (!error) {
      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, listId } : t));
      toast.success(`${ids.length} tarefa(s) movidas.`);
    } else {
      toast.error('Erro ao mover tarefas: ' + error.message);
    }
  };

  // --- Deletion and Renaming Logic ---
  const handleDeleteTask = (taskId: string) => {
    setConfirmModal({
      message: 'Excluir esta tarefa permanentemente?',
      onConfirm: async () => {
        const { error } = await supabaseAdmin.from('tasks').delete().eq('id', taskId).select();
        if (!error) {
          setTasks(prev => prev.filter(t => t.id !== taskId));
          if (selectedTaskId === taskId) setSelectedTaskId(null);
          toast.success('Tarefa excluída.');
        } else { toast.error('Erro ao excluir tarefa: ' + error.message); }
      }
    });
  };

  const handleDeleteSpace = (spaceId: string) => {
    // Bloquear exclusão de spaces nativos do Hub de Integrações
    const space = spaces.find(s => s.id === spaceId);
    if (space?.isSystem) {
      toast.error('🔒 Este espaço é nativo do VP Click e não pode ser excluído.');
      return;
    }
    setConfirmModal({
      message: 'Excluir este espaço e todas as suas pastas e tarefas?',
      onConfirm: async () => {
        const { error } = await supabaseAdmin.from('spaces').delete().eq('id', spaceId).select();
        if (!error) {
          setSpaces(prev => prev.filter(s => s.id !== spaceId));
          setFolders(prev => prev.filter(f => f.spaceId !== spaceId));
          if (activeScope.type === 'space' && activeScope.id === spaceId) handleNavigate('global', null, 'Dashboard');
          toast.success('Espaço excluído.');
        } else { toast.error('Erro ao excluir espaço: ' + error.message); }
      }
    });
  };

  const handleRenameSpace = (spaceId: string, currentName: string) => {
    setRenameModal({
      title: 'Renomear Espaço', defaultValue: currentName,
      onSubmit: async (newName) => {
        const { error } = await supabase.from('spaces').update({ name: newName }).eq('id', spaceId);
        if (!error) {
          setSpaces(prev => prev.map(s => s.id === spaceId ? { ...s, name: newName } : s));
          if (activeScope.type === 'space' && activeScope.id === spaceId) setActiveScope(prev => ({ ...prev, name: newName }));
          toast.success('Espaço renomeado.');
        } else { toast.error('Erro: ' + error.message); }
      }
    });
  };

  const handleDeleteFolder = (folderId: string) => {
    setConfirmModal({
      message: 'Excluir esta pasta e todas as suas tarefas?',
      onConfirm: async () => {
        const { error } = await supabaseAdmin.from('folders').delete().eq('id', folderId).select();
        if (!error) {
          setFolders(prev => prev.filter(f => f.id !== folderId));
          if (activeScope.type === 'folder' && activeScope.id === folderId) handleNavigate('global', null, 'Dashboard');
          toast.success('Pasta excluída.');
        } else { toast.error('Erro ao excluir pasta: ' + error.message); }
      }
    });
  };

  const handleBulkDeleteFolders = (folderIds: string[], onDone: () => void) => {
    setConfirmModal({
      message: `Excluir ${folderIds.length} pasta(s) e todos os seus projetos permanentemente?`,
      onConfirm: async () => {
        let errorCount = 0;
        for (const folderId of folderIds) {
          const { error } = await supabaseAdmin.from('folders').delete().eq('id', folderId).select();
          if (error) { errorCount++; toast.error('Erro ao excluir pasta: ' + error.message); }
          else {
            setFolders(prev => prev.filter(f => f.id !== folderId));
            if (activeScope.type === 'folder' && activeScope.id === folderId) handleNavigate('global', null, 'Dashboard');
          }
        }
        if (errorCount === 0) toast.success(`${folderIds.length} pasta(s) excluída(s).`);
        onDone();
      }
    });
  };

  const handleRenameFolder = (folderId: string, currentName: string) => {
    setRenameModal({
      title: 'Renomear Pasta', defaultValue: currentName,
      onSubmit: async (newName) => {
        const { error } = await supabase.from('folders').update({ name: newName }).eq('id', folderId);
        if (!error) {
          setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName } : f));
          if (activeScope.type === 'folder' && activeScope.id === folderId) setActiveScope(prev => ({ ...prev, name: newName }));
          toast.success('Pasta renomeada.');
        } else { toast.error('Erro: ' + error.message); }
      }
    });
  };

  const handleDeleteList = (listId: string) => {
    setConfirmModal({
      message: 'Excluir esta lista e todas as suas tarefas permanentemente?',
      onConfirm: async () => {
        const { error } = await supabaseAdmin.from('lists').delete().eq('id', listId).select();
        if (!error) {
          setLists(prev => prev.filter(l => l.id !== listId));
          setTasks(prev => prev.filter(t => t.listId !== listId));
          if (activeListId === listId) setActiveListId(null);
          toast.success('Lista excluída.');
        } else { toast.error('Erro ao excluir lista: ' + error.message); }
      }
    });
  };

  const handleRenameList = (listId: string, currentName: string) => {
    setRenameModal({
      title: 'Renomear Lista', defaultValue: currentName,
      onSubmit: async (newName) => {
        const { error } = await supabase.from('lists').update({ name: newName }).eq('id', listId);
        if (!error) {
          setLists(prev => prev.map(l => l.id === listId ? { ...l, name: newName } : l));
          toast.success('Lista renomeada.');
        } else { toast.error('Erro: ' + error.message); }
      }
    });
  };

  const handleDuplicateList = (listId: string, currentName: string) => {
    setRenameModal({
      title: 'Duplicar Projeto (Lista)', defaultValue: `${currentName} (cópia)`,
      onSubmit: async (newName) => {
        const sourceList = lists.find(l => l.id === listId);
        if (!sourceList) { toast.error('Lista de origem não encontrada.'); return; }

        const toastId = toast.loading('Duplicando projeto...');
        try {
          // 1. Cria a nova lista na mesma pasta, com o mesmo grupo de status
          const { data: newListData, error: listError } = await supabaseAdmin
            .from('lists')
            .insert({ name: newName.trim(), folder_id: sourceList.folderId, status_group_id: sourceList.statusGroupId })
            .select()
            .single();
          if (listError || !newListData) throw listError || new Error('A nova lista não foi retornada.');

          // 2. Busca todas as tarefas da lista direto do banco (estado local pode estar filtrado)
          const { data: sourceTasks, error: tasksError } = await supabaseAdmin
            .from('tasks').select('*').eq('list_id', listId);
          if (tasksError) throw tasksError;

          const idMap = new Map<string, string>();
          const allTasks = sourceTasks || [];
          const parents = allTasks.filter((t: any) => !t.parent_id);
          const children = allTasks.filter((t: any) => t.parent_id);

          const cloneRow = (t: any, parentId: string | null) => ({
            title: t.title,
            description: t.description || '',
            status: t.status,
            priority: t.priority,
            main_assignee_id: t.main_assignee_id,
            secondary_assignee_ids: t.secondary_assignee_ids || [],
            start_date: t.start_date,
            due_date: t.due_date,
            list_id: newListData.id,
            project_id: t.project_id || null,
            parent_id: parentId,
            extension_count: 0,
            tags: t.tags || [],
          });

          // 3. Insere tarefas principais em lote (ordem do retorno = ordem do insert)
          if (parents.length > 0) {
            const { data: createdParents, error: parentsError } = await supabaseAdmin
              .from('tasks').insert(parents.map((t: any) => cloneRow(t, null))).select('id');
            if (parentsError || !createdParents) throw parentsError || new Error('Falha ao duplicar tarefas.');
            parents.forEach((t: any, i: number) => idMap.set(t.id, createdParents[i].id));
          }

          // 4. Insere subtarefas apontando para os novos pais
          const validChildren = children.filter((t: any) => idMap.has(t.parent_id));
          if (validChildren.length > 0) {
            const { data: createdChildren, error: childrenError } = await supabaseAdmin
              .from('tasks').insert(validChildren.map((t: any) => cloneRow(t, idMap.get(t.parent_id)!))).select('id');
            if (childrenError || !createdChildren) throw childrenError || new Error('Falha ao duplicar subtarefas.');
            validChildren.forEach((t: any, i: number) => idMap.set(t.id, createdChildren[i].id));
          }

          const oldTaskIds = Array.from(idMap.keys());
          if (oldTaskIds.length > 0) {
            // 5. Copia checklists
            const { data: checklists } = await supabaseAdmin
              .from('task_checklists').select('task_id, text, completed').in('task_id', oldTaskIds);
            if (checklists && checklists.length > 0) {
              await supabaseAdmin.from('task_checklists').insert(
                checklists.map((c: any) => ({ task_id: idMap.get(c.task_id)!, text: c.text, completed: c.completed }))
              );
            }

            // 6. Copia valores de campos personalizados
            const { data: customValues } = await supabaseAdmin
              .from('custom_field_values').select('field_id, entity_id, value').in('entity_id', oldTaskIds);
            if (customValues && customValues.length > 0) {
              await supabaseAdmin.from('custom_field_values').insert(
                customValues.map((v: any) => ({ field_id: v.field_id, entity_id: idMap.get(v.entity_id)!, value: v.value }))
              );
            }
          }

          const newList: List = {
            id: newListData.id,
            name: newListData.name,
            folderId: newListData.folder_id,
            statusGroupId: newListData.status_group_id
          };
          setLists(prev => [...prev, newList]);
          setActiveListId(newList.id);
          toast.success(`Projeto duplicado: ${idMap.size} tarefa(s) copiada(s).`, { id: toastId });
        } catch (err: any) {
          console.error('Erro ao duplicar projeto:', err);
          toast.error(`Erro ao duplicar projeto: ${err?.message || 'tente novamente'}`, { id: toastId });
        }
      }
    });
  };

  const handleMoveList = async (listId: string, targetFolderId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list || list.folderId === targetFolderId) return;
    const { error } = await supabase.from('lists').update({ folder_id: targetFolderId }).eq('id', listId);
    if (!error) {
      setLists(prev => prev.map(l => l.id === listId ? { ...l, folderId: targetFolderId } : l));
      toast.success('Lista movida.');
    } else { toast.error('Erro ao mover lista: ' + error.message); }
  };

  const handleMoveFolder = async (folderId: string, targetSpaceId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder || folder.spaceId === targetSpaceId) return;
    const { error } = await supabase.from('folders').update({ space_id: targetSpaceId }).eq('id', folderId);
    if (!error) {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, spaceId: targetSpaceId } : f));
      toast.success('Pasta movida.');
    } else { toast.error('Erro ao mover pasta: ' + error.message); }
  };

  const handleCreateDoc = (folderId: string, parentId: string | null = null) => {
    setRenameModal({
      title: parentId ? 'Nova Subpágina' : 'Novo Documento', defaultValue: '', placeholder: 'Título do documento…',
      onSubmit: async (title) => {
        if (!title.trim()) return;
        const { data, error } = await supabase
          .from('docs')
          .insert({ title: title.trim(), content: 'Comece a escrever aqui...', folder_id: folderId, created_by: currentUser.id, parent_id: parentId })
          .select().single();
        if (data && !error) {
          const newDoc: Doc = { id: data.id, title: data.title, content: data.content || '', headerImage: data.header_image, folderId: data.folder_id, createdBy: data.created_by, attachments: [], parentId: data.parent_id, isWiki: data.is_wiki || false };
          setDocs(prev => [...prev, newDoc]);
          setActiveDocId(newDoc.id);
          setActiveView('Doc');
          if (!parentId) setActiveScope({ type: 'folder', id: folderId, name: title.trim() });
        } else { toast.error('Erro ao criar documento: ' + error?.message); }
      }
    });
  };

  // Cria uma pasta "Wiki Interna" no espaço escolhido, com um Doc raiz (marcado
  // como wiki) e 10 subpáginas pré-preenchidas — um atalho pra montar a
  // estrutura de base de conhecimento inteira de uma vez.
  const handleCreateWiki = async (spaceId: string) => {
    try {
      const { data: folderData, error: folderError } = await supabase
        .from('folders')
        .insert({ name: 'Wiki Interna', space_id: spaceId })
        .select().single();
      if (folderError || !folderData) throw folderError || new Error('Falha ao criar pasta da wiki.');

      const newFolder: Folder = { id: folderData.id, name: folderData.name, spaceId: folderData.space_id };
      setFolders(prev => [...prev, newFolder]);

      const { data: rootData, error: rootError } = await supabase
        .from('docs')
        .insert({
          title: 'Wiki Interna',
          content: WIKI_INTRO_HTML,
          folder_id: newFolder.id,
          created_by: currentUser.id,
          is_wiki: true
        })
        .select().single();
      if (rootError || !rootData) throw rootError || new Error('Falha ao criar o documento raiz da wiki.');

      const rootDoc: Doc = { id: rootData.id, title: rootData.title, content: rootData.content || '', headerImage: rootData.header_image, folderId: rootData.folder_id, createdBy: rootData.created_by, attachments: [], parentId: null, isWiki: true };

      const sectionsToInsert = WIKI_TEMPLATE_SECTIONS.map(s => ({
        title: s.title,
        content: s.html,
        folder_id: newFolder.id,
        created_by: currentUser.id,
        parent_id: rootDoc.id
      }));
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('docs')
        .insert(sectionsToInsert)
        .select();
      if (sectionsError) throw sectionsError;

      const sectionDocs: Doc[] = (sectionsData || []).map((d: any) => ({
        id: d.id, title: d.title, content: d.content || '', headerImage: d.header_image, folderId: d.folder_id, createdBy: d.created_by, attachments: [], parentId: d.parent_id, isWiki: false
      }));

      setDocs(prev => [...prev, rootDoc, ...sectionDocs]);
      setActiveScope({ type: 'folder', id: newFolder.id, name: newFolder.name });
      setActiveDocId(rootDoc.id);
      setActiveView('Doc');
      toast.success('Wiki Interna criada com 10 páginas de base.');
    } catch (err: any) {
      console.error('Erro ao criar wiki:', err);
      toast.error(`Falha ao criar a wiki${err?.message ? `: ${err.message}` : '.'}`);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    setConfirmModal({
      message: 'Excluir este documento permanentemente?',
      onConfirm: async () => {
        const { error } = await supabase.from('docs').delete().eq('id', docId);
        if (!error) {
          setDocs(prev => prev.filter(d => d.id !== docId));
          if (activeDocId === docId) { setActiveDocId(null); setActiveView('Dashboard'); }
          toast.success('Documento excluído.');
        } else { toast.error('Erro ao excluir documento: ' + error.message); }
      }
    });
  };

  // --- Admin Persistence Handlers ---
  const handleAdminUpdateRole = async (userId: string, role: UserRole) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (!error) {
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } else {
      console.error('Erro ao atualizar papel do usuário:', error);
    }
  };

  const handleAdminUpdateAccess = async (userId: string, spaceIds: string[], folderIds: string[]) => {
    // Insere ou atualiza o acesso do usuário usando o padrão OnConflict
    const saveAccess = () => supabase
      .from('user_access')
      .upsert({
        user_id: userId,
        space_ids: spaceIds,
        folder_ids: folderIds,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    let { error } = await saveAccess();

    // 23503 = FK violada: o usuário existe no Auth mas ainda não tem linha em
    // profiles (criado pelo admin e nunca logou). Cria o perfil e tenta de novo.
    if (error?.code === '23503') {
      const user = adminUsers.find(u => u.id === userId);
      if (user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          is_active: true,
        }, { onConflict: 'id' });
        if (!profileError) ({ error } = await saveAccess());
      }
    }

    if (error) {
      console.error('Erro ao atualizar acessos:', error);
      toast.error('Erro ao salvar acessos: ' + error.message);
      return;
    }

    // Atualizar estado local
    setUserAccess(prev => ({
      ...prev,
      [userId]: { spaceIds, folderIds }
    }));
    toast.success('Acessos atualizados!');
  };

  const handleAdminDeleteUser = async (userId: string) => {
    if (window.confirm("Excluir este usuário permanentemente?")) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (!error) {
        setAdminUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        console.error('Erro ao excluir usuário:', error);
      }
    }
  };

  const handleAdminUpdateUserAvatar = async (userId: string, avatarUrl: string) => {
    const { data, error } = await supabase.from('profiles').update({ avatar: avatarUrl }).eq('id', userId).select();
    if (error) {
      console.error('Erro ao atualizar avatar:', error);
      throw error;
    }
    if (!data || data.length === 0) {
      // Nenhuma linha atualizada: o perfil ainda não existe em profiles
      // (usuário criado pelo admin e que nunca logou). Cria já com o avatar.
      const user = adminUsers.find(u => u.id === userId);
      if (!user) throw new Error('Usuário não encontrado.');
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: avatarUrl,
        role: user.role,
        is_active: true,
      }, { onConflict: 'id' });
      if (upsertError) {
        console.error('Erro ao criar perfil com avatar:', upsertError);
        throw upsertError;
      }
    }
    setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, avatar: avatarUrl } : u));
    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, avatar: avatarUrl }));
    }
  };

  const handleAdminUpdatePassword = async (userId: string, newPassword: string) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) {
      console.error('Erro ao atualizar senha:', error);
      throw error;
    }
  };

  const handleAdminCreateUser = async (user: Partial<User>, password?: string) => {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: user.email!,
      password: password || 'Click@2026',
      email_confirm: true,
      user_metadata: {
        name: user.name,
        role: user.role
      }
    });

    if (data && !error) {
      const newUser: User = {
        id: data.user.id,
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || `https://picsum.photos/seed/${data.user.id}/100`,
        role: (user.role as UserRole) || UserRole.COLABORADOR
      };
      // Garante a linha em profiles na hora (FKs de user_access/teams dependem
      // dela) em vez de esperar o trigger do Auth ou o primeiro login.
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
        role: newUser.role,
        is_active: true,
      }, { onConflict: 'id' });
      if (profileError) {
        console.error('Erro ao criar perfil do novo usuário:', profileError);
        toast.error('Usuário criado no Auth, mas houve erro ao criar o perfil: ' + profileError.message);
      }
      setAdminUsers(prev => [newUser, ...prev]);
      setUserAccess(prev => ({ ...prev, [newUser.id]: { spaceIds: [], folderIds: [] } }));
      return newUser;
    } else {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  };

  const handleUpdateDoc = async (updatedDoc: Doc) => {
    const { error } = await supabase
      .from('docs')
      .update({
        title: updatedDoc.title,
        content: updatedDoc.content,
        header_image: updatedDoc.headerImage,
        is_wiki: updatedDoc.isWiki || false
      })
      .eq('id', updatedDoc.id);

    if (!error) {
      setDocs(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    } else {
      console.error('Erro ao atualizar documento:', error);
    }
  };

  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (!error) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          const updatedTask = { ...t, status: newStatus };

          // SESSION_04 — AutomationEngine.evaluate() com context + callbacks
          const prevTask = t;
          const listId = t.listId;
          if (listId) {
            supabase
              .from('automations')
              .select('*')
              .eq('list_id', listId)
              .eq('enabled', true)
              .then(({ data: automationData }) => {
                if (!automationData?.length) return;
                const engine = new AutomationEngine(automationData as any[]);
                const ctx: AutomationContext = {
                  previousTask: prevTask,
                  triggerType: 'status_changed',
                  workspaceId: workspace.id,
                  currentUserId: currentUser.id,
                };
                const cbs: AutomationCallbacks = {
                  onChangeStatus:    (tid, s) => { supabase.from('tasks').update({ status: s }).eq('id', tid); },
                  onChangePriority:  (tid, p) => { supabase.from('tasks').update({ priority: p }).eq('id', tid); },
                  onAddAssignee:     (tid, uid) => { supabase.from('tasks').update({ main_assignee_id: uid }).eq('id', tid); },
                  onRemoveAssignee:  (tid) => { supabase.from('tasks').update({ main_assignee_id: null }).eq('id', tid); },
                  onPostComment:     (tid, text) => {
                    supabase.from('comments').insert({ task_id: tid, user_id: currentUser.id, text });
                  },
                  onAddTag: (tid, tag) => {
                    const task = tasks.find(tk => tk.id === tid);
                    if (!task) return;
                    const newTags = Array.from(new Set([...(task.tags ?? []), tag]));
                    supabase.from('tasks').update({ tags: newTags }).eq('id', tid);
                  },
                  onRemoveTag: (tid, tag) => {
                    const task = tasks.find(tk => tk.id === tid);
                    if (!task) return;
                    supabase.from('tasks').update({ tags: (task.tags ?? []).filter(tg => tg !== tag) }).eq('id', tid);
                  },
                  onSendNotification: (message, userId) => {
                    toast.info(message);
                    // Grava no sino: do destinatário configurado ou do responsável da tarefa
                    const targetId = userId || prevTask.mainAssigneeId;
                    if (targetId) {
                      supabase.from('notifications').insert({
                        user_id: targetId,
                        actor_id: currentUser.id,
                        type: 'automation',
                        title: `Automação: ${message}`,
                        body: `Tarefa "${prevTask.title}"`,
                        task_id: prevTask.id,
                      }).then(({ error }) => { if (error) console.error('Erro ao notificar automação:', error); });
                    }
                  },
                  onCreateTask: (taskData) => {
                    supabase.from('tasks').insert({
                      title: taskData.title ?? 'Nova tarefa',
                      list_id: taskData.listId ?? listId,
                      status: 'A fazer',
                      created_by: currentUser.id,
                    });
                  },
                  onCreateSubtask: (parentId, taskData) => {
                    supabase.from('tasks').insert({
                      title: taskData.title ?? 'Nova subtarefa',
                      parent_id: parentId,
                      list_id: listId,
                      status: 'A fazer',
                      created_by: currentUser.id,
                    });
                  },
                };
                engine.evaluate(updatedTask, ctx, cbs).catch(err =>
                  console.error('[AutomationEngine] status_changed:', err)
                );
              });
          }

          return updatedTask;
        }
        return t;
      }));
    } else {
      console.error('Erro ao atualizar status:', error);
    }
  }, []);

  const handleUpdateFieldValue = useCallback(async (fieldId: string, entityId: string, value: any) => {
    const { error } = await supabase
      .from('custom_field_values')
      .upsert({
        field_id: fieldId,
        entity_id: entityId,
        value
      }, { onConflict: 'field_id,entity_id' });

    if (!error) {
      setFieldValues(prev => {
        const existingIndex = prev.findIndex(v => v.fieldId === fieldId && v.entityId === entityId);
        if (existingIndex > -1) {
          const next = [...prev];
          next[existingIndex] = { ...next[existingIndex], value };
          return next;
        }
        return [...prev, { fieldId, entityId, value }];
      });
    } else {
      console.error('Erro ao salvar valor do campo:', error);
    }
  }, []);

  const handleCreateField = useCallback(async (newField: CustomField) => {
    const { data, error } = await supabase
      .from('custom_fields')
      .insert({
        name: newField.name,
        type: newField.type,
        is_mandatory: newField.isMandatory,
        default_value: newField.defaultValue,
        config: newField.config,
        target: newField.target,
        visible_to: newField.visibleTo,
        created_by: currentUser.id
      })
      .select()
      .single();

    if (data && !error) {
      const field: CustomField = {
        id: data.id,
        name: data.name,
        type: data.type as CustomFieldType,
        isMandatory: data.is_mandatory,
        defaultValue: data.default_value,
        config: data.config,
        target: data.target,
        visibleTo: data.visible_to,
        createdBy: data.created_by,
        createdAt: data.created_at
      };
      setCustomFields(prev => [...prev, field]);
    } else {
      console.error('Erro ao criar campo personalizado:', error);
    }
  }, [currentUser.id]);

  const handleReorderField = useCallback((index: number, direction: 'up' | 'down') => {
    // Para simplificar o protótipo, mantemos a reordenação local por enquanto.
    // Em um sistema real, haveria um campo 'order' no banco.
    setCustomFields(prev => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[newIndex];
      next[newIndex] = temp;
      return next;
    });
  }, []);

  const handleUpdateField = useCallback(async (updatedField: CustomField) => {
    const { error } = await supabase
      .from('custom_fields')
      .update({
        name: updatedField.name,
        type: updatedField.type,
        is_mandatory: updatedField.isMandatory,
        default_value: updatedField.defaultValue,
        config: updatedField.config,
        target: updatedField.target,
        visible_to: updatedField.visibleTo
      })
      .eq('id', updatedField.id);

    if (!error) {
      setCustomFields(prev => prev.map(f => f.id === updatedField.id ? updatedField : f));
    } else {
      console.error('Erro ao atualizar campo personalizado:', error);
    }
  }, []);

  const handleDeleteField = useCallback(async (fieldId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este campo personalizado permanentemente? Isso removerá todos os valores preenchidos em todas as tarefas.')) {
      const { error } = await supabase.from('custom_fields').delete().eq('id', fieldId);
      if (!error) {
        setCustomFields(prev => prev.filter(f => f.id !== fieldId));
        setFieldValues(prev => prev.filter(v => v.fieldId !== fieldId));
      } else {
        console.error('Erro ao excluir campo personalizado:', error);
      }
    }
  }, []);

  const handleToggleTaskFieldForList = useCallback((listId: string, fieldId: string) => {
    setHiddenTaskFieldIdsByList((prev) => {
      const current = prev[listId] ?? [];
      if (current.includes(fieldId)) {
        // Campo está oculto → remover da lista (habilitar novamente)
        return { ...prev, [listId]: current.filter(id => id !== fieldId) };
      }
      // Campo está visível → adicionar à lista (ocultar)
      return { ...prev, [listId]: [...current, fieldId] };
    });
  }, []);

  // Creation Handlers
  const handleCreateSpace = async (name: string, color: string, icon: string = 'Layout') => {
    const { data, error } = await supabaseAdmin
      .from('spaces')
      .insert({
        name,
        workspace_id: workspace.id,
        color,
        icon
      })
      .select()
      .single();

    if (data && !error) {
      const newSpace: Space = {
        id: data.id,
        name: data.name,
        workspaceId: data.workspace_id,
        color: data.color,
        icon: data.icon
      };
      setSpaces([...spaces, newSpace]);

      if (currentUser.role !== UserRole.ADMIN) {
        const currentAccess = userAccess[currentUser.id] || { spaceIds: [], folderIds: [] };
        const newSpaceIds = [...currentAccess.spaceIds, newSpace.id];
        await handleAdminUpdateAccess(currentUser.id, newSpaceIds, currentAccess.folderIds);
      }

      toast.success('Espaço criado com sucesso!');
      setIsSpaceModalOpen(false);
    } else {
      console.error('Erro ao criar espaço:', error);
      toast.error('Erro ao criar espaço: ' + error?.message);
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!targetSpaceId) return;

    // 1. Criar Folder
    const { data: folderData, error: folderError } = await supabaseAdmin
      .from('folders')
      .insert({ name, space_id: targetSpaceId })
      .select()
      .single();

    if (folderData && !folderError) {
      const newFolder: Folder = {
        id: folderData.id,
        name: folderData.name,
        spaceId: folderData.space_id
      };

      // 2. Criar lista padrão 'Geral' com o primeiro grupo de status (Padrão)
      const defaultStatusGroupId = statusGroups.find(g => g.name === 'Padrão')?.id || statusGroups[0]?.id;

      const { data: listData, error: listError } = await supabaseAdmin
        .from('lists')
        .insert({
          name: 'Geral',
          folder_id: folderData.id,
          status_group_id: defaultStatusGroupId
        })
        .select()
        .single();

      if (listData && !listError) {
        const defaultList: List = {
          id: listData.id,
          name: listData.name,
          folderId: listData.folder_id,
          statusGroupId: listData.status_group_id
        };
        setFolders([...folders, newFolder]);
        setLists([...lists, defaultList]);
      } else {
        setFolders([...folders, newFolder]);
      }

      if (currentUser.role !== UserRole.ADMIN) {
        const currentAccess = userAccess[currentUser.id] || { spaceIds: [], folderIds: [] };
        const newSpaceIds = currentAccess.spaceIds.includes(targetSpaceId)
          ? currentAccess.spaceIds
          : [...currentAccess.spaceIds, targetSpaceId];
        const newFolderIds = [...currentAccess.folderIds, newFolder.id];
        await handleAdminUpdateAccess(currentUser.id, newSpaceIds, newFolderIds);
      }

      toast.success('Pasta criada com sucesso!');
      setIsFolderModalOpen(false);
      setTargetSpaceId(null);
    } else {
      console.error('Erro ao criar pasta:', folderError);
      toast.error('Erro ao criar pasta: ' + folderError?.message);
    }
  };

  const handleCreateList = useCallback(
    (folderId: string) => {
      setCreateListFolderId(folderId);
      setIsCreateListModalOpen(true);
    },
    [],
  );

  const handleConfirmCreateList = async (folderId: string, name: string, statusGroupId: string): Promise<void> => {
    const folder = folders.find((f) => f.id === folderId);

    const { data, error } = await supabaseAdmin
      .from('lists')
      .insert({
        name: name.trim(),
        folder_id: folderId,
        status_group_id: statusGroupId
      })
      .select()
      .single();

    if (error || !data) {
      toast.error('Erro ao criar lista: ' + (error?.message || 'tente novamente'));
      return;
    }

    const newList: List = {
      id: data.id,
      name: data.name,
      folderId: data.folder_id,
      statusGroupId: data.status_group_id
    };

    setLists((prev) => [...prev, newList]);
    setActiveListId(newList.id);
    if (folder) {
      setActiveScope({ type: 'folder', id: folder.id, name: folder.name });
      setActiveView('List');
    }
    toast.success('Lista criada com sucesso!');
    setIsCreateListModalOpen(false);
    setCreateListFolderId(null);
  };

  const handleCreateTask = async (newTaskPartial: Partial<Task>) => {
    try {
      // Pegar o status inicial da lista se não fornecido
      let defaultStatus = 'A fazer';
      if (newTaskPartial.listId) {
        const list = lists.find(l => l.id === newTaskPartial.listId);
        if (list) {
          const group = statusGroups.find(g => g.id === list.statusGroupId);
          if (group && group.options.length > 0) {
            defaultStatus = group.options[0].label;
          }
        }
      }

      if (!newTaskPartial.listId) {
        toast.error('Selecione uma lista antes de criar a tarefa.');
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert({
          title: newTaskPartial.title || 'Nova Tarefa',
          description: newTaskPartial.description || '',
          status: newTaskPartial.status || defaultStatus,
          priority: newTaskPartial.priority || TaskPriority.MEDIA,
          main_assignee_id: newTaskPartial.mainAssigneeId || currentUser.id,
          secondary_assignee_ids: [],
          // `toISOString()` converte para UTC: à noite no Brasil (UTC-3) já
          // é o dia seguinte em UTC, o que fazia tarefas criadas de noite
          // nascerem com data de início/prazo erradas. Usamos data local.
          start_date: formatLocalDate(new Date()),
          due_date: newTaskPartial.dueDate || formatLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          list_id: newTaskPartial.listId,
          project_id: newTaskPartial.projectId || null,
          parent_id: newTaskPartial.parentId || null
        })
        .select()
        .single();

      if (data && !error) {
        const newTask: Task = {
          id: data.id,
          title: data.title,
          description: data.description || '',
          status: data.status,
          priority: data.priority as TaskPriority,
          mainAssigneeId: data.main_assignee_id,
          secondaryAssigneeIds: data.secondary_assignee_ids || [],
          startDate: data.start_date,
          dueDate: data.due_date,
          extensionCount: data.extension_count || 0,
          extensionHistory: [],
          checklists: [],
          comments: [],
          attachments: [],
          activities: [],
          listId: data.list_id,
          projectId: data.project_id,
          parentId: data.parent_id,
          createdAt: data.created_at
        };
        setTasks(prev => [newTask, ...prev]);
        setIsTaskModalOpen(false);
        setPrefilledTaskData(null);
        toast.success('Tarefa criada com sucesso!');
      } else {
        console.error('Erro ao criar tarefa:', error);
        toast.error('Erro ao criar tarefa: ' + error?.message);
      }
    } catch (err) {
      console.error('Erro inesperado ao criar tarefa:', err);
      toast.error('Erro inesperado ao criar tarefa. Tente novamente.');
    }
  };

  const handleDuplicateTask = async (sourceTask: Task, options: DuplicateTaskOptions) => {
    if (!sourceTask || isDuplicatingTask) return;
    const title = options.title.trim();
    if (!title) {
      toast.error('Informe um nome para a nova tarefa.');
      return;
    }
    if (!options.listId) {
      toast.error('Selecione uma lista de destino.');
      return;
    }

    setIsDuplicatingTask(true);
    try {
      const clonePayload = {
        title,
        description: options.includeDescription ? (sourceTask.description || '') : '',
        status: sourceTask.status,
        priority: options.includePriority ? sourceTask.priority : TaskPriority.MEDIA,
        main_assignee_id: options.includeAssignees ? sourceTask.mainAssigneeId : currentUser.id,
        secondary_assignee_ids: options.includeAssignees ? (sourceTask.secondaryAssigneeIds || []) : [],
        start_date: options.includeDates ? (sourceTask.startDate || null) : null,
        due_date: options.includeDates ? (sourceTask.dueDate || null) : null,
        list_id: options.listId,
        project_id: sourceTask.projectId || null,
        parent_id: null,
        extension_count: 0,
        tags: options.includeTags ? (sourceTask.tags || []) : [],
      };

      const { data: created, error } = await supabaseAdmin
        .from('tasks')
        .insert(clonePayload)
        .select()
        .single();

      if (error || !created) {
        throw error || new Error('A tarefa duplicada não foi retornada pelo banco.');
      }

      const duplicatedTask: Task = {
        id: created.id,
        title: created.title,
        description: created.description || '',
        status: created.status,
        priority: created.priority as TaskPriority,
        mainAssigneeId: created.main_assignee_id,
        secondaryAssigneeIds: created.secondary_assignee_ids || [],
        startDate: created.start_date,
        dueDate: created.due_date,
        extensionCount: created.extension_count || 0,
        extensionHistory: [],
        checklists: [],
        comments: [],
        attachments: [],
        activities: [],
        listId: created.list_id,
        projectId: created.project_id,
        parentId: created.parent_id,
        createdAt: created.created_at,
        tags: created.tags || [],
      };

      const stateTasksToAdd: Task[] = [duplicatedTask];
      const fieldValuesToAdd: CustomFieldValue[] = [];

      if (options.includeChecklists && (sourceTask.checklists || []).length > 0) {
        const checklistRows = sourceTask.checklists.map((item) => ({
          task_id: duplicatedTask.id,
          text: item.text,
          completed: item.completed,
        }));
        const { data: checklistData, error: checklistError } = await supabase
          .from('task_checklists')
          .insert(checklistRows)
          .select();

        if (checklistError) throw checklistError;
        duplicatedTask.checklists = (checklistData || []).map((item: any) => ({
          id: item.id,
          text: item.text,
          completed: item.completed,
        }));
      }

      if (options.includeCustomFields) {
        const originalValues = fieldValues.filter((value) => value.entityId === sourceTask.id);
        if (originalValues.length > 0) {
          const customValueRows = originalValues.map((value) => ({
            field_id: value.fieldId,
            entity_id: duplicatedTask.id,
            value: value.value,
          }));
          const { error: customValuesError } = await supabase
            .from('custom_field_values')
            .insert(customValueRows);

          if (customValuesError) throw customValuesError;
          fieldValuesToAdd.push(...originalValues.map((value) => ({
            ...value,
            entityId: duplicatedTask.id,
          })));
        }
      }

      if (options.includeSubtasks) {
        const subtasks = tasks.filter((task) => task.parentId === sourceTask.id);
        for (const subtask of subtasks) {
          const { data: createdSubtask, error: subtaskError } = await supabaseAdmin
            .from('tasks')
            .insert({
              title: subtask.title,
              description: options.includeDescription ? (subtask.description || '') : '',
              status: subtask.status,
              priority: options.includePriority ? subtask.priority : TaskPriority.MEDIA,
              main_assignee_id: options.includeAssignees ? subtask.mainAssigneeId : currentUser.id,
              secondary_assignee_ids: options.includeAssignees ? (subtask.secondaryAssigneeIds || []) : [],
              start_date: options.includeDates ? (subtask.startDate || null) : null,
              due_date: options.includeDates ? (subtask.dueDate || null) : null,
              list_id: options.listId,
              project_id: subtask.projectId || sourceTask.projectId || null,
              parent_id: duplicatedTask.id,
              extension_count: 0,
              tags: options.includeTags ? (subtask.tags || []) : [],
            })
            .select()
            .single();

          if (subtaskError || !createdSubtask) {
            throw subtaskError || new Error(`Não foi possível duplicar a subtarefa "${subtask.title}".`);
          }

          const duplicatedSubtask: Task = {
            id: createdSubtask.id,
            title: createdSubtask.title,
            description: createdSubtask.description || '',
            status: createdSubtask.status,
            priority: createdSubtask.priority as TaskPriority,
            mainAssigneeId: createdSubtask.main_assignee_id,
            secondaryAssigneeIds: createdSubtask.secondary_assignee_ids || [],
            startDate: createdSubtask.start_date,
            dueDate: createdSubtask.due_date,
            extensionCount: createdSubtask.extension_count || 0,
            extensionHistory: [],
            checklists: [],
            comments: [],
            attachments: [],
            activities: [],
            listId: createdSubtask.list_id,
            projectId: createdSubtask.project_id,
            parentId: createdSubtask.parent_id,
            createdAt: createdSubtask.created_at,
            tags: createdSubtask.tags || [],
          };

          if (options.includeChecklists && (subtask.checklists || []).length > 0) {
            const { data: subChecklistData, error: subChecklistError } = await supabase
              .from('task_checklists')
              .insert(subtask.checklists.map((item) => ({
                task_id: duplicatedSubtask.id,
                text: item.text,
                completed: item.completed,
              })))
              .select();

            if (subChecklistError) throw subChecklistError;
            duplicatedSubtask.checklists = (subChecklistData || []).map((item: any) => ({
              id: item.id,
              text: item.text,
              completed: item.completed,
            }));
          }

          if (options.includeCustomFields) {
            const subtaskValues = fieldValues.filter((value) => value.entityId === subtask.id);
            if (subtaskValues.length > 0) {
              const { error: subtaskValuesError } = await supabase
                .from('custom_field_values')
                .insert(subtaskValues.map((value) => ({
                  field_id: value.fieldId,
                  entity_id: duplicatedSubtask.id,
                  value: value.value,
                })));

              if (subtaskValuesError) throw subtaskValuesError;
              fieldValuesToAdd.push(...subtaskValues.map((value) => ({
                ...value,
                entityId: duplicatedSubtask.id,
              })));
            }
          }

          stateTasksToAdd.push(duplicatedSubtask);
        }
      }

      await supabase.from('task_activities').insert({
        task_id: duplicatedTask.id,
        user_id: currentUser.id,
        type: 'TASK_DUPLICATED',
        old_value: sourceTask.id,
        new_value: sourceTask.title,
      });

      setTasks(prev => [...stateTasksToAdd, ...prev]);
      if (fieldValuesToAdd.length > 0) {
        setFieldValues(prev => [...prev, ...fieldValuesToAdd]);
      }
      setTaskToDuplicate(null);
      setSelectedTaskId(duplicatedTask.id);
      toast.success(`Tarefa "${duplicatedTask.title}" duplicada com sucesso.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Erro ao duplicar tarefa:', err);
      toast.error('Erro ao duplicar tarefa: ' + message);
    } finally {
      setIsDuplicatingTask(false);
    }
  };

  const openFolderModal = (spaceId: string) => {
    setTargetSpaceId(spaceId);
    setIsFolderModalOpen(true);
  };

  // Navigation Handlers
  const handleNavigate = (type: ScopeType, id: string | null, name: string) => {
    setActiveScope({ type, id, name });

    // Ao trocar o escopo manualmente (global/space/folder), resetamos a lista ativa.
    // A seleção de lista na sidebar seta activeListId explicitamente.
    setActiveListId(null);

    // Navegação de escopo: espaço → Space Overview (Dashboard); pasta → List; global → Dashboard
    if (type === 'space' && activeView === 'Dashboard') {
      // Mantém Dashboard → SpaceOverview renderiza o overview do espaço
    } else if (type === 'folder' && activeView === 'Dashboard') {
      setActiveView('List');
    } else if (type === 'global') {
      setActiveView('Dashboard');
    }
  };

  const openAdminPanel = () => {
    setIsUserMenuOpen(false);
    setSelectedTaskId(null);
    setActiveScope({ type: 'global', id: null, name: 'Painel do Administrador' });
    setActiveView('Admin');
  };

  // Conjunto de pastas que o usuário pode ver: acesso a um ESPAÇO implica acesso
  // a TODAS as pastas daquele espaço (inclusive as criadas depois) — além das
  // pastas concedidas explicitamente. Isso evita o caso em que o colaborador tem
  // o espaço liberado mas o vê vazio porque folder_ids não acompanhou.
  const allowedFolderIdSet = useMemo(() => {
    if (currentUser.role === UserRole.ADMIN) return null; // null = acesso total
    const access = userAccess[currentUser.id];
    if (!access) return new Set<string>();
    const spaceIds = new Set(access.spaceIds || []);
    const ids = new Set<string>(access.folderIds || []);
    folders.forEach(f => { if (spaceIds.has(f.spaceId)) ids.add(f.id); });
    return ids;
  }, [folders, userAccess, currentUser]);

  // Filter Tasks based on Hierarchy ONLY (for Dashboard)
  const scopeTasks = useMemo(() => {
    let baseTasks = tasks;

    // Se não for ADMIN, filtramos as tarefas globais pelas pastas permitidas
    // SEMPRE incluímos tarefas onde o usuário é assignee direto (ex: tarefas do VPRequisições)
    if (currentUser.role !== UserRole.ADMIN) {
      const allowedFolderIds = allowedFolderIdSet ?? new Set<string>();
      const allowedListIds = lists.filter(l => allowedFolderIds.has(l.folderId)).map(l => l.id);
      const accessibleTasks = tasks.filter(t => allowedListIds.includes(t.listId));
      const assignedTasks = tasks.filter(t =>
        t.mainAssigneeId === currentUser.id ||
        (t.secondaryAssigneeIds ?? []).includes(currentUser.id)
      );
      // União sem duplicatas
      const seen = new Set<string>();
      baseTasks = [...accessibleTasks, ...assignedTasks].filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
    }

    let result = baseTasks;
    if (activeScope.type === 'folder' && activeScope.id) {
      const folderListIds = lists.filter(l => l.folderId === activeScope.id).map(l => l.id);
      result = result.filter(t => folderListIds.includes(t.listId));
    } else if (activeScope.type === 'space' && activeScope.id) {
      const spaceFolderIds = folders.filter(f => f.spaceId === activeScope.id).map(f => f.id);
      const spaceListIds = lists.filter(l => spaceFolderIds.includes(l.folderId)).map(l => l.id);
      result = result.filter(t => spaceListIds.includes(t.listId));
    }
    return result;
  }, [tasks, activeScope, lists, folders, currentUser, allowedFolderIdSet]);

  // ── Badge counts: tarefas abertas por lista (ClickUp-style) ──────────────
  const listTaskCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (!t.listId) continue;
      const s = (t.status || '').toLowerCase();
      const isDone = s.includes('conclu') || s.includes('aprovado') || s.includes('fechado') || s.includes('done') || s.includes('cancel');
      if (!isDone) {
        map.set(t.listId, (map.get(t.listId) || 0) + 1);
      }
    }
    return map;
  }, [tasks]);

  // ── Progress map: { done, total } por lista (Space Overview) ────────────
  const listProgressMap = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of tasks) {
      if (!t.listId) continue;
      const s = (t.status || '').toLowerCase();
      const isDone = s.includes('conclu') || s.includes('aprovado') || s.includes('fechado') || s.includes('done') || s.includes('cancel');
      const cur = map.get(t.listId) || { done: 0, total: 0 };
      map.set(t.listId, { done: cur.done + (isDone ? 1 : 0), total: cur.total + 1 });
    }
    return map;
  }, [tasks]);

  // ── Favorites (Supabase-synced, localStorage como seed inicial) ──────────
  const [favorites, setFavorites] = useState<{ type: 'list' | 'folder' | 'space'; id: string; name: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('vp_favorites') || '[]'); } catch { return []; }
  });

  // Carrega favoritos do Supabase ao autenticar (sobrescreve localStorage)
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from('user_favorites').select('type, item_id, item_name').eq('user_id', session.user.id)
      .then(({ data }) => {
        if (!data) return;
        const favs = data.map((r: any) => ({ type: r.type as 'list' | 'folder' | 'space', id: r.item_id, name: r.item_name }));
        setFavorites(favs);
        localStorage.setItem('vp_favorites', JSON.stringify(favs));
      });
  }, [session?.user?.id]);

  const toggleFavorite = async (type: 'list' | 'folder' | 'space', id: string, name: string) => {
    const exists = favorites.some(f => f.type === type && f.id === id);
    const next = exists
      ? favorites.filter(f => !(f.type === type && f.id === id))
      : [...favorites, { type, id, name }];
    setFavorites(next);
    localStorage.setItem('vp_favorites', JSON.stringify(next));
    if (!session?.user?.id) return;
    if (exists) {
      await supabase.from('user_favorites').delete().eq('user_id', session.user.id).eq('type', type).eq('item_id', id);
    } else {
      await supabase.from('user_favorites').upsert({ user_id: session.user.id, type, item_id: id, item_name: name }, { onConflict: 'user_id,type,item_id' });
    }
  };

  // Filter Tasks based on Hierarchy + Search + Filters (for List/Kanban)
  const filteredTasks = useMemo(() => {
    let result = scopeTasks;

    // Se uma lista específica estiver selecionada na sidebar, filtramos por ela.
    if (activeListId) {
      result = result.filter((t) => t.listId === activeListId);
    }

    if (searchQuery) {
      result = result.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Filter "Minhas Tarefas" view for ALL users
    if (activeScope.name === 'Minhas Tarefas') {
      result = result.filter(t => t.mainAssigneeId === currentUser.id || t.secondaryAssigneeIds?.includes(currentUser.id));
    }

    // No escopo global (Início / sem espaço selecionado), COLABORADOR vê só suas tarefas.
    // Quando navega para um espaço ou pasta específica, vê todas as tarefas daquele contexto.
    if (currentUser.role === UserRole.COLABORADOR && activeScope.type === 'global') {
      result = result.filter(t => t.mainAssigneeId === currentUser.id || t.secondaryAssigneeIds?.includes(currentUser.id));
    }

    if (filterTags.length > 0) {
      result = result.filter(t => filterTags.some(tag => (t.tags ?? []).includes(tag)));
    }

    // Sort
    const PRIORITY_ORDER: Record<string, number> = { 'Urgente': 4, 'Alta': 3, 'Média': 2, 'Baixa': 1 };
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sortConfig.field) {
        case 'title':
          return dir * a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
        case 'priority': {
          const pa = PRIORITY_ORDER[a.priority] ?? 0;
          const pb = PRIORITY_ORDER[b.priority] ?? 0;
          return dir * (pb - pa);
        }
        case 'dueDate': {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return dir * (da - db);
        }
        case 'status':
          return dir * (a.status ?? '').localeCompare(b.status ?? '', 'pt-BR', { sensitivity: 'base' });
        default: // 'created'
          return dir * ((a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
      }
    });

    return result;
  }, [scopeTasks, activeListId, searchQuery, currentUser, activeScope, filterTags, sortConfig]);

  // O modal "Gerenciar Campos Personalizados" precisa saber qual lista está
  // ativa pra ler/gravar quais campos estão ocultos — usa a mesma resolução
  // que o ListView (ver `resolveActiveListId`), senão os toggles gravam numa
  // chave que a tabela nunca consulta e parecem não ter efeito nenhum.
  const fieldManagerListId = useMemo(
    () => resolveActiveListId(activeListId, filteredTasks),
    [activeListId, filteredTasks],
  );

  const filteredSpaces = useMemo(() => {
    if (currentUser.role === UserRole.ADMIN) return spaces;
    const access = userAccess[currentUser.id];
    if (!access) return [];
    return spaces.filter((s) => access.spaceIds.includes(s.id));
  }, [spaces, userAccess, currentUser]);

  const filteredFolders = useMemo(() => {
    if (currentUser.role === UserRole.ADMIN) return folders;
    if (!allowedFolderIdSet) return folders;
    return folders.filter((f) => allowedFolderIdSet.has(f.id));
  }, [folders, allowedFolderIdSet, currentUser]);

  const uiScaleClass = uiScale <= 0.9 ? 'text-xs' : uiScale >= 1.2 ? 'text-base' : 'text-sm';

  // Auth guard — a tela só libera quando a sessão for verificada E o vídeo
  // do logo tiver tocado por completo, o que vier depois. Não há tela de
  // login própria pra cobrir aqui: a entrada é sempre via SSO do vpsistema.
  if (isLoadingAuth || !bootVideoEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-3">Gestão de Tarefas</p>
          <video
            src={bootLogoVideo}
            autoPlay
            muted
            playsInline
            onEnded={() => setBootVideoEnded(true)}
            onError={() => setBootVideoEnded(true)}
            className="w-full max-w-sm mx-auto rounded-xl shadow-lg shadow-slate-200"
          />
          <p className="font-light text-2xl tracking-wide mt-4" style={{ color: COLORS.primary, fontFamily: 'Poppins, sans-serif' }}>VPCLICK</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <svg className="w-4 h-4 animate-spin" style={{ color: COLORS.primary }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-slate-400 text-xs">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session || !is2faVerified) {
    return <LoginScreen onLogin={() => setIs2faVerified(true)} />;
  }

  return (
    <SSOHandler>
      <Toaster richColors position="top-right" />
      <div
        className={`flex h-screen bg-background text-foreground font-sans selection:bg-[var(--primary-color)]/30 ${uiScaleClass}`}
        onClick={() => setIsUserMenuOpen(false)}
        style={{
          ...(themePreset ? THEME_PRESETS[themePreset].vars : {}),
          "--primary-color": "hsl(var(--primary))",
          zoom: uiScale,
        } as React.CSSProperties}
      >
        {/* Sidebar */}
        <Sidebar
          themePreset={themePreset}
          spaces={filteredSpaces}
          folders={filteredFolders}
          lists={lists}
          activeView={activeView}
          activeScope={activeScope}
          activeListId={activeListId}
          onSetActiveListId={setActiveListId}
          onNavigate={handleNavigate}
          onViewChange={setActiveView}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenFields={() => setIsFieldManagerOpen(true)}
          onOpenCreateSpace={() => setIsSpaceModalOpen(true)}
          onOpenCreateFolder={openFolderModal}
          onCreateList={handleCreateList}
          userRole={currentUser.role}
          onRenameSpace={handleRenameSpace}
          onDeleteSpace={handleDeleteSpace}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onBulkDeleteFolders={handleBulkDeleteFolders}
          onDeleteList={handleDeleteList}
          onRenameList={handleRenameList}
          onDuplicateList={handleDuplicateList}
          docs={docs}
          activeDocId={activeDocId}
          onSetActiveDocId={setActiveDocId}
          onCreateDoc={handleCreateDoc}
          onDeleteDoc={handleDeleteDoc}
          onMoveList={handleMoveList}
          onMoveFolder={handleMoveFolder}
          listTaskCounts={listTaskCounts}
          listProgressMap={listProgressMap}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted">
          {/* Header */}
          <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-800 hidden md:block">
                {activeListId ? (lists.find(l => l.id === activeListId)?.name ?? activeScope.name) : activeScope.name}
              </h1>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar tarefas..."
                  className="pl-8 pr-4 py-1.5 text-sm bg-gray-50 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] w-48 sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute left-2 top-2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>

              {/* Tag filter */}
              {workspaceTags.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${filterTags.length > 0 ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                      <Tag className="w-3.5 h-3.5" />
                      Tags
                      {filterTags.length > 0 && (
                        <span className="ml-0.5 bg-orange-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                          {filterTags.length}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Filtrar por tag</p>
                    {workspaceTags.map((tag) => (
                      <button
                        key={tag.id}
                        className="flex items-center gap-2 w-full px-2 py-1 rounded text-xs hover:bg-muted/50"
                        onClick={() =>
                          setFilterTags((prev) =>
                            prev.includes(tag.name)
                              ? prev.filter((t) => t !== tag.name)
                              : [...prev, tag.name]
                          )
                        }
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                        {filterTags.includes(tag.name) && (
                          <span className="ml-auto text-orange-500 font-bold">✓</span>
                        )}
                      </button>
                    ))}
                    {filterTags.length > 0 && (
                      <button
                        className="w-full text-xs text-muted-foreground mt-2 pt-2 border-t hover:text-foreground"
                        onClick={() => setFilterTags([])}
                      >
                        Limpar filtro
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              )}

              {/* Sort button */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${sortConfig.field !== 'created' ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Ordenar
                    {sortConfig.field !== 'created' && (
                      <span className="ml-0.5 bg-orange-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">1</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2" align="start">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Ordenar por</p>
                  {([
                    { field: 'created', label: 'Data de criação' },
                    { field: 'title',   label: 'Nome' },
                    { field: 'priority', label: 'Prioridade' },
                    { field: 'dueDate', label: 'Data limite' },
                    { field: 'status',  label: 'Status' },
                  ] as const).map(opt => {
                    const active = sortConfig.field === opt.field;
                    return (
                      <button
                        key={opt.field}
                        className={`flex items-center justify-between w-full px-2 py-1.5 rounded text-xs transition-colors ${active ? 'bg-orange-50 text-orange-600 font-semibold' : 'hover:bg-muted/50 text-foreground'}`}
                        onClick={() =>
                          setSortConfig(prev =>
                            prev.field === opt.field
                              ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                              : { field: opt.field, direction: 'asc' }
                          )
                        }
                      >
                        <span>{opt.label}</span>
                        {active && (
                          <span className="text-orange-500 font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    );
                  })}
                  {sortConfig.field !== 'created' && (
                    <button
                      className="w-full text-xs text-muted-foreground mt-2 pt-2 border-t hover:text-foreground"
                      onClick={() => setSortConfig({ field: 'created', direction: 'asc' })}
                    >
                      Restaurar ordem padrão
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-4 relative">
              {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GESTOR) && (
                <button
                  onClick={() => setIsCreateWikiModalOpen(true)}
                  title="Criar uma Wiki Interna (pasta + páginas de base já preenchidas)"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 font-bold text-sm rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" /> <span className="hidden md:inline">Wiki</span>
                </button>
              )}
              <button
                onClick={() => setShowGlobalAI(true)}
                title="IA do VP Click — modo Raio-X"
                className="flex items-center gap-1.5 px-3 py-1.5 text-purple-600 hover:bg-purple-50 font-bold text-sm rounded-lg transition-colors"
              >
                ✨ <span className="hidden md:inline">IA</span>
              </button>
              {showGlobalAI && (
                <div className="fixed inset-0 z-[95] bg-black/20" onClick={() => setShowGlobalAI(false)}>
                  <AIPanel onClose={() => setShowGlobalAI(false)} />
                </div>
              )}
              <NotificationBell
                currentUser={currentUser}
                users={adminUsers}
                onOpenTask={(taskId) => setSelectedTaskId(taskId)}
              />

              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold">{currentUser.name}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wider">{currentUser.role}</span>
              </div>

              <div
                className="relative cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setIsUserMenuOpen(!isUserMenuOpen); }}
              >
                <img src={currentUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-[var(--primary-color)] hover:opacity-90 transition-opacity" />

                {isUserMenuOpen && (
                  <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-[100] animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b mb-1">
                      <p className="font-bold text-gray-800">{currentUser.name}</p>
                      <p className="text-xs text-gray-500">{currentUser.email}</p>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); setIsChangePasswordModalOpen(true); setIsUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.5 17.5 14 20l-2.293 2.293c-.63.63-1.846.63-2.476 0l-2.293-2.293a1 1 0 00-1.414 0l-1.414 1.414a2 2 0 01-2.828 0 2 2 0 010-2.828l1.414-1.414a1 1 0 000-1.414l-1.414-1.414a2 2 0 010-2.828 2 2 0 012.828 0l2.293 2.293a1 1 0 001.414 0L13.257 8.257A6.002 6.002 0 0115 7z" /></svg>
                      Alterar senha
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsSettingsModalOpen(true); setIsUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Configurações
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); setIsTeamsModalOpen(true); setIsUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      Equipes
                    </button>

                    {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GESTOR) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAdminPanel();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[var(--primary-color)] font-bold hover:bg-gray-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        Painel Admin
                      </button>
                    )}

                    <div className="border-t my-1"></div>
                    <button
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        try {
                          await supabase.auth.signOut();
                        } catch (e) {
                          console.error("Erro no signOut:", e);
                        } finally {
                          setSession(null);
                          localStorage.clear();
                          sessionStorage.clear();
                          window.location.href = '/';
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Sair
                    </button>

                  </div>
                )}
              </div>
            </div>
          </header>

          {/* View Switcher / Toolbar */}
          <div className="h-12 border-b bg-white flex items-center px-6 gap-6 shrink-0 overflow-x-auto no-scrollbar">
            {activeView === 'Doc' ? (
              <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-500" />
                Documento
              </div>
            ) : activeView !== 'Admin' ? (
              <>
                {activeScope.type === 'space' && (
                  <ViewTab active={activeView === 'Dashboard'} onClick={() => setActiveView('Dashboard')} label="Overview" />
                )}
                <ViewTab active={activeView === 'List'} onClick={() => setActiveView('List')} label="Lista" />
                <ViewTab active={activeView === 'Kanban'} onClick={() => setActiveView('Kanban')} label="Kanban" />
                <ViewTab active={activeView === 'Calendar'} onClick={() => setActiveView('Calendar')} label="Calendário" />
                <ViewTab active={activeView === 'Gantt'} onClick={() => setActiveView('Gantt')} label="Gantt" />
                <ViewTab active={activeView === 'Table'} onClick={() => setActiveView('Table')} label="Tabela" />
                {activeScope.type !== 'space' && (
                  <ViewTab active={activeView === 'Dashboard'} onClick={() => setActiveView('Dashboard')} label="Dashboards" />
                )}
                {activeListId && (
                  <button
                    onClick={() => { setAutomationListId(activeListId); setIsAutomationModalOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors font-medium whitespace-nowrap"
                    title="Gerenciar automações desta lista"
                  >
                    <Icons.Zap className="w-3.5 h-3.5 text-yellow-500" /> Automações
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => setIsTaskModalOpen(true)}
                  className="bg-[var(--primary-color)] hover:brightness-90 text-[#2c3e50] font-semibold text-sm px-4 py-1.5 rounded-md flex items-center gap-2 transition-all whitespace-nowrap"
                >
                  <Icons.Plus /> <span className="hidden sm:inline">Criar Tarefa</span>
                </button>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-gray-800">Gerenciamento</div>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => { setActiveScope({ type: 'global', id: null, name: 'Dashboard' }); setActiveView('Dashboard'); }}
                  className="border rounded-md px-3 py-1.5 text-sm font-semibold bg-white hover:bg-gray-50"
                >
                  Voltar ao Dashboard
                </button>
              </>
            )}
          </div>

          {/* Dynamic View Area */}
          <main className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
          <div key={activeView} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            {activeView === 'Admin' && (
              <AdminPanel
                spaces={spaces}
                folders={folders}
                users={adminUsers}
                access={userAccess}
                onAdminUpdateRole={handleAdminUpdateRole}
                onAdminUpdateAccess={handleAdminUpdateAccess}
                onAdminDeleteUser={handleAdminDeleteUser}
                onAdminCreateUser={handleAdminCreateUser}
                onAdminUpdateAvatar={handleAdminUpdateUserAvatar}
                onAdminUpdatePassword={handleAdminUpdatePassword}
                onBack={() => { setActiveScope({ type: 'global', id: null, name: 'Dashboard' }); setActiveView('Dashboard'); }}
              />
            )}
            {activeView === 'List' && (
              <ListView
                tasks={filteredTasks}
                onSelectTask={setSelectedTaskId}
                onStatusChange={handleStatusChange}
                context={activeListId
                  ? { ...activeScope, name: lists.find(l => l.id === activeListId)?.name ?? activeScope.name }
                  : activeScope}
                onQuickCreate={(prefill?: any) => {
                  setPrefilledTaskData(prefill || null);
                  setIsTaskModalOpen(true);
                }}
                onDeleteTask={handleDeleteTask}
                onDuplicateTask={setTaskToDuplicate}
                lists={lists}
                activeListId={activeListId}
                hiddenStandardColumnKeysByList={hiddenStandardColumnKeysByList}
                onToggleStandardColumn={(listId: string, key: any) => {
                  setHiddenStandardColumnKeysByList((prev) => {
                    const current = prev[listId] ?? [];
                    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
                    return { ...prev, [listId]: next };
                  });
                }}
                customFields={customFields}
                fieldValues={fieldValues}
                hiddenTaskFieldIdsByList={hiddenTaskFieldIdsByList}
                onCreateField={handleCreateField}
                onUpdateFieldValue={handleUpdateFieldValue}
                onHideTaskFieldForList={handleToggleTaskFieldForList}
                onOpenManager={() => setIsFieldManagerOpen(true)}
                columnOrder={activeListId ? columnOrderByList[activeListId] : undefined}
                onReorderColumns={(newOrder) => {
                  if (activeListId) {
                    setColumnOrderByList(prev => ({ ...prev, [activeListId]: newOrder }));
                  }
                }}
                currentUser={currentUser}
                users={adminUsers}
                statusGroups={statusGroups}
                onBulkStatusChange={handleBulkStatusChange}
                onBulkPriorityChange={handleBulkPriorityChange}
                onBulkDelete={handleBulkDelete}
                onBulkMove={handleBulkMove}
              />
            )}
            {activeView === 'Kanban' && (
              <KanbanView
                tasks={filteredTasks}
                onSelectTask={setSelectedTaskId}
                onStatusChange={handleStatusChange}
                onDeleteTask={handleDeleteTask}
                onDuplicateTask={setTaskToDuplicate}
                onCreateTask={handleCreateTask}
                onQuickCreate={(prefill?: any) => {
                  setPrefilledTaskData(prefill || null);
                  setIsTaskModalOpen(true);
                }}
                users={adminUsers}
                statusGroups={statusGroups}
                lists={lists}
                activeListId={activeListId}
                workspaceTags={workspaceTags}
              />
            )}
            {activeView === 'Dashboard' && (
              activeScope.type === 'space' && activeScope.id ? (
                <SpaceOverview
                  space={spaces.find((s: Space) => s.id === activeScope.id)!}
                  folders={folders.filter((f: Folder) => f.spaceId === activeScope.id)}
                  lists={lists}
                  listProgressMap={listProgressMap}
                  tasks={scopeTasks}
                  onNavigateFolder={(id: string, name: string) => handleNavigate('folder', id, name)}
                  onNavigateList={(listId: string) => { setActiveListId(listId); setActiveView('List'); }}
                  onCreateFolder={() => openFolderModal(activeScope.id!)}
                />
              ) : (
                // Dashboard global: usa dashboardTasks (todas as tarefas, sem filtro de escopo)
                // Fallback para scopeTasks enquanto carrega pela primeira vez
                <DashboardView
                  tasks={dashboardTasks.length > 0 ? dashboardTasks : scopeTasks}
                  users={adminUsers}
                  statusGroups={statusGroups}
                  activeListId={activeListId}
                  lists={lists}
                  allLists={dashboardLists.length > 0 ? dashboardLists : lists}
                  isLoading={isDashboardLoading && dashboardTasks.length === 0}
                />
              )
            )}
            {activeView === 'Calendar' && (
              <CalendarView 
                tasks={filteredTasks} 
                users={adminUsers} 
                onTaskClick={setSelectedTaskId} 
                onAddTaskAtDate={(date) => {
                  setPrefilledTaskData({ dueDate: formatLocalDate(date) });
                  setIsTaskModalOpen(true);
                }}
              />
            )}
            {activeView === 'Gantt' && (
              <GanttView 
                tasks={filteredTasks} 
                onTaskClick={setSelectedTaskId} 
              />
            )}
            {activeView === 'Table' && (
              <TableView
                tasks={filteredTasks}
                customFields={customFields}
                fieldValues={fieldValues}
                users={adminUsers}
                onTaskClick={setSelectedTaskId}
                onUpdateTask={handleUpdateTask}
                onUpdateFieldValue={handleUpdateFieldValue}
                workspaceTags={workspaceTags}
              />
            )}
            {activeView === 'Doc' && activeDocId && (
              <DocView
                doc={docs.find(d => d.id === activeDocId)!}
                allDocs={docs}
                onUpdate={handleUpdateDoc}
                onSelectDoc={setActiveDocId}
                onCreateSubpage={(parentDoc: Doc) => handleCreateDoc(parentDoc.folderId, parentDoc.id)}
                currentUser={currentUser}
                uploadFile={uploadFile}
              />
            )}
          </div>
          </main>
        </div>

        {/* Task Detail Modal */}
        <CreateListModal
          isOpen={isCreateListModalOpen}
          onClose={() => setIsCreateListModalOpen(false)}
          onConfirm={async (name, statusGroupId) => {
            if (createListFolderId) {
              await handleConfirmCreateList(createListFolderId, name, statusGroupId);
            }
          }}
          statusGroups={statusGroups}
        />

        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            users={adminUsers}
            tasks={tasks}
            onClose={() => {
              setSelectedTaskId(null);
              const url = new URL(window.location.href);
              url.searchParams.delete('taskId');
              window.history.replaceState({}, '', url.toString());
            }}
            onUpdate={updateTask}
            currentUser={currentUser}
            customFields={customFields}
            fieldValues={fieldValues}
            onUpdateFieldValue={handleUpdateFieldValue}
            onDelete={() => handleDeleteTask(selectedTask.id)}
            onDuplicate={() => setTaskToDuplicate(selectedTask)}
            onSelectTask={setSelectedTaskId}
            onQuickCreate={(prefill?: any) => {
              setPrefilledTaskData(prefill || null);
              setIsTaskModalOpen(true);
            }}
            saveAttachment={saveTaskAttachment}
            removeAttachment={removeTaskAttachment}
            saveComment={saveTaskComment}
            editComment={editTaskComment}
            deleteComment={deleteTaskComment}
            toggleWatcher={toggleWatcher}
            saveExtensionLog={saveExtensionLog}
            saveTaskActivity={saveTaskActivity}
            uploadFile={uploadFile}
            statusGroups={statusGroups}
            lists={lists}
            folders={folders}
            workspaceId={workspace.id}
            teams={teams}
            onTagsChange={(taskId: string, tags: string[]) =>
              setTasks(prev => prev.map(t => t.id === taskId ? { ...t, tags } : t))
            }
          />
        )}

        <TeamsModal
          isOpen={isTeamsModalOpen}
          onClose={() => setIsTeamsModalOpen(false)}
          teams={teams}
          setTeams={setTeams}
          users={adminUsers}
          currentUser={currentUser}
        />

        {/* Create Task Modal */}
        {isTaskModalOpen && (
          <CreateTaskModal
            onClose={() => {
              setIsTaskModalOpen(false);
              setPrefilledTaskData(null);
            }}
            onCreate={handleCreateTask}
            users={adminUsers}
            spaces={filteredSpaces}
            additionalTasks={tasks}
            folders={filteredFolders}
            lists={lists}
            initialScope={activeScope}
            activeListId={activeListId}
            currentUser={currentUser}
            prefilledData={prefilledTaskData}
            statusGroups={statusGroups}
          />
        )}

        <DuplicateTaskModal
          task={taskToDuplicate}
          lists={lists}
          isOpen={!!taskToDuplicate}
          isSubmitting={isDuplicatingTask}
          onClose={() => {
            if (!isDuplicatingTask) setTaskToDuplicate(null);
          }}
          onDuplicate={(options) => {
            if (taskToDuplicate) handleDuplicateTask(taskToDuplicate, options);
          }}
        />

        {/* Custom Fields Manager */}
        {isFieldManagerOpen && (
          <CustomFieldsManager
            onClose={() => setIsFieldManagerOpen(false)}
            fields={customFields}
            onCreateField={handleCreateField}
            onUpdateField={handleUpdateField}
            onDeleteField={handleDeleteField}
            onReorderField={handleReorderField}
            currentUser={currentUser}
            activeListId={fieldManagerListId}
            hiddenStandardColumnKeysByList={hiddenStandardColumnKeysByList}
            onToggleStandardColumn={(listId: string, key: any) => {
              setHiddenStandardColumnKeysByList((prev) => {
                const current = prev[listId] ?? [];
                const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
                return { ...prev, [listId]: next };
              });
            }}
            hiddenTaskFieldIdsByList={hiddenTaskFieldIdsByList}
            onHideTaskFieldForList={handleToggleTaskFieldForList}
          />
        )}

        {/* Create Space Modal */}
        {isSpaceModalOpen && (
          <CreateSpaceModal
            onClose={() => setIsSpaceModalOpen(false)}
            onCreate={handleCreateSpace}
          />
        )}

        {/* Create Wiki Modal */}
        {isCreateWikiModalOpen && (
          <CreateWikiModal
            spaces={spaces}
            onClose={() => setIsCreateWikiModalOpen(false)}
            onCreate={async (spaceId: string) => {
              setIsCreateWikiModalOpen(false);
              await handleCreateWiki(spaceId);
            }}
          />
        )}

        {/* Change Password Modal */}
        {isChangePasswordModalOpen && (
          <ChangePasswordModal
            onClose={() => setIsChangePasswordModalOpen(false)}
          />
        )}

        {/* Automation Modal */}
        {isAutomationModalOpen && automationListId && (
          <AutomationModal
            listId={automationListId}
            listName={lists.find(l => l.id === automationListId)?.name || ''}
            currentUserId={currentUser.id}
            workspaceId={workspace.id}
            onClose={() => setIsAutomationModalOpen(false)}
            onCreated={() => setIsAutomationModalOpen(false)}
          />
        )}

        {/* Create Folder Modal */}
        {isFolderModalOpen && (
          <CreateFolderModal
            onClose={() => setIsFolderModalOpen(false)}
            onCreate={handleCreateFolder}
          />
        )}

        {/* Settings Modal */}
        {isSettingsModalOpen && (
          <SettingsModal
            onClose={() => setIsSettingsModalOpen(false)}
            themePreset={themePreset}
            setThemePreset={setThemePreset}
            uiScale={uiScale}
            setUiScale={setUiScale}
          />
        )}

        {/* Rename Modal */}
        {renameModal && (
          <RenameModal
            title={renameModal.title}
            defaultValue={renameModal.defaultValue}
            placeholder={renameModal.placeholder}
            onConfirm={(v) => { renameModal.onSubmit(v); setRenameModal(null); }}
            onClose={() => setRenameModal(null)}
          />
        )}

        {/* Confirm Modal */}
        {confirmModal && (
          <ConfirmModal
            message={confirmModal.message}
            onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
            onClose={() => setConfirmModal(null)}
          />
        )}
      </div>
        <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
          <CommandInput placeholder="Pesquisar tarefas, listas, espaços ou executar um comando..." />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

            {/* Espaços */}
            <CommandGroup heading="Espaços">
              {spaces.map((s: Space) => (
                <CommandItem key={`space-${s.id}`} value={`espaço ${s.name}`} onSelect={() => { handleNavigate('space', s.id, s.name); setIsCommandOpen(false); }}>
                  <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 font-bold text-[9px] text-white mr-2" style={{ backgroundColor: s.color || '#6366f1' }}>{s.name.charAt(0)}</div>
                  <span>{s.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">Espaço</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />

            {/* Listas */}
            <CommandGroup heading="Listas">
              {lists.slice(0, 20).map((l: List) => {
                const folder = folders.find((f: Folder) => f.id === l.folderId);
                return (
                  <CommandItem key={`list-${l.id}`} value={`lista ${l.name} ${folder?.name || ''}`} onSelect={() => { setActiveListId(l.id); setActiveView('List'); setIsCommandOpen(false); }}>
                    <Icons.List className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{l.name}</span>
                    {folder && <span className="ml-2 text-xs text-muted-foreground truncate">em {folder.name}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">Lista</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />

            {/* Ações rápidas */}
            <CommandGroup heading="Ações">
              <CommandItem value="criar nova tarefa" onSelect={() => { setIsTaskModalOpen(true); setIsCommandOpen(false); }}>
                <Icons.Plus className="mr-2 h-4 w-4" />
                <span>Criar Nova Tarefa</span>
                <span className="ml-auto text-xs text-muted-foreground">Ctrl+N</span>
              </CommandItem>
              <CommandItem value="minhas tarefas" onSelect={() => { handleNavigate('global', null, 'Minhas Tarefas'); setActiveView('List'); setIsCommandOpen(false); }}>
                <Icons.Check className="mr-2 h-4 w-4" />
                <span>Minhas Tarefas</span>
              </CommandItem>
              <CommandItem value="dashboard geral" onSelect={() => { handleNavigate('global', null, 'Dashboard'); setActiveView('Dashboard'); setIsCommandOpen(false); }}>
                <Icons.Home className="mr-2 h-4 w-4" />
                <span>Dashboard Geral</span>
              </CommandItem>
              <CommandItem value="view kanban quadro" onSelect={() => { setActiveView('Kanban'); setIsCommandOpen(false); }}>
                <Icons.Columns className="mr-2 h-4 w-4" />
                <span>Ir para Kanban</span>
              </CommandItem>
              <CommandItem value="view gantt cronograma" onSelect={() => { setActiveView('Gantt'); setIsCommandOpen(false); }}>
                <Icons.GanttIcon className="mr-2 h-4 w-4" />
                <span>Ir para Gantt</span>
              </CommandItem>
              <CommandItem value="view calendario" onSelect={() => { setActiveView('Calendar'); setIsCommandOpen(false); }}>
                <Icons.Calendar className="mr-2 h-4 w-4" />
                <span>Ir para Calendário</span>
              </CommandItem>
              {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.GESTOR) && (
                <CommandItem value="admin administracao configuracoes" onSelect={() => { openAdminPanel(); setIsCommandOpen(false); }}>
                  <Icons.Shield className="mr-2 h-4 w-4" />
                  <span>Painel Admin</span>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />

            {/* Tarefas */}
            <CommandGroup heading="Tarefas">
              {tasks.slice(0, 15).map((t: Task) => {
                const list = lists.find((l: List) => l.id === t.listId);
                return (
                  <CommandItem key={`task-${t.id}`} value={`tarefa ${t.title} ${list?.name || ''}`} onSelect={() => { setSelectedTaskId(t.id); setIsCommandOpen(false); }}>
                    <div className={`w-2 h-2 rounded-full mr-2 shrink-0 ${t.priority === TaskPriority.URGENTE ? 'bg-red-500' : t.priority === TaskPriority.ALTA ? 'bg-orange-400' : 'bg-blue-400'}`} />
                    <span className="truncate flex-1">{t.title}</span>
                    {list && <span className="ml-2 text-xs text-muted-foreground shrink-0">{list.name}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </SSOHandler>
  );
}

// ── Linkify: converte URLs de texto puro em <a> clicáveis ──────────────────
function linkifyHtml(html: string): string {
  // Divide o HTML em partes: já-linkificadas (<a>…</a>) e texto puro
  const parts = html.split(/(<a[\s>][\s\S]*?<\/a>)/gi);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // já é um <a>, preserva
      // Nos trechos de texto, linkifica URLs soltas
      return part.replace(
        /(?<![=\/"'`])(https?:\/\/[^\s<>"'`\]]+)/g,
        (url) => {
          const clean = url.replace(/[.,;:!?)\]]+$/, '');
          const trail = url.slice(clean.length);
          return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${trail}`;
        }
      );
    })
    .join('');
}

// ── Space Overview — dashboard do espaço (estilo ClickUp) ─────────────────
function SpaceOverview({ space, folders, lists, listProgressMap, tasks, onNavigateFolder, onNavigateList, onCreateFolder }: {
  space: Space;
  folders: Folder[];
  lists: List[];
  listProgressMap: Map<string, { done: number; total: number }>;
  tasks: Task[];
  onNavigateFolder: (id: string, name: string) => void;
  onNavigateList: (listId: string) => void;
  onCreateFolder: () => void;
}) {
  if (!space) return null;

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s.includes('conclu') || s.includes('aprovado') || s.includes('fechado') || s.includes('done') || s.includes('cancel');
  }).length;
  const openTasks = totalTasks - doneTasks;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Recent lists (last 5 with tasks)
  const listsWithTasks = lists
    .filter(l => folders.some(f => f.id === l.folderId))
    .filter(l => (listProgressMap.get(l.id)?.total || 0) > 0)
    .slice(0, 6);

  // All lists in this space (via folders)
  const folderIds = new Set(folders.map(f => f.id));
  const spaceLists = lists.filter(l => folderIds.has(l.folderId));

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-muted">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {space.icon ? (
          (() => { const IconComponent = (Icons as any)[space.icon] || Icons.Layout; return <IconComponent className="w-8 h-8" style={{ color: space.color }} />; })()
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-sm" style={{ backgroundColor: space.color || '#6366f1' }}>
            {space.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{space.name}</h1>
          <p className="text-sm text-muted-foreground">{folders.length} pasta{folders.length !== 1 ? 's' : ''} · {spaceLists.length} lista{spaceLists.length !== 1 ? 's' : ''} · {totalTasks} tarefa{totalTasks !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Progress bar geral */}
      {totalTasks > 0 && (
        <div className="mb-6 bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progresso Geral</span>
            <span className="text-sm text-muted-foreground">{doneTasks}/{totalTasks} concluídas ({progressPct}%)</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{doneTasks} concluídas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{openTasks} em aberto</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pastas */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icons.Folder className="w-4 h-4 text-muted-foreground" />
              Pastas
            </h2>
            <button
              onClick={onCreateFolder}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Icons.Plus className="w-3 h-3" /> Adicionar pasta
            </button>
          </div>
          {folders.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma pasta criada</p>
          ) : (
            <div className="space-y-1">
              {folders.map(folder => {
                const folderLists = lists.filter(l => l.folderId === folder.id);
                const folderTotalTasks = folderLists.reduce((sum, l) => sum + (listProgressMap.get(l.id)?.total || 0), 0);
                const folderDoneTasks = folderLists.reduce((sum, l) => sum + (listProgressMap.get(l.id)?.done || 0), 0);
                const folderPct = folderTotalTasks > 0 ? Math.round((folderDoneTasks / folderTotalTasks) * 100) : 0;
                return (
                  <div
                    key={folder.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer group transition-colors"
                    onClick={() => onNavigateFolder(folder.id, folder.name)}
                  >
                    <Icons.Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground flex-1 group-hover:text-primary transition-colors">{folder.name}</span>
                    <span className="text-xs text-muted-foreground">{folderLists.length} lista{folderLists.length !== 1 ? 's' : ''}</span>
                    {folderTotalTasks > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${folderPct}%` }} />
                        </div>
                        <span>{folderPct}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Listas com progresso */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icons.List className="w-4 h-4 text-muted-foreground" />
              Listas
            </h2>
          </div>
          {spaceLists.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma lista criada</p>
          ) : (
            <div className="space-y-2">
              {spaceLists.slice(0, 8).map(list => {
                const prog = listProgressMap.get(list.id) || { done: 0, total: 0 };
                const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
                const folder = folders.find(f => f.id === list.folderId);
                return (
                  <div
                    key={list.id}
                    className="cursor-pointer group hover:bg-muted rounded-lg px-3 py-2 transition-colors"
                    onClick={() => onNavigateList(list.id)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icons.List className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground flex-1 truncate group-hover:text-primary transition-colors">{list.name}</span>
                      {folder && <span className="text-[10px] text-muted-foreground shrink-0">{folder.name}</span>}
                      <span className="text-xs text-muted-foreground shrink-0">{prog.done}/{prog.total}</span>
                    </div>
                    {prog.total > 0 ? (
                      <div className="flex items-center gap-2 ml-5">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-7 text-right">{pct}%</span>
                      </div>
                    ) : (
                      <div className="ml-5 h-1.5 bg-muted/50 rounded-full" />
                    )}
                  </div>
                );
              })}
              {spaceLists.length > 8 && (
                <p className="text-xs text-muted-foreground text-center pt-1">+ {spaceLists.length - 8} mais listas</p>
              )}
            </div>
          )}
        </div>

        {/* Estatísticas rápidas */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 16 16"><rect x="1" y="8" width="3" height="6" rx="0.5"/><rect x="6" y="5" width="3" height="9" rx="0.5"/><rect x="11" y="2" width="3" height="12" rx="0.5"/></svg>
            Resumo
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: totalTasks, color: 'text-foreground' },
              { label: 'Em aberto', value: openTasks, color: 'text-blue-500' },
              { label: 'Concluídas', value: doneTasks, color: 'text-green-500' },
            ].map(stat => (
              <div key={stat.label} className="text-center bg-muted/50 rounded-lg py-3">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocView({ doc, allDocs = [], onUpdate, onSelectDoc, onCreateSubpage, currentUser, uploadFile }: {
  doc: Doc,
  allDocs?: Doc[],
  onUpdate: (doc: Doc) => void,
  onSelectDoc?: (docId: string) => void,
  onCreateSubpage?: (parentDoc: Doc) => void,
  currentUser: User,
  uploadFile: (file: File, path: string, bucket?: string) => Promise<string | null>
}) {
  const parentDoc = doc.parentId ? allDocs.find(d => d.id === doc.parentId) : null;
  const childDocs = allDocs.filter(d => d.parentId === doc.id);
  const [headerImage, setHeaderImage] = useState(doc.headerImage || '');
  const [title, setTitle] = useState(doc.title);
  const [isUploading, setIsUploading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(doc.title);
    setHeaderImage(doc.headerImage || '');
    if (contentRef.current) {
      const linked = linkifyHtml(doc.content);
      if (contentRef.current.innerHTML !== linked) {
        contentRef.current.innerHTML = linked;
      }
    }
  }, [doc]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    onUpdate({ ...doc, title: e.target.value });
  };

  const handleContentBlur = () => {
    if (contentRef.current) {
      onUpdate({ ...doc, content: contentRef.current.innerHTML });
    }
  };

  // Ao colar texto puro, linkifica URLs antes de inserir
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    if (!html && plain) {
      e.preventDefault();
      const escaped = plain
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      document.execCommand('insertHTML', false, linkifyHtml(escaped));
    }
    // Se houver HTML (colar do Word/navegador), deixa o navegador inserir normalmente
    // e aplica linkify no blur
  };

  // contentEditable bloqueia cliques em <a>; abrimos manualmente
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest('a');
    if (link) {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAddLink = () => {
    const url = window.prompt("Digite o URL do link:");
    if (url) {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;

      // Save link as an attachment to database
      const newAttachment: Attachment = {
        id: crypto.randomUUID(),
        name: url,
        url: fullUrl,
        type: 'link',
        size: 0,
        uploadedAt: new Date().toISOString()
      };

      saveAttachmentToDb(newAttachment);
    }
  };

  const handleHeaderImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const path = `headers/${doc.id}_${Date.now()}_${safeName}`;
    const url = await uploadFile(file, path);
    setIsUploading(false);

    if (url) {
      setHeaderImage(url);
      onUpdate({ ...doc, headerImage: url });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const path = `attachments/${doc.id}/${Date.now()}_${safeName}`;
    const url = await uploadFile(file, path);
    setIsUploading(false);

    if (url) {
      const newAttachment: Attachment = {
        id: crypto.randomUUID(), // Temporário até salvar no DB
        name: file.name,
        url,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString()
      };

      saveAttachmentToDb(newAttachment);
    }
  };

  const saveAttachmentToDb = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase
        .from('doc_attachments')
        .insert({
          doc_id: doc.id,
          name: attachment.name,
          url: attachment.url,
          type: attachment.type,
          size: attachment.size,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (error || !data) {
        console.error('Erro ao salvar anexo:', error);
        toast.error(`Falha ao salvar o anexo${error ? `: ${error.message}` : '.'}`);
        return;
      }

      const savedAttachment: Attachment = {
        ...attachment,
        id: data.id,
        uploadedAt: data.uploaded_at
      };
      onUpdate({
        ...doc,
        attachments: [...(doc.attachments || []), savedAttachment]
      });
    } catch (err: any) {
      console.error('Erro ao salvar anexo:', err);
      toast.error(`Falha ao salvar o anexo${err?.message ? `: ${err.message}` : '.'}`);
    }
  };

  const removeAttachment = async (id: string) => {
    const { data, error } = await supabaseAdmin
      .from('doc_attachments')
      .delete()
      .eq('id', id)
      .select();

    if (error || !data || data.length === 0) {
      console.error('Erro ao remover anexo:', error);
      toast.error(`Falha ao excluir o anexo${error ? `: ${error.message}` : '.'}`);
      return;
    }

    const url: string = (data[0] as any)?.url || '';
    const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (match) {
      const storagePath = decodeURIComponent(match[2]);
      const { error: storageError } = await supabaseAdmin.storage.from(match[1]).remove([storagePath]);
      if (storageError) console.error('Erro ao remover arquivo do Storage:', storageError);
    }

    onUpdate({
      ...doc,
      attachments: (doc.attachments || []).filter(a => a.id !== id)
    });
    toast.success('Anexo excluído.');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto bg-white min-h-screen shadow-sm border-x flex flex-col mb-10 rounded-b-xl overflow-hidden">
      {/* Header Image */}
      <div className="relative h-56 bg-gray-100 overflow-hidden group">
        {headerImage ? (
          <img src={headerImage} alt="Header" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <Icons.ImageIcon className="h-10 w-10 opacity-20" />
            <span className="text-sm font-medium">Sem imagem de cabeçalho</span>
          </div>
        )}
        <label className={`absolute bottom-6 right-6 bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-4 py-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 shadow-lg flex items-center gap-2 cursor-pointer ${isUploading ? 'opacity-100 animate-pulse' : ''}`}>
          <Icons.ImageIcon className="h-3.5 w-3.5" />
          {isUploading ? 'Enviando...' : (headerImage ? 'Alterar Imagem' : 'Adicionar Imagem')}
          <input type="file" className="hidden" accept="image/*" onChange={handleHeaderImageUpload} disabled={isUploading} />
        </label>
      </div>

      <div className="p-8 sm:p-16 space-y-8">
        {parentDoc && (
          <button
            onClick={() => onSelectDoc?.(parentDoc.id)}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-orange-500 transition-colors -mb-4"
          >
            <Icons.ChevronRight className="w-3 h-3 rotate-180" /> {parentDoc.title}
          </button>
        )}

        {/* Title + Wiki toggle */}
        <div className="flex items-start justify-between gap-4">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Título do Documento"
            className="flex-1 text-5xl font-black text-gray-900 border-none focus:ring-0 placeholder:text-gray-100 p-0"
          />
          <button
            onClick={() => onUpdate({ ...doc, isWiki: !doc.isWiki })}
            title={doc.isWiki ? 'Marcado como Wiki — clique para desmarcar' : 'Marcar como Wiki (destaca este documento como fonte oficial)'}
            className={`shrink-0 mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              doc.isWiki
                ? 'bg-orange-50 border-orange-200 text-orange-600'
                : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
            }`}
          >
            📌 {doc.isWiki ? 'Wiki' : 'Marcar como Wiki'}
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-y py-3 sticky top-0 bg-white/80 backdrop-blur-sm z-[2]">
          <button
            onClick={handleAddLink}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors flex items-center gap-2 text-sm font-medium"
            title="Adicionar Link"
          >
            <Icons.LinkIcon className="h-4 w-4" />
            <span>Link</span>
          </button>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <label className={`p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`} title="Anexar PDF">
            <Icons.Paperclip className="h-4 w-4" />
            <span>{isUploading ? 'Anexando...' : 'Anexar PDF'}</span>
            <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={isUploading} />
          </label>

          <div className="w-px h-4 bg-gray-200 mx-2" />

          <button
            onClick={() => document.execCommand('bold')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 font-bold"
            title="Negrito"
          >
            B
          </button>
          <button
            onClick={() => document.execCommand('italic')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 italic"
            title="Itálico"
          >
            I
          </button>
        </div>

        {/* Content Area */}
        <div
          ref={contentRef}
          contentEditable
          onBlur={handleContentBlur}
          onPaste={handlePaste}
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: linkifyHtml(doc.content) }}
          className="w-full min-h-[300px] text-xl text-gray-700 leading-relaxed outline-none prose prose-orange max-w-none focus:prose-orange [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer hover:[&_a]:text-blue-800"
        />

        {/* Subpáginas */}
        <div className="border-t pt-8 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Icons.Folder className="h-4 w-4" />
              Subpáginas ({childDocs.length})
            </h3>
            <button
              onClick={() => onCreateSubpage?.(doc)}
              className="text-xs font-bold text-orange-500 hover:underline"
            >
              + Nova subpágina
            </button>
          </div>
          {childDocs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {childDocs.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onSelectDoc?.(child.id)}
                  className="text-left group flex items-center gap-3 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-xl p-4 transition-all"
                >
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-white shadow-sm flex items-center justify-center text-orange-500">
                    <Icons.FileText className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold text-gray-900 truncate">{child.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attachments Section */}
        {(doc.attachments || []).length > 0 && (
          <div className="border-t pt-8 mt-8">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Icons.Paperclip className="h-4 w-4" />
              Anexos ({doc.attachments.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {doc.attachments.map((file) => (
                <div key={file.id} className="group relative bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-xl p-4 transition-all flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-orange-500">
                    <Icons.FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{file.name}</p>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-tight">
                      {file.type.split('/')[1] || 'FILE'} • {formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-white rounded-lg text-gray-500 hover:text-orange-600 shadow-sm border border-transparent hover:border-orange-100 transition-all"
                      title="Visualizar"
                    >
                      <Icons.Eye />
                    </a>
                    <button
                      onClick={() => removeAttachment(file.id)}
                      className="p-2 hover:bg-white rounded-lg text-gray-500 hover:text-red-600 shadow-sm border border-transparent hover:border-red-100 transition-all"
                      title="Excluir"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsModal({ onClose, themePreset, setThemePreset, uiScale, setUiScale }: any) {
  const themeEntries = Object.entries(THEME_PRESETS) as Array<[ThemePresetId, (typeof THEME_PRESETS)[ThemePresetId]]>;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card text-card-foreground rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-muted">
          <h3 className="font-bold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            Personalização do Sistema
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors" aria-label="Fechar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Theme presets */}
          <div>
            <label className="block text-sm font-bold mb-3">Tema do Sistema</label>
            <div className="grid grid-cols-2 gap-3">
              {themeEntries.map(([id, t]) => {
                const active = themePreset === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setThemePreset(id)}
                    className={
                      "rounded-lg border p-3 text-left transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                      (active ? "border-ring ring-2 ring-ring/30" : "border-border")
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{t.label}</div>
                        <div className="text-xs text-muted-foreground">Fundo + menu + primária</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: `hsl(${t.vars["--sidebar-background"]})`, borderColor: `hsl(${t.vars["--border"]})` }}
                          aria-label="Prévia do menu"
                        />
                        <span
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: `hsl(${t.vars["--background"]})`, borderColor: `hsl(${t.vars["--border"]})` }}
                          aria-label="Prévia do fundo"
                        />
                        <span
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: `hsl(${t.vars["--primary"]})`, borderColor: `hsl(${t.vars["--border"]})` }}
                          aria-label="Prévia da cor primária"
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">A escolha é salva no seu perfil e sincronizada em todos os seus dispositivos.</p>
          </div>

          {/* Font Size / Scale */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold">Tamanho da Fonte / Escala</label>
              <span className="text-xs font-bold bg-muted px-2 py-1 rounded text-muted-foreground">{Math.round(uiScale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={uiScale}
              onChange={(e) => setUiScale(parseFloat(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2 font-medium uppercase">
              <span>Pequeno</span>
              <span>Normal</span>
              <span>Grande</span>
              <span>Extra</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded shadow-sm hover:shadow-md transition-all hover:brightness-95"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarDocItem({ doc, allDocs, depth, activeDocId, folder, onSetActiveDocId, onViewChange, onNavigate, onDeleteDoc }: any) {
  const children = allDocs.filter((d: any) => d.parentId === doc.id);
  const isActive = activeDocId === doc.id;
  return (
    <>
      <div
        className={`text-[12px] flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition-colors group relative ${isActive ? 'bg-orange-500/10 text-orange-500 font-semibold' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={(e) => { e.stopPropagation(); onSetActiveDocId(doc.id); onViewChange('Doc'); onNavigate('folder', folder.id, doc.title); }}
      >
        <FileText className="h-3 w-3 text-sidebar-foreground/40 shrink-0" />
        <span className="truncate flex-1">{doc.title}</span>
        {doc.isWiki && <span className="text-[10px] shrink-0" title="Marcado como Wiki">📌</span>}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-1">
          <button onClick={(e: any) => { e.stopPropagation(); onDeleteDoc(doc.id); }} className="p-1 text-sidebar-foreground/40 hover:text-red-500"><Icons.Trash /></button>
        </div>
      </div>
      {children.map((child: any) => (
        <SidebarDocItem
          key={child.id}
          doc={child}
          allDocs={allDocs}
          depth={depth + 1}
          activeDocId={activeDocId}
          folder={folder}
          onSetActiveDocId={onSetActiveDocId}
          onViewChange={onViewChange}
          onNavigate={onNavigate}
          onDeleteDoc={onDeleteDoc}
        />
      ))}
    </>
  );
}

function Sidebar({
  themePreset,
  spaces, folders, lists, activeView, activeScope, activeListId, onSetActiveListId, onNavigate, onViewChange, isCollapsed, onToggle,
  onOpenFields, onOpenCreateSpace, onOpenCreateFolder, onCreateList, userRole,
  onRenameSpace, onDeleteSpace, onRenameFolder, onDeleteFolder, onBulkDeleteFolders,
  onDeleteList, onRenameList, onDuplicateList,
  docs, activeDocId, onSetActiveDocId, onCreateDoc, onDeleteDoc,
  onMoveList, onMoveFolder,
  listTaskCounts, listProgressMap,
  favorites, onToggleFavorite
}: any) {
  const compactLogo = "https://verticalparts.com.br/wp-content/uploads/2026/01/grp__NM__bg__NM__logo_compacto-1.png";
  const isNonLightTheme = themePreset !== "claro";
  const logoSrc = isNonLightTheme ? compactLogoWhite : compactLogo;
  const logoStyle = isNonLightTheme ? undefined : ({ filter: 'brightness(0)' } as React.CSSProperties);

  const [expandedSpaces, setExpandedSpaces] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [secInicioOpen, setSecInicioOpen] = useState(true);
  const [secMinhasTarefasOpen, setSecMinhasTarefasOpen] = useState(false);
  const [secFavoritosOpen, setSecFavoritosOpen] = useState(true);
  const [secEspacosOpen, setSecEspacosOpen] = useState(true);

  // Largura redimensionável da sidebar (arrastar borda direita; duplo clique restaura)
  const SIDEBAR_DEFAULT_W = 240;
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('vp_sidebar_width'));
    return saved >= 200 && saved <= 520 ? saved : SIDEBAR_DEFAULT_W;
  });
  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    let lastW = startW;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: MouseEvent) => {
      lastW = Math.min(520, Math.max(200, startW + ev.clientX - startX));
      setSidebarWidth(lastW);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      localStorage.setItem('vp_sidebar_width', String(lastW));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Drag-and-drop state
  const [dragItem, setDragItem] = useState<{ type: 'list' | 'folder'; id: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ type: 'folder' | 'space'; id: string } | null>(null);

  useEffect(() => {
    if (activeScope.type === 'space' && activeScope.id) {
      setExpandedSpaces(prev => prev.includes(activeScope.id!) ? prev : [...prev, activeScope.id!]);
    } else if (activeScope.type === 'folder' && activeScope.id) {
      const folder = folders.find((f: Folder) => f.id === activeScope.id);
      if (folder && !expandedSpaces.includes(folder.spaceId)) {
        setExpandedSpaces(prev => [...prev, folder.spaceId]);
      }
      if (folder && !expandedFolders.includes(folder.id)) {
        setExpandedFolders(prev => [...prev, folder.id]);
      }
    }
  }, [activeScope, folders]);

  const toggleSpace = (spaceId: string) => setExpandedSpaces(prev => prev.includes(spaceId) ? prev.filter(id => id !== spaceId) : [...prev, spaceId]);
  const toggleFolder = (folderId: string) => setExpandedFolders(prev => prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]);

  /* ── Icon Nav Bar items ── */
  const navItems = [
    { id: 'home', label: 'Início', icon: <Icons.Home />, action: () => { if (isCollapsed) onToggle(); onNavigate('global', null, 'Dashboard'); onViewChange('Dashboard'); }, active: activeView === 'Dashboard' && activeScope.type === 'global' },
    { id: 'tasks', label: 'Minhas Tarefas', icon: <Icons.Check />, action: () => { if (isCollapsed) onToggle(); onNavigate('global', null, 'Minhas Tarefas'); onViewChange('List'); }, active: activeView === 'List' && activeScope.type === 'global' },
    { id: 'calendar', label: 'Calendário', icon: <Icons.Calendar />, action: () => { if (isCollapsed) onToggle(); onViewChange('Calendar'); }, active: activeView === 'Calendar' },
    { id: 'gantt', label: 'Gantt', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 16 16"><rect x="1" y="3" width="8" height="2" rx="1"/><rect x="1" y="7" width="6" height="2" rx="1"/><rect x="4" y="11" width="10" height="2" rx="1"/></svg>, action: () => { if (isCollapsed) onToggle(); onViewChange('Gantt'); }, active: activeView === 'Gantt' },
    { id: 'dashboard', label: 'Dashboards', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 16 16"><rect x="1" y="8" width="4" height="6" rx="0.5"/><rect x="6" y="4" width="4" height="10" rx="0.5"/><rect x="11" y="2" width="4" height="12" rx="0.5"/></svg>, action: () => { if (isCollapsed) onToggle(); onNavigate('global', null, 'Dashboard'); onViewChange('Dashboard'); }, active: false },
  ];

  return (
    <div className="flex h-full shrink-0" onClick={(e) => e.stopPropagation()}>

      {/* ══ ICON NAV BAR (sempre visível, 48px) ══ */}
      <div className="w-12 flex flex-col items-center bg-sidebar border-r border-sidebar-border shrink-0 py-2 gap-0.5">
        {/* Logo */}
        <div className="mb-2 mt-1">
          <img src={logoSrc} alt="VP" className="w-7 h-7 object-contain" style={logoStyle} />
        </div>

        {/* Nav icons */}
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={item.action}
            title={item.label}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
              item.active
                ? 'bg-sidebar-accent text-primary'
                : 'text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
            }`}
          >
            {item.icon}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Space quick-access avatars */}
        {spaces.slice(0, 6).map((space: Space) => (
          <button
            key={space.id}
            title={space.name}
            onClick={() => { if (isCollapsed) onToggle(); onNavigate('space', space.id, space.name); }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] text-white mb-0.5 transition-all ${
              activeScope.type === 'space' && activeScope.id === space.id ? 'ring-2 ring-primary ring-offset-1' : 'opacity-80 hover:opacity-100'
            }`}
            style={{ backgroundColor: space.color || '#6366f1' }}
          >
            {space.name.charAt(0).toUpperCase()}
          </button>
        ))}

        {/* Fields / Settings */}
        {(userRole === UserRole.ADMIN || userRole === UserRole.GESTOR) && (
          <button
            onClick={onOpenFields}
            title="Campos Personalizados"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors mt-1 mb-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 16 16"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42"/><circle cx="8" cy="8" r="3"/></svg>
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          title={isCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors mb-1"
        >
          {isCollapsed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 16 16"><path d="M6 4l4 4-4 4"/></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 16 16"><path d="M10 4l-4 4 4 4"/></svg>
          )}
        </button>
      </div>

      {/* ══ EXPANDED PANEL (colapsável) ══ */}
      {!isCollapsed && (
        <div style={{ width: sidebarWidth }} className="relative shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
          {/* Alça de redimensionamento (segurar e arrastar; duplo clique restaura) */}
          <div
            onMouseDown={startSidebarResize}
            onDoubleClick={() => {
              setSidebarWidth(SIDEBAR_DEFAULT_W);
              localStorage.setItem('vp_sidebar_width', String(SIDEBAR_DEFAULT_W));
            }}
            title="Arraste para redimensionar · duplo clique restaura"
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 hover:bg-orange-400/50 active:bg-orange-500/60 transition-colors"
          />

          {/* Header */}
          <div className="flex items-center gap-1 px-2 py-2 border-b border-sidebar-border">
            <span className="text-sm font-semibold text-sidebar-foreground flex-1 truncate px-1">Início</span>
            <button title="Pesquisar" className="p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M11 11l3 3"/></svg>
            </button>
            <button title="Criar tarefa" onClick={() => { }} className="p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
              <Icons.Plus />
            </button>
            <button onClick={onToggle} title="Fechar barra lateral" className="p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 16 16"><path d="M10 4l-4 4 4 4"/></svg>
            </button>
          </div>

          {/* Scrollable content */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">

            {/* ── Seção Início ── */}
            <div>
              <button
                className="w-full flex items-center gap-1 px-3 py-2 text-[11px] font-semibold text-sidebar-foreground/60 uppercase tracking-widest hover:text-sidebar-foreground transition-colors group"
                onClick={() => setSecInicioOpen(v => !v)}
              >
                <svg className={`w-3 h-3 transition-transform shrink-0 ${secInicioOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 8 8"><path d="M2 1l4 3-4 3"/></svg>
                Início
              </button>
              {secInicioOpen && (
                <div className="pb-1">
                  {/* Minhas Tarefas (expandível) */}
                  <div>
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-lg mx-1 group transition-colors text-sm ${activeView === 'List' && activeScope.type === 'global' ? 'bg-sidebar-accent text-primary font-semibold' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50'}`}
                      onClick={() => { onNavigate('global', null, 'Minhas Tarefas'); onViewChange('List'); }}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); setSecMinhasTarefasOpen(v => !v); }}
                        className="text-sidebar-foreground/40 hover:text-sidebar-foreground shrink-0"
                      >
                        <svg className={`w-3 h-3 transition-transform ${secMinhasTarefasOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 8 8"><path d="M2 1l4 3-4 3"/></svg>
                      </button>
                      <Icons.Check />
                      <span className="flex-1 truncate">Minhas Tarefas</span>
                    </div>
                    {secMinhasTarefasOpen && (
                      <div className="ml-7 border-l border-sidebar-border pl-2 mt-0.5 space-y-0.5">
                        <button
                          onClick={() => { onNavigate('global', null, 'Minhas Tarefas'); onViewChange('List'); }}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/40" fill="currentColor" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5"/></svg>
                          Atribuídas a mim
                        </button>
                        <button
                          onClick={() => { onNavigate('global', null, 'Minhas Tarefas'); onViewChange('List'); }}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                        >
                          <Icons.Calendar />
                          Hoje e atrasadas
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Ir para Dashboard */}
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-lg mx-1 group transition-colors text-sm ${activeView === 'Dashboard' && activeScope.type === 'global' ? 'bg-sidebar-accent text-primary font-semibold' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50'}`}
                    onClick={() => { onNavigate('global', null, 'Dashboard'); onViewChange('Dashboard'); }}
                  >
                    <div className="w-3 h-3 shrink-0" />
                    <Icons.Home />
                    <span className="flex-1 truncate">Dashboard</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Seção Favoritos ── */}
            <div>
              <button
                className="w-full flex items-center gap-1 px-3 py-2 text-[11px] font-semibold text-sidebar-foreground/60 uppercase tracking-widest hover:text-sidebar-foreground transition-colors group"
                onClick={() => setSecFavoritosOpen(v => !v)}
              >
                <svg className={`w-3 h-3 transition-transform shrink-0 ${secFavoritosOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 8 8"><path d="M2 1l4 3-4 3"/></svg>
                Favoritos
              </button>
              {secFavoritosOpen && (
                <div className="pb-1">
                  {favorites && favorites.length === 0 && (
                    <p className="text-[11px] text-sidebar-foreground/40 flex items-center gap-1.5 px-4 py-2">
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 14 14"><path d="M7 1l1.5 4h4l-3.3 2.4 1.3 4L7 9l-3.5 2.4 1.3-4L1.5 5h4z"/></svg>
                      Passe o mouse sobre uma lista ou pasta e clique ★
                    </p>
                  )}
                  {(favorites || []).map((fav: any) => {
                    const isActiveList = fav.type === 'list' && activeListId === fav.id;
                    const isActiveFolder = fav.type === 'folder' && activeScope.type === 'folder' && activeScope.id === fav.id;
                    const isActiveSpace = fav.type === 'space' && activeScope.type === 'space' && activeScope.id === fav.id;
                    const isActive = isActiveList || isActiveFolder || isActiveSpace;
                    return (
                      <div
                        key={`${fav.type}-${fav.id}`}
                        className={`text-[12px] flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-lg mx-1 group transition-colors ${isActive ? 'bg-sidebar-accent text-primary font-semibold' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
                        onClick={() => {
                          if (fav.type === 'list') { onSetActiveListId?.(fav.id); setTimeout(() => onViewChange?.('List'), 0); }
                          else if (fav.type === 'folder') { onNavigate('folder', fav.id, fav.name); }
                          else if (fav.type === 'space') { onNavigate('space', fav.id, fav.name); }
                        }}
                      >
                        {fav.type === 'list' ? <Icons.List /> : fav.type === 'folder' ? <Icons.Folder /> : <Icons.Layout />}
                        <span className="truncate flex-1">{fav.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(fav.type, fav.id, fav.name); }}
                          className="opacity-0 group-hover:opacity-100 text-yellow-400 transition-opacity"
                          title="Remover dos favoritos"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 14 14"><path d="M7 1l1.5 4h4l-3.3 2.4 1.3 4L7 9l-3.5 2.4 1.3-4L1.5 5h4z"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Seção Espaços ── */}
            <div>
              <div className="flex items-center px-3 py-2 group">
                <button
                  className="flex items-center gap-1 text-[11px] font-semibold text-sidebar-foreground/60 uppercase tracking-widest hover:text-sidebar-foreground transition-colors flex-1 text-left"
                  onClick={() => setSecEspacosOpen(v => !v)}
                >
                  <svg className={`w-3 h-3 transition-transform shrink-0 ${secEspacosOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 8 8"><path d="M2 1l4 3-4 3"/></svg>
                  Espaços
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenCreateSpace(); }}
                  className="opacity-0 group-hover:opacity-100 text-sidebar-foreground/40 hover:text-primary transition-all p-1 rounded hover:bg-sidebar-accent"
                  title="Criar Espaço"
                >
                  <Icons.Plus />
                </button>
              </div>

              {secEspacosOpen && (
                <div className="pb-2">
                  {spaces.map((space: Space) => {
                    const isExpanded = expandedSpaces.includes(space.id);
                    const isSpaceDropTarget = dropTarget?.type === 'space' && dropTarget.id === space.id && dragItem?.type === 'folder';
                    return (
                      <div key={space.id} className="mb-0.5">
                        <div
                          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer group transition-colors relative rounded-lg mx-1 ${
                            isSpaceDropTarget
                              ? 'bg-primary/15 border border-primary/40 border-dashed'
                              : activeScope.type === 'space' && activeScope.id === space.id
                              ? 'bg-sidebar-accent'
                              : 'hover:bg-sidebar-accent/50'
                          }`}
                          onClick={() => {
                            const isActiveSpace = activeScope.type === 'space' && activeScope.id === space.id;
                            toggleSpace(space.id);
                            if (!isActiveSpace) onNavigate('space', space.id, space.name);
                          }}
                          onDragOver={(e) => {
                            if (dragItem?.type === 'folder') {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDropTarget({ type: 'space', id: space.id });
                            }
                          }}
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragItem?.type === 'folder') {
                              onMoveFolder?.(dragItem.id, space.id);
                            }
                            setDragItem(null);
                            setDropTarget(null);
                          }}
                        >
                          <div className={`text-sidebar-foreground/40 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>
                            <Icons.ChevronRight />
                          </div>
                          {space.icon ? (
                            (() => { const IconComponent = (Icons as any)[space.icon] || Icons.Layout; return <IconComponent className="w-4 h-4 shrink-0" color={space.color} />; })()
                          ) : (
                            <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 font-bold text-[9px] text-white" style={{ backgroundColor: space.color }}>
                              {space.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className={`text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${activeScope.type === 'space' && activeScope.id === space.id ? 'text-sidebar-foreground font-semibold' : 'text-sidebar-foreground/80'}`}>
                            {space.name}
                          </span>

                          {/* Space hover actions */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 bg-sidebar/90 rounded px-0.5">
                            <button onClick={(e) => { e.stopPropagation(); onOpenCreateFolder(space.id); }} className="p-1 text-sidebar-foreground/40 hover:text-primary rounded" title="Criar pasta"><Icons.Plus /></button>
                            <button onClick={(e) => { e.stopPropagation(); onRenameSpace(space.id, space.name); }} className="p-1 text-sidebar-foreground/40 hover:text-blue-500 rounded" title="Renomear">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteSpace(space.id); }} className="p-1 text-sidebar-foreground/40 hover:text-red-500 rounded" title="Excluir">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="ml-5 border-l border-sidebar-border pl-2 mt-0.5 space-y-0.5 animate-in slide-in-from-top-1 duration-150">
                            {selectedFolderIds.length > 0 && (
                              <div className="flex items-center justify-between px-2 py-1.5 mb-1 bg-red-50 border border-red-200 rounded text-xs">
                                <span className="text-red-600 font-medium">{selectedFolderIds.length} pasta(s) selecionada(s)</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedFolderIds([]); }}
                                    className="text-gray-500 hover:text-gray-700 font-medium"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onBulkDeleteFolders(selectedFolderIds, () => setSelectedFolderIds([]));
                                    }}
                                    className="text-red-600 hover:text-red-700 font-bold"
                                  >
                                    Excluir todas
                                  </button>
                                </div>
                              </div>
                            )}
                            {folders.filter((f: Folder) => f.spaceId === space.id).map((folder: Folder) => {
                              const isFolderExpanded = expandedFolders.includes(folder.id);
                              return (
                                <div key={folder.id}>
                                  <div
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      setDragItem({ type: 'folder', id: folder.id });
                                      e.dataTransfer.effectAllowed = 'move';
                                      e.dataTransfer.setData('text/plain', folder.id);
                                    }}
                                    onDragEnd={() => { setDragItem(null); setDropTarget(null); }}
                                    onDragOver={(e) => {
                                      if (dragItem?.type === 'list') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.dataTransfer.dropEffect = 'move';
                                        setDropTarget({ type: 'folder', id: folder.id });
                                      }
                                    }}
                                    onDragLeave={(e) => {
                                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                        setDropTarget(null);
                                      }
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (dragItem?.type === 'list') {
                                        onMoveList?.(dragItem.id, folder.id);
                                        if (!expandedFolders.includes(folder.id)) toggleFolder(folder.id);
                                      }
                                      setDragItem(null);
                                      setDropTarget(null);
                                    }}
                                    className={`text-[12px] flex items-center gap-2 px-2 py-1.5 cursor-grab active:cursor-grabbing rounded transition-colors group relative ${
                                      dropTarget?.type === 'folder' && dropTarget.id === folder.id && dragItem?.type === 'list'
                                        ? 'bg-primary/15 border border-primary/40 border-dashed'
                                        : activeScope.type === 'folder' && activeScope.id === folder.id
                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                                        : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const isActiveFolder = activeScope.type === 'folder' && activeScope.id === folder.id;
                                      toggleFolder(folder.id);
                                      if (!isActiveFolder) onNavigate('folder', folder.id, folder.name);
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      className="w-3 h-3 rounded shrink-0 accent-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      style={selectedFolderIds.length > 0 ? { opacity: 1 } : {}}
                                      checked={selectedFolderIds.includes(folder.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setSelectedFolderIds(prev =>
                                          e.target.checked ? [...prev, folder.id] : prev.filter(id => id !== folder.id)
                                        );
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className={`text-sidebar-foreground/40 transition-transform duration-200 shrink-0 ${isFolderExpanded ? 'rotate-90' : ''}`} aria-hidden>
                                      <Icons.ChevronRight />
                                    </div>
                                    <Icons.Folder />
                                    <span className="truncate flex-1">{folder.name}</span>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-sidebar/90 rounded px-0.5 absolute right-1">
                                      {/* Star: favorites */}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onToggleFavorite?.('folder', folder.id, folder.name); }}
                                        className={`p-1 transition-colors ${favorites?.some((f: any) => f.type === 'folder' && f.id === folder.id) ? 'text-yellow-400' : 'text-sidebar-foreground/40 hover:text-yellow-400'}`}
                                        title="Favoritar"
                                      >
                                        <svg className="w-3 h-3" fill={favorites?.some((f: any) => f.type === 'folder' && f.id === folder.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 14 14"><path d="M7 1l1.5 4h4l-3.3 2.4 1.3 4L7 9l-3.5 2.4 1.3-4L1.5 5h4z"/></svg>
                                      </button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button onClick={(e) => e.stopPropagation()} className="p-1 text-sidebar-foreground/40 hover:text-sidebar-foreground" title="Ações">
                                            <MoreHorizontal className="h-3 w-3" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" sideOffset={6}>
                                          <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onToggleFavorite?.('folder', folder.id, folder.name); }}>
                                            {favorites?.some((f: any) => f.type === 'folder' && f.id === folder.id) ? '★ Remover dos favoritos' : '☆ Adicionar aos favoritos'}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="text-xs">Criar novo</DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent>
                                              <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onCreateList?.(folder.id); }}><ListPlus className="mr-2 h-3.5 w-3.5" />Criar lista</DropdownMenuItem>
                                              <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onCreateDoc(folder.id); }}><FileText className="mr-2 h-3.5 w-3.5" />Novo documento</DropdownMenuItem>
                                            </DropdownMenuSubContent>
                                          </DropdownMenuSub>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onRenameFolder(folder.id, folder.name); }}>Renomear pasta</DropdownMenuItem>
                                          <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}>Excluir pasta</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>

                                  {isFolderExpanded && (
                                    <div className="ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
                                      {(lists as List[]).filter((l) => l.folderId === folder.id).map((list: List) => {
                                        const isActive = activeListId === list.id;
                                        return (
                                          <div
                                            key={list.id}
                                            draggable
                                            onDragStart={(e) => {
                                              e.stopPropagation();
                                              setDragItem({ type: 'list', id: list.id });
                                              e.dataTransfer.effectAllowed = 'move';
                                              e.dataTransfer.setData('text/plain', list.id);
                                            }}
                                            onDragEnd={() => { setDragItem(null); setDropTarget(null); }}
                                            className={`text-[12px] flex items-center gap-2 px-2 py-1.5 cursor-grab active:cursor-grabbing rounded transition-colors group relative ${
                                              dragItem?.type === 'list' && dragItem.id === list.id
                                                ? 'opacity-40 scale-95'
                                                : isActive
                                                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                                                : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                                            }`}
                                            onClick={(e) => { e.stopPropagation(); onSetActiveListId?.(list.id); setTimeout(() => onViewChange?.('List'), 0); }}
                                            title={list.name}
                                          >
                                            <Icons.List />
                                            <span className="truncate flex-1">{list.name}</span>
                                            {/* Badge: open task count */}
                                            {listTaskCounts?.get(list.id) ? (
                                              <span className="text-[10px] font-medium text-sidebar-foreground/50 bg-sidebar-accent/70 rounded px-1 min-w-[16px] text-center group-hover:hidden shrink-0">
                                                {listTaskCounts.get(list.id)}
                                              </span>
                                            ) : null}
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-sidebar/90 rounded px-0.5 absolute right-1">
                                              {/* Star: favorites */}
                                              <button
                                                onClick={(e) => { e.stopPropagation(); onToggleFavorite?.('list', list.id, list.name); }}
                                                className={`p-1 transition-colors ${favorites?.some((f: any) => f.type === 'list' && f.id === list.id) ? 'text-yellow-400' : 'text-sidebar-foreground/40 hover:text-yellow-400'}`}
                                                title="Favoritar"
                                              >
                                                <svg className="w-3 h-3" fill={favorites?.some((f: any) => f.type === 'list' && f.id === list.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 14 14"><path d="M7 1l1.5 4h4l-3.3 2.4 1.3 4L7 9l-3.5 2.4 1.3-4L1.5 5h4z"/></svg>
                                              </button>
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <button onClick={(e) => e.stopPropagation()} className="p-1 text-sidebar-foreground/40 hover:text-sidebar-foreground"><MoreHorizontal className="h-3 w-3" /></button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" sideOffset={6}>
                                                  <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onToggleFavorite?.('list', list.id, list.name); }}>
                                                    {favorites?.some((f: any) => f.type === 'list' && f.id === list.id) ? '★ Remover dos favoritos' : '☆ Adicionar aos favoritos'}
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onRenameList(list.id, list.name); }}>Renomear lista</DropdownMenuItem>
                                                  <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger className="text-xs">Mover para</DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent>
                                                      {(folders as any[]).filter((f: any) => f.id !== list.folderId).map((f: any) => (
                                                        <DropdownMenuItem key={f.id} className="text-xs" onClick={(e) => { e.stopPropagation(); onMoveList?.(list.id, f.id); }}>
                                                          {f.name}
                                                        </DropdownMenuItem>
                                                      ))}
                                                      {(folders as any[]).filter((f: any) => f.id !== list.folderId).length === 0 && (
                                                        <DropdownMenuItem className="text-xs text-gray-400" disabled>Nenhuma outra pasta</DropdownMenuItem>
                                                      )}
                                                    </DropdownMenuSubContent>
                                                  </DropdownMenuSub>
                                                  <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onDuplicateList?.(list.id, list.name); }}>Duplicar projeto</DropdownMenuItem>
                                                  <DropdownMenuItem className="text-xs text-red-600 focus:text-red-600" onClick={(e) => { e.stopPropagation(); onDeleteList(list.id); }}>Excluir lista</DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          </div>
                                        );
                                      })}

                                      {docs.filter((d: any) => d.folderId === folder.id && !d.parentId).map((doc: any) => (
                                        <SidebarDocItem
                                          key={doc.id}
                                          doc={doc}
                                          allDocs={docs}
                                          depth={0}
                                          activeDocId={activeDocId}
                                          folder={folder}
                                          onSetActiveDocId={onSetActiveDocId}
                                          onViewChange={onViewChange}
                                          onNavigate={onNavigate}
                                          onDeleteDoc={onDeleteDoc}
                                        />
                                      ))}

                                      <button
                                        onClick={(e) => { e.stopPropagation(); onCreateList?.(folder.id); }}
                                        className="w-full text-left text-[11px] text-sidebar-foreground/40 hover:text-primary flex items-center gap-1.5 px-2 py-1 rounded hover:bg-sidebar-accent/50 transition-colors"
                                      >
                                        <Icons.Plus /> Nova Lista
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <button
                              onClick={(e) => { e.stopPropagation(); onOpenCreateFolder(space.id); }}
                              className="w-full text-left text-[11px] text-sidebar-foreground/40 hover:text-primary flex items-center gap-1.5 px-2 py-1 rounded hover:bg-sidebar-accent/50 transition-colors"
                            >
                              <Icons.Plus /> Nova Pasta
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenCreateSpace(); }}
                    className="w-full text-left text-[11px] text-sidebar-foreground/40 hover:text-primary flex items-center gap-1.5 px-4 py-1.5 rounded hover:bg-sidebar-accent/50 transition-colors mt-1"
                  >
                    <Icons.Plus /> Novo Espaço
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border">
            {(userRole === UserRole.ADMIN || userRole === UserRole.GESTOR) && (
              <button
                onClick={onOpenFields}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 16 16"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42"/><circle cx="8" cy="8" r="3"/></svg>
                Personalizar a barra lateral
              </button>
            )}
            <div className="text-[10px] text-sidebar-foreground/30 text-center py-1.5 uppercase tracking-widest">v2.0.0 Gold</div>
            {formatBuildTimeShort(__APP_BUILD_TIME__) && (
              <div className="text-[10px] text-sidebar-foreground/30 text-center pb-1.5">
                Última atualização: {formatBuildTimeShort(__APP_BUILD_TIME__)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, isCollapsed, active, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${isCollapsed ? 'justify-center' : ''} ${active ? 'bg-sidebar-accent text-primary' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50'}`}
      title={isCollapsed ? label : ''}
    >
      <div className={`${active ? 'text-primary' : 'text-sidebar-foreground/40'} group-hover:text-primary transition-colors shrink-0`}>{icon}</div>
      {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
    </div>
  );
}

function ViewTab({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-3 text-sm font-medium transition-all relative whitespace-nowrap ${active ? 'text-[var(--primary-color)]' : 'text-gray-500 hover:text-gray-900'
        }`}
    >
      {label}
      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary-color)] animate-in fade-in duration-200" />}
    </button>
  );
}

function RenameModal({ title, defaultValue, placeholder, onConfirm, onClose }: { title: string; defaultValue: string; placeholder?: string; onConfirm: (v: string) => void; onClose: () => void }) {
  const [value, setValue] = React.useState(defaultValue);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (value.trim()) onConfirm(value.trim()); };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-800 text-base">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder || 'Nome…'}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/50"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={!value.trim()} className="px-4 py-2 text-sm rounded-lg bg-[var(--primary-color)] text-gray-800 font-bold disabled:opacity-40 hover:brightness-95">Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onClose }: { message: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">Confirmar ação</p>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-bold hover:bg-red-700">Excluir</button>
        </div>
      </div>
    </div>
  );
}

function DuplicateTaskModal({
  task,
  lists,
  isOpen,
  isSubmitting,
  onClose,
  onDuplicate,
}: {
  task: Task | null;
  lists: List[];
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onDuplicate: (options: DuplicateTaskOptions) => void;
}) {
  const [options, setOptions] = useState<DuplicateTaskOptions>({
    title: '',
    listId: '',
    includeDescription: true,
    includeAssignees: true,
    includeDates: true,
    includePriority: true,
    includeSubtasks: true,
    includeChecklists: true,
    includeTags: true,
    includeCustomFields: true,
  });

  useEffect(() => {
    if (!task) return;
    setOptions({
      title: `Cópia de ${task.title}`,
      listId: task.listId,
      includeDescription: true,
      includeAssignees: true,
      includeDates: true,
      includePriority: true,
      includeSubtasks: true,
      includeChecklists: true,
      includeTags: true,
      includeCustomFields: true,
    });
  }, [task]);

  const toggle = (key: DuplicateTaskBooleanOption, value: boolean) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!task || isSubmitting || !options.title.trim() || !options.listId) return;
    onDuplicate({ ...options, title: options.title.trim() });
  };

  const copyItems: Array<{ key: DuplicateTaskBooleanOption; label: string; description: string }> = [
    { key: 'includeDescription', label: 'Descrição', description: 'Copia o texto principal da tarefa.' },
    { key: 'includeAssignees', label: 'Responsáveis', description: 'Mantém responsável principal e acompanhantes.' },
    { key: 'includeDates', label: 'Datas', description: 'Mantém início e prazo da tarefa original.' },
    { key: 'includePriority', label: 'Prioridade', description: 'Mantém a prioridade atual.' },
    { key: 'includeSubtasks', label: 'Subtarefas', description: 'Cria cópias independentes das subtarefas diretas.' },
    { key: 'includeChecklists', label: 'Checklists', description: 'Copia itens de ação e seus estados.' },
    { key: 'includeTags', label: 'Etiquetas', description: 'Mantém as tags aplicadas.' },
    { key: 'includeCustomFields', label: 'Campos personalizados', description: 'Copia valores preenchidos nos campos customizados.' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gray-50/60">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Copy className="w-5 h-5 text-blue-500" />
              Duplicar tarefa
            </DialogTitle>
            <DialogDescription>
              Crie uma nova tarefa independente a partir da tarefa atual. Alterações na cópia não mudam a original.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700" htmlFor="duplicate-task-title">
                Nome da nova tarefa
              </label>
              <input
                id="duplicate-task-title"
                autoFocus
                value={options.title}
                onChange={(event) => setOptions((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Digite o nome da tarefa duplicada"
              />
              {task && (
                <p className="text-xs text-gray-400">
                  Original: <span className="font-medium text-gray-500">{task.title}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700" htmlFor="duplicate-task-list">
                Lista de destino
              </label>
              <select
                id="duplicate-task-list"
                value={options.listId}
                onChange={(event) => setOptions((prev) => ({ ...prev, listId: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">O que copiar</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {copyItems.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-blue-200 hover:bg-blue-50/30 transition-colors cursor-pointer"
                  >
                    <Checkbox
                      checked={Boolean(options[item.key])}
                      onCheckedChange={(checked) => toggle(item.key, checked === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-800">{item.label}</span>
                      <span className="block text-xs text-gray-500 leading-snug">{item.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Comentários e anexos não são copiados automaticamente. Assim a nova tarefa nasce limpa, sem duplicar histórico ou arquivos da original.
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-gray-50/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !options.title.trim() || !options.listId}
              className="px-5 py-2 rounded-lg bg-[var(--primary-color)] text-[#2c3e50] text-sm font-black hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Duplicando...' : 'Duplicar tarefa'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Datas de tarefa (dueDate/startDate) são strings "YYYY-MM-DD" (sem hora).
// `new Date("YYYY-MM-DD")` interpreta isso como meia-noite UTC, que em fusos
// atrás de UTC (ex: Brasil) cai no dia anterior ao formatar/comparar em
// horário local. Parseamos os componentes manualmente para obter a
// meia-noite local do dia correto.
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Inverso de parseLocalDate: formata um Date usando os componentes locais
// (ano/mês/dia), nunca `toISOString()` — que converte para UTC e pode
// arredondar para o dia errado em fusos atrás de UTC (ex: Brasil, UTC-3).
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Resolve qual lista deve ser considerada "ativa" quando `activeListId` está
// vazio (ex: navegando por pasta/espaço em vez de uma lista específica): se
// todas as tarefas visíveis pertencem à mesma lista, usamos essa lista;
// senão é ambíguo e retornamos null. Usado tanto pela tabela (ListView)
// quanto pelo modal de campos personalizados — as duas telas PRECISAM
// concordar sobre qual lista está "ativa", senão os toggles de
// mostrar/ocultar campo gravam numa chave que a outra tela nunca lê.
export function resolveActiveListId(activeListId: string | null | undefined, tasks: { listId: string }[]): string | null {
  if (activeListId) return activeListId;
  const listIds = Array.from(new Set(tasks.map((t) => t.listId)));
  return listIds.length === 1 ? listIds[0] : null;
}

function getTaskHealth(task: Task) {
  const status = (task.status || '').toLowerCase();

  // ── 1. Terminal / concluído ───────────────────────────────────────────────
  if (status.includes('conclu') || status.includes('aprovado') || status.includes('fechado')) {
    return { emoji: '🎉', label: 'Missão cumprida!', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
  }

  // ── 2. Cancelado / Reprovado — terminal, não conta como atraso ───────────
  if (status.includes('cancel') || status.includes('reprova')) {
    return { emoji: '🚫', label: 'Cancelado / Reprovado', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' };
  }

  // ── 3. Aguardando / Bloqueado / Pendente — em espera, NÃO é atraso ───────
  if (
    status.includes('aguardando') ||
    status.includes('pendente') ||
    status.includes('enviada') ||
    status.includes('em espera') ||
    status.includes('bloqueada') ||
    status.includes('em analise') ||
    status.includes('em análise')
  ) {
    return { emoji: '⏳', label: 'Aguardando / Em espera', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
  }

  if (!task.dueDate) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = parseLocalDate(task.dueDate); due.setHours(23, 59, 59, 999);
  const start = task.startDate ? parseLocalDate(task.startDate) : null;

  if (start && today < start) {
    return { emoji: '⏰', label: 'Preparando para decolar!', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  }
  if (today > due) {
    return { emoji: '😡', label: 'Atrasado! Corra!', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
  }

  const ref = start ?? today;
  const total = due.getTime() - ref.getTime();
  const remaining = due.getTime() - today.getTime();
  const pct = total > 0 ? remaining / total : 1;

  if (pct > 0.5) return { emoji: '😄', label: 'Tranquilo, em dia!', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
  if (pct > 0.2) return { emoji: '😅', label: 'Atenção, prazo chegando!', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
  return { emoji: '😰', label: 'Cuidado, últimos dias!', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' };
}

function ListView({
  tasks,
  onSelectTask,
  onStatusChange,
  context,
  onQuickCreate,
  onDeleteTask,
  onDuplicateTask,
  lists,
  statusGroups,
  activeListId,
  hiddenStandardColumnKeysByList,
  onToggleStandardColumn,
  customFields,
  fieldValues,
  hiddenTaskFieldIdsByList,
  onCreateField,
  onUpdateFieldValue,
  onHideTaskFieldForList,
  columnOrder,
  onReorderColumns,
  onOpenManager,
  currentUser,
  users,
  onBulkStatusChange,
  onBulkPriorityChange,
  onBulkDelete,
  onBulkMove,
}: any) {
  // --- Bulk Selection State (T701) ---
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const toggleSelection = (id: string) => setSelectedTaskIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const clearSelection = () => setSelectedTaskIds(new Set());

  // Encontrar o grupo de status para a visualização atual
  const activeList = lists?.find((l: any) => l.id === activeListId);
  const activeStatusGroup = statusGroups?.find((g: any) => g.id === activeList?.statusGroupId) || statusGroups?.[0];
  const activeStatusOptions = activeStatusGroup?.options || [];

  const statusOrder = useMemo(() => {
    let order: string[] = [];
    if (activeListId && activeStatusOptions.length > 0) {
      order = activeStatusOptions.map((o: any) => o.label);
    } else {
      // Caso contrário, coletar todos os status únicos das tarefas presentes
      const uniqueStatuses = Array.from(new Set<string>(tasks.map((t: Task) => t.status)));
      // Tentar manter uma ordem razoável baseada no grupo padrão
      const defaultOrder = statusGroups?.[0]?.options.map((o: any) => o.label) || [];
      order = uniqueStatuses.sort((a: any, b: any) => {
        const idxA = defaultOrder.indexOf(a);
        const idxB = defaultOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
    }
    return order;
    // Usamos JSON.stringify para evitar novos arrays idênticos disparando o useEffect
    // Adicionamos t.status para que mudanças de status disparem a re-calculação mesmo se tasks.length não mudar
  }, [tasks.length, activeListId, JSON.stringify(activeStatusOptions), JSON.stringify(tasks.map(t => t.status)), JSON.stringify(statusGroups?.[0]?.options)]);

  const [expandedStatuses, setExpandedStatuses] = useState<string[]>([]);

  useEffect(() => {
    if (JSON.stringify(expandedStatuses) !== JSON.stringify(statusOrder)) {
      setExpandedStatuses(statusOrder);
    }
  }, [statusOrder]);

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleStatus = useCallback((status: string) => {
    setExpandedStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  }, []);

  const getStatusStyle = useCallback((statusLabel: string) => {
    const sLower = (statusLabel || '').toLowerCase();
    const opt = activeStatusOptions.find((o: any) => o.label?.toLowerCase() === sLower) ||
      statusGroups?.flatMap((g: any) => g.options).find((o: any) => o.label?.toLowerCase() === sLower);

    if (opt?.color) {
      return {
        backgroundColor: opt.color,
        color: '#ffffff',
        border: `1px solid ${opt.color}`
      };
    }

    if (sLower.includes('conclu') || sLower.includes('fechado') || sLower.includes('aprovado')) return { backgroundColor: '#dcfce7', color: '#15803d' };
    if (sLower.includes('espera') || sLower.includes('aguarda') || sLower.includes('pendente')) return { backgroundColor: '#fef9c3', color: '#a16207' };
    if (sLower.includes('andamento') || sLower.includes('progresso')) return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
    if (sLower.includes('cancel') || sLower.includes('repro') || sLower.includes('risco')) return { backgroundColor: '#fee2e2', color: '#b91c1c' };

    return { backgroundColor: '#f1f5f9', color: '#475569' };
  }, [activeStatusOptions, statusGroups]);

  const toggleTaskExpansion = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const listIdsInView = useMemo(() => {
    const ids = new Set<string>();
    (tasks as Task[]).forEach((t) => ids.add(t.listId));
    return Array.from(ids);
  }, [tasks]);

  const derivedActiveListId = useMemo(
    () => resolveActiveListId(activeListId, tasks),
    [activeListId, tasks],
  );

  const hiddenTaskFieldIdsForActiveList = useMemo(() => {
    if (!derivedActiveListId) return [];
    return (hiddenTaskFieldIdsByList as Record<string, string[]> | undefined)?.[derivedActiveListId] ?? [];
  }, [derivedActiveListId, hiddenTaskFieldIdsByList]);

  const taskCustomFields = useMemo(() => {
    return (customFields as CustomField[])
      .filter((f) => f.target === 'TASK')
      .filter((f) => (f.visibleTo as UserRole[]).includes(currentUser.role))
      .filter((f) => !hiddenTaskFieldIdsForActiveList.includes(f.id));
  }, [customFields, currentUser.role, hiddenTaskFieldIdsForActiveList]);

  const hiddenStandardColumnsForActiveList = useMemo(() => {
    if (!derivedActiveListId) return [];
    return (hiddenStandardColumnKeysByList as Record<string, any[]> | undefined)?.[derivedActiveListId] ?? [];
  }, [derivedActiveListId, hiddenStandardColumnKeysByList]);

  const isStandardVisible = useCallback(
    (key: any) => !hiddenStandardColumnsForActiveList.includes(key),
    [hiddenStandardColumnsForActiveList],
  );

  const getFieldValue = useCallback(
    (fieldId: string, entityId: string) => {
      return (fieldValues as CustomFieldValue[]).find(
        (v) => v.fieldId === fieldId && v.entityId === entityId,
      )?.value;
    },
    [fieldValues],
  );


  const sortTasksNaturally = (a: Task, b: Task) =>
    a.title.localeCompare(b.title, 'pt-BR', { numeric: true, sensitivity: 'base' });

  const grouped = useMemo(() => {
    return statusOrder
      .map((status) => ({
        status,
        tasks: (tasks as Task[])
          .filter((t) => t.status === status && !t.parentId)
          .sort(sortTasksNaturally),
      }))
      .filter((g) => g.tasks.length > 0);
  }, [tasks, statusOrder]);

  // --- Dynamic Column Management ---
  const allAvailableColumns = useMemo(() => {
    const cols: { id: string, name: string, type: 'standard' | 'custom' }[] = [];

    if (isStandardVisible("status")) cols.push({ id: 'status', name: 'Status', type: 'standard' });
    if (isStandardVisible("priority")) cols.push({ id: 'priority', name: 'Prioridade', type: 'standard' });
    if (isStandardVisible("assignee")) cols.push({ id: 'assignee', name: 'Responsável', type: 'standard' });
    if (isStandardVisible("extensions")) cols.push({ id: 'extensions', name: 'Prorrog.', type: 'standard' });
    if (isStandardVisible("dueDate")) cols.push({ id: 'dueDate', name: 'Data Limite', type: 'standard' });

    taskCustomFields.forEach(f => {
      cols.push({ id: f.id, name: f.name, type: 'custom' });
    });

    return cols;
  }, [isStandardVisible, taskCustomFields]);

  const orderedColumns = useMemo(() => {
    if (!columnOrder) return allAvailableColumns;

    // Filter out columns that might have been removed or hidden
    const availableIds = allAvailableColumns.map(c => c.id);
    const filteredOrder = columnOrder.filter(id => availableIds.includes(id));

    // Append any new available columns that are not in the order yet
    const missing = allAvailableColumns.filter(c => !filteredOrder.includes(c.id));

    const finalOrder = [...filteredOrder, ...missing.map(c => c.id)];
    return finalOrder.map(id => allAvailableColumns.find(c => c.id === id)!);
  }, [allAvailableColumns, columnOrder]);

  // --- Column Resize Logic ---
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizeActiveRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest('th') as HTMLElement | null;
    const startWidth = th ? th.getBoundingClientRect().width : (colWidths[colId] || 150);
    resizeActiveRef.current = { colId, startX: e.clientX, startWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeActiveRef.current) return;
      const delta = ev.clientX - resizeActiveRef.current.startX;
      const newWidth = Math.max(60, resizeActiveRef.current.startWidth + delta);
      setColWidths(prev => ({ ...prev, [resizeActiveRef.current!.colId]: newWidth }));
    };
    const onMouseUp = () => {
      resizeActiveRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  const handleResizeDblClick = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setColWidths(prev => { const next = { ...prev }; delete next[colId]; return next; });
  }, []);

  // --- Drag and Drop Logic ---
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColumnId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Adiciona uma imagem vazia como drag preview para evitar o "fantasma" padrão se quisermos Custom
    // Mas o padrão costuma ser bom o suficiente. Vamos apenas garantir que o ID está lá.
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColumnId || draggedColumnId === targetId) return;

    // "Live" reordering: troca as colunas enquanto arrasta
    const currentIds = orderedColumns.map(c => c.id);
    const fromIndex = currentIds.indexOf(draggedColumnId);
    const toIndex = currentIds.indexOf(targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...currentIds];
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, draggedColumnId);

    onReorderColumns(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedColumnId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedColumnId(null);
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto custom-scrollbar flex flex-col h-full"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Inline Quick Create Trigger */}
      <div
        className="p-3 border-b flex items-center gap-3 bg-gray-50/50 hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={onQuickCreate}
      >
        <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400">
          <span className="text-xs">+</span>
        </div>
        <span className="text-sm text-gray-500">
          + Adicionar nova tarefa em <span className="font-semibold">{context.name}</span>...
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="px-4 py-12 text-center text-gray-400 italic">Nenhuma tarefa encontrada neste contexto.</div>
      ) : (
        <div className="flex-1 overflow-auto">
          {grouped.map(({ status, tasks: statusTasks }) => {
            const isExpanded = expandedStatuses.includes(status);

            return (
              <section key={status} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className="w-full px-4 py-3 bg-white sticky top-0 z-[1] border-b flex items-center justify-between hover:bg-gray-50 transition-colors"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-1 rounded text-[11px] font-extrabold uppercase"
                      style={getStatusStyle(status)}
                    >
                      {status}
                    </span>
                    <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {statusTasks.length}
                    </span>
                  </div>

                  <div className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                    <Icons.ChevronRight />
                  </div>
                </button>

                {isExpanded && (
                  <table className="w-full text-left border-collapse min-w-[900px]" style={{ tableLayout: 'fixed' }}>
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="w-10 px-3 py-3 border-r border-gray-200">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 cursor-pointer"
                            checked={tasks.length > 0 && tasks.every((t: Task) => selectedTaskIds.has(t.id))}
                            onChange={() => {
                              const allIds = tasks.map((t: Task) => t.id);
                              const allSelected = allIds.every((id: string) => selectedTaskIds.has(id));
                              allSelected
                                ? clearSelection()
                                : setSelectedTaskIds(new Set(allIds));
                            }}
                          />
                        </th>
                        <th
                          className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 relative overflow-hidden"
                          style={{ width: colWidths['tarefa'] || 300, minWidth: 120 }}
                        >
                          Tarefa
                          <div
                            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors z-10 opacity-0 hover:opacity-60"
                            style={{ cursor: 'col-resize' }}
                            onMouseDown={(e) => handleResizeMouseDown(e, 'tarefa')}
                            onDoubleClick={(e) => handleResizeDblClick(e, 'tarefa')}
                          />
                        </th>

                        {orderedColumns.map((col) => (
                          <th
                            key={col.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, col.id)}
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => handleDragEnter(e, col.id)}
                            onDragEnd={handleDragEnd}
                            onDrop={handleDrop}
                            className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-move hover:bg-gray-100 transition-colors border-r border-gray-200 relative overflow-hidden ${draggedColumnId === col.id ? 'bg-blue-50 opacity-40' : ''}`}
                            style={{ width: colWidths[col.id] || 150, minWidth: 60 }}
                          >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className="truncate">{col.name}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (col.type === 'standard') {
                                    if (!derivedActiveListId) return;
                                    onToggleStandardColumn?.(derivedActiveListId, col.id as any);
                                  } else {
                                    let targetListId = derivedActiveListId;
                                    if (!targetListId) {
                                      const chosen = window.prompt('Digite o ID da lista para ocultar este campo:', listIdsInView[0] ?? '');
                                      if (!chosen) return;
                                      targetListId = chosen;
                                    }
                                    if (!window.confirm(`Ocultar o campo "${col.name}" apenas nesta lista: ${targetListId}?`)) return;
                                    onHideTaskFieldForList(targetListId, col.id);
                                  }
                                }}
                                className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                                title={`Ocultar ${col.name}`}
                              >
                                {col.type === 'standard' ? <Icons.EyeOff /> : <Icons.Trash />}
                              </button>
                            </div>
                            {/* Resize handle */}
                            <div
                              className="absolute right-0 top-0 h-full w-1.5 hover:bg-blue-400 hover:opacity-60 transition-colors z-10"
                              style={{ cursor: 'col-resize' }}
                              onMouseDown={(e) => handleResizeMouseDown(e, col.id)}
                              onDoubleClick={(e) => handleResizeDblClick(e, col.id)}
                            />
                          </th>
                        ))}

                        <th className="px-2 py-3 w-10 border-r border-gray-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenManager?.();
                            }}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                            title="Gerenciar campos"
                          >
                            <Icons.Plus />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {statusTasks.flatMap((rootTask: Task) => {
                        const renderRecursiveRows = (t: Task, depth: number = 0): React.ReactNode[] => {
                          if (depth >= 7) return [];

                          const subtasks = (tasks as Task[]).filter(child => child.parentId === t.id);
                          const hasChildren = subtasks.length > 0;
                          const isTaskExpanded = expandedTasks.has(t.id);

                          const currentRow = (
                            <tr
                              key={t.id}
                              className={`hover:bg-gray-50 cursor-pointer group transition-colors border-b border-gray-100 ${depth > 0 ? 'bg-gray-50/30' : ''} ${selectedTaskIds.has(t.id) ? 'bg-blue-50/40' : ''}`}
                              onClick={() => onSelectTask(t.id)}
                            >
                              <td className="w-10 px-3 py-3 border-r border-gray-200" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 cursor-pointer"
                                  checked={selectedTaskIds.has(t.id)}
                                  onChange={() => toggleSelection(t.id)}
                                />
                              </td>
                              <td className="px-4 py-3 border-r border-gray-200 overflow-hidden" style={{ maxWidth: colWidths['tarefa'] || 300 }}>
                                <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
                                  <div
                                    className={`w-1 h-10 rounded-full shrink-0 ${t.priority === TaskPriority.URGENTE ? 'bg-red-500' : 'bg-transparent'}`}
                                  />
                                  <div className="flex items-center gap-1">
                                    {hasChildren && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleTaskExpansion(t.id);
                                        }}
                                        className={`p-1 hover:bg-gray-200 rounded transition-transform ${isTaskExpanded ? 'rotate-90' : ''}`}
                                        title={isTaskExpanded ? "Recolher subtarefas" : "Expandir subtarefas"}
                                      >
                                        <Icons.ChevronRight className="w-3 h-3 text-gray-500" />
                                      </button>
                                    )}
                                    <span className={`${depth > 0 ? 'text-sm' : 'font-medium'} text-gray-800 line-clamp-1`}>
                                    {t.title}
                                    </span>
                                    {(() => {
                                      const isOwner = currentUser?.id === t.mainAssigneeId;
                                      const isPrivileged = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.GESTOR;
                                      if (!isOwner && !isPrivileged) return null;
                                      const h = getTaskHealth(t);
                                      if (!h) return null;
                                      return (
                                        <span className={`ml-1 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${h.bg} ${h.text} ${h.border} whitespace-nowrap`}>
                                          {h.emoji} {h.label}
                                        </span>
                                      );
                                    })()}
                                    {depth < 6 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onQuickCreate({ parentId: t.id });
                                        }}
                                        className="ml-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition-all"
                                        title="Adicionar subtarefa"
                                      >
                                        <Icons.Plus className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {orderedColumns.map((col) => {
                                if (col.type === 'standard') {
                                  switch (col.id) {
                                    case 'status':
                                      return (
                                        <td key={col.id} className="px-4 py-3 border-r border-gray-200">
                                          <span
                                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap"
                                            style={getStatusStyle(t.status)}
                                          >
                                            {t.status}
                                          </span>
                                        </td>
                                      );
                                    case 'priority':
                                      return (
                                        <td key={col.id} className="px-4 py-3 border-r border-gray-200">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${PRIORITY_COLORS[t.priority]}`}>
                                            {t.priority}
                                          </span>
                                        </td>
                                      );
                                    case 'assignee':
                                      return (
                                        <td key={col.id} className="px-4 py-3 border-r border-gray-200">
                                          <div className="flex -space-x-2">
                                            {t.mainAssigneeId ? (
                                              <img
                                                src={users?.find((u: User) => u.id === t.mainAssigneeId)?.avatar || `https://picsum.photos/seed/${t.mainAssigneeId}/100`}
                                                className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-[3] hover:z-50 transition-all cursor-pointer bg-white"
                                                alt="Assignee"
                                                title={users?.find((u: User) => u.id === t.mainAssigneeId)?.name}
                                              />
                                            ) : (
                                              <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">—</div>
                                            )}
                                            {(t.secondaryAssigneeIds || []).map((id: string) => (
                                              <img
                                                key={id}
                                                src={users?.find((u: User) => u.id === id)?.avatar || `https://picsum.photos/seed/${id}/100`}
                                                className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-[3] hover:z-50 transition-all cursor-pointer bg-white"
                                                alt="Assignee"
                                                title={users?.find((u: User) => u.id === id)?.name}
                                              />
                                            ))}
                                          </div>
                                        </td>
                                      );
                                    case 'extensions':
                                      return (
                                        <td key={col.id} className="px-4 py-3 text-center border-r border-gray-200">
                                          <span className={`text-xs font-bold ${t.extensionCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {t.extensionCount}
                                          </span>
                                        </td>
                                      );
                                    case 'dueDate':
                                      return (
                                        <td key={col.id} className="px-4 py-3 text-[10px] text-gray-500 font-medium whitespace-nowrap uppercase border-r border-gray-200">
                                          {t.dueDate ? (() => { const [y, m, d] = t.dueDate.split('-'); return `${d}/${m}/${y}`; })() : '—'}
                                        </td>
                                      );
                                    default:
                                      return <td key={col.id}></td>;
                                  }
                                } else {
                                  // Custom Field Value
                                  const field = customFields.find((f: CustomField) => f.id === col.id);
                                  if (!field) return <td key={col.id}></td>;
                                  const currentValue = getFieldValue(field.id, t.id);
                                  return (
                                  <td key={col.id} className="px-4 py-3 border-r border-gray-200" onClick={(e) => e.stopPropagation()}>
                                    {field.type === CustomFieldType.FORMULA ? (
                                      <div className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 italic">
                                        <FormulaValue
                                          formula={field.config?.formula || ''}
                                          context={{ ...t, ...Object.fromEntries(fieldValues.filter(fv => fv.entityId === t.id).map(fv => [customFields.find(f => f.id === fv.fieldId)?.name || '', fv.value])) }}
                                        />
                                      </div>
                                    ) : field.type === CustomFieldType.DROPDOWN ? (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <div className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-all group overflow-hidden">
                                              {(() => {
                                                const opt = field.config?.options?.find((o: CustomFieldOption) => o.id === currentValue);
                                                const IconComp = opt?.icon ? (Icons as any)[opt.icon] : null;
                                                return (
                                                  <div className="flex items-center gap-2 overflow-hidden w-full">
                                                    {opt ? (
                                                      <div
                                                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 whitespace-nowrap overflow-hidden"
                                                        style={{ backgroundColor: opt.color }}
                                                      >
                                                        {IconComp && <IconComp className="h-3 w-3 shrink-0" color="white" />}
                                                        <span className="truncate">{opt.label}</span>
                                                      </div>
                                                    ) : (
                                                      <span className="text-[10px] text-gray-400 font-medium">—</span>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                              <Icons.ChevronDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600 shrink-0 ml-1" />
                                            </div>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto" align="end">
                                            <DropdownMenuItem onClick={() => onUpdateFieldValue(field.id, t.id, '')} className="text-xs text-gray-400 italic">
                                              — Limpar seleção
                                            </DropdownMenuItem>
                                            {field.config?.options?.map((opt: CustomFieldOption) => {
                                              const OptIcon = opt.icon ? (Icons as any)[opt.icon] : null;
                                              return (
                                                <DropdownMenuItem
                                                  key={opt.id}
                                                  onClick={() => onUpdateFieldValue(field.id, t.id, opt.id)}
                                                  className="p-1"
                                                >
                                                  <div
                                                    className="flex items-center justify-center gap-2 w-full py-1.5 rounded text-[10px] font-bold text-white transition-opacity hover:opacity-90"
                                                    style={{ backgroundColor: opt.color }}
                                                  >
                                                    {OptIcon && <OptIcon className="h-3 w-3" color="white" />}
                                                    <span>{opt.label}</span>
                                                    {currentValue === opt.id && <Icons.Check className="ml-auto h-3 w-3" color="white" />}
                                                  </div>
                                                </DropdownMenuItem>
                                              );
                                            })}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      ) : field.type === CustomFieldType.DATE ? (
                                        <DateFieldEditor
                                          value={currentValue}
                                          onCommit={(v) => onUpdateFieldValue(field.id, t.id, v)}
                                          className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                                        />
                                      ) : field.type === CustomFieldType.RATING ? (
                                        <BufferedRating
                                          value={currentValue}
                                          onCommit={(star) => onUpdateFieldValue(field.id, t.id, star)}
                                          className="flex gap-1"
                                        />
                                      ) : field.type === CustomFieldType.PROGRESS ? (
                                        <BufferedProgressEditor
                                          value={currentValue}
                                          onCommit={(v) => onUpdateFieldValue(field.id, t.id, v)}
                                          compact
                                        />
                                      ) : (
                                        <div className="relative">
                                          {(field.type === CustomFieldType.MONEY || field.type === CustomFieldType.CURRENCY) && (
                                            <div className="absolute left-2 top-2 text-[10px] text-gray-400 font-bold">
                                              {field.config?.currency || 'R$'}
                                            </div>
                                          )}
                                          <BufferedFieldInput
                                            type={field.type === CustomFieldType.NUMBER || field.type === CustomFieldType.MONEY || field.type === CustomFieldType.CURRENCY ? 'number' : 'text'}
                                            value={currentValue}
                                            onCommit={(v) => onUpdateFieldValue(field.id, t.id, v)}
                                            className={`h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all ${(field.type === CustomFieldType.MONEY || field.type === CustomFieldType.CURRENCY) ? 'pl-8' : ''}`}
                                            placeholder="—"
                                          />
                                        </div>
                                      )}
                                    </td>
                                  );
                                }
                              })}

                              <td className="px-2 py-3" />

                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDuplicateTask?.(t);
                                    }}
                                    className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Duplicar Tarefa"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteTask(t.id);
                                    }}
                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Excluir Tarefa"
                                  >
                                    <Icons.Trash />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                          const rows: React.ReactNode[] = [currentRow];
                          if (isTaskExpanded && hasChildren) {
                            subtasks.forEach(child => {
                              rows.push(...renderRecursiveRows(child, depth + 1));
                            });
                          }
                          
                          // Quick Create button for subtasks (only if expanded)
                          if (isTaskExpanded) {
                            rows.push(
                              <tr key={`${t.id}-add-sub`} className="bg-gray-50/20">
                                <td className="px-4 py-2" colSpan={orderedColumns.length + 4}>
                                  <div className="flex items-center gap-2" style={{ paddingLeft: `${(depth + 1) * 24 + 24}px` }}>
                                    <button
                                      onClick={() => onQuickCreate({ parentId: t.id })}
                                      className="text-[11px] text-gray-400 hover:text-[var(--primary-color)] font-bold transition-colors flex items-center gap-2"
                                    >
                                      <Icons.Plus className="w-3 h-3" />
                                      Adicionar Subtarefa
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          return rows;
                        };

                        return renderRecursiveRows(rootTask, 0);
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Bulk Action Bar — T701 */}
      {selectedTaskIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-gray-700">
          <span className="text-sm font-medium whitespace-nowrap">{selectedTaskIds.size} selecionada(s)</span>
          <div className="w-px h-5 bg-gray-600" />
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { onBulkStatusChange([...selectedTaskIds], e.target.value); clearSelection(); e.target.value = ''; } }}
            className="text-sm bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white cursor-pointer"
          >
            <option value="" disabled>Status...</option>
            {activeStatusOptions.map((o: any) => (
              <option key={o.label} value={o.label}>{o.label}</option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { onBulkPriorityChange([...selectedTaskIds], e.target.value as TaskPriority); clearSelection(); e.target.value = ''; } }}
            className="text-sm bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white cursor-pointer"
          >
            <option value="" disabled>Prioridade...</option>
            {Object.values(TaskPriority).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { onBulkMove([...selectedTaskIds], e.target.value); clearSelection(); e.target.value = ''; } }}
            className="text-sm bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white cursor-pointer"
          >
            <option value="" disabled>Mover para...</option>
            {lists?.map((l: any) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <div className="w-px h-5 bg-gray-600" />
          <button
            onClick={() => { onBulkDelete([...selectedTaskIds]); clearSelection(); }}
            className="text-sm text-red-400 hover:text-red-300 px-2 transition-colors"
          >
            Deletar
          </button>
          <button
            onClick={clearSelection}
            className="text-sm text-gray-400 hover:text-white px-2 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function KanbanView({ tasks, onSelectTask, onStatusChange, onDeleteTask, onDuplicateTask, onCreateTask, onQuickCreate, users, lists, statusGroups, activeListId, workspaceTags }: any) {
  // Refs para não causar re-render durante drag (re-renders destroem o HTML5 DnD)
  const draggingTaskIdRef = useRef<string | null>(null);
  const currentDragOverColRef = useRef<HTMLElement | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [inlineCreateCol, setInlineCreateCol] = useState<string | null>(null);
  const [inlineCreateTitle, setInlineCreateTitle] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const confirmInlineCreate = async (status: string) => {
    const title = inlineCreateTitle.trim();
    if (title && activeListId) {
      await onCreateTask({ title, status, listId: activeListId });
    }
    setInlineCreateCol(null);
    setInlineCreateTitle('');
  };

  const openInlineCreate = (status: string) => {
    setInlineCreateCol(status);
    setInlineCreateTitle('');
    setTimeout(() => inlineInputRef.current?.focus(), 50);
  };

  const activeList = lists?.find((l: any) => l.id === activeListId);
  const activeStatusGroup = statusGroups?.find((g: any) => g.id === activeList?.statusGroupId) || statusGroups?.[0];
  const activeStatusOptions = activeStatusGroup?.options || [];

  const columns = useMemo(() => {
    let labels: string[];
    if (activeListId && activeStatusOptions.length > 0) {
      labels = activeStatusOptions.map((o: any) => o.label);
    } else {
      const uniqueStatuses = Array.from(new Set(tasks.map((t: Task) => t.status))) as string[];
      const defaultOrder = statusGroups?.[0]?.options.map((o: any) => o.label) || [];
      labels = uniqueStatuses.sort((a, b) => {
        const idxA = defaultOrder.indexOf(a);
        const idxB = defaultOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
    }
    const seen = new Set<string>();
    return labels.filter(label => {
      const key = label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tasks, activeListId, JSON.stringify(activeStatusOptions), JSON.stringify(statusGroups?.[0]?.options)]);

  const getStatusColor = (statusLabel: string) => {
    const sLower = (statusLabel || '').toLowerCase();
    const opt = activeStatusOptions.find((o: any) => o.label?.toLowerCase() === sLower) ||
      statusGroups?.flatMap((g: any) => g.options).find((o: any) => o.label?.toLowerCase() === sLower);
    return opt?.color || '#94a3b8';
  };

  // Highlight via DOM — zero re-renders durante drag
  const highlightColumn = (el: HTMLElement | null) => {
    if (currentDragOverColRef.current && currentDragOverColRef.current !== el) {
      currentDragOverColRef.current.style.backgroundColor = '';
      currentDragOverColRef.current.style.borderColor = '';
      currentDragOverColRef.current.style.boxShadow = '';
    }
    if (el && el !== currentDragOverColRef.current) {
      el.style.backgroundColor = '#fefce8';
      el.style.borderColor = '#facc15';
      el.style.boxShadow = '0 4px 16px rgba(250,204,21,0.25)';
    }
    currentDragOverColRef.current = el;
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    draggingTaskIdRef.current = taskId;
    setDraggingTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragEnd = () => {
    highlightColumn(null);
    draggingTaskIdRef.current = null;
    setDraggingTaskId(null);
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    let el = e.target as HTMLElement;
    while (el && !el.dataset.kanbanCol) el = el.parentElement as HTMLElement;
    if (el) highlightColumn(el);
  };

  const handleColumnDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      highlightColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    highlightColumn(null);
    const taskId = draggingTaskIdRef.current || e.dataTransfer.getData('text/plain');
    if (taskId) onStatusChange(taskId, status);
    draggingTaskIdRef.current = null;
    setDraggingTaskId(null);
  };

  const PRIORITY_FLAG: Record<string, { color: string; label: string }> = {
    Urgente: { color: '#ef4444', label: 'Urgente' },
    Alta:    { color: '#f97316', label: 'Alta' },
    Média:   { color: '#3b82f6', label: 'Média' },
    Media:   { color: '#3b82f6', label: 'Média' },
    Baixa:   { color: '#94a3b8', label: 'Baixa' },
  };

  return (
    <div className="flex gap-5 h-full overflow-x-auto pb-6 px-2 custom-scrollbar items-start" onClick={(e) => e.stopPropagation()}>
      {columns.map(status => {
        const statusColor = getStatusColor(status);
        const columnTasks = tasks.filter((t: Task) => t.status?.toLowerCase() === status.toLowerCase());

        return (
          <div
            key={status}
            data-kanban-col={status}
            className="w-72 shrink-0 flex flex-col max-h-full rounded-xl border border-gray-200 bg-[#f8f9fa] transition-all"
            onDragOver={handleColumnDragOver}
            onDragLeave={handleColumnDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* ── Cabeçalho da Coluna ── */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-extrabold uppercase text-white tracking-wide"
                  style={{ backgroundColor: statusColor }}
                >
                  {status}
                </span>
                <span className="text-xs font-semibold text-gray-400">{columnTasks.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onQuickCreate?.({ status })}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Adicionar tarefa"
                >
                  <Icons.Plus />
                </button>
                <button className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Cards ── */}
            <div className="flex flex-col gap-2 overflow-y-auto flex-1 custom-scrollbar px-2 pb-2 min-h-[60px]">
              {columnTasks.map((task: Task) => {
                const isDragging = draggingTaskId === task.id;
                const listName = lists?.find((l: any) => l.id === task.listId)?.name;
                const subtaskCount = tasks.filter((t: Task) => t.parentId === task.id).length;
                const assignee = users?.find((u: User) => u.id === task.mainAssigneeId);
                const secondaryAssignees = (task.secondaryAssigneeIds || [])
                  .map((id: string) => users?.find((u: User) => u.id === id))
                  .filter(Boolean);
                const allAssignees = [assignee, ...secondaryAssignees].filter(Boolean);
                const hasDueDate = task.dueDate && !isNaN(new Date(task.dueDate).getTime());
                const isOverdue = hasDueDate && parseLocalDate(task.dueDate) < new Date();
                const priorityFlag = PRIORITY_FLAG[task.priority];
                const h = getTaskHealth(task);

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onSelectTask(task.id)}
                    className={`bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all group relative select-none ${
                      isDragging ? 'opacity-30' : ''
                    }`}
                    style={{ borderLeftWidth: 3, borderLeftColor: statusColor }}
                  >
                    {/* Hover actions */}
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectTask(task.id); }}
                        className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        title="Abrir tarefa"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M7 3H3v10h10V9M9 3h4v4M13 3L7 9"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onQuickCreate?.({ parentId: task.id, status, listId: task.listId }); }}
                        className="p-1 rounded text-gray-400 hover:text-purple-500 hover:bg-purple-50 transition-colors"
                        title="Adicionar subtarefa"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="8" cy="8" r="6"/><path d="M8 5v6M5 8h6"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, columns[columns.length - 1]); }}
                        className="p-1 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                        title="Marcar como concluída"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 8l3.5 3.5L13 4.5"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDuplicateTask?.(task); }}
                        className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        title="Duplicar tarefa"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Excluir"
                      >
                        <Icons.Trash />
                      </button>
                    </div>

                    {/* Card body */}
                    <div className="px-3 pt-3 pb-2">
                      {/* Extension count badge */}
                      {task.extensionCount > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold mb-1">
                          <Icons.Clock /> {task.extensionCount}x prorrogado
                        </div>
                      )}

                      {/* Title */}
                      <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 pr-8 mb-1 flex items-start gap-1">
                        {task.dependencies?.some((d: any) => d.type === 'blocked_by') && (
                          <span title="Tarefa bloqueada" className="shrink-0 mt-0.5">
                            <AlertTriangleIcon className="w-3 h-3 text-amber-400" />
                          </span>
                        )}
                        {task.title}
                      </p>

                      {/* Tags */}
                      {(task.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {(task.tags ?? []).map((tagName: string) => {
                            const tag = (workspaceTags ?? []).find((t: WorkspaceTag) => t.name === tagName);
                            if (!tag) return null;
                            return <TagBadge key={tagName} name={tag.name} color={tag.color} size="xs" />;
                          })}
                        </div>
                      )}

                      {/* Context */}
                      {listName && (
                        <p className="text-[11px] text-gray-400 mb-2">Em {listName}</p>
                      )}

                      {/* Health indicator */}
                      {h && (
                        <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mb-2 ${h.bg} ${h.text} ${h.border}`}>
                          <span>{h.emoji}</span><span>{h.label}</span>
                        </div>
                      )}

                      {/* Fields row */}
                      <div className="flex items-center gap-3 mt-2">
                        {/* Assignees */}
                        <div className="flex -space-x-1.5 items-center" title={allAssignees.map((u: any) => u.name).join(', ') || 'Sem responsável'}>
                          {allAssignees.length > 0 ? allAssignees.slice(0, 3).map((u: any) => (
                            <img
                              key={u.id}
                              src={u.avatar || `https://picsum.photos/seed/${u.id}/100`}
                              className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                              alt={u.name}
                            />
                          )) : (
                            <span className="text-gray-300 text-xs" title="Sem responsável">
                              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-4 6s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H4z"/></svg>
                            </span>
                          )}
                        </div>

                        {/* Due date */}
                        <div className={`flex items-center gap-0.5 text-[11px] font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                          <Icons.Calendar />
                          <span>{hasDueDate ? (() => { const [y,m,d] = (task.dueDate as string).split('-'); return `${d}/${m}/${y.slice(2)}`; })() : '—'}</span>
                        </div>

                        {/* Priority flag */}
                        <div className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color: priorityFlag?.color || '#94a3b8' }} title={priorityFlag?.label || 'Sem prioridade'}>
                          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M1 1h10l-3 5 3 5H1V1z"/></svg>
                          <span>{priorityFlag?.label || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card footer — subtasks */}
                    {subtaskCount > 0 && (
                      <div className="px-3 py-1.5 border-t border-gray-100 flex items-center gap-1 text-[11px] text-gray-400">
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 3h8M2 6h6M2 9h4"/>
                        </svg>
                        {subtaskCount} subtarefa{subtaskCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty column placeholder */}
              {columnTasks.length === 0 && (
                <div className="h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                  Sem tarefas
                </div>
              )}
            </div>

            {/* ── Footer — Adicionar Tarefa ── */}
            {inlineCreateCol === status ? (
              <div className="px-2 pb-2 pt-1 border-t border-gray-100">
                <input
                  ref={inlineInputRef}
                  type="text"
                  value={inlineCreateTitle}
                  onChange={e => setInlineCreateTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmInlineCreate(status);
                    if (e.key === 'Escape') { setInlineCreateCol(null); setInlineCreateTitle(''); }
                  }}
                  onBlur={() => confirmInlineCreate(status)}
                  placeholder="Nome da tarefa…"
                  className="w-full px-2 py-1.5 text-xs rounded border border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                />
                <p className="text-[10px] text-gray-400 mt-1 px-1">Enter para salvar · Esc para cancelar</p>
              </div>
            ) : (
              <button
                onClick={() => activeListId ? openInlineCreate(status) : onQuickCreate?.({ status })}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-b-xl transition-colors border-t border-gray-100"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 2v10M2 7h10"/>
                </svg>
                Adicionar Tarefa
              </button>
            )}
          </div>
        );
      })}

      {/* ── Botão Adicionar Grupo ── */}
      <div className="shrink-0 w-64">
        <button
          className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-white transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 2v10M2 7h10"/>
          </svg>
          Adicionar grupo
        </button>
      </div>
    </div>
  );
}

function DashboardView({ tasks, users, statusGroups, activeListId, lists, allLists, isLoading }: any) {
  // Loading state: mostra skeleton enquanto carrega dados globais pela primeira vez
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-8 bg-gray-100 rounded-lg w-48 ml-auto" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-40 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-3 gap-6">
          <div className="h-72 bg-gray-100 rounded-xl col-span-2" />
          <div className="h-72 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  // Resolve CSS custom property so Recharts SVG fill works correctly
  const primaryChartColor = useMemo(() => {
    const val = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    return val ? `hsl(${val})` : '#f5c518';
  }, []);

  // --- Period filter ---
  type PeriodKey = '7d' | '30d' | '90d' | 'all';
  const [period, setPeriod] = useState<PeriodKey>('all');
  const filteredTasks = useMemo(() => {
    if (period === 'all') return tasks;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (period === '7d' ? 7 : period === '30d' ? 30 : 90));
    cutoff.setHours(0, 0, 0, 0);
    return tasks.filter((t: Task) => {
      // Usa dueDate → startDate → createdAt como referência de data; sem data = sempre inclui
      const ref = t.dueDate || t.startDate || t.createdAt;
      if (!ref) return true;
      return new Date(ref) >= cutoff;
    });
  }, [tasks, period]);

  const activeList = lists?.find((l: any) => l.id === activeListId);
  const activeStatusGroup = statusGroups?.find((g: any) => g.id === activeList?.statusGroupId) || statusGroups?.[0];
  const activeStatusOptions = activeStatusGroup?.options || [];

  const isConcluido = (status: string) => {
    const s = (status || '').toLowerCase();
    return s.includes('conclu') || s.includes('aprovado') || s.includes('fechado');
  };

  // --- Health buckets (dynamic, using getTaskHealth) ---
  const healthBuckets = useMemo(() => {
    const buckets: Record<string, { label: string; emoji: string; color: string; bg: string; count: number }> = {
      done:      { label: 'Missão cumprida',        emoji: '🎉', color: '#10b981', bg: '#d1fae5', count: 0 },
      ok:        { label: 'Tranquilo, em dia',      emoji: '😄', color: '#3b82f6', bg: '#dbeafe', count: 0 },
      warning:   { label: 'Atenção ao prazo',       emoji: '😅', color: '#f59e0b', bg: '#fef9c3', count: 0 },
      urgent:    { label: 'Cuidado, últimos dias',  emoji: '😰', color: '#f97316', bg: '#ffedd5', count: 0 },
      late:      { label: 'Atrasado! Corra',        emoji: '😡', color: '#ef4444', bg: '#fee2e2', count: 0 },
      waiting:   { label: 'Aguardando início',      emoji: '⏰', color: '#6b7280', bg: '#f3f4f6', count: 0 },
      blocked:   { label: 'Aguardando / Em espera', emoji: '⏳', color: '#8b5cf6', bg: '#ede9fe', count: 0 },
      cancelled: { label: 'Cancelado / Reprovado',  emoji: '🚫', color: '#9ca3af', bg: '#f3f4f6', count: 0 },
      nodate:    { label: 'Sem prazo definido',      emoji: '—',  color: '#d1d5db', bg: '#f9fafb', count: 0 },
    };

    filteredTasks.forEach((t: Task) => {
      const h = getTaskHealth(t);
      if (!h) { buckets.nodate.count++; return; }
      if (h.emoji === '🎉') buckets.done.count++;
      else if (h.emoji === '😄') buckets.ok.count++;
      else if (h.emoji === '😅') buckets.warning.count++;
      else if (h.emoji === '😰') buckets.urgent.count++;
      else if (h.emoji === '😡') buckets.late.count++;
      else if (h.emoji === '⏰') buckets.waiting.count++;
      else if (h.emoji === '⏳') buckets.blocked.count++;
      else if (h.emoji === '🚫') buckets.cancelled.count++;
      else buckets.nodate.count++;
    });

    return Object.values(buckets);
  }, [filteredTasks]);

  const totalWithHealth = filteredTasks.length || 1;

  // --- Status distribution (grupos consolidados — evita torta com 13 fatias) ---
  const STATUS_GROUPS_DASH = [
    { name: '✅ Concluído',    color: '#10b981', test: (s: string) => s.includes('conclu') || s.includes('aprovado') || s.includes('fechado') },
    { name: '⏳ Aguardando',   color: '#8b5cf6', test: (s: string) => s.includes('aguardando') || s.includes('pendente') || s.includes('enviada') || s.includes('em espera') || s.includes('bloqueada') || s.includes('em analise') || s.includes('em análise') },
    { name: '📋 A Fazer',      color: '#6b7280', test: (s: string) => s.includes('a fazer') || s.includes('semana') || s.includes('backlog') || s.includes('todo') },
    { name: '🔄 Em Andamento', color: '#3b82f6', test: (s: string) => s.includes('andamento') || s.includes('progresso') || s.includes('revisão') || s.includes('revisao') || s.includes('em revisão') },
    { name: '🚫 Cancelado',    color: '#ef4444', test: (s: string) => s.includes('cancel') || s.includes('reprova') },
  ];
  const statusData = useMemo(() => {
    return STATUS_GROUPS_DASH.map(g => ({
      name: g.name,
      value: filteredTasks.filter((t: Task) => g.test((t.status || '').toLowerCase())).length,
      color: g.color,
    })).filter(d => d.value > 0);
  }, [filteredTasks]);

  // --- User performance ---
  const userPerformance = useMemo(() =>
    users
      .map((u: User) => {
        const mine = filteredTasks.filter((t: Task) => t.mainAssigneeId === u.id);
        const late = mine.filter((t: Task) => { const h = getTaskHealth(t); return h?.emoji === '😡'; }).length;
        return {
          name: u.name.split(' ')[0],
          fullName: u.name,
          avatar: u.avatar,
          total: mine.length,
          concluidas: mine.filter((t: Task) => isConcluido(t.status)).length,
          atrasadas: late,
        };
      })
      .filter((u: any) => u.total > 0)
      // Ranking por desempenho: quem mais concluiu (primário) → maior taxa (desempate)
      .sort((a: any, b: any) => {
        if (b.concluidas !== a.concluidas) return b.concluidas - a.concluidas;
        const taxaA = a.total > 0 ? a.concluidas / a.total : 0;
        const taxaB = b.total > 0 ? b.concluidas / b.total : 0;
        return taxaB - taxaA;
      })
  , [filteredTasks, users]);

  // --- Priority breakdown ---
  const PRIORITY_CFG = [
    { key: 'URGENTE',        label: '🔴 Urgente',       color: '#ef4444' },
    { key: 'ALTA',           label: '🟠 Alta',           color: '#f97316' },
    { key: 'MÉDIA',          label: '🟡 Média',          color: '#f59e0b' },
    { key: 'BAIXA',          label: '🔵 Baixa',          color: '#3b82f6' },
    { key: 'SEM PRIORIDADE', label: '⚪ Sem prioridade', color: '#9ca3af' },
  ];
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    PRIORITY_CFG.forEach(c => { counts[c.key] = 0; });
    filteredTasks.forEach((t: Task) => {
      const p = (t.priority || 'SEM PRIORIDADE').toUpperCase();
      if (counts[p] !== undefined) counts[p]++;
      else counts['SEM PRIORIDADE']++;
    });
    return PRIORITY_CFG
      .map(c => ({ name: c.label, color: c.color, count: counts[c.key] }))
      .filter(d => d.count > 0);
  }, [filteredTasks]);

  // --- KPI values ---
  const total = filteredTasks.length;
  const concluidas = filteredTasks.filter((t: Task) => isConcluido(t.status)).length;
  const atrasadas = healthBuckets.find(b => b.emoji === '😡')?.count || 0;
  const emDia = healthBuckets.find(b => b.emoji === '😄')?.count || 0;
  const criticas = healthBuckets.find(b => b.emoji === '😰')?.count || 0;
  const aguardando = healthBuckets.find(b => b.emoji === '⏳')?.count || 0;
  const prorrogadas = tasks.filter((t: Task) => (t.extensionCount || 0) > 0).length;
  const taxaConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  // --- Resumo por lista (todos os projetos) — usa allLists (dados globais) ---
  const listSummary = useMemo(() => {
    // Prefere allLists (carregado globalmente) → cai no lists local como fallback
    const availLists = (allLists && allLists.length > 0) ? allLists : (lists || []);
    const map = new Map<string, { name: string; total: number; done: number }>();
    filteredTasks.forEach((t: Task) => {
      if (!t.listId) return;
      const list = availLists.find((l: any) => l.id === t.listId);
      if (!list) return;
      const cur = map.get(t.listId) || { name: list.name, total: 0, done: 0 };
      map.set(t.listId, {
        name: list.name,
        total: cur.total + 1,
        done: cur.done + (isConcluido(t.status) ? 1 : 0)
      });
    });
    return Array.from(map.values())
      .filter(l => l.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredTasks, lists, allLists]);

  // --- Atividade recente (últimas mudanças de status — usa tasks completo, não filtrado por período) ---
  const recentActivity = useMemo(() => {
    const acts: { taskTitle: string; type: string; newValue: string; createdAt: string }[] = [];
    tasks.forEach((t: Task) => {
      (t.activities || []).forEach((a: any) => {
        if (a.type === 'status_changed') {
          acts.push({ taskTitle: t.title, type: a.type, newValue: a.newValue, createdAt: a.createdAt });
        }
      });
    });
    return acts
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [tasks]);

  return (
    <div className="flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>

      {/* ── Period Filter ── */}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs text-gray-400 font-medium">Período:</span>
        {([['7d','7 dias'],['30d','30 dias'],['90d','90 dias'],['all','Todos']] as [PeriodKey, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`px-3 py-1 text-xs rounded-full font-semibold transition-all border ${period === k ? 'bg-[var(--primary-color)] text-gray-800 border-[var(--primary-color)]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
          >{l}</button>
        ))}
      </div>

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { emoji: '📋', title: 'Total', value: total, sub: 'tarefas no workspace', bg: 'bg-blue-50', text: 'text-blue-700' },
          { emoji: '🎉', title: 'Concluídas', value: concluidas, sub: `${taxaConclusao}% do total`, bg: 'bg-green-50', text: 'text-green-700' },
          { emoji: '😡', title: 'Atrasadas', value: atrasadas, sub: 'passaram do prazo', bg: 'bg-red-50', text: 'text-red-700' },
          { emoji: '😄', title: 'Em Dia', value: emDia, sub: 'dentro do prazo', bg: 'bg-sky-50', text: 'text-sky-700' },
          { emoji: '⏳', title: 'Aguardando', value: aguardando, sub: 'em espera / bloqueadas', bg: 'bg-purple-50', text: 'text-purple-700' },
          { emoji: '⚠️', title: 'Prorrogadas', value: prorrogadas, sub: 'tiveram extensão de prazo', bg: 'bg-yellow-50', text: 'text-yellow-700' },
        ].map(k => (
          <div key={k.title} className={`${k.bg} rounded-xl p-4 border border-white shadow-sm flex flex-col gap-1 hover:scale-[1.03] transition-transform`}>
            <span className="text-2xl">{k.emoji}</span>
            <p className={`text-2xl font-black ${k.text}`}>{k.value}</p>
            <p className="text-xs font-bold text-gray-600">{k.title}</p>
            <p className="text-[10px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Row 2: Health Radar (full width) ── */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h3 className="font-bold text-gray-700 mb-5 flex items-center gap-2 text-base">
          🩺 Radar de Saúde das Tarefas
          <span className="ml-auto text-xs text-gray-400 font-normal">{total} tarefa{total !== 1 ? 's' : ''} · {period === 'all' ? 'todos os tempos' : `últimos ${period.replace('d',' dias')}`}</span>
        </h3>
        <div className="flex flex-col gap-3">
          {healthBuckets.filter(b => b.count > 0).map(b => {
            const pct = Math.round((b.count / totalWithHealth) * 100);
            return (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xl w-7 shrink-0 text-center">{b.emoji}</span>
                <span className="text-xs font-medium text-gray-600 w-44 shrink-0">{b.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                    style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: b.color }}
                  >
                    <span className="text-[10px] font-bold text-white">{pct > 8 ? `${pct}%` : ''}</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-700 w-12 text-right shrink-0">{b.count} tarefa{b.count !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 3: Performance + Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
          <h3 className="font-bold text-gray-700 mb-5 flex items-center gap-2">
            👥 Performance por Usuário
            <span className="ml-auto text-xs text-gray-400 font-normal">{userPerformance.length} membro{userPerformance.length !== 1 ? 's' : ''} ativos</span>
          </h3>
          {userPerformance.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">Nenhum usuário com tarefas no período.</div>
          ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={userPerformance} barGap={4} barCategoryGap={userPerformance.length === 1 ? '60%' : '20%'}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(val: any, name: string) => [val, name === 'total' ? 'Total' : name === 'concluidas' ? 'Concluídas' : 'Atrasadas']}
                />
                <Bar dataKey="total" fill={primaryChartColor} radius={[4,4,0,0]} name="total" />
                <Bar dataKey="concluidas" fill="#10b981" radius={[4,4,0,0]} name="concluidas" />
                <Bar dataKey="atrasadas" fill="#ef4444" radius={[4,4,0,0]} name="atrasadas" />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
          )}
          {userPerformance.length > 0 && (
            <div className="flex items-center gap-5 mt-3 justify-center">
              {[[primaryChartColor, 'Total'], ['#10b981', 'Concluídas'], ['#ef4444', 'Atrasadas']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: c }} />{l}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 mb-5">🎯 Distribuição de Status</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {statusData.map((d: any, i: number) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any, name: string) => [val, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {statusData.map((d: any) => {
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
              return (
                <div key={d.name} className="flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="truncate max-w-[130px]">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-400">{pct}%</span>
                    <span className="font-bold w-8 text-right">{d.value}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 4: Priority breakdown + Team Ranking ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 mb-5">🔥 Distribuição por Prioridade</h3>
          <div className="flex flex-col gap-4">
            {priorityData.map(p => {
              const pct = Math.round((p.count / (total || 1)) * 100);
              return (
                <div key={p.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-700">{p.name}</span>
                    <span className="text-gray-400">{pct}% · <span className="font-bold text-gray-700">{p.count}</span> tarefas</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                      style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: p.color }}>
                      {pct > 10 && <span className="text-[10px] font-bold text-white">{pct}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Nota de contexto */}
          <p className="text-[10px] text-gray-400 mt-5 text-center">Baseado em {total} tarefas do workspace</p>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 mb-1">🏆 Ranking da Equipe</h3>
          <p className="text-[10px] text-gray-400 mb-4">Ordenado por tarefas concluídas</p>
          <div className="flex flex-col gap-2">
            {userPerformance.slice(0, 7).map((u: any, i: number) => {
              const taxa = u.total > 0 ? Math.round((u.concluidas / u.total) * 100) : 0;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
              const barColor = taxa >= 80 ? '#10b981' : taxa >= 50 ? '#3b82f6' : taxa >= 30 ? '#f59e0b' : '#ef4444';
              return (
                <div key={u.fullName} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-base w-7 text-center shrink-0">{medal}</span>
                  <img src={u.avatar || `https://picsum.photos/seed/${u.fullName}/100`} className="w-7 h-7 rounded-full border shrink-0" alt={u.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{u.fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${taxa}%`, backgroundColor: barColor }} />
                      </div>
                      <span className="text-[10px] font-bold shrink-0" style={{ color: barColor }}>{taxa}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-gray-700">{u.concluidas}<span className="text-gray-400 font-normal">/{u.total}</span></p>
                    {u.atrasadas > 0 && <p className="text-[10px] text-red-500">😡 {u.atrasadas}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 5: Resumo por Lista + Atividade Recente ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Resumo por lista/projeto */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 mb-5">📁 Resumo por Lista / Projeto</h3>
          {listSummary.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma tarefa com lista atribuída.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {listSummary.map(l => {
                const pct = l.total > 0 ? Math.round((l.done / l.total) * 100) : 0;
                return (
                  <div key={l.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-600 w-36 shrink-0 truncate" title={l.name}>{l.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: pct === 100 ? '#10b981' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f59e0b' : '#ef4444' }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-10 text-right shrink-0">{pct}%</span>
                    <span className="text-[10px] text-gray-400 w-14 text-right shrink-0">{l.done}/{l.total}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Atividade recente */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 mb-5">⚡ Atividade Recente</h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma atividade registrada no período.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentActivity.map((a, i) => {
                const statusColor = (a.newValue || '').toLowerCase().includes('conclu') ? '#10b981'
                  : (a.newValue || '').toLowerCase().includes('andamento') ? '#3b82f6'
                  : (a.newValue || '').toLowerCase().includes('cancel') ? '#6b7280'
                  : '#f59e0b';
                const dt = new Date(a.createdAt);
                const label = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
                    <p className="flex-1 text-xs text-gray-700 truncate" title={a.taskTitle}>{a.taskTitle}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 text-white" style={{ backgroundColor: statusColor }}>
                      {a.newValue}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fonte dos dados */}
      <p className="text-center text-[10px] text-gray-300 pb-2">
        Dashboard global · {total} tarefas · dados em tempo real do Supabase
      </p>
    </div>
  );
}

function CreateTaskModal({ onClose, onCreate, users, spaces, folders, lists, initialScope, activeListId, currentUser, prefilledData, additionalTasks, statusGroups }: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIA);
  const [mainAssigneeId, setMainAssigneeId] = useState(currentUser.id);
  const [secondaryAssigneeIds, setSecondaryAssigneeIds] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [dueDate, setDueDate] = useState('');
  const todayLabel = new Date().toLocaleDateString('pt-BR');

  const handleStartOrDurationChange = (newStart: string, newDuration: string) => {
    if (!newStart || !newDuration.trim()) return;
    const isHours = /^\d+(\.\d+)?\s*h$/i.test(newDuration.trim());
    const numericValue = parseFloat(newDuration);
    if (isNaN(numericValue) || numericValue <= 0) return;
    // newStart é "YYYY-MM-DD" (sem hora); `new Date(newStart)` interpreta
    // isso como meia-noite UTC, o que em fusos atrás de UTC (ex: Brasil)
    // faz `getDate()`/`setDate()` operarem no dia anterior. Usamos o parser
    // local do app para não perder um dia no cálculo da data limite.
    const d = parseLocalDate(newStart);
    if (isHours) {
      // Horas: mantém o mesmo dia da data de início
      setDueDate(newStart);
    } else {
      // Dias: soma à data de início
      d.setDate(d.getDate() + Math.round(numericValue));
      setDueDate(formatLocalDate(d));
    }
  };

  // Hierarchy Selection State
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedListId, setSelectedListId] = useState<string>('');

  // Prazo pré-preenchido (ex: ao clicar num dia no Calendário). Continua
  // editável até o usuário informar início/duração, que aí recalcula e
  // sobrescreve esse valor.
  useEffect(() => {
    if (prefilledData?.dueDate) setDueDate(prefilledData.dueDate);
  }, [prefilledData?.dueDate]);

  // Initialize selection based on current scope or prefilled data
  useEffect(() => {
    if (prefilledData?.parentId) {
      // Tenta achar a tarefa pai em additionalTasks; usa prefilledData.listId como fallback direto
      const parentTask = additionalTasks.find((t: Task) => t.id === prefilledData.parentId);
      const resolvedListId = parentTask?.listId || prefilledData.listId || '';
      if (resolvedListId) {
        setSelectedListId(resolvedListId);
        // Tenta resolver space/folder para o dropdown visual (não bloqueia o salvamento)
        const list = lists.find((l: List) => l.id === resolvedListId);
        if (list) {
          const folder = folders.find((f: Folder) => f.id === list.folderId);
          if (folder) {
            setSelectedSpaceId(folder.spaceId);
            setSelectedFolderId(folder.id);
          }
        }
      }
    } else if (activeListId) {
      // Se há uma lista ativa selecionada na sidebar, usá-la diretamente
      const list = lists.find((l: List) => l.id === activeListId);
      if (list) {
        const folder = folders.find((f: Folder) => f.id === list.folderId);
        if (folder) {
          setSelectedSpaceId(folder.spaceId);
          setSelectedFolderId(folder.id);
          setSelectedListId(activeListId);
        }
      }
    } else if (initialScope.type === 'space') {
      setSelectedSpaceId(initialScope.id || '');
    } else if (initialScope.type === 'folder') {
      // Need to find spaceId for this folder
      const folder = folders.find((f: Folder) => f.id === initialScope.id);
      if (folder) {
        setSelectedSpaceId(folder.spaceId);
        setSelectedFolderId(folder.id);
      }
    }
  }, [initialScope, folders, prefilledData, additionalTasks, lists, activeListId]);

  // Derived Options
  const availableFolders = useMemo(() => folders.filter((f: Folder) => f.spaceId === selectedSpaceId), [folders, selectedSpaceId]);
  const availableLists = useMemo(() => lists.filter((l: List) => l.folderId === selectedFolderId), [lists, selectedFolderId]);

  // NÃO auto-selecionamos o primeiro espaço: no escopo global isso apontava para
  // um espaço REAL (ex.: SUPRIMENTOS) e o usuário podia criar tarefa em produção
  // sem perceber. O espaço só é pré-selecionado quando vem de um contexto explícito
  // (lista/pasta/espaço ativos ou subtarefa) — ver o efeito de inicialização acima.

  // Auto-select primeira pasta disponível quando nenhuma está selecionada
  // (só dispara após um espaço ter sido escolhido deliberadamente)
  useEffect(() => {
    if (availableFolders.length > 0 && !selectedFolderId) {
      setSelectedFolderId(availableFolders[0].id);
    }
  }, [availableFolders, selectedFolderId]);

  // Auto-select primeira lista disponível quando nenhuma está selecionada
  useEffect(() => {
    if (availableLists.length > 0 && !selectedListId) {
      setSelectedListId(availableLists[0].id);
    }
  }, [availableLists, selectedListId]);

  const currentStatusOptions = useMemo(() => {
    const list = lists.find((l: List) => l.id === selectedListId);
    if (!list) return [];
    const group = statusGroups.find((g: StatusGroup) => g.id === list.statusGroupId) || statusGroups[0];
    return group?.options || [];
  }, [selectedListId, lists, statusGroups]);

  useEffect(() => {
    if (currentStatusOptions.length > 0 && !status) {
      setStatus(currentStatusOptions[0].label);
    } else if (currentStatusOptions.length > 0 && !currentStatusOptions.find(o => o.label === status)) {
      // Se a lista mudou e o status atual não existe na nova lista, resetar para o primeiro
      setStatus(currentStatusOptions[0].label);
    }
  }, [currentStatusOptions, status]);

  const handleSubmit = () => {
    if (!title) {
      toast.error('Informe o nome da tarefa.');
      return;
    }

    // Se uma pasta foi escolhida mas não existe lista, direcionamos o usuário a criar uma lista primeiro.
    if (selectedFolderId && availableLists.length === 0) {
      toast.error('Esta pasta ainda não tem listas. Crie uma lista na sidebar e depois crie a tarefa.');
      return;
    }

    if (!selectedListId) {
      toast.error('Selecione um Espaço, Pasta e Lista antes de criar a tarefa.');
      return;
    }

    onCreate({
      title,
      description,
      status,
      priority,
      mainAssigneeId,
      secondaryAssigneeIds,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      listId: selectedListId,
      parentId: prefilledData?.parentId
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[90vh]">
        <div className="p-6 border-b flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              {prefilledData?.parentId ? 'Adicionar Subtarefa' : 'Criar Nova Tarefa'}
            </h3>
            {prefilledData?.parentId && (
              <p className="text-xs text-gray-500 mt-1">
                Tarefa Superior: <span className="font-semibold">{additionalTasks.find((t: Task) => t.id === prefilledData.parentId)?.title}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
          {/* Hierarchy Selection */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border ${!selectedListId ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
            {!selectedListId && (
              <div className="sm:col-span-2 flex items-center gap-2 text-amber-700 text-xs font-semibold mb-1">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Selecione Espaço → Pasta → Lista para habilitar a criação
              </div>
            )}
            <div>
              <label className={`text-xs font-bold uppercase ${!selectedSpaceId ? 'text-amber-600' : 'text-gray-400'}`}>Espaço *</label>
              <select
                className={`w-full p-2 border rounded mt-1 text-sm bg-white focus:ring-2 focus:ring-[var(--primary-color)] outline-none ${!selectedSpaceId ? 'border-amber-300' : ''}`}
                value={selectedSpaceId}
                onChange={(e) => { setSelectedSpaceId(e.target.value); setSelectedFolderId(''); setSelectedListId(''); }}
              >
                <option value="">Selecione...</option>
                {spaces.map((s: Space) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={`text-xs font-bold uppercase ${selectedSpaceId && !selectedFolderId ? 'text-amber-600' : 'text-gray-400'}`}>Pasta *</label>
              <select
                className={`w-full p-2 border rounded mt-1 text-sm bg-white focus:ring-2 focus:ring-[var(--primary-color)] outline-none ${selectedSpaceId && !selectedFolderId ? 'border-amber-300' : ''}`}
                value={selectedFolderId}
                onChange={(e) => { setSelectedFolderId(e.target.value); setSelectedListId(''); }}
                disabled={!selectedSpaceId}
              >
                <option value="">Selecione...</option>
                {availableFolders.map((f: Folder) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={`text-xs font-bold uppercase ${selectedFolderId && !selectedListId ? 'text-amber-600' : 'text-gray-400'}`}>Lista *</label>
              <select
                className={`w-full p-2 border rounded mt-1 text-sm bg-white focus:ring-2 focus:ring-[var(--primary-color)] outline-none ${selectedFolderId && !selectedListId ? 'border-amber-300' : ''}`}
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                disabled={!selectedFolderId || availableLists.length === 0}
              >
                <option value="">Selecione uma lista...</option>
                {availableLists.map((l: List) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Nome da Tarefa</label>
              <input
                type="text"
                className="w-full p-3 border rounded-lg mt-1 text-lg font-medium focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="O que precisa ser feito?"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                <select
                  className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {currentStatusOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Prioridade</label>
                <select
                  className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Responsáveis</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold mb-1">Principal</p>
                    <select
                      className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                      value={mainAssigneeId}
                      onChange={(e) => setMainAssigneeId(e.target.value)}
                    >
                      {[...users].sort((a: User, b: User) => a.name.localeCompare(b.name, 'pt-BR')).map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold mb-1">Adicionais</p>
                    <input
                      type="text"
                      value={assigneeSearch}
                      onChange={e => setAssigneeSearch(e.target.value)}
                      placeholder="Pesquisar..."
                      className="w-full text-xs border rounded px-2 py-1 mb-1 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)]"
                    />
                    <div className="max-h-32 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1 custom-scrollbar">
                      {users
                        .filter((u: User) => u.id !== mainAssigneeId)
                        .filter((u: User) => u.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                        .sort((a: User, b: User) => a.name.localeCompare(b.name, 'pt-BR'))
                        .map((u: User) => (
                          <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white p-1 rounded">
                            <input
                              type="checkbox"
                              checked={secondaryAssigneeIds.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSecondaryAssigneeIds([...secondaryAssigneeIds, u.id]);
                                else setSecondaryAssigneeIds(secondaryAssigneeIds.filter(id => id !== u.id));
                              }}
                              className="rounded text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                            />
                            {u.name}
                          </label>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Data de Início</label>
                  <input
                    type="date"
                    className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      handleStartOrDurationChange(e.target.value, duration);
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Duração (dias ou horas)</label>
                  <input
                    type="text"
                    placeholder="Ex: 5 ou 3h"
                    className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                    value={duration}
                    onChange={(e) => {
                      setDuration(e.target.value);
                      handleStartOrDurationChange(startDate, e.target.value);
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Data Limite</label>
                <input
                  type="date"
                  className="w-full p-2 border rounded mt-1 text-sm bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                  value={dueDate}
                  readOnly
                />
                <p className="text-[10px] text-gray-400 mt-1">Calculada automaticamente a partir da data de início + duração</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Criada em</label>
                <p className="mt-1 text-sm text-gray-500 border rounded p-2 bg-gray-50">{todayLabel}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
              <textarea
                className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Adicione detalhes..."
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!title}
            className="px-6 py-2 bg-[var(--primary-color)] text-[#2c3e50] font-bold rounded shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Criar Tarefa
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal(props: any) {
  const {
    task,
    users,
    onClose,
    onUpdate,
    currentUser,
    customFields,
    fieldValues,
    onUpdateFieldValue,
    onDelete,
    onDuplicate,
    tasks,
    onSelectTask,
    onQuickCreate,
    isReadOnly = false,
    saveAttachment,
    removeAttachment: removeTaskAttachment,
    saveComment,
    editComment,
    deleteComment,
    toggleWatcher,
    saveExtensionLog,
    saveTaskActivity,
    uploadFile,
    statusGroups,
    lists,
    folders,
    workspaceId,
    onTagsChange,
    teams = [],
  } = props;

  const currentList = lists?.find((l: any) => l.id === task.listId);
  const currentFolder = folders?.find((f: any) => f.id === currentList?.folderId);
  const statusGroup = statusGroups?.find((g: any) => g.id === currentList?.statusGroupId) || statusGroups?.[0];
  const statusOptions = statusGroup?.options || [];

  const getStatusStyle = (statusLabel: string) => {
    const sLower = (statusLabel || '').toLowerCase();
    const opt = statusOptions.find((o: any) => o.label?.toLowerCase() === sLower);

    if (opt?.color) {
      return {
        backgroundColor: opt.color,
        color: '#ffffff',
        border: `1px solid ${opt.color}`
      };
    }

    if (sLower.includes('conclu') || sLower.includes('fechado') || sLower.includes('aprovado')) return { backgroundColor: '#dcfce7', color: '#15803d' };
    if (sLower.includes('espera') || sLower.includes('aguarda') || sLower.includes('pendente')) return { backgroundColor: '#fef9c3', color: '#a16207' };
    if (sLower.includes('andamento') || sLower.includes('progresso')) return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
    if (sLower.includes('cancel') || sLower.includes('repro') || sLower.includes('risco')) return { backgroundColor: '#fee2e2', color: '#b91c1c' };

    return { backgroundColor: '#f1f5f9', color: '#475569' };
  };

  // Renamed to avoid shadowing
  const [detailActiveTab, setDetailActiveTab] = useState<'info' | 'history' | 'checklist' | 'attachments' | 'custom' | 'subtasks' | 'dependencies' | 'watchers'>('info');
  const [newDueDate, setNewDueDate] = useState(task.dueDate);
  const [extensionReason, setExtensionReason] = useState('');
  const [isExtending, setIsExtending] = useState(false);
  const [isSavingExtension, setIsSavingExtension] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newComment, setNewComment] = useState('');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [description, setDescription] = useState(task.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [showActivityStats, setShowActivityStats] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'history'>('all');
  const [showActivitySearch, setShowActivitySearch] = useState(false);
  const [activitySearchQuery, setActivitySearchQuery] = useState('');

  const unifiedTimeline = useMemo(() => {
    const all = [
      ...(task.comments || []).map((c: any) => ({ ...c, unifiedType: 'COMMENT', date: c.timestamp })),
      ...(task.activities || []).map((a: any) => ({ ...a, unifiedType: 'ACTIVITY', date: a.createdAt || a.date })),
      ...(task.extensionHistory || []).map((e: any) => ({ ...e, unifiedType: 'EXTENSION', date: e.timestamp }))
    ];
    if (task.createdAt) {
      all.push({
        id: 'creation',
        unifiedType: 'CREATION',
        date: task.createdAt,
        text: 'Logística criou esta tarefa' // Default text
      });
    }
    return all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [task.comments, task.activities, task.extensionHistory, task.createdAt]);

  // Texto pesquisável de cada item da timeline (usado pela lupa de busca)
  const getTimelineItemText = (item: any): string => {
    const userName = users.find((u: any) => u.id === (item.userId || item.updatedBy))?.name || '';
    switch (item.unifiedType) {
      case 'COMMENT':
        return `${userName} ${item.text || ''}`;
      case 'ACTIVITY':
        return `${userName} ${item.type || ''} ${item.oldValue || ''} ${item.newValue || ''}`;
      case 'EXTENSION':
        return `${userName} ${item.reason || ''} ${item.newDate || ''} ${item.oldDate || ''}`;
      case 'CREATION':
        return item.text || '';
      default:
        return '';
    }
  };

  const visibleTimeline = useMemo(() => {
    let result = unifiedTimeline;
    if (activityFilter === 'history') {
      result = result.filter((item: any) => item.unifiedType !== 'COMMENT');
    }
    const q = activitySearchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((item: any) => getTimelineItemText(item).toLowerCase().includes(q));
    }
    return result;
  }, [unifiedTimeline, activityFilter, activitySearchQuery, users]);

  const activityStats = useMemo(() => {
    const activities = task.activities || [];
    const statusChanges = activities.filter((a: any) => a.type === 'STATUS_CHANGE').length;
    const priorityChanges = activities.filter((a: any) => a.type === 'PRIORITY_CHANGE').length;
    const assigneeChanges = activities.filter((a: any) =>
      ['MAIN_RESPONSIBLE_CHANGE', 'RESPONSIBLE_ADDED', 'RESPONSIBLE_REMOVED', 'TEAM_ASSIGNED'].includes(a.type)
    ).length;
    const extensions = (task.extensionHistory || []).length;
    const comments = (task.comments || []).length;
    const daysOpen = task.createdAt
      ? Math.max(0, Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 86400000))
      : null;
    return { statusChanges, priorityChanges, assigneeChanges, extensions, comments, daysOpen };
  }, [task.activities, task.extensionHistory, task.comments, task.createdAt]);

  const formatDate = (date: string) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(' de ', ' ').replace('.', '');
  };

  const taskCustomFields = useMemo(() => {
    return (customFields || []).filter((f: CustomField) =>
      f.target === 'TASK' && f.visibleTo.includes(currentUser.role)
    );
  }, [customFields, currentUser.role]);

  // Registro de atividade é auxiliar (histórico/auditoria) — nunca deve impedir
  // a mudança real (status, prioridade, responsável) de acontecer. Antes, uma
  // falha aqui (rede, RLS, etc.) travava silenciosamente o onUpdate() seguinte:
  // o usuário clicava numa opção e "nada acontecia", sem nenhum erro visível.
  const logActivitySafe = async (...args: Parameters<NonNullable<typeof saveTaskActivity>>) => {
    if (!saveTaskActivity) return;
    try {
      await saveTaskActivity(...args);
    } catch (err) {
      console.error('Falha ao registrar atividade (não bloqueia a atualização):', err);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (status === task.status) return;
    onUpdate({ ...task, status });
    logActivitySafe(task.id, 'STATUS_CHANGE', task.status, status);
  };

  const handleUpdatePriority = async (priority: TaskPriority) => {
    if (priority === task.priority) return;
    onUpdate({ ...task, priority });
    logActivitySafe(task.id, 'PRIORITY_CHANGE', task.priority, priority);
  };

  const handleToggleSecondaryAssignee = async (userId: string) => {
    const isMain = task.mainAssigneeId === userId;
    if (isMain) return; // Can't remove main this way

    const isSecondary = (task.secondaryAssigneeIds || []).includes(userId);
    let nextSecondaryIds = [...(task.secondaryAssigneeIds || [])];

    if (isSecondary) {
      nextSecondaryIds = nextSecondaryIds.filter(id => id !== userId);
      logActivitySafe(task.id, 'RESPONSIBLE_REMOVED', users.find((u: any) => u.id === userId)?.name);
    } else {
      nextSecondaryIds.push(userId);
      logActivitySafe(task.id, 'RESPONSIBLE_ADDED', '', users.find((u: any) => u.id === userId)?.name);
      notifyAssignment({ userIds: [userId], actor: currentUser, taskId: task.id, taskTitle: task.title });
    }

    onUpdate({ ...task, secondaryAssigneeIds: nextSecondaryIds });
  };

  // Atribui uma Equipe inteira como responsáveis adicionais (estilo ClickUp Teams)
  const handleAssignTeam = async (team: Team) => {
    const current = new Set<string>(task.secondaryAssigneeIds || []);
    const newIds = team.memberIds.filter((id: string) => id !== task.mainAssigneeId && !current.has(id));
    if (newIds.length === 0) {
      toast.info(`Todos da equipe ${team.name} já estão na tarefa.`);
      return;
    }
    notifyAssignment({ userIds: newIds, actor: currentUser, taskId: task.id, taskTitle: task.title, teamName: team.name });
    onUpdate({ ...task, secondaryAssigneeIds: [...(task.secondaryAssigneeIds || []), ...newIds] });
    logActivitySafe(task.id, 'TEAM_ASSIGNED', '', team.name);
  };

  const handleSetMainAssignee = async (userId: string) => {
    if (task.mainAssigneeId === userId) return;

    const oldMainName = users.find((u: any) => u.id === task.mainAssigneeId)?.name;
    const newMainName = users.find((u: any) => u.id === userId)?.name;

    // Move current main to secondary if not already there, and remove new main from secondary
    let nextSecondaryIds = (task.secondaryAssigneeIds || []).filter(id => id !== userId);
    if (!nextSecondaryIds.includes(task.mainAssigneeId)) {
      nextSecondaryIds.push(task.mainAssigneeId);
    }

    notifyAssignment({ userIds: [userId], actor: currentUser, taskId: task.id, taskTitle: task.title });
    onUpdate({ ...task, mainAssigneeId: userId, secondaryAssigneeIds: nextSecondaryIds });
    logActivitySafe(task.id, 'MAIN_RESPONSIBLE_CHANGE', oldMainName, newMainName);
  };

  const handleSaveDueDate = async () => {
    if (!newDueDate) {
      toast.warning('Selecione uma nova data de vencimento.');
      return;
    }
    if (newDueDate === task.dueDate) {
      toast.warning('A nova data é igual à data atual. Escolha uma data diferente.');
      return;
    }
    if (!extensionReason.trim()) {
      toast.warning('Informe uma justificativa para alterar o prazo.');
      return;
    }

    setIsSavingExtension(true);
    try {
      const log: ExtensionLog = {
        id: Math.random().toString(36).substr(2, 9),
        oldDate: task.dueDate,
        newDate: newDueDate,
        reason: extensionReason.trim(),
        updatedBy: currentUser.id,
        timestamp: new Date().toISOString()
      };

      // Salva o log de extensão — falha silenciosa não bloqueia o update da tarefa
      if (saveExtensionLog) {
        try {
          await saveExtensionLog(task.id, log);
        } catch (logErr) {
          console.warn('Falha ao salvar log de extensão (não crítico):', logErr);
        }
      }

      // Atualiza a tarefa com nova data e contador
      const ok = await onUpdate({
        ...task,
        dueDate: newDueDate,
        extensionCount: (task.extensionCount || 0) + 1,
        extensionHistory: [log, ...(task.extensionHistory || [])]
      });

      // updateTask retorna false em caso de erro (e já mostra toast de erro)
      if (ok !== false) {
        toast.success('Prazo alterado com sucesso!');
        setIsExtending(false);
        setExtensionReason('');
      }
    } catch (err: any) {
      console.error('Erro ao alterar prazo:', err);
      toast.error('Erro ao alterar prazo: ' + (err?.message || 'tente novamente.'));
    } finally {
      setIsSavingExtension(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Copia a FileList ANTES de limpar o input: event.target.files é uma
    // lista "viva" — zerar o value esvazia a própria lista, e iterar depois
    // não encontraria nenhum arquivo (upload silenciosamente não acontecia).
    const files = Array.from(event.target.files || []);
    // Permite selecionar o mesmo arquivo novamente após uma falha
    event.target.value = '';
    if (files.length === 0) return;

    for (const file of files) {
      if (uploadFile && saveAttachment) {
        try {
          const safeName = file.name.replace(/[^\w.\-]/g, '_');
          const path = `tasks/${task.id}/${Date.now()}_${safeName}`;
          const url = await uploadFile(file, path, 'task-files');
          if (url) {
            const saved = await saveAttachment(task.id, {
              name: file.name,
              url,
              type: file.type,
              size: file.size
            });
            if (saved !== false) {
              toast.success(`Anexo "${file.name}" enviado.`);
            }
          }
        } catch (err: any) {
          console.error('Erro ao anexar arquivo:', err);
          toast.error(`Falha ao anexar "${file.name}"${err?.message ? `: ${err.message}` : '.'}`);
        }
      }
    }
  };

  const removeAttachment = (id: string) => {
    if (removeTaskAttachment) {
      removeTaskAttachment(task.id, id);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    if (saveComment) {
      const text = newComment;
      const success = await saveComment(task.id, text);
      if (success) {
        setNewComment('');
        // Notifica usuários e Equipes mencionados com @ (fire-and-forget)
        notifyMentions({
          text,
          taskId: task.id,
          taskTitle: task.title,
          actor: currentUser,
          users: users || [],
          teams,
        });
      }
    }
  };

  const handleAddLink = async () => {
    const url = window.prompt("Digite o URL do link:");
    if (url && saveAttachment) {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      await saveAttachment(task.id, {
        name: url,
        url: fullUrl,
        type: 'link',
        size: 0
      });
    }
  };

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
      <div className="relative bg-white w-full max-w-[1280px] h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        {showAIPanel && (
          <AIPanel
            context={[
              `Título: ${task.title}`,
              `Status: ${task.status} | Prioridade: ${task.priority}`,
              task.startDate ? `Início: ${parseLocalDate(task.startDate).toLocaleDateString('pt-BR')}` : '',
              task.dueDate ? `Prazo: ${parseLocalDate(task.dueDate).toLocaleDateString('pt-BR')}` : '',
              `Responsável: ${users?.find((u: User) => u.id === task.mainAssigneeId)?.name || 'Sem responsável'}`,
              (task.secondaryAssigneeIds || []).length > 0
                ? `Acompanhantes: ${(task.secondaryAssigneeIds || []).map((id: string) => users?.find((u: User) => u.id === id)?.name).filter(Boolean).join(', ')}`
                : '',
              task.extensionCount ? `Prorrogações de prazo: ${task.extensionCount}x` : '',
              `\nDescrição:\n${task.description || '(sem descrição)'}`,
              tasks.filter((t: any) => t.parentId === task.id).length > 0
                ? `\nSubtarefas:\n${tasks.filter((t: any) => t.parentId === task.id).map((s: any) => `- [${s.status}] ${s.title}`).join('\n')}`
                : '',
              (task.checklists || []).length > 0
                ? `\nItens de ação:\n${(task.checklists || []).map((c: ChecklistItem) => `- [${c.completed ? 'x' : ' '}] ${c.text}`).join('\n')}`
                : '',
              (task.comments || []).length > 0
                ? `\nComentários (do mais antigo ao mais novo):\n${(task.comments || []).map((c: any) => `${users?.find((u: User) => u.id === c.userId)?.name || 'Alguém'}: ${c.text}`).join('\n')}`
                : '',
            ].filter(Boolean).join('\n')}
            onClose={() => setShowAIPanel(false)}
          />
        )}
        <div className="p-4 border-b shrink-0 flex items-center justify-between bg-white px-8">
          <div className="flex items-center gap-4">
            <div className="text-gray-400 p-1 hover:bg-gray-100 rounded cursor-pointer">
              <Icons.ChevronRight className="w-5 h-5 rotate-180" />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
              <span>VerticalParts</span>
              <span>/</span>
              <span>{currentFolder?.name || currentList?.name || 'Sem projeto'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}?taskId=${task.id}`;
                navigator.clipboard.writeText(url);
                alert('Link da tarefa copiado!');
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 text-gray-500 text-sm font-medium rounded-lg transition-all"
            >
              <LinkIcon className="w-4 h-4" /> Compartilhar
            </button>
            {!isReadOnly && onDuplicate && (
              <button
                onClick={() => onDuplicate(task)}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 text-gray-500 hover:text-blue-600 text-sm font-medium rounded-lg transition-all"
                title="Duplicar tarefa"
              >
                <Copy className="w-4 h-4" /> Duplicar
              </button>
            )}
            {!isReadOnly && onDelete && (
              <button onClick={onDelete} className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors" title="Excluir Tarefa">
                <Icons.Trash />
              </button>
            )}
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 text-gray-400 rounded-lg transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Content (Left) */}
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-white">
            <div className="p-8 pb-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-500 uppercase">
                  <Icons.Check className="w-3 h-3" /> Tarefa
                </div>
                <span className="text-gray-300 text-sm font-medium">{task.id.slice(0, 8)}</span>
                <button
                  onClick={() => setShowAIPanel(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 font-bold text-xs rounded transition-colors ml-2 ${showAIPanel ? 'bg-purple-100 text-purple-700' : 'text-purple-600 hover:bg-purple-50'}`}
                >
                  ✨ Pergunte à IA
                </button>
              </div>

              {editingTitle && !isReadOnly ? (
                <input
                  className="text-3xl font-bold text-gray-900 mb-4 leading-tight w-full border-b-2 border-orange-400 outline-none bg-transparent"
                  value={titleDraft}
                  autoFocus
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    setEditingTitle(false);
                    if (titleDraft.trim() && titleDraft !== task.title) {
                      onUpdate({ ...task, title: titleDraft.trim() }).then((ok: boolean) => {
                        if (ok) toast.success('Título atualizado.');
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.currentTarget.blur(); }
                    if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); }
                  }}
                />
              ) : (
                <h2
                  className={`text-3xl font-bold text-gray-900 mb-4 leading-tight ${!isReadOnly ? 'cursor-text hover:text-orange-700 transition-colors group' : ''}`}
                  onClick={() => { if (!isReadOnly) { setTitleDraft(task.title); setEditingTitle(true); } }}
                  title={!isReadOnly ? 'Clique para renomear' : undefined}
                >
                  {task.title}
                  {!isReadOnly && <span className="inline-block ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-sm text-orange-400">✏️</span>}
                </h2>
              )}

              {/* Health Banner */}
              {(() => {
                const isOwner = currentUser?.id === task.mainAssigneeId;
                const isPrivileged = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.GESTOR;
                if (!isOwner && !isPrivileged) return null;
                const h = getTaskHealth(task);
                if (!h) return null;
                const assignee = users?.find((u: User) => u.id === task.mainAssigneeId);
                const name = assignee?.name || 'Responsável';
                return (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 ${h.bg} ${h.border}`}>
                    <span className="text-2xl">{h.emoji}</span>
                    <div>
                      <p className={`text-sm font-semibold ${h.text}`}>{name} está: {h.label}</p>
                      {task.dueDate && (
                        <p className={`text-xs mt-0.5 ${h.text} opacity-75`}>
                          Prazo: {parseLocalDate(task.dueDate).toLocaleDateString('pt-BR')}
                          {task.startDate && ` · Início: ${parseLocalDate(task.startDate).toLocaleDateString('pt-BR')}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-y-6 gap-x-12 mb-12">
                <div className="flex items-center gap-8">
                  <span className="w-24 text-sm font-medium text-gray-400">Status</span>
                  {!isReadOnly ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div
                          className="px-3 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer hover:brightness-95"
                          style={getStatusStyle(task.status)}
                        >
                          {task.status}
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {statusOptions.map((opt: any) => (
                          <DropdownMenuItem key={opt.id} onClick={() => handleUpdateStatus(opt.label)}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                              {opt.label}
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div
                      className="px-3 py-1 rounded text-[10px] font-bold uppercase transition-all"
                      style={getStatusStyle(task.status)}
                    >
                      {task.status}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-8">
                  <span className="w-24 text-sm font-medium text-gray-400">Responsáveis</span>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="relative cursor-pointer group">
                          <img
                            src={users?.find((u: any) => u.id === task.mainAssigneeId)?.avatar || `https://picsum.photos/seed/${task.mainAssigneeId}/100`}
                            className="w-7 h-7 rounded-full border-2 border-white shadow-sm hover:scale-[3] hover:z-50 transition-all cursor-pointer bg-white group-hover:ring-2 group-hover:ring-orange-200"
                            alt=""
                          />
                          <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 border border-white">
                            <Icons.Check className="w-2 h-2 text-white" />
                          </div>
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                        <div className="p-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50 mb-1 rounded-sm">Principal</div>
                        {[...users].sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')).map((u: any) => (
                          <DropdownMenuItem key={u.id} onClick={() => handleSetMainAssignee(u.id)} className="flex items-center gap-3 py-2">
                            <img src={u.avatar || `https://picsum.photos/seed/${u.id}/100`} className="w-6 h-6 rounded-full" alt="" />
                            <span className={`text-sm ${task.mainAssigneeId === u.id ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{u.name}</span>
                            {task.mainAssigneeId === u.id && <Icons.Check className="w-4 h-4 ml-auto text-blue-500" />}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <div className="p-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50 mb-1 rounded-sm">Adicionais</div>
                        {users.filter((u: any) => u.id !== task.mainAssigneeId).sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')).map((u: any) => (
                          <DropdownMenuItem key={u.id} onClick={() => handleToggleSecondaryAssignee(u.id)} className="flex items-center gap-3 py-2">
                            <div className="relative">
                              <img src={u.avatar || `https://picsum.photos/seed/${u.id}/100`} className="w-6 h-6 rounded-full" alt="" />
                              {(task.secondaryAssigneeIds || []).includes(u.id) && (
                                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5 border border-white">
                                  <Icons.Check className="w-2 h-2 text-white" />
                                </div>
                              )}
                            </div>
                            <span className={`text-sm ${(task.secondaryAssigneeIds || []).includes(u.id) ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{u.name}</span>
                            {(task.secondaryAssigneeIds || []).includes(u.id) && <Icons.Check className="w-4 h-4 ml-auto text-green-500" />}
                          </DropdownMenuItem>
                        ))}
                        {teams.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="p-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50 mb-1 rounded-sm">Equipes</div>
                            {teams.map((team: Team) => (
                              <DropdownMenuItem key={team.id} onClick={() => handleAssignTeam(team)} className="flex items-center gap-3 py-2">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: team.color }}>
                                  <Icons.Users className="w-3.5 h-3.5" />
                                </span>
                                <span className="text-sm text-gray-600">{team.name}</span>
                                <span className="ml-auto text-[10px] text-gray-400">{team.memberIds.length} {team.memberIds.length === 1 ? 'membro' : 'membros'}</span>
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex -space-x-1.5">
                      {(task.secondaryAssigneeIds || []).map(id => (
                        <img
                          key={id}
                          src={users?.find((u: any) => u.id === id)?.avatar || `https://picsum.photos/seed/${id}/100`}
                          className="w-7 h-7 rounded-full border-2 border-white shadow-sm hover:scale-[3] hover:z-50 transition-all cursor-pointer bg-white"
                          alt=""
                          title={users.find((u: any) => u.id === id)?.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <span className="w-24 text-sm font-medium text-gray-400">Datas</span>
                  <div
                    onClick={() => { if (!isReadOnly) setIsExtending(true); }}
                    className={`flex items-center gap-2 text-sm font-medium transition-all ${!isReadOnly ? 'cursor-pointer hover:text-orange-500 hover:bg-orange-50 px-2 py-1 -ml-2 rounded-xl group border-2 border-transparent hover:border-orange-100' : 'text-gray-600'}`}
                  >
                    <Icons.Calendar className={`w-4 h-4 ${!isReadOnly ? 'text-orange-400' : 'text-gray-400'}`} />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Entrega:</span>
                        <span className={(task.extensionCount || 0) > 0 ? 'text-red-500 font-bold' : 'text-gray-900 group-hover:text-orange-600'}>
                          {(() => { const [y, m, d] = (task.dueDate || '').split('T')[0].split('-'); return d ? `${d}/${m}/${y}` : task.dueDate; })()}
                        </span>
                        {(task.extensionCount || 0) > 0 && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase font-black">
                            {task.extensionCount}x
                          </span>
                        )}
                        {!isReadOnly && <Icons.Edit size={12} className="text-gray-300 group-hover:text-orange-400" />}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <span className="w-24 text-sm font-medium text-gray-400">Prioridade</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 -ml-2 rounded-xl transition-all group">
                        <span className={`w-3 h-3 rounded-sm ${task.priority === TaskPriority.ALTA ? 'bg-red-500' : task.priority === TaskPriority.URGENTE ? 'bg-red-700' : task.priority === TaskPriority.MEDIA ? 'bg-cyan-500' : 'bg-slate-400'}`}></span>
                        <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900">{task.priority}</span>
                        <Icons.ChevronDown className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {Object.values(TaskPriority).map((priority) => (
                        <DropdownMenuItem key={priority} onClick={() => handleUpdatePriority(priority)}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[priority].split(' ')[0].replace('bg-', 'bg-')}`} style={{ backgroundColor: PRIORITY_COLORS[priority].includes('slate') ? '#94a3b8' : PRIORITY_COLORS[priority].includes('cyan') ? '#0891b2' : PRIORITY_COLORS[priority].includes('orange') ? '#ea580c' : '#dc2626' }}></span>
                            {priority}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 mb-8 group relative transition-all hover:bg-gray-100/50">
                {isEditingDescription ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <textarea
                      className="w-full p-4 border rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none min-h-[150px] bg-white shadow-inner text-gray-700 leading-relaxed"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      autoFocus
                      placeholder="Adicione detalhes..."
                    />
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        onClick={() => { setIsEditingDescription(false); setDescription(task.description || ''); }}
                        className="px-4 py-2 font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          onUpdate({ ...task, description });
                          setIsEditingDescription(false);
                        }}
                        className="px-6 py-2 bg-[var(--primary-color)] text-[#2c3e50] font-black rounded-lg shadow-sm hover:shadow-md transition-all uppercase tracking-widest"
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => !isReadOnly && setIsEditingDescription(true)}
                    className={`prose prose-sm max-w-none text-gray-600 leading-relaxed italic ${!isReadOnly ? 'cursor-text' : ''}`}
                  >
                    {task.description || "Nenhuma descrição fornecida."}
                    {!isReadOnly && (
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Icons.Edit className="w-3.5 h-3.5" /> Editar
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex border-b text-sm font-bold bg-white sticky top-0 z-10 px-8">
              {[
                { id: 'info', label: 'Detalhes' },
                { id: 'subtasks', label: 'Subtarefas' },
                { id: 'dependencies', label: 'Dependências' },
                { id: 'watchers', label: 'Observadores' },
                { id: 'checklist', label: 'Itens de ação' },
                { id: 'attachments', label: 'Anexos', count: task.attachments?.length || 0 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDetailActiveTab(tab.id as any)}
                  className={`py-4 mr-8 relative transition-all ${detailActiveTab === tab.id ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                  {detailActiveTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />}
                </button>
              ))}
            </div>

            <div className="p-8 flex-1">
              {detailActiveTab === 'info' && (
                <div className="space-y-12">
                  <section>
                    <TaskTagsInput
                      taskId={task.id}
                      workspaceId={workspaceId}
                      currentTags={task.tags ?? []}
                      currentUserId={currentUser.id}
                      readOnly={currentUser.role === UserRole.COLABORADOR}
                      onTagsChange={(tags) => {
                        onTagsChange?.(task.id, tags);
                        onUpdate({ ...task, tags });
                      }}
                    />
                  </section>
                  <section>
                    <h3 className="text-sm font-bold text-gray-900 mb-6">Campos personalizados</h3>
                    <div className="space-y-6">
                      {(taskCustomFields || []).map((field: CustomField) => {
                        const currentValue = (fieldValues || []).find(v => v.fieldId === field.id && v.entityId === task.id)?.value;
                        return (
                          <div key={field.id} className="flex items-center gap-12 group">
                            <span className="w-48 flex items-center gap-2 text-sm text-gray-400 group-hover:text-gray-600 transition-colors">
                              <Icons.ChevronRight className="w-3.5 h-3.5" />
                              {field.name}
                            </span>
                            <div className="flex-1">
                              <CustomFieldInput
                                field={field}
                                value={currentValue}
                                onChange={(val: any) => { onUpdateFieldValue(field.id, task.id, val); }}
                                formulaContext={{
                                  ...task,
                                  ...Object.fromEntries(
                                    (fieldValues || [])
                                      .filter((fv: CustomFieldValue) => fv.entityId === task.id)
                                      .map((fv: CustomFieldValue) => [customFields.find((f: CustomField) => f.id === fv.fieldId)?.name || '', fv.value])
                                  ),
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              )}
              {detailActiveTab === 'subtasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Subtarefas ({tasks.filter((t: any) => t.parentId === task.id).length})</h3>
                    {!isReadOnly && <button onClick={() => onQuickCreate({ parentId: task.id, listId: task.listId })} className="text-xs font-bold text-orange-500 hover:underline">+ Nova Subtarefa</button>}
                  </div>
                  {tasks.filter((t: any) => t.parentId === task.id).map((sub: any) => (
                    <div key={sub.id} onClick={() => onSelectTask(sub.id)} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl border border-gray-100 transition-all cursor-pointer">
                      <Icons.Check className="w-4 h-4" style={{ color: getStatusStyle(sub.status).color }} />
                      <span className="text-sm font-medium flex-1">{sub.title}</span>
                      <div className="flex items-center gap-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${PRIORITY_COLORS[sub.priority as TaskPriority]}`}>{sub.priority}</span>
                        <img
                          src={users?.find((u: any) => u.id === sub.mainAssigneeId)?.avatar || `https://picsum.photos/seed/${sub.mainAssigneeId}/100`}
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-[3] hover:z-50 transition-all cursor-pointer bg-white"
                          alt=""
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {detailActiveTab === 'checklist' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">
                    Itens de ação ({(task.checklists || []).filter((i: ChecklistItem) => i.completed).length}/{(task.checklists || []).length})
                  </h3>
                  {(task.checklists || []).map((item: ChecklistItem) => (
                    <div key={item.id} className="group flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100">
                      <div
                        onClick={async () => {
                          if (isReadOnly) return;
                          const completed = !item.completed;
                          const { error } = await supabase.from('task_checklists').update({ completed }).eq('id', item.id);
                          if (!error) {
                            onUpdate({
                              ...task,
                              checklists: (task.checklists || []).map((c: ChecklistItem) => c.id === item.id ? { ...c, completed } : c),
                            });
                          }
                        }}
                        className="w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center cursor-pointer hover:border-orange-400 transition-colors"
                      >
                        {item.completed && <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>}
                      </div>
                      <span className={`text-sm flex-1 ${item.completed ? 'line-through text-gray-300 font-medium' : 'text-gray-700 font-medium'}`}>{item.text}</span>
                      {!isReadOnly && (
                        <button
                          onClick={async () => {
                            const { error } = await supabase.from('task_checklists').delete().eq('id', item.id);
                            if (!error) {
                              onUpdate({
                                ...task,
                                checklists: (task.checklists || []).filter((c: ChecklistItem) => c.id !== item.id),
                              });
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-all"
                          title="Excluir item"
                        >
                          <Icons.Trash />
                        </button>
                      )}
                    </div>
                  ))}
                  {!isReadOnly && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const text = newChecklistText.trim();
                        if (!text) return;
                        const { data, error } = await supabase
                          .from('task_checklists')
                          .insert({ task_id: task.id, text })
                          .select()
                          .single();
                        if (!error && data) {
                          setNewChecklistText('');
                          onUpdate({
                            ...task,
                            checklists: [...(task.checklists || []), { id: data.id, text: data.text, completed: false }],
                          });
                        }
                      }}
                      className="flex items-center gap-3 pt-2"
                    >
                      <input
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        placeholder="Novo item de ação... (Enter para adicionar)"
                        className="flex-1 px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                      <button type="submit" disabled={!newChecklistText.trim()} className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors">
                        Adicionar
                      </button>
                    </form>
                  )}
                </div>
              )}
              {detailActiveTab === 'attachments' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Anexos ({task.attachments?.length || 0})</h3>
                    {!isReadOnly && (
                      <div className="flex items-center gap-4">
                        <button onClick={handleAddLink} className="text-xs font-bold text-orange-500 hover:underline">+ Link</button>
                        <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-orange-500 hover:underline">+ Arquivo</button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {(task.attachments || []).map((attachment: Attachment) => (
                      <div key={attachment.id} className="group flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-orange-200 transition-all">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <Icons.Paperclip className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{attachment.name}</p>
                          <p className="text-[10px] text-gray-500">{formatFileSize(attachment.size)} • {new Date(attachment.uploadedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                            <Icons.ChevronRight className="w-4 h-4" />
                          </a>
                          {!isReadOnly && (
                            <button onClick={() => removeAttachment(attachment.id)} className="p-2 hover:bg-white rounded-lg text-red-400 hover:text-red-600 transition-colors">
                              <Icons.Trash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {(task.attachments || []).length === 0 && (
                      <div className="col-span-2 py-12 flex flex-col items-center justify-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                        <Icons.Paperclip className="w-12 h-12 text-gray-200 mb-4" />
                        <p className="text-sm text-gray-400 font-medium">Nenhum anexo encontrado.</p>
                        {!isReadOnly && <button onClick={() => fileInputRef.current?.click()} className="mt-4 text-xs font-bold text-orange-500 hover:bg-orange-50 px-4 py-2 rounded-lg transition-all">Clique para enviar</button>}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {detailActiveTab === 'dependencies' && (
                <TaskDependencies
                  task={task}
                  allTasks={tasks}
                  currentUserId={currentUser.id}
                  readOnly={currentUser.role === UserRole.COLABORADOR}
                />
              )}
              {detailActiveTab === 'watchers' && (
                <div className="space-y-4">
                  {(() => {
                    const amWatching = (task.watcherIds || []).includes(currentUser.id);
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-900">Observadores</h3>
                          <button
                            onClick={() => toggleWatcher(task.id, amWatching)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                              amWatching
                                ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {amWatching ? '✓ Observando' : '+ Observar'}
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-400">Observadores recebem notificações de comentários e mudanças nesta tarefa.</p>
                        {(task.watcherIds || []).length === 0 ? (
                          <p className="text-center py-8 text-sm text-gray-400 italic">Nenhum observador ainda.</p>
                        ) : (
                          <div className="space-y-2">
                            {(task.watcherIds || []).map((uid: string) => {
                              const watcher = users.find((u: any) => u.id === uid);
                              if (!watcher) return null;
                              return (
                                <div key={uid} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                                  <img src={watcher.avatar} className="w-8 h-8 rounded-full" alt="" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{watcher.name}</p>
                                    <p className="text-[11px] text-gray-400 truncate">{watcher.email}</p>
                                  </div>
                                  {uid === currentUser.id && (
                                    <button onClick={() => toggleWatcher(task.id, true)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold">Sair</button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Activity Bar (Right) */}
          <div className="w-[380px] border-l bg-white flex flex-col shrink-0">
            <div className="p-6 border-b shrink-0 flex items-center justify-between bg-white text-gray-900">
              <h3 className="text-base font-bold">Atividade</h3>
              <div className="flex items-center gap-3 text-gray-400">
                <button
                  type="button"
                  onClick={() => setShowActivityStats(v => !v)}
                  title="Estatísticas da tarefa"
                  className={`transition-colors ${showActivityStats ? 'text-orange-500' : 'hover:text-gray-600'}`}
                >
                  <Icons.Chart className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter(f => (f === 'history' ? 'all' : 'history'))}
                  title={activityFilter === 'history' ? 'Mostrando só o histórico do sistema — clique para ver os comentários também' : 'Mostrar só o histórico do sistema (sem comentários)'}
                  className={`transition-colors ${activityFilter === 'history' ? 'text-orange-500' : 'hover:text-gray-600'}`}
                >
                  <Icons.Clock className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowActivitySearch(v => { if (v) setActivitySearchQuery(''); return !v; })}
                  title="Buscar na atividade"
                  className={`transition-colors ${showActivitySearch ? 'text-orange-500' : 'hover:text-gray-600'}`}
                >
                  <Icons.Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showActivitySearch && (
              <div className="px-6 pt-4 shrink-0">
                <input
                  type="text"
                  autoFocus
                  value={activitySearchQuery}
                  onChange={(e) => setActivitySearchQuery(e.target.value)}
                  placeholder="Buscar em comentários e atividades..."
                  className="w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
            )}

            {showActivityStats && (
              <div className="px-6 pt-4 shrink-0">
                <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs">
                  <div><span className="text-gray-400">Aberta há</span> <span className="font-bold text-gray-900">{activityStats.daysOpen ?? '—'}{activityStats.daysOpen !== null ? ' dias' : ''}</span></div>
                  <div><span className="text-gray-400">Comentários</span> <span className="font-bold text-gray-900">{activityStats.comments}</span></div>
                  <div><span className="text-gray-400">Mudanças de status</span> <span className="font-bold text-gray-900">{activityStats.statusChanges}</span></div>
                  <div><span className="text-gray-400">Mudanças de prioridade</span> <span className="font-bold text-gray-900">{activityStats.priorityChanges}</span></div>
                  <div><span className="text-gray-400">Mudanças de responsável</span> <span className="font-bold text-gray-900">{activityStats.assigneeChanges}</span></div>
                  <div><span className="text-gray-400">Prorrogações</span> <span className={`font-bold ${activityStats.extensions > 0 ? 'text-red-500' : 'text-gray-900'}`}>{activityStats.extensions}</span></div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
              <div className="relative pl-6 space-y-8">
                <div className="absolute left-1.5 top-2 bottom-0 w-px bg-gray-100"></div>
                {visibleTimeline.length === 0 && (
                  <p className="text-xs text-gray-400 italic pl-2">Nenhum resultado encontrado.</p>
                )}
                {visibleTimeline.map((item: any) => {
                  if (item.unifiedType === 'CREATION') {
                    return (
                      <div key="creation" className="relative">
                        <div className="absolute -left-[22px] top-1.5 w-2 h-2 rounded-full bg-gray-200 border-2 border-white shadow-sm"></div>
                        <div className="text-xs">
                          <span className="text-gray-500">{item.text}</span>
                          <span className="text-gray-300 ml-2">{formatDate(item.date)}</span>
                        </div>
                      </div>
                    );
                  }

                  if (item.unifiedType === 'COMMENT') {
                    const isOwn = item.userId === currentUser.id;
                    return (
                      <CommentItem
                        key={item.id}
                        item={item}
                        users={users}
                        teams={teams}
                        isOwn={isOwn}
                        taskId={task.id}
                        onEdit={editComment}
                        onDelete={deleteComment}
                        formatDate={formatDate}
                      />
                    );
                  }

                  if (item.unifiedType === 'ACTIVITY') {
                    const typeStyles: Record<string, string> = {
                      'STATUS_CHANGE': 'bg-blue-50/30 border-blue-50 text-blue-600 circle-blue-400',
                      'PRIORITY_CHANGE': 'bg-cyan-50/30 border-cyan-50 text-cyan-600 circle-cyan-400',
                      'MAIN_RESPONSIBLE_CHANGE': 'bg-purple-50/30 border-purple-50 text-purple-600 circle-purple-400',
                      'RESPONSIBLE_ADDED': 'bg-green-50/30 border-green-50 text-green-600 circle-green-400',
                      'RESPONSIBLE_REMOVED': 'bg-red-50/30 border-red-50 text-red-600 circle-red-400',
                      'TEAM_ASSIGNED': 'bg-purple-50/30 border-purple-50 text-purple-600 circle-purple-400'
                    };

                    const style = typeStyles[item.type] || 'bg-gray-50/30 border-gray-50 text-gray-600 circle-gray-400';
                    const [bgClass, borderClass, textAccentClass, circleClass] = style.split(' ');

                    return (
                      <div key={item.id} className="relative">
                        <div className={`absolute -left-[22px] top-1.5 w-2 h-2 rounded-full border-2 border-white shadow-sm ${circleClass.replace('circle-', 'bg-')}`}></div>
                        <div className={`text-xs leading-relaxed ${bgClass} p-3 rounded-2xl ml-2 border ${borderClass} shadow-sm transition-all hover:shadow-md`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-900">{users.find((u: any) => u.id === item.userId)?.name}</span>
                            <span className="text-[10px] text-gray-300">{formatDate(item.date)}</span>
                          </div>
                          <p className="text-gray-600 mt-1">
                            {item.type === 'STATUS_CHANGE' && (
                              <>alterou o status para <span className={`font-bold ${textAccentClass}`}>{item.newValue}</span></>
                            )}
                            {item.type === 'PRIORITY_CHANGE' && (
                              <>alterou a prioridade para <span className={`font-bold ${textAccentClass}`}>{item.newValue}</span></>
                            )}
                            {item.type === 'MAIN_RESPONSIBLE_CHANGE' && (
                              <>alterou o responsável principal para <span className={`font-bold ${textAccentClass}`}>{item.newValue}</span></>
                            )}
                            {item.type === 'RESPONSIBLE_ADDED' && (
                              <>adicionou <span className={`font-bold ${textAccentClass}`}>{item.newValue}</span> como responsável adicional</>
                            )}
                            {item.type === 'RESPONSIBLE_REMOVED' && (
                              <>removeu <span className={`font-bold ${textAccentClass}`}>{item.oldValue}</span> dos responsáveis adicionais</>
                            )}
                            {item.type === 'TEAM_ASSIGNED' && (
                              <>atribuiu a equipe <span className={`font-bold ${textAccentClass}`}>{item.newValue}</span> à tarefa</>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (item.unifiedType === 'EXTENSION') {
                    return (
                      <div key={item.id} className="relative">
                        <div className="absolute -left-[22px] top-1.5 w-2 h-2 rounded-full bg-red-400 border-2 border-white shadow-sm"></div>
                        <div className="text-xs leading-relaxed bg-red-50/30 p-2 rounded-lg ml-2 border border-red-50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-900">{users.find((u: any) => u.id === item.updatedBy)?.name}</span>
                            <span className="text-[10px] text-gray-300">{formatDate(item.date)}</span>
                          </div>
                          <span className="text-gray-500"> alterou o vencimento para </span>
                          <span className="font-bold text-red-500">{(() => { const s = item.newDate?.split('T')[0] || item.newDate; const [y, m, d] = (s || '').split('-'); return d ? `${d}/${m}/${y}` : s; })()}</span>
                          {item.reason && <p className="mt-1 text-[10px] italic text-gray-400">"{item.reason}"</p>}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>

            <div className="p-6 border-t bg-white shrink-0">
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 shadow-inner">
                <MentionTextarea
                  placeholder="Escreva um comentário... use @ para mencionar pessoas ou Equipes"
                  value={newComment}
                  onChange={setNewComment}
                  onSubmit={handleAddComment}
                  users={users || []}
                  teams={teams}
                  className="w-full bg-transparent border-none focus:ring-0 text-sm p-0 resize-none min-h-[60px] custom-scrollbar text-gray-700"
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3 text-gray-400">
                    <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer hover:text-gray-600 transition-colors">
                      <Icons.Paperclip className="w-4 h-4" />
                    </div>
                  </div>
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="bg-orange-500 p-2 rounded-xl text-white hover:brightness-110 shadow-lg shadow-orange-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Extension Modal (inside main area z-index) */}
        {isExtending && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); setIsExtending(false); }}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Alterar Prazo</h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">É necessário um motivo para prorrogar.</p>
                </div>
                <button onClick={() => setIsExtending(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                  <Icons.Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Novo Vencimento</label>
                  <input
                    type="date"
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-50 outline-none transition-all font-bold text-gray-900"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Justificativa</label>
                  <textarea
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-50 outline-none transition-all text-sm min-h-[120px] resize-none font-medium"
                    placeholder="Por que esta data está sendo alterada?"
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-100/50 flex gap-3">
                <button
                  onClick={() => setIsExtending(false)}
                  className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveDueDate}
                  disabled={isSavingExtension || !newDueDate || newDueDate === task.dueDate || !extensionReason.trim()}
                  className="flex-[2] py-3 bg-orange-500 text-white font-black rounded-2xl shadow-xl shadow-orange-100 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2"
                >
                  {isSavingExtension ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Salvando...
                    </>
                  ) : 'Salvar Novo Prazo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PRESET_COLORS = [
  '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', // Grays
  '#fecaca', '#f87171', '#ef4444', '#dc2626', '#b91c1c', // Reds
  '#fed7aa', '#fb923c', '#f97316', '#ea580c', '#c2410c', // Oranges
  '#fef08a', '#facc15', '#eab308', '#ca8a04', '#a16207', // Yellows
  '#bbf7d0', '#4ade80', '#22c55e', '#16a34a', '#15803d', // Greens
  '#99f6e4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', // Teals
  '#bfdbfe', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', // Blues
  '#000080', '#0000cd', '#0000ff', '#4169e1', '#6495ed', // Dark Blues
  '#ddd6fe', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', // Purples
  '#fbcfe8', '#f472b6', '#ec4899', '#db2777', '#be185d', // Pinks
];

function CustomFieldsManager(props: any) {
  const {
    onClose,
    fields,
    onCreateField,
    onUpdateField,
    onDeleteField,
    onReorderField,
    currentUser,
    activeListId,
    hiddenStandardColumnKeysByList,
    onToggleStandardColumn,
    hiddenTaskFieldIdsByList,
    onHideTaskFieldForList: onToggleTaskFieldForList
  } = props;
  const [activeTab, setActiveTab] = useState<'existing' | 'create'>(activeListId ? 'existing' : 'create');
  const [fieldSearch, setFieldSearch] = useState('');

  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>(CustomFieldType.TEXT);
  const [target, setTarget] = useState<'TASK' | 'LIST' | 'PROJECT'>('TASK');
  const [options, setOptions] = useState<CustomFieldOption[]>([]);
  const [optionSearch, setOptionSearch] = useState('');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [formula, setFormula] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('R$');

  const STANDARD_FIELDS_MAP = [
    { id: 'status', label: 'Status' },
    { id: 'priority', label: 'Prioridade' },
    { id: 'assignee', label: 'Responsável' },
    { id: 'extensions', label: 'Prorrog.' },
    { id: 'dueDate', label: 'Data Limite' },
  ];

  const filteredFields = fields.filter((f: CustomField) =>
    f.name.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const filteredStandard = STANDARD_FIELDS_MAP.filter(f =>
    f.label.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const isFieldHidden = (fieldId: string) => {
    if (!activeListId) return false;
    return (hiddenTaskFieldIdsByList[activeListId] || []).includes(fieldId);
  };

  const isStandardHidden = (key: string) => {
    if (!activeListId) return false;
    return (hiddenStandardColumnKeysByList[activeListId] || []).includes(key);
  };

  const handleAddOption = (label: string) => {
    if (!label.trim()) return;
    const newOption: CustomFieldOption = {
      id: Math.random().toString(36).substr(2, 9),
      label: label.trim(),
      color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    };
    setOptions([...options, newOption]);
    setOptionSearch('');
  };

  const updateOption = (id: string, updates: Partial<CustomFieldOption>) => {
    setOptions(options.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const removeOption = (id: string) => {
    setOptions(options.filter(o => o.id !== id));
  };

  const startEditing = (field: CustomField) => {
    setEditingFieldId(field.id);
    setName(field.name);
    setType(field.type);
    setTarget(field.target);
    setOptions(field.config?.options || []);
    setFormula(field.config?.formula || '');
    setCurrencySymbol(field.config?.currency || 'R$');
  };

  const cancelEditing = () => {
    setEditingFieldId(null);
    setName('');
    setType(CustomFieldType.TEXT);
    setOptions([]);
    setFormula('');
    setCurrencySymbol('R$');
  };

  const handleSave = () => {
    if (!name) return;
    const config =
      type === CustomFieldType.DROPDOWN ? { options: options.filter(o => o.label.trim() !== '') } :
      type === CustomFieldType.FORMULA ? { formula } :
      (type === CustomFieldType.MONEY || type === CustomFieldType.CURRENCY) ? { currency: currencySymbol.trim() || 'R$' } :
      undefined;
    const fieldData: any = {
      name,
      type,
      target,
      config,
    };

    if (editingFieldId) {
      const existingField = fields.find((f: any) => f.id === editingFieldId);
      onUpdateField({ ...existingField, ...fieldData });
    } else {
      const newField: CustomField = {
        ...fieldData,
        id: Math.random().toString(36).substr(2, 9),
        isMandatory: false,
        visibleTo: [UserRole.ADMIN, UserRole.GESTOR, UserRole.COLABORADOR],
        createdBy: currentUser.id,
        createdAt: new Date().toISOString()
      };
      onCreateField(newField);
    }
    cancelEditing();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Gerenciar Campos Personalizados</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 border-b">
          <div className="relative">
            <input
              type="text"
              className="w-full p-2.5 pl-4 border-2 border-orange-100 rounded-lg text-sm focus:border-orange-500 focus:ring-4 focus:ring-orange-50 outline-none transition-all placeholder:text-gray-400"
              placeholder="Pesquise campos novos ou existentes"
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-6 mt-4 border-b">
            <button
              onClick={() => setActiveTab('create')}
              className={`pb-2 text-sm font-bold transition-all relative ${activeTab === 'create' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Criar novo
              {activeTab === 'create' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              className={`pb-2 text-sm font-bold transition-all relative ${activeTab === 'existing' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Adicionar um existente
              {activeTab === 'existing' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 rounded-t-full" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'existing' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs font-bold text-gray-500 uppercase">
                  <span>Mostrados</span>
                  <Icons.ChevronDown className="w-3 h-3" />
                </div>
                <button
                  onClick={() => {
                    if (!activeListId) return;
                    const allHidden =
                      filteredStandard.every((f) => isStandardHidden(f.id)) &&
                      filteredFields.every((f) => isFieldHidden(f.id));
                    // Mostrar tudo: reexibe o que estava oculto. Ocultar tudo: oculta o que estava visível.
                    filteredStandard.forEach((f) => {
                      if (allHidden ? isStandardHidden(f.id) : !isStandardHidden(f.id)) {
                        onToggleStandardColumn(activeListId, f.id);
                      }
                    });
                    filteredFields.forEach((f) => {
                      if (allHidden ? isFieldHidden(f.id) : !isFieldHidden(f.id)) {
                        onToggleTaskFieldForList(activeListId, f.id);
                      }
                    });
                  }}
                  disabled={!activeListId}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {filteredStandard.every((f) => isStandardHidden(f.id)) && filteredFields.every((f) => isFieldHidden(f.id))
                    ? 'Mostrar tudo'
                    : 'Ocultar tudo'}
                </button>
              </div>

              {!activeListId && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Selecione uma lista específica na barra lateral para mostrar/ocultar campos — como há mais de uma lista neste escopo, não é possível saber em qual delas aplicar a alteração.
                </p>
              )}

              <div className="space-y-1">
                {/* Standard Fields */}
                {filteredStandard.map(f => (
                  <div key={f.id} className="flex items-center justify-between py-2 group">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 font-medium text-sm w-6 text-center">Aa</span>
                      <span className="text-sm font-medium text-gray-700">{f.label}</span>
                    </div>
                    <button
                      onClick={() => onToggleStandardColumn(activeListId, f.id)}
                      disabled={!activeListId}
                      className={`w-10 h-6 rounded-full transition-all relative disabled:opacity-40 disabled:cursor-not-allowed ${!isStandardHidden(f.id) ? 'bg-orange-500' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${!isStandardHidden(f.id) ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                ))}

                {/* Custom Fields */}
                {filteredFields.map(f => (
                  <div key={f.id} className="flex items-center justify-between py-2 group">
                    <div className="flex items-center gap-3">
                      <div className="p-1 px-1.5 rounded border border-gray-200">
                        <div className="w-3 h-3 border-2 border-blue-500 rounded-sm" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Existing management buttons shown on hover */}
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button onClick={() => startEditing(f)} className="p-1 text-gray-400 hover:text-blue-500"><Icons.Edit size={14} /></button>
                        <button onClick={() => onDeleteField(f.id)} className="p-1 text-gray-400 hover:text-red-500"><Icons.Trash size={14} /></button>
                      </div>
                      <button
                        onClick={() => onToggleTaskFieldForList(activeListId, f.id)}
                        disabled={!activeListId}
                        className={`w-10 h-6 rounded-full transition-all relative disabled:opacity-40 disabled:cursor-not-allowed ${!isFieldHidden(f.id) ? 'bg-orange-500' : 'bg-gray-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${!isFieldHidden(f.id) ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 text-sm">
                {editingFieldId ? 'Editar Campo' : 'Criar Novo Campo'}
              </h4>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Nome do Campo</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Orçamento Estimado"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Dado</label>
                <select
                  className="w-full p-2 border rounded mt-1 text-sm bg-white focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                  value={type}
                  onChange={(e) => setType(e.target.value as CustomFieldType)}
                >
                  {Object.values(CustomFieldType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {type === CustomFieldType.DROPDOWN && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-gray-500 uppercase">Opções da Lista</label>

                    {/* Quick Add Input */}
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full p-2.5 pl-3 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-[var(--primary-color)] outline-none shadow-sm transition-all"
                        placeholder="Pesquise ou adicione opções..."
                        value={optionSearch}
                        onChange={(e) => setOptionSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddOption(optionSearch);
                          }
                        }}
                      />
                      {optionSearch.trim() && !options.some(o => o.label.toLowerCase() === optionSearch.toLowerCase()) && (
                        <button
                          onClick={() => handleAddOption(optionSearch)}
                          className="absolute right-2 top-2 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-bold text-gray-600 transition-colors"
                        >
                          Enter para adicionar
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {options.map((opt, idx) => (
                        <div key={opt.id} className="flex items-center gap-2 group/opt animate-in slide-in-from-left duration-200" style={{ '--delay': `${idx * 40}ms` } as any}>
                          <div className="p-1 cursor-grab active:cursor-grabbing text-gray-300">
                            <Icons.Grip size={14} />
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="flex-1 py-1.5 px-4 rounded font-bold text-white text-xs text-center shadow-sm hover:brightness-95 active:scale-[0.98] transition-all truncate"
                                style={{ backgroundColor: opt.color }}
                              >
                                {opt.label}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="p-4 w-64 shadow-2xl rounded-xl border-gray-200 z-[250]" align="center" side="right">
                              <div className="space-y-4">
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => updateOption(opt.id, { label: e.target.value })}
                                  className="w-full p-2 border border-orange-500 rounded-lg text-sm font-medium focus:ring-0 outline-none"
                                  autoFocus
                                />

                                <div className="grid grid-cols-6 gap-2">
                                  {PRESET_COLORS.map(c => (
                                    <button
                                      key={c}
                                      onClick={() => updateOption(opt.id, { color: c })}
                                      className={`w-6 h-6 rounded-full border transition-all hover:scale-125 ${opt.color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-125 z-10' : 'border-transparent'}`}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>

                                <div className="pt-2 border-t">
                                  <button
                                    onClick={() => removeOption(opt.id)}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Icons.Trash size={14} />
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                      {options.length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl bg-white/50">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            Nenhuma opção definida
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {type === CustomFieldType.FORMULA && (
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <label className="text-xs font-bold text-gray-500 uppercase">Fórmula</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded text-sm font-mono focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    placeholder="Ex: {{Preço}} * {{Quantidade}}"
                  />
                  <p className="text-[11px] text-gray-400">
                    Use <code className="bg-white border rounded px-1">{'{{Nome do Campo}}'}</code> para referenciar outros campos numéricos da tarefa. Calculado automaticamente, não é editável.
                  </p>
                </div>
              )}

              {(type === CustomFieldType.MONEY || type === CustomFieldType.CURRENCY) && (
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <label className="text-xs font-bold text-gray-500 uppercase">Símbolo da Moeda</label>
                  <input
                    type="text"
                    className="w-24 p-2 border rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    placeholder="R$"
                    maxLength={5}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
          {editingFieldId ? (
            <>
              <button onClick={cancelEditing} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded font-medium">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white font-bold rounded hover:shadow-md transition-all">Salvar Alterações</button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded font-medium">Fechar</button>
              <button onClick={handleSave} disabled={!name} className="px-4 py-2 text-sm bg-[var(--primary-color)] text-[#2c3e50] font-bold rounded hover:shadow-md disabled:opacity-50 transition-all">Criar Campo</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateSpaceModal({ onClose, onCreate }: any) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('Layout');
  const [searchQuery, setSearchQuery] = useState('');

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280', '#ffce05'];

  const availableIcons = Object.keys(Icons).filter(key =>
    key.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !['Home', 'Check', 'ChevronRight', 'ChevronUp', 'ChevronDown', 'ChevronLeft', 'Plus', 'Grip', 'MoreHorizontal'].includes(key)
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-800">Criar Novo Espaço</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Icon & Name Preview */}
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border"
              style={{ backgroundColor: color + '15', borderColor: color + '30' }}
            >
              {(() => {
                const IconComp = (Icons as any)[icon] || Icons.Layout;
                return <IconComp className="w-6 h-6" color={color} />;
              })()}
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Nome do Espaço</label>
              <input
                type="text"
                className="w-full p-2 border-b-2 border-transparent focus:border-[var(--primary-color)] transition-all text-sm font-medium outline-none placeholder:text-gray-300"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Suporte T.I."
                autoFocus
              />
            </div>
          </div>

          {/* Icon Picker Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Escolha um Ícone</label>
              <div className="relative">
                <Icons.Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-2 py-1 bg-gray-50 border rounded-md text-[11px] outline-none focus:ring-1 focus:ring-[var(--primary-color)] w-32 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-6 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100 max-h-48 overflow-y-auto custom-scrollbar">
              {availableIcons.map(iconKey => {
                const IconComp = (Icons as any)[iconKey];
                const isActive = icon === iconKey;
                return (
                  <button
                    key={iconKey}
                    onClick={() => setIcon(iconKey)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${isActive ? 'bg-white shadow-md scale-110 active:scale-95' : 'hover:bg-white/50 text-gray-400 hover:text-gray-600'
                      }`}
                    title={iconKey}
                  >
                    <IconComp className="w-5 h-5" color={isActive ? color : 'currentColor'} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cor de Identificação</label>
            <div className="flex flex-wrap gap-2.5">
              {colors.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all relative ${color === c ? 'scale-125' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 mt-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-200 rounded-lg font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onCreate(name, color, icon)}
            disabled={!name.trim()}
            className="px-6 py-2 text-xs bg-[var(--primary-color)] text-[#2c3e50] font-black rounded-lg hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateWikiModal({ spaces, onClose, onCreate }: any) {
  const [spaceId, setSpaceId] = useState(spaces?.[0]?.id || '');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirm = async () => {
    if (!spaceId || isCreating) return;
    setIsCreating(true);
    await onCreate(spaceId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText className="w-4 h-4 text-orange-500" /> Criar Wiki Interna</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Cria uma pasta <strong>"Wiki Interna"</strong> no espaço escolhido, com um documento raiz e 10 subpáginas já preenchidas
            (Visão geral, Processos, Procedimentos, Políticas, Manuais, FAQ, Responsáveis, Modelos, Decisões e Manutenção) — pronto pra ajustar e usar.
          </p>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Espaço</label>
            <select
              className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
            >
              {(spaces || []).map((s: Space) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!spaceId || isCreating}
            className="px-6 py-2 text-xs bg-[var(--primary-color)] text-[#2c3e50] font-black rounded-lg hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {isCreating ? 'Criando...' : 'Criar Wiki'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateFolderModal({ onClose, onCreate }: any) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Criar Nova Pasta</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Nome da Pasta</label>
            <input
              type="text"
              className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Projetos Q1"
              autoFocus
            />
          </div>
        </div>
        <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded font-medium">Cancelar</button>
          <button onClick={() => onCreate(name)} disabled={!name} className="px-6 py-2 text-sm bg-[var(--primary-color)] text-[#2c3e50] font-bold rounded hover:shadow-md disabled:opacity-50 transition-all">Criar Pasta</button>
        </div>
      </div>
    </div>
  );
}

// Input de data para campos personalizados/tabela. Inputs nativos <input
// type="date"> disparam onChange a cada tecla digitada, inclusive enquanto
// a data está incompleta (ex: só o dia e mês, ou só 1-2 dígitos do ano) —
// nesses casos `e.target.value` vem vazio. Sem tratamento isso causava dois
// problemas: (1) cada tecla parcial disparava um upsert salvando valor
// vazio, criando uma corrida entre requisições que podia sobrescrever a
// data completa digitada por último com uma parcial que resolveu depois;
// (2) como o valor exibido é controlado pela prop `value` (só atualizada
// depois que o upsert assíncrono termina), qualquer re-render do app nesse
// intervalo (ex: outra tarefa mudando via realtime) forçava o campo de
// volta ao valor antigo, apagando visualmente o que o usuário tinha
// acabado de digitar — exatamente o sintoma relatado de "a data não fica
// gravada assim que termino de digitar o ano". Por isso: (a) mantemos um
// valor local que não depende do round-trip de rede para continuar exibindo
// o que foi digitado, e (b) só disparamos onCommit quando o usuário termina
// uma data válida ou explicitamente limpa um valor que já existia.
export function DateFieldEditor({ value, onCommit, className }: { value: any; onCommit: (v: string) => void; className?: string }) {
  const [local, setLocal] = useState(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <input
      type="date"
      value={local}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        if (v || value) onCommit(v);
      }}
      className={className}
    />
  );
}

// Input de texto/número para campos personalizados/tabela. Mesmo problema do
// DateFieldEditor, mas mais severo aqui: como o valor exibido dependia
// diretamente da prop `value` (só atualizada depois que o upsert assíncrono
// termina), o React reverte o input pro valor antigo a cada tecla — antes
// mesmo da tecla seguinte ser digitada. Na prática, digitar "hello" salvava
// só "o" (confirmado em navegador real, não só em teste). Corrigido com o
// mesmo buffer local: o que aparece na tela nunca depende do round-trip de
// rede, só o que é persistido.
export function BufferedFieldInput({ value, onCommit, type = 'text', className, placeholder }: { value: any; onCommit: (v: string) => void; type?: string; className?: string; placeholder?: string }) {
  const [local, setLocal] = useState(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => {
        setLocal(e.target.value);
        onCommit(e.target.value);
      }}
      className={className}
    />
  );
}

// Mesmo problema do BufferedFieldInput, mas para checkbox: sem buffer local,
// o clique liga o checkbox visualmente e, como o `checked` exibido também só
// reflete o valor depois do upsert assíncrono terminar, o React desmarca o
// checkbox de volta antes da resposta chegar — parece que o clique "não
// pegou" (só funciona se a rede responder rápido o suficiente).
export function BufferedCheckbox({ checked, onCommit, className }: { checked: any; onCommit: (v: boolean) => void; className?: string }) {
  const [local, setLocal] = useState(!!checked);
  useEffect(() => { setLocal(!!checked); }, [checked]);
  return (
    <input
      type="checkbox"
      checked={local}
      onChange={(e) => {
        setLocal(e.target.checked);
        onCommit(e.target.checked);
      }}
      className={className}
    />
  );
}

// Avaliação por estrelas: buffer local pelo mesmo motivo dos outros — sem
// ele, clicar numa estrela podia "voltar" pra nota anterior por uma fração
// de segundo (ou de vez, se outro re-render acontecesse) até o upsert
// assíncrono terminar.
export function BufferedRating({ value, onCommit, max = 5, className }: { value: any; onCommit: (v: number) => void; max?: number; className?: string }) {
  const [local, setLocal] = useState(Number(value) || 0);
  useEffect(() => { setLocal(Number(value) || 0); }, [value]);
  return (
    <div className={className}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        // Icons.* não repassa `onClick` pro <svg> (só aceita className/size/color),
        // então o clique precisa ficar num elemento que realmente o recebe.
        <button
          key={star}
          type="button"
          onClick={() => {
            setLocal(star);
            onCommit(star);
          }}
          className="cursor-pointer"
        >
          <Icons.Star
            className={`w-4 h-4 transition-colors ${
              local >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 hover:text-yellow-200'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// Slider de progresso: mesmo problema do BufferedFieldInput, só que mais
// grave, porque arrastar dispara `onChange` continuamente — sem buffer local
// o "bolinha" do slider (e o rótulo/barra de progresso, que também dependem
// do mesmo valor) ficam travando/voltando durante o próprio arraste, só
// acompanhando de verdade depois que cada upsert assíncrono termina.
export function BufferedProgressEditor({ value, onCommit, compact = false }: { value: any; onCommit: (v: string) => void; compact?: boolean }) {
  const [local, setLocal] = useState(Number(value) || 0);
  useEffect(() => { setLocal(Number(value) || 0); }, [value]);
  const barColor = local > 75 ? '#22c55e' : local > 30 ? '#eab308' : '#ef4444';
  return (
    <div className={compact ? 'w-full space-y-1' : 'mt-2 space-y-1'}>
      <div className={`flex justify-between font-bold text-gray-400 ${compact ? 'text-[9px] uppercase' : 'text-xs'}`}>
        <span>Progresso</span>
        <span>{local}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
        <div className="h-full transition-all duration-500" style={{ width: `${local}%`, backgroundColor: barColor }} />
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={local}
        onChange={(e) => {
          setLocal(Number(e.target.value));
          onCommit(e.target.value);
        }}
        className={compact ? 'w-full h-1 opacity-0 hover:opacity-100 transition-opacity cursor-pointer accent-orange-500' : 'w-full accent-[var(--primary-color)]'}
      />
    </div>
  );
}

// FormulaParser depende de mathjs, uma biblioteca relativamente pesada.
// Carregamos por import dinâmico (chunk separado) em vez de estático, pra
// não inflar o bundle inicial de quem nunca usa um campo do tipo Fórmula.
let formulaParserPromise: Promise<typeof import('./lib/FormulaParser')> | null = null;
function loadFormulaParser() {
  if (!formulaParserPromise) formulaParserPromise = import('./lib/FormulaParser');
  return formulaParserPromise;
}

export function FormulaValue({ formula, context }: { formula: string; context: Record<string, any> }) {
  const [result, setResult] = useState<number | string>('…');
  // `context` é um objeto novo a cada render (montado inline pelo chamador);
  // comparamos pelo conteúdo serializado pra não reavaliar a cada re-render.
  const contextKey = JSON.stringify(context);
  useEffect(() => {
    let active = true;
    loadFormulaParser().then(({ FormulaParser }) => {
      if (active) setResult(FormulaParser.evaluate(formula, JSON.parse(contextKey)));
    });
    return () => { active = false; };
  }, [formula, contextKey]);
  return <>{result}</>;
}

function CustomFieldInput({ field, value, onChange, formulaContext }: any) {
  switch (field.type) {
    case CustomFieldType.TEXT:
    case CustomFieldType.WEBSITE:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <BufferedFieldInput
            type="text"
            className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-shadow"
            value={value}
            onCommit={onChange}
            placeholder={field.type === CustomFieldType.WEBSITE ? 'https://...' : 'Digite aqui...'}
          />
        </div>
      );
    case CustomFieldType.NUMBER:
    case CustomFieldType.MONEY:
    case CustomFieldType.CURRENCY:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <div className="relative mt-1">
            {(field.type === CustomFieldType.MONEY || field.type === CustomFieldType.CURRENCY) && (
              <div className="absolute left-3 top-2 text-gray-400 text-sm font-medium">{field.config?.currency || 'R$'}</div>
            )}
            <BufferedFieldInput
              type="number"
              className={`w-full p-2 border rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-shadow ${(field.type === CustomFieldType.MONEY || field.type === CustomFieldType.CURRENCY) ? 'pl-9' : ''}`}
              value={value}
              onCommit={onChange}
            />
          </div>
        </div>
      );
    case CustomFieldType.RATING:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <BufferedRating value={value} onCommit={onChange} className="flex gap-1 mt-2" />
        </div>
      );
    case CustomFieldType.PROGRESS:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <BufferedProgressEditor value={value} onCommit={onChange} />
        </div>
      );
    case CustomFieldType.FORMULA:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <div className="mt-1 text-sm font-mono text-blue-600 bg-blue-50 px-3 py-2 rounded border border-blue-100 italic">
            <FormulaValue formula={field.config?.formula || ''} context={formulaContext || {}} />
          </div>
        </div>
      );
    case CustomFieldType.DATE:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <DateFieldEditor
            value={value}
            onCommit={onChange}
            className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-shadow"
          />
        </div>
      );
    case CustomFieldType.DROPDOWN:
      const currentOpt = field.config?.options?.find((o: CustomFieldOption) => o.id === value);
      const IconComp = currentOpt?.icon ? (Icons as any)[currentOpt.icon] : null;

      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <div className="mt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="w-full h-10 border rounded-md px-3 flex items-center justify-between bg-white hover:bg-gray-50 cursor-pointer group transition-all">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {currentOpt ? (
                      <div
                        className="px-3 py-1 rounded text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap"
                        style={{ backgroundColor: currentOpt.color }}
                      >
                        {IconComp && <IconComp className="h-3.5 w-3.5" color="white" />}
                        {currentOpt.label}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 font-medium">Selecione...</span>
                    )}
                  </div>
                  <Icons.ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto" align="start">
                <DropdownMenuItem onClick={() => onChange('')} className="text-xs text-gray-400 italic">
                  — Limpar seleção
                </DropdownMenuItem>
                {field.config?.options?.map((opt: CustomFieldOption) => {
                  const OptIcon = opt.icon ? (Icons as any)[opt.icon] : null;
                  return (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={() => onChange(opt.id)}
                      className="p-1"
                    >
                      <div
                        className="flex items-center justify-center gap-2 w-full py-1.5 rounded text-xs font-bold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: opt.color }}
                      >
                        {OptIcon && <OptIcon className="h-3.5 w-3.5" color="white" />}
                        <span>{opt.label}</span>
                        {value === opt.id && <Icons.Check className="ml-auto h-3 w-3" color="white" />}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      );
    case CustomFieldType.CHECKBOX:
      return (
        <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
          <BufferedCheckbox
            checked={value}
            onCommit={onChange}
            className="w-5 h-5 text-[var(--primary-color)] focus:ring-[var(--primary-color)] border-gray-300 rounded cursor-pointer"
          />
          <label className="text-sm font-semibold text-gray-700 cursor-pointer" onClick={() => onChange(!value)}>{field.name}</label>
        </div>
      );
    default:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <p className="text-sm text-gray-400 italic mt-1 border p-2 rounded bg-gray-50">Tipo de campo ({field.type}) não suportado.</p>
        </div>
      );
  }
}
