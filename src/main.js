import './styles.css';
import pageTpl from './tpl/page.html?raw';
import { PROJECTS, SECT, TIMELINE } from './data.js';
import { render, renderRegion, startRoot } from './engine.js';
import { startMotion, watchReveals } from './motion.js';

const SECTOR_ORDER = ['data', 'ia', 'web', 'outils'];
const THUMB_IDS = ['forensic', 'impressions-er', 'faim', 'dofus', 'spotify'];
const TOP_TECH_COUNT = 8;
const THEME_KEY = 'mb-theme';

let state = { sector: 'all' };

const readTheme = () => {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
};
const saveTheme = (theme) => {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* stockage indisponible : le thème vaut pour la visite */ }
};

function vals() {
  const techCount = {};
  PROJECTS.forEach((p) => p.tech.forEach((t) => { techCount[t] = (techCount[t] || 0) + 1; }));
  const thumbs = THUMB_IDS.map((id) => PROJECTS.find((p) => p.id === id)).filter(Boolean);
  const demos = PROJECTS.filter((p) => p.demo).length;
  return {
    projectTotal: PROJECTS.length,
    demoTotal: demos,
    featuredTotal: PROJECTS.filter((p) => p.featured).length,
    thumbs: thumbs.map((p, i) => ({
      i: 5 + i, sys: p.sys, title: p.title, sector: SECT[p.sector], go: p.demo ? 'Démo ↗' : 'Code ↗',
      href: p.demo || p.repo || '#projets', aria: p.title + ', ' + (p.demo ? 'démo' : 'code') + ' (nouvel onglet)'
    })),
    stats: [
      { i: 0, n: PROJECTS.length, label: 'projets publiés ou sur le CV' },
      { i: 1, n: demos, label: 'démos en ligne' },
      { i: 2, n: Object.keys(techCount).length, label: 'technologies utilisées' }
    ],
    topTech: Object.entries(techCount).sort((a, b) => b[1] - a[1]).slice(0, TOP_TECH_COUNT).map(([tech, n]) => ({ tech, n })),
    filters: [['all', 'Tous']].concat(SECTOR_ORDER.map((k) => [k, SECT[k]])).map(([k, label]) => ({
      label,
      count: k === 'all' ? PROJECTS.length : PROJECTS.filter((p) => p.sector === k).length,
      pressed: state.sector === k ? 'true' : 'false',
      pick: () => setState({ sector: k })
    })),
    tableRows: PROJECTS.filter((p) => state.sector === 'all' || p.sector === state.sector).map((p, i) => ({
      i: Math.min(i, 6), sys: p.sys, title: p.title, desc: p.desc,
      tech: p.tech.slice(0, 3).join(' · ') || '—',
      demo: p.demo || '', repo: p.repo || '', noLink: !p.demo && !p.repo,
      demoAria: 'Démo de ' + p.title + ' (nouvel onglet)', repoAria: 'Code de ' + p.title + ' (nouvel onglet)',
      when: p.meta[0] === 'SOURCE' ? '' : p.meta[1].toLowerCase()
    })),
    tracks: [
      { label: 'Expérience', items: TIMELINE.filter((t) => t.kind === 'pro').map((t, i) => ({ ...t, i })) },
      { label: 'Formation', items: TIMELINE.filter((t) => t.kind === 'edu').map((t, i) => ({ ...t, i })) }
    ]
  };
}

function setState(patch) {
  const focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.h : null;
  state = { ...state, ...patch };
  const v = vals();
  document.querySelectorAll('[data-region]').forEach((el) => { el.innerHTML = renderRegion(el.dataset.region, v); });
  const restore = focusId && document.querySelector('[data-h="' + focusId + '"]');
  if (restore) restore.focus();
  watchReveals();
}

function applyTheme(theme) {
  const light = theme === 'light';
  document.getElementById('v9-root').classList.toggle('v9-light', light);
  const button = document.getElementById('v9-theme');
  button.setAttribute('aria-pressed', light ? 'true' : 'false');
  button.setAttribute('aria-label', light ? 'Passer en thème sombre' : 'Passer en thème clair');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', light ? '#F1F0EC' : '#060708');
}

document.getElementById('app').innerHTML = render(pageTpl, vals(), startRoot());
applyTheme(readTheme());
document.getElementById('v9-theme').addEventListener('click', () => {
  const next = document.getElementById('v9-root').classList.contains('v9-light') ? 'dark' : 'light';
  applyTheme(next);
  saveTheme(next);
});
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
startMotion();
