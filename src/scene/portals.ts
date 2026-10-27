import { ACTIVE_SECTORS, SECTOR_COUNTS } from '../data/projects';
import { SECTOR_BY_KEY, type UniverseKey } from '../data/sectors';

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
  /** Rayon de l'anneau en unités de monde. */
  radius: number;
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
}));

/** Portails d'un secteur : en couronne r = 400 autour de son origine, au-delà de l'anneau des systèmes (r ≤ 222). */
const sectorPortals: Portal[] = ACTIVE_SECTORS.flatMap((s) => {
  const dests: UniverseKey[] = ['hub', ...ACTIVE_SECTORS.filter((o) => o.key !== s.key).map((o) => o.key)];
  const [ox, oy, oz] = s.origin;
  return dests.map((to, k) => {
    const a = (k / dests.length) * Math.PI * 2 + Math.PI / dests.length + 0.4;
    return {
      id: `${s.key}>${to}`,
      from: s.key,
      to,
      pos: [ox + Math.cos(a) * 400, oy + Math.sin(a * 3) * 30, oz + Math.sin(a) * 400] as [number, number, number],
      color: universeColor(to),
      label: to === 'hub' ? 'NOYAU · RETOUR' : `${SECTOR_BY_KEY[to].label} · ${SECTOR_COUNTS[to]}`,
      radius: to === 'hub' ? 28 : 22,
    };
  });
});

export const PORTALS: Portal[] = [...hubPortals, ...sectorPortals];
