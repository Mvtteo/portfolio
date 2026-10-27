import * as THREE from 'three';
import type { PlanetLook } from '../data/planets';
import type { StarType, StarClass } from '../data/sectors';

/*
 * Planètes (projets) et étoile centrale de chaque univers.
 * Une planète = sphère ombrée par l'étoile de son univers (terminateur, face nocturne à peine
 * visible), surface procédurale selon son type (bandes, continents + nuages, glace, lave),
 * atmosphère en liseré, anneaux pour certaines géantes, lunes = technologies.
 */

const NOISE3 = /* glsl */ `
  float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm3(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * n3(p); p = p * 2.02 + 1.7; a *= 0.5; }
    return v;
  }
`;

const PLANET_VERT = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vWorld;
  varying vec3 vN;
  void main() {
    vObj = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const PLANET_FRAG = /* glsl */ `
  uniform int uKind;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform vec3 uAtmo;
  uniform vec3 uSun;
  uniform float uSeed;
  uniform float uTime;
  uniform float uHover;
  varying vec3 vObj;
  varying vec3 vWorld;
  varying vec3 vN;
  ${NOISE3}
  void main() {
    vec3 p = normalize(vObj);
    vec3 q = p * 2.2 + uSeed;
    vec3 col;
    vec3 glow = vec3(0.0);
    if (uKind == 0) {
      // Géante gazeuse : bandes de latitude déformées par la turbulence, une tempête.
      float t = fbm3(q * 1.3);
      float b = sin(p.y * 14.0 + t * 5.0);
      col = mix(uA, uB, smoothstep(-0.6, 0.6, b));
      col = mix(col, uC, smoothstep(0.55, 0.95, sin(p.y * 31.0 + t * 9.0)) * 0.55);
      float storm = smoothstep(0.16, 0.0, length(vec2(atan(p.z, p.x) - 1.2, (p.y + 0.25) * 2.6)));
      col = mix(col, uC * 1.05, storm * 0.8);
    } else if (uKind == 1) {
      // Tellurique : relief fbm, plateaux clairs, bassins sombres.
      float h = fbm3(q * 1.6);
      col = mix(uB, uA, smoothstep(0.3, 0.6, h));
      col = mix(col, uC, smoothstep(0.62, 0.75, h));
      col *= 0.85 + 0.3 * n3(q * 9.0);
    } else if (uKind == 2) {
      // Océan : continents, calottes, nuages qui dérivent.
      float h = fbm3(q * 1.4);
      col = mix(uA, uA * 1.35, smoothstep(0.3, 0.5, h));
      col = mix(col, uB, smoothstep(0.5, 0.53, h));
      col = mix(col, uC, smoothstep(0.78, 0.86, abs(p.y)));
      float cl = fbm3(q * 2.3 + vec3(uTime * 0.03, 0.0, 0.0));
      col = mix(col, uC, smoothstep(0.55, 0.75, cl) * 0.85);
    } else if (uKind == 3) {
      // Glace : dégradé lisse, bandes douces, fissures sombres.
      float t = fbm3(q);
      col = mix(uB, uA, 0.5 + 0.5 * sin(p.y * 6.0 + t * 3.0));
      col = mix(col, uC, smoothstep(0.55, 0.8, t));
      float crack = pow(1.0 - abs(fbm3(q * 2.5) * 2.0 - 1.0), 18.0);
      col = mix(col, uB * 0.6, crack * 0.7);
    } else if (uKind == 4) {
      // Lave : croûte sombre, fissures incandescentes (émissives, visibles côté nuit).
      float t = fbm3(q * 1.5);
      col = mix(uB, uA, t);
      float crack = pow(1.0 - abs(fbm3(q * 2.2 + vec3(0.0, uTime * 0.02, 0.0)) * 2.0 - 1.0), 10.0);
      glow = uC * crack * 1.6;
    } else {
      // Proto-planète : poussière brune voilée, sans relief net.
      float t = fbm3(q * 1.2 + vec3(uTime * 0.05));
      col = mix(uB, uA, t) * 0.8;
    }
    vec3 N = normalize(vN);
    vec3 L = normalize(uSun - vWorld);
    vec3 V = normalize(cameraPosition - vWorld);
    // Éclairage enveloppant : la face nocturne reste lisible (planètes vues à contre-jour).
    float d = smoothstep(-0.35, 1.0, dot(N, L));
    float lit = 0.2 + 1.0 * d;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 atmo = uAtmo * rim * (0.25 + 0.9 * smoothstep(-0.25, 0.6, dot(N, L))) * (1.0 + uHover * 1.2);
    gl_FragColor = vec4(col * lit + glow + atmo, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  uniform vec3 uC;
  uniform float uInner;
  uniform float uOuter;
  varying vec3 vObj;
  ${NOISE3}
  void main() {
    float r = length(vObj.xy);
    float t = (r - uInner) / (uOuter - uInner);
    float bands = 0.55 + 0.45 * sin(t * 48.0) * sin(t * 17.0 + 1.3);
    float a = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.85, 1.0, t)) * bands;
    a *= 0.35 + 0.4 * n3(vec3(r * 3.0, 0.0, 0.0));
    gl_FragColor = vec4(uC * 0.95, a * 0.8);
  }
`;
const RING_VERT = /* glsl */ `
  varying vec3 vObj;
  void main() {
    vObj = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const KIND_INDEX = { gas: 0, rock: 1, ocean: 2, ice: 3, lava: 4, proto: 5 } as const;

type Keep = <T extends { dispose(): void }>(o: T) => T;

export interface PlanetObj {
  group: THREE.Group;
  body: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  halo: THREE.Sprite;
  dust: THREE.Sprite | null;
  moons: THREE.Mesh[];
  orbits: THREE.LineLoop[];
  orbitMat: THREE.LineBasicMaterial;
  target: THREE.LineLoop;
  look: PlanetLook;
  sector: string;
}

export function planetKit(keep: Keep, glow: THREE.Texture) {
  const uTime = { value: 0 };
  const sphere = keep(new THREE.SphereGeometry(1, 48, 32));
  const moonGeo = keep(new THREE.SphereGeometry(1, 16, 12));
  const unitCircle = keep(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2), Math.sin((i / 64) * Math.PI * 2), 0))));
  const orbitCircle = keep(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 72 }, (_, i) => new THREE.Vector3(Math.cos((i / 72) * Math.PI * 2), 0, Math.sin((i / 72) * Math.PI * 2)))));

  const build = (look: PlanetLook, pos: [number, number, number], sun: [number, number, number], atmo: string, sector: string, moonCount: number): PlanetObj => {
    const group = new THREE.Group();
    group.position.set(...pos);
    const R = look.radius;
    const mat = keep(
      new THREE.ShaderMaterial({
        uniforms: {
          uKind: { value: KIND_INDEX[look.kind] },
          uA: { value: new THREE.Color(look.colors[0]) },
          uB: { value: new THREE.Color(look.colors[1]) },
          uC: { value: new THREE.Color(look.colors[2]) },
          uAtmo: { value: new THREE.Color(atmo) },
          uSun: { value: new THREE.Vector3(...sun) },
          uSeed: { value: look.seed },
          uTime,
          uHover: { value: 0 },
        },
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
      }),
    );
    const body = new THREE.Mesh(sphere, mat);
    body.scale.setScalar(R);
    const axis = new THREE.Group();
    axis.rotation.z = look.tilt;
    axis.add(body);

    // Halo discret : la planète reste repérable de loin.
    const halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: atmo, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending })));
    halo.scale.setScalar(R * 4.5);
    group.add(halo, axis);

    if (look.ring) {
      const inner = R * 1.35;
      const outer = R * 2.3;
      const ringMat = keep(
        new THREE.ShaderMaterial({
          uniforms: { uC: { value: new THREE.Color(look.colors[2]) }, uInner: { value: inner }, uOuter: { value: outer } },
          vertexShader: RING_VERT,
          fragmentShader: RING_FRAG,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      const ring = new THREE.Mesh(keep(new THREE.RingGeometry(inner, outer, 128, 1)), ringMat);
      ring.rotation.x = -Math.PI / 2 + 0.18;
      axis.add(ring);
    }

    let dust: THREE.Sprite | null = null;
    if (look.kind === 'proto') {
      dust = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: '#C98A6A', transparent: true, opacity: 0.45, depthWrite: false })));
      dust.scale.setScalar(R * 3.2);
      group.add(dust);
    }

    // Lunes = technologies (4 au plus), ombrées par la même étoile.
    const moonMat = keep(
      new THREE.ShaderMaterial({
        uniforms: { uKind: { value: 1 }, uA: { value: new THREE.Color('#B7AFA6') }, uB: { value: new THREE.Color('#5E5650') }, uC: { value: new THREE.Color('#E8E2DA') }, uAtmo: { value: new THREE.Color('#000000') }, uSun: { value: new THREE.Vector3(...sun) }, uSeed: { value: look.seed + 3 }, uTime, uHover: { value: 0 } },
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
      }),
    );
    const moons = Array.from({ length: moonCount }, (_, j) => {
      const m = new THREE.Mesh(moonGeo, moonMat);
      m.scale.setScalar(1.6 + (j % 2) * 0.6);
      group.add(m);
      return m;
    });
    const orbitMat = keep(new THREE.LineBasicMaterial({ color: '#FEF8F1', transparent: true, opacity: 0.16, depthWrite: false }));
    const orbits = moons.map((_, j) => {
      const l = new THREE.LineLoop(orbitCircle, orbitMat);
      l.scale.setScalar(moonOrbit(R, j));
      l.rotation.x = 0.12;
      l.visible = false;
      group.add(l);
      return l;
    });

    const target = new THREE.LineLoop(unitCircle, keep(new THREE.LineBasicMaterial({ color: '#F29A5C', transparent: true, depthWrite: false })));
    target.visible = false;
    group.add(target);

    return { group, body, mat, halo, dust, moons, orbits, orbitMat, target, look, sector };
  };

  return { uTime, build };
}

export const moonOrbit = (R: number, j: number) => R * 1.7 + j * R * 0.55;

/** Étoile centrale d'un univers : son type est celui du secteur (même icône que dans le HUD). */
export function buildSun(star: StarClass, type: StarType, keep: Keep, tex: { glow: THREE.Texture; disc: THREE.Texture; spikes: THREE.Texture; beam: THREE.Texture }) {
  const group = new THREE.Group();
  const add = (map: THREE.Texture, color: string, opacity: number, size: number, additive = true) => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map, color, opacity, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })));
    s.scale.setScalar(size);
    group.add(s);
    return s;
  };
  const wide = add(tex.glow, type.halo, 0.12, 900);
  const halo = add(tex.glow, type.halo, 0.55, 260);
  const extra = star === 'A' ? add(tex.spikes, type.halo, 0.7, 340) : star === 'pulsar' ? add(tex.beam, type.halo, 0.6, 520) : null;
  const core = add(tex.disc, type.core, 1, 46, false);
  const corona = add(tex.glow, '#FFFFFF', 0.6, 90);
  return {
    group,
    update: (T: number) => {
      if (star === 'pulsar' && extra) extra.material.rotation = T * 1.2;
      if (star === 'cepheid') {
        const f = T / 3.2 - Math.floor(T / 3.2);
        const L = f < 0.25 ? f / 0.25 : 1 - (f - 0.25) / 0.75;
        halo.scale.setScalar(260 * (0.85 + 0.3 * L));
        corona.material.opacity = 0.45 + 0.35 * L;
      }
      wide.material.opacity = 0.12;
      core.material.opacity = 1;
    },
  };
}
