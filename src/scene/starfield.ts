import * as THREE from 'three';

/*
 * Étoiles décoratives : une seule géométrie, un seul matériau. Graine 42, 60 % disque aplati,
 * 40 % coquille lointaine ; 87 % crème, 7 % rouge clair, 6 % atténué (tokens.css).
 * Taille en px = clamp(taille · focale / profondeur · échelle) comme dans le prototype.
 */

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const COLORS = [new THREE.Color('#FEF8F1'), new THREE.Color('#F08A72'), new THREE.Color('#A8A3A0')];

export function buildStarGeometry(count: number) {
  const r = rng(42);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    if (k % 5 < 3) {
      const a = r() * Math.PI * 2;
      const d = 60 + Math.pow(r(), 0.7) * 560;
      pos[k * 3] = Math.cos(a) * d;
      pos[k * 3 + 2] = Math.sin(a) * d * 0.85;
      pos[k * 3 + 1] = (r() + r() + r() - 1.5) * 46;
    } else {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const d = 800 + r() * 900;
      const q = Math.sqrt(1 - u * u);
      pos[k * 3] = q * Math.cos(a) * d;
      pos[k * 3 + 1] = u * d;
      pos[k * 3 + 2] = q * Math.sin(a) * d;
    }
    size[k] = 0.5 + Math.pow(r(), 3) * 2.2;
    alpha[k] = 0.25 + r() * 0.7;
    const c = r();
    COLORS[c < 0.07 ? 1 : c < 0.13 ? 2 : 0].toArray(col, k * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  return g;
}

export function starMaterial(scale: number, max: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    uniforms: {
      uFocal: { value: 1000 },
      uDpr: { value: 1 },
      uScale: { value: scale },
      uMax: { value: max },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uFocal;
      uniform float uDpr;
      uniform float uScale;
      uniform float uMax;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float depth = max(-mv.z, 1.0);
        float r = clamp(aSize * uFocal / depth * uScale, 0.35, uMax);
        float px = r * 2.0 * uDpr;
        // Sous le pixel : on garde 1 px et on réduit l'opacité à la couverture équivalente.
        float cover = min(1.0, px * px);
        gl_PointSize = max(px, 1.0) + 1.0;
        vColor = color;
        vAlpha = aAlpha * (0.35 + 0.65 * min(1.0, 900.0 / depth)) * cover;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.55, d);
        if (a <= 0.0) discard;
        gl_FragColor = vec4(vColor, vAlpha * a);
        #include <colorspace_fragment>
      }
    `,
  });
}
