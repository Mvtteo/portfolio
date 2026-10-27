import type { PerspectiveCamera } from 'three';
import { PROJECTS } from '../data/projects';
import type { UniverseKey } from '../data/sectors';
import type { Filter } from '../data/projects';
import { originOf, PORTALS } from './portals';

/*
 * Caméra et interaction de la carte, hors React. La scène R3F appelle `tick` à chaque frame ;
 * React ne reçoit que des événements discrets (arrivée sur la cible, changement de survol).
 * Valeurs : data-orbit-handover/tokens.css (commentaire final) et Systeme.dc.html §04.
 */

/** Trou noir central, en unités de monde : rayon de l'ombre, bords interne et externe du disque d'accrétion. */
export const BH = { shadow: 20, diskIn: 36, diskOut: 110 };

export interface CamState {
  tx: number;
  ty: number;
  tz: number;
  dist: number;
  yaw: number;
  pitch: number;
  /** Décalage du centre de vue en px (panneau ouvert). */
  offX: number;
  offY: number;
}

/** Survol / clic : index de projet, noyau, ou portail (`portal:<index dans PORTALS>`). */
export type Hit = number | 'core' | `portal:${number}` | null;

export const portalIndex = (h: Hit) => (typeof h === 'string' && h.startsWith('portal:') ? Number(h.slice(7)) : null);

export interface EngineConfig {
  mobile: boolean;
  home: Omit<CamState, 'yaw'>;
  minDist: number;
  maxDist: number;
  target: { dist: number; pitch: number; offX: number; offY: number };
  /** Vue d'ensemble d'un univers de secteur (systèmes espacés + couronne de portails). */
  universe: { dist: number; pitch: number };
  /** Rayon minimal de la zone de clic d'une étoile (16 px desktop, 24 px mobile). */
  hitMin: number;
  hitPad: number;
  starScale: number;
  starMax: number;
}

export const DESKTOP: EngineConfig = {
  mobile: false,
  home: { tx: 0, ty: 0, tz: 0, dist: 850, pitch: 0.26, offX: 130, offY: 0 },
  minDist: 110,
  maxDist: 1100,
  target: { dist: 150, pitch: 0.2, offX: -220, offY: 0 },
  universe: { dist: 1150, pitch: 0.32 },
  hitMin: 16,
  hitPad: 6,
  starScale: 0.55,
  starMax: 2.6,
};

export const MOBILE: EngineConfig = {
  mobile: true,
  home: { tx: 0, ty: 0, tz: 0, dist: 1200, pitch: 0.34, offX: 0, offY: 40 },
  minDist: 140,
  maxDist: 1300,
  target: { dist: 190, pitch: 0.25, offX: 0, offY: -150 },
  universe: { dist: 1600, pitch: 0.4 },
  hitMin: 24,
  hitPad: 10,
  starScale: 0.5,
  starMax: 2.4,
};

const PITCH_MIN = -0.2;
const PITCH_MAX = 1.2;
const EASE = 2.4;
const DRIFT = 0.035;
const IDLE = 5;
const KEYS = ['tx', 'ty', 'tz', 'dist', 'pitch', 'offX', 'offY'] as const;

export interface ProjectedStar {
  x: number;
  y: number;
  /** px par unité de monde à cette profondeur. */
  k: number;
  visible: boolean;
  /** Taille de base (×1,25 si mis en avant, bornée selon la distance). */
  base: number;
  r: number;
  dim: boolean;
}

export interface Overlays {
  label?: HTMLElement | null;
  reticle?: HTMLElement | null;
  core?: HTMLElement | null;
  /** Libellés des portails, dans l'ordre de PORTALS. */
  portals: (HTMLElement | null)[];
}

interface Callbacks {
  onArrive?: () => void;
  /** Saut en distorsion : départ, bascule d'univers (écran couvert par le flash), sortie. */
  onWarp?: (phase: 'start' | 'swap' | 'end', to: UniverseKey) => void;
  onHover?: (h: Hit) => void;
  onLowFps?: () => void;
}

// Pas d'import de valeur depuis three : le HUD reste léger, la scène est chargée à la demande.
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const RAD = 180 / Math.PI;

/** Saut : accélération jusqu'à la bascule (s), puis décélération dans le nouvel univers jusqu'à la fin (s). */
export const WARP = { swap: 0.95, end: 2.15 };

interface Warp {
  t: number;
  to: UniverseKey;
  swapped: boolean;
  from: CamState;
  onSwap?: () => void;
}

