/**
 * Linkify — transforma a URL de um produto em link de afiliado + post pronto.
 *
 * - isAllowedHost(url): só hosts de marketplace conhecidos (anti-SSRF).
 * - detectMarketplace(url): identifica qual deles.
 * - buildAffiliateUrl: Shopee via API; Amazon/ML/Magalu via tag se houver.
 * - fetchMeta: lê og:title/og:image/og:price com timeout e limite de bytes.
 */

import * as shopee from './shopee.js';

const AMAZON_PARTNER_TAG = process.env.AMAZON_PARTNER_TAG?.trim();
const MELI_AFFILIATE_TAG = process.env.MELI_AFFILIATE_TAG?.trim();
const MAGALU_AFFILIATE_ID = process.env.MAGALU_AFFILIATE_ID?.trim();

const META_TIMEOUT_MS = 8_000;
const META_MAX_BYTES = 256 * 1024; // 256 KB de HTML é mais que suficiente

const LABELS = {
  shopee: 'Shopee',
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
  magalu: 'Magalu',
};

/** Tabela única: host pattern + label + regra de afiliado. */
const RULES = [
  { id: 'shopee',       host: /(^|\.)shopee\./i,                                affiliate: { kind: 'api' } },
  { id: 'mercadolivre', host: /(^|\.)(mercadolivre|mercadolibre)\./i,           affiliate: { kind: 'param', key: 'matt_tool',  env: MELI_AFFILIATE_TAG } },
  { id: 'amazon',       host: /(^|\.)amazon\./i,                                affiliate: { kind: 'param', key: 'tag',        env: AMAZON_PARTNER_TAG } },
  { id: 'magalu',       host: /(^|\.)(magazineluiza|magalu)\./i,                affiliate: { kind: 'param', key: 'partner_id', env: MAGALU_AFFILIATE_ID } },
];

function safeHost(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function ruleFor(url) {
  const h = safeHost(url);
  return RULES.find((r) => r.host.test(h)) || null;
}

export function isAllowedHost(url) {
  return Boolean(ruleFor(url));
}

export function detectMarketplace(url) {
  return ruleFor(url)?.id || 'unknown';
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

async function buildAffiliateUrl(url) {
  const rule = ruleFor(url);
  if (!rule) return { affiliateUrl: url, ready: false, warning: 'Marketplace não reconhecido.' };

  if (rule.affiliate.kind === 'api' && rule.id === 'shopee') {
    if (!shopee.isEnabled()) {
      return { affiliateUrl: url, ready: false, warning: 'Shopee sem credencial — link sem afiliado.' };
    }
    try {
      const short = await shopee.generateShortLink(url);
      if (short) return { affiliateUrl: short, ready: true };
      return { affiliateUrl: url, ready: false, warning: 'Shopee respondeu sem link curto; verifique a URL do produto.' };
    } catch {
      // Não vaza body do upstream pro frontend.
      return { affiliateUrl: url, ready: false, warning: 'Falha ao gerar link curto na Shopee.' };
    }
  }

  if (rule.affiliate.kind === 'param') {
    if (rule.affiliate.env) {
      return { affiliateUrl: addParam(url, rule.affiliate.key, rule.affiliate.env), ready: true };
    }
    return {
      affiliateUrl: url,
      ready: false,
      warning: `Defina a tag de afiliado do ${LABELS[rule.id]} no .env.`,
    };
  }

  return { affiliateUrl: url, ready: false };
}

/** GET com AbortController (timeout) e leitura limitada (anti-OOM). */
async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), META_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return '';
    const reader = res.body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder();
    let html = '';
    let bytes = 0;
    while (bytes < META_MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += decoder.decode(value, { stream: true });
    }
    try { await reader.cancel(); } catch { /* ignore */ }
    return html;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMeta(url) {
  try {
    const html = await fetchHtml(url);
    if (!html) return {};
    return {
      title: decodeEntities(meta(html, 'og:title') || tag(html, 'title')),
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
  // Match meta tag with attributes in any order, both 'property' and 'name'.
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRe = /<meta\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const tagStr = m[0];
    const propRe = new RegExp(`(?:property|name)\\s*=\\s*["']${escaped}["']`, 'i');
    if (!propRe.test(tagStr)) continue;
    const contentMatch = tagStr.match(/content\s*=\s*["']([^"']+)["']/i);
    if (contentMatch) return contentMatch[1].trim();
  }
  return null;
}

function tag(html, name) {
  const m = html.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`, 'i'));
  return m?.[1]?.trim() || null;
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
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

/** Ponto de entrada. Devolve { marketplace, productUrl, affiliateUrl, ready,
 *  warning, title, image, price, message }. */
export async function linkify(url) {
  const marketplace = detectMarketplace(url);
  const [aff, metaInfo] = await Promise.all([
    buildAffiliateUrl(url),
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
  result.message = composeMessage(result);
  return result;
}
