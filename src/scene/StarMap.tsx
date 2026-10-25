import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ACTIVE_SECTORS, PROJECTS } from '../data/projects';
import type { Mark } from '../data/sectors';
import type { OrbitEngine } from './engine';
import { buildStarGeometry, starMaterial } from './starfield';
import { discTexture, glowTexture } from './textures';

/*
 * Scène WebGL de la carte stellaire. Rien n'est reconstruit à la sélection : un seul useFrame
 * fait avancer la caméra (engine.tick) puis met à jour tailles, couleurs et opacités en place.
 */

const CREAM = new THREE.Color('#FEF8F1');
const SIGNAL = new THREE.Color('#D9442F');
const RED_LIGHT = new THREE.Color('#F08A72');

const NEBULAE: [number, number, number, number, string][] = [
  [-220, 20, -60, 260, '#862217'],
  [200, -30, 80, 230, '#862217'],
  [40, 120, -220, 200, '#A8A3A0'],
  [-230, -150, 360, 240, '#862217'],
];

const RING_R = 95;
const DOT_STEP = 4;
const PARTICLES = 4;

/** Contour unitaire de chaque marque (y vers le haut), dessiné en lignes de 1 px orientées caméra. */
function markPoints(mark: Mark | 'ring'): THREE.Vector3[] {
  const poly = (pts: [number, number][]) => pts.map(([x, y]) => new THREE.Vector3(x, y, 0));
  switch (mark) {
    case 'square':
      return poly([[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]]);
    case 'diamond':
      return poly([[0, 1], [1, 0], [0, -1], [-1, 0]]);
    case 'hexagon':
      return poly(Array.from({ length: 6 }, (_, i) => [Math.cos(Math.PI / 2 + (i * Math.PI) / 3), Math.sin(Math.PI / 2 + (i * Math.PI) / 3)]));
    case 'triangle':
      return poly([[0, 1], [0.95, -0.65], [-0.95, -0.65]]);
    default:
      return Array.from({ length: 48 }, (_, i) => new THREE.Vector3(Math.cos((i / 48) * Math.PI * 2), Math.sin((i / 48) * Math.PI * 2), 0));
  }
}

function dottedRing(cx: number, cy: number, cz: number) {
  const n = Math.round((2 * Math.PI * RING_R) / DOT_STEP);
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.set([cx + Math.cos(a) * RING_R, cy, cz + Math.sin(a) * RING_R], i * 3);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3));
}

function dottedLink(to: [number, number, number]) {
  const len = Math.hypot(...to);
  const n = Math.round(len / DOT_STEP);
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pts.set([(to[0] * i) / n, (to[1] * i) / n, (to[2] * i) / n], i * 3);
  return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3));
}

function dotsMaterial(opacity: number) {
  return new THREE.PointsMaterial({ color: CREAM, size: 1.4, sizeAttenuation: false, transparent: true, opacity, depthWrite: false });
}

function spriteMaterial(map: THREE.Texture, color = CREAM, opacity = 1) {
  return new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false });
}

