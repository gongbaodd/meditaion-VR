/**
 * Dev/diagnostic only: estimates GPU texture memory by wrapping the WebGL2 calls
 * that allocate and free textures. three.js only reports a texture *count*
 * (renderer.info.memory.textures), which hides a single huge cube map.
 *
 * Must be installed before the renderer creates its context.
 */

const GL = WebGL2RenderingContext;
const CUBE_FACES = new Set<number>([
  GL.TEXTURE_CUBE_MAP_POSITIVE_X,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_X,
  GL.TEXTURE_CUBE_MAP_POSITIVE_Y,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_Y,
  GL.TEXTURE_CUBE_MAP_POSITIVE_Z,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_Z,
]);

/** Bytes per pixel for compressed formats (block size / 16 texels). */
const COMPRESSED_BPP: Record<number, number> = {
  0x9274: 0.5, // ETC2 RGB8
  0x9275: 0.5, // ETC2 SRGB8
  0x9278: 1, // ETC2 RGBA8
  0x9279: 1, // ETC2 SRGB8_ALPHA8
  0x8d64: 0.5, // ETC1
  0x83f0: 0.5, // BC1 RGB
  0x8c4c: 0.5, // BC1 SRGB
  0x83f3: 1, // BC3 RGBA
  0x8c4f: 1, // BC3 SRGB_ALPHA
  0x8e8c: 1, // BC7
  0x8e8d: 1, // BC7 SRGB
  0x93b0: 1, // ASTC 4×4
  0x93d0: 1, // ASTC 4×4 SRGB
};

/** Bytes per pixel for the internal formats three.js uses. */
function bpp(internal: number): number {
  if (internal in COMPRESSED_BPP) return COMPRESSED_BPP[internal];
  switch (internal) {
    case GL.R8:
    case GL.ALPHA:
    case GL.LUMINANCE:
      return 1;
    case GL.RG8:
    case GL.R16F:
    case GL.LUMINANCE_ALPHA:
      return 2;
    case GL.RGB8:
    case GL.SRGB8:
      return 3;
    case GL.RG16F:
    case GL.R32F:
    case GL.DEPTH_COMPONENT24:
    case GL.DEPTH24_STENCIL8:
    case GL.DEPTH_COMPONENT32F:
      return 4;
    case GL.RGBA16F:
    case GL.RG32F:
      return 8;
    case GL.RGB16F:
      return 6;
    case GL.RGB32F:
      return 12;
    case GL.RGBA32F:
      return 16;
    default:
      return 4; // RGBA8, SRGB8_ALPHA8, RGBA, and anything unknown
  }
}

type Slot = { tex: WebGLTexture | null };
const sizes = new Map<WebGLTexture, Map<string, number>>();
let total = 0;
let peak = 0;
let installed = false;

function record(tex: WebGLTexture | null, key: string, bytes: number) {
  if (!tex) return;
  let m = sizes.get(tex);
  if (!m) sizes.set(tex, (m = new Map()));
  total += bytes - (m.get(key) ?? 0);
  m.set(key, bytes);
  if (total > peak) peak = total;
}

