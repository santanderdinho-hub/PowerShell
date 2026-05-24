/**
 * Provider Mercado Livre — API oficial.
 *
 * Doc: https://developers.mercadolivre.com.br
 * A busca usa o endpoint /sites/MLB/search, que hoje exige um access
 * token (OAuth2). Gere o token no painel de aplicações e coloque em
 * MELI_ACCESS_TOKEN no .env.
 *
 * Observação honesta: o ML não expõe um feed público de "ofertas do dia"
 * pela API. Por isso o ML entra principalmente na BUSCA. No feed
 * consolidado ele contribui com termos populares (ver DEFAULT_TERMS).
 */

const TOKEN = process.env.MELI_ACCESS_TOKEN?.trim();
const AFFILIATE_TAG = process.env.MELI_AFFILIATE_TAG?.trim();

export const id = 'mercadolivre';
export const label = 'Mercado Livre';
export const enabled = Boolean(TOKEN);

/** Termos usados pra povoar o feed consolidado (ML não tem deals API). */
const DEFAULT_TERMS = ['ofertas', 'smartphone', 'notebook'];

async function searchRaw(query, limit) {
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Mercado Livre HTTP ${res.status}: ${await res.text()}`);
  }
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
    // O ML gera link de afiliado na própria página; aqui devolvemos o
    // permalink (com a tag, se configurada) pra você gerar/copiar.
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
