/**
 * Provider Amazon — scaffold (desligado por padrão).
 *
 * Estado atual (mai/2026): a Product Advertising API 5.0 foi
 * descontinuada em 15/05/2026; o caminho novo é a Creators API, que
 * exige conta de Associados com vendas qualificadas (10 vendas nos
 * últimos 30 dias pra manter o acesso). Sem isso, não há acesso
 * confiável a ofertas via API — e scraping foi descartado de propósito.
 *
 * Por isso este provider fica DESLIGADO até você ter as chaves. Quando
 * tiver, implemente getDeals/search aqui usando SearchItems/GetItems e
 * normalize no mesmo formato dos outros providers. Links de afiliado na
 * Amazon funcionam só anexando ?tag=AMAZON_PARTNER_TAG na URL do produto.
 */

const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG?.trim();
const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY?.trim();
const SECRET_KEY = process.env.AMAZON_SECRET_KEY?.trim();

export const id = 'amazon';
export const label = 'Amazon';
// Só liga quando as chaves da API estiverem presentes E a integração
// estiver implementada. Por ora, mantido desligado de forma explícita.
export const enabled = false;
export const note = 'Aguardando chaves da Creators API (PA-API foi descontinuada em 15/05/2026).';

void PARTNER_TAG, ACCESS_KEY, SECRET_KEY;

export async function getDeals() {
  return [];
}

export async function search() {
  return [];
}
