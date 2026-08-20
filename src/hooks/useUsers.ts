import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

type UserAccessMap = Record<string, { spaceIds: string[]; folderIds: string[] }>;
interface ProfileRow {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  role: string;
  theme: string | null;
}

// Diretório de usuários do workspace (usado em menções "@", dropdowns de
// responsável e no painel admin) + as operações de admin. Owner da lista
// `adminUsers`, do loader e do realtime de `profiles`. Recebe do App os setters
// que cruzam outros domínios (userAccess, currentUser) — o hook orquestra
// usuários mas não é dono desses estados.
export function useUsers(params: {
  session: Session | null;
  currentUser: User;
  setCurrentUser: Dispatch<SetStateAction<User>>;
  setUserAccess: Dispatch<SetStateAction<UserAccessMap>>;
}) {
  const { session, currentUser, setCurrentUser, setUserAccess } = params;
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  // id -> last_sign_in_at (ISO) para o alerta de contas inativas no Painel
  // Admin. Só existe em auth.users (não exposto via PostgREST); vem da RPC
  // get_users_last_sign_in, que só retorna dados para quem já é ADMIN.
  const [lastSignInMap, setLastSignInMap] = useState<Record<string, string | null>>({});

  const loadAllUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true);           // exclui usuários inativados
    if (data && data.length > 0) {
      const users: User[] = (data as ProfileRow[])
        .filter((d) => !d.email?.includes('@vpclick.test')) // exclui contas CI/teste
        .map((d) => ({
          id: d.id,
          name: d.name,
          email: d.email ?? '',
          avatar: d.avatar || `https://picsum.photos/seed/${d.id}/100`,
          role: d.role as UserRole,
          theme: d.theme ?? undefined,
        }));
      // Garante que o usuário logado esteja na lista mesmo sem perfil.
      if (currentUser.id !== 'loading' && !users.some(u => u.id === currentUser.id)) {
        users.push(currentUser);
      }
      setAdminUsers(users);
    } else {
      setAdminUsers([currentUser]);
    }
  }, [currentUser]);

  // Carga inicial ao autenticar.
  useEffect(() => {
    if (session) loadAllUsers();
  }, [session, loadAllUsers]);

  // Último login por usuário — só para ADMIN (a RPC devolve vazio para os
  // demais papéis). Alimenta o alerta de contas inativas no Painel Admin.
  // Rerroda quando adminUsers.length muda (usuário criado pelo admin ou
  // provisionado via realtime) — senão a conta nova fica sem entrada no mapa
  // até um reload, tratada como "sem dado" em vez de "nunca logou".
  useEffect(() => {
    if (!session || currentUser.role !== UserRole.ADMIN) return;
    supabase.rpc('get_users_last_sign_in').then(({ data, error }) => {
      if (error) { console.error('Erro ao carregar último login dos usuários:', error); return; }
      const map: Record<string, string | null> = {};
      (data || []).forEach((row: { id: string; last_sign_in_at: string | null }) => {
        map[row.id] = row.last_sign_in_at;
      });
      setLastSignInMap(map);
    });
  }, [session, currentUser.role, adminUsers.length]);

  // Realtime: mantém a lista fresca quando um perfil é criado/ativado depois do
  // login — sem isso, usuários provisionados após a sessão só apareciam nas
  // menções depois de um reload.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('profiles-mentions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadAllUsers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, loadAllUsers]);

  const handleAdminUpdateRole = async (userId: string, role: UserRole) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (!error) {
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } else {
      console.error('Erro ao atualizar papel do usuário:', error);
    }
  };

  const handleAdminUpdateAccess = async (userId: string, spaceIds: string[], folderIds: string[]) => {
    // Insere ou atualiza o acesso do usuário usando o padrão OnConflict.
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

    setUserAccess(prev => ({
      ...prev,
      [userId]: { spaceIds, folderIds }
    }));
    toast.success('Acessos atualizados!');
  };

  const handleAdminDeleteUser = async (userId: string) => {
    // Soft-delete: hard-delete falha por FKs NO ACTION (usuário referenciado em
    // tarefas/comentários/atividades). A Edge Function desativa o perfil
    // (is_active=false, filtrado em loadAllUsers) e bane o login. Reversível.
    if (window.confirm("Desativar este usuário? O login será bloqueado e ele sairá das listas e menções, mas o histórico (tarefas, comentários) é preservado.")) {
      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: { action: 'delete', userId },
      });
      if (!error && !data?.error) {
        setAdminUsers(prev => prev.filter(u => u.id !== userId));
        toast.success('Usuário desativado.');
      } else {
        console.error('Erro ao desativar usuário:', data?.error || error);
        toast.error('Erro ao desativar usuário: ' + (data?.error || error?.message));
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
    const { data, error } = await supabase.functions.invoke('admin-user-management', {
      body: { action: 'updatePassword', userId, newPassword },
    });
    if (error || data?.error) {
      const message = data?.error || error?.message;
      console.error('Erro ao atualizar senha:', message);
      throw new Error(message);
    }
  };

  const handleAdminCreateUser = async (user: Partial<User>, password?: string) => {
    const { data, error } = await supabase.functions.invoke('admin-user-management', {
      body: {
        action: 'create',
        email: user.email,
        password: password || 'Click@2026',
        name: user.name,
        role: user.role,
      },
    });

    if (data?.userId && !error && !data?.error) {
      const newUser: User = {
        id: data.userId,
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || `https://picsum.photos/seed/${data.userId}/100`,
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
      const message = data?.error || error?.message || 'Erro desconhecido';
      console.error('Erro ao criar usuário:', message);
      throw new Error(message);
    }
  };

  return {
    adminUsers,
    lastSignInMap,
    handleAdminUpdateRole,
    handleAdminUpdateAccess,
    handleAdminDeleteUser,
    handleAdminUpdateUserAvatar,
    handleAdminUpdatePassword,
    handleAdminCreateUser,
  };
}
