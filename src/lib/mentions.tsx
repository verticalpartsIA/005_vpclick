import React from 'react';
import { supabase } from './supabase';
import { Team, User, NotificationType } from '../types';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extrai menções de um texto de comentário no formato "@Nome Completo".
 * Os nomes são casados contra a lista real de usuários e Equipes do workspace.
 */
export function extractMentions(text: string, users: User[], teams: Team[]) {
  const mentionedUserIds = users
    .filter((u) => text.includes(`@${u.name}`))
    .map((u) => u.id);
  const mentionedTeams = teams.filter((t) => text.includes(`@${t.name}`));
  return { mentionedUserIds, mentionedTeams };
}

/**
 * Cria as notificações de menção (usuários e Equipes) após salvar um comentário.
 * Idempotente por chamada: deduplica destinatários e nunca notifica o próprio autor.
 */
export async function notifyMentions(params: {
  text: string;
  taskId: string;
  taskTitle: string;
  commentId?: string;
  actor: User;
  users: User[];
  teams: Team[];
}) {
  const { text, taskId, taskTitle, commentId, actor, users, teams } = params;
  const { mentionedUserIds, mentionedTeams } = extractMentions(text, users, teams);

  const rows: { user_id: string; type: NotificationType }[] = [];
  const seen = new Set<string>([actor.id]);

  mentionedUserIds.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      rows.push({ user_id: id, type: 'mention' });
    }
  });
  mentionedTeams.forEach((team) => {
    team.memberIds.forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        rows.push({ user_id: id, type: 'team_mention' });
      }
    });
  });

  if (rows.length === 0) return;

  const body = text.length > 140 ? `${text.slice(0, 140)}…` : text;
  const { error } = await supabase.from('notifications').insert(
    rows.map((r) => ({
      user_id: r.user_id,
      actor_id: actor.id,
      type: r.type,
      title:
        r.type === 'team_mention'
          ? `${actor.name} mencionou sua equipe em "${taskTitle}"`
          : `${actor.name} mencionou você em "${taskTitle}"`,
      body,
      task_id: taskId,
      comment_id: commentId || null,
    }))
  );
  if (error) console.error('Erro ao criar notificações de menção:', error);
}

/** Cria uma notificação de atribuição de tarefa (responsável principal/adicional/equipe). */
export async function notifyAssignment(params: {
  userIds: string[];
  actor: User;
  taskId: string;
  taskTitle: string;
  teamName?: string;
}) {
  const { userIds, actor, taskId, taskTitle, teamName } = params;
  const targets = [...new Set(userIds)].filter((id) => id && id !== actor.id);
  if (targets.length === 0) return;

  const { error } = await supabase.from('notifications').insert(
    targets.map((id) => ({
      user_id: id,
      actor_id: actor.id,
      type: 'assignment',
      title: teamName
        ? `${actor.name} atribuiu a equipe ${teamName} à tarefa "${taskTitle}"`
        : `${actor.name} atribuiu você à tarefa "${taskTitle}"`,
      body: '',
      task_id: taskId,
    }))
  );
  if (error) console.error('Erro ao criar notificação de atribuição:', error);
}

/**
 * Renderiza o texto de um comentário destacando as menções "@Nome" conhecidas
 * (usuários em azul, Equipes em roxo).
 */
export function MentionText({ text, users, teams }: { text: string; users: User[]; teams: Team[] }) {
  const names = [
    ...users.map((u) => ({ name: u.name, kind: 'user' as const })),
    ...teams.map((t) => ({ name: t.name, kind: 'team' as const })),
  ].sort((a, b) => b.name.length - a.name.length);

  if (names.length === 0 || !text.includes('@')) return <>{text}</>;

  const pattern = new RegExp(`@(${names.map((n) => escapeRegex(n.name)).join('|')})`, 'g');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const match = names.find((n) => n.name === part);
        // O split com grupo de captura alterna texto comum e nomes capturados
        if (i % 2 === 1 && match) {
          return (
            <span
              key={i}
              className={`font-semibold rounded px-1 py-0.5 ${
                match.kind === 'team' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
              }`}
            >
              @{part}
            </span>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
