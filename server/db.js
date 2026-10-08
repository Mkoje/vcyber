import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { config } from './config.js';
let pool, sqlite;
export async function initDb() {
  await fs.mkdir(config.storage, { recursive: true, mode: 0o700 });
  if (config.databaseUrl)
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
      max: 10,
    });
  else {
    if (!config.demo) throw new Error('Set DATABASE_URL, or enable local DEMO_MODE.');
    sqlite = new DatabaseSync(path.join(config.storage, 'demo.sqlite'));
    sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  }
  const schema = await fs.readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  if (pool) await pool.query(schema);
  else sqlite.exec(schema);
  for (const [id, label, amount] of [
    ['letter', 'Letter / page', 20],
    ['cv', 'Standard CV / page', 30],
    ['premiumCv', 'Canadian or compressed CV / page', 50],
    ['cbc', 'CBC assignment', 10],
    ['documents', 'Marketplace document', 5],
    ['software', 'Software item', 100],
    ['resetters', 'Printer reset utility', 100],
  ])
    await query('INSERT INTO prices(id,label,amount) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [
      id,
      label,
      amount,
    ]);
}
// Both database backends share parameterized SQL. Never interpolate user values.
export async function query(sql, params = []) {
  if (pool) return (await pool.query(sql, params)).rows;
  const values = [];
  const converted = sql.replace(/\$(\d+)/g, (_, n) => {
    values.push(params[Number(n) - 1] ?? null);
    return '?';
  });
  const statement = sqlite.prepare(converted);
  if (/^\s*(SELECT|WITH)/i.test(sql) || /\bRETURNING\b/i.test(sql)) return statement.all(...values);
  statement.run(...values);
  return [];
}
export async function one(sql, params = []) {
  return (await query(sql, params))[0];
}
export async function closeDb() {
  if (pool) await pool.end();
  if (sqlite) sqlite.close();
}
