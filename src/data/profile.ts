/*
 * Contenu professionnel : brief §9, repris dans les maquettes validées.
 * Recoupé avec le CV (25/10/2026).
 */

export const PROFILE = {
  name: 'Mattéo Berthelot',
  role: 'Data Analyst — Social Media Analytics, Web Analytics & Automation',
  pitch:
    'J’exploite les données pour produire des analyses utiles à la décision, comprendre les parcours utilisateurs et automatiser les reportings.',
  about:
    'Data Analyst spécialisé en performance social media et web analytics. J’exploite les données pour produire des analyses utiles à la décision, comprendre les parcours utilisateurs et automatiser les processus de reporting. Mastère Management, Data & IA en cours, avec un intérêt particulier pour l’automatisation appuyée sur l’IA.',
  current: 'ALTERNANCE · RAZORFISH (PUBLICIS) · PARIS',
  school: 'MASTÈRE MANAGEMENT, DATA & IA · EFREI',
  email: 'mvtte0@proton.me',
  linkedin: 'https://linkedin.com/in/mvtte0',
  github: 'https://github.com/Mvtteo',
  /** À renseigner quand le PDF sera dans public/ (ex. '/cv-matteo-berthelot.pdf'). Tant que null : aucun faux téléchargement. */
  cvUrl: '/cv-matteo-berthelot.pdf' as string | null,
};

export const FACTS: [string, string][] = [
  ['ACTUEL', 'Data Analyst en alternance · Razorfish (Publicis) · Paris'],
  ['FORMATION', 'Mastère Management, Data & IA (M1) · EFREI'],
  ['OUTILS', 'Python · SQL · Adobe Analytics · Tableau · Knime'],
];

export interface Experience {
  when: string;
  title: string;
  points: [string, string][];
}

export const EXPERIENCE: Experience[] = [
  {
    when: 'DEPUIS 2025 · PARIS',
    title: 'Data Analyst en alternance — Razorfish (Publicis)',
    points: [
      ['Social Media Analytics.', 'Collecte, traitement et analyse de la performance social media sur plusieurs marques et marchés ; reportings récurrents pour les équipes clientes.'],
      ['Web Analytics.', 'Parcours utilisateurs, taux de conversion et tunnels de leads sur des dispositifs web du secteur automobile, sous Adobe Analytics.'],
      ['Automation.', 'Industrialisation de processus de reporting récurrents en Python.'],
    ],
  },
  { when: '2024–2025 · JONZAC', title: 'Conseiller Proxi en alternance — BNP Paribas', points: [] },
];

export const SKILLS: { label: string; items: string[] }[] = [
  { label: 'DATA ANALYSIS', items: ['Python', 'pandas', 'scikit-learn', 'SQL', 'Analyse exploratoire', 'Nettoyage de données', 'Statistiques & clustering'] },
  { label: 'ANALYTICS & VISUALISATION', items: ['Adobe Analytics', 'Tableau', 'Excel', 'Parcours utilisateurs', 'Taux de conversion', 'Social Media Analytics', 'Reporting'] },
  { label: 'AUTOMATION & DÉVELOPPEMENT', items: ['Python (reporting)', 'Knime', 'HTML', 'CSS', 'JavaScript', 'React', 'Notion'] },
  { label: 'SAVOIR-ÊTRE', items: ['Analyse et synthèse', 'Rigueur', 'Autonomie', 'Gestion de projet', 'Adaptabilité'] },
];

/** Source : CV du 25/10/2026. */
export const EDUCATION: { years: string; title: string; school: string }[] = [
  { years: '2026 →', title: 'Mastère Management, Data & IA (M1)', school: 'EFREI' },
  { years: '2025–2026', title: 'Bachelor Data & IA', school: 'HETIC · obtenu' },
  { years: '2024–2025', title: 'Bachelor Banque Assurance', school: 'École supérieure de la banque' },
  { years: '2023–2024', title: 'Data Analyst — RNCP niveau 6', school: 'OpenClassrooms · obtenu' },
  { years: '2022–2023', title: 'Développeur intégrateur web — RNCP niveau 5', school: 'OpenClassrooms · obtenu' },
  { years: '2020–2021', title: 'Bachelor Business & Management', school: 'Institut supérieur de gestion' },
];

export const CONSULTING = {
  title: 'Transform your data into actionable insights.',
  pitch: 'J’accompagne les entreprises dans l’analyse de leurs données, la compréhension de leurs performances digitales et l’automatisation de leurs reportings.',
  offers: [
    ['Analytics & Performance', 'Performance social media, web analytics, parcours utilisateurs, indicateurs de conversion.'],
    ['Reporting & Data Visualization', 'Structuration de reportings, tableaux de bord, visualisation des indicateurs clés.'],
    ['Automation & Data Processing', 'Automatisation de tâches de reporting récurrentes et traitement de données en Python.'],
  ] as [string, string][],
  needs: ['Analytics & Performance', 'Reporting & Dataviz', 'Automation', 'Autre'],
};

/**
 * Service d'envoi du formulaire consulting. null = aucun service branché :
 * l'envoi affiche un échec explicite et renvoie vers l'email. Voir README « Formulaire ».
 */
export const FORM_ENDPOINT: string | null = import.meta.env.VITE_FORM_ENDPOINT || null;

export type SectionKey = 'profil' | 'experience' | 'competences' | 'formation' | 'consulting' | 'contact';

export const NAV: [SectionKey | 'projets', string][] = [
  ['profil', 'PROFIL'],
  ['experience', 'EXPÉRIENCE'],
  ['projets', 'PROJETS'],
  ['competences', 'COMPÉTENCES'],
  ['formation', 'FORMATION'],
  ['consulting', 'CONSULTING'],
  ['contact', 'CONTACT'],
];

export const KICKERS: Record<SectionKey, string> = {
  profil: 'NOYAU · PROFIL',
  experience: 'SECTION · EXPÉRIENCE',
  competences: 'SECTION · COMPÉTENCES',
  formation: 'SECTION · FORMATION',
  consulting: 'SECTION · CONSULTING',
  contact: 'SECTION · CONTACT',
};
