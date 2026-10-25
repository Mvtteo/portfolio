import { useEffect, useRef } from 'react';
import { NAV, type SectionKey } from '../data/profile';
import { PROJECTS } from '../data/projects';
import { useLatest } from './hooks';

/*
 * Liens profonds : #/projet/<id>, #/<section>, #/projets. Ouvrir un panneau ajoute une entrée d'historique,
 * donc « Retour » le referme ; un lien partagé ouvre directement la fiche ou la section.
 */

export type Route = { kind: 'projet'; index: number } | { kind: 'section'; key: SectionKey } | { kind: 'projets' } | { kind: 'none' };

const SECTIONS = new Set(NAV.map(([k]) => k).filter((k) => k !== 'projets'));

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'projet' && parts[1]) {
    const index = PROJECTS.findIndex((p) => p.id === decodeURIComponent(parts[1]));
    return index >= 0 ? { kind: 'projet', index } : { kind: 'none' };
  }
  if (parts[0] === 'projets') return { kind: 'projets' };
  if (parts[0] && SECTIONS.has(parts[0] as SectionKey)) return { kind: 'section', key: parts[0] as SectionKey };
  return { kind: 'none' };
}

export function routeHash(r: Route) {
  switch (r.kind) {
    case 'projet':
      return `#/projet/${PROJECTS[r.index].id}`;
    case 'section':
      return `#/${r.key}`;
    case 'projets':
      return '#/projets';
    default:
      return '';
  }
}

interface PushedState {
  orbitPushed?: boolean;
}

/** Synchronise l'URL avec l'état affiché (`current`) et applique les changements venus de l'URL (lien, Retour). */
export function useHashRoute(current: Route, apply: (r: Route) => void) {
  const applyRef = useLatest(apply);
  const hash = routeHash(current);
  const synced = useRef(false);

  useEffect(() => {
    const initial = parseRoute(location.hash);
    if (initial.kind !== 'none') applyRef.current(initial);
    const onPop = () => applyRef.current(parseRoute(location.hash));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyRef]);

  useEffect(() => {
    const now = routeHash(parseRoute(location.hash));
    // Premier passage avec un lien entrant : l'état n'a pas encore appliqué la route, ne pas effacer l'URL.
    if (!synced.current) {
      synced.current = true;
      if (now) return;
    }
    if (hash === now) return;
    const base = location.pathname + location.search;
    const state = history.state as PushedState | null;
    if (hash && !now) history.pushState({ orbitPushed: true } satisfies PushedState, '', base + hash);
    else if (hash) history.replaceState(state, '', base + hash);
    // Fermeture : on revient sur l'entrée d'avant l'ouverture, sinon on nettoie l'URL (arrivée par un lien).
    else if (state?.orbitPushed) history.back();
    else history.replaceState(null, '', base);
  }, [hash]);
}
