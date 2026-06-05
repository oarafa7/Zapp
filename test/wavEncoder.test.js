import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav, sliceToMono } from '../src/frontend/wavEncoder.js';

test('encodeWav writes a valid mono 16-bit WAV header', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const bytes = encodeWav(samples, 22050);
  const view = new DataView(bytes.buffer);

  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...bytes.slice(8, 12)), 'WAVE');
  assert.equal(view.getUint16(20, true), 1); // PCM
  assert.equal(view.getUint16(22, true), 1); // mono
  assert.equal(view.getUint32(24, true), 22050); // sample rate
  assert.equal(view.getUint32(40, true), samples.length * 2); // data size
  assert.equal(bytes.length, 44 + samples.length * 2);
  assert.equal(view.getInt16(44 + 6, true), 32767); // the 1.0 sample maxes out
});

test('sliceToMono extracts the requested region and downmixes channels', () => {
  const sampleRate = 100; // 1 sample = 10ms
  const left = new Float32Array(Array.from({ length: 100 }, (_, i) => i / 100));
  const right = new Float32Array(Array.from({ length: 100 }, () => 1));

  const mono = sliceToMono([left, right], sampleRate, 0.2, 0.5); // samples 20..50
  assert.equal(mono.length, 30);
  // first sample = average of left[20]=0.2 and right[20]=1 => 0.6
  assert.ok(Math.abs(mono[0] - 0.6) < 1e-6);
});

test('sliceToMono clamps to the available audio length', () => {
  const data = new Float32Array(10);
  const mono = sliceToMono([data], 10, -1, 999);
  assert.equal(mono.length, 10);
});
