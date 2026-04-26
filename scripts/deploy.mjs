#!/usr/bin/env node
// Deploy de dist/ al hosting Hostinger por FTP.
//
// Lee credenciales de .env.local (gitignored). NO ejecuta build — asume que
// 'dist/' ya esta listo. Uso:
//   pnpm build && pnpm deploy
//
// El deploy es incremental: sube todo dist/ machacando lo que haya en remoto.
// .htaccess incluido (Vite copia public/.htaccess a dist/.htaccess en build).

import { Client } from 'basic-ftp';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const ENV_FILE = resolve(ROOT, '.env.local');

if (!existsSync(DIST)) {
  console.error('❌ No existe dist/. Ejecuta `pnpm build` primero.');
  process.exit(1);
}

if (!existsSync(ENV_FILE)) {
  console.error('❌ No existe .env.local. Copialo de .env.example y rellena las HOSTINGER_FTP_*');
  process.exit(1);
}

// Mini-parser de .env (sin dotenv, evitamos dep adicional)
const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const eq = l.indexOf('=');
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()];
    }),
);

const HOST = env.HOSTINGER_FTP_HOST;
const USER = env.HOSTINGER_FTP_USER;
const PASSWORD = env.HOSTINGER_FTP_PASSWORD;
const REMOTE_PATH = env.HOSTINGER_FTP_REMOTE_PATH;

for (const [k, v] of Object.entries({ HOST, USER, PASSWORD, REMOTE_PATH })) {
  if (!v) {
    console.error(`❌ Falta HOSTINGER_FTP_${k} en .env.local`);
    process.exit(1);
  }
}

const client = new Client(30_000);
client.ftp.verbose = false;

try {
  console.log(`🔌 Conectando a ${HOST} como ${USER}…`);
  await client.access({
    host: HOST,
    user: USER,
    password: PASSWORD,
    secure: false, // Hostinger admite FTP plano + FTPS; basic-ftp negocia auto si pones true
  });

  console.log(`📂 Cambiando a ${REMOTE_PATH}…`);
  await client.ensureDir(REMOTE_PATH);
  await client.cd(REMOTE_PATH);

  console.log(`📤 Subiendo dist/ (esto puede tardar 30-60s)…`);
  client.trackProgress((info) => {
    if (info.type === 'upload' && info.name) {
      const kb = (info.bytes / 1024).toFixed(1);
      process.stdout.write(`   ↳ ${info.name} (${kb} KB)\r\n`);
    }
  });

  await client.uploadFromDir(DIST);

  console.log('\n✅ Deploy completado.');
  console.log(`   https://sincro.movimientofuncional.app/`);
} catch (err) {
  console.error('\n❌ Error en el deploy:');
  console.error(err.message);
  process.exit(1);
} finally {
  client.close();
}
