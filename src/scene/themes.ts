import type { UniverseKey } from '../data/sectors';

/*
 * Identité de chaque univers : type de porte qui y mène, fond (clear color + nébuleuses),
 * décor propre et disposition des portes une fois à l'intérieur. Le noyau garde le trou noir.
 * Tout est en données : ajouter un secteur = ajouter une entrée ici (sinon, thème par défaut).
 */

/** Forme de la porte qui mène à cet univers (identique depuis n'importe où). */
export type GateKind = 'blackhole' | 'stargate' | 'wormhole' | 'rift' | 'vortex';
/** Décor propre à l'univers, centré sur son origine. */
export type DecorKind = 'none' | 'belt' | 'network' | 'comets' | 'gyro';
/** Disposition des portes de sortie dans l'univers. */
export type PortalLayout = 'hub' | 'row' | 'arch' | 'diamond' | 'crown';

/** Nébuleuse : décalage depuis l'origine, rayon, couleur, opacité. */
export type Nebula = [number, number, number, number, string, number];

export interface UniverseTheme {
  /** Nom du lieu, affiché dans le statut. */
  place: string;
  gate: GateKind;
  /** Nom de la porte, affiché au survol (« PORTAIL · … »). */
  gateName: string;
  /** Fond de l'espace dans cet univers (clear color), toujours très sombre. */
  clear: string;
  nebulae: Nebula[];
  decor: DecorKind;
  layout: PortalLayout;
  /** Champ d'étoiles décoratif : rotation (rad) et échelle, pour qu'aucun ciel ne ressemble à un autre. */
  field: { rot: number; scale: number; tilt: number };
}

export const THEMES: Record<UniverseKey, UniverseTheme> = {
  hub: {
    place: 'Noyau',
    gate: 'blackhole',
    gateName: 'TROU NOIR · RETOUR AU NOYAU',
    clear: '#0E0E12',
    nebulae: [
      [-300, 20, -100, 300, '#862217', 0.2],
      [270, -30, 140, 260, '#862217', 0.2],
      [70, 60, -360, 240, '#788CBE', 0.14],
      [-70, -40, 360, 340, '#C4562E', 0.16],
    ],
    decor: 'none',
    layout: 'hub',
    field: { rot: 0, scale: 1, tilt: 0 },
  },
  data: {
    place: 'Ceinture dorée',
    gate: 'stargate',
    gateName: 'PORTE STELLAIRE',
    clear: '#120D09',
    nebulae: [
      [-320, 30, -260, 380, '#B8661E', 0.16],
      [300, -20, 180, 300, '#862217', 0.18],
      [40, 90, -520, 420, '#FFD696', 0.07],
      [-120, -60, 420, 300, '#C4562E', 0.12],
    ],
    decor: 'belt',
    layout: 'row',
    field: { rot: 1.1, scale: 0.85, tilt: 0.12 },
  },
  ia: {
    place: 'Réseau neuronal',
    gate: 'wormhole',
    gateName: 'TROU DE VER',
    clear: '#0D0A15',
    nebulae: [
      [-260, 60, -300, 420, '#5B3AA8', 0.18],
      [320, -40, 120, 320, '#C9B6FF', 0.08],
      [0, -80, 420, 360, '#8A2A6E', 0.14],
      [180, 140, -480, 300, '#3A2A7A', 0.16],
    ],
    decor: 'network',
    layout: 'arch',
    field: { rot: 2.3, scale: 1.15, tilt: -0.35 },
  },
  web: {
    place: 'Ciel azur',
    gate: 'rift',
    gateName: 'FAILLE SPATIALE',
    clear: '#090D15',
    nebulae: [
      [-300, 40, -200, 380, '#2F5BA8', 0.16],
      [280, 10, 260, 320, '#BFD4FF', 0.07],
      [60, 120, -560, 420, '#1E3C78', 0.18],
      [-200, -90, 380, 260, '#4E7FD0', 0.08],
    ],
    decor: 'comets',
    layout: 'diamond',
    field: { rot: 3.4, scale: 0.95, tilt: 0.28 },
  },
  outils: {
    place: 'Gyroscope',
    gate: 'vortex',
    gateName: 'VORTEX',
    clear: '#0F0F0B',
    nebulae: [
      [-280, 20, -220, 360, '#8C7A2E', 0.14],
      [300, -30, 200, 300, '#FFF2BF', 0.06],
      [20, 100, -480, 360, '#2E6B5E', 0.14],
      [-140, -70, 380, 280, '#862217', 0.12],
    ],
    decor: 'gyro',
    layout: 'crown',
    field: { rot: 4.6, scale: 1.05, tilt: -0.18 },
  },
  archives: {
    place: 'Archives',
    gate: 'vortex',
    gateName: 'VORTEX',
    clear: '#100C0C',
    nebulae: [[-260, 20, -200, 340, '#862217', 0.16]],
    decor: 'none',
    layout: 'crown',
    field: { rot: 5.5, scale: 1, tilt: 0 },
  },
};
