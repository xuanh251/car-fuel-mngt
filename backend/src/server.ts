import 'dotenv/config';
import { buildApp } from './app.js';
import path from 'node:path';
import fs from 'node:fs';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DATABASE_PATH = process.env.DATABASE_PATH || './data/app.db';

// Ensure data directory exists
const dataDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = buildApp({
  databasePath: DATABASE_PATH,
});

async function start() {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
