import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MoreHorizontal, FileText, ListPlus, Link as LinkIcon, Image as ImageIcon, Paperclip } from "lucide-react";
import {
  User, Task, Workspace, Space, Folder, List, Project,
  UserRole, StatusType, StatusOption, StatusGroup, TaskPriority, ExtensionLog, Comment, ChecklistItem, Attachment,
  CustomField, CustomFieldType, CustomFieldValue, CustomFieldOption, Doc, TaskActivity
} from './types';
// import { MOCK_USERS, INITIAL_WORKSPACE, MOCK_SPACES, MOCK_FOLDERS, MOCK_LISTS, MOCK_TASKS, MOCK_PROJECTS, MOCK_CUSTOM_FIELDS, MOCK_CUSTOM_FIELD_VALUES } from './mockData';
import { INITIAL_WORKSPACE, MOCK_PROJECTS } from './mockData'; // MOCK_PROJECTS temporário se ainda necessário
import { Icons, PRIORITY_COLORS, COLORS } from './constants';
import AdminPanel from './pages/AdminPanel';
import LoginScreen from './pages/LoginScreen';
import ChangePasswordModal from './components/ChangePasswordModal';
import CreateListModal from './components/CreateListModal';
import compactLogoWhite from './assets/logo-verticalparts-white.png';
import { TableView } from './components/views/TableView';
import { CalendarView } from './components/views/CalendarView';
import { GanttView } from './components/views/GanttView';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as ReBarChart, PieChart, Pie, Cell } from 'recharts';
import { supabase, supabaseAdmin } from './lib/supabase';
import { AutomationEngine } from './lib/AutomationEngine';
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
  const [is2faVerified, setIs2faVerified] = useState(() => localStorage.getItem('vp_2fa_verified') === 'true');
  // Impede que getSession() libere a tela enquanto o SSO ainda está processando
  const isSSOProcessing = useRef(
    new URLSearchParams(window.location.search).get('sso_token') !== null
  );

  // --- SSO LOGIC ---
  const handleSSOToken = useCallback(async (token: string) => {
    try {
      console.log("SSO: Iniciando validação de token...");
      
      const { data: { user: centralUser }, error: centralError } = await centralSupabase.auth.getUser(token);
      if (centralError || !centralUser) throw new Error("Token central inválido");

      console.log("SSO: Usuário central validado:", centralUser.email);

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
          user_metadata: { name: centralUser.user_metadata?.name || centralUser.email?.split('@')[0] }
        });

        if (createError) throw createError;
        targetUserId = newUser.user?.id;
      } else {
        targetUserId = users[0].id;
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
    } catch (err) {
      console.error('Erro no upload:', err);
      return null;
    }
  }, []);

  const saveTaskAttachment = useCallback(async (taskId: string, attachment: Partial<Attachment>) => {
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

    if (data && !error) {
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
    }
  }, []);

  const removeTaskAttachment = useCallback(async (taskId: string, attachmentId: string) => {
    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId);

    if (!error) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            attachments: (t.attachments || []).filter(a => a.id !== attachmentId)
          };
        }
        return t;
      }));
    }
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
  const [isSharedTaskView, setIsSharedTaskView] = useState(false);
  const [isFieldManagerOpen, setIsFieldManagerOpen] = useState(false);

  // New State for Creation Modals
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false); // New Task Modal State
  const [prefilledTaskData, setPrefilledTaskData] = useState<Partial<Task> | null>(null);
  const [targetSpaceId, setTargetSpaceId] = useState<string | null>(null);

  // User Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Admin - carregado do Supabase
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [userAccess, setUserAccess] = useState<Record<string, { spaceIds: string[]; folderIds: string[] }>>({});

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
          icon: s.icon
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
            attachments: docAttachments
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
    const { data } = await supabase.from('profiles').select('*');
    if (data && data.length > 0) {
      const users: User[] = data.map((d: any) => ({
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
              id: s.id, name: s.name, workspaceId: s.workspace_id, color: s.color, icon: s.icon
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

  // Detect taskId in URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('taskId');
    if (taskId) {
      setSelectedTaskId(taskId);
      setIsSharedTaskView(true);
    }
  }, []);

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  const loadTasks = useCallback(async () => {
    if (!session) return;

    let query = supabase.from('tasks').select('*');

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

      // Fetch sub-entities in parallel
      const results = await Promise.all([
        supabase.from('task_attachments').select('*').in('task_id', taskIds),
        supabase.from('task_comments').select('*').in('task_id', taskIds),
        supabase.from('task_extension_logs').select('*').in('task_id', taskIds),
        supabase.from('task_checklists').select('*').in('task_id', taskIds),
        supabase.from('task_activities').select('*').in('task_id', taskIds),
      ]);
      const attData = results[0].data;
      const commData = results[1].data;
      const logData = results[2].data;
      const checkData = results[3].data;
      const actData = results[4].data;

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
          timestamp: c.created_at
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
          createdAt: d.created_at
        };
      }));
    }
  }, [session, activeListId, activeScope, lists, folders]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const updateTask = useCallback(async (updatedTask: Task) => {
    try {
      const { error } = await supabase
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
      } else {
        console.error('Erro ao atualizar tarefa:', error);
        toast.error('Erro ao salvar tarefa: ' + error.message);
      }
    } catch (err) {
      console.error('Erro inesperado ao atualizar tarefa:', err);
      toast.error('Erro inesperado ao salvar tarefa.');
    }
  }, []);

  const handleUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      updateTask({ ...task, ...updates });
    }
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

  const handleBulkDelete = async (ids: string[]) => {
    if (!window.confirm(`Deletar ${ids.length} tarefa(s) permanentemente?`)) return;
    const { error } = await supabase.from('tasks').delete().in('id', ids);
    if (!error) {
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
      toast.success(`${ids.length} tarefa(s) removidas.`);
    } else {
      toast.error('Erro ao deletar tarefas: ' + error.message);
    }
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
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (!error) {
          setTasks(prev => prev.filter(t => t.id !== taskId));
          if (selectedTaskId === taskId) setSelectedTaskId(null);
          toast.success('Tarefa excluída.');
        } else { toast.error('Erro ao excluir tarefa: ' + error.message); }
      }
    });
  };

  const handleDeleteSpace = (spaceId: string) => {
    setConfirmModal({
      message: 'Excluir este espaço e todas as suas pastas e tarefas?',
      onConfirm: async () => {
        const { error } = await supabase.from('spaces').delete().eq('id', spaceId);
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
        const { error } = await supabase.from('folders').delete().eq('id', folderId);
        if (!error) {
          setFolders(prev => prev.filter(f => f.id !== folderId));
          if (activeScope.type === 'folder' && activeScope.id === folderId) handleNavigate('global', null, 'Dashboard');
          toast.success('Pasta excluída.');
        } else { toast.error('Erro ao excluir pasta: ' + error.message); }
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
        const { error } = await supabase.from('lists').delete().eq('id', listId);
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

  const handleCreateDoc = (folderId: string) => {
    setRenameModal({
      title: 'Novo Documento', defaultValue: '', placeholder: 'Título do documento…',
      onSubmit: async (title) => {
        if (!title.trim()) return;
        const { data, error } = await supabase
          .from('docs')
          .insert({ title: title.trim(), content: 'Comece a escrever aqui...', folder_id: folderId, created_by: currentUser.id })
          .select().single();
        if (data && !error) {
          const newDoc: Doc = { id: data.id, title: data.title, content: data.content || '', headerImage: data.header_image, folderId: data.folder_id, createdBy: data.created_by, attachments: [] };
          setDocs(prev => [...prev, newDoc]);
          setActiveDocId(newDoc.id);
          setActiveView('Doc');
          setActiveScope({ type: 'folder', id: folderId, name: title.trim() });
        } else { toast.error('Erro ao criar documento: ' + error?.message); }
      }
    });
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
    const { error } = await supabase
      .from('user_access')
      .upsert({
        user_id: userId,
        space_ids: spaceIds,
        folder_ids: folderIds,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

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
    const { error } = await supabase.from('profiles').update({ avatar: avatarUrl }).eq('id', userId);
    if (!error) {
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, avatar: avatarUrl } : u));
      if (currentUser.id === userId) {
        setCurrentUser(prev => ({ ...prev, avatar: avatarUrl }));
      }
    } else {
      console.error('Erro ao atualizar avatar:', error);
      throw error;
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
        header_image: updatedDoc.headerImage
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

          // T604 — Automation Engine connected
          // Fire-and-forget: fetch active automations for this task's list and run them
          const listId = t.listId;
          if (listId) {
            supabase
              .from('automations')
              .select('*')
              .eq('list_id', listId)
              .eq('trigger_type', 'status_changed')
              .eq('is_active', true)
              .then(({ data: automations }) => {
                if (!automations) return;
                automations.forEach(async (automation) => {
                  const conditionsMet = AutomationEngine.evaluateConditions(
                    updatedTask,
                    automation.conditions ?? []
                  );
                  if (conditionsMet) {
                    await AutomationEngine.executeActions(
                      updatedTask,
                      automation.actions ?? [],
                      {
                        updateTask: (id: string, updates: any) =>
                          handleUpdateTask(id, updates),
                        notify: (msg: string) =>
                          toast.info(msg)
                      }
                    );
                  }
                });
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
    const { data, error } = await supabase
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
    const { data: folderData, error: folderError } = await supabase
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

      const { data: listData, error: listError } = await supabase
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

  const handleConfirmCreateList = async (folderId: string, name: string, statusGroupId: string) => {
    const folder = folders.find((f) => f.id === folderId);

    const { data, error } = await supabase
      .from('lists')
      .insert({
        name: name.trim(),
        folder_id: folderId,
        status_group_id: statusGroupId
      })
      .select()
      .single();

    if (data && !error) {
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
    }
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

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newTaskPartial.title || 'Nova Tarefa',
          description: newTaskPartial.description || '',
          status: newTaskPartial.status || defaultStatus,
          priority: newTaskPartial.priority || TaskPriority.MEDIA,
          main_assignee_id: newTaskPartial.mainAssigneeId || currentUser.id,
          secondary_assignee_ids: [],
          start_date: new Date().toISOString().split('T')[0],
          due_date: (newTaskPartial.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()).split('T')[0],
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

    // Automatically switch to List view if navigating to a Space or Folder, unless already on Kanban
    if (type !== 'global' && activeView === 'Dashboard') {
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

  // Filter Tasks based on Hierarchy ONLY (for Dashboard)
  const scopeTasks = useMemo(() => {
    let baseTasks = tasks;

    // Se não for ADMIN, filtramos as tarefas globais pelas pastas permitidas
    if (currentUser.role !== UserRole.ADMIN) {
      const access = userAccess[currentUser.id];
      const allowedFolderIds = access?.folderIds || [];
      const allowedListIds = lists.filter(l => allowedFolderIds.includes(l.folderId)).map(l => l.id);
      baseTasks = tasks.filter(t => allowedListIds.includes(t.listId));
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
  }, [tasks, activeScope, lists, folders, currentUser, userAccess]);

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

    return result;
  }, [scopeTasks, activeListId, searchQuery, currentUser, activeScope]);

  const filteredSpaces = useMemo(() => {
    if (currentUser.role === UserRole.ADMIN) return spaces;
    const access = userAccess[currentUser.id];
    if (!access) return [];
    return spaces.filter((s) => access.spaceIds.includes(s.id));
  }, [spaces, userAccess, currentUser]);

  const filteredFolders = useMemo(() => {
    if (currentUser.role === UserRole.ADMIN) return folders;
    const access = userAccess[currentUser.id];
    if (!access) return [];
    return folders.filter((f) => access.folderIds.includes(f.id));
  }, [folders, userAccess, currentUser]);

  const uiScaleClass = uiScale <= 0.9 ? 'text-xs' : uiScale >= 1.2 ? 'text-base' : 'text-sm';

  // Auth guard
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-slate-900 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-white font-bold text-xl">VP CLICK</p>
          <p className="text-slate-400 text-sm mt-1">Verificando sessão...</p>
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
          onDeleteList={handleDeleteList}
          onRenameList={handleRenameList}
          docs={docs}
          activeDocId={activeDocId}
          onSetActiveDocId={setActiveDocId}
          onCreateDoc={handleCreateDoc}
          onDeleteDoc={handleDeleteDoc}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted">
          {/* Header */}
          <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-800 hidden md:block">
                {activeScope.name}
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
            </div>

            <div className="flex items-center gap-4 relative">
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
                <ViewTab active={activeView === 'List'} onClick={() => setActiveView('List')} label="Lista" />
                <ViewTab active={activeView === 'Kanban'} onClick={() => setActiveView('Kanban')} label="Kanban" />
                <ViewTab active={activeView === 'Calendar'} onClick={() => setActiveView('Calendar')} label="Calendário" />
                <ViewTab active={activeView === 'Gantt'} onClick={() => setActiveView('Gantt')} label="Gantt" />
                <ViewTab active={activeView === 'Table'} onClick={() => setActiveView('Table')} label="Tabela" />
                <ViewTab active={activeView === 'Dashboard'} onClick={() => setActiveView('Dashboard')} label="Dashboards" />
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
                context={activeScope}
                onQuickCreate={(prefill?: any) => {
                  setPrefilledTaskData(prefill || null);
                  setIsTaskModalOpen(true);
                }}
                onDeleteTask={handleDeleteTask}
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
                users={adminUsers}
                statusGroups={statusGroups}
                lists={lists}
                activeListId={activeListId}
              />
            )}
            {activeView === 'Dashboard' && (
              // We pass scopeTasks here so the Dashboard reflects the Space/Folder metrics, ignoring search query for stats
              <DashboardView tasks={scopeTasks} users={adminUsers} statusGroups={statusGroups} activeListId={activeListId} lists={lists} />
            )}
            {activeView === 'Calendar' && (
              <CalendarView 
                tasks={filteredTasks} 
                users={adminUsers} 
                onTaskClick={setSelectedTaskId} 
                onAddTaskAtDate={(date) => {
                  setPrefilledTaskData({ due_date: date.toISOString().split('T')[0] as any });
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
              />
            )}
            {activeView === 'Doc' && activeDocId && (
              <DocView
                doc={docs.find(d => d.id === activeDocId)!}
                onUpdate={handleUpdateDoc}
                currentUser={currentUser}
                uploadFile={uploadFile}
              />
            )}
          </main>
        </div>

        {/* Task Detail Modal */}
        <CreateListModal
          isOpen={isCreateListModalOpen}
          onClose={() => setIsCreateListModalOpen(false)}
          onConfirm={(name, statusGroupId) => {
            if (createListFolderId) {
              handleConfirmCreateList(createListFolderId, name, statusGroupId);
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
              setIsSharedTaskView(false);
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
            onSelectTask={setSelectedTaskId}
            onQuickCreate={(prefill?: any) => {
              setPrefilledTaskData(prefill || null);
              setIsTaskModalOpen(true);
            }}
            isReadOnly={isSharedTaskView}
            saveAttachment={saveTaskAttachment}
            removeAttachment={removeTaskAttachment}
            saveComment={saveTaskComment}
            saveExtensionLog={saveExtensionLog}
            saveTaskActivity={saveTaskActivity}
            uploadFile={uploadFile}
            statusGroups={statusGroups}
            lists={lists}
          />
        )}

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
            activeListId={activeListId}
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
          <CommandInput placeholder="Digite um comando ou busque uma tarefa..." />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup heading="Navegação Direta">
              <CommandItem onSelect={() => { setActiveView('List'); setIsCommandOpen(false); }}>
                <Icons.List className="mr-2 h-4 w-4" />
                <span>Ir para Lista</span>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveView('Kanban'); setIsCommandOpen(false); }}>
                <Icons.Columns className="mr-2 h-4 w-4" />
                <span>Ir para Kanban</span>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveView('Gantt'); setIsCommandOpen(false); }}>
                <Icons.GanttIcon className="mr-2 h-4 w-4" />
                <span>Ir para Gantt</span>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveView('Calendar'); setIsCommandOpen(false); }}>
                <Icons.Calendar className="mr-2 h-4 w-4" />
                <span>Ir para Calendário</span>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveView('Admin'); setIsCommandOpen(false); }}>
                <Icons.Shield className="mr-2 h-4 w-4" />
                <span>Configurações Admin</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Ações Rápidas">
              <CommandItem onSelect={() => { setIsTaskModalOpen(true); setIsCommandOpen(false); }}>
                <Icons.Plus className="mr-2 h-4 w-4" />
                <span>Criar Nova Tarefa</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Tarefas Ativas">
              {tasks.slice(0, 10).map((t: Task) => (
                <CommandItem key={t.id} onSelect={() => { setSelectedTaskId(t.id); setIsCommandOpen(false); }}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${t.priority === TaskPriority.URGENTE ? 'bg-red-500' : 'bg-blue-400'}`} />
                  <span>{t.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </SSOHandler>
  );
}

function DocView({ doc, onUpdate, currentUser, uploadFile }: {
  doc: Doc,
  onUpdate: (doc: Doc) => void,
  currentUser: User,
  uploadFile: (file: File, path: string, bucket?: string) => Promise<string | null>
}) {
  const [headerImage, setHeaderImage] = useState(doc.headerImage || '');
  const [title, setTitle] = useState(doc.title);
  const [isUploading, setIsUploading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(doc.title);
    setHeaderImage(doc.headerImage || '');
    if (contentRef.current && contentRef.current.innerHTML !== doc.content) {
      contentRef.current.innerHTML = doc.content;
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
    const path = `headers/${doc.id}_${Date.now()}_${file.name}`;
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
    const path = `attachments/${doc.id}/${Date.now()}_${file.name}`;
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

    if (data && !error) {
      const savedAttachment: Attachment = {
        ...attachment,
        id: data.id,
        uploadedAt: data.uploaded_at
      };
      onUpdate({
        ...doc,
        attachments: [...(doc.attachments || []), savedAttachment]
      });
    } else {
      console.error('Erro ao salvar anexo:', error);
      alert('Erro ao salvar anexo no banco de dados.');
    }
  };

  const removeAttachment = async (id: string) => {
    const { error } = await supabase
      .from('doc_attachments')
      .delete()
      .eq('id', id);

    if (!error) {
      onUpdate({
        ...doc,
        attachments: (doc.attachments || []).filter(a => a.id !== id)
      });
    } else {
      console.error('Erro ao remover anexo:', error);
    }
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
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Título do Documento"
          className="w-full text-5xl font-black text-gray-900 border-none focus:ring-0 placeholder:text-gray-100 p-0"
        />

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
          dangerouslySetInnerHTML={{ __html: doc.content }}
          className="w-full min-h-[300px] text-xl text-gray-700 leading-relaxed outline-none prose prose-orange max-w-none focus:prose-orange"
        />

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={(e) => e.stopPropagation()}>
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

function Sidebar({
  themePreset,
  spaces, folders, lists, activeView, activeScope, activeListId, onSetActiveListId, onNavigate, onViewChange, isCollapsed, onToggle,
  onOpenFields, onOpenCreateSpace, onOpenCreateFolder, onCreateList, userRole,
  onRenameSpace, onDeleteSpace, onRenameFolder, onDeleteFolder,
  onDeleteList, onRenameList,
  docs, activeDocId, onSetActiveDocId, onCreateDoc, onDeleteDoc
}: any) {
  const compactLogo = "https://verticalparts.com.br/wp-content/uploads/2026/01/grp__NM__bg__NM__logo_compacto-1.png";
  const isNonLightTheme = themePreset !== "claro";
  const logoSrc = isNonLightTheme ? compactLogoWhite : compactLogo;
  const logoStyle = isNonLightTheme ? undefined : ({ filter: 'brightness(0)' } as React.CSSProperties);

  const [expandedSpaces, setExpandedSpaces] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);

  useEffect(() => {
    // Expand the space if we navigate to it or one of its folders
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

  const toggleSpace = (spaceId: string) => {
    setExpandedSpaces(prev =>
      prev.includes(spaceId) ? prev.filter(id => id !== spaceId) : [...prev, spaceId]
    );
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev =>
      prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
    );
  };

  return (
    <div className={`flex flex-col border-r bg-sidebar text-sidebar-foreground h-full shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`} onClick={(e) => e.stopPropagation()}>
      <div className={`p-4 flex items-center border-b mb-2 transition-all duration-300 ${isCollapsed ? 'flex-col gap-4' : 'justify-between'}`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <img
              src={logoSrc}
              alt="Logo Verticalparts"
              className="w-8 h-8 object-contain shrink-0"
              style={logoStyle}
            />
            <span className="font-bold text-lg tracking-tight whitespace-nowrap text-sidebar-foreground">VERTICALPARTS</span>
          </div>
        ) : (
          <img
            src={logoSrc}
            alt="Logo Verticalparts"
            className="w-10 h-10 object-contain"
            style={logoStyle}
          />
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 transition-transform"
        >
          {isCollapsed ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar overflow-x-hidden">
        <SidebarItem
          icon={<Icons.Home />}
          label="Início"
          isCollapsed={isCollapsed}
          active={activeScope.type === 'global'}
          onClick={() => onNavigate('global', null, 'Dashboard')}
        />
        <SidebarItem
          icon={<Icons.Check />}
          label="Minhas Tarefas"
          isCollapsed={isCollapsed}
          active={activeView === 'List' && activeScope.type === 'global'}
          onClick={() => { onNavigate('global', null, 'Minhas Tarefas'); onViewChange('List'); }}
        />
        {/* <SidebarItem icon={<Icons.Folder />} label="Projetos" isCollapsed={isCollapsed} /> */}

        {(userRole === UserRole.ADMIN || userRole === UserRole.GESTOR) && (
          <SidebarItem icon={<Icons.Plus />} label="Campos Pers." isCollapsed={isCollapsed} onClick={onOpenFields} />
        )}

        <div className="pt-4 pb-2">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-3 mb-2 group">
              <p className="text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest transition-opacity duration-200">Espaços</p>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenCreateSpace(); }}
                className="text-sidebar-foreground/40 hover:text-primary transition-colors p-1 rounded hover:bg-sidebar-accent"
                title="Criar Espaço"
              >
                <Icons.Plus />
              </button>
            </div>
          )}
          {spaces.map((space: Space) => {
            const isExpanded = expandedSpaces.includes(space.id);
            return (
              <div key={space.id} className="mb-1">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-all relative ${isCollapsed ? 'justify-center' : ''} ${activeScope.type === 'space' && activeScope.id === space.id ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/50'
                    }`}
                  title={isCollapsed ? space.name : ''}
                  onClick={() => {
                    const isActiveSpace = activeScope.type === 'space' && activeScope.id === space.id;
                    toggleSpace(space.id);
                    // Se já estiver no mesmo espaço, o clique serve só para recolher/expandir as pastas
                    if (!isActiveSpace) {
                      onNavigate('space', space.id, space.name);
                    }
                  }}
                >
                  {/* Chevron for collapse */}
                  {!isCollapsed && (
                    <div className={`text-sidebar-foreground/40 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                      <Icons.ChevronRight />
                    </div>
                  )}

                  {space.icon ? (
                    (() => {
                      const IconComponent = (Icons as any)[space.icon] || Icons.Layout;
                      return <IconComponent className="w-5 h-5 shrink-0" color={space.color} />;
                    })()
                  ) : (
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px]" style={{ backgroundColor: space.color, color: 'white' }}>
                      {space.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {!isCollapsed && (
                    <>
                      <span className={`text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${activeScope.type === 'space' && activeScope.id === space.id ? 'text-sidebar-foreground font-bold' : 'text-sidebar-foreground/80'}`}>
                        {space.name}
                      </span>

                      {/* Space Actions (Hover) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 bg-white/80 rounded shadow-sm z-10 px-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onRenameSpace(space.id, space.name); }}
                          className="p-1.5 text-sidebar-foreground/40 hover:text-blue-500 rounded"
                          title="Renomear"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteSpace(space.id); }}
                          className="p-1.5 text-sidebar-foreground/40 hover:text-red-500 rounded"
                          title="Excluir"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Accordion Content */}
                {!isCollapsed && isExpanded && (
                  <div className="ml-5 space-y-0.5 mt-1 border-l pl-2 animate-in slide-in-from-top-2 duration-200">
                    {folders.filter((f: Folder) => f.spaceId === space.id).map((folder: Folder) => {
                      const isFolderExpanded = expandedFolders.includes(folder.id);
                      return (
                        <div key={folder.id} className="space-y-0.5">
                          <div
                            className={`text-[11px] flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition-colors group relative ${activeScope.type === 'folder' && activeScope.id === folder.id
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-bold'
                              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                              }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const isActiveFolder = activeScope.type === 'folder' && activeScope.id === folder.id;
                              toggleFolder(folder.id);
                              // Se já estiver na mesma pasta, o clique serve só para recolher/expandir as listas
                              if (!isActiveFolder) {
                                onNavigate('folder', folder.id, folder.name);
                              }
                            }}
                          >
                            <div className={`text-sidebar-foreground/40 transition-transform duration-200 ${isFolderExpanded ? 'rotate-90' : ''}`}
                              aria-hidden
                            >
                              <Icons.ChevronRight />
                            </div>
                            <Icons.Folder />
                            <span className="truncate flex-1">{folder.name}</span>

                            {/* Folder Actions (Hover) */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded backdrop-blur-sm shadow-sm absolute right-1 z-10 px-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 text-sidebar-foreground/40 hover:text-sidebar-foreground"
                                    title="Ações"
                                    aria-label={`Ações da pasta ${folder.name}`}
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={6}>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-xs">
                                      Criar novo
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      <DropdownMenuItem
                                        className="text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onCreateList?.(folder.id);
                                        }}
                                      >
                                        <ListPlus className="mr-2 h-3.5 w-3.5" />
                                        Criar lista
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onCreateDoc(folder.id);
                                        }}
                                      >
                                        <FileText className="mr-2 h-3.5 w-3.5" />
                                        Novo documento
                                      </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRenameFolder(folder.id, folder.name);
                                    }}
                                  >
                                    Renomear pasta
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteFolder(folder.id);
                                    }}
                                  >
                                    Excluir pasta
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Lists inside folder */}
                          {isFolderExpanded && (
                            <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-2">
                              {(lists as List[])
                                .filter((l) => l.folderId === folder.id)
                                .map((list: List) => {
                                  const isActive = activeListId === list.id;
                                  return (
                                    <div
                                      key={list.id}
                                      className={
                                        "text-[11px] flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition-colors group relative " +
                                        (isActive
                                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50")
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSetActiveListId?.(list.id);
                                        setTimeout(() => {
                                          onViewChange?.('List');
                                        }, 0);
                                      }}
                                      title={list.name}
                                    >
                                      <Icons.List />
                                      <span className="truncate flex-1">{list.name}</span>

                                      {/* List Actions (Hover) */}
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded backdrop-blur-sm shadow-sm absolute right-1 z-10 px-1">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button
                                              onClick={(e) => e.stopPropagation()}
                                              className="p-1 text-sidebar-foreground/40 hover:text-sidebar-foreground"
                                              title="Ações"
                                              aria-label={`Ações da lista ${list.name}`}
                                            >
                                              <MoreHorizontal className="h-3.5 w-3.5" />
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" sideOffset={6}>
                                            <DropdownMenuItem
                                              className="text-xs"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onRenameList(list.id, list.name);
                                              }}
                                            >
                                              Renomear lista
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              className="text-xs text-red-600 focus:text-red-600"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteList(list.id);
                                              }}
                                            >
                                              Excluir lista
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  );
                                })}

                              {/* Documents inside folder */}
                              {docs
                                .filter((d) => d.folderId === folder.id)
                                .map((doc: Doc) => {
                                  const isActive = activeDocId === doc.id;
                                  return (
                                    <div
                                      key={doc.id}
                                      className={`ml-5 flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition-colors group relative ${isActive ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSetActiveDocId(doc.id);
                                        onViewChange('Doc');
                                        onNavigate('folder', folder.id, doc.title);
                                      }}
                                    >
                                      <FileText className="h-3 w-3 text-sidebar-foreground/40" />
                                      <span className="truncate flex-1 text-xs">{doc.title}</span>

                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteDoc(doc.id);
                                          }}
                                          className="p-1 text-sidebar-foreground/40 hover:text-red-500"
                                          title="Excluir documento"
                                        >
                                          <Icons.Trash />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCreateList?.(folder.id);
                                }}
                                className="w-full text-left text-[11px] text-sidebar-foreground/50 hover:text-primary flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-sidebar-accent/50 transition-colors"
                                title="Criar Lista"
                              >
                                <Icons.Plus /> <span>Nova Lista</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenCreateFolder(space.id); }}
                      className="w-full text-left text-[11px] text-sidebar-foreground/50 hover:text-primary flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-sidebar-accent/50 transition-colors"
                    >
                      <Icons.Plus /> <span>Nova Pasta</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className={`p-4 border-t transition-all duration-300 ${isCollapsed ? 'text-center' : ''}`}>
        {!isCollapsed ? (
          <div className="text-[10px] text-sidebar-foreground/40 text-center uppercase tracking-widest">
            v2.0.0 Gold
          </div>
        ) : (
          <div className="text-[10px] text-[var(--primary-color)] font-bold text-center">v2.0</div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, isCollapsed, active, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${isCollapsed ? 'justify-center' : ''} ${active ? 'bg-sidebar-accent text-primary' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50'
        }`}
      title={isCollapsed ? label : ''}
    >
      <div className={`${active ? 'text-primary' : 'text-sidebar-foreground/40'} group-hover:text-primary transition-colors shrink-0`}>
        {icon}
      </div>
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
      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary-color)]" />}
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

function getTaskHealth(task: Task) {
  const status = (task.status || '').toLowerCase();
  if (status.includes('conclu') || status.includes('aprovado') || status.includes('fechado')) {
    return { emoji: '🎉', label: 'Missão cumprida!', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
  }
  if (!task.dueDate) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate); due.setHours(23, 59, 59, 999);
  const start = task.startDate ? new Date(task.startDate) : null;

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
      const uniqueStatuses = Array.from(new Set(tasks.map((t: Task) => t.status)));
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
    () => activeListId ?? (listIdsInView.length === 1 ? listIdsInView[0] : null),
    [activeListId, listIdsInView],
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


  const grouped = useMemo(() => {
    return statusOrder
      .map((status) => ({
        status,
        tasks: (tasks as Task[]).filter((t) => t.status === status && !t.parentId),
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
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="w-10 px-3 py-3">
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
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[300px]">Tarefa</th>

                        {orderedColumns.map((col) => (
                          <th
                            key={col.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, col.id)}
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => handleDragEnter(e, col.id)}
                            onDragEnd={handleDragEnd}
                            onDrop={handleDrop}
                            className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap cursor-move hover:bg-gray-100 transition-colors ${draggedColumnId === col.id ? 'bg-blue-50 opacity-40' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{col.name}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (col.type === 'standard') {
                                    if (!derivedActiveListId) return;
                                    onToggleStandardColumn?.(derivedActiveListId, col.id as any);
                                  } else {
                                    // Custom Field Logic
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
                                className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                                title={`Ocultar ${col.name}`}
                              >
                                {col.type === 'standard' ? <Icons.EyeOff /> : <Icons.Trash />}
                              </button>
                            </div>
                          </th>
                        ))}

                        <th className="px-2 py-3 w-10">
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
                              className={`hover:bg-gray-50 cursor-pointer group transition-colors ${depth > 0 ? 'bg-gray-50/30' : ''} ${selectedTaskIds.has(t.id) ? 'bg-blue-50/40' : ''}`}
                              onClick={() => onSelectTask(t.id)}
                            >
                              <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 cursor-pointer"
                                  checked={selectedTaskIds.has(t.id)}
                                  onChange={() => toggleSelection(t.id)}
                                />
                              </td>
                              <td className="px-4 py-3">
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
                                        <td key={col.id} className="px-4 py-3">
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
                                        <td key={col.id} className="px-4 py-3">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${PRIORITY_COLORS[t.priority]}`}>
                                            {t.priority}
                                          </span>
                                        </td>
                                      );
                                    case 'assignee':
                                      return (
                                        <td key={col.id} className="px-4 py-3">
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
                                        <td key={col.id} className="px-4 py-3 text-center">
                                          <span className={`text-xs font-bold ${t.extensionCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {t.extensionCount}
                                          </span>
                                        </td>
                                      );
                                    case 'dueDate':
                                      return (
                                        <td key={col.id} className="px-4 py-3 text-[10px] text-gray-500 font-medium whitespace-nowrap uppercase">
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
                                  <td key={col.id} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    {field.type === CustomFieldType.FORMULA ? (
                                      <div className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 italic">
                                        {FormulaParser.evaluate(field.config?.formula || '', { ...t, ...Object.fromEntries(fieldValues.filter(fv => fv.entityId === t.id).map(fv => [customFields.find(f => f.id === fv.fieldId)?.name || '', fv.value])) })}
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
                                        <input
                                          type="date"
                                          value={currentValue ?? ''}
                                          onChange={(e) => onUpdateFieldValue(field.id, t.id, e.target.value)}
                                          className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                                        />
                                      ) : field.type === CustomFieldType.RATING ? (
                                        <div className="flex gap-1">
                                          {[1, 2, 3, 4, 5].map((star) => (
                                            <Icons.Star
                                              key={star}
                                              className={`w-4 h-4 cursor-pointer transition-colors ${
                                                Number(currentValue) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 hover:text-yellow-200'
                                              }`}
                                              onClick={() => onUpdateFieldValue(field.id, t.id, star)}
                                            />
                                          ))}
                                        </div>
                                      ) : field.type === CustomFieldType.PROGRESS ? (
                                        <div className="w-full space-y-1">
                                          <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                                            <span>Progresso</span>
                                            <span>{currentValue || 0}%</span>
                                          </div>
                                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                            <div 
                                              className="h-full transition-all duration-500"
                                              style={{ 
                                                width: `${currentValue || 0}%`,
                                                backgroundColor: Number(currentValue) > 75 ? '#22c55e' : Number(currentValue) > 30 ? '#eab308' : '#ef4444'
                                              }}
                                            />
                                          </div>
                                          <input 
                                            type="range" 
                                            min="0" max="100" 
                                            value={currentValue || 0}
                                            onChange={(e) => onUpdateFieldValue(field.id, t.id, e.target.value)}
                                            className="w-full h-1 opacity-0 hover:opacity-100 transition-opacity cursor-pointer accent-orange-500"
                                          />
                                        </div>
                                      ) : (
                                        <div className="relative">
                                          {(field.type === CustomFieldType.MONEY || field.type === CustomFieldType.CURRENCY) && (
                                            <div className="absolute left-2 top-2 text-[10px] text-gray-400 font-bold">
                                              {field.config?.currency || 'R$'}
                                            </div>
                                          )}
                                          <input
                                            type={field.type === CustomFieldType.NUMBER || field.type === CustomFieldType.MONEY ? 'number' : 'text'}
                                            value={currentValue ?? ''}
                                            onChange={(e) => onUpdateFieldValue(field.id, t.id, e.target.value)}
                                            className={`h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all ${field.type === CustomFieldType.MONEY ? 'pl-8' : ''}`}
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
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTask(t.id);
                                  }}
                                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="Excluir Tarefa"
                                >
                                  <Icons.Trash />
                                </button>
                              </td>
                            </tr>
                          );
                          const rows = [currentRow];
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

function KanbanView({ tasks, onSelectTask, onStatusChange, onDeleteTask, users, lists, statusGroups, activeListId }: any) {
  // Encontrar o grupo de status para a visualização atual
  const activeList = lists?.find((l: any) => l.id === activeListId);
  const activeStatusGroup = statusGroups?.find((g: any) => g.id === activeList?.statusGroupId) || statusGroups?.[0];
  const activeStatusOptions = activeStatusGroup?.options || [];

  const columns = useMemo(() => {
    if (activeListId && activeStatusOptions.length > 0) {
      return activeStatusOptions.map((o: any) => o.label);
    }
    const uniqueStatuses = Array.from(new Set(tasks.map((t: Task) => t.status)));
    const defaultOrder = statusGroups?.[0]?.options.map((o: any) => o.label) || [];
    return uniqueStatuses.sort((a: any, b: any) => {
      const idxA = defaultOrder.indexOf(a);
      const idxB = defaultOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [tasks, activeListId, JSON.stringify(activeStatusOptions), JSON.stringify(statusGroups?.[0]?.options)]);

  const getStatusColor = (statusLabel: string) => {
    const sLower = (statusLabel || '').toLowerCase();
    const opt = activeStatusOptions.find((o: any) => o.label?.toLowerCase() === sLower) ||
      statusGroups?.flatMap((g: any) => g.options).find((o: any) => o.label?.toLowerCase() === sLower);
    if (opt?.color) return opt.color;
    return '#94a3b8';
  };

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar items-start" onClick={(e) => e.stopPropagation()}>
      {columns.map(status => (
        <div key={status} className="w-80 shrink-0 flex flex-col max-h-full bg-gray-50 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-gray-600 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(status) }} />
              {status}
              <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">
                {tasks.filter((t: Task) => t.status === status).length}
              </span>
            </h3>
            <button className="text-gray-400 hover:text-gray-600"><Icons.Plus /></button>
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 custom-scrollbar min-h-0">
            {tasks.filter((t: Task) => t.status === status).map((task: Task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:border-[var(--primary-color)] cursor-pointer transition-all group relative"
              >
                {/* Delete Button for Kanban Card */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                  className="absolute top-2 right-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 z-10"
                  title="Excluir Tarefa"
                >
                  <Icons.Trash />
                </button>

                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
                    {task.priority}
                  </span>
                  {task.extensionCount > 0 && (
                    <span className="text-[10px] text-red-500 font-bold bg-red-50 px-1 rounded flex items-center gap-0.5 mr-6">
                      <Icons.Clock /> {task.extensionCount}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2 leading-tight line-clamp-2 pr-4">{task.title}</h4>
                {(() => { const h = getTaskHealth(task); return h ? (
                  <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mb-2 ${h.bg} ${h.text} ${h.border}`}>
                    <span>{h.emoji}</span><span>{h.label}</span>
                  </div>
                ) : null; })()}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Icons.Calendar />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </div>
                  <div className="flex -space-x-2">
                    <img
                      src={users?.find((u: User) => u.id === task.mainAssigneeId)?.avatar || `https://picsum.photos/seed/${task.mainAssigneeId}/100`}
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-[3] hover:z-50 transition-all cursor-pointer bg-white"
                      alt="User"
                      title={users?.find((u: User) => u.id === task.mainAssigneeId)?.name}
                    />
                    {(task.secondaryAssigneeIds || []).map((id: string) => (
                      <img
                        key={id}
                        src={users?.find((u: User) => u.id === id)?.avatar || `https://picsum.photos/seed/${id}/100`}
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-[3] hover:z-50 transition-all cursor-pointer bg-white"
                        alt="User"
                        title={users?.find((u: User) => u.id === id)?.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardView({ tasks, users, statusGroups, activeListId, lists }: any) {
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
      const ref = t.dueDate || t.startDate;
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
      done:    { label: 'Missão cumprida',     emoji: '🎉', color: '#10b981', bg: '#d1fae5', count: 0 },
      ok:      { label: 'Tranquilo, em dia',   emoji: '😄', color: '#3b82f6', bg: '#dbeafe', count: 0 },
      warning: { label: 'Atenção ao prazo',    emoji: '😅', color: '#f59e0b', bg: '#fef9c3', count: 0 },
      urgent:  { label: 'Cuidado, últimos dias', emoji: '😰', color: '#f97316', bg: '#ffedd5', count: 0 },
      late:    { label: 'Atrasado! Corra',     emoji: '😡', color: '#ef4444', bg: '#fee2e2', count: 0 },
      waiting: { label: 'Aguardando início',   emoji: '⏰', color: '#6b7280', bg: '#f3f4f6', count: 0 },
      nodate:  { label: 'Sem prazo definido',  emoji: '—',  color: '#d1d5db', bg: '#f9fafb', count: 0 },
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
      else buckets.nodate.count++;
    });

    return Object.values(buckets);
  }, [filteredTasks]);

  const totalWithHealth = filteredTasks.length || 1;

  // --- Status distribution ---
  const statusData = useMemo(() => {
    const statuses = activeListId
      ? activeStatusOptions.map((o: any) => o.label)
      : Array.from(new Set(filteredTasks.map((t: Task) => t.status)));
    return (statuses as string[]).map((status) => ({
      name: status,
      value: filteredTasks.filter((t: Task) => t.status === status).length
    })).filter((d: any) => d.value > 0);
  }, [filteredTasks, activeListId, activeStatusOptions]);

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
      .sort((a: any, b: any) => b.total - a.total)
  , [filteredTasks, users]);

  // --- Priority breakdown ---
  const priorityData = useMemo(() => {
    const map: Record<string, { color: string; count: number }> = {
      'URGENTE': { color: '#ef4444', count: 0 },
      'ALTA':    { color: '#f97316', count: 0 },
      'MÉDIA':   { color: '#f59e0b', count: 0 },
      'BAIXA':   { color: '#3b82f6', count: 0 },
      'SEM PRIORIDADE': { color: '#6b7280', count: 0 },
    };
    filteredTasks.forEach((t: Task) => {
      const p = (t.priority || 'SEM PRIORIDADE').toUpperCase();
      if (map[p]) map[p].count++;
      else map['SEM PRIORIDADE'].count++;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).filter(d => d.count > 0);
  }, [filteredTasks]);

  // --- KPI values ---
  const total = filteredTasks.length;
  const concluidas = filteredTasks.filter((t: Task) => isConcluido(t.status)).length;
  const atrasadas = healthBuckets.find(b => b.emoji === '😡')?.count || 0;
  const emDia = healthBuckets.find(b => b.emoji === '😄')?.count || 0;
  const criticas = healthBuckets.find(b => b.emoji === '😰')?.count || 0;
  const prorrogadas = tasks.filter((t: Task) => (t.extensionCount || 0) > 0).length;
  const taxaConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280', '#a855f7', '#06b6d4'];

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
          { emoji: '📋', title: 'Total', value: total, sub: 'tarefas', bg: 'bg-blue-50', text: 'text-blue-700' },
          { emoji: '🎉', title: 'Concluídas', value: concluidas, sub: `${taxaConclusao}% do total`, bg: 'bg-green-50', text: 'text-green-700' },
          { emoji: '😡', title: 'Atrasadas', value: atrasadas, sub: 'precisam de atenção', bg: 'bg-red-50', text: 'text-red-700' },
          { emoji: '😄', title: 'Em Dia', value: emDia, sub: 'dentro do prazo', bg: 'bg-sky-50', text: 'text-sky-700' },
          { emoji: '😰', title: 'Críticas', value: criticas, sub: 'últimos dias de prazo', bg: 'bg-orange-50', text: 'text-orange-700' },
          { emoji: '⚠️', title: 'Prorrogadas', value: prorrogadas, sub: 'tiveram extensão', bg: 'bg-yellow-50', text: 'text-yellow-700' },
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
          <h3 className="font-bold text-gray-700 mb-5 flex items-center gap-2">👥 Performance por Usuário</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={userPerformance} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" />
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
          <div className="flex items-center gap-5 mt-3 justify-center">
            {[[primaryChartColor, 'Total'], ['#10b981', 'Concluídas'], ['#ef4444', 'Atrasadas']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 mb-5">🎯 Distribuição de Status</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {statusData.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any, name: string) => [val, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {statusData.map((d: any, i: number) => (
              <div key={d.name} className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="truncate max-w-[120px]">{d.name}</span>
                </div>
                <span className="font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 4: Priority breakdown + Team Ranking ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 mb-5">🔥 Distribuição por Prioridade</h3>
          <div className="flex flex-col gap-3">
            {priorityData.map(p => {
              const pct = Math.round((p.count / totalWithHealth) * 100);
              return (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-600 w-32 shrink-0">{p.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: p.color }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-10 text-right shrink-0">{p.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-gray-700 mb-5">🏆 Ranking da Equipe</h3>
          <div className="flex flex-col gap-2">
            {userPerformance.slice(0, 7).map((u: any, i: number) => {
              const taxa = u.total > 0 ? Math.round((u.concluidas / u.total) * 100) : 0;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
              return (
                <div key={u.fullName} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-base w-7 text-center shrink-0">{medal}</span>
                  <img src={u.avatar || `https://picsum.photos/seed/${u.fullName}/100`} className="w-7 h-7 rounded-full border shrink-0" alt={u.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{u.fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${taxa}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500 shrink-0">{taxa}%</span>
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
    if (newStart && newDuration && Number(newDuration) > 0) {
      const d = new Date(newStart);
      d.setDate(d.getDate() + Number(newDuration));
      setDueDate(d.toISOString().split('T')[0]);
    }
  };

  // Hierarchy Selection State
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedListId, setSelectedListId] = useState<string>('');

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

  // Auto-select space when there's only one option and nothing is selected yet
  useEffect(() => {
    if (spaces.length === 1 && !selectedSpaceId) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [spaces, selectedSpaceId]);

  // Auto-select folder when there's only one option in the chosen space
  useEffect(() => {
    if (availableFolders.length === 1 && !selectedFolderId) {
      setSelectedFolderId(availableFolders[0].id);
    }
  }, [availableFolders, selectedFolderId]);

  // Auto-select list if only one exists or if user just selected a folder
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
                      {users.map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}
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
                  <label className="text-xs font-bold text-gray-400 uppercase">Duração (dias)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 11"
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
                  className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <p className="text-[10px] text-gray-400 mt-1">Calculada automaticamente ou edite manualmente</p>
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
    tasks,
    onSelectTask,
    onQuickCreate,
    isReadOnly = false,
    saveAttachment,
    removeAttachment: removeTaskAttachment,
    saveComment,
    saveExtensionLog,
    saveTaskActivity,
    uploadFile,
    statusGroups,
    lists
  } = props;

  const currentList = lists?.find((l: any) => l.id === task.listId);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newComment, setNewComment] = useState('');
  const [description, setDescription] = useState(task.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);

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

  const handleUpdateStatus = async (status: string) => {
    if (status === task.status) return;
    if (saveTaskActivity) {
      await saveTaskActivity(task.id, 'STATUS_CHANGE', task.status, status);
    }
    onUpdate({ ...task, status });
  };

  const handleUpdatePriority = async (priority: TaskPriority) => {
    if (priority === task.priority) return;
    if (saveTaskActivity) {
      await saveTaskActivity(task.id, 'PRIORITY_CHANGE', task.priority, priority);
    }
    onUpdate({ ...task, priority });
  };

  const handleToggleSecondaryAssignee = async (userId: string) => {
    const isMain = task.mainAssigneeId === userId;
    if (isMain) return; // Can't remove main this way

    const isSecondary = (task.secondaryAssigneeIds || []).includes(userId);
    let nextSecondaryIds = [...(task.secondaryAssigneeIds || [])];

    if (isSecondary) {
      nextSecondaryIds = nextSecondaryIds.filter(id => id !== userId);
      if (saveTaskActivity) {
        await saveTaskActivity(task.id, 'RESPONSIBLE_REMOVED', users.find((u: any) => u.id === userId)?.name);
      }
    } else {
      nextSecondaryIds.push(userId);
      if (saveTaskActivity) {
        await saveTaskActivity(task.id, 'RESPONSIBLE_ADDED', '', users.find((u: any) => u.id === userId)?.name);
      }
    }

    onUpdate({ ...task, secondaryAssigneeIds: nextSecondaryIds });
  };

  const handleSetMainAssignee = async (userId: string) => {
    if (task.mainAssigneeId === userId) return;

    const oldMainName = users.find((u: any) => u.id === task.mainAssigneeId)?.name;
    const newMainName = users.find((u: any) => u.id === userId)?.name;

    if (saveTaskActivity) {
      await saveTaskActivity(task.id, 'MAIN_RESPONSIBLE_CHANGE', oldMainName, newMainName);
    }

    // Move current main to secondary if not already there, and remove new main from secondary
    let nextSecondaryIds = (task.secondaryAssigneeIds || []).filter(id => id !== userId);
    if (!nextSecondaryIds.includes(task.mainAssigneeId)) {
      nextSecondaryIds.push(task.mainAssigneeId);
    }

    onUpdate({ ...task, mainAssigneeId: userId, secondaryAssigneeIds: nextSecondaryIds });
  };

  const handleSaveDueDate = async () => {
    if (newDueDate === task.dueDate) {
      setIsExtending(false);
      return;
    }

    const log: ExtensionLog = {
      id: Math.random().toString(36).substr(2, 9),
      oldDate: task.dueDate,
      newDate: newDueDate,
      reason: extensionReason || 'Sem motivo detalhado',
      updatedBy: currentUser.id,
      timestamp: new Date().toISOString()
    };

    if (saveExtensionLog) {
      await saveExtensionLog(task.id, log);
    }

    onUpdate({
      ...task,
      dueDate: newDueDate,
      extensionCount: (task.extensionCount || 0) + 1,
      extensionHistory: [log, ...(task.extensionHistory || [])]
    });
    setIsExtending(false);
    setExtensionReason('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (uploadFile && saveAttachment) {
        const path = `tasks/${task.id}/${Date.now()}_${file.name}`;
        const url = await uploadFile(file, path, 'task-files');
        if (url) {
          await saveAttachment(task.id, {
            name: file.name,
            url,
            type: file.type,
            size: file.size
          });
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
      const success = await saveComment(task.id, newComment);
      if (success) {
        setNewComment('');
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
      <div className="bg-white w-full max-w-[1280px] h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div className="p-4 border-b shrink-0 flex items-center justify-between bg-white px-8">
          <div className="flex items-center gap-4">
            <div className="text-gray-400 p-1 hover:bg-gray-100 rounded cursor-pointer">
              <Icons.ChevronRight className="w-5 h-5 rotate-180" />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
              <span>VerticalParts</span>
              <span>/</span>
              <span>Suporte - Chamados</span>
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
                <button className="flex items-center gap-1.5 px-3 py-1 text-purple-600 font-bold text-xs hover:bg-purple-50 rounded transition-colors ml-2">
                  <Icons.Plus className="w-3 h-3" /> Pergunte à IA
                </button>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">{task.title}</h2>

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
                          Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                          {task.startDate && ` · Início: ${new Date(task.startDate).toLocaleDateString('pt-BR')}`}
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
                        {users.map((u: any) => (
                          <DropdownMenuItem key={u.id} onClick={() => handleSetMainAssignee(u.id)} className="flex items-center gap-3 py-2">
                            <img src={u.avatar || `https://picsum.photos/seed/${u.id}/100`} className="w-6 h-6 rounded-full" alt="" />
                            <span className={`text-sm ${task.mainAssigneeId === u.id ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{u.name}</span>
                            {task.mainAssigneeId === u.id && <Icons.Check className="w-4 h-4 ml-auto text-blue-500" />}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <div className="p-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50 mb-1 rounded-sm">Adicionais</div>
                        {users.filter((u: any) => u.id !== task.mainAssigneeId).map((u: any) => (
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
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Itens de ação</h3>
                  {(task.checklists || []).map((item: ChecklistItem) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100">
                      <div className="w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center cursor-pointer">
                        {item.completed && <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>}
                      </div>
                      <span className={`text-sm ${item.completed ? 'line-through text-gray-300 font-medium' : 'text-gray-700 font-medium'}`}>{item.text}</span>
                    </div>
                  ))}
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
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Dependências</h3>
                  </div>
                  <div className="space-y-4">
                    {(task.dependencies || []).length === 0 && (
                      <p className="text-center py-8 text-sm text-gray-400 font-medium italic">Nenhuma dependência definida.</p>
                    )}
                  </div>
                </div>
              )}
              {detailActiveTab === 'watchers' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Observadores</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {(task.watchers || []).length === 0 && (
                      <p className="col-span-2 text-center py-8 text-sm text-gray-400 font-medium italic">Nenhum observador definido.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Activity Bar (Right) */}
          <div className="w-[380px] border-l bg-white flex flex-col shrink-0">
            <div className="p-6 border-b shrink-0 flex items-center justify-between bg-white text-gray-900">
              <h3 className="text-base font-bold">Atividade</h3>
              <div className="flex items-center gap-3 text-gray-400">
                <Icons.Chart className="w-4 h-4 cursor-pointer hover:text-gray-600" />
                <Icons.Clock className="w-4 h-4 cursor-pointer hover:text-gray-600" />
                <Icons.Search className="w-4 h-4 cursor-pointer hover:text-gray-600" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
              <div className="relative pl-6 space-y-8">
                <div className="absolute left-1.5 top-2 bottom-0 w-px bg-gray-100"></div>
                {unifiedTimeline.map((item: any) => {
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
                    return (
                      <div key={item.id} className="relative">
                        <div className="absolute -left-[28px] top-0 w-6 h-6 rounded-full border-2 border-white shadow-sm overflow-hidden bg-white hover:scale-150 z-10 transition-all cursor-pointer">
                          <img src={users.find((u: any) => u.id === item.userId)?.avatar || `https://picsum.photos/seed/${item.userId}/100`} alt="" />
                        </div>
                        <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 ml-2 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-900">{users.find((u: any) => u.id === item.userId)?.name}</span>
                            <span className="text-[10px] text-gray-300">{formatDate(item.date)}</span>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
                        </div>
                      </div>
                    );
                  }

                  if (item.unifiedType === 'ACTIVITY') {
                    const typeStyles: Record<string, string> = {
                      'STATUS_CHANGE': 'bg-blue-50/30 border-blue-50 text-blue-600 circle-blue-400',
                      'PRIORITY_CHANGE': 'bg-cyan-50/30 border-cyan-50 text-cyan-600 circle-cyan-400',
                      'MAIN_RESPONSIBLE_CHANGE': 'bg-purple-50/30 border-purple-50 text-purple-600 circle-purple-400',
                      'RESPONSIBLE_ADDED': 'bg-green-50/30 border-green-50 text-green-600 circle-green-400',
                      'RESPONSIBLE_REMOVED': 'bg-red-50/30 border-red-50 text-red-600 circle-red-400'
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
                <textarea
                  placeholder="Escreva um comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-sm p-0 resize-none min-h-[60px] custom-scrollbar text-gray-700"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                ></textarea>
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
                  disabled={newDueDate === task.dueDate || !extensionReason.trim()}
                  className="flex-[2] py-3 bg-orange-500 text-white font-black rounded-2xl shadow-xl shadow-orange-100 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                  Salvar Novo Prazo
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
  };

  const cancelEditing = () => {
    setEditingFieldId(null);
    setName('');
    setType(CustomFieldType.TEXT);
    setOptions([]);
  };

  const handleSave = () => {
    if (!name) return;
    const fieldData: any = {
      name,
      type,
      target,
      config: type === CustomFieldType.DROPDOWN ? { options: options.filter(o => o.label.trim() !== '') } : undefined,
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
                    // Logic to hide all? Maybe just a shortcut
                  }}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600"
                >
                  Ocultar tudo
                </button>
              </div>

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
                      className={`w-10 h-6 rounded-full transition-all relative ${!isStandardHidden(f.id) ? 'bg-orange-500' : 'bg-gray-200'}`}
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
                        className={`w-10 h-6 rounded-full transition-all relative ${!isFieldHidden(f.id) ? 'bg-orange-500' : 'bg-gray-200'}`}
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={(e) => e.stopPropagation()}>
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

function CustomFieldInput({ field, value, onChange }: any) {
  switch (field.type) {
    case CustomFieldType.TEXT:
    case CustomFieldType.WEBSITE:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <input
            type="text"
            className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-shadow"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.type === CustomFieldType.WEBSITE ? 'https://...' : 'Digite aqui...'}
          />
        </div>
      );
    case CustomFieldType.NUMBER:
    case CustomFieldType.MONEY:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <div className="relative mt-1">
            {field.type === CustomFieldType.MONEY && (
              <div className="absolute left-3 top-2 text-gray-400 text-sm font-medium">{field.config?.currency || 'R$'}</div>
            )}
            <input
              type="number"
              className={`w-full p-2 border rounded text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-shadow ${field.type === CustomFieldType.MONEY ? 'pl-9' : ''}`}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        </div>
      );
    case CustomFieldType.DATE:
      return (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">{field.name}</label>
          <input
            type="date"
            className="w-full p-2 border rounded mt-1 text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-shadow"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
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
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
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