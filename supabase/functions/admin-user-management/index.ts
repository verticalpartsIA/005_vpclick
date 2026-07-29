/**
 * VP Click — Edge Function: admin-user-management
 *
 * Concentra as operações de `auth.admin.*` que o Painel Admin do VP Click
 * precisa (criar usuário, trocar senha, excluir usuário). Antes rodavam no
 * navegador com a service_role key exposta; agora a chave só existe aqui, e
 * cada chamada é reautorizada: o JWT do chamador é validado e o perfil dele
 * precisa ter role = ADMIN antes de qualquer ação privilegiada rodar.
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

    if (action === 'delete') {
      if (!userId) return json({ error: 'userId é obrigatório' }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 500);
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
