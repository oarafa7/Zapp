import { clipCatalog } from '../data/clips.js';
import { audioFormatPolicy, estimateClipSizeBytes } from '../audio/formatPolicy.js';
import { formatDuration, formatSize, getFrontendState, quickTriggers } from './viewModel.js';

const localeFilters = [
  { label: 'All', value: 'all' },
  { label: 'Arabic', value: 'ar' },
  { label: 'Egypt', value: 'ar-EG' },
  { label: 'English', value: 'en' }
];

const appState = {
  query: '',
  locale: 'all',
  selectedClipId: null
};

const root = document.getElementById('root');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clipCard(clip, selected) {
  return `
    <button class="clip-card ${selected ? 'clip-card--selected' : ''}" data-clip-id="${clip.id}">
      <span class="clip-card__icon" aria-hidden="true">${clip.icon}</span>
      <span class="clip-card__body">
        <span class="clip-card__title">${escapeHtml(clip.title)}</span>
        <span class="clip-card__meta">${escapeHtml(clip.source)} · ${formatDuration(clip.durationMs)}</span>
        <span class="clip-card__tags">${escapeHtml(clip.triggerTags.slice(0, 3).join(' · '))}</span>
      </span>
      <span class="clip-card__send">Tap</span>
    </button>
  `;
}

function renderKeyboard({ query, locale, results, selectedClip }) {
  return `
    <section class="phone-shell" aria-label="Zapp keyboard extension preview">
      <div class="chat-window">
        <div class="chat-bubble chat-bubble--incoming">Dinner in 10?</div>
        <div class="chat-bubble chat-bubble--outgoing">
          ${selectedClip.icon} ${escapeHtml(selectedClip.title)}
          <small>${escapeHtml(selectedClip.attribution)}</small>
        </div>
      </div>
      <div class="keyboard-panel">
        <div class="keyboard-panel__handle"></div>
        <div class="keyboard-panel__topline"><strong>Zapp</strong><span>Audio GIF Keyboard</span></div>
        <label class="search-box">
          <span class="sr-only">Search Audio GIFs</span>
          <input id="search-input" value="${escapeHtml(query)}" placeholder="Search: brb, cringe, bonus…" />
        </label>
        <div class="filter-row" aria-label="Locale filters">
          ${localeFilters.map((filter) => `
            <button class="${locale === filter.value ? 'pill pill--active' : 'pill'}" data-locale="${filter.value}">
              ${filter.label}
            </button>
          `).join('')}
        </div>
        <div class="quick-row" aria-label="Quick trigger searches">
          ${quickTriggers.map((trigger) => `<button class="quick-chip" data-trigger="${escapeHtml(trigger)}">${escapeHtml(trigger)}</button>`).join('')}
        </div>
        <div class="clip-list">
          ${results.map((clip) => clipCard(clip, clip.id === selectedClip.id)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderDiscovery(rails) {
  const triggerRails = Object.entries(rails.triggers).slice(0, 4);
  const sourceRails = Object.entries(rails.sources).slice(0, 4);
  return `
    <section class="panel discovery-panel" aria-labelledby="discovery-title">
      <div class="section-heading"><p>Discovery</p><h2 id="discovery-title">Browse by feeling or archive</h2></div>
      <div class="rail-grid">
        ${triggerRails.map(([trigger, clips]) => `
          <article class="rail-card"><span>Trigger</span><strong>${escapeHtml(trigger)}</strong><small>${clips.map((clip) => clip.icon).join(' ')}</small></article>
        `).join('')}
        ${sourceRails.map(([source, clips]) => `
          <article class="rail-card rail-card--source"><span>Source</span><strong>${escapeHtml(source)}</strong><small>${clips.length} ready clip${clips.length === 1 ? '' : 's'}</small></article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderReceipt(selectedClip) {
  const estimatedBytes = estimateClipSizeBytes(selectedClip.durationMs);
  return `
    <section class="panel receipt-panel" aria-labelledby="receipt-title">
      <div class="section-heading"><p>One-tap payload</p><h2 id="receipt-title">Prepared for WhatsApp, iMessage, and Slack</h2></div>
      <div class="receipt-card">
        <div class="receipt-card__art">${selectedClip.icon}</div>
        <div><strong>${escapeHtml(selectedClip.title)}</strong><span>${escapeHtml(selectedClip.attribution)}</span></div>
      </div>
      <dl class="payload-list">
        <div><dt>MIME</dt><dd>audio/ogg; codecs=opus</dd></div>
        <div><dt>Size</dt><dd>${formatSize(estimatedBytes)}</dd></div>
        <div><dt>Preview</dt><dd>${audioFormatPolicy.preview.codec} · preload top results</dd></div>
      </dl>
    </section>
  `;
}

function render() {
  const state = getFrontendState({ query: appState.query, locale: appState.locale });
  const selectedClip = state.results.find((clip) => clip.id === appState.selectedClipId) || state.selected;
  appState.selectedClipId = selectedClip.id;

  root.innerHTML = `
    <main class="zapp-page">
      <section class="hero-grid">
        <div class="hero-copy">
          <div class="brand-mark" aria-label="Zapp brand mark">Z</div>
          <p class="eyebrow">System-wide Audio GIF keyboard</p>
          <h1>Send the sound already playing in your head.</h1>
          <p class="hero-copy__lede">Zapp turns iconic movie, TV, and viral lines into instant cultural reactions — designed for the tiny gap between a feeling and a message.</p>
          <div class="hero-actions">
            <a class="primary-action" href="#keyboard">Try the keyboard</a>
            <a class="secondary-action" href="#design-system">Design system</a>
          </div>
          <div class="metric-strip" aria-label="Product constraints">
            <span><strong>${clipCatalog.length}</strong> seed clips</span>
            <span><strong>${audioFormatPolicy.preview.maxDurationMs / 1000}s</strong> max preview</span>
            <span><strong>512KB</strong> send target</span>
          </div>
        </div>
        <div id="keyboard">${renderKeyboard({ ...state, selectedClip })}</div>
      </section>
      <section class="content-grid" id="design-system">
        ${renderDiscovery(state.rails)}
        ${renderReceipt(selectedClip)}
      </section>
    </main>
  `;

  bindEvents();
}

function bindEvents() {
  document.getElementById('search-input')?.addEventListener('input', (event) => {
    appState.query = event.target.value;
    appState.selectedClipId = null;
    render();
    document.getElementById('search-input')?.focus();
  });

  document.querySelectorAll('[data-locale]').forEach((button) => {
    button.addEventListener('click', () => {
      appState.locale = button.dataset.locale;
      appState.selectedClipId = null;
      render();
    });
  });

  document.querySelectorAll('[data-trigger]').forEach((button) => {
    button.addEventListener('click', () => {
      appState.query = button.dataset.trigger;
      appState.selectedClipId = null;
      render();
    });
  });

  document.querySelectorAll('[data-clip-id]').forEach((button) => {
    button.addEventListener('click', () => {
      appState.selectedClipId = button.dataset.clipId;
      render();
    });
  });
}

render();
