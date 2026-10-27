import * as THREE from 'three';
import type { GateKind } from './themes';

/*
 * Portes en 3D, construites en code (aucun fichier à charger). Chaque porte est modélisée à
 * l'échelle 1 (rayon ≈ 1) puis mise à l'échelle par StarMap ; elle se tourne doucement vers la
 * caméra avec un angle de trois-quarts propre à sa forme, pour que son volume se lise.
 *
 * blackhole : sphère d'ombre + disque d'accrétion incliné (masqué derrière la sphère) + anneau de photons
 * hexgate   : anneau hexagonal facetté (métal sombre, liseré ambre), six balises, surface d'énergie animée
 * wormhole  : tunnel d'anneaux qui s'enfoncent en boucle + paroi en entonnoir striée
 * rift      : déchirure verticale animée + éclats de roche en orbite
 * vortex    : spirale de particules en entonnoir qui tourne
 *
 * Matériaux et géométries sont partagés entre toutes les portes d'une même forme ; seul le temps
 * (uTime) et les positions des enfants sont mis à jour à chaque image.
 */

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

const LOCAL_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Ombrage sans lumière de scène : diffus depuis une direction fixe en espace vue + liseré de Fresnel. */
const SOLID_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const SOLID_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uRim;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 L = normalize(vec3(0.4, 0.7, 0.6));
    float d = max(dot(vN, L), 0.0);
    float fr = pow(1.0 - max(dot(vN, vV), 0.0), 2.4);
    gl_FragColor = vec4(uBase * (0.35 + 0.9 * d) + uRim * fr * 1.4, 1.0);
  }
