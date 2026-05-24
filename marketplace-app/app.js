/* PromoHunt — frontend (sem framework, simples de propósito). */

const API = ''; // mesmo host do servidor

const state = {
  all: [],            // produtos carregados
  market: 'all',      // filtro de marketplace
  minDiscount: 0,     // filtro de desconto
  mode: 'deals',      // 'deals' | 'search'
};

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

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

async function copyAffiliate(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copiado! Cole no grupo 🎉');
  } catch {
    toast('Não consegui copiar — copie manualmente: ' + url);
  }
}

/* ── status dos marketplaces ─────────────────────────── */
async function loadProviders() {
  const res = await fetch(`${API}/api/providers`).then((r) => r.json());
  const chips = $('#marketChips');
  const statusBar = $('#statusBar');

  // chips de filtro: "Todos" + cada marketplace ativo
  chips.innerHTML = '';
  const allChip = chip('all', 'Todos', true);
  chips.appendChild(allChip);
  res.filter((p) => p.enabled).forEach((p) => chips.appendChild(chip(p.id, p.label, false)));

  // barra de status mostra o que está off e por quê
  const off = res.filter((p) => !p.enabled);
  statusBar.innerHTML = off.length
    ? `Ativos: ${res.filter((p) => p.enabled).map((p) => p.label).join(', ') || 'nenhum'}. ` +
      `Desligados: ${off.map((p) => `${p.label} (${p.note || 'sem credencial'})`).join(' · ')}`
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

/* ── carregamento de dados ───────────────────────────── */
async function loadDeals() {
  state.mode = 'deals';
  resultsCount.textContent = 'Carregando promoções…';
  const data = await fetch(`${API}/api/deals?limit=50`).then((r) => r.json());
  state.all = data.products || [];
  reportErrors(data.errors);
  render();
}

async function runSearch(q) {
  state.mode = 'search';
  resultsCount.textContent = `Buscando "${q}"…`;
  const data = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&limit=50`).then((r) =>
    r.json(),
  );
  state.all = data.products || [];
  reportErrors(data.errors);
  render();
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
  let items = state.all.filter((p) => {
    if (state.market !== 'all' && p.marketplace !== state.market) return false;
    if ((p.discountPct || 0) < state.minDiscount) return false;
    return true;
  });

  grid.innerHTML = '';
  empty.hidden = items.length > 0;
  if (!items.length) {
    $('#emptyHint').textContent =
      state.mode === 'deals'
        ? 'Verifique as credenciais no .env ou afrouxe o filtro de desconto.'
        : 'Tente outro termo ou afrouxe os filtros.';
    resultsCount.textContent = '';
    return;
  }

  resultsCount.textContent = `${items.length} ${state.mode === 'deals' ? 'promoções' : 'resultados'}`;
  items.forEach((p) => grid.appendChild(card(p)));
}

function card(p) {
  const el = document.createElement('article');
  el.className = 'card';

  const discount = p.discountPct
    ? `<span class="badge-discount">-${p.discountPct}%</span>`
    : '';
  const priceOld = p.priceOld ? `<span class="price-old">${brl(p.priceOld)}</span>` : '';
  const commission = p.commissionRate
    ? `<span class="commission" title="Comissão de afiliado">${p.commissionRate}</span>`
    : '';

  el.innerHTML = `
    <div class="card__img">
      ${discount}
      <img src="${p.image}" alt="" loading="lazy" onerror="this.style.opacity=.15" />
    </div>
    <div class="card__body">
      <span class="market market--${p.marketplace}">${MARKET_LABELS[p.marketplace] || p.marketplace}</span>
      <h3 class="card__title" title="${escapeAttr(p.title)}">${p.title}</h3>
      <div class="card__price">
        <strong>${brl(p.price)}</strong> ${priceOld} ${commission}
      </div>
      <div class="card__actions">
        <a class="btn btn--open" href="${p.productUrl}" target="_blank" rel="noopener">Abrir produto ↗</a>
        <button class="btn btn--copy">Copiar link afiliado</button>
      </div>
    </div>
  `;
  el.querySelector('.btn--copy').onclick = () =>
    copyAffiliate(p.affiliateUrl || p.productUrl);
  return el;
}

function escapeAttr(s = '') {
  return s.replace(/"/g, '&quot;');
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

/* ── boot ────────────────────────────────────────────── */
(async function init() {
  await loadProviders();
  await loadDeals();
})();
