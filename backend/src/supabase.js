import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Cliente con service role: solo vive en el backend, nunca se expone al navegador.
export const supabase =
  config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

if (!supabase) {
  console.warn('Supabase no configurado: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}
