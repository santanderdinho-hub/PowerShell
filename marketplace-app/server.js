/**
 * PromoHunt — servidor.
 *
 * Painel pessoal de promoções consolidadas via APIs OFICIAIS de afiliado.
 * Sem scraping: cada marketplace usa sua API e só liga se houver credencial.
 *
 *   npm install
 *   cp .env.example .env   # preencha suas chaves
 *   npm start              # abre em http://localhost:3001
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { activeProviders, providerStatus } from './providers/index.js';
import { linkify } from './providers/linkify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(__dirname));

/** Roda uma função de cada provider ativo em paralelo, sem deixar um
 *  erro derrubar os outros. Retorna { products, errors }. */
async function gather(fnName, ...args) {
  const results = await Promise.allSettled(
    activeProviders.map((p) => p[fnName](...args)),
  );
  const products = [];
  const errors = {};
  results.forEach((r, i) => {
    const name = activeProviders[i].id;
    if (r.status === 'fulfilled') products.push(...(r.value || []));
    else {
      errors[name] = r.reason?.message || 'erro desconhecido';
      console.warn(`[${name}] ${errors[name]}`);
    }
  });
  return { products, errors };
}

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

/** Status dos marketplaces (quais estão ligados) — pro frontend. */
app.get('/api/providers', (_req, res) => res.json(providerStatus()));

/** Feed consolidado de promoções (a página principal). */
app.get('/api/deals', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 60);
  const page = Math.max(1, Number(req.query.page) || 1);
  const { products, errors } = await gather('getDeals', limit, page);
  products.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0));
  res.json({ ok: true, count: products.length, products, errors });
});

/** Busca por palavra-chave em todos os marketplaces ativos. */
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 30, 60);
  const page = Math.max(1, Number(req.query.page) || 1);
  if (!q) return res.status(400).json({ ok: false, error: 'parâmetro q obrigatório' });
  const { products, errors } = await gather('search', q, limit, page);
  products.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0));
  res.json({ ok: true, count: products.length, products, errors });
});

/** Gerador de post: URL de produto -> link de afiliado + mensagem pronta. */
app.get('/api/linkify', async (req, res) => {
  const url = (req.query.url || '').trim();
  if (!/^https?:\/\//.test(url)) {
    return res.status(400).json({ ok: false, error: 'informe uma URL válida (http/https)' });
  }
  try {
    const data = await linkify(url);
    res.json({ ok: true, ...data });
  } catch (err) {
    console.error('[linkify]', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  const active = activeProviders.map((p) => p.label).join(', ') || 'nenhum';
  console.log(`\n🔥 PromoHunt em http://localhost:${PORT}`);
  console.log(`   Marketplaces ativos: ${active}`);
  if (!activeProviders.length) {
    console.log('   ⚠️  Nenhuma credencial configurada. Copie .env.example -> .env e preencha.');
  }
  console.log('');
});
