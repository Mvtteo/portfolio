import { SECTORS, SECTOR_BY_KEY, type SectorKey } from './sectors';

export type Priority = 'featured' | 'secondary' | 'archive';

export interface ProjectEntry {
  /** Stable, sert de clé. */
  id: string;
  sector: SectorKey;
  /** featured = étoile ×1,25. */
  priority: Priority;
  title: string;
  /** Libellé court pour précédent / suivant. */
  short: string;
  status: string;
  /** false → puce pointillée avec `note`. */
  statusVerified: boolean;
  /** Information manquante ou à vérifier, dite explicitement (puce pointillée). */
  note: string | null;
  /** Factuelle : uniquement ce qui se lit dans le dépôt ou le brief. */
  description: string;
  tech: string[];
  repoUrl: string | null;
  /** Seulement si l'URL a été ouverte et sert bien le projet. */
  demoUrl: string | null;
  /** Nature de la démo quand elle n'est pas l'application complète (API simulée, données fictives…). */
  demoNote?: string;
  lastCommit: string | null;
  /** Seulement si une capture réelle existe dans le projet. */
  preview?: string;
  /** Masqué du front (tri du 25/10/2026) : doublon, dépôt vide ou fork sans contribution. */
  hidden?: boolean;
}

export interface Project extends ProjectEntry {
  index: number;
  /** Identifiant affiché, calculé : D-01, W-03… */
  sys: string;
  pos: [number, number, number];
}

const GH = 'https://github.com/Mvtteo/';
const BRIEF_NOTE = 'Dépôt non publié';

/*
 * Inventaire du 25/10/2026 : API GitHub (25 dépôts publics, statut fork et parent lus) + clone de chaque dépôt.
 * Démos : seules les URL GitHub Pages ouvertes et qui servent bien le projet sont renseignées.
 * Détail des sources et des points à vérifier : TODO.md.
 */
