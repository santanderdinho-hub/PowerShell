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

import { getActiveProviders, providerStatus } from './providers/index.js';
import { linkify, isAllowedHost } from './providers/linkify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// App pessoal: aceita só o navegador local. Evita que qualquer site
// na internet dispare o backend (incl. /api/linkify, que faz fetch externo).
app.use(cors({ origin: ['http://localhost:' + PORT, 'http://127.0.0.1:' + PORT] }));
app.use(express.json());

// Servir apenas os arquivos do frontend, sem expor server.js / providers /
// scripts / package.json como estáticos.
const STATIC_FILES = ['index.html', 'app.js', 'style.css'];
for (const file of STATIC_FILES) {
  app.get('/' + file, (_req, res) => res.sendFile(join(__dirname, file)));
}
app.get('/', (_req, res) => res.sendFile(join(__dirname, 'index.html')));

/** Roda uma função de cada provider ATIVO (resolvido em tempo de request,
 *  pra reagir a credenciais novas sem reiniciar) em paralelo. */
async function gather(fnName, ...args) {
  const providers = getActiveProviders();
  const results = await Promise.allSettled(
    providers.map((p) => p[fnName]?.(...args) ?? []),
  );
  const products = [];
  const errors = {};
  results.forEach((r, i) => {
    const name = providers[i].id;
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
  try {
    const { products, errors } = await gather('getDeals', limit, page);
    products.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0));
    res.json({ ok: true, count: products.length, products, errors });
  } catch (err) {
    console.error('[deals]', err.message);
    res.json({ ok: true, count: 0, products: [], errors: { server: 'erro interno' } });
  }
});

/** Busca por palavra-chave em todos os marketplaces ativos. */
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 30, 60);
  const page = Math.max(1, Number(req.query.page) || 1);
  if (!q) return res.status(400).json({ ok: false, error: 'parâmetro q obrigatório' });
  try {
    const { products, errors } = await gather('search', q, limit, page);
    res.json({ ok: true, count: products.length, products, errors });
  } catch (err) {
    console.error('[search]', err.message);
    res.json({ ok: true, count: 0, products: [], errors: { server: 'erro interno' } });
  }
});

/** Gerador de post: URL de produto -> link de afiliado + mensagem pronta.
 *  Aceita só hosts de marketplace conhecidos (anti-SSRF). */
app.get('/api/linkify', async (req, res) => {
  const url = (req.query.url || '').trim();
  if (!/^https?:\/\//.test(url) || !isAllowedHost(url)) {
    return res
      .status(400)
      .json({ ok: false, error: 'URL inválida ou marketplace não suportado.' });
  }
  try {
    const data = await linkify(url);
    res.json({ ok: true, ...data });
  } catch (err) {
    console.error('[linkify]', err.message);
    res.status(502).json({ ok: false, error: 'falha ao processar a URL' });
  }
});

app.listen(PORT, () => {
  const active = getActiveProviders().map((p) => p.label).join(', ') || 'nenhum';
  console.log(`\n🔥 PromoHunt em http://localhost:${PORT}`);
  console.log(`   Marketplaces ativos: ${active}`);
  if (!getActiveProviders().length) {
    console.log('   ⚠️  Nenhuma credencial configurada. Copie .env.example -> .env e preencha.');
  }
  console.log('');
});
