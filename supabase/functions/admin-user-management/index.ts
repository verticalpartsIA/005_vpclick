/**
 * VP Click — Edge Function: admin-user-management
 *
 * Concentra as operações de `auth.admin.*` que o Painel Admin do VP Click
 * precisa (criar usuário, trocar senha, desativar usuário). A service_role key
 * só existe aqui; cada chamada é reautorizada: o JWT do chamador é validado e o
 * perfil dele precisa ter role = ADMIN antes de qualquer ação privilegiada.
 *
 * NOTA sobre `delete`: NÃO é hard-delete. Várias FKs `ON DELETE NO ACTION`
 * (tasks.main_assignee_id, task_comments.user_id, task_activities.user_id, ...)
 * impedem apagar o profile de um usuário com dados. Então `delete` faz
 * SOFT-DELETE: desativa o perfil (o app filtra is_active) e bane o login
 * (impede acesso). Reversível: is_active=true + ban_duration 'none'.
 *
 * Deploy:
 *   supabase functions deploy admin-user-management --project-ref sfpnjwllcmentoocylow
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── Autenticação do chamador ───────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller }, error: authError } = await authClient.auth.getUser();
    if (authError || !caller) return json({ error: 'Não autenticado' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── Autorização: só ADMIN executa ações desta função ───────
    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', caller.id).maybeSingle();
    if (callerProfile?.role !== 'ADMIN') return json({ error: 'Apenas administradores podem executar esta ação' }, 403);

    const { action, userId, newPassword, email, password, name, role } = await req.json();

    if (action === 'delete' || action === 'deactivate') {
      if (!userId) return json({ error: 'userId é obrigatório' }, 400);
      // Soft-delete: desativa o perfil + bane o login (hard-delete falha por FKs).
      const { error: deErr } = await admin.from('profiles').update({ is_active: false }).eq('id', userId);
      if (deErr) return json({ error: deErr.message }, 500);
      const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
      if (banErr) return json({ error: banErr.message }, 500);
      return json({ ok: true });
    }

    if (action === 'reactivate') {
      if (!userId) return json({ error: 'userId é obrigatório' }, 400);
      const { error: reErr } = await admin.from('profiles').update({ is_active: true }).eq('id', userId);
      if (reErr) return json({ error: reErr.message }, 500);
      const { error: unbanErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
      if (unbanErr) return json({ error: unbanErr.message }, 500);
      return json({ ok: true });
    }

    if (action === 'updatePassword') {
      if (!userId || !newPassword) return json({ error: 'userId e newPassword são obrigatórios' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === 'create') {
      if (!email) return json({ error: 'email é obrigatório' }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: password || 'Click@2026',
        email_confirm: true,
        user_metadata: { name, role },
      });
      if (error || !data.user) return json({ error: error?.message || 'Falha ao criar usuário' }, 500);
      return json({ userId: data.user.id });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    console.error('admin-user-management error:', err);
    return json({ error: 'Erro interno' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
