import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Meeting, MeetingActionItem, MeetingRoom, List, User } from '../../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MeetingsViewProps {
  currentUser: User;
  users: User[];
  lists: List[];
  onOpenTask: (taskId: string) => void;
  onCreateTaskFromActionItem: (item: { id: string; text: string }, listId: string) => Promise<string | null>;
}

const DURATION_OPTIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1h' },
  { minutes: 90, label: '1h30' },
  { minutes: 120, label: '2h' },
  { minutes: 180, label: '3h' },
];

function mapMeetingRow(m: any, items: any[]): Meeting {
  return {
    id: m.id,
    title: m.title,
    meetingDate: m.meeting_date,
    endDate: m.end_date || undefined,
    roomId: m.room_id || undefined,
    participantIds: m.participant_ids || [],
    notes: m.notes || '',
    summary: m.summary || undefined,
    createdBy: m.created_by || undefined,
    createdAt: m.created_at,
    updatedAt: m.updated_at || undefined,
    actionItems: items
      .filter((i: any) => i.meeting_id === m.id)
      .map((i: any) => mapActionItemRow(i)),
  };
}

function mapRoomRow(r: any): MeetingRoom {
  return {
    id: r.id,
    name: r.name,
    isActive: r.is_active,
    createdBy: r.created_by || undefined,
    createdAt: r.created_at,
  };
}

