import * as THREE from 'three';

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform sampler2D map;
uniform float uDissolve;
uniform float uOpacity;
varying vec2 vUv;

float bayer4x4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int idx = y * 4 + x;
  if (idx == 0) return 0.0 / 16.0;
  if (idx == 1) return 8.0 / 16.0;
  if (idx == 2) return 2.0 / 16.0;
  if (idx == 3) return 10.0 / 16.0;
  if (idx == 4) return 12.0 / 16.0;
  if (idx == 5) return 4.0 / 16.0;
  if (idx == 6) return 14.0 / 16.0;
  if (idx == 7) return 6.0 / 16.0;
  if (idx == 8) return 3.0 / 16.0;
  if (idx == 9) return 11.0 / 16.0;
  if (idx == 10) return 1.0 / 16.0;
  if (idx == 11) return 9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return 7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

void main() {
  vec4 texel = texture2D(map, vUv);
  if (texel.a < 0.45) discard;
  if (uDissolve > 0.001) {
    float threshold = bayer4x4(floor(vUv * 48.0));
    if (threshold < uDissolve) discard;
  }
  gl_FragColor = vec4(texel.rgb, texel.a * uOpacity);
}
`;

export interface BattleSpriteMaterialHandle {
  material: THREE.ShaderMaterial;
  setTexture(tex: THREE.Texture): void;
  setDissolve(v: number): void;
  setOpacity(v: number): void;
}

export function createBattleSpriteMaterial(
  initialTexture: THREE.Texture
): BattleSpriteMaterialHandle {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: initialTexture },
      uDissolve: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
  });

  return {
    material,
    setTexture(tex: THREE.Texture) {
      material.uniforms.map.value = tex;
    },
    setDissolve(v: number) {
      material.uniforms.uDissolve.value = v;
    },
    setOpacity(v: number) {
      material.uniforms.uOpacity.value = v;
    },
  };
}
