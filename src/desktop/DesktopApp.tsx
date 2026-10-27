import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { KICKERS, NAV, PROFILE, type SectionKey } from '../data/profile';
import { ACTIVE_SECTORS, N, neighbours, PROJECTS, SECTOR_COUNTS } from '../data/projects';
import { SECTOR_BY_KEY, type UniverseKey } from '../data/sectors';
import { Breadcrumb } from '../hud/Breadcrumb';
import { Chevron, CloseIcon, StarIcon, TargetIcon } from '../hud/Icons';
import h from '../hud/hud.module.css';
import { ProjectBody } from '../hud/ProjectBody';
import { ProjectList } from '../hud/ProjectList';
import { CvLink, LinkedInLink, SectionBody } from '../hud/Sections';
import { prefersReducedMotion, useLatest, useMediaQuery, useReturnFocus } from '../lib/hooks';
import { useHashRoute, type Route } from '../lib/route';
import { DESKTOP, OrbitEngine, type Hit } from '../scene/engine';
import { SceneLayer } from '../scene/SceneLayer';
import { webglAvailable } from '../scene/webgl';
import { SceneOverlays } from '../scene/SceneOverlays';
import { PORTALS, universeLabel } from '../scene/portals';
import { WarpOverlay } from '../scene/WarpOverlay';
import { Search } from './Search';
import s from './desktop.module.css';

const SCENE_LABEL = `Carte stellaire : un noyau et ${ACTIVE_SECTORS.length} univers reliés par des portails, ${N} projets. Pour un accès au clavier, utilisez le fil d’Ariane, la recherche ou la liste des projets.`;

