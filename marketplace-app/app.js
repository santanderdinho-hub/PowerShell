/* PromoHunt — frontend (sem framework, simples de propósito). */

const API = ''; // mesmo host do servidor

const PAGE_SIZE = 30;
const state = {
  all: [],            // produtos carregados (acumula com "carregar mais")
  market: 'all',      // filtro de marketplace
  minDiscount: 0,     // filtro de desconto
  query: null,        // termo de busca atual (null = modo promoções)
  page: 1,            // página já carregada
  busy: false,        // carregando mais?
  exhausted: false,   // acabou (última página não trouxe nada novo)?
};
const isSearch = () => state.query != null;

const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const resultsCount = $('#resultsCount');
const empty = $('#empty');

const MARKET_LABELS = {
  shopee: 'Shopee',
  mercadolivre: 'Mercado Livre',
};

/* ── helpers ─────────────────────────────────────────── */
const brl = (v) =>
  v == null ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Escape HTML pra interpolar dados de upstream em innerHTML com segurança. */
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Aceita apenas URLs http(s); evita javascript: e data: em href/src. */
function safeUrl(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? esc(s) : '#';
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiado! Cole no grupo 🎉');
  } catch {
    toast('Não consegui copiar — copie manualmente.');
  }
}

/** fetch que sempre devolve JSON (resiliente a HTML 500). */
async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: `resposta inválida (${res.status})` }; }
}

/* ── status dos marketplaces ─────────────────────────── */
async function loadProviders() {
  let res;
  try { res = await fetchJson(`${API}/api/providers`); } catch { res = []; }
  if (!Array.isArray(res)) res = [];

  const chips = $('#marketChips');
  const statusBar = $('#statusBar');

  chips.innerHTML = '';
  chips.appendChild(chip('all', 'Todos', true));
  res.filter((p) => p.enabled).forEach((p) => chips.appendChild(chip(p.id, p.label, false)));

  const off = res.filter((p) => !p.enabled);
  const ativos = res.filter((p) => p.enabled).map((p) => p.label).join(', ') || 'nenhum';
  statusBar.textContent = off.length
    ? `Ativos: ${ativos}. Desligados: ${off.map((p) => `${p.label} (${p.note || 'sem credencial'})`).join(' · ')}`
    : `Todos os marketplaces ativos: ${res.map((p) => p.label).join(', ')}`;
}

function chip(id, label, active) {
  const b = document.createElement('button');
  b.className = 'chip' + (active ? ' active' : '');
  b.textContent = label;
  b.dataset.market = id;
  b.onclick = () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    b.classList.add('active');
    state.market = id;
    render();
  };
  return b;
}

/* ── carregamento de dados (com paginação) ───────────── */
function pageUrl(page) {
  return isSearch()
    ? `${API}/api/search?q=${encodeURIComponent(state.query)}&limit=${PAGE_SIZE}&page=${page}`
    : `${API}/api/deals?limit=${PAGE_SIZE}&page=${page}`;
}

async function loadDeals() {
  state.query = null;
  await loadFirstPage('Carregando promoções…');
}

async function runSearch(q) {
  state.query = q;
  await loadFirstPage(`Buscando "${q}"…`);
}

async function loadFirstPage(msg) {
  state.all = [];
  state.page = 1;
  state.exhausted = false;
  resultsCount.textContent = msg;
  let data;
  try { data = await fetchJson(pageUrl(1)); } catch { data = { products: [] }; }
  state.all = data.products || [];
  state.exhausted = (data.products || []).length === 0;
  reportErrors(data.errors);
  render();
}

async function loadMore() {
  if (state.busy || state.exhausted) return;
  state.busy = true;
  const btn = $('#loadMoreBtn');
  if (btn) btn.textContent = 'Carregando…';
  try {
    const data = await fetchJson(pageUrl(state.page + 1));
    const novos = (data.products || []).filter((p) => !state.all.some((x) => x.id === p.id));
    state.page += 1;
    state.all.push(...novos);
    if (novos.length === 0) state.exhausted = true;
    reportErrors(data.errors);
    render();
  } catch {
    toast('Falha ao carregar mais.');
  } finally {
    state.busy = false;
    if (btn) btn.textContent = 'Carregar mais';
  }
}

function reportErrors(errors) {
  if (errors && Object.keys(errors).length) {
    const names = Object.keys(errors).map((k) => MARKET_LABELS[k] || k).join(', ');
    toast(`Aviso: falha em ${names}`);
    console.warn('Erros dos providers:', errors);
  }
}

/* ── render ──────────────────────────────────────────── */
function render() {
  let items = state.all
    .filter((p) => {
      if (state.market !== 'all' && p.marketplace !== state.market) return false;
      if ((p.discountPct || 0) < state.minDiscount) return false;
      return true;
    })
    .sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0));

  const loadMoreWrap = $('#loadMore');
  grid.innerHTML = '';
  empty.hidden = items.length > 0;
  loadMoreWrap.hidden = state.exhausted;

  if (!items.length) {
    $('#emptyHint').textContent = isSearch()
      ? 'Tente outro termo ou afrouxe os filtros.'
      : 'Verifique as credenciais no .env ou afrouxe o filtro de desconto.';
    resultsCount.textContent = '';
    return;
  }

  resultsCount.textContent = `${items.length} ${isSearch() ? 'resultados' : 'promoções'}`;
  const frag = document.createDocumentFragment();
  items.forEach((p) => frag.appendChild(card(p)));
  grid.appendChild(frag);
}

