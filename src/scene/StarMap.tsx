import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ACTIVE_SECTORS, PROJECTS, isProtostar } from '../data/projects';
import { SECTOR_BY_KEY, STAR_TYPES, type StarClass, type UniverseKey } from '../data/sectors';
import { buildBlackHole } from './blackHole';
import { BH, portalIndex, type OrbitEngine } from './engine';
import { buildDecor, type Decor } from './decor';
import { originOf, PORTALS, type Portal } from './portals';
import { buildStarGeometry, starMaterial } from './starfield';
import { beamTexture, discTexture, gateRippleTexture, glowTexture, jetsTexture, spikesTexture } from './textures';
import { THEMES, type GateKind } from './themes';

/*
 * Scène WebGL de la carte stellaire. Rien n'est reconstruit à la sélection : un seul useFrame
 * fait avancer la caméra (engine.tick) puis met à jour tailles, couleurs et opacités en place.
 * Les tailles d'étoile sont en px écran (÷ k = px par unité à leur profondeur) ; orbites,
 * compagnon binaire et trou noir sont en unités de monde.
 */

const CREAM = new THREE.Color('#FEF8F1');
const SIGNAL = new THREE.Color('#F29A5C');
const PEACH = new THREE.Color('#FFC89A');

/** Couleur de fond = clear color : espace quasi noir, pour que le disque et les étoiles portent la couleur. */
export const SPACE = '#0E0E12';

/** Couche d'une porte : sprite, taille de base (l × h, unités de monde), rotation et respiration. */
interface GateLayer {
  s: THREE.Sprite;
  w: number;
  h: number;
  spin: number;
  breathe: number;
}

const PARTICLES = 4;
const MAX_PLANETS = 4;
const ORBIT_R = (j: number) => 11 + j * 6.5;

function spriteMaterial(map: THREE.Texture, color: THREE.ColorRepresentation = CREAM, opacity = 1, additive = false) {
  return new THREE.SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function circlePoints(n: number, tilt = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return tilt ? new THREE.Vector3(Math.cos(a), Math.sin(a) * tilt, Math.sin(a)) : new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
  });
}

/** Courbe de lumière d'une céphéide : montée rapide (25 %), descente lente. 0 → 1. */
function cepheidCurve(t: number) {
  const f = t - Math.floor(t);
  return f < 0.25 ? f / 0.25 : 1 - (f - 0.25) / 0.75;
}

interface StarObj {
  star: StarClass;
  group: THREE.Group;
  sector: string;
  halo: THREE.Sprite;
  dot: THREE.Sprite;
  extra: THREE.Sprite | null;
  companion: THREE.Sprite | null;
  cocoon: THREE.Sprite | null;
  jets: THREE.Sprite | null;
  planets: THREE.Sprite[];
  planetMat: THREE.SpriteMaterial;
  orbits: THREE.LineLoop[];
  orbitMat: THREE.LineBasicMaterial;
  target: THREE.LineLoop;
}

