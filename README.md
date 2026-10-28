# Mattéo Berthelot — portfolio

Portfolio de Mattéo Berthelot, Data Analyst (V5+). Page unique en HTML/CSS/JS sans framework, construite avec Vite.
Polices : Lexend Exa (titres, OFL) et Archivo (texte), via Google Fonts. Couleur d'accent : vert de la veste (#2D3E42).
Effets portés de React Bits (reactbits.dev, MIT + Commons Clause) en JavaScript : Topography (relief WebGL2 du hero),
TextPressure (nom), Magnet (pastilles). Les projets de la sélection ont une page `/projets/<id>` (mission, parcours, rendu). L'ancienne version « Data Orbit » reste
dans l'historique git (jusqu'au merge de la PR #4).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
npm run lint
```

## Organisation

- `src/tpl/` : gabarits (`nav`, `home`, `project`, `end`) avec trous `{{…}}`, `<sc-for>`, `<sc-if>`, `<sc-region>` ;
- `src/engine.js` : moteur de gabarit ; `src/main.js` : route (accueil ou page projet), état, effets ;
- `src/data.js` : projets, récits des pages projet (`STORIES`), services, parcours, étapes du consulting ;
- `src/topography.js`, `src/fx.js` : effets ; `src/styles.css` : styles ;
- `public/img/` : portrait et captures des projets ; `public/favicon.ico` : monogramme MB.

## Déploiement (Railway, mvtteo.fr)

Le `Dockerfile` construit le site puis le sert avec Caddy (`Caddyfile`) :

- `/` : le portfolio (fichiers de `dist/`, repli sur `index.html`) ;
- `/powerpoint/*` : transmis à l'outil PowerPoint, service Railway séparé (dépôt `Automatisation`) ;
- `/healthz` : contrôle de santé.

Variable `POWERPOINT_UPSTREAM` : adresse de l'outil. Par défaut `powerpoint.railway.internal:8080`, soit un service
nommé `powerpoint` qui écoute sur le port 8080, joint par le réseau privé Railway.
