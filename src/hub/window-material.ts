import { Color, RepeatWrapping, ShaderMaterial, type Texture } from '@iwsdk/core';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  // View direction in the window's own frame: shifts as the viewer moves, like a real window.
  vec3 camLocal = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vDir = position - camLocal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uGlow;
uniform float uFade;
uniform float uU0;
uniform float uK;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float lon = atan(d.x, -d.z) * uK;
  float lat = asin(clamp(d.y, -1.0, 1.0)) * uK;
  vec2 uv = vec2(uU0 + lon / 6.2831853, clamp(0.5 + lat / 3.14159265, 0.02, 0.98));
  vec3 tex = texture2D(uMap, uv).rgb;
  vec3 c = tex * mix(0.3, 1.0, uGlow) + uColor * uGlow * 0.16;
  gl_FragColor = vec4(c * uFade, 1.0);
  #include <colorspace_fragment>
}`;

/** The picture inside a hub window: the place's thumbnail seen through the arch. */
export function makePaneMaterial(map: Texture, focusU: number, color: string): ShaderMaterial {
  map.wrapS = RepeatWrapping;
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uColor: { value: new Color(color) },
      uGlow: { value: 0 },
      uFade: { value: 1 },
      uU0: { value: focusU },
      // How much the panorama is magnified through the window (angles are multiplied by this).
      uK: { value: 2.4 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
}
