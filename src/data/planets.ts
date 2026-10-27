import { isProtostar, type Project } from './projects';
import type { SectorKey } from './sectors';

/*
 * Dans un univers, chaque projet est une planète en orbite autour de l'étoile du secteur
 * (le type d'étoile reste celui du secteur : naine jaune, pulsar, blanc-bleu, céphéide).
 * Aspect déterministe : type de planète tiré d'une séquence propre au secteur, taille selon la
 * priorité, anneaux pour les géantes mises en avant. Sans dépôt ni démo publics : proto-planète.
 * Aucune valeur ici ne dépend de three : le moteur (hit-test) et le HUD la lisent aussi.
 */

export type PlanetKind = 'gas' | 'rock' | 'ocean' | 'ice' | 'lava' | 'proto';

export interface PlanetLook {
  kind: PlanetKind;
  /** Rayon en unités de monde. */
  radius: number;
  /** Couleurs : fond, contraste, rehaut (bandes, continents, nuages, fissures…). */
  colors: [string, string, string];
  ring: boolean;
  /** Inclinaison de l'axe (rad) et vitesse de rotation propre. */
  tilt: number;
  spin: number;
  seed: number;
  name: string;
}

const PALETTES: Record<PlanetKind, [string, string, string]> = {
  gas: ['#C98A4A', '#6E3F22', '#F2D9A6'],
  rock: ['#8A6A54', '#3E2E26', '#C9AE92'],
  ocean: ['#1E4E8C', '#3B7A4E', '#EEF4F8'],
  ice: ['#9FC4E0', '#4E6F96', '#F4FAFF'],
  lava: ['#2A1611', '#120A08', '#FF7A2E'],
  proto: ['#6B4A3A', '#2E211B', '#C98A6A'],
};

const NAMES: Record<PlanetKind, string> = {
  gas: 'Géante gazeuse',
  rock: 'Planète tellurique',
  ocean: 'Planète océan',
  ice: 'Géante de glace',
  lava: 'Planète de lave',
  proto: 'Proto-planète · rien de public',
};

/** Séquence de types par secteur : chaque univers a sa propre famille de mondes. */
const SEQUENCE: Record<SectorKey, PlanetKind[]> = {
  data: ['gas', 'rock', 'ocean', 'lava', 'gas', 'ice'],
  ia: ['ice', 'lava', 'gas', 'rock', 'ocean', 'ice'],
  web: ['ocean', 'ice', 'rock', 'gas', 'ocean', 'lava'],
  outils: ['rock', 'gas', 'lava', 'ocean', 'ice', 'rock'],
  archives: ['rock', 'ice', 'rock', 'lava', 'rock', 'ice'],
};

export function planetOf(p: Project): PlanetLook {
  const peers = Number(p.sys.split('-')[1]) - 1;
  const proto = isProtostar(p);
  const kind: PlanetKind = proto ? 'proto' : SEQUENCE[p.sector][peers % SEQUENCE[p.sector].length];
  const radius = p.priority === 'featured' ? 22 : p.priority === 'secondary' ? 17 : 13;
  const ring = !proto && p.priority === 'featured' && (kind === 'gas' || kind === 'ice');
  const seed = (p.index * 7.31) % 10;
  return {
    kind,
    radius: proto ? 15 : radius,
    colors: PALETTES[kind],
    ring,
    tilt: 0.25 + ((p.index * 0.37) % 0.5),
    spin: 0.08 + ((p.index * 0.13) % 0.12),
    seed,
    name: NAMES[kind] + (ring ? ' à anneaux' : ''),
  };
}
