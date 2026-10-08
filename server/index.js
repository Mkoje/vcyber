import fs from 'node:fs/promises';
import path from 'node:path';
import { config, validateConfig } from './config.js';
import { initDb, closeDb, query } from './db.js';
import { createApp } from './app.js';
import { seedResources } from './seed.js';
import { reconcile } from './mpesa.js';
validateConfig();
await initDb();
for (const dir of ['orders', 'resources', 'quarantine'])
  await fs.mkdir(path.join(config.storage, dir), { recursive: true, mode: 0o700 });
await seedResources();
const server = createApp().listen(config.port, '0.0.0.0', () =>
  console.log(
    `Victorious Cyber API listening on ${config.port}. Mode: ${config.demo ? 'local demo' : 'Daraja ' + config.mpesa.env}`,
  ),
);
let reconciling = false;
const worker = setInterval(async () => {
  if (reconciling) return;
  reconciling = true;
  try {
    await reconcile();
  } catch {
    console.warn('Payment reconciliation deferred; it will retry.');
  } finally {
    reconciling = false;
  }
}, 30000);
// Expired personal files are removed after 24 hours. Keep minimal payment metadata for accounting.
const cleanup = setInterval(async () => {
  try {
    const expired = await query('SELECT id FROM orders WHERE expires<$1 AND pdf_path IS NOT NULL', [
      Date.now(),
    ]);
    for (const o of expired) {
      await fs.rm(path.join(config.storage, 'orders', o.id), { recursive: true, force: true });
      await query('UPDATE orders SET pdf_path=NULL,docx_path=NULL,preview_count=0 WHERE id=$1', [
        o.id,
      ]);
    }
    const stale = await query('SELECT id FROM orders WHERE created_at<$1', [
      Date.now() - 365 * 86400000,
    ]);
    for (const o of stale) {
      await query('DELETE FROM downloads WHERE order_id=$1', [o.id]);
      await query('DELETE FROM attempts WHERE order_id=$1', [o.id]);
      await query('DELETE FROM orders WHERE id=$1', [o.id]);
    }
    await query('DELETE FROM audit_events WHERE created_at<$1', [Date.now() - 365 * 86400000]);
    await query(
      'DELETE FROM sessions WHERE expires<$1 AND id NOT IN (SELECT session_id FROM orders)',
      [Date.now()],
    );
    const quarantined = await fs.readdir(path.join(config.storage, 'quarantine'));
    for (const file of quarantined) {
      const p = path.join(config.storage, 'quarantine', file);
      if ((await fs.stat(p)).mtimeMs < Date.now() - 3600000) await fs.unlink(p);
    }
  } catch {
    console.warn('Cleanup deferred.');
  }
}, 3600000);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(worker);
    clearInterval(cleanup);
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
  });
