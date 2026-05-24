/**
 * Provider Mercado Livre — API oficial com renovação AUTOMÁTICA de token.
 *
 * Doc: https://developers.mercadolivre.com.br
 *
 * O access token do ML expira em ~6h. Pra não ter que ficar gerando token
 * toda hora, este provider usa o fluxo de refresh token:
 *
 *   1) Você gera UMA vez um refresh_token (via `npm run meli-auth`).
 *   2) O app troca o refresh_token por um access_token novo sempre que
 *      o atual expira — sozinho.
 *   3) O ML rotaciona o refresh_token a cada uso; por isso guardamos o
 *      mais recente em .meli-token.json (fora do git) pra sobreviver a
 *      reinícios do servidor.
 *
 * Alternativa simples (sem auto-refresh): preencher só MELI_ACCESS_TOKEN
 * no .env — funciona, mas você terá que trocar o token a cada 6h.
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, '..', '.meli-token.json');

const CLIENT_ID = process.env.MELI_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.MELI_CLIENT_SECRET?.trim();
const ENV_REFRESH = process.env.MELI_REFRESH_TOKEN?.trim();
const STATIC_TOKEN = process.env.MELI_ACCESS_TOKEN?.trim();
const AFFILIATE_TAG = process.env.MELI_AFFILIATE_TAG?.trim();

const canRefresh = Boolean(CLIENT_ID && CLIENT_SECRET && (ENV_REFRESH || readStore()?.refresh_token));

export const id = 'mercadolivre';
export const label = 'Mercado Livre';
export const enabled = Boolean(STATIC_TOKEN || canRefresh);

/** Termos usados pra povoar o feed consolidado (ML não tem deals API). */
const DEFAULT_TERMS = ['ofertas', 'smartphone', 'notebook'];

/* ── cofre de token (arquivo local, fora do git) ───────────── */
function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeStore(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('[mercadolivre] não consegui salvar o token:', e.message);
  }
}

/* ── gestão do access token ────────────────────────────────── */
let memo = null; // { access_token, expires_at }

async function refreshAccessToken() {
  const refresh_token = readStore()?.refresh_token || ENV_REFRESH;
  if (!refresh_token) throw new Error('sem refresh_token (rode: npm run meli-auth)');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token,
  });

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`refresh falhou HTTP ${res.status}: ${await res.text()}`);

  const json = await res.json();
  // ML rotaciona o refresh_token: guarde sempre o mais novo.
  writeStore({ refresh_token: json.refresh_token, updated_at: new Date().toISOString() });
  memo = {
    access_token: json.access_token,
    expires_at: Date.now() + (json.expires_in - 120) * 1000, // 2 min de folga
  };
  return memo.access_token;
}

async function getToken() {
  if (canRefresh) {
    if (memo && memo.expires_at > Date.now()) return memo.access_token;
    return refreshAccessToken();
  }
  return STATIC_TOKEN;
}

/* ── chamadas à API ────────────────────────────────────────── */
async function searchRaw(query, limit) {
  const token = await getToken();
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Mercado Livre HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.results || [];
}

function withAffiliate(url) {
  if (!AFFILIATE_TAG || !url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}matt_tool=${encodeURIComponent(AFFILIATE_TAG)}`;
}

function normalize(item) {
  const price = Number(item.price) || 0;
  const priceOld = Number(item.original_price) || null;
  const discountPct =
    priceOld && priceOld > price ? Math.round((1 - price / priceOld) * 100) : 0;

  return {
    id: `ml_${item.id}`,
    marketplace: 'mercadolivre',
    title: item.title || '',
    image: (item.thumbnail || '').replace('-I.jpg', '-O.jpg'),
    price,
    priceOld,
    discountPct,
    rating: null,
    sales: Number(item.sold_quantity) || 0,
    commissionRate: null,
    productUrl: item.permalink || '',
    affiliateUrl: withAffiliate(item.permalink || ''),
  };
}

export async function getDeals(limit = 30) {
  const perTerm = Math.max(5, Math.ceil(limit / DEFAULT_TERMS.length));
  const results = await Promise.all(
    DEFAULT_TERMS.map((t) => searchRaw(t, perTerm).catch(() => [])),
  );
  const seen = new Set();
  return results
    .flat()
    .map(normalize)
    .filter((p) => (seen.has(p.id) ? false : seen.add(p.id)))
    .slice(0, limit);
}

export async function search(keyword, limit = 30) {
  const items = await searchRaw(keyword, limit);
  return items.map(normalize);
}
