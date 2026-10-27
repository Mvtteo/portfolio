import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { planetOf } from '../data/planets';
import { ACTIVE_SECTORS, PROJECTS } from '../data/projects';
import { STAR_TYPES, type UniverseKey } from '../data/sectors';
import { buildBlackHole } from './blackHole';
import { BH, portalIndex, type OrbitEngine } from './engine';
import { buildDecor, type Decor } from './decor';
import { originOf, PORTALS } from './portals';
import { buildStarGeometry, starMaterial } from './starfield';
import { gateKit } from './gates3d';
import { buildSun, moonOrbit, planetKit, type PlanetObj } from './planets3d';
import { beamTexture, discTexture, glowTexture, spikesTexture } from './textures';
import { THEMES } from './themes';

/*
 * Scène WebGL de la carte stellaire. Rien n'est reconstruit à la sélection : un seul useFrame
 * fait avancer la caméra (engine.tick) puis met à jour positions, rotations et opacités en place.
 * Dans chaque univers, les projets sont des planètes (planets3d.ts) autour de l'étoile du secteur ;
 * tout y est en unités de monde.
 */

const PEACH = new THREE.Color('#FFC89A');

/** Couleur de fond = clear color : espace quasi noir, pour que le disque et les étoiles portent la couleur. */
export const SPACE = '#0E0E12';

const PARTICLES = 4;
function spriteMaterial(map: THREE.Texture, color: THREE.ColorRepresentation = '#FEF8F1', opacity = 1, additive = false) {
  return new THREE.SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
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

    // Portes en 3D (gates3d.ts) : une forme par univers de destination, à l'échelle de leur rayon.
    const kit = gateKit(keep, glow, disc);
    const portals = PORTALS.map((pt) => {
      const gate = kit.make(pt.gate, pt.radius);
      gate.group.position.set(...pt.pos);
      gate.group.scale.setScalar(pt.radius);
      root.add(gate.group);
      return { gate, from: pt.from, radius: pt.radius, aim: new THREE.Quaternion() };
    });

    // Étoile centrale de chaque univers : le type d'étoile du secteur.
    const suns = new Map<UniverseKey, ReturnType<typeof buildSun>>();
    ACTIVE_SECTORS.forEach((sec) => {
      const sun = buildSun(sec.star, STAR_TYPES[sec.star], keep, { glow, disc, spikes, beam });
      sun.group.position.set(...sec.origin);
      suns.set(sec.key, sun);
      root.add(sun.group);
    });

    // Projets = planètes : ombrées par l'étoile de leur univers, lunes = technologies.
    const planetsKit = planetKit(keep, glow);
    const stars: PlanetObj[] = PROJECTS.map((p) => {
      const sec = ACTIVE_SECTORS.find((x) => x.key === p.sector)!;
      const obj = planetsKit.build(planetOf(p), p.pos, sec.origin, sec.color, p.sector, Math.min(4, p.tech.length));
      root.add(obj.group);
      return obj;
    });

    return { root, field, nebulae, decors, portals, kit, suns, planetsKit, starMat, bh, flow, flowPos, flowCol, stars, disposables };
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

    // Portes : orientées vers la caméra avec retard (on voit leur volume pendant les déplacements),
    // plus un angle de trois-quarts propre à chaque forme.
    const hp = portalIndex(hovered);
    o.kit.uTime.value = T;
    const follow = reduced ? 1 : 1 - Math.exp(-dt * 1.8);
    o.portals.forEach((pt, i) => {
      const g = pt.gate.group;
      g.visible = pt.from === universe;
      if (!g.visible) return;
      pt.aim.copy(q).multiply(pt.gate.tilt);
      g.quaternion.slerp(pt.aim, follow);
      g.scale.setScalar(pt.radius * (hp === i ? 1.12 : 1));
      pt.gate.update(T + i * 0.7);
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

    o.suns.forEach((sun, u) => {
      sun.group.visible = u === universe;
      if (sun.group.visible) sun.update(T);
    });

    o.planetsKit.uTime.value = T;
    o.stars.forEach((pl, i) => {
      pl.group.visible = pl.sector === universe;
      if (!pl.group.visible) return;
      const p = engine.stars[i];
      const on = hovered === i || selected === i;
      const k = p.k || 1;
      const R = pl.look.radius;
      pl.body.rotation.y = T * pl.look.spin + i;
      pl.mat.uniforms.uHover.value = on ? 1 : 0;
      pl.halo.material.opacity = on ? 0.32 : 0.18;
      if (pl.dust) pl.dust.material.rotation = T * 0.1;

      pl.moons.forEach((m, j) => {
        const r = moonOrbit(R, j);
        const a = T * (0.6 / (j + 1)) + j * 2.1 + i;
        m.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.12, Math.sin(a) * r);
      });
      // Orbites des lunes : de près, au survol ou à la sélection.
      const showOrbits = on || k > 2.2;
      pl.orbits.forEach((l) => (l.visible = showOrbits));
      pl.orbitMat.opacity = on ? 0.3 : 0.16;

      pl.target.visible = on;
      if (on) {
        pl.target.quaternion.copy(q);
        pl.target.scale.setScalar(R * 1.6);
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
