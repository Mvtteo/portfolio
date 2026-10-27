import * as THREE from 'three';
import type { DecorKind } from './themes';

/*
 * Décor propre à chaque univers de secteur, centré sur son origine (unités de monde).
 * belt : ceinture d'astéroïdes dorée · network : nœuds et liaisons d'un réseau neuronal ·
 * grid : sol quadrillé qui défile + planète à anneau · gyro : anneaux de gyroscope imbriqués.
 * Rien d'interactif : le hit-test ne connaît que les systèmes et les portes.
 */

export interface Decor {
  group: THREE.Group;
  update: (T: number) => void;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

type Keep = <T extends { dispose(): void }>(o: T) => T;

function ringPoints(n: number, r: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  });
}

export function buildDecor(kind: DecorKind, opts: { mobile: boolean; keep: Keep; disc: THREE.Texture; glow: THREE.Texture; anchors: THREE.Vector3[] }): Decor | null {
  const { mobile, keep, disc, glow } = opts;
  const group = new THREE.Group();
  const r = rng(kind.length * 97 + 13);

  if (kind === 'belt') {
    const n = mobile ? 900 : 1800;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const palette = ['#FFD696', '#C98A4A', '#FEF8F1', '#8A5A2E'].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = 300 + (r() + r() + r()) * 26;
      pos.set([Math.cos(a) * d, (r() - 0.5) * 16, Math.sin(a) * d], i * 3);
      const c = palette[Math.floor(r() * palette.length)];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, keep(new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false })));
    const belt = new THREE.Group();
    belt.add(pts);
    belt.rotation.x = 0.16;
    belt.rotation.z = -0.08;
    group.add(belt);
    return { group, update: (T) => (pts.rotation.y = T * 0.018) };
  }

  if (kind === 'network') {
    const nodes = [...opts.anchors];
    for (let i = 0; i < (mobile ? 40 : 70); i++) {
      const a = r() * Math.PI * 2;
      const d = 120 + r() * 360;
      nodes.push(new THREE.Vector3(Math.cos(a) * d, (r() - 0.5) * 240, Math.sin(a) * d));
    }
    const seg: number[] = [];
    const seen = new Set<string>();
    nodes.forEach((p, i) => {
      const near = nodes
        .map((q, j) => ({ j, d: p.distanceTo(q) }))
        .filter((o) => o.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2);
      near.forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        seg.push(p.x, p.y, p.z, nodes[j].x, nodes[j].y, nodes[j].z);
      });
    });
    const lineGeo = keep(new THREE.BufferGeometry());
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    const lineMat = keep(new THREE.LineBasicMaterial({ color: '#B49CFF', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(new THREE.LineSegments(lineGeo, lineMat));
    const nodeGeo = keep(new THREE.BufferGeometry().setFromPoints(nodes.slice(opts.anchors.length)));
    const nodeMat = keep(new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, color: '#C9B6FF', transparent: true, opacity: 0.7, depthWrite: false }));
    group.add(new THREE.Points(nodeGeo, nodeMat));
    return {
      group,
      update: (T) => {
        lineMat.opacity = 0.12 + 0.07 * Math.sin(T * 1.3);
        nodeMat.opacity = 0.55 + 0.25 * Math.sin(T * 2.1 + 1);
      },
    };
  }

  if (kind === 'grid') {
    const size = 1800;
    const step = 72;
    const seg: number[] = [];
    const col: number[] = [];
    const base = new THREE.Color('#4E7FD0');
    const fade = (x: number, z: number) => Math.max(0, 1 - Math.hypot(x, z) / (size * 0.55));
    for (let v = -size / 2; v <= size / 2; v += step) {
      for (let u = -size / 2; u < size / 2; u += step) {
        // Segments courts : la teinte s'éteint vers les bords (mélange additif → plus sombre = plus discret).
        [
          [u, v, u + step, v],
          [v, u, v, u + step],
        ].forEach(([x1, z1, x2, z2]) => {
          seg.push(x1, 0, z1, x2, 0, z2);
          const f1 = fade(x1, z1);
          const f2 = fade(x2, z2);
          col.push(base.r * f1, base.g * f1, base.b * f1, base.r * f2, base.g * f2, base.b * f2);
        });
      }
    }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const grid = new THREE.LineSegments(geo, keep(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    grid.position.y = -200;
    group.add(grid);

    // Planète à anneau, loin derrière : corps opaque, liseré lumineux, anneau incliné.
    const planet = new THREE.Group();
    planet.position.set(-620, 240, -820);
    const body = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: disc, color: '#16284C', depthWrite: false })));
    body.scale.setScalar(300);
    const rim = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: '#BFD4FF', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })));
    rim.scale.setScalar(470);
    const ringGeo = keep(new THREE.BufferGeometry().setFromPoints(ringPoints(128, 250)));
    const ring = new THREE.LineLoop(ringGeo, keep(new THREE.LineBasicMaterial({ color: '#BFD4FF', transparent: true, opacity: 0.4, depthWrite: false })));
    ring.rotation.set(0.35, 0, 0.25);
    const ring2 = new THREE.LineLoop(keep(new THREE.BufferGeometry().setFromPoints(ringPoints(128, 280))), keep(new THREE.LineBasicMaterial({ color: '#4E7FD0', transparent: true, opacity: 0.3, depthWrite: false })));
    ring2.rotation.copy(ring.rotation);
    planet.add(rim, body, ring, ring2);
    group.add(planet);
    return { group, update: (T) => (grid.position.z = (T * 18) % step) };
  }

  if (kind === 'gyro') {
    const mat = (o: number) => keep(new THREE.LineBasicMaterial({ color: '#FFF2BF', transparent: true, opacity: o, depthWrite: false }));
    const rings = [300, 360, 420].map((rad, i) => {
      const holder = new THREE.Group();
      const loop = new THREE.LineLoop(keep(new THREE.BufferGeometry().setFromPoints(ringPoints(160, rad))), mat(0.22 - i * 0.04));
      const bead = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: disc, color: '#FFF2BF', transparent: true, depthWrite: false })));
      bead.scale.setScalar(9);
      bead.position.set(rad, 0, 0);
      const beadHalo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: '#FFF2BF', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
      beadHalo.scale.setScalar(46);
      beadHalo.position.copy(bead.position);
      holder.add(loop, bead, beadHalo);
      holder.rotation.set([0.5, -0.9, 1.25][i], [0, 0.6, -0.4][i], [0.2, 0, 0.5][i]);
      group.add(holder);
      return holder;
    });
    return {
      group,
      update: (T) =>
        rings.forEach((h, i) => {
          h.rotation.y = [0, 0.6, -0.4][i] + T * [0.05, -0.035, 0.025][i];
        }),
    };
  }

  return null;
}
