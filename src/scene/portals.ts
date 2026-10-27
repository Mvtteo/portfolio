import { ACTIVE_SECTORS, SECTOR_COUNTS } from '../data/projects';
import { SECTOR_BY_KEY, type UniverseKey } from '../data/sectors';
import { THEMES, type GateKind, type PortalLayout } from './themes';

/*
 * Portails entre univers. Le noyau (hub) porte un portail par secteur ; chaque secteur porte un
 * portail retour vers le noyau et un portail vers chacun des autres secteurs. Positions en unités
 * de monde ; un clic sur un portail lance le saut en distorsion vers son univers.
 */

export interface Portal {
  id: string;
  from: UniverseKey;
  to: UniverseKey;
  pos: [number, number, number];
  /** Couleur de l'anneau et du libellé = accent de l'univers de destination. */
  color: string;
  label: string;
  /** Rayon de la porte en unités de monde. */
  radius: number;
  /** Forme de la porte = celle de l'univers de destination. */
  gate: GateKind;
}

export const HUB_COLOR = '#F29A5C';
const HUB_ORIGIN: [number, number, number] = [0, 0, 0];

export function originOf(u: UniverseKey): [number, number, number] {
  return u === 'hub' ? HUB_ORIGIN : SECTOR_BY_KEY[u].origin;
}

export function universeName(u: UniverseKey) {
  return u === 'hub' ? 'Noyau' : SECTOR_BY_KEY[u].name;
}

export function universeLabel(u: UniverseKey) {
  return u === 'hub' ? 'NOYAU' : SECTOR_BY_KEY[u].label;
}

export function universeColor(u: UniverseKey) {
  return u === 'hub' ? HUB_COLOR : SECTOR_BY_KEY[u].color;
}

/** Portails du noyau : sur la position historique du secteur, poussée vers l'extérieur (×1,25). */
const hubPortals: Portal[] = ACTIVE_SECTORS.map((s) => ({
  id: `hub>${s.key}`,
  from: 'hub',
  to: s.key,
  pos: [s.center[0] * 1.25, s.center[1] * 0.6, s.center[2] * 1.25],
  color: s.color,
  label: `${s.label} · ${SECTOR_COUNTS[s.key]}`,
  radius: 30,
  gate: THEMES[s.key].gate,
}));

/**
 * Position de la k-ième porte (sur n) dans un univers, selon sa disposition, relative à son origine.
 * row : alignées à l'horizon derrière les systèmes · arch : en arche au-dessus · diamond : en losange
 * sous le plan · crown : couronne inclinée autour.
 */
function layoutPos(layout: PortalLayout, k: number, n: number): [number, number, number] {
  const t = n > 1 ? k / (n - 1) : 0.5;
  switch (layout) {
    case 'row':
      return [-480 + t * 960, 90, -400];
    case 'arch': {
      const a = Math.PI * (0.12 + 0.76 * t);
      return [Math.cos(a) * -470, 150 + Math.sin(a) * 210, -240];
    }
    case 'diamond': {
      const a = (k / n) * Math.PI * 2 + Math.PI / 4;
      return [Math.cos(a) * 400, -120, Math.sin(a) * 400];
    }
    case 'crown':
    default: {
      const a = (k / n) * Math.PI * 2 + 0.4;
      return [Math.cos(a) * 360, k % 2 ? 120 : -50, Math.sin(a) * 360];
    }
  }
}

/** Portes d'un secteur : retour au noyau + une porte par autre secteur, disposées selon le thème de l'univers. */
const sectorPortals: Portal[] = ACTIVE_SECTORS.flatMap((s) => {
  const dests: UniverseKey[] = ['hub', ...ACTIVE_SECTORS.filter((o) => o.key !== s.key).map((o) => o.key)];
  const [ox, oy, oz] = s.origin;
  const layout = THEMES[s.key].layout;
  return dests.map((to, k) => {
    const [dx, dy, dz] = layoutPos(layout, k, dests.length);
    return {
      id: `${s.key}>${to}`,
      from: s.key,
      to,
      pos: [ox + dx, oy + dy, oz + dz] as [number, number, number],
      color: universeColor(to),
      label: to === 'hub' ? 'NOYAU · RETOUR' : `${SECTOR_BY_KEY[to].label} · ${SECTOR_COUNTS[to]}`,
      radius: to === 'hub' ? 30 : 28,
      gate: THEMES[to].gate,
    };
  });
});

export const PORTALS: Portal[] = [...hubPortals, ...sectorPortals];
