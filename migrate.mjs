import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sfpnjwllcmentoocylow.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcG5qd2xsY21lbnRvb2N5bG93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg1MDg1OCwiZXhwIjoyMDg3NDI2ODU4fQ.zwp8V6sPNmKQTG-R0zK_nDPqX95vU5PwME0jVI3TYTY';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdminUser() {
    console.log('Criando usuario admin...');

    const result = await supabase.auth.admin.createUser({
        email: 'geovane.silva@verticalparts.com.br',
        password: 'VPClick@2026',
        email_confirm: true,
        user_metadata: {
            name: 'Geovane Silva',
            role: 'ADMIN'
        }
    });

    if (result.error) {
        if (result.error.message && result.error.message.includes('already registered')) {
            console.log('Usuario ja existe');

            const listResult = await supabase.auth.admin.listUsers();
            if (listResult.data) {
                const user = listResult.data.users.find(u => u.email === 'geovane.silva@verticalparts.com.br');
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
