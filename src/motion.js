/* Animations inspirées de la référence Shora : intro du hero (photo qui se dévoile, titre ligne par ligne,
   cartes en cascade), révélations au défilement, compteurs, scan qui balaie le portrait, parallaxe.
   Tout est coupé si le visiteur a demandé moins d'animations. */
const COUNT_DURATION_MS = 1400;
const REVEAL_SELECTOR = '.mo-rv, .mo-title, .mo-scan';
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let observer = null;

function countUp(el) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / COUNT_DURATION_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}

function reveal(el) {
  el.classList.add('mo-in');
  el.querySelectorAll('[data-count]').forEach(countUp);
}

export function watchReveals() {
  if (!observer) return;
  document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
    if (!el.classList.contains('mo-in')) observer.observe(el);
  });
}

function startParallax() {
  const layers = Array.from(document.querySelectorAll('[data-parallax]'));
  let ticking = false;
  const update = () => {
    ticking = false;
    layers.forEach((el) => {
      const box = el.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) return;
      const offset = (box.top + box.height / 2 - innerHeight / 2) * Number(el.dataset.parallax);
      el.style.translate = '0 ' + (-offset).toFixed(1) + 'px';
    });
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

export function startMotion() {
  const root = document.documentElement;
  if (reduceMotion()) return;
  root.classList.add('mo');
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  watchReveals();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('mo-intro-on')));
  startParallax();
}
