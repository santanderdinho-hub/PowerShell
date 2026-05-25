/**
 * Provider Shopee — API oficial de Afiliados (GraphQL).
 *
 * Doc: https://open-api.affiliate.shopee.com.br
 * Autenticação: header
 *   Authorization: SHA256 Credential=<appId>, Timestamp=<ts>, Signature=<sig>
 * onde sig = sha256(appId + timestamp + payload + secret).
 *
 * Esta é a fonte mais confiável do painel: a query productOfferV2 já
 * devolve a promoção (nome, preço, % de desconto) e o offerLink, que é
 * o link de afiliado pronto pra mandar no grupo.
 */

import crypto from 'crypto';

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

const APP_ID = process.env.SHOPEE_APP_ID?.trim();
const SECRET = process.env.SHOPEE_SECRET?.trim();

export const id = 'shopee';
export const label = 'Shopee';
export const enabled = Boolean(APP_ID && SECRET);

/** Assina e dispara uma operação GraphQL contra a API de afiliados. */
async function callGraphQL(query, variables = {}) {
  const payload = JSON.stringify({ query, variables });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash('sha256')
    .update(APP_ID + timestamp + payload + SECRET)
    .digest('hex');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });

  if (!res.ok) {
    throw new Error(`Shopee HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Shopee GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  return json.data;
}

const PRODUCT_FIELDS = `
  nodes {
    itemId
    shopId
    productName
    imageUrl
    priceMin
    priceMax
    priceDiscountRate
    commissionRate
    sales
    ratingStar
    offerLink
    productLink
    shopName
  }
  pageInfo { page limit hasNextPage }
`;

/** Converte um nó da Shopee no formato normalizado do painel. */
function normalize(node) {
  const price = Number(node.priceMin) || 0;
  const discount = Math.round(Number(node.priceDiscountRate) || 0);
  const priceOld =
    discount > 0 && discount < 100 ? +(price / (1 - discount / 100)).toFixed(2) : null;

  return {
    id: `sp_${node.itemId}`,
    marketplace: 'shopee',
    title: node.productName || '',
    image: node.imageUrl || '',
    price,
    priceOld,
    discountPct: discount,
    rating: Number(node.ratingStar) || null,
    sales: Number(node.sales) || 0,
    commissionRate: node.commissionRate ? `${(Number(node.commissionRate) * 100).toFixed(1)}%` : null,
    productUrl: node.productLink || '',
    // offerLink já é o link de afiliado pronto.
    affiliateUrl: node.offerLink || node.productLink || '',
  };
}

/**
 * Catálogo de promoções da Shopee.
 * Busca um lote maior de ofertas e prioriza os itens com maior desconto.
 * sortType=2 = produtos quentes (mais vendidos); listType=0 = todos.
 */
export async function getDeals(limit = 30) {
  const fetchLimit = Math.min(Math.max(limit, 50), 100);
  const query = `query Deals($limit: Int!) {
    productOfferV2(sortType: 2, listType: 0, page: 1, limit: $limit) {
      ${PRODUCT_FIELDS}
    }
  }`;
  const data = await callGraphQL(query, { limit: fetchLimit });
  const all = (data?.productOfferV2?.nodes || []).map(normalize);

  // Catálogo de promoção: mostra primeiro o que tem desconto, do maior pro menor.
  // Se vierem poucos itens com desconto, completa com os demais pra não esvaziar.
  const discounted = all
    .filter((p) => p.discountPct > 0)
    .sort((a, b) => b.discountPct - a.discountPct);
  const result = discounted.length >= 5 ? discounted : all;
  return result.slice(0, limit);
}

/** Busca por palavra-chave (mesma query, com keyword). */
export async function search(keyword, limit = 30) {
  const query = `query Search($kw: String!, $limit: Int!) {
    productOfferV2(keyword: $kw, sortType: 2, page: 1, limit: $limit) {
      ${PRODUCT_FIELDS}
    }
  }`;
  const data = await callGraphQL(query, { kw: keyword, limit });
  return (data?.productOfferV2?.nodes || []).map(normalize);
}

/** Converte uma URL de produto da Shopee num link curto de afiliado. */
export async function generateShortLink(originUrl) {
  const query = `mutation Link($url: String!) {
    generateShortLink(input: { originUrl: $url, subIds: ["promohunt"] }) {
      shortLink
    }
  }`;
  const data = await callGraphQL(query, { url: originUrl });
  return data?.generateShortLink?.shortLink || null;
}
