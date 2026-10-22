const required = ['APP_PASSWORD', 'SESSION_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Faltan variables de entorno: ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  isProduction: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT,
  appPassword: process.env.APP_PASSWORD,
  sessionSecret: process.env.SESSION_SECRET,
  sessionDays: Number(process.env.SESSION_DAYS) || 30,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
