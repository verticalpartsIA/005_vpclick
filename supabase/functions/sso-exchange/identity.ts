// Regras de identidade do sso-exchange, sem dependências do runtime Deno para
// poder ser testada no Vitest (src/test/ssoIdentity.test.ts).
//
// Papel (role): o vpsistema define o papel SÓ na criação do usuário no VP Click.
// Depois do primeiro acesso, o papel do VP Click é a fonte da verdade (ajustes
// feitos no painel não são desfeitos a cada login pelo portal). Nome e avatar
// continuam acompanhando o vpsistema.

export type Role = 'ADMIN' | 'GESTOR' | 'COLABORADOR';

export function normalizeRoleText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

export function mapCentralLevelToRole(level: unknown): Role {
  const normalized = normalizeRoleText(level);
  if (normalized.includes('admin')) return 'ADMIN';
  if (normalized.includes('lider') || normalized.includes('gestor')) return 'GESTOR';
  return 'COLABORADOR';
}

/** Campos do perfil de um usuário JÁ existente que o SSO pode sincronizar. Nunca inclui `role`. */
export function identityUpdateForExistingUser(name: string, avatar: string | null): Record<string, string> {
  const identity: Record<string, string> = { name };
  if (avatar) identity.avatar = avatar;
  return identity;
}