export function DesktopApp() {
  const [engine] = useState(() => {
    const e = new OrbitEngine(DESKTOP);
    e.reduced = prefersReducedMotion();
    return e;
  });
  // Réactif : le réglage système peut changer en cours de visite.
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [fallback, setFallback] = useState(() => !webglAvailable());
  const [hovered, setHovered] = useState<Hit>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [section, setSection] = useState<SectionKey | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [universe, setUniverse] = useState<UniverseKey>('hub');
  const [warping, setWarping] = useState(false);
  const [drift, setDrift] = useState(!reduced);
  const [travelling, setTravelling] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const compactNav = useMediaQuery('(max-width: 1239px)');

  const list = listOpen || fallback;
  const panelOpen = selected != null || section != null;

  // État React → moteur (lu à chaque frame, sans re-rendu).
  useLayoutEffect(() => {
    engine.sync({ hovered, selected, drift, reduced, coreActive: section === 'profil' });
  }, [engine, hovered, selected, drift, reduced, section]);

  useEffect(() => {
    engine.on({
      onArrive: () => setTravelling(false),
      onWarp: (phase) => setWarping(phase !== 'end'),
    });
  }, [engine]);

  const travel = () => setTravelling(!reduced);

  /** Saut vers un univers ; `onSwap` s'exécute à l'arrivée (écran couvert par le flash). */
  const goUniverse = useCallback(
    (to: UniverseKey, onSwap?: () => void) => {
      setUniverse(to);
      setHovered(null);
      engine.warp(to, onSwap);
      setTravelling(!engine.reduced);
    },
    [engine],
  );

  const select = useCallback(
    (i: number) => {
      setSection(null);
      setSearchOpen(false);
      const sector = PROJECTS[i].sector;
      if (sector !== engine.universe || engine.warping) {
        // Système d'un autre univers : on saute d'abord, la fiche s'ouvre à la sortie de distorsion.
        setSelected(null);
        goUniverse(sector, () => {
          engine.select(i);
          setSelected(i);
        });
        return;
      }
      engine.select(i);
      setSelected(i);
      setTravelling(!engine.reduced);
    },
    [engine, goUniverse],
  );

  /** Vue générale de l'univers affiché : panneau et liste fermés. */
  const overview = () => {
    engine.overview();
    setSelected(null);
    setSection(null);
    if (!fallback) setListOpen(false);
    travel();
  };

  /** Fil d'Ariane, menu des univers et portails. */
  const pickUniverse = (to: UniverseKey) => {
    if (to === universe && !engine.warping) return overview();
    setSelected(null);
    setSection(null);
    if (!fallback) setListOpen(false);
    goUniverse(to);
  };

  /** Logo et nom : retour au noyau (vue générale + recherche et menu remis à zéro). */
  const goHome = () => {
    pickUniverse('hub');
    setQuery('');
    setSearchOpen(false);
    setNavOpen(false);
  };

  const openSection = (key: SectionKey | 'projets') => {
    setNavOpen(false);
    if (key === 'projets') {
      engine.setOffset(200);
      setListOpen(true);
      setSection(null);
      setSelected(null);
      return;
    }
    if (key === 'profil') {
      // Le profil est le noyau : depuis un autre univers, on y retourne en distorsion.
      if (engine.universe !== 'hub' || engine.warping) goUniverse('hub', () => engine.flyCore());
      else {
        engine.flyCore();
        travel();
      }
    } else engine.setOffset(DESKTOP.target.offX);
    setSection(key);
    setSelected(null);
    setListOpen(false);
  };

  const closePanel = () => {
    engine.release(320);
    setSelected(null);
    setSection(null);
  };

  const toggleList = () => {
    const open = !listOpen;
    engine.setOffset(open ? 200 : DESKTOP.home.offX);
    setListOpen(open);
    setSection(null);
    if (open) setSelected(null);
  };

  const fallBack = useCallback(() => setFallback(true), []);

  // URL partageable : #/projet/<id>, #/<section>, #/projets ; « Retour » referme le panneau.
  const route: Route =
    section != null
      ? { kind: 'section', key: section }
      : selected != null
        ? { kind: 'projet', index: selected }
        : listOpen && !fallback
          ? { kind: 'projets' }
          : { kind: 'none' };
  useHashRoute(route, (r) => {
    if (r.kind === 'projet') select(r.index);
    else if (r.kind === 'section') openSection(r.key);
    else if (r.kind === 'projets') {
      if (!listOpen) openSection('projets');
    } else {
      if (panelOpen) closePanel();
      if (listOpen) toggleList();
    }
  });

  // Focus : titre du panneau à chaque nouvelle fiche ou section (sauf précédent / suivant), rendu au déclencheur à la fermeture.
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const keepFocus = useRef(false);
  useReturnFocus(panelOpen, panelRef, () => document.getElementById('orbit-search'));
  useEffect(() => {
    if (!panelOpen) return;
    if (!keepFocus.current) titleRef.current?.focus({ preventScroll: true });
    keepFocus.current = false;
  }, [panelOpen, selected, section]);

  const listRef = useRef<HTMLElement>(null);
  useReturnFocus(listOpen, listRef);

  // Escape : résultats, puis menu des sections, puis panneau, puis liste.
  const escape = useLatest(() => {
    if (searchOpen && query) setSearchOpen(false);
    else if (navOpen) setNavOpen(false);
    else if (panelOpen) closePanel();
    else if (listOpen && !fallback) toggleList();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') escape.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [escape]);

  // Le panneau garde son dernier contenu pendant qu'il glisse hors de l'écran.
  const [shown, setShown] = useState<{ p: number | null; sec: SectionKey | null }>({ p: null, sec: null });
  if (panelOpen && (shown.p !== selected || shown.sec !== section)) setShown({ p: selected, sec: section });
  const shownP = shown.p != null ? PROJECTS[shown.p] : null;
  const shownSec = shown.sec;
  const cur = selected != null ? PROJECTS[selected] : null;
  const [prevP, nextP] = neighbours(shown.p ?? 0);
  const step = (p: (typeof PROJECTS)[number]) => {
    keepFocus.current = true;
    select(p.index);
  };

  const portalsHere = PORTALS.filter((p) => p.from === universe).length;
  let status =
    universe === 'hub'
      ? `NOYAU · ${portalsHere} PORTAILS · ${N} SYSTÈMES`
      : `UNIVERS ${SECTOR_BY_KEY[universe].label} · ${SECTOR_COUNTS[universe]} SYSTÈMES · ${portalsHere} PORTAILS`;
  if (warping) status = `SAUT EN DISTORSION → ${universeLabel(universe)}`;
  else if (cur) status = `${travelling ? 'EN ROUTE VERS' : 'CIBLE ·'} ${cur.sys} ${cur.title.toUpperCase()}`;
  else if (section) status = `PANNEAU · ${section.toUpperCase()}`;
  else if (fallback) status = 'MODE LISTE · CARTE 3D INDISPONIBLE';

  const navPressed = (k: SectionKey | 'projets') => section === k || (k === 'projets' && list);
  // Un onglet actif se referme au second clic (la liste reste ouverte en mode repli, faute de carte).
  const toggleNav = (k: SectionKey | 'projets') => {
    setNavOpen(false);
    if (!navPressed(k)) openSection(k);
    else if (k !== 'projets') closePanel();
    else if (!fallback) toggleList();
  };
  const navList = (
    <ul className={s.navList}>
      {NAV.map(([k, label]) => (
        <li key={k}>
          <button type="button" className={s.navItem} aria-pressed={navPressed(k)} onClick={() => toggleNav(k)}>
            {label}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={s.root} data-warping={warping}>
      {fallback ? (
        <div aria-hidden="true" className={s.backdrop} />
      ) : (
        <>
          <SceneLayer
            engine={engine}
            label={SCENE_LABEL}
            onSelect={select}
            onCore={() => openSection('profil')}
            onPortal={pickUniverse}
            onHover={setHovered}
            onFallback={fallBack}
          />
          <SceneOverlays engine={engine} hovered={hovered} selected={selected} />
          <WarpOverlay engine={engine} />
        </>
      )}

      <button
        type="button"
        className="skip-link"
        onClick={() => {
          openSection('projets');
          requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>('li button')?.focus());
        }}
      >
        Aller à la liste des projets
      </button>
      <header className={s.header}>
        <button type="button" className={s.logo} onClick={goHome} aria-label="Data Orbit — retour à l’accueil">
          <span className={s.logoMain}>DATA ORBIT</span>
          <span className={s.logoSub}>EXPLORE MY UNIVERSE</span>
        </button>
        <Search
          query={query}
          open={searchOpen}
          onQuery={setQuery}
          onOpen={setSearchOpen}
          onPick={select}
          onHover={setHovered}
          onShowAll={() => {
            setSearchOpen(false);
            if (!listOpen) toggleList();
          }}
        />
        <nav aria-label="Sections" className={s.nav}>
          {compactNav ? (
            <div className={s.navMenu}>
              <button type="button" className={s.navToggle} aria-expanded={navOpen} aria-controls="nav-sections" onClick={() => setNavOpen((o) => !o)}>
                SECTIONS
                <span aria-hidden="true" className={s.navCaret} data-open={navOpen}>
                  <Chevron dir="right" size={12} />
                </span>
              </button>
              <div id="nav-sections" className={s.navDrop} hidden={!navOpen}>
                {navList}
              </div>
            </div>
          ) : (
            navList
          )}
        </nav>
      </header>

      {!fallback && (
        <div className={s.crumbs}>
          <Breadcrumb
            universe={universe}
            warping={warping}
            project={cur}
            section={section && section !== 'profil' ? section.toUpperCase() : section === 'profil' ? 'PROFIL' : null}
            onHub={goHome}
            onUniverse={pickUniverse}
          />
        </div>
      )}

      <div aria-hidden="true" className={s.leftScrim} data-hidden={listOpen && !fallback} />
      <div className={s.left} data-hidden={listOpen && !fallback} inert={listOpen && !fallback}>
        <section aria-label="Présentation" className={s.identity}>
          <h1 className={s.name}>
            <button type="button" className={s.nameLink} onClick={goHome} title="Retour à l’accueil">
              Mattéo <br />
              Berthelot
            </button>
          </h1>
          <p className={h.role}>{PROFILE.role}</p>
          <p className={s.pitch}>{PROFILE.pitch}</p>
          <p className={s.current}>
            {PROFILE.current}
            <br />
            {PROFILE.school}
          </p>
          <div className={s.cta}>
            <button type="button" className={h.primary} onClick={() => openSection('contact')}>
              CONTACT
            </button>
            <LinkedInLink />
            <CvLink />
          </div>
        </section>

      </div>

      <div className={s.controls}>
        <div className={s.controlRow}>
          {!fallback && (
            <>
              <button type="button" className={s.ctl} onClick={overview}>
                <TargetIcon />
                VUE GÉNÉRALE
              </button>
              <button type="button" className={s.ctlRound} aria-label="Dézoomer" onClick={() => engine.zoom(1.33)}>
                −
              </button>
              <button type="button" className={s.ctlRound} aria-label="Zoomer" onClick={() => engine.zoom(0.75)}>
                +
              </button>
              {!reduced && (
                <button type="button" className={s.ctl} aria-pressed={drift} onClick={() => setDrift((d) => !d)}>
                  {drift ? 'DÉRIVE : ON' : 'DÉRIVE : OFF'}
                </button>
              )}
              <button type="button" className={s.listToggle} aria-pressed={listOpen} onClick={toggleList}>
                LISTE DES PROJETS
              </button>
            </>
          )}
        </div>
        <span aria-live="polite" className={s.status}>
          {status}
          {reduced && !fallback && ' · ANIMATIONS RÉDUITES'}
        </span>
      </div>

      {!fallback && (
        <span className={s.hint} data-hidden={panelOpen}>
          GLISSER : ORBITER · MOLETTE : ZOOM · CLIC : CIBLER OU FRANCHIR UN PORTAIL
        </span>
      )}

      <section ref={listRef} aria-labelledby="list-title" className={s.list} data-fallback={fallback} hidden={!list}>
        <div className={s.listHead}>
          <h2 id="list-title" className={s.listTitle}>
            TOUS LES SYSTÈMES
          </h2>
          {!fallback && (
            <button type="button" className={h.round} aria-label="Fermer la liste" onClick={toggleList}>
              <CloseIcon />
            </button>
          )}
        </div>
        <p className={s.listIntro}>
          {fallback
            ? 'La carte 3D ne peut pas s’afficher sur cet appareil : voici tous les projets, avec le même contenu.'
            : 'Même contenu que la carte, sans navigation 3D. C’est aussi la vue de repli si WebGL est indisponible.'}
          {query.trim() && (
            <>
              {' '}
              Filtre : « {query.trim()} ».{' '}
              <button type="button" className={s.inlineLink} onClick={() => setQuery('')}>
                Effacer
              </button>
            </>
          )}
        </p>
        <div className={s.listScroll}>
          <ProjectList
            query={query}
            filter="all"
            active={typeof hovered === 'number' ? hovered : selected}
            onPick={(i) => {
              if (!fallback) setListOpen(false);
              select(i);
            }}
            onHover={setHovered}
          />
        </div>
      </section>

      <aside
        ref={panelRef}
        aria-label={shownSec ? `Panneau ${shownSec}` : 'Fiche projet'}
        className={s.panel}
        data-open={panelOpen}
        inert={!panelOpen}
      >
        {shownP && !shownSec && (
          <>
            <div className={s.panelHead}>
              <span className={s.panelKicker}>
                <StarIcon kind={SECTOR_BY_KEY[shownP.sector].star} />
                SYSTÈME {shownP.sys} · {SECTOR_BY_KEY[shownP.sector].label}
              </span>
              <button type="button" className={s.back} onClick={closePanel}>
                <Chevron dir="left" size={12} />
                EXPLORATION
              </button>
            </div>
            <div className={s.panelBody}>
              <ProjectBody p={shownP} titleRef={titleRef} />
            </div>
            <div className={s.panelFoot}>
              <button type="button" className={s.step} onClick={() => step(prevP)} aria-label={`Précédent : ${prevP.sys} ${prevP.title}`}>
                <Chevron dir="left" />
                <span className={s.stepText}>
                  <span className={s.stepSys}>{prevP.sys}</span>
                  {prevP.short}
                </span>
              </button>
              <button type="button" className={s.step} data-next onClick={() => step(nextP)} aria-label={`Suivant : ${nextP.sys} ${nextP.title}`}>
                <span className={s.stepText}>
                  <span className={s.stepSys}>{nextP.sys}</span>
                  {nextP.short}
                </span>
                <Chevron dir="right" />
              </button>
            </div>
          </>
        )}
        {shownSec && (
          <>
            <div className={s.panelHead}>
              <span className={s.panelKicker}>{KICKERS[shownSec]}</span>
              <button type="button" className={h.round} aria-label="Fermer le panneau" onClick={closePanel}>
                <CloseIcon />
              </button>
            </div>
            <div className={s.panelBody} style={{ gap: 18, paddingBottom: 24 }}>
              <SectionBody section={shownSec} titleRef={titleRef} onNavigate={openSection} />
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
