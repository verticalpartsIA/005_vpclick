import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Team, User, UserRole } from '../types';
import { toast } from 'sonner';

interface TeamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  users: User[];
  currentUser: User;
}

const TEAM_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316'];

/**
 * Gestão de Equipes (grupos de usuários, estilo ClickUp Teams).
 * Criação/edição restrita a ADMIN e GESTOR; demais usuários visualizam.
 */
export function TeamsModal({ isOpen, onClose, teams, setTeams, users, currentUser }: TeamsModalProps) {
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(TEAM_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const canManage = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.GESTOR;

  const filteredUsers = useMemo(() => {
    const q = memberSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, memberSearch]);

  if (!isOpen) return null;

  const refreshTeams = async () => {
    const { data: teamsData } = await supabase.from('teams').select('*').order('name');
    const { data: membersData } = await supabase.from('team_members').select('*');
    if (teamsData) {
      setTeams(teamsData.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        color: t.color || '#8b5cf6',
        memberIds: (membersData || []).filter((m: any) => m.team_id === t.id).map((m: any) => m.user_id),
      })));
    }
  };

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Já existe uma Equipe com esse nome.');
      return;
    }
    setIsCreating(true);
    const { data, error } = await supabase
      .from('teams')
      .insert({ name, color: newTeamColor, created_by: currentUser.id })
      .select()
      .single();
    setIsCreating(false);
    if (error || !data) {
      console.error('Erro ao criar Equipe:', error);
      if (error?.code === '23505') {
        // UNIQUE em teams.name — a equipe existe no banco mas não estava na lista local
        toast.error(`Já existe uma Equipe chamada "${name}" no banco (pode ter sido criada por outra pessoa). A lista foi atualizada.`);
        await refreshTeams();
      } else if (error?.code === '42501') {
        toast.error('Sem permissão no banco para criar Equipes. Seu papel precisa ser ADMIN ou GESTOR (verifique seu perfil e recarregue a página).');
      } else if (error?.code === '23503') {
        toast.error('Seu perfil de usuário não foi encontrado no banco. Saia e entre novamente no sistema.');
      } else {
        toast.error(`Não foi possível criar a Equipe${error?.message ? `: ${error.message}` : '.'}`);
      }
      return;
    }
    setTeams((prev) => [...prev, { id: data.id, name: data.name, description: data.description || '', color: data.color, memberIds: [] }]);
    setNewTeamName('');
    setExpandedTeamId(data.id);
    toast.success(`Equipe "${name}" criada. Adicione os membros.`);
  };

  const handleDeleteTeam = async (team: Team) => {
    const { error } = await supabase.from('teams').delete().eq('id', team.id);
    if (error) {
      console.error('Erro ao excluir Equipe:', error);
      toast.error(`Não foi possível excluir a Equipe${error.message ? `: ${error.message}` : '.'}`);
      return;
    }
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
    toast.success(`Equipe "${team.name}" excluída.`);
  };

  const handleToggleMember = async (team: Team, userId: string) => {
    const isMember = team.memberIds.includes(userId);
    if (isMember) {
      const { error } = await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', userId);
      if (error) { toast.error('Não foi possível remover o membro.'); return; }
      setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, memberIds: t.memberIds.filter((id) => id !== userId) } : t));
    } else {
      const { error } = await supabase.from('team_members').insert({ team_id: team.id, user_id: userId });
      if (error) { toast.error('Não foi possível adicionar o membro.'); return; }
      setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, memberIds: [...t.memberIds, userId] } : t));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gray-50/50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Equipes</h3>
            <p className="text-xs text-gray-400 font-medium mt-1">
              Agrupe pessoas para atribuir tarefas e mencionar todos de uma vez com @NomeDaEquipe.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
          {canManage && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
              <input
                type="text"
                placeholder="Nome da nova Equipe (ex: Gestão Comercial)"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTeam(); }}
                className="flex-1 px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              />
              <div className="flex items-center gap-1">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewTeamColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${newTeamColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-300' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim() || isCreating}
                className="bg-orange-500 px-4 py-2 rounded-xl text-white text-sm font-bold hover:brightness-110 shadow-lg shadow-orange-200 transition-all disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          )}

          {teams.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              Nenhuma Equipe criada ainda.
              {canManage ? ' Crie a primeira acima.' : ' Peça a um gestor ou administrador para criar.'}
            </p>
          )}

          {teams.map((team) => {
            const isExpanded = expandedTeamId === team.id;
            const members = users.filter((u) => team.memberIds.includes(u.id));
            return (
              <div key={team.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => { setExpandedTeamId(isExpanded ? null : team.id); setMemberSearch(''); }}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: team.color }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm">{team.name}</p>
                    <p className="text-xs text-gray-400">{members.length} {members.length === 1 ? 'membro' : 'membros'}</p>
                  </div>
                  <div className="flex -space-x-1.5 shrink-0">
                    {members.slice(0, 5).map((m) => (
                      <img key={m.id} src={m.avatar} title={m.name} className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                    ))}
                    {members.length > 5 && (
                      <span className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white text-[9px] font-bold text-gray-500 flex items-center justify-center">+{members.length - 5}</span>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {isExpanded && (
                  <div className="border-t bg-gray-50/50 p-4 space-y-3">
                    {canManage && (
                      <input
                        type="text"
                        placeholder="Buscar pessoa para adicionar/remover..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                      />
                    )}
                    <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-0.5">
                      {(canManage ? filteredUsers : members).map((u) => {
                        const isMember = team.memberIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            disabled={!canManage}
                            onClick={() => handleToggleMember(team, u.id)}
                            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${canManage ? 'hover:bg-white' : 'cursor-default'}`}
                          >
                            <img src={u.avatar} className="w-6 h-6 rounded-full shrink-0" alt="" />
                            <span className={`text-sm flex-1 truncate ${isMember ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{u.name}</span>
                            {canManage && (
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isMember ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                {isMember ? 'Membro' : 'Adicionar'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {canManage && (
                      <div className="pt-2 border-t flex justify-end">
                        <button
                          onClick={() => handleDeleteTeam(team)}
                          className="text-xs text-red-400 hover:text-red-600 font-semibold"
                        >
                          Excluir Equipe
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
