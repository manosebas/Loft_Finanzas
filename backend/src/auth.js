import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';

const COOKIE_NAME = 'lf_session';

function hmac(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const bufA = crypto.createHash('sha256').update(String(a)).digest();
  const bufB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(body)}`;
}

function verify(token) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function requireAuth(req, res, next) {
  if (verify(req.cookies?.[COOKIE_NAME])) return next();
  res.status(401).json({ error: 'No autorizado' });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta más tarde.' },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body ?? {};
  if (!password || !safeEqual(password, config.appPassword)) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const maxAge = config.sessionDays * 24 * 60 * 60 * 1000;
  res.cookie(COOKIE_NAME, sign({ exp: Date.now() + maxAge }), cookieOptions(maxAge));
  res.json({ ok: true });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ authenticated: !!verify(req.cookies?.[COOKIE_NAME]) });
});