function lineLoop(mark: Mark | 'ring', opacity: number) {
  const geo = new THREE.BufferGeometry().setFromPoints(markPoints(mark));
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: CREAM, transparent: true, opacity, depthWrite: false }));
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

    // Nébuleuses : 4 nappes à 22 % maximum.
    NEBULAE.forEach(([x, y, z, r, color]) => {
      const s = new THREE.Sprite(keep(spriteMaterial(glow, new THREE.Color(color), 0.22)));
      s.position.set(x, y, z);
      s.scale.setScalar(r * 2);
      s.renderOrder = -2;
      root.add(s);
    });

    // Étoiles décoratives : jamais interceptées par la sélection (le hit-test ne connaît que les projets).
    const starGeo = keep(buildStarGeometry(engine.cfg.mobile ? 900 : 1600));
    const starMat = keep(starMaterial(engine.cfg.starScale, engine.cfg.starMax));
    const field = new THREE.Points(starGeo, starMat);
    field.renderOrder = -1;
    root.add(field);

    // Secteurs : anneau pointillé r=95 dans le plan XZ + lien pointillé noyau → secteur. Aucun lien entre projets.
    const guides = ACTIVE_SECTORS.map((s) => {
      const ring = new THREE.Points(keep(dottedRing(...s.center)), keep(dotsMaterial(0.18)));
      const link = new THREE.Points(keep(dottedLink(s.center)), keep(dotsMaterial(0.22)));
      root.add(ring, link);
      return { key: s.key, ring, link };
    });

    // Flux de données : 4 particules par lien.
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

    // Noyau = profil.
    const coreGlow = new THREE.Sprite(
      keep(spriteMaterial(keep(glowTexture([[0, 'rgba(217,68,47,.55)'], [0.35, 'rgba(134,34,23,.25)'], [1, 'rgba(134,34,23,0)']])))),
    );
    const coreDot = new THREE.Sprite(keep(spriteMaterial(disc)));
    const coreRing = lineLoop('ring', 0.45);
    keep(coreRing.geometry);
    keep(coreRing.material as THREE.Material);
    root.add(coreGlow, coreDot, coreRing);

    // Étoiles projet : halo + point crème + marque de secteur (+ un second trait au survol / à la sélection).
    const stars = PROJECTS.map((p) => {
      const sector = ACTIVE_SECTORS.find((s) => s.key === p.sector)!;
      const g = new THREE.Group();
      g.position.set(...p.pos);
      const halo = new THREE.Sprite(keep(spriteMaterial(glow, CREAM, 0.38)));
      const dot = new THREE.Sprite(keep(spriteMaterial(disc)));
      const mark = lineLoop(sector.mark, 0.55);
      const mark2 = lineLoop(sector.mark, 1);
      [mark, mark2].forEach((l) => {
        keep(l.geometry);
        keep(l.material as THREE.Material);
      });
      g.add(halo, dot, mark, mark2);
      root.add(g);
      return { halo, dot, mark, mark2 };
    });

    return { root, starMat, guides, flow, flowPos, flowCol, coreGlow, coreDot, coreRing, stars, disposables };
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

    const { filter, hovered, selected, reduced, time } = engine;
    const q = camera.quaternion;

    o.guides.forEach((gd) => {
      const dim = filter !== 'all' && filter !== gd.key;
      (gd.ring.material as THREE.PointsMaterial).opacity = dim ? 0.06 : 0.18;
      (gd.link.material as THREE.PointsMaterial).opacity = dim ? 0.08 : 0.22;
    });

    o.flow.visible = !reduced;
    if (!reduced) {
      ACTIVE_SECTORS.forEach((s, si) => {
        const dim = filter !== 'all' && filter !== s.key;
        for (let m = 0; m < PARTICLES; m++) {
          const u = (time * 0.06 + m / PARTICLES + si * 0.13) % 1;
          const n = si * PARTICLES + m;
          o.flowPos.set([s.center[0] * u, s.center[1] * u, s.center[2] * u], n * 3);
          o.flowCol.set([RED_LIGHT.r, RED_LIGHT.g, RED_LIGHT.b, dim ? 0.2 : 0.75], n * 4);
        }
      });
      o.flow.geometry.attributes.position.needsUpdate = true;
      o.flow.geometry.attributes.color.needsUpdate = true;
    }

    // Noyau : tailles en px converties en unités de monde à sa profondeur.
    const core = engine.core;
    if (core.visible) {
      const r = 26 * core.k * 0.9 + (engine.cfg.mobile ? 5 : 6);
      o.coreGlow.scale.setScalar((r * 2.4 * 2) / core.k);
      o.coreDot.scale.setScalar((Math.max(3, r * 0.22) * 2) / core.k);
      o.coreRing.visible = !engine.cfg.mobile;
      o.coreRing.quaternion.copy(q);
      o.coreRing.scale.setScalar((r * 0.7) / core.k);
      const lit = hovered === 'core' || engine.coreActive;
      const mat = o.coreRing.material as THREE.LineBasicMaterial;
      mat.color.copy(lit ? SIGNAL : CREAM);
      mat.opacity = lit ? 1 : 0.45;
    }

    o.stars.forEach((st, i) => {
      const p = engine.stars[i];
      const on = hovered === i || selected === i;
      const fade = p.dim ? 0.25 : 1;
      const k = p.k || 1;
      st.halo.scale.setScalar(((on ? 30 : 18) * p.base * 2) / k);
      const hm = st.halo.material;
      hm.color.copy(on ? SIGNAL : CREAM);
      hm.opacity = (on ? 0.6 : 0.38) * fade;
      st.dot.scale.setScalar((2.6 * p.base * 2) / k);
      st.dot.material.opacity = fade;
      const m = (9 * p.base) / k;
      st.mark.quaternion.copy(q);
      st.mark.scale.setScalar(m);
      const mm = st.mark.material as THREE.LineBasicMaterial;
      mm.color.copy(on ? SIGNAL : CREAM);
      mm.opacity = (on ? 1 : 0.55) * fade;
      st.mark2.visible = on;
      if (on) {
        st.mark2.quaternion.copy(q);
        st.mark2.scale.setScalar(m * (1 + 0.7 / (9 * p.base)));
        (st.mark2.material as THREE.LineBasicMaterial).color.copy(SIGNAL);
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
      onCreated={({ gl }) => gl.setClearColor('#1E1E24', 1)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene engine={engine} />
    </Canvas>
  );
}
