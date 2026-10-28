import './styles.css';
import pageTpl from './page.html?raw';
import { PROJECTS, SECT, SKILLS, SERVICES, TIMELINE, FAQ, FILTERS, MENU } from './data.js';
import { mountTopography } from './topography.js';
import { fxTextPressure, fxChromaGrid, fxMagnet } from './fx.js';

/* ---------- Mini moteur de gabarit : {{trou}}, <sc-for>, <sc-if>, <sc-region> ----------
   Les gestionnaires (onClick="{{fn}}") deviennent data-h="<région>:<n>" et passent par un seul
   écouteur délégué. Une région est re-rendue seule quand l'état change. */
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const get = (scope, path) => path.trim().split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
const attr = (attrs, name) => (attrs.match(new RegExp(name + '="\\{\\{([^}]+)\\}\\}"')) || attrs.match(new RegExp(name + '="([^"]*)"')) || [])[1];

const handlers = {};
const regions = {};

function closeOf(tpl, tag, from) {
  const open = new RegExp('<' + tag + '\\b|</' + tag + '>', 'g');
  open.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = open.exec(tpl))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (!depth) return m.index;
  }
  throw new Error('balise non fermée : ' + tag);
}

function render(tpl, scope, ctx) {
  let out = '';
  let i = 0;
  const block = /<sc-(for|if|region)\b([^>]*)>/g;
  let m;
  while ((m = block.exec(tpl.slice(i)))) {
    const start = i + m.index;
    const innerStart = start + m[0].length;
    const tag = 'sc-' + m[1];
    const end = closeOf(tpl, tag, innerStart);
    const inner = tpl.slice(innerStart, end);
    out += holes(tpl.slice(i, start), scope, ctx);
    if (m[1] === 'for') {
      const as = attr(m[2], 'as');
      (get(scope, attr(m[2], 'list')) || []).forEach((item) => { out += render(inner, { ...scope, [as]: item }, ctx); });
    } else if (m[1] === 'if') {
      if (get(scope, attr(m[2], 'value'))) out += render(inner, scope, ctx);
    } else {
      const name = attr(m[2], 'name');
      regions[name] = inner;
      out += '<div data-region="' + name + '" style="display:contents">' + renderRegion(name, scope) + '</div>';
    }
    i = end + tag.length + 3;
    block.lastIndex = 0;
  }
  return out + holes(tpl.slice(i), scope, ctx);
}

function holes(s, scope, ctx) {
  return s
    .replace(/\son(\w+)="\{\{([^}]+)\}\}"/g, (_, ev, path) => {
      const fn = get(scope, path);
      if (typeof fn !== 'function') return '';
      const id = ctx.name + ':' + ctx.n++;
      handlers[ctx.name].push(id);
      handlers[id] = fn;
      return ' data-h="' + id + '"';
    })
    .replace(/\{\{([^}]+)\}\}/g, (_, path) => esc(get(scope, path)));
}

function renderRegion(name, scope) {
  (handlers[name] || []).forEach((id) => delete handlers[id]);
  handlers[name] = [];
  return render(regions[name], scope, { name, n: 0 });
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-h]');
  if (el && handlers[el.dataset.h]) handlers[el.dataset.h](e);
});

/* ---------- État et valeurs de la page (repris de la logique du canvas) ---------- */
const DEMO_PROJECT = PROJECTS.findIndex((p) => p.id === 'impressions-er');
let state = { filter: 'all', all: false, open: null, menu: false, faq: 0, fxPaused: false };
const fx = { off: [] };
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function setState(patch) {
  const was = { menu: state.menu, open: state.open };
  const focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.h : null;
  state = { ...state, ...patch };
  const v = vals();
  document.querySelectorAll('[data-region]').forEach((el) => { el.innerHTML = renderRegion(el.dataset.region, v); });
  if (fx.chroma) fx.chroma.place();
  document.documentElement.style.overflow = state.menu || state.open != null ? 'hidden' : '';
  const restore = focusId && document.querySelector('[data-h="' + focusId + '"]');
  if (restore) restore.focus();
  else if ((state.menu && !was.menu) || (state.open != null && was.open == null)) {
    const close = document.querySelector('[role="dialog"] button[aria-label^="Fermer"]');
    if (close) close.focus();
  } else if (((was.open != null && state.open == null) || (was.menu && !state.menu)) && lastOpener && document.contains(lastOpener)) lastOpener.focus({ preventScroll: true });
}
let lastOpener = null;

function visible(s) {
  const all = PROJECTS.map((p, i) => ({ p, i }));
  if (s.filter !== 'all') return all.filter((o) => o.p.sector === s.filter);
  return all.filter((o) => s.all || o.p.featured);
}

