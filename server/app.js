import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs/promises';
import { z } from 'zod';
import { config } from './config.js';
import { query, one } from './db.js';
import {
  id,
  HttpError,
  session,
  sameOrigin,
  adminOnly,
  ownedOrder,
  safeOrder,
  normalizePhone,
  constantEqual,
} from './security.js';
import { generateDocument, generationInput } from './ai.js';
import { renderDocument } from './documents.js';
import { stkPush, settleAttempt, queryStk } from './mpesa.js';
import { upload, extractCv, storeResource } from './uploads.js';
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const limiter = (max, windowMs = 60000) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait and try again.' },
  });
const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Set this to your exact trusted proxy topology; one hop for supplied nginx.
  if (config.production) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: config.production ? [] : null,
        },
      },
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '48kb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  // Provider endpoint does not create visitor cookies or require a CSRF header.
  app.post(
    '/api/mpesa/callback',
    limiter(90),
    noStore,
    wrap(async (req, res) => {
      if (config.demo || !constantEqual(req.query.secret, config.mpesa.callbackSecret))
        throw new HttpError(403, 'Invalid callback credentials.');
      const callback = req.body?.Body?.stkCallback;
      if (
        !callback ||
        typeof callback.CheckoutRequestID !== 'string' ||
        !Number.isInteger(callback.ResultCode)
      )
        throw new HttpError(400, 'Invalid callback.');
      const attempt = await one('SELECT * FROM attempts WHERE checkout_id=$1', [
        callback.CheckoutRequestID,
      ]);
      if (!attempt) throw new HttpError(503, 'Payment request not yet available.');
      if (callback.MerchantRequestID !== attempt.merchant_id)
        throw new HttpError(400, 'Request mismatch.');
      // Persist before querying. A scheduled worker retries temporary provider failures.
      await query("UPDATE attempts SET callback_json=$1 WHERE id=$2 AND state!='PAID'", [
        JSON.stringify(callback),
        attempt.id,
      ]);
      try {
        await settleAttempt(attempt, callback);
      } catch (e) {
        if (e.status === 400) throw e;
        console.warn('Callback persisted for reconciliation', attempt.id.slice(0, 8));
      }
      res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }),
  );
  app.use('/api', noStore, limiter(180), session, sameOrigin);
  app.get(
    '/api/config',
    wrap(async (_req, res) =>
      res.json({
        demo: config.demo,
        imagesEnabled: !config.demo && process.env.AI_IMAGES_ENABLED === 'true',
        prices: await query('SELECT * FROM prices ORDER BY id'),
      }),
    ),
  );
  app.get(
    '/api/resources',
    wrap(async (_req, res) =>
      res.json(
        await query(
          'SELECT id,title,category,description,price,active,license,original_name FROM resources WHERE active=1 OR file_path IS NULL ORDER BY created_at',
        ),
      ),
    ),
  );
  app.post(
    '/api/generate-doc',
    limiter(Number(process.env.GENERATION_LIMIT || 10), 3600000),
    upload.single('cv'),
    wrap(async (req, res) => {
      let input;
      try {
        const text = req.file ? await extractCv(req.file) : '';
        input = generationInput.parse({
          ...req.body,
          prompt: [req.body.prompt, text].filter(Boolean).join('\n\nExisting CV:\n'),
        });
      } catch (e) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        throw e;
      }
      if (
        input.illustration === 'image' &&
        (config.demo || process.env.AI_IMAGES_ENABLED !== 'true')
      )
        throw new HttpError(
          503,
          'Image generation is not enabled. Select a diagram or no illustration.',
        );
      const data = await generateDocument(input),
        orderId = id();
      let rendered;
      try {
        rendered = await renderDocument(
          orderId,
          data,
          input.template,
          input.kind === 'cbc' ? input.illustration : 'none',
        );
      } catch (e) {
        await fs.rm(path.join(config.storage, 'orders', orderId), { recursive: true, force: true });
        throw e;
      }
      const priceId =
        input.kind === 'cv' && ['canadian', 'compressed'].includes(input.template)
          ? 'premiumCv'
          : input.kind;
      const unitPrice = (await one('SELECT amount FROM prices WHERE id=$1', [priceId])).amount;
      const amount = input.kind === 'cbc' ? unitPrice : rendered.pages * unitPrice;
      const now = Date.now();
      await query(
        'INSERT INTO orders(id,session_id,title,kind,template,pages,unit_price,amount,pdf_path,docx_path,preview_count,expires,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [
          orderId,
          req.session.id,
          data.title,
          input.kind,
          input.template,
          rendered.pages,
          unitPrice,
          amount,
          rendered.pdfPath,
          rendered.docxPath,
          rendered.previewCount,
          now + 86400000,
          now,
        ],
      );
      res.status(201).json(safeOrder(await one('SELECT * FROM orders WHERE id=$1', [orderId])));
    }),
  );
  app.get(
    '/api/preview/:orderId/:page',
    wrap(async (req, res) => {
      const order = await ownedOrder(req, req.params.orderId),
        page = Number(req.params.page);
      if (order.expires < Date.now()) throw new HttpError(410, 'Preview expired.');
      if (!Number.isInteger(page) || page < 1 || page > order.preview_count)
        throw new HttpError(404, 'Page not found.');
      res.set('Content-Type', 'image/jpeg');
      res.sendFile(path.join(config.storage, 'orders', order.id, `preview-${page}.jpg`));
    }),
  );
  app.post(
    '/api/orders',
    wrap(async (req, res) => {
      const resourceId = z
        .string()
        .regex(/^[a-f0-9]{48}$/)
        .parse(req.body.resourceId);
      const resource = await one('SELECT * FROM resources WHERE id=$1 AND active=1', [resourceId]);
      if (!resource?.file_path) throw new HttpError(404, 'This resource is not available yet.');
      const orderId = id(),
        now = Date.now();
      await query(
        'INSERT INTO orders(id,session_id,title,kind,pages,unit_price,amount,file_path,original_name,expires,created_at) VALUES($1,$2,$3,$4,1,$5,$5,$6,$7,$8,$9)',
        [
          orderId,
          req.session.id,
          resource.title,
          resource.category,
          resource.price,
          resource.file_path,
          resource.original_name,
          now + 86400000,
          now,
        ],
      );
      res.status(201).json(safeOrder(await one('SELECT * FROM orders WHERE id=$1', [orderId])));
    }),
  );
  app.get(
    '/api/orders',
    wrap(async (req, res) =>
      res.json(
        (
          await query(
            'SELECT * FROM orders WHERE session_id=$1 ORDER BY created_at DESC LIMIT 50',
            [req.session.id],
          )
        ).map(safeOrder),
      ),
    ),
  );
  app.get(
    '/api/orders/:id',
    wrap(async (req, res) => res.json(safeOrder(await ownedOrder(req, req.params.id)))),
  );
  app.post(
    '/api/mpesa/stkpush',
    limiter(6),
    wrap(async (req, res) => {
      const order = await ownedOrder(req, req.body.orderId);
      res.json(await stkPush(order, req.body.phone));
    }),
  );
  // Separate explicit demo completion; production cannot invoke this endpoint.
  app.post(
    '/api/demo/complete',
    wrap(async (req, res) => {
      if (!config.demo || config.production) throw new HttpError(404, 'Not found.');
      const order = await ownedOrder(req, req.body.orderId);
      if (order.status !== 'PENDING') throw new HttpError(409, 'Start demo checkout first.');
      const now = Date.now();
      await query(
        "UPDATE orders SET status='PAID',receipt=$1,paid_at=$2,expires=$3 WHERE id=$4 AND status='PENDING'",
        ['DEMO' + id().slice(0, 10).toUpperCase(), now, now + 86400000, order.id],
      );
      res.json(safeOrder(await ownedOrder(req, order.id)));
    }),
  );
  app.get(
    '/api/download',
    wrap(async (req, res) => {
      const order = await ownedOrder(req, req.query.orderId);
      if (order.status !== 'PAID')
        throw new HttpError(402, 'Complete payment to download this file.');
      if (order.expires < Date.now())
        throw new HttpError(410, 'The 24-hour download period has expired. Contact support.');
      const format = z.enum(['pdf', 'docx', 'file']).parse(req.query.format || 'pdf');
      const location =
        format === 'pdf' ? order.pdf_path : format === 'docx' ? order.docx_path : order.file_path;
      if (!location) throw new HttpError(404, 'This file format is unavailable.');
      // Paths are database-owned, never supplied by the browser, and private by default.
      await fs.access(location);
      await query('INSERT INTO downloads(id,order_id,format,created_at) VALUES($1,$2,$3,$4)', [
        id(),
        order.id,
        format,
        Date.now(),
      ]);
      res.download(
        location,
        format === 'file' ? order.original_name : `${order.kind}-${order.id.slice(0, 8)}.${format}`,
      );
    }),
  );
  app.post(
    '/api/orders/recover',
    limiter(5, 15 * 60000),
    wrap(async (req, res) => {
      const phone = normalizePhone(req.body.phone),
        receipt = z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{8,24}$/)
          .parse(req.body.receipt);
      const order = await one(
        "SELECT * FROM orders WHERE phone=$1 AND receipt=$2 AND status='PAID' AND expires>$3",
        [phone, receipt, Date.now()],
      );
      if (!order)
        throw new HttpError(404, 'No matching purchase is available within the last 24 hours.');
      // Possession of both receipt and phone grants access only to this paid purchase.
      await query('UPDATE orders SET session_id=$1 WHERE id=$2', [req.session.id, order.id]);
      res.json(safeOrder(order));
    }),
  );
  app.get(
    '/api/receipt/:id',
    wrap(async (req, res) => {
      const o = await ownedOrder(req, req.params.id);
      if (o.status !== 'PAID') throw new HttpError(402, 'Receipt available after payment.');
      res.json({
        business: 'Victorious Cyber',
        domain: 'vcyber.co.ke',
        contact: '0725890432',
        order: o.id,
        title: o.title,
        amount: o.amount,
        currency: 'KES',
        mpesaReceipt: o.receipt,
        paidAt: o.paid_at,
        pages: o.pages,
        downloadExpiry: o.expires,
        demo: config.demo,
      });
    }),
  );
  app.get('/api/admin/session', (req, res) => res.json({ authenticated: !!req.session.admin }));
  app.post(
    '/api/admin/login',
    limiter(5, 15 * 60000),
    wrap(async (req, res) => {
      const email = z.email().parse(req.body.email).toLowerCase(),
        password = z.string().min(1).max(200).parse(req.body.password);
      const admin = await one('SELECT * FROM admins WHERE email=$1', [email]);
      const valid = await bcrypt.compare(
        password,
        admin?.password_hash || '$2b$12$4MfxDRIwvDUcWDK9DO0fUOPrUqDLPNyKkFsRvkrIzAkTVHyK.L.Mu',
      );
      if (!admin || !valid) throw new HttpError(401, 'Incorrect email or password.');
      // Rotate the anonymous session after privilege escalation; preserve its orders.
      const sessionId = id();
      await query('INSERT INTO sessions(id,admin,expires) VALUES($1,1,$2)', [
        sessionId,
        Date.now() + 8 * 3600000,
      ]);
      await query('UPDATE orders SET session_id=$1 WHERE session_id=$2', [
        sessionId,
        req.session.id,
      ]);
      await query('DELETE FROM sessions WHERE id=$1', [req.session.id]);
      res.cookie('vc_session', sessionId, {
        httpOnly: true,
        secure: config.production,
        sameSite: 'strict',
        maxAge: 8 * 3600000,
        path: '/',
      });
      res.json({ ok: true });
    }),
  );
  app.use('/api/admin', adminOnly);
  app.post(
    '/api/admin/logout',
    wrap(async (req, res) => {
      await query('UPDATE sessions SET admin=0 WHERE id=$1', [req.session.id]);
      res.json({ ok: true });
    }),
  );
  app.get(
    '/api/admin/resources',
    wrap(async (_req, res) => {
      const resources = await query('SELECT * FROM resources ORDER BY created_at DESC');
      res.json(
        resources.map(({ file_path, ...resource }) => ({ ...resource, hasFile: !!file_path })),
      );
    }),
  );
  app.get(
    '/api/admin/resources/:id/file',
    wrap(async (req, res) => {
      const resource = await one('SELECT * FROM resources WHERE id=$1', [req.params.id]);
      if (!resource?.file_path) throw new HttpError(404, 'Resource file not found.');
      await fs.access(resource.file_path).catch(() => {
        throw new HttpError(404, 'Resource file is missing. Upload a replacement.');
      });
      res.download(resource.file_path, resource.original_name);
    }),
  );
  app.post(
    '/api/admin/resources/:id/file',
    upload.single('file'),
    wrap(async (req, res) => {
      let stored;
      try {
        const resource = await one('SELECT * FROM resources WHERE id=$1', [req.params.id]);
        if (!resource) throw new HttpError(404, 'Resource not found.');
        stored = await storeResource(req.file, resource.category);
        // Existing orders retain their original file, including after a listing is replaced.
        await query('UPDATE resources SET file_path=$1,original_name=$2 WHERE id=$3', [
          stored.path,
          stored.name,
          resource.id,
        ]);
        res.json({ ok: true });
      } catch (e) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        if (stored) await fs.unlink(stored.path).catch(() => {});
        throw e;
      }
    }),
  );
  app.get(
    '/api/admin/stats',
    wrap(async (_req, res) => {
      const orders = await query(
        'SELECT id,title,kind,status,amount,receipt,paid_at,created_at FROM orders ORDER BY created_at DESC LIMIT 100',
      );
      const totals = await one(
        "SELECT COALESCE(SUM(amount),0) AS revenue,COUNT(*) AS payments FROM orders WHERE status='PAID'",
      );
      const day = new Date(Date.now() + 3 * 3600000);
      day.setUTCHours(0, 0, 0, 0);
      const start = day.getTime() - 3 * 3600000;
      const daily = await one(
        "SELECT COALESCE(SUM(amount),0) AS revenue,COUNT(*) AS payments FROM orders WHERE status='PAID' AND paid_at>=$1",
        [start],
      );
      const downloads = await one('SELECT COUNT(*) AS count FROM downloads');
      const pending = await query(
        "SELECT a.id,a.checkout_id,a.state,o.id AS order_id,o.title,o.amount FROM attempts a JOIN orders o ON a.order_id=o.id WHERE a.state IN ('PENDING','REVIEW','STARTING') ORDER BY a.created_at DESC LIMIT 50",
      );
      res.json({ totals, daily, downloads: downloads.count, orders, pending, demo: config.demo });
    }),
  );
  app.post(
    '/api/admin/resources',
    upload.single('file'),
    wrap(async (req, res) => {
      let stored;
      try {
        const input = z
          .object({
            title: z.string().trim().min(4).max(120),
            category: z.enum(['documents', 'software', 'resetters']),
            description: z.string().trim().min(10).max(1000),
            license: z.string().trim().min(10).max(1000),
          })
          .parse(req.body);
        stored = await storeResource(req.file, input.category);
        const price = (await one('SELECT amount FROM prices WHERE id=$1', [input.category])).amount;
        await query(
          'INSERT INTO resources(id,title,category,description,price,file_path,original_name,active,license,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,$9)',
          [
            id(),
            input.title,
            input.category,
            input.description,
            price,
            stored.path,
            stored.name,
            input.license,
            Date.now(),
          ],
        );
        res.status(201).json({ ok: true });
      } catch (e) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        if (stored) await fs.unlink(stored.path).catch(() => {});
        throw e;
      }
    }),
  );
  app.patch(
    '/api/admin/resources/:id',
    wrap(async (req, res) => {
      const input = z
        .object({
          active: z.number().int().min(0).max(1).optional(),
          title: z.string().trim().min(4).max(120).optional(),
          description: z.string().trim().min(10).max(1000).optional(),
          license: z.string().trim().min(10).max(1000).optional(),
        })
        .strict()
        .refine((value) => Object.keys(value).length > 0, 'Supply a listing change.')
        .parse(req.body);
      const r = await one('SELECT * FROM resources WHERE id=$1', [req.params.id]);
      if (!r) throw new HttpError(404, 'Resource not found.');
      if (input.active === 1) {
        if (!r.file_path) throw new HttpError(400, 'Upload a file before publishing.');
        await fs.access(r.file_path).catch(() => {
          throw new HttpError(400, 'The file is missing. Upload a replacement before publishing.');
        });
      }
      await query('UPDATE resources SET active=$1,title=$2,description=$3,license=$4 WHERE id=$5', [
        input.active ?? r.active,
        input.title ?? r.title,
        input.description ?? r.description,
        input.license ?? r.license,
        r.id,
      ]);
      res.json({ ok: true });
    }),
  );
  app.patch(
    '/api/admin/prices/:id',
    wrap(async (req, res) => {
      const amount = z.number().int().min(1).max(10000).parse(req.body.amount);
      const changed = await query('UPDATE prices SET amount=$1 WHERE id=$2 RETURNING id', [
        amount,
        req.params.id,
      ]);
      if (!changed.length) throw new HttpError(404, 'Price tier not found.');
      if (['documents', 'software', 'resetters'].includes(req.params.id))
        await query('UPDATE resources SET price=$1 WHERE category=$2', [amount, req.params.id]);
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/admin/reconcile',
    wrap(async (req, res) => {
      const a = await one('SELECT * FROM attempts WHERE id=$1', [req.body.attemptId]);
      if (!a?.checkout_id)
        throw new HttpError(409, 'This payment requires manual investigation in Daraja.');
      // A missed callback requires verified staff-supplied receipt from the merchant statement.
      if (!a.callback_json)
        throw new HttpError(
          409,
          'Callback missing. Verify the merchant statement and use the documented recovery process.',
        );
      await settleAttempt(a, JSON.parse(a.callback_json));
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/admin/confirm-receipt',
    wrap(async (req, res) => {
      if (config.demo) throw new HttpError(409, 'Use demo checkout in local demo mode.');
      const input = z
        .object({
          attemptId: z.string().regex(/^[a-f0-9]{48}$/),
          receipt: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9]{8,20}$/),
          phone: z.string(),
          amount: z.number().int().positive(),
          note: z.string().trim().min(20).max(500),
        })
        .parse(req.body);
      const a = await one('SELECT * FROM attempts WHERE id=$1', [input.attemptId]);
      if (!a?.checkout_id)
        throw new HttpError(
          409,
          'No checkout ID. Resolve this request with Safaricom before recording payment.',
        );
      const o = await one('SELECT * FROM orders WHERE id=$1', [a.order_id]);
      if (input.amount !== o.amount || normalizePhone(input.phone) !== o.phone)
        throw new HttpError(400, 'Merchant statement details do not match.');
      if (o.status === 'PAID') throw new HttpError(409, 'Order already paid.');
      const callback = {
        CheckoutRequestID: a.checkout_id,
        MerchantRequestID: a.merchant_id,
        ResultCode: 0,
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: input.amount },
            { Name: 'PhoneNumber', Value: normalizePhone(input.phone) },
            { Name: 'MpesaReceiptNumber', Value: input.receipt },
          ],
        },
      };
      // Only authenticated staff can supply statement data; Daraja must still report success.
      const verification = await queryStk(a.checkout_id);
      if (Number(verification.ResultCode) !== 0 || !Object.hasOwn(verification, 'ResultCode'))
        throw new HttpError(409, 'Daraja has not confirmed this payment.');
      await query(
        'INSERT INTO audit_events(id,session_id,action,target_id,note,created_at) VALUES($1,$2,$3,$4,$5,$6)',
        [id(), req.session.id, 'MERCHANT_STATEMENT_CONFIRMATION', o.id, input.note, Date.now()],
      );
      await settleAttempt(a, callback);
      res.json({ ok: true });
    }),
  );
  app.use(
    express.static(path.resolve('dist'), { index: false, maxAge: config.production ? '1h' : 0 }),
  );
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next(new HttpError(404, 'Not found.'));
    res.sendFile(path.resolve('dist/index.html'));
  });
  app.use((e, _req, res, _next) => {
    if (res.headersSent) return _next(e);
    if (e instanceof z.ZodError)
      return res.status(400).json({ error: e.issues.map((i) => i.message).join(' ') });
    if (e.code === 'LIMIT_FILE_SIZE')
      return res
        .status(413)
        .json({ error: 'File too large. Maximum upload size is 100 MB; CVs must be below 5 MB.' });
    if (e.name === 'MulterError')
      return res.status(400).json({ error: 'Invalid upload. Select one file and try again.' });
    const status = e.status || 500;
    if (status >= 500) console.error('Request failed:', e.name, e.status || 500);
    res.status(status).json({
      error:
        status === 500 ? 'Something went wrong. Please try again or contact support.' : e.message,
    });
  });
  return app;
}
