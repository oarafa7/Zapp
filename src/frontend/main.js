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

// User-uploaded clips are loaded from the backend at startup and merged with the
// built-in catalog so they show up in search, discovery, and the send flow.
let uploadedClips = [];
let uploadMessage = null;
const getCatalog = () => clipCatalog.concat(uploadedClips);
const findClip = (id) => getCatalog().find((clip) => clip.id === id);

const root = document.getElementById('root');

const ATTRIBUTION = 'Sent via Zapp';

// One reusable audio element so tapping a new clip stops the previous preview.
const previewPlayer = typeof Audio !== 'undefined' ? new Audio() : null;

function playClip(clip) {
  if (!previewPlayer || !clip?.audioUrl) return;
  previewPlayer.pause();
  previewPlayer.src = clip.audioUrl;
  previewPlayer.currentTime = 0;
  previewPlayer.play().catch(() => {
    // Autoplay can be blocked until the first user gesture; tapping again works.
  });
}

// Frictionless "Search > Tap > Sent": fetch the real audio file and hand it to
// the OS share sheet so the user can drop it straight into WhatsApp. Where the
// Web Share API can't attach files (most desktop browsers) we fall back to a
// wa.me deep link carrying a playable URL plus the viral attribution.
async function sendToWhatsApp(clip) {
  const caption = `${clip.title} · ${ATTRIBUTION}`;
  try {
    const response = await fetch(clip.audioUrl);
    if (!response.ok) throw new Error(`audio ${response.status}`);
    const blob = await response.blob();
    const fileName = `${clip.id}.${(clip.audioUrl.split('.').pop() || 'wav')}`;
    const file = new File([blob], fileName, { type: blob.type || 'audio/wav' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: caption });
      return;
    }
    if (navigator.share) {
      await navigator.share({ text: caption, url: new URL(clip.audioUrl, location.href).href });
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return; // user dismissed the share sheet
  }
  const link = new URL(clip.audioUrl, location.href).href;
  window.open(`https://wa.me/?text=${encodeURIComponent(`${caption} ${link}`)}`, '_blank', 'noopener');
}