const ENTRIES: ProjectEntry[] = [
  // ---------- Data ----------
  {
    id: 'forensic', sector: 'data', priority: 'featured',
    title: 'Enquête forensic', short: 'Forensic',
    status: 'Projet d’analyse', statusVerified: true, note: null,
    description:
      'Notebook d’enquête sur un jeu de données (employés, transactions, accès, emails, interrogatoires) : contrôles préalables, ACP et K-means, arbre de décision, tests de Kruskal-Wallis, Dunn et Welch. Un agent LLM (API Groq) est interrogé sur les emails. Rapport PDF dans le dépôt.',
    tech: ['Python', 'pandas', 'scikit-learn', 'SciPy', 'Plotly', 'Groq'],
    repoUrl: GH + 'Stats', demoUrl: 'https://mvtteo.github.io/Stats/',
    demoNote: 'Notebook publié en HTML, graphiques interactifs.', lastCommit: '2026-04-29',
  },
  {
    id: 'faim', sector: 'data', priority: 'featured',
    title: 'Étude mondiale de santé publique', short: 'Santé publique',
    status: 'Projet OpenClassrooms', statusVerified: true, note: 'Notebook dans une archive zip',
    description:
      'Analyse des pays les plus exposés à la faim en Python : DataFrames, jointures et tris. Le dépôt contient les jeux de données FAO (population, sous-nutrition, aide et disponibilité alimentaires) et le notebook dans une archive.',
    tech: ['Python', 'pandas', 'Jupyter'],
    repoUrl: GH + 'Projet4', demoUrl: 'https://mvtteo.github.io/Projet4/',
    demoNote: 'Notebook publié en HTML ; une sortie de 131 Mo y est tronquée.', lastCommit: '2023-05-29',
  },
  {
    id: 'immo-sql', sector: 'data', priority: 'featured',
    title: 'Base de données immobilière', short: 'BDD immobilière',
    status: 'Projet OpenClassrooms', statusVerified: true, note: BRIEF_NOTE,
    description: 'Conception de l’architecture d’une base de données, rédaction du dictionnaire de données et analyse en SQL.',
    tech: ['SQL'], repoUrl: null, demoUrl: null, lastCommit: null,
  },
  {
    id: 'eau', sector: 'data', priority: 'featured',
    title: 'Accès à l’eau potable', short: 'Eau potable',
    status: 'Projet OpenClassrooms', statusVerified: true, note: BRIEF_NOTE,
    description: 'Tableau de bord interactif : sélection d’indicateurs et visualisation des données par zone géographique.',
    tech: ['Tableau'], repoUrl: null, demoUrl: null, lastCommit: null,
  },
  {
    id: 'export', sector: 'data', priority: 'featured',
    title: 'Étude de marché — pays d’exportation', short: 'Étude de marché',
    status: 'Projet OpenClassrooms', statusVerified: true, note: BRIEF_NOTE,
    description: 'Nettoyage des données, matrice de corrélation, ACP, dendrogramme et clustering pour définir un pays d’exportation.',
    tech: ['Python'], repoUrl: null, demoUrl: null, lastCommit: null,
  },
  {
    id: 'billets', sector: 'data', priority: 'featured',
    title: 'Détection de faux billets', short: 'Faux billets',
    status: 'Projet OpenClassrooms', statusVerified: true, note: BRIEF_NOTE,
    description: 'Régression linéaire et ACP, puis comparaison entre K-means et régression logistique.',
    tech: ['Python'], repoUrl: null, demoUrl: null, lastCommit: null,
  },
  {
    id: 'p6', hidden: true, sector: 'data', priority: 'archive',
    title: 'p6', short: 'p6',
    status: 'Données seules', statusVerified: false, note: 'Contexte à préciser',
    description: 'Deux fichiers CSV (clients, produits) publiés sans notebook ni README.',
    tech: ['CSV'], repoUrl: GH + 'p6', demoUrl: null, lastCommit: '2023-07-29',
  },

  // ---------- IA & automation ----------
  {
    id: 'impressions-er', sector: 'ia', priority: 'featured',
    title: 'Graphiques Impressions × ER', short: 'Impressions × ER',
    status: 'Outil d’automatisation', statusVerified: true, note: 'Dépôt privé',
    description:
      'Application web : on colle les colonnes d’un export social media (marque, plateforme, lien, date, impressions, engagement rate) et elle produit un PowerPoint, une slide par marque. Chaque slide porte un graphique combiné : impressions en barres sur un axe en milliers, engagement rate en courbe sur un axe en %. Sous chaque barre, le logo de la plateforme ouvre la publication. Aperçu en direct, taille des logos réglable, aucune donnée conservée.',
    tech: ['Python', 'FastAPI', 'python-pptx', 'JavaScript', 'Chart.js'],
    repoUrl: null, demoUrl: null, lastCommit: '2026-10-25',
    preview: '/projects/quick-timeseries.jpg',
  },
  {
    id: 'crosspost', sector: 'ia', priority: 'featured',
    title: 'Détection de crossposts Instagram', short: 'is_crosspost',
    status: 'Script d’automatisation', statusVerified: true, note: null,
    description:
      'Script qui lit un fichier Excel de publications Instagram, retrouve le compte auteur de chaque post et indique s’il a été publié par le compte officiel de la marque, puis met le fichier à jour.',
    tech: ['Python', 'pandas', 'openpyxl', 'Instaloader'],
    repoUrl: GH + 'is_crosspost', demoUrl: null, lastCommit: '2026-07-08',
  },
  {
    id: 'flappy', sector: 'ia', priority: 'featured',
    title: 'Flappy Bird & neuroévolution', short: 'Flappy Bird',
    status: 'Projet personnel', statusVerified: true, note: null,
    description:
      'Jeu Flappy Bird en Pygame et agents qui apprennent à y jouer : bot naïf, perceptron et neuroévolution NEAT, avec points de sauvegarde, courbe de fitness et visualisation du réseau.',
    tech: ['Python', 'Pygame', 'NEAT', 'NumPy', 'Matplotlib'],
    repoUrl: GH + 'Flappy_bird', demoUrl: 'https://mvtteo.github.io/Flappy_bird/',
    demoNote: 'Jeu jouable dans le navigateur (WebAssembly, pygbag).', lastCommit: '2026-04-02',
  },
  {
    id: 'pipes', sector: 'ia', priority: 'featured',
    title: 'Détection de canalisations', short: 'ML pipes',
    status: 'Projet de machine learning', statusVerified: true, note: 'Données non incluses',
    description:
      'Classification d’images « pipes / nopipes » : normalisation, ACP conservant 95 % de la variance, puis k plus proches voisins évalués au F1-score. Le jeu de données n’est pas dans le dépôt.',
    tech: ['Python', 'scikit-learn', 'scikit-image', 'NumPy'],
    repoUrl: GH + 'ML-pipesdetection', demoUrl: null, lastCommit: '2026-04-23',
  },
  {
    id: 'kamas', sector: 'ia', priority: 'secondary',
    title: 'Kamas counter', short: 'Kamas counter',
    status: 'Projet personnel', statusVerified: true, note: null,
    description: 'Application Flask qui lit une capture d’écran et en extrait les montants de kamas (monnaie du jeu Dofus) par OCR.',
    tech: ['Python', 'Flask', 'EasyOCR', 'JavaScript'],
    repoUrl: GH + 'kamas_counter', demoUrl: 'https://mvtteo.github.io/kamas_counter/',
    demoNote: 'Aperçu de l’interface seulement : l’OCR tourne côté serveur.', lastCommit: '2026-01-19',
  },

  // ---------- Web ----------
  {
    id: 'booki', sector: 'web', priority: 'secondary',
    title: 'Booki', short: 'Booki',
    status: 'Exercice d’intégration', statusVerified: true, note: null,
    description:
      'Page d’accueil d’un site d’hébergements intégrée d’après une maquette : ancres de navigation, versions tablette et mobile, validation W3C (d’après le README).',
    tech: ['HTML', 'CSS'],
    repoUrl: GH + 'booki', demoUrl: 'https://mvtteo.github.io/booki/', lastCommit: '2022-02-19',
  },
  {
    id: 'ohmyfood', sector: 'web', priority: 'secondary',
    title: 'Ohmyfood', short: 'Ohmyfood',
    status: 'Projet web', statusVerified: false, note: 'Statut à vérifier',
    description: 'Site de réservation de menus : page d’accueil et quatre pages de menus, styles écrits en Sass.',
    tech: ['HTML', 'Sass'],
    repoUrl: GH + 'ohmyfood', demoUrl: 'https://mvtteo.github.io/ohmyfood/', lastCommit: '2022-04-10',
  },
  {
    id: 'ohmyfoodsass', hidden: true, sector: 'web', priority: 'secondary',
    title: 'Ohmyfood — version Sass', short: 'Ohmyfood Sass',
    status: 'Projet web', statusVerified: false, note: 'Statut à vérifier',
    description:
      'Autre version d’Ohmyfood : page d’accueil et quatre pages restaurant, Sass organisé en abstracts, components, layout et pages.',
    tech: ['HTML', 'Sass'],
    repoUrl: GH + 'ohmyfoodsass', demoUrl: 'https://mvtteo.github.io/ohmyfoodsass/', lastCommit: '2022-04-29',
  },
  {
    id: 'ghpages', hidden: true, sector: 'web', priority: 'secondary',
    title: 'mvtteo.github.io', short: 'github.io',
    status: 'Publication GitHub Pages', statusVerified: true, note: null,
    description: 'Dépôt GitHub Pages du compte : il publie une version d’Ohmyfood à la racine de mvtteo.github.io.',
    tech: ['HTML', 'CSS'],
    repoUrl: GH + 'mvtteo.github.io', demoUrl: 'https://mvtteo.github.io/', lastCommit: '2022-04-10',
  },
  {
    id: 'lapanthere', sector: 'web', priority: 'secondary',
    title: 'La Panthère', short: 'La Panthère',
    status: 'Projet web', statusVerified: false, note: 'Part de travail à vérifier',
    description: 'Site de l’agence web « La Panthère » : HTML, CSS, JavaScript et formulaire de contact en PHP.',
    tech: ['HTML', 'CSS', 'JavaScript', 'PHP'],
    repoUrl: GH + 'Lapanthere', demoUrl: 'https://mvtteo.github.io/Lapanthere/', lastCommit: '2022-05-18',
  },
  {
    id: 'kanap', sector: 'web', priority: 'secondary',
    title: 'Kanap', short: 'Kanap',
    status: 'Projet de formation', statusVerified: true, note: null,
    description:
      'Site e-commerce de canapés : pages d’accueil, produit, panier et confirmation en JavaScript, branchées sur l’API fournie dans le dossier back/ (d’après le README).',
    tech: ['JavaScript', 'HTML', 'CSS', 'Node.js'],
    repoUrl: GH + 'Kanap', demoUrl: 'https://mvtteo.github.io/Kanap/',
    demoNote: 'Démo statique : l’API du dossier back/ est simulée dans le navigateur.', lastCommit: '2022-08-10',
  },
  {
    id: 'kanapfront', hidden: true, sector: 'web', priority: 'archive',
    title: 'kanapFront', short: 'kanapFront',
    status: 'Projet web', statusVerified: false, note: 'Copie partielle de Kanap',
    description: 'Les quatre scripts front-end de Kanap (accueil, produit, panier, confirmation), publiés à part.',
    tech: ['JavaScript'],
    repoUrl: GH + 'kanapFront', demoUrl: null, lastCommit: '2022-08-29',
  },
  {
    id: 'kasa', sector: 'web', priority: 'secondary',
    title: 'Kasa', short: 'Kasa',
    status: 'Projet de formation', statusVerified: true, note: null,
    description:
      'Application React de location de logements : pages accueil, logement, à propos et erreur, routage React Router, styles Sass, chargement et gestion d’erreur.',
    tech: ['React', 'React Router', 'Sass'],
    repoUrl: GH + 'Kasa', demoUrl: 'https://mvtteo.github.io/Kasa/', lastCommit: '2022-11-11',
  },
  {
    id: 'piiquante', sector: 'web', priority: 'secondary',
    title: 'Piiquante', short: 'Piiquante',
    status: 'Projet de formation', statusVerified: false, note: 'Statut à vérifier',
    description:
      'API REST Node.js : utilisateurs et sauces, authentification par jeton JWT, mots de passe hachés (bcrypt), envoi d’images (multer), base MongoDB via Mongoose.',
    tech: ['Node.js', 'Express', 'MongoDB', 'JWT'],
    repoUrl: GH + 'Piiquante', demoUrl: null, lastCommit: '2022-10-04',
  },

  // ---------- Outils & applications ----------
  {
    id: 'dofus', sector: 'outils', priority: 'featured',
    title: 'Dofus leaderboard', short: 'Leaderboard',
    status: 'Projet personnel', statusVerified: true, note: null,
    description:
      'Classement pour une communauté Dofus : API FastAPI et SQLAlchemy (migrations Alembic), bot Discord, client React (Vite), lecture d’images via l’API Groq, déploiement Docker (d’après le README).',
    tech: ['Python', 'FastAPI', 'SQLAlchemy', 'discord.py', 'React', 'Docker'],
    repoUrl: GH + 'dofus_leaderboard', demoUrl: 'https://mvtteo.github.io/dofus_leaderboard/',
    demoNote: 'Démo du client avec joueurs et combats fictifs.', lastCommit: '2026-08-03',
  },
  {
    id: 'pomodoro', sector: 'outils', priority: 'secondary',
    title: 'Pomodoro de bureau', short: 'Pomodoro',
    status: 'Projet personnel', statusVerified: true, note: null,
    description:
      'Minuteur Pomodoro en Python : icône dans la barre système, liste de tâches, fenêtre de pause, lancement au démarrage et empaquetage en exécutable.',
    tech: ['Python', 'PyQt6', 'PyInstaller'],
    repoUrl: GH + 'Claudecode_pomodoro', demoUrl: null, lastCommit: '2026-05-03',
  },
  {
    id: 'spotify', sector: 'outils', priority: 'secondary',
    title: 'Feature de Mix — Spotify', short: 'Feature de Mix',
    status: 'Projet EFREI', statusVerified: true, note: null,
    description:
      'Présentation HTML (et PDF) d’une fonctionnalité Spotify : plan de réalisation, stratégie test & learn, mesure de l’adoption, RGPD, équilibre économique, passage à l’échelle et grille valeur / faisabilité / ROI.',
    tech: ['HTML', 'Sass', 'Docker', 'nginx'],
    repoUrl: GH + 'spotify_pres', demoUrl: 'https://mvtteo.github.io/spotify_pres/', lastCommit: '2026-09-16',
  },

  // ---------- Archives & forks ----------
  {
    id: 'scribe', hidden: true, sector: 'archives', priority: 'archive',
    title: 'Projet Scribe', short: 'Scribe',
    status: 'Fork', statusVerified: true, note: 'Fork de Leop250/Projet_Scribe',
    description:
      'Fork du « projet fil rouge DATA IA3 » de Leop250. La branche principale ne contient que le README et la licence ; aucune contribution propre n’est vérifiée.',
    tech: [], repoUrl: GH + 'Projet_Scribe', demoUrl: null, lastCommit: '2026-06-22',
  },
  {
    id: 'jarvis', hidden: true, sector: 'archives', priority: 'archive',
    title: 'DIA3 Jarvis', short: 'Jarvis',
    status: 'Fork', statusVerified: true, note: 'Fork de HorHakim/DIA3_Jarvis',
    description:
      'Fork d’un agent conversationnel en Python (interface et agent de conversation) créé par HorHakim. La part de contribution propre n’est pas vérifiée.',
    tech: ['Python'], repoUrl: GH + 'DIA3_Jarvis', demoUrl: null, lastCommit: '2025-12-08',
  },
  {
    id: 'claw', hidden: true, sector: 'archives', priority: 'archive',
    title: 'claw-code', short: 'claw-code',
    status: 'Fork', statusVerified: true, note: 'Fork de ultraworkers/claw-code',
    description: 'Fork d’un projet tiers en Rust, conservé tel quel. Ce n’est pas une création originale.',
    tech: ['Rust'], repoUrl: GH + 'claw-code', demoUrl: null, lastCommit: '2026-04-22',
  },
  {
    id: 'esplace', hidden: true, sector: 'archives', priority: 'archive',
    title: 'esplace-war', short: 'esplace-war',
    status: 'Fork', statusVerified: true, note: 'Fork de YisusOnDev/esplace-war',
    description:
      'Userscript pour r/place (Reddit). L’en-tête du script attribue le code à ForsenPlace, modifié par YisusOnDev : ce n’est pas une création originale.',
    tech: ['JavaScript', 'Userscript'], repoUrl: GH + 'esplace-war', demoUrl: null, lastCommit: '2022-04-04',
  },
  {
    id: 'kanaprepo', hidden: true, sector: 'archives', priority: 'archive',
    title: 'KanapRepo', short: 'KanapRepo',
    status: 'Dépôt vide', statusVerified: true, note: null,
    description: 'Dépôt public sans aucun fichier.',
    tech: [], repoUrl: GH + 'KanapRepo', demoUrl: null, lastCommit: null,
  },
  {
    id: 'bottleneck', hidden: true, sector: 'archives', priority: 'archive',
    title: 'bottleneck', short: 'bottleneck',
    status: 'Dépôt vide', statusVerified: true, note: null,
    description: 'Dépôt public sans aucun fichier.',
    tech: [], repoUrl: GH + 'bottleneck', demoUrl: null, lastCommit: null,
  },
];

