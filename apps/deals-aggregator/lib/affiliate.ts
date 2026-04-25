import type { AffiliateConfig, Deal } from '@/types/deal';

/**
 * Builds the final URL injecting the affiliate tag/ID for the given store.
 * If no config is set for the store, returns the original URL.
 *
 * NOTE: each program has its own format. Where a query-param tag works,
 * we append it. For programs that require pre-generated short links
 * (Shopee, AliExpress portals, etc.), the admin should paste the already
 * affiliated URL directly into the deal — the original URL is returned as-is.
 */
export function buildAffiliateUrl(deal: Deal, config: AffiliateConfig): string {
  try {
    const url = new URL(deal.url);

    switch (deal.store) {
      case 'amazon': {
        if (config.amazonTag) {
          url.searchParams.set('tag', config.amazonTag);
        }
        return url.toString();
      }
      case 'mercadolivre': {
        if (config.mercadolivreId) {
          url.searchParams.set('matt_tool', config.mercadolivreId);
          url.searchParams.set('matt_word', config.mercadolivreId);
        }
        return url.toString();
      }
      case 'magalu': {
        if (config.magaluId) {
          url.searchParams.set('partner_id', config.magaluId);
          url.searchParams.set('utm_source', config.magaluId);
        }
        return url.toString();
      }
      case 'americanas': {
        if (config.americanasId) {
          url.searchParams.set('opn', config.americanasId);
        }
        return url.toString();
      }
      case 'shopee':
      case 'aliexpress':
      case 'outros':
      default:
        return deal.url;
    }
  } catch {
    return deal.url;
  }
}
