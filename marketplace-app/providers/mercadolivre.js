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
 *      mais recente em .meli-token.json (fora do git, modo 0600) pra
 *      sobreviver a reinícios do servidor.
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

const REQUEST_TIMEOUT_MS = 12_000;

export const id = 'mercadolivre';
export const label = 'Mercado Livre';

/** Avaliado em cada chamada (e não congelado no import) pra que rodar
 *  `npm run meli-auth` em outro terminal ligue o provider sem reiniciar. */
export function isEnabled() {
  if (STATIC_TOKEN) return true;
  if (!CLIENT_ID || !CLIENT_SECRET) return false;
  return Boolean(ENV_REFRESH || readStore()?.refresh_token);
}

/* ── cofre de token (arquivo local, fora do git, modo 0600) ──── */
function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/** Escrita atômica + modo 0600: escreve num temporário e renomeia. */
function writeStore(data) {
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STORE_PATH);
}

/* ── gestão do access token ────────────────────────────────── */
let memo = null;            // { access_token, expires_at }
let inflightRefresh = null; // dedup de refresh concorrente

async function refreshAccessToken() {
  const refresh_token = readStore()?.refresh_token || ENV_REFRESH;
  if (!refresh_token) throw new Error('sem refresh_token (rode: npm run meli-auth)');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token,
  });

  const json = await httpJson('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });

  // ML rotaciona o refresh_token. Persiste ANTES de usar o novo access
  // token: se a escrita falhar, recusamos o token novo pra não acabar com
  // um par "access válido na memória / refresh velho em disco" que tranca
  // a conta no próximo restart.
  try {
    writeStore({ refresh_token: json.refresh_token, updated_at: new Date().toISOString() });
  } catch (e) {
    throw new Error(`não consegui persistir o refresh_token (${e.code || e.message}). Refresh abortado pra preservar a conta.`);
  }

  // Sempre garante pelo menos 60s de validade pra evitar loop de refresh
  // caso o ML devolva um expires_in muito curto.
  const safeMs = Math.max(60, Number(json.expires_in) - 120) * 1000;
  memo = { access_token: json.access_token, expires_at: Date.now() + safeMs };
  return memo.access_token;
}

export async function getToken() {
  if (STATIC_TOKEN && !CLIENT_ID) return STATIC_TOKEN;
  if (memo && memo.expires_at > Date.now()) return memo.access_token;

  // Dedup: callers concorrentes esperam o mesmo refresh.
  if (!inflightRefresh) {
    inflightRefresh = refreshAccessToken().finally(() => { inflightRefresh = null; });
  }
  return inflightRefresh;
}

/* ── chamadas à API ────────────────────────────────────────── */
/* O ML bloqueou /sites/MLB/search (403). Usamos a API de catálogo:
   /products/search (busca por texto) + /products/{id} (preço, imagem,
   link). */

async function httpJson(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Mercado Livre: timeout');
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // Mensagens curtas e sanitizadas, sem ecoar o corpo do upstream.
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Mercado Livre: autenticação falhou (${res.status})`);
    }
    throw new Error(`Mercado Livre HTTP ${res.status}`);
  }
  return res.json();
}

async function api(path) {
  const token = await getToken();
  return httpJson(`https://api.mercadolibre.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function withAffiliate(url) {
  if (!AFFILIATE_TAG || !url) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('matt_tool', AFFILIATE_TAG);
    return u.toString();
  } catch {
    return url;
  }
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

async function detailMany(ids, limit) {
  const slice = [...new Set(ids)].slice(0, limit);
  const settled = await Promise.allSettled(slice.map((id) => getProduct(id)));
  return settled
    .filter((r) => r.status === 'fulfilled' && r.value.title)
    .map((r) => r.value);
}

/** IDs de produtos do catálogo pra uma palavra-chave (paginação por offset). */
async function searchProductIds(keyword, limit, offset = 0) {
  const data = await api(
    `/products/search?site_id=MLB&status=active&q=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`,
  );
  // Filtra defensivamente: aceita string ou objeto com .id (string).
  return (data.results || [])
    .map((r) => (typeof r === 'string' ? r : r?.id))
    .filter((x) => typeof x === 'string' && x.length > 0);
}

export async function search(keyword, limit = 30, page = 1) {
  // Busca mais ids do que o limite porque vamos descartar os sem título.
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