/** Position calculée : projet i d'un secteur de n → anneau r=72, angle 2πi/n + 0,4, hauteur sin(2a)·22. */
function layout(entries: ProjectEntry[]): Project[] {
  return entries.map((p, index) => {
    const sector = SECTOR_BY_KEY[p.sector];
    const peers = entries.filter((q) => q.sector === p.sector);
    const i = peers.indexOf(p);
    const n = peers.length;
    const [cx, cy, cz] = sector.center;
    const a = (i / n) * Math.PI * 2 + 0.4;
    const pos: [number, number, number] = n === 1 ? [cx, cy, cz] : [cx + Math.cos(a) * 72, cy + Math.sin(a * 2) * 22, cz + Math.sin(a) * 72];
    return { ...p, index, sys: `${sector.prefix}-${String(i + 1).padStart(2, '0')}`, pos };
  });
}

/** Ordre stable = ordre du fichier, regroupé par secteur dans l'ordre de SECTORS. */
export const PROJECTS: Project[] = layout(SECTORS.flatMap((s) => ENTRIES.filter((e) => e.sector === s.key && !e.hidden)));
export const N = PROJECTS.length;

export const SECTOR_COUNTS = Object.fromEntries(SECTORS.map((s) => [s.key, PROJECTS.filter((p) => p.sector === s.key).length])) as Record<
  SectorKey,
  number
