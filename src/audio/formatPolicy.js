export const audioFormatPolicy = {
  preview: {
    codec: 'AAC-LC',
    container: 'm4a',
    targetBitrateKbps: 64,
    maxDurationMs: 7000,
    preloadStrategy: 'first-screen-and-top-search-results'
  },
  sendable: {
    codec: 'Opus',
    container: 'ogg',
    targetBitrateKbps: 48,
    maxBytes: 512 * 1024,
    loudnessTargetLufs: -16
  },
  cache: {
    maxItems: 80,
    eviction: 'least-recently-played-after-popularity',
    warmRails: ['recent', 'trending', 'ramadan']
  }
};

export function estimateClipSizeBytes(durationMs, bitrateKbps = audioFormatPolicy.sendable.targetBitrateKbps) {
  return Math.ceil((durationMs / 1000) * (bitrateKbps * 1000 / 8));
}

export function isSendableUnderPolicy(clip) {
  return clip.durationMs <= audioFormatPolicy.preview.maxDurationMs &&
    estimateClipSizeBytes(clip.durationMs) <= audioFormatPolicy.sendable.maxBytes;
}
