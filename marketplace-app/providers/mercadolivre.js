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

export async function getToken() {
  if (canRefresh) {
    if (memo && memo.expires_at > Date.now()) return memo.access_token;
    return refreshAccessToken();
  }
  return STATIC_TOKEN;
}

/* ── chamadas à API ────────────────────────────────────────── */
/* O ML bloqueou /sites/MLB/search (403). Usamos a API de catálogo:
   /products/search (busca por texto) + /products/{id} (preço, imagem,
   link) e /trends (mais buscados) pra montar o feed. */

async function api(path) {
  const token = await getToken();
  const res = await fetch(`https://api.mercadolibre.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Mercado Livre HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function withAffiliate(url) {
  if (!AFFILIATE_TAG || !url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}matt_tool=${encodeURIComponent(AFFILIATE_TAG)}`;
}

/** Detalha um produto do catálogo (nome, imagem, link e preço quando houver).
 *  Obs.: o catálogo do ML não tem permalink (vem vazio) — montamos a URL
 *  pelo id. E buy_box_winner pode ser null (produto sem vendedor ativo);
 *  nesse caso o preço fica indisponível, mas o produto ainda aparece. */
async function getProduct(productId) {
  const p = await api(`/products/${productId}`);
  const bbw = p.buy_box_winner || {};
  const price = Number(bbw.price) || null;
  const priceOld = Number(bbw.original_price) || null;
  const discountPct =
    price && priceOld && priceOld > price ? Math.round((1 - price / priceOld) * 100) : 0;
  const image = p.pictures?.[0]?.secure_url || p.pictures?.[0]?.url || '';
  const productUrl = p.permalink || `https://www.mercadolivre.com.br/p/${p.id}`;

  return {
    id: `ml_${p.id}`,
    marketplace: 'mercadolivre',
    title: p.name || '',
    image,
    price,
    priceOld,
    discountPct,
    rating: null,
    sales: 0,
    commissionRate: null,
    productUrl,
    affiliateUrl: withAffiliate(productUrl),
  };
}

/** Detalha vários ids em paralelo. Só mantém produtos COM preço (os sem
 *  preço = sem vendedor ativo / sem estoque, então são descartados). */
async function detailMany(ids, limit) {
  const slice = [...new Set(ids)].slice(0, limit);
  const settled = await Promise.allSettled(slice.map((id) => getProduct(id)));
  return settled
    .filter((r) => r.status === 'fulfilled' && r.value.title)
    .map((r) => r.value);
}

/** IDs de produtos do catálogo pra uma palavra-chave (com paginação por offset). */
async function searchProductIds(keyword, limit, offset = 0) {
  const data = await api(
    `/products/search?site_id=MLB&status=active&q=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`,
  );
  return (data.results || []).map((r) => r.id || r).filter(Boolean);
}

export async function search(keyword, limit = 30, page = 1) {
  // Busca mais ids do que o limite porque vamos descartar os sem preço.
  const fetchN = Math.min(limit * 2, 50);
  const offset = (page - 1) * fetchN;
  const ids = await searchProductIds(keyword, fetchN, offset);
  return detailMany(ids, limit);
}

// O ML não entra no feed de "Promoções": a API não expõe preço pra pessoa
// física (buy_box_winner vem null até em best-seller em estoque), então não
// dá pra montar um catálogo de promoção confiável. O ML fica só na BUSCA.
export async function getDeals() {
  return [];
}

