import test from 'node:test';
import assert from 'node:assert/strict';
import { clipCatalog } from '../src/data/clips.js';
import { groupByDiscoveryRail, searchAudioGifs } from '../src/search/searchEngine.js';

test('search prioritizes conversational trigger matches', () => {
  const [first] = searchAudioGifs('cringe', clipCatalog);
  assert.equal(first.id, 'maspero-losing-horn-cringe');
});

test('search supports Arabic catalog terms and source metadata', () => {
  const [first] = searchAudioGifs('تمام', clipCatalog, { locale: 'ar' });
  assert.equal(first.id, 'rotana-classic-yes-hype');
});

test('empty search returns popular discovery clips', () => {
  const results = searchAudioGifs('', clipCatalog, { limit: 2 });
  assert.deepEqual(results.map((clip) => clip.id), ['rotana-eye-of-the-tiger-win', 'rotana-classic-yes-hype']);
});

test('discovery rails are grouped by trigger and source', () => {
  const rails = groupByDiscoveryRail(clipCatalog);
  assert.ok(rails.triggers.brb.some((clip) => clip.id === 'ramadan-series-brb-tea'));
  assert.ok(rails.sources['Rotana: Classic Arabic Cinema']);
});