export function installGpuMemoryTracker() {
  if (installed || typeof WebGL2RenderingContext === 'undefined') return;
  installed = true;
  const P = WebGL2RenderingContext.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  // Bound texture per (unit, target). Only TEXTURE_2D and TEXTURE_CUBE_MAP matter here.
  const bound = new WeakMap<object, { unit: number; slots: Map<string, Slot> }>();
  const state = (gl: object) => {
    let s = bound.get(gl);
    if (!s) bound.set(gl, (s = { unit: 0, slots: new Map() }));
    return s;
  };
  const current = (gl: object, target: number): WebGLTexture | null => {
    const t = CUBE_FACES.has(target) ? GL.TEXTURE_CUBE_MAP : target;
    const s = state(gl);
    return s.slots.get(`${s.unit}:${t}`)?.tex ?? null;
  };
  const wrap = (name: string, after: (gl: object, args: unknown[]) => void) => {
    const orig = P[name];
    P[name] = function (this: object, ...args: unknown[]) {
      const r = orig.apply(this, args);
      try {
        after(this, args);
      } catch {
        /* accounting must never break rendering */
      }
      return r;
    };
  };

  wrap('activeTexture', (gl, [unit]) => (state(gl).unit = (unit as number) - GL.TEXTURE0));
  wrap('bindTexture', (gl, [target, tex]) => {
    const s = state(gl);
    s.slots.set(`${s.unit}:${target}`, { tex: tex as WebGLTexture | null });
  });
  wrap('texImage2D', (gl, a) => {
    const [target, level, internal] = a as number[];
    // Overloads: (t, l, if, w, h, border, fmt, type, ...) or (t, l, if, fmt, type, source)
    let w: number, h: number;
    if (a.length >= 8 && typeof a[3] === 'number' && typeof a[4] === 'number' && typeof a[5] === 'number') {
      w = a[3] as number;
      h = a[4] as number;
    } else {
      const src = a[5] as { width?: number; height?: number; videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number };
      w = src?.naturalWidth || src?.videoWidth || src?.width || 0;
      h = src?.naturalHeight || src?.videoHeight || src?.height || 0;
    }
    record(current(gl, target), `${target}:${level}`, w * h * bpp(internal));
  });
  wrap('compressedTexImage2D', (gl, a) => {
    const [target, level] = a as number[];
    const data = a[6] as ArrayBufferView | undefined;
    // (t, l, if, w, h, border, srcData, srcOffset?, srcLengthOverride?) or (…, imageSize, offset) for PBOs
    const bytes =
      typeof a[8] === 'number' && a[8] > 0
        ? (a[8] as number)
        : data && typeof data === 'object'
          ? data.byteLength
          : (a[6] as number);
    record(current(gl, target), `${target}:${level}`, bytes);
  });
  wrap('texStorage2D', (gl, a) => {
    const [target, levels, internal, w, h] = a as number[];
    const faces = target === GL.TEXTURE_CUBE_MAP ? 6 : 1;
    let bytes = 0;
    // Compressed levels round up to 4×4 blocks.
    const block = internal in COMPRESSED_BPP ? 4 : 1;
    for (let l = 0; l < levels; l++) {
      const lw = Math.max(1, w >> l);
      const lh = Math.max(1, h >> l);
      bytes += Math.ceil(lw / block) * block * Math.ceil(lh / block) * block * bpp(internal);
    }
    record(current(gl, target), 'storage', bytes * faces);
  });
  wrap('compressedTexSubImage2D', (gl, a) => {
    // (target, level, x, y, w, h, format, srcData, …)
    const [target, level] = a as number[];
    const data = a[7] as ArrayBufferView | undefined;
    if (data && typeof data === 'object') {
      const tex = current(gl, target);
      // Replace the storage guess with real sizes as levels arrive.
      if (tex && sizes.get(tex)?.has('storage')) record(tex, 'storage', 0);
      record(tex, `${target}:${level}`, data.byteLength);
    }
  });
  wrap('generateMipmap', (gl, [target]) => {
    const tex = current(gl, target as number);
    const m = tex && sizes.get(tex);
    // texStorage2D already allocated every level.
    if (!m || m.has('storage')) return;
    let base = 0;
    for (const [k, v] of m) if (k.endsWith(':0') || k === 'storage') base += v;
    record(tex, 'mips', Math.round(base / 3));
  });
  wrap('deleteTexture', (_gl, [tex]) => {
    const m = sizes.get(tex as WebGLTexture);
    if (!m) return;
    for (const v of m.values()) total -= v;
    sizes.delete(tex as WebGLTexture);
  });
}

export const MiB = 1024 * 1024;

export function gpuTextureBytes() {
  return { total, peak, textures: sizes.size };
}

/** Largest live textures in MiB, to see what dominates the total. */
export function largestTextures(n = 6): number[] {
  const all: number[] = [];
  for (const m of sizes.values()) {
    let b = 0;
    for (const v of m.values()) b += v;
    all.push(Math.round((b / MiB) * 10) / 10);
  }
  return all.sort((a, b) => b - a).slice(0, n);
}

export function resetPeak() {
  peak = total;
}
