import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ACTIVE_SECTORS, PROJECTS, isProtostar } from '../data/projects';
import { SECTOR_BY_KEY, STAR_TYPES, type StarClass } from '../data/sectors';
import { buildBlackHole } from './blackHole';
import { BH, type OrbitEngine } from './engine';
import { buildStarGeometry, starMaterial } from './starfield';
import { beamTexture, discTexture, glowTexture, jetsTexture, spikesTexture } from './textures';

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

const NEBULAE: [number, number, number, number, string, number][] = [
  [-300, 20, -100, 300, '#862217', 0.2],
  [270, -30, 140, 260, '#862217', 0.2],
  [70, 60, -360, 240, '#788CBE', 0.14],
  [-70, -40, 360, 340, '#C4562E', 0.16],
];

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

    NEBULAE.forEach(([x, y, z, r, color, a]) => {
      const s = new THREE.Sprite(keep(spriteMaterial(glow, color, a)));
      s.position.set(x, y, z);
      s.scale.setScalar(r * 2);
      s.renderOrder = -2;
      root.add(s);
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
      return { star, halo, dot, extra, companion, cocoon, jets, planets, planetMat, orbits, orbitMat, target };
    });

    return { root, starMat, bh, flow, flowPos, flowCol, stars, disposables };
  }, [engine]);
}

function Scene({ engine }: { engine: OrbitEngine }) {
  const objects = useSceneObjects(engine);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const dpr = useThree((s) => s.viewport.dpr);

  useEffect(() => () => objects.disposables.forEach((d) => d.dispose()), [objects]);

  useFrame((state, dt) => {
    const { width, height } = state.size;
    engine.tick(dt, camera, width, height);
    const o = objects;
    o.starMat.uniforms.uFocal.value = engine.focal;
    o.starMat.uniforms.uDpr.value = dpr;

    const { filter, hovered, selected, reduced } = engine;
    // Mouvement réduit : le temps de la scène est figé (disque, pulsations, planètes immobiles).
    const T = reduced ? 0 : engine.time;
    const q = camera.quaternion;

    const du = o.bh.diskMat.uniforms;
    du.uTime.value = T;
    du.uFocal.value = engine.focal;
    du.uDpr.value = dpr;
    du.uDim.value = filter === 'all' ? 1 : 0.7;
    o.bh.sheetMat.uniforms.uTime.value = T;
    o.bh.sheetMat.uniforms.uDim.value = du.uDim.value;
    o.bh.shadow.quaternion.copy(q);
    o.bh.ring.visible = hovered === 'core' || engine.coreActive;

    o.flow.visible = !reduced;
    if (!reduced) {
      ACTIVE_SECTORS.forEach((s, si) => {
        const dim = filter !== 'all' && filter !== s.key;
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
