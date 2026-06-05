import { clipCatalog } from '../data/clips.js';
import { audioFormatPolicy, estimateClipSizeBytes } from '../audio/formatPolicy.js';
import { formatDuration, formatSize, getFrontendState, quickTriggers } from './viewModel.js';
import { decodeAudioFile, trimToWavBlob } from './audioEditor.js';

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

// In-browser audio trimmer state for the upload flow. The decoded buffer lets us
// produce a trimmed WAV client-side; editor.file is the original chosen file.
const editor = {
  file: null,
  objectUrl: null,
  buffer: null,
  duration: 0,
  start: 0,
  end: 0,
  loading: false,
  error: ''
};

const formatSeconds = (value) => `${Math.max(0, value).toFixed(1)}s`;

function resetEditor() {
  if (editor.objectUrl) URL.revokeObjectURL(editor.objectUrl);
  editor.file = null;
  editor.objectUrl = null;
  editor.buffer = null;
  editor.duration = 0;
  editor.start = 0;
  editor.end = 0;
  editor.loading = false;
  editor.error = '';
}

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

function renderTrimControls() {
  if (editor.loading) return `<p class="trim-hint">Analyzing audio…</p>`;
  if (!editor.file) return '';
  if (!editor.buffer) {
    const prefix = editor.error ? `${escapeHtml(editor.error)} ` : '';
    return `<p class="trim-hint">${prefix}Trimming isn’t available for this file — it will upload as-is.</p>`;
  }
  const dur = editor.duration;
  return `
    <div class="trim-editor" aria-label="Trim audio before saving">
      <div class="trim-editor__row">
        <strong>Trim</strong>
        <span id="trim-readout">${formatSeconds(editor.start)} – ${formatSeconds(editor.end)} · ${formatSeconds(editor.end - editor.start)} clip</span>
      </div>
      <label class="trim-slider"><span class="sr-only">Start time</span>
        <input id="trim-start" type="range" min="0" max="${dur}" step="0.01" value="${editor.start}" />
      </label>
      <label class="trim-slider"><span class="sr-only">End time</span>
        <input id="trim-end" type="range" min="0" max="${dur}" step="0.01" value="${editor.end}" />
      </label>
      <div class="trim-actions">
        <button type="button" class="trim-btn" id="trim-preview">▶️ Preview selection</button>
        <button type="button" class="trim-btn" id="trim-reset">↺ Reset</button>
      </div>
    </div>
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
        ${renderTrimControls()}
        <div class="upload-or"><span>need a clip?</span></div>
        <a class="capture-link" href="https://ezrip.net/56jz" target="_blank" rel="noopener noreferrer">🎵 Capture audio here</a>
        <p class="trim-hint">Rip &amp; download an MP3 there, then choose it above to trim &amp; save.</p>
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

  document.getElementById('upload-file')?.addEventListener('change', (event) => {
    handleFileSelected(event.target);
  });

  document.getElementById('trim-start')?.addEventListener('input', (event) => {
    editor.start = Math.min(Number(event.target.value), editor.end - 0.05);
    if (editor.start < 0) editor.start = 0;
    event.target.value = editor.start;
    updateTrimReadout();
  });

  document.getElementById('trim-end')?.addEventListener('input', (event) => {
    editor.end = Math.max(Number(event.target.value), editor.start + 0.05);
    if (editor.end > editor.duration) editor.end = editor.duration;
    event.target.value = editor.end;
    updateTrimReadout();
  });

  document.getElementById('trim-preview')?.addEventListener('click', previewSelection);
  document.getElementById('trim-reset')?.addEventListener('click', () => {
    editor.start = 0;
    editor.end = editor.duration;
    const startEl = document.getElementById('trim-start');
    const endEl = document.getElementById('trim-end');
    if (startEl) startEl.value = 0;
    if (endEl) endEl.value = editor.duration;
    updateTrimReadout();
  });
}

function updateTrimReadout() {
  const node = document.getElementById('trim-readout');
  if (node) {
    node.textContent = `${formatSeconds(editor.start)} – ${formatSeconds(editor.end)} · ${formatSeconds(editor.end - editor.start)} clip`;
  }
}

// Plays only the selected [start, end) region of the loaded source file.
function previewSelection() {
  if (!previewPlayer || !editor.objectUrl) return;
  previewPlayer.pause();
  previewPlayer.src = editor.objectUrl;
  const stopAt = () => {
    if (previewPlayer.currentTime >= editor.end) {
      previewPlayer.pause();
      previewPlayer.removeEventListener('timeupdate', stopAt);
    }
  };
  previewPlayer.removeEventListener('timeupdate', stopAt);
  previewPlayer.addEventListener('timeupdate', stopAt);
  const begin = () => {
    previewPlayer.currentTime = editor.start;
    previewPlayer.play().catch(() => {});
    previewPlayer.removeEventListener('loadedmetadata', begin);
  };
  if (previewPlayer.readyState >= 1) begin();
  else previewPlayer.addEventListener('loadedmetadata', begin);
}

// Decodes a freshly chosen file so it can be trimmed; falls back gracefully if
// the browser can't decode the format (the original still uploads as-is).
async function handleFileSelected(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (editor.objectUrl) URL.revokeObjectURL(editor.objectUrl);
  editor.file = file;
  editor.objectUrl = URL.createObjectURL(file);
  editor.buffer = null;
  editor.error = '';
  editor.loading = true;
  render();
  try {
    const buffer = await decodeAudioFile(file);
    editor.buffer = buffer;
    editor.duration = buffer.duration;
    editor.start = 0;
    editor.end = buffer.duration;
  } catch {
    editor.error = 'Could not read this audio for trimming.';
  } finally {
    editor.loading = false;
    render();
  }
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
function onClipCreated(clip, verb) {
  uploadedClips = uploadedClips.concat(clip);
  appState.query = '';
  appState.selectedClipId = clip.id;
  uploadMessage = { text: `“${clip.title}” is ${verb} and live in your catalog.`, error: false };
  resetEditor();
  render();
  playClip(clip);
}

async function uploadClip(form) {
  const sourceFile = editor.file || form.querySelector('#upload-file')?.files?.[0];
  const title = form.querySelector('#upload-title-input').value.trim();
  const triggers = form.querySelector('#upload-triggers').value.trim();
  const locale = form.querySelector('#upload-locale').value;
  const icon = form.querySelector('#upload-icon').value.trim();
  const token = form.querySelector('#upload-token').value.trim();

  if (!sourceFile) return setUploadStatus('Choose an audio file first.', true);
  if (!title) return setUploadStatus('Add a title.', true);
  if (!triggers) return setUploadStatus('Add at least one trigger tag.', true);

  // If the user trimmed the clip, encode the selected region to WAV client-side.
  let body = sourceFile;
  let contentType = sourceFile.type || 'application/octet-stream';
  let filename = sourceFile.name || 'clip';
  const isTrimmed = editor.buffer && (editor.start > 0.01 || editor.end < editor.duration - 0.01);
  if (isTrimmed) {
    try {
      body = trimToWavBlob(editor.buffer, editor.start, editor.end);
      contentType = 'audio/wav';
      filename = `${(sourceFile.name || 'clip').replace(/\.[^.]+$/, '')}-trimmed.wav`;
    } catch {
      return setUploadStatus('Could not trim the audio. Try Reset and upload the full clip.', true);
    }
  }

  setUploadStatus('Uploading…', false);
  const params = new URLSearchParams({ title, triggers, locale, icon, filename });
  const headers = { 'content-type': contentType };
  if (token) headers['x-zapp-admin'] = token;

  try {
    const response = await fetch(`/api/clips?${params.toString()}`, { method: 'POST', headers, body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Upload failed (${response.status}).`);
    onClipCreated(data.clip, 'uploaded');
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
