// Pure, browser- and Node-safe helpers for the in-app audio trimmer.
// Kept free of any DOM/AudioContext use so the encoding math can be unit tested.

// Encodes mono float PCM samples (range -1..1) into a 16-bit WAV byte array.
export function encodeWav(samples, sampleRate = 44100) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

// Extracts [startSec, endSec) from one or more channels and downmixes to mono.
export function sliceToMono(channels, sampleRate, startSec, endSec) {
  const total = channels[0]?.length ?? 0;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(total, Math.ceil(endSec * sampleRate));
  const length = Math.max(0, endSample - startSample);
  const out = new Float32Array(length);
  const channelCount = channels.length || 1;

  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (let c = 0; c < channelCount; c += 1) sum += channels[c][startSample + i] || 0;
    out[i] = sum / channelCount;
  }
  return out;
}
