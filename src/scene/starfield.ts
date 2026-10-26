import * as THREE from 'three';

/*
 * Étoiles décoratives : une seule géométrie, un seul matériau, graine 42.
 * Galaxie spirale à deux bras logarithmiques (60 %), bulbe chaud autour du trou noir (10 %),
 * coquille lointaine (30 %). Couleurs : crème, pêche, gris, ambre pâle (bulbe), bleu pâle (bras).
 * Taille en px = clamp(taille · focale / profondeur · échelle) comme dans le prototype.
 */

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const CREAM = 0;
const PEACH = 1;
const MUTED = 2;
const AMBER = 3;
const BLUE = 4;
const COLORS = ['#FEF8F1', '#FFC89A', '#A8A3A0', '#FFD9B0', '#CFDDFF'].map((c) => new THREE.Color(c));

export function buildStarGeometry(count: number) {
  const r = rng(42);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const m = k % 10;
    let c = CREAM;
    if (m < 6) {
      // Bras : r = 150·e^(a/2,1), dispersion qui se resserre vers l'extérieur.
      const arm = k % 2;
      const t = Math.pow(r(), 0.85);
      const d = 150 + t * 560;
      const a = Math.log(d / 150) * 2.1 + arm * Math.PI + (r() - 0.5) * (0.7 - t * 0.3);
      pos[k * 3] = Math.cos(a) * d;
      pos[k * 3 + 2] = Math.sin(a) * d;
      pos[k * 3 + 1] = (r() + r() + r() - 1.5) * (14 + t * 26);
      const u = r();
      c = u < 0.1 ? BLUE : u < 0.16 ? PEACH : d < 260 && u < 0.45 ? AMBER : CREAM;
    } else if (m < 7) {
      const a = r() * Math.PI * 2;
      const d = 140 + r() * 90;
      pos[k * 3] = Math.cos(a) * d;
      pos[k * 3 + 2] = Math.sin(a) * d;
      pos[k * 3 + 1] = (r() - 0.5) * 50;
      c = r() < 0.6 ? AMBER : CREAM;
    } else {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const d = 900 + r() * 900;
      const q = Math.sqrt(1 - u * u);
      pos[k * 3] = q * Math.cos(a) * d;
      pos[k * 3 + 1] = u * d;
      pos[k * 3 + 2] = q * Math.sin(a) * d;
      c = r() < 0.1 ? MUTED : CREAM;
    }
    size[k] = 0.5 + Math.pow(r(), 3) * 2.2;
    alpha[k] = 0.25 + r() * 0.7;
    COLORS[c].toArray(col, k * 3);
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
