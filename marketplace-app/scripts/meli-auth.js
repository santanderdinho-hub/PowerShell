/**
 * Bootstrap (uma vez só) do refresh token do Mercado Livre.
 *
 * Pré-requisitos no .env: MELI_CLIENT_ID, MELI_CLIENT_SECRET, MELI_REDIRECT_URI
 * (o redirect precisa estar cadastrado no seu app em developers.mercadolivre.com.br;
 *  pode ser https://localhost — basta bater com o cadastrado).
 *
 * Passo 1:  node scripts/meli-auth.js
 *           -> imprime a URL de autorização. Abra no navegador, autorize,
 *              e copie o valor de "code=" da URL pra onde foi redirecionado.
 *
 * Passo 2:  node scripts/meli-auth.js <CODE>
 *           -> troca o code por tokens e salva o refresh_token em
 *              .meli-token.json. A partir daí o app renova sozinho.
 */

import 'dotenv/config';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, '..', '.meli-token.json');

const CLIENT_ID = process.env.MELI_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.MELI_CLIENT_SECRET?.trim();
const REDIRECT_URI = process.env.MELI_REDIRECT_URI?.trim();

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.error('Faltam MELI_CLIENT_ID, MELI_CLIENT_SECRET ou MELI_REDIRECT_URI no .env');
  process.exit(1);
}

const code = process.argv[2];

if (!code) {
  const url =
    'https://auth.mercadolivre.com.br/authorization?response_type=code' +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  console.log('\n1) Abra esta URL no navegador e autorize:\n');
  console.log('   ' + url);
  console.log('\n2) Você será redirecionado pra algo como:');
  console.log(`   ${REDIRECT_URI}?code=TG-xxxxxxxx`);
  console.log('\n3) Rode de novo passando esse code:');
  console.log('   node scripts/meli-auth.js TG-xxxxxxxx\n');
  process.exit(0);
}

const body = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  code,
  redirect_uri: REDIRECT_URI,
});

const res = await fetch('https://api.mercadolibre.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
  body,
});

if (!res.ok) {
  console.error(`Falha ao trocar o code: HTTP ${res.status}\n${await res.text()}`);
  process.exit(1);
}

const json = await res.json();
fs.writeFileSync(
  STORE_PATH,
  JSON.stringify({ refresh_token: json.refresh_token, updated_at: new Date().toISOString() }, null, 2),
);

console.log('\n✅ Pronto! refresh_token salvo em .meli-token.json');
console.log('   O app agora renova o access token sozinho. Não precisa fazer mais nada.\n');
