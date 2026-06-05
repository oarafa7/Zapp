import { encodeWav, sliceToMono } from './wavEncoder.js';

// Browser-only glue: decodes an uploaded audio file and produces a trimmed,
// mono WAV blob entirely client-side (no server, works on iOS Safari).

function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('Audio editing is not supported in this browser.');
  return new Ctx();
}

export async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();
  try {
    // Promise form on modern browsers; callback form for older iOS Safari.
    const audioBuffer = await new Promise((resolve, reject) => {
      const maybePromise = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(resolve, reject);
    });
    return audioBuffer;
  } finally {
    ctx.close?.();
  }
}

export function trimToWavBlob(audioBuffer, startSec, endSec) {
  const channels = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c += 1) {
    channels.push(audioBuffer.getChannelData(c));
  }
  const mono = sliceToMono(channels, audioBuffer.sampleRate, startSec, endSec);
  const wav = encodeWav(mono, audioBuffer.sampleRate);
  return new Blob([wav], { type: 'audio/wav' });
}
