export type SectorKey = 'data' | 'ia' | 'web' | 'outils' | 'archives';
export type StarClass = 'G' | 'A' | 'pulsar' | 'cepheid' | 'binary';

export interface StarType {
  /** Couleur du point central (corps noir). */
  core: string;
  /** Couleur du halo : c'est aussi la couleur d'accent du secteur dans le HUD (texte ≥ 9:1 sur #0E0E12). */
  halo: string;
  name: string;
}

/*
 * Chaque secteur est un type d'objet stellaire. La couleur n'est jamais seule : le type se lit
 * aussi à la forme (aigrettes, faisceaux, pulsation, compagnon) et à l'icône du HUD.
 */
export const STAR_TYPES: Record<StarClass, StarType> = {
  G: { core: '#FFF1D6', halo: '#FFD696', name: 'Naine jaune · classe G' },
  A: { core: '#E6EEFF', halo: '#BFD4FF', name: 'Étoile blanc-bleu · classe A' },
  pulsar: { core: '#F4F0FF', halo: '#C9B6FF', name: 'Pulsar · étoile à neutrons' },
  cepheid: { core: '#FFF8E6', halo: '#FFF2BF', name: 'Céphéide · étoile pulsante' },
  binary: { core: '#FFB08A', halo: '#FF9E78', name: 'Système binaire · classes K + M' },
};

/** Projet sans dépôt ni démo publics : proto-étoile (cocon + jets), quel que soit le secteur. */
export const PROTOSTAR_NAME = 'Proto-étoile · rien de public';

export interface Sector {
  key: SectorKey;
  /** Préfixe de l'identifiant système (D-01, I-02…). */
  prefix: string;
  label: string;
  name: string;
  star: StarClass;
  /** = STAR_TYPES[star].halo, recopié pour le HUD. */
  color: string;
  center: [number, number, number];
}

type SectorDef = Omit<Sector, 'color'>;

/** Ajouter un secteur = ajouter une entrée ici. Les étoiles (anneau r = 72 autour du centre) restent hors du disque d'accrétion (r ≤ 110). */
const DEFS: SectorDef[] = [
  { key: 'data', prefix: 'D', label: 'DATA', name: 'Secteur Data', star: 'G', center: [-210, 10, -36] },
  { key: 'ia', prefix: 'I', label: 'IA & AUTOMATION', name: 'IA & automation', star: 'pulsar', center: [-84, -80, 258] },
  { key: 'web', prefix: 'W', label: 'WEB', name: 'Secteur Web', star: 'A', center: [210, -15, 54] },
  { key: 'outils', prefix: 'O', label: 'OUTILS & APPS', name: 'Outils & applications', star: 'cepheid', center: [258, 85, -228] },
  { key: 'archives', prefix: 'A', label: 'ARCHIVES', name: 'Archives & forks', star: 'binary', center: [-24, 125, -282] },
];

export const SECTORS: Sector[] = DEFS.map((d) => ({ ...d, color: STAR_TYPES[d.star].halo }));

export const SECTOR_BY_KEY = Object.fromEntries(SECTORS.map((s) => [s.key, s])) as Record<SectorKey, Sector>;
