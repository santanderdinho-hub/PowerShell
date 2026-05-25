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

/* ── dump do formato real (pra ajustar a normalização) ───────── */
async function getJson(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, json: await res.json().catch(() => null) };
}

console.log('═══ FORMATO CRU (cole isto também) ═══\n');

try {
  const search = await getJson(
    'https://api.mercadolibre.com/products/search?site_id=MLB&status=active&q=notebook&limit=3',
  );
  console.log('--- /products/search (notebook) ---');
  console.log('status:', search.status);
  console.log('chaves do topo:', Object.keys(search.json || {}).join(', '));
  const first = search.json?.results?.[0];
  console.log('1º resultado:', JSON.stringify(first, null, 2)?.slice(0, 800));

  const firstId = first?.id || first;
  if (firstId && typeof firstId === 'string') {
    const prod = await getJson(`https://api.mercadolibre.com/products/${firstId}`);
    console.log(`\n--- /products/${firstId} ---`);
    console.log('status:', prod.status);
    console.log('name:', prod.json?.name);
    console.log('permalink:', prod.json?.permalink);
    console.log('pictures[0]:', JSON.stringify(prod.json?.pictures?.[0]));
    console.log('buy_box_winner:', JSON.stringify(prod.json?.buy_box_winner, null, 2)?.slice(0, 400));

    // Fonte de preço A: listagens do produto de catálogo
    const items = await getJson(`https://api.mercadolibre.com/products/${firstId}/items?limit=2`);
    console.log(`\n--- /products/${firstId}/items ---`);
    console.log('status:', items.status);
    console.log('topo:', Object.keys(items.json || {}).join(', '));
    console.log('1º item:', JSON.stringify(items.json?.results?.[0], null, 2)?.slice(0, 600));
  }

  // Fonte de preço B: itens dos destaques (mais vendidos)
  const hl = await getJson('https://api.mercadolibre.com/highlights/MLB/category/MLB1051');
  console.log('\n--- /highlights/MLB/category/MLB1051 ---');
  console.log('status:', hl.status);
  console.log('topo:', Object.keys(hl.json || {}).join(', '));
  const hlFirst = hl.json?.content?.[0];
  console.log('content[0]:', JSON.stringify(hlFirst));
  const hlId = hlFirst?.id;
  if (hlId && /^ML/.test(hlId)) {
    // highlights traz ids de PRODUTO de catálogo -> consulta /products
    const pr = await getJson(`https://api.mercadolibre.com/products/${hlId}`);
    console.log(`\n--- /products/${hlId} (mais vendido #1) ---`);
    console.log('status:', pr.status);
    console.log('name:', pr.json?.name);
    console.log('permalink:', pr.json?.permalink);
    console.log('buy_box_winner:', JSON.stringify(pr.json?.buy_box_winner, null, 2)?.slice(0, 500));
  }
} catch (e) {
  console.log('dump falhou:', e.message);
}
console.log('');

