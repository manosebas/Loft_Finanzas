import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { authRouter, requireAuth } from './auth.js';
import { supabase } from './supabase.js';
import { financeRouter } from './finance.js';

const app = express();

// Dos proxies delante del servidor: rewrite de Vercel y edge de Railway.
app.set('trust proxy', 2);
app.disable('x-powered-by');
app.use(express.json());
app.use(cookieParser());

// Rutas públicas
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);

// Todo lo demás bajo /api requiere sesión
app.use('/api', requireAuth);

app.get('/api/status', (req, res) => {
  res.json({ ok: true, supabase: !!supabase });
});

app.use('/api', financeRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(config.port, () => {
  console.log(`Backend escuchando en puerto ${config.port}`);
});
