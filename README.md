# DATA ORBIT — Explore my universe

Portfolio de Mattéo Berthelot, Data Analyst. Carte stellaire en 3D (WebGL) où chaque étoile est un projet réel ;
HUD pour le profil, l'expérience, les compétences, la formation, le consulting et le contact.
Les specs et maquettes d’origine ont été retirées du dépôt (Corbeille, 25/10/2026). L’ancienne « grande roue »
aussi.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + build de production dans dist/
npm run lint
```

## Déploiement (Railway, mvtteo.fr)

Le `Dockerfile` construit le site puis le sert avec Caddy (`Caddyfile`) :

- `/` : le portfolio (fichiers de `dist/`, repli sur `index.html`) ;
- `/powerpoint/*` : transmis à l'outil PowerPoint, service Railway séparé (dépôt `Automatisation`) ;
- `/healthz` : contrôle de santé.

Variable `POWERPOINT_UPSTREAM` : adresse de l'outil. Par défaut `powerpoint.railway.internal:8080`, soit un service
nommé `powerpoint` qui écoute sur le port 8080, joint par le réseau privé Railway.

## Organisation

| Dossier | Contenu |
|---|---|
| `src/data/` | `projects.ts` (29 projets typés, positions calculées), `sectors.ts` (5 secteurs), `profile.ts` (contenu pro, liens, CV, formulaire). |
| `src/scene/` | `engine.ts` (caméra, interaction, hit-test, hors React), `StarMap.tsx` (scène R3F, chargée à la demande), `SceneLayer.tsx` (pointeur, pincement, repli), `SceneOverlays.tsx` (libellés, réticule). |
| `src/hud/` | Pièces communes : fiche projet, liste, sections, formulaire, icônes. |
| `src/desktop/` | Composition ≥ 900 px (menu « SECTIONS » sous 1240 px, colonne compacte sous 860 px de haut). |
| `src/mobile/` | Composition < 900 px : scène simplifiée, feuilles fiche / liste, menu à onglets. |

**Ajouter un projet** : une entrée dans `ENTRIES` (`src/data/projects.ts`). Identifiant (`D-03`…) et position sont calculés.
**Ajouter un secteur** : une entrée dans `SECTORS` (`src/data/sectors.ts`).

## Scène et performance

- Vraie 3D : Three.js via React Three Fiber. Étoiles décoratives = une seule géométrie `Points` + shader (taille
  atténuée par la distance), 1 600 desktop / 900 mobile, graine fixe. Nébuleuses en sprites.
- Un seul `useFrame` : `engine.tick` fait avancer la caméra puis la scène met à jour tailles et couleurs en place.
  React ne re-rend que sur des changements discrets (survol, sélection, arrivée, filtre).
- Sélection : hit-test en écran sur les positions projetées des seules étoiles projet (rayon ≥ 16 px, 24 px mobile).
  Les étoiles décoratives n'interceptent jamais un clic. Un glisser de plus de 5 px est une orbite, pas un clic.
- Le HUD (89 Ko gzip) s'affiche tout de suite ; la scène (Three.js, 245 Ko gzip) se charge ensuite.
- `dpr` plafonné à 2 (1,5 mobile).

## Repli et accessibilité

- Sans WebGL, en cas d'erreur de la scène ou sous ~12 images/s : vue Liste directement, avec le HUD. `?liste` dans
  l'URL force ce mode pour le tester.
- `prefers-reduced-motion` (suivi en direct) : ni dérive ni particules, caméra téléportée, panneaux sans glissement.
- Lien d'évitement vers la liste, cibles tactiles de 44 px sur mobile, champs en 16 px (pas de zoom iOS).
- Tout ce qui se fait dans la scène se fait au clavier (recherche, secteurs, liste, précédent / suivant).
  Focus sur le titre à l'ouverture d'une fiche, rendu au déclencheur, Escape, piège de focus dans les feuilles mobiles.

## Formulaire consulting

Sans service branché, le bouton devient « PRÉPARER L'EMAIL » : la messagerie du visiteur s'ouvre avec le message
pré-rempli (`mailto:`), sans jamais annoncer un envoi. Validation champ par champ (erreur sous le champ, reliée par
`aria-describedby`, focus sur le premier champ invalide). Pour un envoi direct, créer un formulaire Formspree (ou tout
service acceptant un POST JSON) et définir au build :

```bash
VITE_FORM_ENDPOINT=https://formspree.io/f/xxxxxxx npm run build
```

Champs envoyés : `name`, `company`, `email`, `need`, `budget`, `message`. Succès affiché seulement si la réponse est OK ;
en cas d'échec, le message pré-rempli est proposé en repli.

## Liens profonds

Chaque fiche et section a une URL : `#/projet/<id>`, `#/profil`, `#/experience`, `#/competences`, `#/formation`,
`#/consulting`, `#/contact`, `#/projets`. Ouvrir un panneau ajoute une entrée d'historique (« Retour » le referme).
Mêmes URL sur desktop et mobile (le menu mobile s'ouvre sur l'onglet de la section).

## CV

Déposer le PDF dans `public/` puis renseigner `PROFILE.cvUrl` dans `src/data/profile.ts`. Tant que c'est `null`,
une mention pointillée « CV · PDF À AJOUTER » remplace tout lien.

## Choix faits en l'absence de spec

- **Secteurs IA & automation et Outils & apps** : l'inventaire complet (25 dépôts, notes internes hors dépôt) contient des
  projets IA vérifiés ; le handover prévoyait d'ajouter un secteur dans ce cas. Formes : losange et hexagone.
- **Position de vue générale** : distance 700 (640 dans la maquette, pensée pour 3 secteurs) et centre décalé de
  150 px à droite pour ne pas passer sous la colonne d'identité ; mobile 1 000.
- **Démos** : seules les GitHub Pages ouvertes le 25/10/2026 et servant bien le projet ont un lien « VOIR LA DÉMO ».
  Kasa est exclu (la page publiée affiche le README, pas l'application).
- La liste desktop suit la recherche en cours ; un lien « Voir les n résultats dans la liste » apparaît au-delà de 6.
