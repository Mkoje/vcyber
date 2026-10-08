// Isolated demo acceptance server; never uses live payments or the customer's database.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'vcyber-browser-server-'));
Object.assign(process.env, {
  DEMO_MODE: 'true',
  NODE_ENV: 'test',
  DATABASE_URL: '',
  STORAGE_DIR: storage,
  APP_URL: 'http://127.0.0.1:3002',
  GENERATION_LIMIT: '100',
});
const { initDb, query, closeDb } = await import('../server/db.js');
const { createApp } = await import('../server/app.js');
const { seedResources } = await import('../server/seed.js');
let server;
try {
  await initDb();
  for (const dir of ['orders', 'resources', 'quarantine']) await fs.mkdir(path.join(storage, dir));
  await seedResources();
  const password = randomBytes(24).toString('base64url');
  await query('INSERT INTO admins(email,password_hash) VALUES($1,$2)', [
    'browser@example.com',
    await bcrypt.hash(password, 10),
  ]);
  server = createApp().listen(3002, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const child = spawn(
    process.execPath,
    [process.env.ACCEPTANCE_TARGET === 'android' ? 'tests/android.mjs' : 'tests/browser.mjs'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        BASE_URL: process.env.APP_URL,
        TEST_ADMIN_EMAIL: 'browser@example.com',
        TEST_ADMIN_PASSWORD: password,
        QA_DIR: process.env.QA_DIR || path.join(os.tmpdir(), 'vcyber-browser'),
      },
    },
  );
  const timeout = setTimeout(() => child.kill(), 600000);
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code));
  });
  clearTimeout(timeout);
  if (result !== 0) process.exitCode = 1;
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await closeDb();
  const target = path.resolve(storage),
    parent = path.resolve(os.tmpdir());
  if (path.dirname(target) === parent && path.basename(target).startsWith('vcyber-browser-server-'))
    await fs.rm(target, { recursive: true, force: true });
}
