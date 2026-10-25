export type SectorKey = 'data' | 'ia' | 'web' | 'outils' | 'archives';
export type Mark = 'circle' | 'diamond' | 'square' | 'hexagon' | 'triangle';

export interface Sector {
  key: SectorKey;
  /** Préfixe de l'identifiant système (D-01, I-02…). */
  prefix: string;
  label: string;
  name: string;
  /** La forme code le secteur : la couleur n'est jamais seule. */
  mark: Mark;
  center: [number, number, number];
}

/** Ajouter un secteur = ajouter une entrée ici (et une forme dans MARK_PATHS si elle est nouvelle). */
export const SECTORS: Sector[] = [
  { key: 'data', prefix: 'D', label: 'DATA', name: 'Secteur Data', mark: 'circle', center: [-175, 10, -30] },
  { key: 'ia', prefix: 'I', label: 'IA & AUTOMATION', name: 'IA & automation', mark: 'diamond', center: [-70, -80, 215] },
  { key: 'web', prefix: 'W', label: 'WEB', name: 'Secteur Web', mark: 'square', center: [175, -15, 45] },
  { key: 'outils', prefix: 'O', label: 'OUTILS & APPS', name: 'Outils & applications', mark: 'hexagon', center: [215, 85, -190] },
  { key: 'archives', prefix: 'A', label: 'ARCHIVES', name: 'Archives & forks', mark: 'triangle', center: [-20, 125, -235] },
];

export const SECTOR_BY_KEY = Object.fromEntries(SECTORS.map((s) => [s.key, s])) as Record<SectorKey, Sector>;

/** Tracés 12×12 des marques (HUD). La scène dessine les mêmes formes sur canvas. */
export const MARK_PATHS: Record<Mark | 'all', string> = {
  circle: 'M2 6a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
  diamond: 'M6 1.4L10.6 6L6 10.6L1.4 6z',
  square: 'M2.2 2.2h7.6v7.6h-7.6z',
  hexagon: 'M6 1.5L9.9 3.75V8.25L6 10.5L2.1 8.25V3.75z',
  triangle: 'M6 1.6L10.4 9.8H1.6z',
  all: 'M6 1v10M1 6h10',
};
