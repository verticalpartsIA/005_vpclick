/**
 * VP Click — Edge Function: provision-from-vpsistema
 *
 * Recebe o aviso do portal (vpsistema) quando um admin concede ou revoga o
 * acesso de um usuário ao módulo VP Click (slug "click"), e espelha o estado
 * aqui na hora:
 *   - permissão concedida → cria o usuário no Auth + perfil (ou reativa)
 *   - permissão revogada  → desativa o perfil (is_active = false, sem apagar)
 *
 * Antes disso, o usuário só nascia no VP Click no primeiro clique de SSO —
 * o admin habilitava no portal e não via a pessoa aparecer em lugar nenhum.
 *
 * Segurança sem segredo compartilhado: o payload é tratado apenas como uma
 * dica. A função SEMPRE reconfirma a permissão chamando o confirm-permission
 * do vpsistema (que lê o próprio banco com a própria service key) e converge
 * o estado local para o que o portal disser. Um chamador forjado não
 * consegue provocar nada além do estado que já é verdadeiro no portal.
 *
 * Deploy:
 *   supabase functions deploy provision-from-vpsistema --project-ref sfpnjwllcmentoocylow --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VPSISTEMA_URL = 'https://ubdkoqxfwcraftesgmbw.supabase.co';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  try {
    const { user_id: userId, module_slug: moduleSlug } = await req.json();
    if (!userId) return json({ error: 'user_id é obrigatório' }, 400);
    if (moduleSlug !== 'click') return json({ ok: true, skipped: true });

    // Fonte da verdade: reconfirma no vpsistema, ignorando o que veio no payload.
    const confirmRes = await fetch(`${VPSISTEMA_URL}/functions/v1/confirm-permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, module_slug: 'click' }),
    });
    if (!confirmRes.ok) {
      console.error('confirm-permission respondeu', confirmRes.status);
      return json({ error: 'Falha ao confirmar permissão no vpsistema' }, 502);
    }
    const { has_permission: hasPermission, profile } = await confirmRes.json();
    if (!profile?.email) return json({ error: 'Perfil não encontrado no vpsistema' }, 404);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (!hasPermission) {
      // Acesso revogado no portal → desativa aqui, preservando o histórico
      // (tarefas, comentários e atividades continuam atribuídos à pessoa).
      const { error } = await admin.from('profiles').update({ is_active: false }).eq('email', profile.email);
      if (error) throw error;
      return json({ ok: true, deactivated: true });
    }

    // Mapeia o nível do portal para o papel inicial no VP Click
    // (igual ao SSO: pode ser ajustado depois no Painel Admin daqui).
    const role = profile.level === 'Administrador'
      ? 'ADMIN'
      : (profile.level === 'Lider' || profile.level === 'Gestor')
        ? 'GESTOR'
        : 'COLABORADOR';

    // Cria o usuário no Auth (ou reaproveita o existente)
    let targetId: string | undefined;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: profile.email,
      email_confirm: true,
      user_metadata: { name: profile.name, avatar: profile.avatar_url, role },
    });
    if (createErr) {
      if (!/already.*(registered|exists)/i.test(createErr.message ?? '')) throw createErr;
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      targetId = list?.users?.find((u: { email?: string }) => u.email === profile.email)?.id;
      if (!targetId) throw createErr;
    } else {
      targetId = created.user?.id;
    }

    // Perfil: cria se não existe; se existe, sincroniza identidade e reativa,
    // sem sobrescrever o papel (pode ter sido promovido dentro do VP Click).
    const { data: existing } = await admin.from('profiles').select('id').eq('id', targetId).maybeSingle();
    if (existing) {
      const identity: Record<string, unknown> = { name: profile.name, is_active: true };
      if (profile.avatar_url) identity.avatar = profile.avatar_url;
      const { error } = await admin.from('profiles').update(identity).eq('id', targetId);
      if (error) throw error;
    } else {
      const { error } = await admin.from('profiles').insert({
        id: targetId,
        name: profile.name,
        email: profile.email,
        avatar: profile.avatar_url || `https://picsum.photos/seed/${targetId}/100`,
        role,
        is_active: true,
      });
      if (error) throw error;
    }

    return json({ ok: true, provisioned: true });
  } catch (err) {
    console.error('provision-from-vpsistema error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
