import './styles.css';
import navTpl from './tpl/nav.html?raw';
import homeTpl from './tpl/home.html?raw';
import projectTpl from './tpl/project.html?raw';
import endTpl from './tpl/end.html?raw';
import { PROJECTS, SECT, SERVICES, TIMELINE, FILTERS, MENU, STEPS, CONSULT_INTRO, STORIES } from './data.js';
import { render, renderRegion, startRoot } from './engine.js';
import { mountTopography } from './topography.js';
import { fxTextPressure, fxMagnet } from './fx.js';

const TODO = '[À DÉFINIR]';
const FEATURED = PROJECTS.filter((p) => p.featured);
const pageHref = (p) => '/projets/' + p.id;
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/* Route : /projets/<id> pour un projet de la sélection, sinon l'accueil. */
const match = location.pathname.match(/^\/projets\/([\w-]+)\/?$/);
const current = match ? FEATURED.find((p) => p.id === match[1]) : null;
if (match && !current) history.replaceState(null, '', '/#projets');

let state = { filter: 'all', all: false, menu: false, fxPaused: false };
const fx = {};
let lastOpener = null;

function setState(patch) {
  const was = state;
  const focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.h : null;
  state = { ...state, ...patch };
  const v = current ? projectVals() : homeVals();
  document.querySelectorAll('[data-region]').forEach((el) => { el.innerHTML = renderRegion(el.dataset.region, v); });
  document.documentElement.style.overflow = state.menu ? 'hidden' : '';
  const restore = focusId && document.querySelector('[data-h="' + focusId + '"]');
  if (restore) restore.focus();
  else if (state.menu && !was.menu) document.querySelector('.menu .close')?.focus();
  else if (was.menu && !state.menu && lastOpener && document.contains(lastOpener)) lastOpener.focus({ preventScroll: true });
}

function common() {
  return {
    home: current ? '/' : '',
    openMenu: (e) => { lastOpener = e.target.closest('[data-h]'); setState({ menu: true }); },
    closeMenu: () => setState({ menu: false }),
    menuOpen: state.menu,
    menuItems: MENU.map((m) => ({ href: (current ? '/' : '') + m[0], label: m[1] }))
  };
}

function visible(s) {
  if (s.filter !== 'all') return PROJECTS.filter((p) => p.sector === s.filter);
  return PROJECTS.filter((p) => s.all || p.featured);
}

function homeVals() {
  const s = state;
  const demos = PROJECTS.filter((p) => p.demo).length;
  return {
    ...common(),
    nameChars: Array.from('Mattéo Berthelot').map((c) => (c === ' ' ? ' ' : c)),
    fxRunning: !s.fxPaused,
    fxPaused: s.fxPaused,
    fxPausedStr: s.fxPaused ? 'true' : 'false',
    fxLabel: s.fxPaused ? 'Reprendre le décor' : 'Mettre le décor en pause',
    toggleFx: () => {
      const paused = !s.fxPaused;
      if (fx.topo) fx.topo.set(paused ? { speed: 0, morph: 0 } : { speed: 0.1, morph: 0.15 });
      setState({ fxPaused: paused });
    },
    projIntro: PROJECTS.length + ' projets, dont ' + demos + ' avec une démo publique. Les ' + FEATURED.length + ' de la sélection ont leur page : la mission, le parcours, le rendu.',
    filters: FILTERS.map((f) => {
      const n = f[0] === 'all' ? (s.all ? PROJECTS.length : FEATURED.length) : PROJECTS.filter((p) => p.sector === f[0]).length;
      return { label: f[1], count: n, pressed: s.filter === f[0] ? 'true' : 'false', pick: () => setState({ filter: f[0] }) };
    }),
    rows: visible(s).map((p) => {
      const ext = p.featured ? null : p.demo || p.repo;
      return {
        sys: p.sys, title: p.title, sector: SECT[p.sector], tech: p.tech[0] || 'Sans techno listée', img: p.img || '',
        href: p.featured ? pageHref(p) : ext || '#projets',
        target: ext ? '_blank' : '', rel: ext ? 'noopener noreferrer' : '',
        goLabel: p.featured ? 'Voir le projet' : p.demo ? 'Démo' : p.repo ? 'GitHub' : ''
      };
    }),
    showMore: s.filter === 'all',
    moreLabel: s.all ? 'Revenir à la sélection (' + FEATURED.length + ')' : 'Voir les ' + PROJECTS.length + ' projets',
    toggleAll: () => setState({ all: !s.all }),
    services: SERVICES,
    tracks: [
      { label: 'Expérience professionnelle', items: TIMELINE.filter((t) => t.kind === 'pro') },
      { label: 'Formation', items: TIMELINE.filter((t) => t.kind === 'edu') }
    ],
    consultIntro: CONSULT_INTRO,
    steps: STEPS.map((st, i) => ({ n: String(i + 1).padStart(2, '0'), title: st.title, desc: st.desc || TODO, cls: st.desc ? '' : 'todo' }))
  };
}

