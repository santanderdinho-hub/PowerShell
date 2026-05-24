/**
 * Diagnóstico do Mercado Livre.
 *
 * Usa o seu token (renovado automaticamente) pra testar quais endpoints
 * a sua conta consegue acessar. O ML fechou o /sites/MLB/search (403) pra
 * muita gente; este teste mostra o que ainda está aberto pra a gente
 * escolher o caminho certo do feed.
 *
 *   npm run meli-test
 */

import 'dotenv/config';
import { getToken } from '../providers/mercadolivre.js';

const ENDPOINTS = [
  ['users/me (sanidade do token)', 'https://api.mercadolibre.com/users/me'],
  ['busca pública', 'https://api.mercadolibre.com/sites/MLB/search?q=notebook&limit=1'],
  ['destaques/mais vendidos', 'https://api.mercadolibre.com/highlights/MLB/category/MLB1051'],
  ['tendências', 'https://api.mercadolibre.com/trends/MLB'],
  ['busca de produtos (catálogo)', 'https://api.mercadolibre.com/products/search?site_id=MLB&status=active&q=notebook&limit=1'],
];

const token = await getToken();
if (!token) {
  console.error('Sem token. Rode antes: npm run meli-auth');
  process.exit(1);
}

console.log('\nTestando endpoints do ML com seu token:\n');

for (const [label, url] of ENDPOINTS) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    const ok = res.ok ? 'OK ' : 'BLOQUEADO';
    console.log(`[${res.status} ${ok}] ${label}`);
    if (!res.ok) console.log(`        ${text.slice(0, 120)}`);
  } catch (e) {
    console.log(`[ERRO] ${label}: ${e.message}`);
  }
}

console.log('\nMe mande este resultado. O que estiver "200 OK" é o caminho que vamos usar.\n');
