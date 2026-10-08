import { initDb, closeDb } from './db.js';
await initDb();
console.log('Database schema and prices are ready.');
await closeDb();
