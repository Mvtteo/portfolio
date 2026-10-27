import * as THREE from 'three';
import type { GateKind } from './themes';

/*
 * Portes en 3D, construites en code (aucun fichier à charger). Chaque porte est modélisée à
 * l'échelle 1 (rayon ≈ 1) puis mise à l'échelle par StarMap ; elle se tourne doucement vers la
 * caméra avec un angle de trois-quarts propre à sa forme, pour que son volume se lise.
 *
 * blackhole : sphère d'ombre + disque d'accrétion incliné (masqué derrière la sphère) + anneau de photons
 * goldring  : anneau d'or fin, surface d'or liquide en tourbillon, cercles armillaires, poussière d'or
 * wormhole  : tunnel d'anneaux qui s'enfoncent en boucle + paroi en entonnoir striée
 * orb       : orbe de verre (Fresnel), nébuleuse intérieure en rotation, rubans de lumière en orbite
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

  // ---------- Anneau d'or (Data) ----------
  // Anneau fin et lisse, reflet qui en fait le tour ; surface d'or liquide en tourbillon lent ;
  // deux cercles armillaires inclinés qui tournent autour ; poussière d'or sur l'anneau.
  const goldTorus = keep(new THREE.TorusGeometry(1, 0.045, 24, 160));
  const goldTorusMat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uTime },
      vertexShader: LOCAL_VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vPos;
        void main() {
          float a = atan(vPos.y, vPos.x);
          float sweep = pow(0.5 + 0.5 * cos(a - uTime * 0.9), 10.0);
          vec3 c = mix(vec3(0.85, 0.52, 0.18), vec3(1.0, 0.86, 0.55), 0.5 + 0.5 * sin(a * 3.0)) * (0.9 + 1.4 * sweep);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    }),
  );
  const goldSurf = keep(new THREE.CircleGeometry(0.97, 128));
  const goldSurfMat = keep(
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
          // Tourbillon : l'angle se tord vers le centre, la matière s'y enfonce.
          float tw = a + (1.0 - r) * 3.2 + uTime * 0.35;
          float n = fbm(vec2(cos(tw), sin(tw)) * (1.6 + r * 2.2) + vec2(r * 3.0 - uTime * 0.4, 0.0));
          float veins = pow(1.0 - abs(n * 2.0 - 1.0), 5.0);
          vec3 deep = vec3(0.16, 0.07, 0.02);
          vec3 gold = vec3(1.0, 0.72, 0.32);
          vec3 c = mix(deep, gold, smoothstep(0.15, 1.0, r) * 0.55 + veins * 0.8);
          c += vec3(1.0, 0.9, 0.7) * exp(-r * 9.0) * 0.6;
          float edge = smoothstep(0.97, 0.88, r);
          gl_FragColor = vec4(c * edge, edge * 0.92);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const armTorus = keep(new THREE.TorusGeometry(1, 0.008, 8, 160));
  const armMat = keep(new THREE.MeshBasicMaterial({ color: '#FFD696', opacity: 0.55, ...additive }));
  const dustN = 260;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    const h = Math.sin(i * 91.7) * 43758.5453;
    const r = h - Math.floor(h);
    const a = (i / dustN) * Math.PI * 2 + r * 0.3;
    const rad = 1 + (r - 0.5) * 0.12;
    dustPos.set([Math.cos(a) * rad, Math.sin(a) * rad, (r - 0.5) * 0.12], i * 3);
  }
  const dustGeo = keep(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = keep(new THREE.PointsMaterial({ map: disc, color: '#FFE2A8', size: 0.03, sizeAttenuation: true, opacity: 0.9, ...additive }));
  cache.set('goldring', () => {
    const group = new THREE.Group();
    const torus = new THREE.Mesh(goldTorus, goldTorusMat);
    const surface = new THREE.Mesh(goldSurf, goldSurfMat);
    const dust = new THREE.Points(dustGeo, dustMat);
    const arms = [0, 1].map((k) => {
      const holder = new THREE.Group();
      const ring = new THREE.Mesh(armTorus, armMat);
      ring.scale.setScalar(1.22 + k * 0.12);
      const bead = sprite('#FFE2A8', 0.9, 0.22);
      bead.position.x = 1.22 + k * 0.12;
      holder.add(ring, bead);
      holder.rotation.set(k ? 1.1 : -0.9, k ? 0.5 : -0.4, 0);
      return holder;
    });
    group.add(sprite('#FFB25C', 0.2, 3.8), surface, torus, dust, ...arms);
    return {
      group,
      tilt: quat(-0.12, 0.42),
      update: (T) => {
        dust.rotation.z = T * 0.15;
        arms.forEach((h, k) => (h.rotation.z = T * (k ? -0.35 : 0.28)));
      },
    };
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

  // ---------- Orbe de passage (Web) ----------
  // Sphère de verre : liseré de Fresnel bleu glacier, nébuleuse intérieure qui tourne en 3D,
  // cœur lumineux ; deux rubans de lumière en orbite inclinée avec une perle chacun.
  const orbGeo = keep(new THREE.SphereGeometry(1, 64, 48));
  const orbMat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uTime },
      vertexShader: /* glsl */ `
        varying vec3 vObj;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vObj = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vObj;
        varying vec3 vN;
        varying vec3 vV;
        ${NOISE}
        void main() {
          float fr = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.6);
          vec3 p = vObj;
          float c = cos(uTime * 0.25), s = sin(uTime * 0.25);
          p.xz = mat2(c, -s, s, c) * p.xz;
          float neb = fbm(p.xy * 2.2 + p.z * 1.3 + vec2(uTime * 0.05, 0.0));
          float wisps = pow(neb, 2.2);
          float core = exp(-dot(vObj.xy, vObj.xy) * 3.5);
          vec3 col = vec3(0.75, 0.86, 1.0) * fr * 1.5 + vec3(0.18, 0.36, 0.85) * wisps * 1.2 + vec3(0.85, 0.93, 1.0) * core * 0.55;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      ...additive,
    }),
  );
  const ribbonGeo = keep(new THREE.TorusGeometry(1.35, 0.012, 8, 200));
  const ribbonMat = keep(new THREE.MeshBasicMaterial({ color: '#BFD4FF', opacity: 0.6, ...additive }));
  cache.set('orb', () => {
    const group = new THREE.Group();
    const orb = new THREE.Mesh(orbGeo, orbMat);
    const ribbons = [0, 1].map((k) => {
      const holder = new THREE.Group();
      const ring = new THREE.Mesh(ribbonGeo, ribbonMat);
      ring.scale.setScalar(1 + k * 0.12);
      const bead = sprite('#DCE8FF', 0.95, 0.28);
      bead.position.x = 1.35 * (1 + k * 0.12);
      holder.add(ring, bead);
      holder.rotation.set(k ? 1.25 : 0.35, k ? -0.4 : 0.6, k ? 0.3 : 0);
      return holder;
    });
    group.add(sprite('#4E7FD0', 0.24, 4.2), orb, sprite('#DCE8FF', 0.5, 1.1), ...ribbons);
    return {
      group,
      tilt: quat(0, 0.3),
      update: (T) => ribbons.forEach((h, k) => (h.rotation.z = T * (k ? -0.5 : 0.4))),
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
      if (kind === 'goldring') dustMat.size = 0.045 * radius;
      return cache.get(kind)!();
    },
  };
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
