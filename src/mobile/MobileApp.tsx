import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PROFILE, type SectionKey } from '../data/profile';
import { ACTIVE_SECTORS, N, neighbours, PROJECTS, SECTOR_COUNTS, type Filter } from '../data/projects';
import { SECTOR_BY_KEY } from '../data/sectors';
import { Chevron, CloseIcon, MarkIcon, MenuIcon, SearchIcon, TargetIcon } from '../hud/Icons';
import h from '../hud/hud.module.css';
import { ProjectBody } from '../hud/ProjectBody';
import { ProjectList } from '../hud/ProjectList';
import { SectionBody } from '../hud/Sections';
import { prefersReducedMotion, useMediaQuery, useOverlayFocus } from '../lib/hooks';
import { useHashRoute, type Route } from '../lib/route';
import { MOBILE, OrbitEngine } from '../scene/engine';
import { SceneLayer } from '../scene/SceneLayer';
import { webglAvailable } from '../scene/webgl';
import { SceneOverlays } from '../scene/SceneOverlays';
import s from './mobile.module.css';

type View = 'map' | 'fiche' | 'liste' | 'menu';

const TABS: [SectionKey, string][] = [
  ['profil', 'PROFIL'],
  ['experience', 'EXPÉRIENCE'],
  ['competences', 'COMPÉTENCES'],
  ['formation', 'FORMATION'],
  ['consulting', 'CONSULTING'],
  ['contact', 'CONTACT'],
];

const SCENE_LABEL = `Carte stellaire des ${N} projets. La liste des projets offre le même contenu sans navigation 3D.`;