function useSceneObjects(engine: OrbitEngine) {
  return useMemo(() => {
    const root = new THREE.Group();
    const disposables: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(o: T) => {
      disposables.push(o);
      return o;
    };

    const glow = keep(glowTexture());
    const disc = keep(discTexture());
    const spikes = keep(spikesTexture());
    const beam = keep(beamTexture());
    const jetsTex = keep(jetsTexture());
    const cocoonTex = keep(
      glowTexture([
        [0, 'rgba(196,86,46,.34)'],
        [0.6, 'rgba(134,34,23,.14)'],
        [1, 'rgba(134,34,23,0)'],
      ]),
    );

    // Une nappe de nébuleuses par univers (couleurs du thème) : seule celle de l'univers affiché est visible.
    const nebulae = new Map<UniverseKey, THREE.Group>();
    const universes: UniverseKey[] = ['hub', ...ACTIVE_SECTORS.map((sec) => sec.key)];
    universes.forEach((u) => {
      const grp = new THREE.Group();
      grp.position.set(...originOf(u));
      THEMES[u].nebulae.forEach(([x, y, z, r, color, a]) => {
        const s = new THREE.Sprite(keep(spriteMaterial(glow, color, a)));
        s.position.set(x, y, z);
        s.scale.setScalar(r * 2);
        s.renderOrder = -2;
        grp.add(s);
      });
      nebulae.set(u, grp);
      root.add(grp);
    });

    // Décor propre à chaque univers de secteur (ceinture, réseau, grille, gyroscope).
    const decors = new Map<UniverseKey, Decor>();
    ACTIVE_SECTORS.forEach((sec) => {
      const [ox, oy, oz] = sec.origin;
      const anchors = PROJECTS.filter((p) => p.sector === sec.key).map((p) => new THREE.Vector3(p.pos[0] - ox, p.pos[1] - oy, p.pos[2] - oz));
      const d = buildDecor(THEMES[sec.key].decor, { mobile: engine.cfg.mobile, keep, disc, glow, anchors });
      if (!d) return;
      d.group.position.set(ox, oy, oz);
      decors.set(sec.key, d);
      root.add(d.group);
    });

    // Étoiles décoratives : jamais interceptées par la sélection (le hit-test ne connaît que les projets).
    const starGeo = keep(buildStarGeometry(engine.cfg.mobile ? 900 : 1800));
    const starMat = keep(starMaterial(engine.cfg.starScale, engine.cfg.starMax));
    const field = new THREE.Points(starGeo, starMat);
    field.renderOrder = -1;
    root.add(field);

    const bh = buildBlackHole(engine.cfg.mobile ? 2200 : 4200, keep);
    root.add(bh.group);

    // Flux : matière arrachée aux secteurs qui spirale vers le disque, 4 particules par secteur.
    const flowPos = new Float32Array(ACTIVE_SECTORS.length * PARTICLES * 3);
    const flowCol = new Float32Array(ACTIVE_SECTORS.length * PARTICLES * 4);
    const flowGeo = keep(new THREE.BufferGeometry());
    flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
    flowGeo.setAttribute('color', new THREE.BufferAttribute(flowCol, 4));
    const flow = new THREE.Points(
      flowGeo,
      keep(new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false })),
    );
    flow.frustumCulled = false;
    root.add(flow);

    const unitCircle = keep(new THREE.BufferGeometry().setFromPoints(circlePoints(48)));
    const orbitGeos = Array.from({ length: MAX_PLANETS }, (_, j) =>
      keep(new THREE.BufferGeometry().setFromPoints(circlePoints(56, 0.12).map((v) => v.multiplyScalar(ORBIT_R(j))))),
    );
    // Portes : une image par forme (public/gates/*.webp, générées puis détourées), animée ici :
    // rotation, respiration, voile procédural. Chaque image n'apparaît qu'une fois chargée.
    const loader = new THREE.TextureLoader();
    const waiting = new Map<GateKind, THREE.SpriteMaterial[]>();
    const loaded = new Set<GateKind>();
    const gateTex = Object.fromEntries(
      (['blackhole', 'stargate', 'wormhole', 'rift', 'vortex'] as GateKind[]).map((kind) => {
        const t = keep(
          loader.load(`${import.meta.env.BASE_URL}gates/${kind}.webp`, () => {
            loaded.add(kind);
            waiting.get(kind)?.forEach((m) => (m.visible = true));
          }),
        );
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return [kind, t];
      }),
    ) as Record<GateKind, THREE.Texture>;
    const ripple = keep(gateRippleTexture());
    const gateLayers = (pt: Portal): GateLayer[] => {
      const R = pt.radius;
      const L = (map: THREE.Texture, color: string, opacity: number, additive: boolean, w: number, h = w, spin = 0, breathe = 0): GateLayer => ({
        s: new THREE.Sprite(keep(spriteMaterial(map, color, opacity, additive))),
        w,
        h,
        spin,
        breathe,
      });
      const image = (w: number, spin = 0, breathe = 0.015) => {
        const l = L(gateTex[pt.gate], '#ffffff', 1, false, w, w, spin, breathe);
        if (!loaded.has(pt.gate)) {
          l.s.material.visible = false;
          waiting.set(pt.gate, [...(waiting.get(pt.gate) ?? []), l.s.material]);
        }
        return l;
      };
      switch (pt.gate) {
        case 'blackhole':
          return [image(R * 3.6)];
        case 'stargate':
          // Horizon animé posé sur l'image : ondes lentes dans l'anneau.
          return [image(R * 3.2), L(ripple, pt.color, 0.22, true, R * 2.1, R * 2.1, 0.2, 0.05)];
        case 'wormhole':
          return [image(R * 3.3, -0.18), L(glow, '#ffffff', 0.35, true, R * 0.9, R * 0.9, 0, 0.2)];
        case 'rift':
          return [image(R * 4), L(glow, '#BFD4FF', 0.3, true, R * 0.9, R * 2.6, 0, 0.25)];
        case 'vortex':
        default:
          return [image(R * 3.3, -0.45), L(glow, '#FFF2BF', 0.35, true, R * 0.8, R * 0.8, 0, 0.2)];
      }
    };
    const portals = PORTALS.map((pt) => {
      const g = new THREE.Group();
      g.position.set(...pt.pos);
      const tall = pt.gate === 'rift';
      const halo = new THREE.Sprite(keep(spriteMaterial(glow, pt.color, 0.22, true)));
      halo.scale.set(pt.radius * (tall ? 3.2 : 5), pt.radius * (tall ? 6 : 5), 1);
      const layers = gateLayers(pt);
      g.add(halo, ...layers.map((l) => l.s));
      root.add(g);
      return { g, halo, layers, from: pt.from };
    });

    const stars: StarObj[] = PROJECTS.map((p, i) => {
      const star = SECTOR_BY_KEY[p.sector].star;
      const type = STAR_TYPES[star];
      const proto = isProtostar(p);
      const g = new THREE.Group();
      g.position.set(...p.pos);

      let cocoon: THREE.Sprite | null = null;
      let jets: THREE.Sprite | null = null;
      if (proto) {
        cocoon = new THREE.Sprite(keep(spriteMaterial(cocoonTex, '#ffffff', 1, true)));
        jets = new THREE.Sprite(keep(spriteMaterial(jetsTex, '#FFD9B0', 0.4, true)));
        g.add(cocoon, jets);
      }
      const halo = new THREE.Sprite(keep(spriteMaterial(glow, type.halo, 0.5, true)));
      g.add(halo);

      let extra: THREE.Sprite | null = null;
      if (star === 'A') extra = new THREE.Sprite(keep(spriteMaterial(spikes, type.halo, 0.75, true)));
      if (star === 'pulsar') {
        extra = new THREE.Sprite(keep(spriteMaterial(beam, type.halo, 0.6, true)));
        extra.material.rotation = i * 1.3;
      }
      if (extra) g.add(extra);

      const dot = new THREE.Sprite(keep(spriteMaterial(disc, type.core)));
      g.add(dot);
      let companion: THREE.Sprite | null = null;
      if (star === 'binary') {
        companion = new THREE.Sprite(keep(spriteMaterial(disc, '#FFE0C8')));
        g.add(companion);
      }

      // Planètes = technologies (4 au plus), orbites visibles de près, au survol ou à la sélection.
      const planetMat = keep(spriteMaterial(disc, CREAM, 0.85));
      const planets = p.tech.slice(0, MAX_PLANETS).map(() => {
        const s = new THREE.Sprite(planetMat);
        g.add(s);
        return s;
      });
      const orbitMat = keep(new THREE.LineBasicMaterial({ color: CREAM, transparent: true, opacity: 0.16, depthWrite: false }));
      const orbits = planets.map((_, j) => {
        const l = new THREE.LineLoop(orbitGeos[j], orbitMat);
        l.visible = false;
        g.add(l);
        return l;
      });

      const target = new THREE.LineLoop(unitCircle, keep(new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, depthWrite: false })));
      target.visible = false;
      g.add(target);

      root.add(g);
      return { star, group: g, sector: p.sector, halo, dot, extra, companion, cocoon, jets, planets, planetMat, orbits, orbitMat, target };
    });

    return { root, field, nebulae, decors, portals, starMat, bh, flow, flowPos, flowCol, stars, disposables };
  }, [engine]);
}

