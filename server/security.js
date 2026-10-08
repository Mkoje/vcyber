import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { query, one } from './db.js';
export const id = () => randomBytes(24).toString('hex');
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function normalizePhone(input) {
  let p = String(input || '').replace(/[\s+()-]/g, '');
  if (/^0[17]\d{8}$/.test(p)) p = '254' + p.slice(1);
  if (!/^254[17]\d{8}$/.test(p))
    throw new HttpError(400, 'Enter a valid Kenyan mobile number, such as 0725890432.');
  return p;
}
export function constantEqual(a, b) {
  const x = Buffer.from(String(a || '')),
    y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
export async function session(req, res, next) {
  try {
    let found = req.cookies.vc_session
      ? await one('SELECT * FROM sessions WHERE id=$1 AND expires>$2', [
          req.cookies.vc_session,
          Date.now(),
        ])
      : null;
    if (!found) {
      found = { id: id(), admin: 0, expires: Date.now() + 7 * 86400000 };
      await query('INSERT INTO sessions(id,admin,expires) VALUES($1,0,$2)', [
        found.id,
        found.expires,
      ]);
      res.cookie('vc_session', found.id, {
        httpOnly: true,
        secure: config.production,
        sameSite: 'strict',
        maxAge: 7 * 86400000,
        path: '/',
      });
    }
    req.session = found;
    next();
  } catch (e) {
    next(e);
  }
}
export function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Callback authentication is handled separately; it is not a browser request.
  const origin = req.headers.origin;
  if (origin && origin !== new URL(config.appUrl).origin) {
    let loopback = false;
    if (!config.production) {
      try {
        const actual = new URL(origin),
          expected = new URL(config.appUrl);
        loopback =
          actual.protocol === 'http:' &&
          expected.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(actual.hostname) &&
          ['localhost', '127.0.0.1'].includes(expected.hostname) &&
          actual.port === expected.port;
      } catch {}
    }
    if (!loopback) return next(new HttpError(403, 'Request origin is not allowed.'));
  }
  if (req.headers['x-vcyber-request'] !== '1')
    return next(new HttpError(403, 'Missing request verification header.'));
  next();
}
export function adminOnly(req, res, next) {
  if (!req.session.admin) return next(new HttpError(401, 'Sign in as an administrator.'));
  next();
}
export async function ownedOrder(req, orderId) {
  if (!/^[a-f0-9]{48}$/.test(orderId || '')) throw new HttpError(404, 'Order not found.');
  const order = await one('SELECT * FROM orders WHERE id=$1 AND session_id=$2', [
    orderId,
    req.session.id,
  ]);
  if (!order) throw new HttpError(404, 'Order not found.');
  return order;
}
export function safeOrder(o) {
  return {
    id: o.id,
    title: o.title,
    kind: o.kind,
    pages: o.pages,
    unitPrice: o.unit_price,
    amount: o.amount,
    status: o.status,
    receipt: o.receipt,
    paidAt: o.paid_at,
    expires: o.expires,
    previewCount: o.preview_count,
    formats: o.docx_path ? ['pdf', 'docx'] : o.pdf_path ? ['pdf'] : ['file'],
  };
}
