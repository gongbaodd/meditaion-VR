export type NoiseColor = 'white' | 'pink' | 'brown';

const cache = new WeakMap<BaseAudioContext, Map<NoiseColor, AudioBuffer>>();

/** A loopable stereo noise buffer (channels are independent so the bed sounds wide). */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor, seconds = 8): AudioBuffer {
  let byColor = cache.get(ctx);
  if (!byColor) cache.set(ctx, (byColor = new Map()));
  const hit = byColor.get(color);
  if (hit) return hit;

  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    if (color === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (color === 'pink') {
      // Paul Kellet's refined pink-noise filter.
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // Cross-fade the loop seam over 50 ms so it doesn't click.
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      d[i] = d[i] * a + d[len - fade + i] * (1 - a);
    }
  }
  byColor.set(color, buf);
  return buf;
}

export function noiseSource(ctx: BaseAudioContext, color: NoiseColor): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, color);
  src.loop = true;
  // Random start so layers using the same buffer don't phase-lock.
  src.loopStart = 0;
  src.loopEnd = src.buffer.duration;
  return src;
}

/** Synthetic room impulse response for a soft, open-air reverb. */
export function impulseResponse(ctx: BaseAudioContext, seconds = 3.5, decay = 2.8): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}