export class OrbitEngine {
  cfg: EngineConfig;
  cam: CamState;
  goal: CamState;
  stars: ProjectedStar[];
  core = { x: 0, y: 0, k: 0, visible: false, r: 0 };
  portalScreen: { x: number; y: number; k: number; r: number; visible: boolean }[] = PORTALS.map(() => ({ x: 0, y: 0, k: 0, r: 0, visible: false }));
  overlays: Overlays = { portals: [] };
  /** Univers affiché. Change au milieu du saut, quand le flash couvre l'écran. */
  universe: UniverseKey = 'hub';
  warpState: Warp | null = null;
  /** Élargissement du champ pendant le saut (sensation de vitesse). */
  fovBoost = 1;
  cb: Callbacks = {};

  // État venu de React, lu à chaque frame.
  filter: Filter = 'all';
  hovered: Hit = null;
  selected: number | null = null;
  /** Panneau Profil ouvert : anneau du noyau en rouge signal. */
  coreActive = false;
  drift = true;
  driftAllowed = true;
  reduced = false;

  time = 0;
  lastInteract = -1e9;
  dragging = false;
  travelling = false;
  width = 1;
  height = 1;
  focal = 1;

  private fpsSamples = 0;
  private fpsTime = 0;
  private fpsChecked = false;

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
    this.cam = { ...cfg.home, yaw: 0.6 };
    this.goal = { ...this.cam };
    this.stars = PROJECTS.map(() => ({ x: 0, y: 0, k: 0, visible: false, base: 1, r: cfg.hitMin, dim: false }));
  }

  /** État venu de React (filtre, survol, sélection, dérive…), lu à chaque frame. */
  sync(patch: Partial<Pick<OrbitEngine, 'filter' | 'hovered' | 'selected' | 'drift' | 'driftAllowed' | 'coreActive' | 'reduced'>>) {
    Object.assign(this, patch);
  }

  on(cb: Callbacks) {
    Object.assign(this.cb, cb);
  }

  attach(overlays: Overlays) {
    this.overlays = overlays;
  }

  private retarget(o: Partial<CamState>) {
    Object.assign(this.goal, o);
    if (this.reduced) Object.assign(this.cam, this.goal);
    this.travelling = true;
    this.lastInteract = this.time;
  }

  select(i: number) {
    const [x, y, z] = PROJECTS[i].pos;
    const t = this.cfg.target;
    this.retarget({ tx: x, ty: y, tz: z, dist: t.dist, pitch: t.pitch, offX: t.offX, offY: t.offY });
  }

  /** Vue d'ensemble d'un univers (par défaut, celui affiché). */
  homeOf(u: UniverseKey = this.universe): Omit<CamState, 'yaw'> {
    if (u === 'hub') return { ...this.cfg.home };
    const [tx, ty, tz] = originOf(u);
    return { ...this.cfg.home, tx, ty, tz, dist: this.cfg.universe.dist, pitch: this.cfg.universe.pitch };
  }

  overview() {
    this.retarget(this.homeOf());
  }

  get warping() {
    return this.warpState != null;
  }

  /**
   * Saut vers un autre univers. `onSwap` s'exécute à la bascule (ex. cibler un système à l'arrivée).
   * Mouvement réduit : bascule immédiate, sans traînées.
   */
  warp(to: UniverseKey, onSwap?: () => void) {
    if (this.warpState) {
      this.warpState.to = to;
      this.warpState.onSwap = onSwap;
      return;
    }
    if (to === this.universe) {
      if (onSwap) onSwap();
      else this.overview();
      return;
    }
    this.lastInteract = this.time;
    if (this.reduced) {
      this.universe = to;
      Object.assign(this.goal, this.homeOf(to));
      onSwap?.();
      Object.assign(this.cam, this.goal);
      this.cb.onWarp?.('start', to);
      this.cb.onWarp?.('swap', to);
      this.cb.onWarp?.('end', to);
      return;
    }
    this.warpState = { t: 0, to, swapped: false, from: { ...this.cam }, onSwap };
    this.travelling = true;
    this.cb.onWarp?.('start', to);
  }

  private stepWarp(dt: number) {
    const w = this.warpState!;
    w.t += dt;
    const c = this.cam;
    if (!w.swapped) {
      // Accélération : le vaisseau plonge vers l'avant, le champ s'élargit.
      const e = Math.pow(Math.min(1, w.t / WARP.swap), 2.2);
      c.dist = w.from.dist * (1 - 0.72 * e);
      c.pitch = w.from.pitch * (1 - 0.6 * e);
      this.fovBoost = 1 + 0.75 * e;
      if (w.t >= WARP.swap) {
        w.swapped = true;
        this.universe = w.to;
        Object.assign(this.goal, this.homeOf(w.to));
        w.onSwap?.();
        // Sortie de distorsion : on arrive de loin, dans l'axe, et on freine jusqu'à la vue cible.
        Object.assign(this.cam, this.goal, { dist: this.goal.dist * 2.8, pitch: this.goal.pitch * 0.4, yaw: this.goal.yaw });
        this.cb.onWarp?.('swap', w.to);
      }
      return;
    }
    const u = Math.min(1, (w.t - WARP.swap) / (WARP.end - WARP.swap));
    this.fovBoost = 1 + 0.75 * Math.pow(1 - u, 3);
    if (w.t >= WARP.end) {
      this.fovBoost = 1;
      this.warpState = null;
      this.cb.onWarp?.('end', w.to);
    }
  }

  /** Noyau : profil. Vue rasante pour lire l'image lentillée du disque. */
  flyCore() {
    this.retarget({ tx: 0, ty: 0, tz: 0, dist: 300, pitch: 0.14, offX: this.cfg.target.offX });
  }

  setOffset(offX: number, offY = this.goal.offY) {
    Object.assign(this.goal, { offX, offY });
    if (this.reduced) Object.assign(this.cam, { offX, offY });
  }

  /** Panneau refermé : la caméra recule un peu et recentre. */
  release(minDist: number) {
    this.setOffset(this.cfg.home.offX, this.cfg.home.offY);
    this.goal.dist = Math.max(this.goal.dist, minDist);
    if (this.reduced) this.cam.dist = this.goal.dist;
  }

  zoom(factor: number) {
    if (this.warpState) return;
    this.goal.dist = clamp(this.goal.dist * factor, this.cfg.minDist, this.cfg.maxDist);
    if (this.reduced) this.cam.dist = this.goal.dist;
    this.lastInteract = this.time;
  }

  orbit(dx: number, dy: number, sx = 0.005, sy = 0.004) {
    if (this.warpState) return;
    this.goal.yaw += dx * sx;
    this.cam.yaw = this.goal.yaw;
    this.goal.pitch = clamp(this.goal.pitch + dy * sy, PITCH_MIN, PITCH_MAX);
    this.cam.pitch = this.goal.pitch;
    this.lastInteract = this.time;
  }

  hit(mx: number, my: number): Hit {
    if (this.warpState) return null;
    let best: number | null = null;
    let bd = Infinity;
    this.stars.forEach((p, i) => {
      if (!p.visible || p.dim) return;
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < p.r && d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best != null) return best;
    let portal: number | null = null;
    let pd = Infinity;
    this.portalScreen.forEach((p, i) => {
      if (!p.visible) return;
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < p.r && d < pd) {
        pd = d;
        portal = i;
      }
    });
    if (portal != null) return `portal:${portal}`;
    if (this.core.visible && Math.hypot(this.core.x - mx, this.core.y - my) < this.core.r) return 'core';
    return null;
  }

  /** Focale en px : desktop f = 1,15·H, mobile f = 1,7·W (prototypes), bornée en paysage. */
  private fov(w: number, h: number) {
    const f = this.cfg.mobile ? Math.min(1.7 * w, 1.6 * h) : 1.15 * h; // mobile paysage : bornée par la hauteur
    this.focal = f;
    return 2 * Math.atan(h / 2 / f) * RAD;
  }

  tick(dtRaw: number, camera: PerspectiveCamera, w: number, h: number) {
    // Développement seulement : tests navigateur sur les positions projetées réelles.
    if (import.meta.env.DEV) (window as unknown as { __orbit: OrbitEngine }).__orbit = this;
    this.measureFps(dtRaw);
    const dt = Math.min(0.05, Math.max(0.001, dtRaw));
    this.time += dt;
    this.width = w;
    this.height = h;
    const c = this.cam;
    const g = this.goal;

    const before = c.tx + c.ty + c.tz + c.dist;
    const inWarp = this.warpState != null;
    if (inWarp) this.stepWarp(dt);
    const accelerating = this.warpState != null && !this.warpState.swapped;
    // Sortie de distorsion : freinage plus franc que le déplacement ordinaire.
    const k = this.reduced ? 1 : 1 - Math.exp(-dt * (inWarp ? EASE * 1.9 : EASE));
    if (!accelerating) for (const key of KEYS) c[key] += (g[key] - c[key]) * k;
    const driftOn = !inWarp && this.drift && this.driftAllowed && !this.reduced && !this.dragging && this.time - this.lastInteract > IDLE;
    if (driftOn) {
      c.yaw += dt * DRIFT;
      g.yaw = c.yaw;
    } else c.yaw += (g.yaw - c.yaw) * k;

    const speed = Math.abs(c.tx + c.ty + c.tz + c.dist - before) / dt;
    if (this.travelling && !this.warpState && speed < 2) {
      this.travelling = false;
      this.cb.onArrive?.();
    }

    // Caméra sphérique autour de la cible, légèrement plongeante.
    const cp = Math.cos(c.pitch);
    camera.position.set(c.tx + c.dist * cp * Math.sin(c.yaw), c.ty + c.dist * Math.sin(c.pitch), c.tz + c.dist * cp * Math.cos(c.yaw));
    camera.lookAt(c.tx, c.ty, c.tz);
    const fov = Math.min(118, this.fov(w, h) * this.fovBoost);
    if (camera.fov !== fov) camera.fov = fov;
    camera.setViewOffset(w, h, -c.offX, -c.offY, w, h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    this.project(camera);
    this.writeOverlays();
  }

  private toScreen(x: number, y: number, z: number, camera: PerspectiveCamera) {
    const m = camera.matrixWorldInverse.elements;
    const vx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const vy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const vz = m[2] * x + m[6] * y + m[10] * z + m[14];
    const depth = -vz;
    if (depth < 4) return null;
    const p = camera.projectionMatrix.elements;
    const w = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
    const nx = (p[0] * vx + p[4] * vy + p[8] * vz + p[12]) / w;
    const ny = (p[1] * vx + p[5] * vy + p[9] * vz + p[13]) / w;
    return { x: ((nx + 1) / 2) * this.width, y: ((1 - ny) / 2) * this.height, k: this.focal / depth };
  }

  private project(camera: PerspectiveCamera) {
    const { hitMin, hitPad, mobile } = this.cfg;
    PROJECTS.forEach((p, i) => {
      const s = this.stars[i];
      s.dim = false;
      const q = p.sector === this.universe ? this.toScreen(p.pos[0], p.pos[1], p.pos[2], camera) : null;
      if (!q) {
        s.visible = false;
        return;
      }
      // Dans un univers de secteur, la caméra est plus loin : les systèmes restent lisibles (+30 %).
      const featured = (p.priority === 'featured' ? (mobile ? 1.2 : 1.25) : 1) * (this.universe === 'hub' ? 1 : 1.3);
      s.base = featured * clamp(q.k * (mobile ? 1.4 : 1.6), mobile ? 0.8 : 0.7, mobile ? 2.2 : 2.4);
      s.x = q.x;
      s.y = q.y;
      s.k = q.k;
      s.r = Math.max(hitMin, 9 * s.base + hitPad);
      s.visible = q.x > -60 && q.x < this.width + 60 && q.y > -60 && q.y < this.height + 60;
    });
    const core = this.universe === 'hub' ? this.toScreen(0, 0, 0, camera) : null;
    if (core) {
      // Zone de clic : ombre + image lentillée (1,8 rs), jamais sous la cible minimale.
      const rs = BH.shadow * core.k;
      Object.assign(this.core, { x: core.x, y: core.y, k: core.k, visible: true, r: Math.max(mobile ? 24 : 22, rs * 1.8) });
    } else this.core.visible = false;
    PORTALS.forEach((p, i) => {
      const ps = this.portalScreen[i];
      const q = p.from === this.universe ? this.toScreen(p.pos[0], p.pos[1], p.pos[2], camera) : null;
      if (!q) {
        ps.visible = false;
        return;
      }
      Object.assign(ps, { x: q.x, y: q.y, k: q.k, r: Math.max(hitMin + 8, p.radius * q.k * 1.15), visible: q.x > -80 && q.x < this.width + 80 && q.y > -80 && q.y < this.height + 80 });
    });
  }

  private writeOverlays() {
    const o = this.overlays;
    const place = (el: HTMLElement | null | undefined, x: number, y: number, show: boolean) => {
      if (!el) return;
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      el.style.visibility = show ? '' : 'hidden';
    };
    const pi = portalIndex(this.hovered);
    const h = typeof this.hovered === 'number' ? this.stars[this.hovered] : this.hovered === 'core' ? this.core : pi != null ? this.portalScreen[pi] : null;
    if (o.label && h) place(o.label, h.x + 22, h.y - 70, h.visible);
    if (o.reticle && this.selected != null) {
      const s = this.stars[this.selected];
      const half = this.cfg.mobile ? 28 : 32;
      place(o.reticle, s.x - half, s.y - half, s.visible);
    }
    if (o.core) place(o.core, this.core.x, this.core.y + Math.max(BH.shadow * this.core.k * 2.2, 30) + 14, this.core.visible);
    PORTALS.forEach((p, i) => {
      const q = this.portalScreen[i];
      place(o.portals[i], q.x, q.y - Math.max(p.radius * q.k * 1.25, 26) - 8, q.visible && !this.warpState);
    });
  }

  /** Repli liste si la machine ne tient pas ~12 images/s (mesuré de 2 s à 6 s après le démarrage). */
  private measureFps(dt: number) {
    if (this.fpsChecked) return;
    this.fpsTime += dt;
    if (this.fpsTime < 2) return;
    this.fpsSamples++;
    if (this.fpsTime >= 6) {
      this.fpsChecked = true;
      if (this.fpsSamples / (this.fpsTime - 2) < 12) this.cb.onLowFps?.();
    }
  }
}
