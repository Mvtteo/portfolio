# Mattéo Berthelot — portfolio

Portfolio de Mattéo Berthelot, Data Analyst (V5+). Page unique en HTML/CSS/JS sans framework, construite avec Vite.
Effets portés de React Bits (reactbits.dev, MIT + Commons Clause) en JavaScript : Topography (relief WebGL2 du hero),
TextPressure (nom), ChromaGrid (captures des projets), Magnet (pastilles). L'ancienne version « Data Orbit » reste
dans l'historique git (jusqu'au merge de la PR #4).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
npm run lint
```

## Organisation

- `src/page.html` : gabarit de la page (trous `{{…}}`, `<sc-for>`, `<sc-if>`, `<sc-region>` re-rendues à chaque changement d'état) ;
- `src/main.js` : moteur de gabarit, état (filtres, fiche projet, menu, FAQ) et montage des effets ;
- `src/data.js` : projets, services, parcours, FAQ ;
- `src/topography.js`, `src/fx.js` : effets ; `src/styles.css` : styles ;
- `public/img/` : portrait, photo « À propos », captures des projets.

## Déploiement (Railway, mvtteo.fr)

Le `Dockerfile` construit le site puis le sert avec Caddy (`Caddyfile`) :

- `/` : le portfolio (fichiers de `dist/`, repli sur `index.html`) ;
- `/powerpoint/*` : transmis à l'outil PowerPoint, service Railway séparé (dépôt `Automatisation`) ;
- `/healthz` : contrôle de santé.

Variable `POWERPOINT_UPSTREAM` : adresse de l'outil. Par défaut `powerpoint.railway.internal:8080`, soit un service
nommé `powerpoint` qui écoute sur le port 8080, joint par le réseau privé Railway.
