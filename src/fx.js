/* Effets portés de React Bits (reactbits.dev, MIT + Commons Clause) en JavaScript sans React :
   TextPressure, ChromaGrid, Magnet. Chacun renvoie une fonction de nettoyage. */
const FX_REDUCE = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* TextPressure : chaque lettre s'élargit et s'épaissit selon sa distance au pointeur (lissée). */
function fxTextPressure(title, opts) {
  const o = Object.assign({ radius: 0.3, smoothing: 0.5, wdth: [62, 96], wght: [800, 900] }, opts || {});
  const spans = Array.from(title.querySelectorAll('span'));
  const mouse = { x: 0, y: 0 };
  const cursor = { x: 0, y: 0, seen: false };
  const applied = [];
  let raf = 0;
  let last = 0;
  const box = title.getBoundingClientRect();
  mouse.x = cursor.x = box.left + box.width / 2;
  mouse.y = cursor.y = box.top + box.height * 3;
  const tick = (now) => {
    raf = 0;
    const elapsed = last ? Math.min(now - last, 64) : 16;
    last = now;
    const lag = 1000 * o.smoothing * o.smoothing;
    const follow = FX_REDUCE() ? 1 : 1 - Math.exp(-elapsed / lag);
    mouse.x += (cursor.x - mouse.x) * follow;
    mouse.y += (cursor.y - mouse.y) * follow;
    const r = title.getBoundingClientRect();
    const maxDist = Math.max(r.width * o.radius, 1);
    spans.forEach((sp, i) => {
      const b = sp.getBoundingClientRect();
      const d = Math.hypot(b.x + b.width / 2 - mouse.x, b.y + b.height / 2 - mouse.y);
      const pr = cursor.seen ? Math.max(0, 1 - d / maxDist) : 0;
      const e = pr * pr * (3 - 2 * pr);
      const set = `'wght' ${Math.round(o.wght[0] + (o.wght[1] - o.wght[0]) * e)}, 'wdth' ${Math.round(o.wdth[0] + (o.wdth[1] - o.wdth[0]) * e)}`;
      if (applied[i] !== set) {
        sp.style.fontVariationSettings = set;
        applied[i] = set;
      }
    });
    const moving = Math.abs(cursor.x - mouse.x) > 0.3 || Math.abs(cursor.y - mouse.y) > 0.3;
    if (moving) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const onMove = (e) => {
    cursor.x = e.clientX;
    cursor.y = e.clientY;
    cursor.seen = true;
    wake();
  };
  const onLeave = () => {
    cursor.seen = false;
    wake();
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('scroll', wake, { passive: true, capture: true });
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('scroll', wake, { capture: true });
  };
}

/* ChromaGrid : un projecteur suit le pointeur sur toute la grille ; sous lui, les captures retrouvent
   leurs couleurs (masque radial) et un liseré bordeaux s'allume. Amorti, s'éteint en sortant. */
function fxChromaGrid(root, opts) {
  const o = Object.assign({ damping: 0.45, fadeOut: 0.6 }, opts || {});
  const st = { x: 0, y: 0, tx: 0, ty: 0, p: 0, target: 0, primed: false };
  let raf = 0;
  let last = 0;
  const place = () => {
    const box = root.getBoundingClientRect();
    root.querySelectorAll('.v7-cg-media').forEach((n) => {
      const r = n.getBoundingClientRect();
      n.style.setProperty('--ox', `${r.left - box.left}px`);
      n.style.setProperty('--oy', `${r.top - box.top}px`);
    });
  };
  const frame = (now) => {
    raf = 0;
    const reduce = FX_REDUCE();
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const follow = reduce ? 1 : 1 - Math.exp(-dt / Math.max(0.01, o.damping * 0.32));
    st.x += (st.tx - st.x) * follow;
    st.y += (st.ty - st.y) * follow;
    const span = st.target > st.p ? 0.1 : Math.max(0.02, o.fadeOut * 0.35);
    st.p += (st.target - st.p) * (reduce ? 1 : 1 - Math.exp(-dt / span));
    root.style.setProperty('--cx', `${st.x.toFixed(1)}px`);
    root.style.setProperty('--cy', `${st.y.toFixed(1)}px`);
    root.style.setProperty('--cp', st.p.toFixed(3));
    const settled = Math.abs(st.tx - st.x) < 0.1 && Math.abs(st.ty - st.y) < 0.1 && Math.abs(st.target - st.p) < 0.002;
    if (!settled) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    const b = root.getBoundingClientRect();
    st.tx = e.clientX - b.left;
    st.ty = e.clientY - b.top;
    if (!st.primed) {
      st.x = st.tx;
      st.y = st.ty;
      st.primed = true;
    }
    st.target = 1;
    wake();
  };
  const onLeave = () => {
    st.target = 0;
    st.primed = st.p > 0.02;
    wake();
  };
  const ro = new ResizeObserver(place);
  ro.observe(root);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);
  place();
  return { place, destroy: () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
  } };
}

/* Magnet : l'élément glisse vers le pointeur dans une zone de `data-magnet` px autour de lui,
   puis revient en ressort. Désactivé en mouvement réduit et au toucher. */
function fxMagnet(el) {
  const pad = Number(el.dataset.magnet || 80);
  const strength = 3;
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let raf = 0;
  const step = () => {
    raf = 0;
    x += (tx - x) * 0.18;
    y += (ty - y) * 0.18;
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    if (Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05) raf = requestAnimationFrame(step);
  };
  const onMove = (e) => {
    if (FX_REDUCE() || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - x;
    const cy = r.top + r.height / 2 - y;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const inside = Math.abs(dx) < r.width / 2 + pad && Math.abs(dy) < r.height / 2 + pad;
    tx = inside ? dx / strength : 0;
    ty = inside ? dy / strength : 0;
    if (!raf) raf = requestAnimationFrame(step);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    el.style.transform = '';
  };
}

export { fxTextPressure, fxChromaGrid, fxMagnet };
