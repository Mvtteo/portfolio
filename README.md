# Mattéo Berthelot — portfolio

Portfolio de Mattéo Berthelot, Data Analyst (V9 « Cobalt »). Page unique en HTML/CSS/JS sans framework, construite avec Vite.
Thème sombre par défaut, thème clair au choix (mémorisé dans le navigateur). Polices Geist et Geist Mono (Google Fonts).
Le portrait du hero et le visuel du contact ont été générés avec Higgsfield à partir d'une photo de Mattéo ; l'image
« scan » est un montage fait à partir de la photo d'origine.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
npm run lint
```

## Organisation

- `src/tpl/page.html` : gabarit (trous `{{…}}`, `<sc-for>`, `<sc-if>`, `<sc-region>` re-rendues quand le filtre change) ;
- `src/engine.js` : moteur de gabarit ; `src/main.js` : valeurs de la page, filtre par domaine, thème ;
- `src/data.js` : projets, domaines, parcours ;
- `public/img/` : hero, scan, contact, captures des projets ; `public/favicon.ico` : monogramme MB.

## Déploiement (Railway, mvtteo.fr)

Le `Dockerfile` construit le site puis le sert avec Caddy (`Caddyfile`) :

- `/` : le portfolio (fichiers de `dist/`, repli sur `index.html`) ;
- `/powerpoint/*` : transmis à l'outil PowerPoint, service Railway séparé (dépôt `Automatisation`) ;
- `/healthz` : contrôle de santé.

Variable `POWERPOINT_UPSTREAM` : adresse de l'outil. Par défaut `powerpoint.railway.internal:8080`, soit un service
nommé `powerpoint` qui écoute sur le port 8080, joint par le réseau privé Railway.