function projectVals() {
  const p = current;
  const k = FEATURED.indexOf(p);
  const prev = FEATURED[(k + FEATURED.length - 1) % FEATURED.length];
  const next = FEATURED[(k + 1) % FEATURED.length];
  const story = STORIES[p.id] || {};
  const block = (n, id, title, val) => {
    const paras = Array.isArray(val) ? val : val ? [val] : [TODO];
    return { n, id, title, paras, cls: val ? '' : 'todo' };
  };
  return {
    ...common(),
    p: {
      sys: p.sys, title: p.title, sector: SECT[p.sector], status: p.status, desc: p.desc,
      tech: p.tech.length ? p.tech : ['Technologies non renseignées'],
      demo: p.demo || '', repo: p.repo || '',
      metaLabel: cap(p.meta[0].toLowerCase()), metaValue: p.meta[1].toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      linkNote: p.linkNote, img: p.img || '', imgAlt: 'Capture de la démo publiée de ' + p.title,
      blocks: [block('01', 'b-mission', 'La mission', story.mission), block('02', 'b-parcours', 'Le parcours', story.parcours), block('03', 'b-rendu', 'Le rendu', story.rendu)]
    },
    prev: { href: pageHref(prev), title: prev.title },
    next: { href: pageHref(next), title: next.title }
  };
}

/* ---------- Montage ---------- */
const body = (current ? projectTpl : homeTpl).replace('/*NAV*/', navTpl);
document.getElementById('app').innerHTML = render(body + endTpl, current ? projectVals() : homeVals(), startRoot());
document.title = current ? current.title + ' — Mattéo Berthelot' : 'Mattéo Berthelot — Data Analyst';
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.menu) setState({ menu: false });
});
document.querySelectorAll('.magnet').forEach((el) => fxMagnet(el));

if (!current) {
  const topo = document.getElementById('v-topo');
  try {
    fx.topo = mountTopography(topo, topo.querySelector('canvas'), {
      color: '#F3F2EE', lineCount: 24, lineWidth: 1, elevation: 1.05, foreground: 0.25, detail: 0.35, tilt: 28,
      speed: 0.1, morph: 0.15, glow: 0.45, fog: 0.55, brightness: 0.62, opacity: 0.85, hoverEffect: 'lift',
      mouseRadius: 1.1, mouseStrength: 0.55, trail: 0.35, parallax: 0.4, clickEffect: 'pulse', intro: true
    });
  } catch { /* WebGL2 indisponible : le fond reste uni */ }
  const press = document.getElementById('v-press');
  const startPress = () => fxTextPressure(press, { wdth: [100, 100], wght: [600, 900], radius: 0.35 });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(startPress); else startPress();

  /* Aperçu de la capture qui suit le pointeur au survol d'une ligne de projet */
  const peek = document.getElementById('v-peek');
  const peekImg = peek.querySelector('img');
  let raf = 0;
  const pos = { x: 0, y: 0 };
  document.getElementById('v-plist').addEventListener('pointermove', (e) => {
    const row = e.target.closest('.prow');
    const src = row && row.dataset.img;
    if (!src || e.pointerType === 'touch') { peek.classList.remove('on'); return; }
    if (peekImg.getAttribute('src') !== src) peekImg.setAttribute('src', src);
    pos.x = Math.min(e.clientX + 24, innerWidth - 360);
    pos.y = e.clientY - 110;
    peek.classList.add('on');
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; peek.style.transform = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)'; });
  });
  document.getElementById('v-plist').addEventListener('pointerleave', () => peek.classList.remove('on'));
}
