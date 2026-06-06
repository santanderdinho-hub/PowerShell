/**
 * Registro central de providers de marketplace.
 * Cada provider expõe: id, label, isEnabled(), getDeals(...), search(...).
 * isEnabled é uma FUNÇÃO (avaliada a cada request) pra que o estado de
 * credencial reflita mudanças em runtime — ex: após `npm run meli-auth`.
 */

import * as shopee from './shopee.js';
import * as mercadolivre from './mercadolivre.js';

export const providers = [shopee, mercadolivre];

export function getActiveProviders() {
  return providers.filter((p) => p.isEnabled());
}

/** Metadados pro frontend saber o que está ligado agora. */
export function providerStatus() {
  return providers.map((p) => ({
    id: p.id,
    label: p.label,
    enabled: p.isEnabled(),
    note: p.note || null,
  }));
}
