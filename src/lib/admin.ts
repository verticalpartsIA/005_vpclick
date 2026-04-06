import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sfpnjwllcmentoocylow.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcG5qd2xsY21lbnRvb2N5bG93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg1MDg1OCwiZXhwIjoyMDg3NDI2ODU4fQ.zwp8V6sPNmKQTG-R0zK_nDPqX95vU5PwME0jVI3TYTY';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
