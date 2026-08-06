import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isToday, isYesterday } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { AppNotification, User } from '../../types';

interface InboxViewProps {
  currentUser: User;
  users: User[];
  onOpenTask: (taskId: string) => void;
  onOpenMeeting: (meetingId: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  mention: '💬',
  team_mention: '👥',
  assignment: '📌',
  comment: '💬',
  automation: '⚡',
  reply: '↩️',
  comment_assigned: '📝',
  comment_resolved: '✅',
  meeting: '🗓️',
};

function relativeTime(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function dateGroupLabel(date: string) {
  const d = new Date(date);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays < 7) return 'Esta semana';
  return 'Mais antigas';
}

/**
 * Caixa de entrada (aba "Principal", inspirada no Inbox do ClickUp): a mesma
 * fonte de dados do sino de notificações, mas em página cheia — sem limite de
 * 30 itens, com filtro lido/não lido e agrupamento por data.
 */
export function InboxView({ currentUser, users, onOpenTask, onOpenMeeting }: InboxViewProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const mapRow = (n: any): AppNotification => ({
    id: n.id,
    userId: n.user_id,
    actorId: n.actor_id,
    type: n.type,
    title: n.title,
    body: n.body || '',
    taskId: n.task_id,
    commentId: n.comment_id,
    meetingId: n.meeting_id,
    read: n.read,
    createdAt: n.created_at,
  });

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      if (data) setNotifications(data.map(mapRow));
    } catch (err) {
      console.error('Erro ao carregar caixa de entrada:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadNotifications();
    const channel = supabase
      .channel(`inbox-${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload: any) => {
        if (payload.new) setNotifications((prev) => [mapRow(payload.new), ...prev].slice(0, 200));
      })
      .on('postgres_changes', {
        // Reflete leituras feitas em outro lugar (sino do topo, outra aba)
        // enquanto esta página está aberta — sem isso o badge de não lidas e
        // o filtro "Não lidas" aqui ficavam desatualizados até recarregar.
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload: any) => {
        if (payload.new) setNotifications((prev) => prev.map((n) => (n.id === payload.new.id ? mapRow(payload.new) : n)));
      })
      .on('postgres_changes', {
        // Reflete exclusões (ex: notificação de convite quando a reunião é
        // desmarcada) — sem isso o item ficava visível/clicável até recarregar,
        // levando a uma reunião que não existe mais.
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload: any) => {
        if (payload.old) setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser.id, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).in('id', ids);
  };

  const handleClickNotification = (n: AppNotification) => {
    if (!n.read) markAsRead([n.id]);
    if (n.taskId) onOpenTask(n.taskId);
    else if (n.meetingId) onOpenMeeting(n.meetingId);
  };

  const visible = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const groups = useMemo(() => {
    const order = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas'];
    const byLabel = new Map<string, AppNotification[]>();
    visible.forEach((n) => {
      const label = dateGroupLabel(n.createdAt);
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label)!.push(n);
    });
    return order.filter((label) => byLabel.has(label)).map((label) => ({ label, items: byLabel.get(label)! }));
  }, [visible]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800">Caixa de entrada</h1>
          {unreadCount > 0 && (
            <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount} não lida{unreadCount === 1 ? '' : 's'}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAsRead(notifications.filter((n) => !n.read).map((n) => n.id))}
            className="text-xs text-orange-500 font-semibold hover:underline"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'unread' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Não lidas
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading && (
          <p className="p-8 text-sm text-gray-400 text-center">Carregando...</p>
        )}
        {!isLoading && visible.length === 0 && (
          <p className="p-8 text-sm text-gray-400 text-center">
            {filter === 'unread' ? 'Nenhuma notificação não lida. 🎉' : 'Nenhuma notificação por aqui. 🎉'}
          </p>
        )}
        {!isLoading && groups.map((group) => (
          <div key={group.label}>
            <div className="px-4 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/70 border-b border-gray-100">
              {group.label}
            </div>
            {group.items.map((n) => {
              const actor = users.find((u) => u.id === n.actorId);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 flex gap-3 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-orange-50/50' : ''}`}
                >
                  {actor ? (
                    <img src={actor.avatar} className="w-9 h-9 rounded-full shrink-0 mt-0.5" alt="" />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5 text-base">
                      {TYPE_ICONS[n.type] || '🔔'}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-gray-400 truncate mt-0.5">{n.body}</p>}
                    <p className="text-[11px] text-gray-300 mt-1">{relativeTime(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-2"></span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
