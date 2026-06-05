import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Zapp ships license-free, synthesized "Audio GIF" sound bites so the prototype
// is fully playable and shareable without depending on licensed archive audio.
// Each clip is generated deterministically from simple note sequences, so the
// repository stays free of opaque binary blobs that drift from their source.

const SAMPLE_RATE = 22_050;

const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
  A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
  G5: 783.99, C6: 1046.5, A3: 220.0, F3: 174.61, D3: 146.83
};

function applyEnvelope(progress) {
  // Short attack, gentle decay so notes never click on start/stop.
  const attack = 0.04;
  const release = 0.25;
  if (progress < attack) return progress / attack;
  if (progress > 1 - release) return (1 - progress) / release;
  return 1;
}

function renderNote(samples, startSec, durationSec, frequency, gain) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const length = Math.floor(durationSec * SAMPLE_RATE);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const progress = i / length;
    // Fundamental plus a softer overtone for a warmer, less sterile tone.
    const wave =
      Math.sin(2 * Math.PI * frequency * t) +
      0.35 * Math.sin(2 * Math.PI * frequency * 2 * t);
    const value = wave * applyEnvelope(progress) * gain;
    const index = start + i;
    if (index < samples.length) samples[index] += value;
  }
}

function renderGlide(samples, startSec, durationSec, fromFreq, toFreq, gain) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const length = Math.floor(durationSec * SAMPLE_RATE);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const progress = i / length;
    const frequency = fromFreq + (toFreq - fromFreq) * progress;
    const wave =
      Math.sin(2 * Math.PI * frequency * t) +
      0.3 * Math.sin(2 * Math.PI * frequency * 2 * t);
    const value = wave * applyEnvelope(progress) * gain;
    const index = start + i;
    if (index < samples.length) samples[index] += value;
  }
}

function toWavBuffer(samples) {
  // Normalize to avoid clipping when notes overlap, then quantize to 16-bit PCM.
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0 ? 0.9 / peak : 1;

  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataLength, 40);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] * scale));
    buffer.writeInt16LE(Math.round(clamped * 32_767), 44 + i * 2);
  }
  return buffer;
}

// Each clip is a tiny, recognizable "cultural reaction" gesture rendered as a
// note sequence. The vibe matches the catalog entry it backs.
const compositions = {
  // 🥊 triumphant ascending "Eye of the Tiger" win fanfare
  'rotana-eye-of-the-tiger-win': (samples) => {
    renderNote(samples, 0.0, 0.18, NOTE.C4, 0.8);
    renderNote(samples, 0.18, 0.18, NOTE.E4, 0.8);
    renderNote(samples, 0.36, 0.18, NOTE.G4, 0.8);
    renderNote(samples, 0.54, 0.5, NOTE.C5, 0.9);
    renderNote(samples, 0.54, 0.5, NOTE.E5, 0.5);
  },
  // 🎺 descending "sad trombone" losing horn
  'maspero-losing-horn-cringe': (samples) => {
    renderGlide(samples, 0.0, 0.4, NOTE.A4, NOTE.G4, 0.9);
    renderGlide(samples, 0.4, 0.4, NOTE.G4, NOTE.F3, 0.9);
    renderGlide(samples, 0.8, 0.7, NOTE.F3, NOTE.D3, 0.9);
  },
  // ☕ gentle "back after the break" notification chime
  'ramadan-series-brb-tea': (samples) => {
    renderNote(samples, 0.0, 0.35, NOTE.E5, 0.7);
    renderNote(samples, 0.3, 0.55, NOTE.C5, 0.7);
  },
  // 👌 quick positive "ta-da / kullu tamam" confirm
  'rotana-classic-yes-hype': (samples) => {
    renderNote(samples, 0.0, 0.18, NOTE.G4, 0.8);
    renderNote(samples, 0.16, 0.5, NOTE.C5, 0.9);
    renderNote(samples, 0.16, 0.5, NOTE.E5, 0.45);
  }
};

const durationsSec = {
  'rotana-eye-of-the-tiger-win': 1.2,
  'maspero-losing-horn-cringe': 1.6,
  'ramadan-series-brb-tea': 0.95,
  'rotana-classic-yes-hype': 0.75
};

export async function generateAudio(targetDir) {
  await mkdir(targetDir, { recursive: true });
  const written = [];
  for (const [id, compose] of Object.entries(compositions)) {
    const samples = new Float32Array(Math.ceil(durationsSec[id] * SAMPLE_RATE));
    compose(samples);
    const wav = toWavBuffer(samples);
    const file = join(targetDir, `${id}.wav`);
    await writeFile(file, wav);
    written.push(file);
  }
  return written;
}

// When run directly, (re)generate the committed source assets.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const target = join(here, '..', 'assets', 'audio');
  const written = await generateAudio(target);
  console.log(`Generated ${written.length} Audio GIF clips in assets/audio/.`);
}
