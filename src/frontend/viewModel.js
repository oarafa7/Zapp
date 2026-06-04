import { clipCatalog } from '../data/clips.js';
import { groupByDiscoveryRail, searchAudioGifs } from '../search/searchEngine.js';
import { estimateClipSizeBytes } from '../audio/formatPolicy.js';

export const quickTriggers = ['brb', 'cringe', 'i got a bonus', 'تمام', 'fail', 'hype'];

export function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(durationMs % 1000 === 0 ? 0 : 1)}s`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function getFrontendState({ query = '', locale = 'all', season = 'ramadan' } = {}) {
  const localeOption = locale === 'all' ? undefined : locale;
  const results = searchAudioGifs(query, clipCatalog, { locale: localeOption, season, limit: 8 });
  const rails = groupByDiscoveryRail(clipCatalog);
  const selected = results[0] || clipCatalog[0];

  return {
    query,
    locale,
    season,
    results,
    rails,
    selected,
    sendPayload: {
      id: selected.id,
      mimeType: 'audio/ogg; codecs=opus',
      audioUrl: selected.audioUrl,
      previewUrl: selected.previewUrl,
      caption: selected.attribution,
      estimatedBytes: estimateClipSizeBytes(selected.durationMs)
    }
  };
}