>;

/** Secteurs affichés : un secteur dont tous les projets sont masqués disparaît de la carte et des filtres. */
export const ACTIVE_SECTORS = SECTORS.filter((s) => SECTOR_COUNTS[s.key] > 0);

export type Filter = SectorKey | 'all';

const MONTHS = ['JANV.', 'FÉV.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];

export function metaOf(p: Project): [string, string] {
  if (p.lastCommit) {
    const [y, m] = p.lastCommit.split('-');
    return ['DERNIER COMMIT', `${MONTHS[Number(m) - 1]} ${y}`];
  }
  if (p.repoUrl) return ['CONTENU', 'DÉPÔT VIDE'];
  return ['SOURCE', 'CV — OPENCLASSROOMS DATA ANALYST'];
}

export function techLine(p: Project) {
  return p.tech.length ? p.tech.join(' · ').toUpperCase() : '—';
}

export function searchText(p: Project) {
  const s = SECTOR_BY_KEY[p.sector];
  return `${p.title} ${p.short} ${p.tech.join(' ')} ${s.label} ${s.name} ${p.sys} ${p.status}`.toLowerCase();
}

export function matchesQuery(p: Project, query: string) {
  const q = query.trim().toLowerCase();
  return !q || searchText(p).includes(q);
}

/** Précédent / suivant : parcourt le secteur du projet, en boucle. */
export function neighbours(i: number): [Project, Project] {
  const peers = PROJECTS.filter((p) => p.sector === PROJECTS[i].sector);
  const k = peers.findIndex((p) => p.index === i);
  return [peers[(k + peers.length - 1) % peers.length], peers[(k + 1) % peers.length]];
}

export function linkNote(p: Project) {
  if (!p.repoUrl) return 'Aucun dépôt public pour ce projet : contenu issu du CV.';
  if (p.demoUrl) return p.demoNote ? `Démo GitHub Pages vérifiée le 25/10/2026. ${p.demoNote}` : 'Démo publiée sur GitHub Pages, ouverte et vérifiée le 25/10/2026.';
  return 'Aucune démo vérifiée : le dépôt est la seule ressource disponible.';
}