// MVP send path that works everywhere: save the clip as a file the user can
// then attach (or send as a voice note) inside WhatsApp.
function downloadClip(clip) {
  const fileName = `${clip.id}.${clip.audioUrl.split('.').pop() || 'wav'}`;
  const anchor = document.createElement('a');
  anchor.href = clip.audioUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

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
        <div><dt>Length</dt><dd>${formatDuration(selectedClip.durationMs)}</dd></div>
        <div><dt>Size</dt><dd>${formatSize(estimatedBytes)}</dd></div>
        <div><dt>Caption</dt><dd>${escapeHtml(selectedClip.attribution)}</dd></div>
      </dl>
      <div class="send-actions">
        <button class="send-actions__primary" data-action="download" data-clip-id="${selectedClip.id}">
          ⬇️ Download clip
        </button>
        <button class="send-actions__secondary" data-action="play" data-clip-id="${selectedClip.id}">
          ▶️ Play
        </button>
        <button class="send-actions__secondary" data-action="whatsapp" data-clip-id="${selectedClip.id}">
          💬 Share to WhatsApp
        </button>
      </div>
      <p class="send-actions__hint">Save the clip, then attach it (or send it as a voice note) in WhatsApp. “Share to WhatsApp” opens the share sheet directly on supported phones.</p>
    </section>
  `;
}

function renderUpload() {
  const statusClass = uploadMessage ? (uploadMessage.error ? 'is-error' : 'is-ok') : '';
  const statusText = uploadMessage ? escapeHtml(uploadMessage.text) : '';
  return `
    <section class="panel upload-panel" aria-labelledby="upload-title">
      <div class="section-heading"><p>Add a sound</p><h2 id="upload-title">Upload your own Audio GIF</h2></div>
      <form id="upload-form" class="upload-form">
        <label class="upload-field">
          <span>Audio file (mp3, wav, m4a, ogg · max 5MB)</span>
          <input id="upload-file" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.opus,.webm" required />
        </label>
        <label class="upload-field">
          <span>Title</span>
          <input id="upload-title-input" type="text" placeholder="e.g. Victory Horn" maxlength="60" required />
        </label>
        <label class="upload-field">
          <span>Trigger tags (comma separated)</span>
          <input id="upload-triggers" type="text" placeholder="win, hype, bonus" required />
        </label>
        <div class="upload-row">
          <label class="upload-field upload-field--small">
            <span>Locale</span>
            <select id="upload-locale">
              ${localeFilters.filter((f) => f.value !== 'all').map((f) => `<option value="${f.value}">${f.label}</option>`).join('')}
            </select>
          </label>
          <label class="upload-field upload-field--small">
            <span>Emoji</span>
            <input id="upload-icon" type="text" value="🔊" maxlength="4" />
          </label>
        </div>
        <label class="upload-field">
          <span>Admin token (only if the server requires one)</span>
          <input id="upload-token" type="password" placeholder="leave blank if not set" autocomplete="off" />
        </label>
        <button type="submit" class="upload-form__submit">⬆️ Upload clip</button>
        <p id="upload-status" class="upload-panel__status ${statusClass}" role="status">${statusText}</p>
      </form>
    </section>
  `;
}

function render() {
  const state = getFrontendState({ query: appState.query, locale: appState.locale, catalog: getCatalog() });
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
            <span><strong>${getCatalog().length}</strong> clips</span>
            <span><strong>${audioFormatPolicy.preview.maxDurationMs / 1000}s</strong> max preview</span>
            <span><strong>512KB</strong> send target</span>
          </div>
        </div>
        <div id="keyboard">${renderKeyboard({ ...state, selectedClip })}</div>
      </section>
      <section class="content-grid" id="design-system">
        ${renderDiscovery(state.rails)}
        ${renderReceipt(selectedClip)}
        ${renderUpload()}
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

  document.querySelectorAll('.clip-card[data-clip-id]').forEach((button) => {
    button.addEventListener('click', () => {
      appState.selectedClipId = button.dataset.clipId;
      const clip = findClip(appState.selectedClipId);
      if (clip) playClip(clip);
      render();
    });
  });

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const clip = findClip(button.dataset.clipId);
      if (!clip) return;
      if (button.dataset.action === 'download') downloadClip(clip);
      else if (button.dataset.action === 'play') playClip(clip);
      else if (button.dataset.action === 'whatsapp') sendToWhatsApp(clip);
    });
  });

  document.getElementById('upload-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    uploadClip(event.currentTarget);
  });
}

function setUploadStatus(text, error) {
  const node = document.getElementById('upload-status');
  if (!node) return;
  node.textContent = text;
  node.classList.toggle('is-error', Boolean(error));
  node.classList.toggle('is-ok', !error);
}

// Sends the raw audio bytes to the backend with metadata in the query string,
// which keeps the server free of any multipart-parsing dependency.
async function uploadClip(form) {
  const file = form.querySelector('#upload-file')?.files?.[0];
  const title = form.querySelector('#upload-title-input').value.trim();
  const triggers = form.querySelector('#upload-triggers').value.trim();
  const locale = form.querySelector('#upload-locale').value;
  const icon = form.querySelector('#upload-icon').value.trim();
  const token = form.querySelector('#upload-token').value.trim();

  if (!file) return setUploadStatus('Choose an audio file first.', true);
  if (!title) return setUploadStatus('Add a title.', true);
  if (!triggers) return setUploadStatus('Add at least one trigger tag.', true);

  setUploadStatus('Uploading…', false);
  const params = new URLSearchParams({ title, triggers, locale, icon, filename: file.name || '' });
  const headers = { 'content-type': file.type || 'application/octet-stream' };
  if (token) headers['x-zapp-admin'] = token;

  try {
    const response = await fetch(`/api/clips?${params.toString()}`, { method: 'POST', headers, body: file });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Upload failed (${response.status}).`);
    uploadedClips = uploadedClips.concat(data.clip);
    appState.query = '';
    appState.selectedClipId = data.clip.id;
    uploadMessage = { text: `“${data.clip.title}” is live in your catalog.`, error: false };
    render();
    playClip(data.clip);
  } catch (error) {
    setUploadStatus(error.message || 'Upload failed.', true);
  }
}

async function loadUploadedClips() {
  try {
    const response = await fetch('/api/clips');
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.clips) && data.clips.length) {
      uploadedClips = data.clips;
      render();
    }
  } catch {
    // Backend not reachable (e.g. opened as a static file); keep built-in clips.
  }
}

render();
loadUploadedClips();
