/**
 * VP Click — Edge Function: sso-exchange
 *
 * Recebe o token de SSO emitido pelo portal (vpsistema) e faz, no servidor,
 * tudo que antes rodava no navegador com a service_role key exposta:
 *   1. valida o token no projeto central (vpsistema);
 *   2. lê o perfil completo de lá (nome, avatar, nível de acesso);
 *   3. cria ou sincroniza o usuário/perfil equivalente no VP Click;
 *   4. gera um magic link de uso único e devolve só o `token_hash` dele.
 *
 * O cliente troca esse `token_hash` por sessão com `supabase.auth.verifyOtp`
 * usando a anon key — a service_role nunca sai deste função.
 *
 * A validação do token central usa fetch() direto no REST do Auth
 * (/auth/v1/user), não o método `auth.getUser()` do SDK — mesmo padrão usado
 * pelos outros apps satélite do vpsistema (catraca, propostas,
 * gestaoimportacao). Evita entrar na máquina de estado/lock do GoTrue-js
 * (Navigator LockManager) para uma validação que é só um GET com bearer
 * token; ver issues #38/#41 do VP Click.
 *
 * Deploy:
 *   supabase functions deploy sso-exchange --project-ref sfpnjwllcmentoocylow --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CENTRAL_URL = 'https://ubdkoqxfwcraftesgmbw.supabase.co';
const CENTRAL_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZGtvcXhmd2NyYWZ0ZXNnbWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjUwMjcsImV4cCI6MjA5MDY0MTAyN30.s1A15nFQVne94gbz0511L2IYvHdTcgYeL0H8YU80iI8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeRoleText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function mapCentralLevelToRole(level: unknown): 'ADMIN' | 'GESTOR' | 'COLABORADOR' {
  const normalized = normalizeRoleText(level);
  if (normalized.includes('admin')) return 'ADMIN';
  if (normalized.includes('lider') || normalized.includes('gestor')) return 'GESTOR';
  return 'COLABORADOR';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') return json({ error: 'token é obrigatório' }, 400);

    const authResp = await fetch(`${CENTRAL_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: CENTRAL_ANON },
    });
    if (!authResp.ok) return json({ error: 'Token central inválido' }, 401);
    const centralUser = await authResp.json();
    if (!centralUser?.id || !centralUser?.email) return json({ error: 'Token central inválido' }, 401);

    // Perfil completo do vpsistema, lido com o próprio token do usuário
    // (nunca com a service role do projeto central).
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
      console.warn('sso-exchange: não foi possível ler o perfil do vpsistema, usando metadados do Auth.', profileErr);
    }

    const centralName = centralProfile?.name
      || centralUser.user_metadata?.name
      || centralUser.email?.split('@')[0]
      || 'Usuário';
    const centralAvatar = centralProfile?.avatar_url || centralUser.user_metadata?.avatar || null;
    const centralLevel = centralProfile?.level || centralUser.user_metadata?.level;
    const mappedRole = mapCentralLevelToRole(centralLevel);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: users, error: userError } = await admin
      .from('profiles')
      .select('id')
      .eq('email', centralUser.email);

    let targetUserId: string | undefined;

    if (userError || !users || users.length === 0) {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: centralUser.email!,
        email_confirm: true,
        user_metadata: { name: centralName, avatar: centralAvatar, role: mappedRole },
      });

      if (createError) {
        // Usuário já existe no Auth mas sem perfil — recupera o id pelo email
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const existingAuthUser = list?.users?.find((u) => u.email === centralUser.email);
        if (!existingAuthUser) return json({ error: createError.message }, 500);
        targetUserId = existingAuthUser.id;
      } else {
        targetUserId = newUser.user?.id;
      }

      // Cria o perfil já herdando a identidade do vpsistema; o papel inicial
      // vem do nível de lá e pode ser ajustado depois no painel do VPClick.
      const { error: profileError } = await admin.from('profiles').upsert({
        id: targetUserId,
        name: centralName,
        email: centralUser.email,
        avatar: centralAvatar || `https://picsum.photos/seed/${targetUserId}/100`,
        role: mappedRole,
        is_active: true,
      }, { onConflict: 'id' });
      if (profileError) console.error('sso-exchange: erro ao criar perfil herdado:', profileError);
    } else {
      targetUserId = users[0].id;
      // Identidade e papel seguem sincronizados com a porta de entrada
      // (vpsistema). As alçadas por espaço/pasta continuam no VP Click.
      const identity: Record<string, string> = { name: centralName, role: mappedRole };
      if (centralAvatar) identity.avatar = centralAvatar;
      const { error: syncError } = await admin.from('profiles').update(identity).eq('id', targetUserId);
      if (syncError) console.error('sso-exchange: erro ao sincronizar identidade:', syncError);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: centralUser.email!,
    });
    if (linkError) return json({ error: linkError.message }, 500);

    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) return json({ error: 'hashed_token ausente' }, 500);

    return json({ token_hash: tokenHash });
  } catch (err) {
    console.error('sso-exchange error:', err);
    return json({ error: 'Erro interno ao processar SSO' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