function card(p) {
  const el = document.createElement('article');
  el.className = 'card';
  const mkClass = /^[a-z0-9_-]+$/i.test(p.marketplace) ? p.marketplace : 'unknown';

  const discount = p.discountPct
    ? `<span class="badge-discount">-${esc(p.discountPct)}%</span>`
    : '';
  const priceOld = p.priceOld
    ? `<span class="price-old">${esc(brl(p.priceOld))}</span>`
    : '';
  const commission = p.commissionRate
    ? `<span class="commission" title="Comissão de afiliado">${esc(p.commissionRate)}</span>`
    : '';
  const priceBlock = p.price
    ? `<strong>${esc(brl(p.price))}</strong>`
    : '<span class="price-na">ver preço no site</span>';

  el.innerHTML = `
    <div class="card__img">
      ${discount}
      <img src="${safeUrl(p.image)}" alt="" loading="lazy" onerror="this.style.opacity=.15" />
    </div>
    <div class="card__body">
      <span class="market market--${mkClass}">${esc(MARKET_LABELS[p.marketplace] || p.marketplace)}</span>
      <h3 class="card__title" title="${esc(p.title)}">${esc(p.title)}</h3>
      <div class="card__price">
        ${priceBlock} ${priceOld} ${commission}
      </div>
      <div class="card__actions">
        <a class="btn btn--open" href="${safeUrl(p.productUrl)}" target="_blank" rel="noopener">Abrir produto ↗</a>
        <button class="btn btn--copy">Copiar link afiliado</button>
      </div>
    </div>
  `;
  el.querySelector('.btn--copy').onclick = () =>
    copyToClipboard(p.affiliateUrl || p.productUrl);
  return el;
}

/* ── eventos ─────────────────────────────────────────── */
$('#searchBtn').onclick = () => {
  const q = $('#searchInput').value.trim();
  if (q) runSearch(q);
};
$('#searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#searchBtn').click();
});
$('#dealsBtn').onclick = () => {
  $('#searchInput').value = '';
  loadDeals();
};
$('#minDiscount').onchange = (e) => {
  state.minDiscount = Number(e.target.value);
  render();
};
$('#loadMoreBtn').onclick = loadMore;

/* ── abas (Descobrir / Gerar post) ───────────────────── */
document.querySelectorAll('.tab').forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const view = tab.dataset.view;
    $('#view-discover').hidden = view !== 'discover';
    $('#view-generate').hidden = view !== 'generate';
  };
});

/* ── gerador de post ─────────────────────────────────── */
async function generatePost(url) {
  const box = $('#genResult');
  box.hidden = false;
  box.innerHTML = '<p class="gen-loading">Gerando…</p>';

  let data;
  try { data = await fetchJson(`${API}/api/linkify?url=${encodeURIComponent(url)}`); }
  catch { box.innerHTML = '<p class="gen-error">Falha de rede.</p>'; return; }

  if (!data.ok) {
    box.innerHTML = `<p class="gen-error">${esc(data.error || 'erro')}</p>`;
    return;
  }

  const mk = data.marketplace;
  const mkClass = /^[a-z0-9_-]+$/i.test(mk) ? mk : 'unknown';
  const label = MARKET_LABELS[mk] || mk;
  const warn = data.warning ? `<p class="gen-warn">⚠️ ${esc(data.warning)}</p>` : '';
  const img = data.image
    ? `<img class="gen-img" src="${safeUrl(data.image)}" alt="" onerror="this.remove()" />`
    : '';

  box.innerHTML = `
    <div class="gen-card">
      ${img}
      <div class="gen-meta">
        <span class="market market--${mkClass}">${esc(label)}</span>
        <h3>${esc(data.title || '(sem título)')}</h3>
        ${data.price ? `<strong class="gen-price">R$ ${esc(data.price)}</strong>` : ''}
        ${warn}
      </div>
    </div>
    <label class="gen-label">Link de afiliado ${data.ready ? '✅' : ''}</label>
    <div class="gen-row">
      <input class="gen-out" id="genLink" readonly value="${esc(data.affiliateUrl)}" />
      <button class="btn btn--copy" id="copyLink">Copiar</button>
    </div>
    <label class="gen-label">Mensagem pro grupo</label>
    <div class="gen-row">
      <textarea class="gen-out gen-msg" id="genMsg" readonly rows="6">${esc(data.message)}</textarea>
      <button class="btn btn--copy" id="copyMsg">Copiar</button>
    </div>
  `;
  $('#copyLink').onclick = () => copyToClipboard(data.affiliateUrl);
  $('#copyMsg').onclick = () => copyToClipboard(data.message);
}

$('#genBtn').onclick = () => {
  const url = $('#urlInput').value.trim();
  if (url) generatePost(url);
};
$('#urlInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#genBtn').click();
});

/* ── boot ────────────────────────────────────────────── */
(async function init() {
  await loadProviders();
  await loadDeals();
})();
