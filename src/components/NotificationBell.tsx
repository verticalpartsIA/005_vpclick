import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AppNotification, User } from '../types';

interface NotificationBellProps {
  currentUser: User;
  users: User[];
  onOpenTask: (taskId: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  mention: '💬',
  team_mention: '👥',
  assignment: '📌',
  comment: '💬',
  automation: '⚡',
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

/** Sino de notificações in-app (menções, atribuições, automações) com atualização em tempo real. */
export function NotificationBell({ currentUser, users, onOpenTask }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const mapRow = (n: any): AppNotification => ({
    id: n.id,
    userId: n.user_id,
    actorId: n.actor_id,
    type: n.type,
    title: n.title,
    body: n.body || '',
    taskId: n.task_id,
    commentId: n.comment_id,
    read: n.read,
    createdAt: n.created_at,
  });

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setNotifications(data.map(mapRow));
  }, [currentUser.id]);

  useEffect(() => {
    loadNotifications();
    const channel = supabase
      .channel(`notifications-${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload: any) => {
        if (payload.new) setNotifications((prev) => [mapRow(payload.new), ...prev].slice(0, 30));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser.id, loadNotifications]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).in('id', ids);
  };

  const handleClickNotification = (n: AppNotification) => {
    if (!n.read) markAsRead([n.id]);
    if (n.taskId) {
      onOpenTask(n.taskId);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        title="Notificações"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full min-w-[18px] h-[18px] px-1 text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-11 w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-[100] animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <p className="font-bold text-gray-800 text-sm">Notificações</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAsRead(notifications.filter((n) => !n.read).map((n) => n.id))}
                className="text-xs text-orange-500 font-semibold hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 && (
              <p className="p-6 text-sm text-gray-400 text-center">Nenhuma notificação por aqui. 🎉</p>
            )}
            {notifications.map((n) => {
              const actor = users.find((u) => u.id === n.actorId);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 flex gap-3 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-orange-50/50' : ''}`}
                >
                  {actor ? (
                    <img src={actor.avatar} className="w-8 h-8 rounded-full shrink-0 mt-0.5" alt="" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5 text-sm">
                      {TYPE_ICONS[n.type] || '🔔'}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs leading-snug ${!n.read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{n.title}</p>
                    {n.body && <p className="text-[11px] text-gray-400 truncate mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-gray-300 mt-1">{relativeTime(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5"></span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