function vals() {
  const s = state;
  const list = visible(s);
  const featured = PROJECTS.filter((p) => p.featured).length;
  const demos = PROJECTS.filter((p) => p.demo).length;
  const cur0 = PROJECTS[s.open != null ? s.open : DEMO_PROJECT];
  const seq = list.some((o) => o.i === s.open) ? list : PROJECTS.map((p, i) => ({ p, i }));
  const k = Math.max(0, seq.findIndex((o) => o.i === s.open));
  const prevO = seq[(k + seq.length - 1) % seq.length];
  const nextO = seq[(k + 1) % seq.length];
  return {
    nameChars: Array.from('Mattéo Berthelot').map((c) => (c === ' ' ? '\u00a0' : c)),
    fxOn: true,
    fxRunning: !s.fxPaused,
    fxPaused: s.fxPaused,
    fxPausedStr: s.fxPaused ? 'true' : 'false',
    fxLabel: s.fxPaused ? 'Reprendre le décor' : 'Mettre le décor en pause',
    toggleFx: () => {
      const paused = !s.fxPaused;
      if (fx.topo) fx.topo.set(paused ? { speed: 0, morph: 0 } : { speed: 0.1, morph: 0.15 });
      setState({ fxPaused: paused });
    },
    openMenu: (e) => { lastOpener = e.target.closest('[data-h]'); setState({ menu: true }); },
    closeMenu: () => setState({ menu: false }),
    menuOpen: s.menu,
    menuItems: MENU.map((m) => ({ href: m[0], label: m[1] })),
    skills: SKILLS,
    services: SERVICES,
    projIntro: PROJECTS.length + ' projets, dont ' + demos + ' avec une démo publique. Chaque fiche ne reprend que ce qui se lit dans le dépôt ou dans le CV.',
    filters: FILTERS.map((f) => {
      const on = s.filter === f[0];
      const n = f[0] === 'all' ? (s.all ? PROJECTS.length : featured) : PROJECTS.filter((p) => p.sector === f[0]).length;
      return { label: f[1], count: n, pressed: on ? 'true' : 'false', bg: on ? '#140508' : 'transparent', fg: on ? '#F3F2EE' : '#140508', border: on ? '#140508' : '#C9C4BE', pick: () => setState({ filter: f[0] }) };
    }),
    cards: list.map((o) => ({
      sys: o.p.sys, title: o.p.title, status: o.p.status, sector: SECT[o.p.sector], tech: o.p.tech[0] || 'Sans techno listée',
      aria: 'Ouvrir la fiche : ' + o.p.title,
      hasImg: !!o.p.img, noImg: !o.p.img, img: o.p.img || '', coverNote: cap((o.p.note || 'aperçu indisponible').toLowerCase()),
      open: (e) => { lastOpener = e.target.closest('[data-h]'); setState({ open: o.i }); }
    })),
    showMore: s.filter === 'all',
    moreLabel: s.all ? 'Revenir à la sélection (' + featured + ')' : 'Voir les ' + PROJECTS.length + ' projets',
    toggleAll: () => setState({ all: !s.all }),
    timeline: TIMELINE,
    faq: FAQ.map((f, i) => {
      const open = s.faq === i;
      return { q: f.q, a: f.a, open, expanded: open ? 'true' : 'false', sign: open ? '−' : '+', signBg: open ? '#570110' : 'transparent', toggle: () => setState({ faq: open ? -1 : i }) };
    }),
    ficheOpen: s.open != null,
    closeFiche: () => setState({ open: null }),
    cur: {
      sys: cur0.sys, title: cur0.title, sector: SECT[cur0.sector],
      hasImg: !!cur0.img, noImg: !cur0.img, img: cur0.img || '', imgAlt: 'Capture de la démo publiée de ' + cur0.title,
      coverNote: cap((cur0.note || 'aperçu indisponible').toLowerCase()),
      status: cur0.status, statusBg: cur0.verified ? '#F3F2EE' : 'transparent', statusFg: cur0.verified ? '#140508' : '#F3F2EE', statusBorder: cur0.verified ? 'solid' : 'dashed',
      hasNote: !!cur0.note, note: cur0.note || '',
      desc: cur0.desc, tech: cur0.tech.length ? cur0.tech : ['Technologies non renseignées'],
      metaLabel: cap(cur0.meta[0].toLowerCase()), metaValue: cur0.meta[1].toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      hasRepo: !!cur0.repo, repo: cur0.repo || '', hasDemo: !!cur0.demo, demo: cur0.demo || '', linkNote: cur0.linkNote
    },
    prevP: prevO.p, nextP: nextO.p,
    prev: () => setState({ open: prevO.i }),
    next: () => setState({ open: nextO.i })
  };
}

/* ---------- Montage ---------- */
const app = document.getElementById('app');
handlers.root = [];
app.innerHTML = render(pageTpl, vals(), { name: 'root', n: 0 });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (state.menu || state.open != null)) setState({ menu: false, open: null });
});

const topo = document.getElementById('v-topo');
try {
  fx.topo = mountTopography(topo, topo.querySelector('canvas'), {
    color: '#F3F2EE', lineCount: 24, lineWidth: 1, elevation: 1.05, foreground: 0.25, detail: 0.35, tilt: 28,
    speed: 0.1, morph: 0.15, glow: 0.45, fog: 0.55, brightness: 0.62, opacity: 0.85, hoverEffect: 'lift',
    mouseRadius: 1.1, mouseStrength: 0.55, trail: 0.35, parallax: 0.4, clickEffect: 'pulse', intro: true
  });
} catch { /* WebGL2 indisponible : le fond reste uni */ }
const press = document.getElementById('v-press');
const startPress = () => fx.off.push(fxTextPressure(press));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(startPress); else startPress();
fx.chroma = fxChromaGrid(document.getElementById('v-cards'));
document.querySelectorAll('.v7-magnet').forEach((el) => fxMagnet(el));
