import test from 'node:test';
import assert from 'node:assert/strict';
import { RamadanInjectionQueue, validateClipPayload } from '../src/backend/ramadanEngine.js';

const validPayload = {
  id: 'ramadan-nightly-catchphrase-001',
  title: 'الليلة كبيرة',
  source: 'Ramadan Nightly Drama',
  archive: 'UMS',
  locale: 'ar-EG',
  durationMs: 3500,
  triggerTags: ['big night', 'hype', 'الليلة كبيرة'],
  characterTags: ['lead actor'],
  icon: '🌙',
  artworkCue: 'ramadan crescent',
  audioUrl: 'https://cdn.zapp.example/audio/ramadan-nightly-catchphrase-001.opus',
  previewUrl: 'https://cdn.zapp.example/previews/ramadan-nightly-catchphrase-001.m4a',
  rightsStatus: 'licensed'
};

test('validates required clip upload metadata', () => {
  const result = validateClipPayload({ title: 'missing fields' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('id is required'));
});

test('queues licensed Ramadan uploads for immediate publishing', () => {
  const queue = new RamadanInjectionQueue({ now: () => new Date('2026-02-18T21:00:00Z') });
  const result = queue.submit(validPayload, 'admin@zapp.example');

  assert.equal(result.accepted, true);
  assert.equal(result.item.status, 'ready_for_publish');
  assert.ok(result.item.seasonalBoosts.includes('ramadan'));
  assert.equal(result.item.attribution, 'Sent via Zapp');

  const [published] = queue.publishReady();
  assert.equal(published.id, validPayload.id);
  assert.equal(published.publishedAt, '2026-02-18T21:00:00.000Z');
});

test('holds unlicensed archive uploads for rights review', () => {
  const queue = new RamadanInjectionQueue();
  const result = queue.submit({ ...validPayload, id: 'review-needed', rightsStatus: 'pending' }, 'admin@zapp.example');

  assert.equal(result.accepted, true);
  assert.equal(result.item.status, 'needs_rights_review');
  assert.deepEqual(queue.publishReady(), []);
});