function Scene({ engine }: { engine: OrbitEngine }) {
  const objects = useSceneObjects(engine);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const dpr = useThree((s) => s.viewport.dpr);
  const lastUniverse = useRef<UniverseKey | null>(null);

  useEffect(() => () => objects.disposables.forEach((d) => d.dispose()), [objects]);

  useFrame((state, dt) => {
    const { width, height } = state.size;
    engine.tick(dt, camera, width, height);
    const o = objects;
    o.starMat.uniforms.uFocal.value = engine.focal;
    o.starMat.uniforms.uDpr.value = dpr;

    const { hovered, selected, reduced, universe } = engine;
    const hub = universe === 'hub';
    // Mouvement réduit : le temps de la scène est figé (disque, pulsations, planètes immobiles).
    const T = reduced ? 0 : engine.time;
    const q = camera.quaternion;

    const du = o.bh.diskMat.uniforms;
    du.uTime.value = T;
    du.uFocal.value = engine.focal;
    du.uDpr.value = dpr;
    du.uDim.value = 1;
    o.bh.group.visible = hub;
    const theme = THEMES[universe];
    if (lastUniverse.current !== universe) {
      lastUniverse.current = universe;
      state.gl.setClearColor(theme.clear, 1);
    }
    o.nebulae.forEach((g, u) => (g.visible = u === universe));
    o.decors.forEach((d, u) => {
      d.group.visible = u === universe;
      if (d.group.visible) d.update(T);
    });
    o.field.position.set(...originOf(universe));
    o.field.rotation.set(theme.field.tilt, theme.field.rot, 0);
    o.field.scale.setScalar(theme.field.scale);

    const hp = portalIndex(hovered);
    o.portals.forEach((pt, i) => {
      pt.g.visible = pt.from === universe;
      if (!pt.g.visible) return;
      const grow = hp === i ? 1.12 : 1;
      pt.layers.forEach((l, j) => {
        const b = 1 + (l.breathe ? Math.sin(T * 2.2 + i + j) * l.breathe : Math.sin(T * 1.6 + i) * 0.02);
        l.s.scale.set(l.w * grow * b, l.h * grow * b, 1);
        if (l.spin) l.s.material.rotation = T * l.spin + i;
      });
      pt.halo.material.opacity = hp === i ? 0.36 : 0.22;
    });
    o.bh.sheetMat.uniforms.uTime.value = T;
    o.bh.sheetMat.uniforms.uDim.value = du.uDim.value;
    o.bh.shadow.quaternion.copy(q);
    o.bh.ring.visible = hovered === 'core' || engine.coreActive;

    o.flow.visible = !reduced && hub;
    if (!reduced && hub) {
      PORTALS.filter((pt) => pt.from === 'hub').forEach((pt, si) => {
        const s = { center: pt.pos };
        const dim = false;
        const len = Math.hypot(...s.center);
        const edge = BH.diskOut / len;
        for (let m = 0; m < PARTICLES; m++) {
          const u = (T * 0.06 + m / PARTICLES + si * 0.13) % 1;
          // De 1 (secteur) au bord du disque, avec une légère dérive tangentielle (sens du disque).
          const f = 1 - u * (1 - edge);
          const swirl = u * u * 0.5;
          const x = s.center[0] * f;
          const z = s.center[2] * f;
          const c = Math.cos(swirl);
          const sn = Math.sin(swirl);
          const n = si * PARTICLES + m;
          o.flowPos.set([x * c - z * sn, s.center[1] * f * (1 - u), x * sn + z * c], n * 3);
          o.flowCol.set([PEACH.r, PEACH.g, PEACH.b, (dim ? 0.2 : 0.75) * Math.min(1, (1 - u) * 4)], n * 4);
        }
      });
      o.flow.geometry.attributes.position.needsUpdate = true;
      o.flow.geometry.attributes.color.needsUpdate = true;
    }

    o.stars.forEach((st, i) => {
      st.group.visible = st.sector === universe;
      if (!st.group.visible) return;
      const p = engine.stars[i];
      const on = hovered === i || selected === i;
      const fade = p.dim ? 0.22 : 1;
      const k = p.k || 1;
      const b = p.base;
      const px = (v: number) => (v * 2) / k;

      let haloR = on ? 28 : 17;
      let haloA = on ? 0.55 : 0.34;
      let coreA = 1;
      if (st.star === 'cepheid') {
        const L = cepheidCurve(T / 3.2 + i * 0.37);
        haloR *= 0.82 + 0.36 * L;
        haloA *= 0.7 + 0.45 * L;
      }
      if (st.star === 'pulsar' && st.extra) {
        // Rotation rapide + scintillement quand un faisceau passe sur l'axe de visée.
        const phase = T * 2.4 + i * 1.3;
        st.extra.material.rotation = phase;
        st.extra.scale.setScalar(px(22 * b));
        st.extra.material.opacity = (on ? 0.6 : 0.38) * fade;
        coreA = 0.7 + 0.3 * Math.pow(Math.abs(Math.cos(phase)), 12);
      }
      if (st.star === 'A' && st.extra) {
        st.extra.scale.setScalar(px(24 * b));
        st.extra.material.opacity = (on ? 0.8 : 0.55) * fade;
      }

      st.halo.scale.setScalar(px(haloR * b));
      st.halo.material.opacity = haloA * fade;

      if (st.cocoon && st.jets) {
        st.cocoon.scale.setScalar(px(34 * b));
        st.cocoon.material.opacity = fade;
        st.jets.scale.setScalar(px(34 * b));
        st.jets.material.opacity = 0.4 * fade;
      }

      if (st.companion) {
        const a = T * 0.8 + i;
        st.dot.position.set(Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75);
        st.companion.position.set(-Math.cos(a) * 5, 0, -Math.sin(a) * 5);
        st.dot.scale.setScalar(px(2.8 * b));
        st.companion.scale.setScalar(px(1.7 * b));
        st.companion.material.opacity = fade;
      } else st.dot.scale.setScalar(px(2.6 * b));
      st.dot.material.opacity = coreA * fade;

      st.planets.forEach((pl, j) => {
        const R = ORBIT_R(j);
        const a = T * (0.9 / (j + 1)) + j * 2.1 + i;
        pl.position.set(Math.cos(a) * R, Math.sin(a) * R * 0.12, Math.sin(a) * R);
        pl.scale.setScalar(px(Math.max(0.8, 1.3 * k)));
      });
      st.planetMat.opacity = 0.85 * fade;
      const showOrbits = on || k > 2.2;
      st.orbits.forEach((l) => (l.visible = showOrbits));
      st.orbitMat.opacity = (on ? 0.28 : 0.16) * fade;

      st.target.visible = on;
      if (on) {
        st.target.quaternion.copy(q);
        st.target.scale.setScalar((14 * b) / k);
      }
    });
  });

  return <primitive object={objects.root} />;
}

interface Props {
  engine: OrbitEngine;
  label: string;
}

/** Canvas plein cadre. `role="img"` : la scène est doublée au clavier par la recherche, les secteurs et la liste. */
export default function StarMap({ engine, label }: Props) {
  return (
    <Canvas
      role="img"
      aria-label={label}
      dpr={[1, engine.cfg.mobile ? 1.5 : 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 47, near: 1, far: 6000, position: [0, 200, 640] }}
      onCreated={({ gl }) => gl.setClearColor(SPACE, 1)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene engine={engine} />
    </Canvas>
  );
}