`;

type Keep = <T extends { dispose(): void }>(o: T) => T;

export interface Gate {
  group: THREE.Group;
  /** Angle de trois-quarts (rad) appliqué après l'orientation vers la caméra. */
  tilt: THREE.Quaternion;
  update: (T: number) => void;
}

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;

/** Fabrique partagée : un jeu de matériaux et géométries par forme, réutilisé par chaque porte. */
export function gateKit(keep: Keep, glow: THREE.Texture, disc: THREE.Texture) {
  const uTime = { value: 0 };
  const cache = new Map<GateKind, () => Gate>();
  const quat = (x: number, y: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, 0));
  const sprite = (color: string, opacity: number, size: number) => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color, opacity, ...additive })));
    s.scale.setScalar(size);
    return s;
  };

  const solid = (base: string, rim: string) =>
    keep(new THREE.ShaderMaterial({ uniforms: { uBase: { value: new THREE.Color(base) }, uRim: { value: new THREE.Color(rim) } }, vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG }));

  // ---------- Trou noir ----------
  const bhSphere = keep(new THREE.SphereGeometry(0.62, 40, 20));
  const bhShadow = keep(new THREE.MeshBasicMaterial({ color: '#020203' }));
  const bhDiskGeo = keep(new THREE.RingGeometry(0.82, 2.2, 160, 6));
  const bhDiskMat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uTime },
      vertexShader: LOCAL_VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vPos;
        ${NOISE}
        void main() {
          float r = length(vPos.xy);
          float a = atan(vPos.y, vPos.x);
          float t = clamp((r - 0.82) / 1.38, 0.0, 1.0);
          float streak = fbm(vec2(a * 3.0 + uTime * 0.9 / (0.3 + t), r * 5.0));
          vec3 hot = vec3(1.0, 0.93, 0.8);
          vec3 warm = vec3(0.96, 0.58, 0.3);
          vec3 cool = vec3(0.53, 0.13, 0.09);
          vec3 c = mix(mix(hot, warm, smoothstep(0.0, 0.35, t)), cool, smoothstep(0.35, 1.0, t));
          float alpha = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.55, 1.0, t)) * (0.45 + 0.8 * streak);
          gl_FragColor = vec4(c * alpha * 1.6, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      ...additive,
    }),
  );
  const bhPhotonGeo = keep(new THREE.RingGeometry(0.6, 0.78, 96, 1));
  const bhPhotonMat = keep(
    new THREE.ShaderMaterial({
      vertexShader: LOCAL_VERT,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          float r = length(vPos.xy);
          float g = exp(-pow((r - 0.64) / 0.035, 2.0)) + 0.25 * exp(-pow((r - 0.66) / 0.1, 2.0));
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.7) * g, 1.0);
        }
      `,
      ...additive,
    }),
  );
  cache.set('blackhole', () => {
    const group = new THREE.Group();
    const shadow = new THREE.Mesh(bhSphere, bhShadow);
    const disk = new THREE.Mesh(bhDiskGeo, bhDiskMat);
    disk.rotation.x = -1.22;
    const photon = new THREE.Mesh(bhPhotonGeo, bhPhotonMat);
    photon.position.z = 0.01;
    group.add(sprite('#F5A86E', 0.25, 4.4), disk, shadow, photon);
    return { group, tilt: quat(0, 0.25), update: (T) => (disk.rotation.z = -T * 0.15) };
  });

  // ---------- Porte hexagonale (Data) ----------
  const hexRing = keep(new THREE.TorusGeometry(1, 0.13, 6, 6));
  const hexMetal = solid('#2C2219', '#FFB25C');
  const beaconGeo = keep(new THREE.BoxGeometry(0.1, 0.24, 0.3));
  const beaconMat = keep(new THREE.MeshBasicMaterial({ color: '#FFD696' }));
  const hexSurfGeo = keep(new THREE.CircleGeometry(0.9, 6));
  const hexSurfMat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uTime },
      vertexShader: LOCAL_VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vPos;
        ${NOISE}
        void main() {
          vec2 p = vPos.xy;
          float r = length(p);
          float n = fbm(p * 3.0 + vec2(uTime * 0.25, -uTime * 0.18));
          float caustic = pow(1.0 - abs(n * 2.0 - 1.0), 6.0);
          float ripple = 0.5 + 0.5 * sin(r * 22.0 - uTime * 2.4);
          vec3 c = vec3(1.0, 0.72, 0.36) * (0.18 + 0.9 * caustic + 0.12 * ripple) + vec3(1.0, 0.95, 0.85) * 0.35 * exp(-r * 4.0);
          gl_FragColor = vec4(c * 0.9, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      ...additive,
    }),
  );
  cache.set('stargate', () => {
    const group = new THREE.Group();
    const frame = new THREE.Group();
    frame.add(new THREE.Mesh(hexRing, hexMetal));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const b = new THREE.Mesh(beaconGeo, beaconMat);
      b.position.set(Math.cos(a) * 1.14, Math.sin(a) * 1.14, 0);
      b.rotation.z = a;
      frame.add(b);
      const g = sprite('#FFC86E', 0.5, 0.55);
      g.position.copy(b.position);
      frame.add(g);
    }
    const surface = new THREE.Mesh(hexSurfGeo, hexSurfMat);
    group.add(sprite('#FFB25C', 0.18, 4), surface, frame);
    return { group, tilt: quat(-0.18, 0.5), update: (T) => (frame.rotation.z = T * 0.12) };
  });

  // ---------- Trou de ver (IA) ----------
  const RINGS = 10;
  const DEPTH = 2.6;
  const wormRing = keep(new THREE.TorusGeometry(1, 0.03, 6, 72));
  const wormRingMats = Array.from({ length: RINGS }, () => keep(new THREE.MeshBasicMaterial({ color: '#C9B6FF', ...additive })));
  const profile = Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    return new THREE.Vector2(0.12 + 0.98 * Math.pow(1 - t, 1.8), -t * DEPTH);
  });
  const wormWall = keep(new THREE.LatheGeometry(profile, 72));
  const wormWallMat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uTime },
      vertexShader: LOCAL_VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vPos;
        void main() {
          float a = atan(vPos.z, vPos.x);
          float d = -vPos.y / ${DEPTH.toFixed(1)};
          float lanes = pow(0.5 + 0.5 * sin(a * 9.0 + d * 10.0 - uTime * 2.0), 8.0);
          float bands = pow(0.5 + 0.5 * sin(d * 30.0 - uTime * 4.0), 6.0);
          float fade = smoothstep(0.0, 0.08, d) * (1.0 - smoothstep(0.75, 1.0, d));
          vec3 c = mix(vec3(0.55, 0.42, 1.0), vec3(1.0, 0.8, 0.95), d);
          gl_FragColor = vec4(c * (0.12 + 0.6 * lanes + 0.35 * bands) * fade, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      ...additive,
    }),
  );
  cache.set('wormhole', () => {
    const group = new THREE.Group();
    // Le tour de la lathe est autour de Y : on le couche pour que le tunnel s'enfonce vers -Z.
    const wall = new THREE.Mesh(wormWall, wormWallMat);
    wall.rotation.x = Math.PI / 2;
    const rings = wormRingMats.map((m) => new THREE.Mesh(wormRing, m));
    const core = sprite('#FFFFFF', 0.8, 0.9);
    core.position.z = -DEPTH * 0.92;
    group.add(sprite('#8F6BFF', 0.2, 4.2), wall, ...rings, core);
    return {
      group,
      tilt: quat(0.1, 0.55),
      update: (T) => {
        rings.forEach((ring, i) => {
          // Les anneaux avancent vers la bouche du tunnel en boucle.
          const u = (i / RINGS + T * 0.18) % 1;
          const d = 1 - u;
          ring.position.set(0, 0, -d * DEPTH * 0.95);
          ring.scale.setScalar(0.12 + 0.98 * Math.pow(u, 1.8));
          (ring.material as THREE.MeshBasicMaterial).opacity = Math.min(1, u * 3) * (1 - smoothstep(0.85, 1, u)) * 0.9;
        });
        wall.rotation.y = T * 0.2;
      },
    };
  });

  // ---------- Faille (Web) ----------
  const riftGeo = keep(new THREE.PlaneGeometry(1.3, 3.2, 1, 1));
  const riftMat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uTime },
      vertexShader: LOCAL_VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vPos;
        ${NOISE}
        void main() {
          float y = vPos.y / 1.5;
          float w = 0.42 * pow(max(0.0, 1.0 - y * y), 0.75);
          w *= 0.85 + 0.3 * noise(vec2(y * 6.0, uTime * 0.6));
          float x = abs(vPos.x);
          float inside = 1.0 - smoothstep(w - 0.03, w, x);
          float edge = exp(-pow((x - w) / 0.035, 2.0)) * (0.7 + 0.6 * noise(vec2(y * 14.0 - uTime * 3.0, 1.0)));
          float streak = pow(fbm(vec2(vPos.x * 9.0, y * 1.5 + uTime * 0.8)), 2.0);
          float core = exp(-pow(vPos.x / (w * 0.35 + 0.01), 2.0)) * (1.0 - y * y);
          vec3 c = vec3(0.75, 0.85, 1.0) * edge * 1.6 + vec3(0.35, 0.55, 1.0) * inside * (0.25 + 1.2 * streak) + vec3(0.9, 0.95, 1.0) * core * inside * 0.9;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      ...additive,
    }),
  );
  const shardGeo = keep(new THREE.DodecahedronGeometry(1, 0));
  const shardMat = solid('#141A26', '#8FB4FF');
  const shards = Array.from({ length: 14 }, (_, i) => {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    const r = s - Math.floor(s);
    return { y: -1.3 + (i / 13) * 2.6, side: i % 2 ? 1 : -1, off: 0.45 + r * 0.35, size: 0.05 + r * 0.09, spin: 0.3 + r };
  });
  cache.set('rift', () => {
    const group = new THREE.Group();
    const plane = new THREE.Mesh(riftGeo, riftMat);
    const rocks = shards.map((sh) => {
      const m = new THREE.Mesh(shardGeo, shardMat);
      m.scale.setScalar(sh.size);
      group.add(m);
      return m;
    });
    const halo = sprite('#4E7FD0', 0.22, 3.6);
    halo.scale.set(2.4, 4.4, 1);
    group.add(halo, plane);
    return {
      group,
      tilt: quat(0, 0.32),
      update: (T) =>
        rocks.forEach((m, i) => {
          const sh = shards[i];
          const w = 0.42 * Math.pow(Math.max(0, 1 - (sh.y / 1.5) ** 2), 0.75);
          const a = T * 0.4 * sh.spin + i;
          m.position.set(sh.side * (w + sh.off * 0.4) + Math.cos(a) * 0.05, sh.y + Math.sin(a) * 0.05, Math.sin(a * 0.7) * 0.25);
          m.rotation.set(a, a * 0.7, 0);
        }),
    };
  });

  // ---------- Vortex (Outils) ----------
  const N = 2800;
  const vPos = new Float32Array(N * 3);
  const vCol = new Float32Array(N * 3);
  const gold = new THREE.Color('#FFF2BF');
  const amber = new THREE.Color('#E0B35C');
  for (let i = 0; i < N; i++) {
    const h = Math.sin(i * 78.233) * 43758.5453;
    const r1 = h - Math.floor(h);
    const h2 = Math.sin(i * 12.9898 + 3.1) * 24634.6345;
    const r2 = h2 - Math.floor(h2);
    const t = Math.pow(r1, 0.7);
    const arm = i % 5;
    // Bras épais : dispersion angulaire et radiale, plus large vers l'extérieur.
    const a = (arm / 5) * Math.PI * 2 + t * 4.2 + (r2 - 0.5) * 1.1 * (0.5 + t * 0.5);
    const rad = 0.06 + t * 1.15 + (r1 * 7.0 - Math.floor(r1 * 7.0) - 0.5) * 0.14 * t;
    vPos.set([Math.cos(a) * rad, Math.sin(a) * rad, -Math.pow(1 - t, 2.2) * 1.1], i * 3);
    const c = amber.clone().lerp(gold, 1 - t * 0.8);
    vCol.set([c.r, c.g, c.b], i * 3);
  }
  const vortexGeo = keep(new THREE.BufferGeometry());
  vortexGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
  vortexGeo.setAttribute('color', new THREE.BufferAttribute(vCol, 3));
  const vortexMat = keep(new THREE.PointsMaterial({ map: disc, size: 0.055, sizeAttenuation: true, vertexColors: true, opacity: 0.9, ...additive }));
  cache.set('vortex', () => {
    const group = new THREE.Group();
    const swirl = new THREE.Points(vortexGeo, vortexMat);
    const core = sprite('#FFF8E0', 0.95, 1.1);
    core.position.z = -1.05;
    const disk = sprite('#E0B35C', 0.35, 2.4);
    disk.position.z = -0.5;
    group.add(sprite('#E0B35C', 0.2, 4), disk, swirl, core);
    return { group, tilt: quat(-0.55, 0.2), update: (T) => (swirl.rotation.z = T * 0.5) };
  });

  return {
    uTime,
    /** `radius` : rayon de la porte en unités de monde (taille des particules du vortex). */
    make: (kind: GateKind, radius: number): Gate => {
      if (kind === 'vortex') vortexMat.size = 0.065 * radius;
      return cache.get(kind)!();
    },
  };
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
