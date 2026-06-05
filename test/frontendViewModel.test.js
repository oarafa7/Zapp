import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, formatSize, getFrontendState, quickTriggers } from '../src/frontend/viewModel.js';

test('frontend view model prepares keyboard results and send payload', () => {
  const state = getFrontendState({ query: 'brb', locale: 'ar-EG' });

  assert.equal(state.results[0].id, 'ramadan-series-brb-tea');
  assert.equal(state.sendPayload.caption, 'Sent via Zapp');
  assert.equal(state.sendPayload.mimeType, 'audio/ogg; codecs=opus');
  assert.ok(state.sendPayload.estimatedBytes < 512 * 1024);
});

test('frontend quick triggers include the core product examples', () => {
  assert.ok(quickTriggers.includes('brb'));
  assert.ok(quickTriggers.includes('cringe'));
  assert.ok(quickTriggers.includes('i got a bonus'));
});

test('frontend formatters keep compact mobile labels', () => {
  assert.equal(formatDuration(3100), '3.1s');
  assert.equal(formatSize(18_600), '18 KB');
});