export function MobileApp() {
  const [engine] = useState(() => {
    const e = new OrbitEngine(MOBILE);
    e.reduced = prefersReducedMotion();
    return e;
  });
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [fallback, setFallback] = useState(() => !webglAvailable());
  const [view, setView] = useState<View>(() => (fallback ? 'liste' : 'map'));
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [travelling, setTravelling] = useState(false);
  const [tab, setTab] = useState<SectionKey>('profil');

  useLayoutEffect(() => {
    engine.sync({ filter, reduced, selected: view === 'fiche' ? selected : null, driftAllowed: view === 'map' });
  }, [engine, filter, selected, view, reduced]);

  useEffect(() => {
    engine.on({ onArrive: () => setTravelling(false) });
  }, [engine]);

  const select = useCallback(
    (i: number) => {
      engine.select(i);
      setSelected(i);
      setView('fiche');
      setTravelling(!engine.reduced);
    },
    [engine],
  );

  const overview = () => {
    engine.overview();
    setSelected(null);
    setFilter('all');
    setView('map');
    setTravelling(!reduced);
  };

  /** Logo et nom : retour à l'accueil complet. */
  const goHome = () => {
    overview();
    setQuery('');
  };

  const flySector = (key: Filter) => {
    if (key === 'all') return overview();
    engine.flySector(key, false);
    setFilter(key);
    setTravelling(!reduced);
  };

  const closeAll = () => {
    if (view === 'fiche') {
      engine.release(420);
      setSelected(null);
    }
    setView('map');
  };

  // Menu : une seule page de sections, onglets d'ancrage.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const goTab = (key: SectionKey) => {
    setView('menu');
    setTab(key);
    requestAnimationFrame(() => {
      const el = document.getElementById(`m-${key}`);
      const sc = scrollerRef.current;
      if (el && sc) sc.scrollTo({ top: el.offsetTop - 8, behavior: reduced ? 'auto' : 'smooth' });
    });
  };
  const onMenuScroll = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    let current: SectionKey = 'profil';
    for (const [k] of TABS) {
      const el = document.getElementById(`m-${k}`);
      if (el && el.offsetTop - 40 <= sc.scrollTop) current = k;
    }
    // En bas de page, la dernière section ne peut pas atteindre le haut : elle devient l'onglet actif.
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) current = TABS[TABS.length - 1][0];
    if (current !== tab) setTab(current);
  };

  useEffect(() => {
    document.querySelector(`[data-tab="${tab}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);

  // Mêmes URL que sur desktop : #/projet/<id>, #/<section> (menu ouvert sur l'onglet), #/projets.
  const route: Route =
    view === 'fiche' && selected != null
      ? { kind: 'projet', index: selected }
      : view === 'menu'
        ? { kind: 'section', key: tab }
        : view === 'liste' && !fallback
          ? { kind: 'projets' }
          : { kind: 'none' };
  useHashRoute(route, (r) => {
    if (r.kind === 'projet') select(r.index);
    else if (r.kind === 'section') goTab(r.key);
    else if (r.kind === 'projets') setView('liste');
    else if (view !== 'map' && !(fallback && view === 'liste')) closeAll();
  });

  const fallBack = useCallback(() => {
    setFallback(true);
    setView('liste');
  }, []);

  // Focus et Escape : la fiche est non modale (la carte reste touchable), la liste et le menu piègent le focus.
  const ficheRef = useRef<HTMLElement>(null);
  const ficheTitleRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const keepFocus = useRef(false);
  useEffect(() => {
    if (view !== 'fiche') return;
    if (!keepFocus.current) ficheTitleRef.current?.focus({ preventScroll: true });
    keepFocus.current = false;
  }, [view, selected]);
  useOverlayFocus({ open: view === 'fiche', containerRef: ficheRef, initialFocusRef: ficheTitleRef, onEscape: closeAll });
  useOverlayFocus({ open: view === 'liste', containerRef: listRef, initialFocusRef: searchRef, onEscape: closeAll, trap: true });
  useOverlayFocus({ open: view === 'menu', containerRef: menuRef, initialFocusRef: menuCloseRef, onEscape: closeAll, trap: true });

  // La fiche garde son dernier projet pendant qu'elle redescend.
  const [shown, setShown] = useState(0);
  if (selected != null && selected !== shown) setShown(selected);
  const cur = PROJECTS[shown];
  const [prevP, nextP] = neighbours(shown);
  const step = (i: number) => {
    keepFocus.current = true;
    select(i);
  };

  let status = `VUE GÉNÉRALE · ${N} SYSTÈMES · TOUCHEZ UNE ÉTOILE`;
  if (fallback) status = 'MODE LISTE · CARTE 3D INDISPONIBLE';
  else if (selected != null && view === 'fiche') status = `${travelling ? 'EN ROUTE VERS' : 'CIBLE ·'} ${cur.sys}`;
  else if (filter !== 'all') status = `SECTEUR · ${SECTOR_BY_KEY[filter].label}`;

  const modal = view === 'liste' || view === 'menu';
  const chips = [['all', 'TOUS', 'all', N] as const, ...ACTIVE_SECTORS.map((x) => [x.key, x.label, x.mark, SECTOR_COUNTS[x.key]] as const)];

  return (
    <div className={s.root}>
      {fallback ? (
        <div aria-hidden="true" className={s.backdrop} />
      ) : (
        <>
          <SceneLayer engine={engine} label={SCENE_LABEL} onSelect={select} onCore={() => goTab('profil')} onFallback={fallBack} />
          <SceneOverlays engine={engine} hovered={null} selected={view === 'fiche' ? selected : null} filter={filter} counts={false} />
        </>
      )}

      <div className={s.main} inert={modal}>
        <button type="button" className="skip-link" onClick={() => setView('liste')}>
          Aller à la liste des projets
        </button>
        <header className={s.header}>
          <button type="button" className={s.logo} onClick={goHome} aria-label="Data Orbit — retour à l’accueil">
            <span className={s.logoMain}>DATA ORBIT</span>
            <span className={s.logoSub}>EXPLORE MY UNIVERSE</span>
          </button>
          <button type="button" className={s.menuBtn} onClick={() => goTab('profil')}>
            <MenuIcon />
            MENU
          </button>
        </header>

        <section aria-label="Présentation" className={s.intro}>
          <h1 className={s.name}>
            <button type="button" className={s.nameLink} onClick={goHome} title="Retour à l’accueil">
              {PROFILE.name}
            </button>
          </h1>
          <p className={s.role}>{PROFILE.role}</p>
        </section>

        <div className={s.bottom} data-hidden={view === 'fiche'} inert={view === 'fiche'}>
          <span aria-live="polite" className={s.status}>
            {status}
          </span>
          {!fallback && (
            <div role="group" aria-label="Secteurs" className={s.chips}>
              {chips.map(([key, label, mark, count]) => (
                <button key={key} type="button" className={s.chip} aria-pressed={filter === key} onClick={() => flySector(key)}>
                  <MarkIcon mark={mark} size={10} width={1.6} />
                  {label} <span className={s.chipCount}>{count}</span>
                </button>
              ))}
            </div>
          )}
          <div className={s.actions}>
            <button type="button" className={s.searchBtn} onClick={() => setView('liste')}>
              <SearchIcon />
              Rechercher · liste des {N} projets
            </button>
            {!fallback && (
              <button type="button" className={s.home} aria-label="Vue générale" onClick={overview}>
                <TargetIcon size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Fermer et revenir à la carte"
        tabIndex={-1}
        className={s.scrim}
        data-open={view === 'liste'}
        onClick={closeAll}
      />

      <section ref={ficheRef} role="dialog" aria-label="Fiche projet" className={s.fiche} data-open={view === 'fiche'} inert={view !== 'fiche'}>
        <div aria-hidden="true" className={s.grip} />
        <div className={s.sheetHead}>
          <span className={s.sheetKicker}>
            <MarkIcon mark={SECTOR_BY_KEY[cur.sector].mark} size={10} color="var(--c-signal)" width={1.6} />
            SYSTÈME {cur.sys} · {SECTOR_BY_KEY[cur.sector].label}
          </span>
          <button type="button" className={h.round} style={{ width: 44, height: 44 }} aria-label="Fermer la fiche" onClick={closeAll}>
            <CloseIcon />
          </button>
        </div>
        <div className={s.ficheBody}>
          <ProjectBody p={cur} titleRef={ficheTitleRef} preview={false} />
        </div>
        <div className={s.ficheFoot}>
          <button type="button" className={s.step} onClick={() => step(prevP.index)} aria-label={`Précédent : ${prevP.sys} ${prevP.title}`}>
            <Chevron dir="left" size={14} />
            {prevP.short}
          </button>
          <button type="button" className={s.mapBtn} onClick={closeAll}>
            CARTE
          </button>
          <button type="button" className={s.step} onClick={() => step(nextP.index)} aria-label={`Suivant : ${nextP.sys} ${nextP.title}`}>
            {nextP.short}
            <Chevron dir="right" size={14} />
          </button>
        </div>
      </section>

      <section ref={listRef} role="dialog" aria-modal="true" aria-label="Liste des projets" className={s.list} data-open={view === 'liste'} inert={view !== 'liste'}>
        <div aria-hidden="true" className={s.grip} />
        <div className={s.listHead}>
          <label htmlFor="m-search" className="visually-hidden">
            Rechercher un projet
          </label>
          <div className={s.listSearch}>
            <SearchIcon size={15} />
            <input ref={searchRef} id="m-search" type="search" autoComplete="off" value={query} placeholder="Nom, techno, secteur…" onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button type="button" className={h.round} style={{ width: 44, height: 44 }} aria-label="Fermer la liste" onClick={closeAll}>
            <CloseIcon />
          </button>
        </div>
        {fallback && <p className={s.fallbackNote}>La carte 3D ne peut pas s’afficher sur cet appareil : voici tous les projets.</p>}
        <div role="group" aria-label="Filtrer par secteur" className={s.listChips}>
          {chips.map(([key, label]) => (
            <button key={key} type="button" className={s.chip} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className={s.listScroll}>
          <ProjectList query={query} filter={filter} onPick={select} />
        </div>
      </section>

      <section ref={menuRef} role="dialog" aria-modal="true" aria-label="Sections" className={s.menu} data-open={view === 'menu'} inert={view !== 'menu'}>
        <div className={s.menuHead}>
          <nav aria-label="Sections" className={s.tabs}>
            {TABS.map(([k, label]) => (
              <button key={k} type="button" data-tab={k} className={s.tab} aria-current={tab === k ? 'true' : undefined} onClick={() => goTab(k)}>
                {label}
              </button>
            ))}
          </nav>
          <button ref={menuCloseRef} type="button" className={h.round} style={{ width: 44, height: 44 }} aria-label="Fermer les sections" onClick={closeAll}>
            <CloseIcon />
          </button>
        </div>
        <div ref={scrollerRef} className={s.menuScroll} onScroll={onMenuScroll}>
          {TABS.map(([k, label]) => (
            <section key={k} id={`m-${k}`} aria-label={label} className={s.menuSection}>
              <span className={h.kicker}>{label}</span>
              <SectionBody section={k} onNavigate={goTab} compactForm />
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
