import {
  CompressedCubeTexture,
  CompressedTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type WebGLRenderer,
} from '@iwsdk/core';
// Addon loaders are not re-exported by @iwsdk/core; IWSDK imports this same module internally.
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { publicUrl } from '../app.js';

let loader: KTX2Loader | null = null;

function getLoader(renderer: WebGLRenderer): KTX2Loader {
  if (!loader) {
    // Transcoder files are copied from three into public/basis by scripts/copy-basis.mjs.
    loader = new KTX2Loader().setTranscoderPath(publicUrl('basis/')).detectSupport(renderer);
  }
  return loader;
}

/**
 * Loads a packed cube map written by scripts/build-cubemaps.mjs:
 *   "KTXC" | uint32 faceCount | faceCount × uint32 byteLength | KTX2 face files
 * Faces are transcoded in KTX2Loader's worker pool (off the main thread) into the GPU's
 * compressed format, then combined into one CompressedCubeTexture.
 */
export async function loadPackedCube(renderer: WebGLRenderer, url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const view = new DataView(buf);
  const magic = String.fromCharCode(...new Uint8Array(buf, 0, 4));
  const count = view.getUint32(4, true);
  if (magic !== 'KTXC' || count !== 6) throw new Error(`${url}: not a packed cube map`);

  const ktx2 = getLoader(renderer);
  let offset = 8 + 4 * count;
  const parts: Promise<CompressedTexture>[] = [];
  for (let i = 0; i < count; i++) {
    const len = view.getUint32(8 + 4 * i, true);
    const slice = buf.slice(offset, offset + len);
    offset += len;
    parts.push(
      new Promise<CompressedTexture>((resolve, reject) =>
        ktx2.parse(slice, (t) => resolve(t as CompressedTexture), reject),
      ),
    );
  }
  const faces = await Promise.all(parts);
  signal?.throwIfAborted();

  const first = faces[0];
  if (import.meta.env.DEV) console.info(`[place] ${url.split('/').pop()}: GPU format ${first.format}`);
  const cube = new CompressedCubeTexture(
    faces.map((f) => ({
      mipmaps: f.mipmaps,
      width: f.image.width,
      height: f.image.height,
      format: f.format,
      type: f.type,
    })) as unknown as CompressedTexture[],
    first.format,
    first.type,
  );
  cube.minFilter = (first.mipmaps?.length ?? 1) > 1 ? LinearMipmapLinearFilter : LinearFilter;
  cube.magFilter = LinearFilter;
  cube.generateMipmaps = false;
  cube.colorSpace = SRGBColorSpace;
  cube.needsUpdate = true;
  // The per-face textures were never uploaded; drop their references.
  for (const f of faces) f.mipmaps = [];
  return cube;
}