function formatTimeRange(start: string, end?: string) {
  const s = new Date(start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!end) return s;
  const e = new Date(end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${s} – ${e}`;
}

function mapActionItemRow(i: any): MeetingActionItem {
  return {
    id: i.id,
    meetingId: i.meeting_id,
    text: i.text,
    completed: i.completed,
    taskId: i.task_id || undefined,
    createdAt: i.created_at,
  };
}

function formatMeetingDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Reuniões (item 4 da sidebar "Início", estilo ClickUp) — versão manual + IA:
 * sem integração de calendário nem bot entrando em chamada de vídeo (o
 * AI Notetaker de verdade do ClickUp). O usuário registra a reunião e cola as
 * notas/transcrição depois dela; a IA (edge function summarize-meeting, mesmo
 * Claude do ask-ai) gera o resumo e extrai os itens de ação, que podem virar
 * tarefas de verdade com um clique.
 */
export function MeetingsView({ currentUser, users, lists, onOpenTask, onCreateTaskFromActionItem }: MeetingsViewProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDurationMinutes, setNewDurationMinutes] = useState(60);
  const [newRoomId, setNewRoomId] = useState<string>('');
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);
  const [newParticipantIds, setNewParticipantIds] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [rooms, setRooms] = useState<MeetingRoom[]>([]);

  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [creatingTaskFor, setCreatingTaskFor] = useState<string | null>(null);

  const loadMeetings = useCallback(async () => {
    setIsLoading(true);
    const { data: meetingsData } = await supabase
      .from('meetings')
      .select('*')
      .order('meeting_date', { ascending: false })
      .limit(200);
    const ids = (meetingsData || []).map((m: any) => m.id);
    const { data: itemsData } = ids.length
      ? await supabase.from('meeting_action_items').select('*').in('meeting_id', ids)
      : { data: [] as any[] };
    setMeetings((meetingsData || []).map((m: any) => mapMeetingRow(m, itemsData || [])));
    setIsLoading(false);
  }, []);

  // Carrega todas as salas (inclusive arquivadas) — o seletor de criação só
  // lista as ativas, mas reuniões antigas continuam mostrando o nome certo
  // mesmo se a sala tiver sido arquivada depois.
  const loadRooms = useCallback(async () => {
    const { data } = await supabase.from('meeting_rooms').select('*').order('name');
    setRooms((data || []).map(mapRoomRow));
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    setSavingRoom(true);
    const { data, error } = await supabase
      .from('meeting_rooms')
      .insert({ name: newRoomName.trim(), created_by: currentUser.id })
      .select()
      .single();
    setSavingRoom(false);
    if (error || !data) {
      toast.error('Não consegui criar a sala.');
      return;
    }
    const room = mapRoomRow(data);
    setRooms((prev) => [...prev, room].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    setNewRoomId(room.id);
    setNewRoomName('');
    setIsAddingRoom(false);
  };

  // Conflito de sala: só avisa (não bloqueia) — mostra quem mais já reservou
  // aquela sala num horário que sobrepõe o que está sendo escolhido agora.
  // Consulta o Supabase direto (em vez de filtrar a lista `meetings` já
  // carregada, que só traz as 200 reuniões de meeting_date mais recente/
  // futuro): a partir de um certo volume de reuniões futuras, essa lista
  // em cache deixaria de conter reservas que ainda precisam ser checadas.
  const [roomConflicts, setRoomConflicts] = useState<{ id: string; title: string; meetingDate: string; endDate: string }[]>([]);
  useEffect(() => {
    if (!newRoomId || !newDate) {
      setRoomConflicts([]);
      return;
    }
    let cancelled = false;
    const start = new Date(newDate);
    const end = new Date(start.getTime() + newDurationMinutes * 60_000);
    supabase
      .from('meetings')
      .select('id, title, meeting_date, end_date')
      .eq('room_id', newRoomId)
      .not('end_date', 'is', null)
      .lt('meeting_date', end.toISOString())
      .gt('end_date', start.toISOString())
      .then(({ data }) => {
        if (cancelled) return;
        setRoomConflicts((data || []).map((m: any) => ({ id: m.id, title: m.title, meetingDate: m.meeting_date, endDate: m.end_date })));
      });
    return () => { cancelled = true; };
  }, [newRoomId, newDate, newDurationMinutes]);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  const selected = meetings.find((m) => m.id === selectedId) || null;
  useEffect(() => { setNotesDraft(selected?.notes || ''); }, [selected?.id]);

  const visibleMeetings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meetings;
    return meetings.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      (m.notes || '').toLowerCase().includes(q) ||
      (m.summary || '').toLowerCase().includes(q)
    );
  }, [meetings, search]);

  const resetCreateForm = () => {
    setShowCreateForm(false);
    setNewTitle('');
    setNewDate('');
    setNewDurationMinutes(60);
    setNewRoomId('');
    setIsAddingRoom(false);
    setNewRoomName('');
    setNewParticipantIds([]);
    setParticipantSearch('');
    setNewNotes('');
  };

  const createMeeting = async () => {
    if (!newTitle.trim()) return;
    setIsCreating(true);
    const start = newDate ? new Date(newDate) : new Date();
    const end = new Date(start.getTime() + newDurationMinutes * 60_000);
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        title: newTitle.trim(),
        meeting_date: start.toISOString(),
        end_date: end.toISOString(),
        room_id: newRoomId || null,
        participant_ids: newParticipantIds,
        notes: newNotes,
        created_by: currentUser.id,
      })
      .select()
      .single();
    setIsCreating(false);
    if (error || !data) return;
    setMeetings((prev) => [mapMeetingRow(data, []), ...prev]);
    setSelectedId(data.id);
    resetCreateForm();
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    const { error } = await supabase.from('meetings').update({ notes: notesDraft, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSavingNotes(false);
    if (error) return;
    setMeetings((prev) => prev.map((m) => (m.id === selected.id ? { ...m, notes: notesDraft } : m)));
  };

  const generateSummary = async (meetingId: string) => {
    setGeneratingId(meetingId);

    // A edge function lê meetings.notes do banco — se o textarea tiver texto
    // ainda não salvo (usuário colou/editou e clicou direto em "Gerar resumo"
    // sem passar por "Salvar notas"), salva primeiro pra IA não trabalhar em
    // cima de notas desatualizadas ou vazias.
    const persisted = meetings.find((m) => m.id === meetingId)?.notes || '';
    if (meetingId === selected?.id && notesDraft !== persisted) {
      const { error: saveError } = await supabase.from('meetings').update({ notes: notesDraft, updated_at: new Date().toISOString() }).eq('id', meetingId);
      if (saveError) {
        toast.error('Erro ao salvar as notas antes de gerar o resumo.');
        setGeneratingId(null);
        return;
      }
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, notes: notesDraft } : m)));
    }

    const { data, error } = await supabase.functions.invoke('summarize-meeting', { body: { meetingId } });
    if (error || data?.error) {
      toast.error(data?.error || 'Não consegui gerar o resumo agora. Tente novamente.');
    } else {
      toast.success('Resumo gerado.');
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? {
        ...m,
        summary: data.summary,
        actionItems: (data.actionItems || []).map(mapActionItemRow),
      } : m)));
    }
    setGeneratingId(null);
  };

  const toggleActionItem = async (item: MeetingActionItem) => {
    const completed = !item.completed;
    setMeetings((prev) => prev.map((m) => (m.id !== item.meetingId ? m : {
      ...m,
      actionItems: m.actionItems.map((i) => (i.id === item.id ? { ...i, completed } : i)),
    })));
    await supabase.from('meeting_action_items').update({ completed }).eq('id', item.id);
  };

  const handleCreateTaskFromItem = async (item: MeetingActionItem, listId: string) => {
    setCreatingTaskFor(item.id);
    const taskId = await onCreateTaskFromActionItem({ id: item.id, text: item.text }, listId);
    setCreatingTaskFor(null);
    if (taskId) {
      setMeetings((prev) => prev.map((m) => (m.id !== item.meetingId ? m : {
        ...m,
        actionItems: m.actionItems.map((i) => (i.id === item.id ? { ...i, taskId } : i)),
      })));
    }
  };

  if (selected) {
    const pendingCount = selected.actionItems.filter((i) => !i.completed).length;
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setSelectedId(null)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
          ← Reuniões
        </button>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <h1 className="text-xl font-bold text-gray-800">{selected.title}</h1>
          <p className="text-xs text-gray-400 mt-1">
            {formatMeetingDate(selected.meetingDate)}
            {selected.endDate && ` (${formatTimeRange(selected.meetingDate, selected.endDate)})`}
          </p>
          {selected.roomId && rooms.find((r) => r.id === selected.roomId) && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {rooms.find((r) => r.id === selected.roomId)!.name}
            </p>
          )}
          {selected.participantIds.length > 0 && (
            <div className="flex items-center -space-x-1.5 mt-2">
              {selected.participantIds.map((id) => {
                const u = users.find((usr) => usr.id === id);
                if (!u) return null;
                return <img key={id} src={u.avatar} title={u.name} className="w-6 h-6 rounded-full border-2 border-white" alt="" />;
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-700">Notas / transcrição</h2>
            <div className="flex items-center gap-2">
              <button onClick={saveNotes} disabled={savingNotes || notesDraft === selected.notes} className="text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:hover:text-gray-500">
                {savingNotes ? 'Salvando...' : 'Salvar notas'}
              </button>
              <button
                onClick={() => generateSummary(selected.id)}
                disabled={generatingId === selected.id || !notesDraft.trim()}
                className="text-xs font-bold bg-purple-500 text-white px-3 py-1.5 rounded-lg hover:brightness-110 disabled:opacity-50"
              >
                {generatingId === selected.id ? 'Gerando...' : selected.summary ? '✨ Gerar novamente' : '✨ Gerar resumo com IA'}
              </button>
            </div>
          </div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Cole aqui a transcrição ou as notas da reunião..."
            rows={8}
            className="w-full text-sm p-3 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-purple-300 bg-gray-50"
          />
        </div>

        {selected.summary && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
            <h2 className="text-sm font-bold text-gray-700 mb-2">Resumo</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{selected.summary}</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            Itens de ação {selected.actionItems.length > 0 && <span className="text-gray-400 font-normal">({pendingCount} pendente{pendingCount === 1 ? '' : 's'})</span>}
          </h2>
          {selected.actionItems.length === 0 && (
            <p className="text-xs text-gray-400">Nenhum item de ação ainda — gere o resumo com IA a partir das notas, ou ele aparecerá aqui.</p>
          )}
          <div className="space-y-2">
            {selected.actionItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => toggleActionItem(item)}
                  className="rounded text-purple-500 focus:ring-purple-500 shrink-0"
                />
                <span className={`text-sm flex-1 ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.text}</span>
                {item.taskId ? (
                  <button onClick={() => onOpenTask(item.taskId!)} className="text-[11px] font-semibold text-blue-500 hover:underline shrink-0">Ver tarefa</button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button disabled={creatingTaskFor === item.id} className="text-[11px] font-semibold text-gray-400 hover:text-purple-500 shrink-0 disabled:opacity-40">
                        {creatingTaskFor === item.id ? 'Criando...' : 'Criar tarefa'}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
                      {[...lists].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((l) => (
                        <DropdownMenuItem key={l.id} onClick={() => handleCreateTaskFromItem(item, l.id)} className="text-sm">
                          {l.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Reuniões</h1>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="text-xs font-bold bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:brightness-110"
        >
          + Nova reunião
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Encontre decisões tomadas em reuniões anteriores..."
        className="w-full text-sm p-3 border rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white shadow-sm"
      />

      {showCreateForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título da reunião"
            className="w-full text-sm p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            autoFocus
          />
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="flex-1 text-sm p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <select
              value={newDurationMinutes}
              onChange={(e) => setNewDurationMinutes(Number(e.target.value))}
              className="text-sm p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.minutes} value={d.minutes}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase">Sala (opcional)</p>
            {!isAddingRoom ? (
              <div className="flex gap-2">
                <select
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  className="flex-1 text-sm p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="">Sem sala</option>
                  {rooms.filter((r) => r.isActive).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsAddingRoom(true)}
                  className="text-xs font-semibold text-gray-500 hover:text-purple-600 px-2 rounded-lg border hover:bg-gray-50 shrink-0"
                >
                  + Nova sala
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Nome da sala (ex: 2º Andar | Diretoria)"
                  className="flex-1 text-sm p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <button
                  type="button"
                  onClick={createRoom}
                  disabled={savingRoom || !newRoomName.trim()}
                  className="text-xs font-bold bg-purple-500 text-white px-3 rounded-lg hover:brightness-110 disabled:opacity-50 shrink-0"
                >
                  {savingRoom ? '...' : 'Salvar'}
                </button>
                <button type="button" onClick={() => { setIsAddingRoom(false); setNewRoomName(''); }} className="text-xs text-gray-500 hover:text-gray-700 px-2 shrink-0">
                  Cancelar
                </button>
              </div>
            )}
            {roomConflicts.length > 0 && (
              <div className="mt-2 text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-2">
                ⚠️ Sala já reservada nesse horário por:
                <ul className="list-disc list-inside mt-0.5">
                  {roomConflicts.map((m) => (
                    <li key={m.id}>{m.title} ({formatTimeRange(m.meetingDate, m.endDate)})</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase">Participantes</p>
            <input
              type="text"
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full text-xs border rounded px-2 py-1 mb-1 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300"
            />
            <div className="max-h-32 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1 custom-scrollbar">
              {users
                .filter((u) => u.name.toLowerCase().includes(participantSearch.toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                .map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white p-1 rounded">
                    <input
                      type="checkbox"
                      checked={newParticipantIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) setNewParticipantIds([...newParticipantIds, u.id]);
                        else setNewParticipantIds(newParticipantIds.filter((id) => id !== u.id));
                      }}
                      className="rounded text-purple-500 focus:ring-purple-500"
                    />
                    {u.name}
                  </label>
                ))}
            </div>
          </div>
          <textarea
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Cole aqui as notas/transcrição, se já tiver (opcional — dá pra colar depois também)"
            rows={4}
            className="w-full text-sm p-2 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <div className="flex justify-end gap-2">
            <button onClick={resetCreateForm} className="text-xs text-gray-500 hover:text-gray-700 font-semibold px-2 py-1 rounded hover:bg-gray-100">Cancelar</button>
            <button onClick={createMeeting} disabled={isCreating || !newTitle.trim()} className="text-xs bg-orange-500 text-white font-bold px-3 py-1.5 rounded-lg hover:brightness-110 disabled:opacity-50">
              {isCreating ? '...' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading && <p className="p-8 text-sm text-gray-400 text-center">Carregando...</p>}
        {!isLoading && visibleMeetings.length === 0 && (
          <p className="p-8 text-sm text-gray-400 text-center">
            {search ? 'Nenhuma reunião encontrada.' : 'Nenhuma reunião registrada ainda.'}
          </p>
        )}
        {!isLoading && visibleMeetings.map((m) => {
          const pending = m.actionItems.filter((i) => !i.completed).length;
          const room = m.roomId ? rooms.find((r) => r.id === m.roomId) : undefined;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                <span className="text-[11px] text-gray-300 shrink-0">{formatMeetingDate(m.meetingDate)}</span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{m.summary || m.notes || 'Sem notas ainda.'}</p>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-1.5">
                    {m.participantIds.slice(0, 5).map((id) => {
                      const u = users.find((usr) => usr.id === id);
                      if (!u) return null;
                      return <img key={id} src={u.avatar} title={u.name} className="w-5 h-5 rounded-full border-2 border-white" alt="" />;
                    })}
                  </div>
                  {room && (
                    <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[160px]">{room.name}</span>
                  )}
                </div>
                {pending > 0 && (
                  <span className="text-[11px] font-semibold text-purple-600 shrink-0">{pending} item{pending === 1 ? '' : 's'} de ação pendente{pending === 1 ? '' : 's'}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
