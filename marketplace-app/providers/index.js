/**
 * Registro central de providers de marketplace.
 * Cada provider expõe: id, label, enabled, getDeals(limit), search(q, limit).
 */

import * as shopee from './shopee.js';
import * as mercadolivre from './mercadolivre.js';
import * as amazon from './amazon.js';
import * as magalu from './magalu.js';

export const providers = [shopee, mercadolivre, amazon, magalu];

export const activeProviders = providers.filter((p) => p.enabled);

/** Metadados pro frontend saber o que está ligado. */
export function providerStatus() {
  return providers.map((p) => ({
    id: p.id,
    label: p.label,
    enabled: p.enabled,
    note: p.note || null,
  }));
}
