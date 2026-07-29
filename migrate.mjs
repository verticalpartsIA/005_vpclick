// Script pontual para criar/verificar o usuário administrador do VP Click.
// Roda fora do navegador (node migrate.mjs) e usa a service_role key, que dá
// acesso irrestrito ao banco — por isso nada aqui pode ser escrito no código:
// este arquivo é versionado, então tudo vem de variáveis de ambiente.
//
// Uso:
//   VITE_SUPABASE_URL=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   VP_ADMIN_EMAIL=... \
//   VP_ADMIN_PASSWORD=... \
//   node migrate.mjs
//
// A primeira já fica no .env local (não versionado). A service role key e a
// senha do admin são passadas na hora da execução — não devem ser gravadas em
// arquivo nenhum. Sem prefixo VITE_ de propósito: essa env não deve nunca ser
// lida pelo Vite/navegador, só por este script Node.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.VP_ADMIN_EMAIL;
const adminPassword = process.env.VP_ADMIN_PASSWORD;

const faltando = Object.entries({
    VITE_SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    VP_ADMIN_EMAIL: adminEmail,
    VP_ADMIN_PASSWORD: adminPassword,
})
    .filter(([, valor]) => !valor)
    .map(([nome]) => nome);

if (faltando.length > 0) {
    console.error(`Variáveis de ambiente obrigatórias não definidas: ${faltando.join(', ')}`);
    console.error('Veja o cabeçalho deste arquivo para o modo de uso.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdminUser() {
    console.log(`Criando usuario admin (${adminEmail})...`);

    const result = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
            name: process.env.VP_ADMIN_NAME || adminEmail.split('@')[0],
            role: 'ADMIN'
        }
    });

    if (result.error) {
        if (result.error.message && result.error.message.includes('already registered')) {
            console.log('Usuario ja existe');

            const listResult = await supabase.auth.admin.listUsers();
            if (listResult.data) {
                const user = listResult.data.users.find(u => u.email === adminEmail);
                if (user) {
                    console.log('ID do usuario:', user.id);
                }
            }
        } else {
            console.log('Erro:', JSON.stringify(result.error));
        }
    } else {
        console.log('Usuario criado com sucesso!');
        console.log('Email:', result.data.user.email);
        console.log('ID:', result.data.user.id);
    }
}

createAdminUser().catch(console.error);
