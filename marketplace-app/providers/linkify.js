/**
 * Linkify — transforma a URL de um produto em link de afiliado + post pronto.
 *
 * - Detecta o marketplace pela URL.
 * - Gera o link de afiliado:
 *     Shopee  -> link curto oficial via API de afiliado.
 *     Amazon  -> anexa ?tag=AMAZON_PARTNER_TAG (atribuição oficial de afiliado).
 *     ML      -> anexa sua tag (matt_tool) se houver; senão devolve a URL.
 *     Magalu  -> anexa seu id de divulgador se houver; senão devolve a URL.
 * - Busca título/preço/imagem lendo as meta tags Open Graph da página
 *   (1 fetch sob demanda — é o mesmo que o Telegram/WhatsApp fazem ao
 *   "desdobrar" um link; nada de scraping em massa).
 */

import * as shopee from './shopee.js';

const AMAZON_PARTNER_TAG = process.env.AMAZON_PARTNER_TAG?.trim();
const MELI_AFFILIATE_TAG = process.env.MELI_AFFILIATE_TAG?.trim();
const MAGALU_AFFILIATE_ID = process.env.MAGALU_AFFILIATE_ID?.trim();

const LABELS = {
  shopee: 'Shopee',
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
  magalu: 'Magalu',
};

export function detectMarketplace(url) {
  const h = safeHost(url);
  if (/shopee\./.test(h)) return 'shopee';
  if (/mercadolivre\.|mercadolibre\./.test(h)) return 'mercadolivre';
  if (/amazon\./.test(h)) return 'amazon';
  if (/magazineluiza\.|magalu\./.test(h)) return 'magalu';
  return 'unknown';
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function addParam(url, key, value) {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    return url;
  }
}

async function buildAffiliateUrl(url, marketplace) {
  switch (marketplace) {
    case 'shopee':
      if (shopee.enabled) {
        try {
          const short = await shopee.generateShortLink(url);
          if (short) return { affiliateUrl: short, ready: true };
        } catch (e) {
          return { affiliateUrl: url, ready: false, warning: `Shopee: ${e.message}` };
        }
      }
      return { affiliateUrl: url, ready: false, warning: 'Shopee sem credencial — link sem afiliado.' };

    case 'amazon':
      if (AMAZON_PARTNER_TAG) return { affiliateUrl: addParam(url, 'tag', AMAZON_PARTNER_TAG), ready: true };
      return { affiliateUrl: url, ready: false, warning: 'Defina AMAZON_PARTNER_TAG no .env.' };

    case 'mercadolivre':
      if (MELI_AFFILIATE_TAG) return { affiliateUrl: addParam(url, 'matt_tool', MELI_AFFILIATE_TAG), ready: true };
      return { affiliateUrl: url, ready: false, warning: 'ML gera o link no painel de afiliados; cole a URL lá.' };

    case 'magalu':
      if (MAGALU_AFFILIATE_ID) return { affiliateUrl: addParam(url, 'partner_id', MAGALU_AFFILIATE_ID), ready: true };
      return { affiliateUrl: url, ready: false, warning: 'Defina MAGALU_AFFILIATE_ID no .env.' };

    default:
      return { affiliateUrl: url, ready: false, warning: 'Marketplace não reconhecido.' };
  }
}

/** Lê meta tags Open Graph da página do produto. */
async function fetchMeta(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return {};
    const html = await res.text();
    return {
      title: meta(html, 'og:title') || tag(html, 'title'),
      image: meta(html, 'og:image'),
      price:
        meta(html, 'product:price:amount') ||
        meta(html, 'og:price:amount') ||
        null,
    };
  } catch {
    return {};
  }
}

function meta(html, prop) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const m = html.match(re) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'),
  );
  return m?.[1]?.trim() || null;
}

function tag(html, name) {
  const m = html.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`, 'i'));
  return m?.[1]?.trim() || null;
}

function composeMessage({ title, price, marketplace, affiliateUrl }) {
  const lines = ['🔥 ' + (title || 'Oferta')];
  lines.push('');
  if (price) lines.push(`💰 R$ ${price}`);
  lines.push(`🛒 ${LABELS[marketplace] || marketplace}`);
  lines.push('');
  lines.push(`👉 ${affiliateUrl}`);
  return lines.join('\n');
}

/** Ponto de entrada: URL -> { marketplace, affiliateUrl, title, image, price, message, ready, warning }. */
export async function linkify(url) {
  const marketplace = detectMarketplace(url);
  const [aff, metaInfo] = await Promise.all([
    buildAffiliateUrl(url, marketplace),
    fetchMeta(url),
  ]);

  const result = {
    marketplace,
    productUrl: url,
    affiliateUrl: aff.affiliateUrl,
    ready: aff.ready,
    warning: aff.warning || null,
    title: metaInfo.title || null,
    image: metaInfo.image || null,
    price: metaInfo.price || null,
  };
  result.message = composeMessage({ ...result, marketplace });
  return result;
}
