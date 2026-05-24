/**
 * Provider Magalu — scaffold (desligado por padrão).
 *
 * O Magazine Luiza não oferece API pública de ofertas para afiliados.
 * O programa "Parceiro Magalu / Divulgador" gera links de afiliado pelo
 * painel, mas não há endpoint documentado de promoções. Scraping foi
 * descartado de propósito (instável / bloqueios).
 *
 * Mantido DESLIGADO. Se no futuro você entrar numa rede de afiliados que
 * exponha o catálogo Magalu (ex: Awin), implemente getDeals/search aqui.
 */

const AFFILIATE_ID = process.env.MAGALU_AFFILIATE_ID?.trim();

export const id = 'magalu';
export const label = 'Magalu';
export const enabled = false;
export const note = 'Magalu não tem API pública de ofertas; ativar exige rede de afiliados (ex: Awin).';

void AFFILIATE_ID;

export async function getDeals() {
  return [];
}

export async function search() {
  return [];
}
