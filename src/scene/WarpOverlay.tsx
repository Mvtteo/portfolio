import { useEffect, useRef } from 'react';
import { WARP, type OrbitEngine } from './engine';
import { universeColor, universeLabel } from './portals';
import s from './warp.module.css';

/*
 * Saut en distorsion, vu du cockpit : traînées d'étoiles qui partent du point de fuite (canvas 2D
 * posé sur la scène), flash au passage en distorsion (il masque la bascule d'univers), puis
 * décélération. Le cadre du cockpit et les instruments n'apparaissent que pendant le saut.
 * Tout est piloté par engine.warpState ; rien ne tourne hors saut.
 */

const COUNT = 520;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Streak {
  x: number;
  y: number;
  z: number;
}

function spawn(st: Streak, far = true) {
  // Pas d'étoile pile au centre : le point de fuite reste dégagé, comme dans un hublot.
  let x = 0;
  let y = 0;
  while (Math.hypot(x, y) < 0.06) {
    x = Math.random() * 2 - 1;
    y = Math.random() * 2 - 1;
  }
  st.x = x;
  st.y = y;
  st.z = far ? 0.6 + Math.random() * 0.4 : 0.05 + Math.random() * 0.95;
}

export function WarpOverlay({ engine }: { engine: OrbitEngine }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const factorRef = useRef<HTMLSpanElement>(null);
  const destRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const stars: Streak[] = Array.from({ length: COUNT }, () => {
      const st = { x: 0, y: 0, z: 1 };
      spawn(st, false);
      return st;
    });
    let raf = 0;
    let last = performance.now();
    let active = false;
    let W = 0;
    let H = 0;
    let tint = '#F29A5C';
    let dest = '';

    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = engine.warpState;
      if (!w) {
        if (active) {
          active = false;
          dest = '';
          root.dataset.active = 'false';
          ctx.clearRect(0, 0, W, H);
        }
        return;
      }
      if (!active) {
        active = true;
        resize();
        stars.forEach((st) => spawn(st, false));
        root.dataset.active = 'true';
      }
      if (w.to !== dest) {
        dest = w.to;
        tint = universeColor(w.to);
        root.style.setProperty('--warp-tint', tint);
        if (destRef.current) destRef.current.textContent = universeLabel(w.to);
      }

      const t = w.t;
      const a = Math.min(1, t / WARP.swap);
      const b = Math.max(0, (t - WARP.swap) / (WARP.end - WARP.swap));
      const pre = t < WARP.swap;
      // Vitesse (profondeur par image à 60 i/s) et présence de l'effet.
      const v = pre ? 0.004 + 0.07 * Math.pow(a, 2.4) : 0.002 + 0.07 * Math.pow(1 - b, 2.2);
      const I = pre ? smooth(0, 0.22, a) : 1 - smooth(0.5, 1, b);
      root.style.setProperty('--warp-i', I.toFixed(3));

      const factor = pre ? 1 + 8.6 * Math.pow(a, 1.6) : 9.6 * Math.pow(1 - b, 1.4);
      if (factorRef.current) factorRef.current.textContent = factor.toFixed(1);
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, t / WARP.end).toFixed(3)})`;

      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H * 0.46;
      const f = Math.max(W, H) * 0.42;

      // Tunnel : l'espace s'assombrit et se teinte vers le point de fuite.
      ctx.fillStyle = `rgba(4, 5, 12, ${0.5 * I})`;
      ctx.fillRect(0, 0, W, H);
      const tunnel = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
      tunnel.addColorStop(0, `rgba(190, 210, 255, ${0.16 * I})`);
      tunnel.addColorStop(0.35, hexA(tint, 0.1 * I));
      tunnel.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tunnel;
      ctx.fillRect(0, 0, W, H);

      const len = 10 + 34 * Math.min(1, v / 0.07);
      ctx.lineCap = 'round';
      for (const st of stars) {
        st.z -= v * dt * 60;
        if (st.z < 0.02) spawn(st);
        const z1 = st.z;
        const z2 = Math.min(1, st.z + v * len * 0.12);
        const x1 = cx + (st.x / z1) * f;
        const y1 = cy + (st.y / z1) * f;
        if (x1 < -50 || x1 > W + 50 || y1 < -50 || y1 > H + 50) {
          spawn(st);
          continue;
        }
        const x2 = cx + (st.x / z2) * f;
        const y2 = cy + (st.y / z2) * f;
        const near = 1 - z1;
        ctx.strokeStyle = `rgba(${210 + 45 * near | 0}, ${225 + 30 * near | 0}, 255, ${(0.25 + 0.75 * near) * I})`;
        ctx.lineWidth = 0.6 + near * 2.4;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }

      // Flash d'entrée en distorsion : couvre l'écran au moment de la bascule.
      const flash = Math.exp(-Math.pow((t - WARP.swap) / 0.11, 2));
      if (flash > 0.01) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
        g.addColorStop(0, `rgba(255, 255, 255, ${flash})`);
        g.addColorStop(0.4, `rgba(205, 222, 255, ${0.92 * flash})`);
        g.addColorStop(1, `rgba(140, 170, 255, ${0.55 * flash})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    };

    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [engine]);

  return (
    <div ref={rootRef} aria-hidden="true" className={s.root} data-active="false">
      <canvas ref={canvasRef} className={s.canvas} />
      <div className={s.cockpit} data-mobile={engine.cfg.mobile}>
        <svg className={s.frame} viewBox="0 0 1600 900" preserveAspectRatio="none">
          {/* Montants de la verrière et tableau de bord, en silhouette. */}
          <path className={s.hull} d="M0 0H120L300 900H0Z" />
          <path className={s.hull} d="M1600 0H1480L1300 900H1600Z" />
          <path className={s.hull} d="M0 900V790Q800 690 1600 790V900Z" />
          <path className={s.edge} d="M120 0L272 760" />
          <path className={s.edge} d="M1480 0L1328 760" />
          <path className={s.edge} d="M0 790Q800 690 1600 790" />
          <path className={s.hull} d="M0 0H1600V46Q800 96 0 46Z" />
          <path className={s.edge} d="M0 46Q800 96 1600 46" />
        </svg>
        <div className={s.reticle}>
          <span />
        </div>
        <div className={s.dash}>
          <span className={s.readout}>
            <span className={s.k}>DISTORSION</span>
            <span ref={factorRef} className={s.v}>
              1.0
            </span>
          </span>
          <span className={s.progress}>
            <span ref={barRef} />
          </span>
          <span className={s.readout} data-right>
            <span className={s.k}>CAP</span>
            <span ref={destRef} className={s.v}>
              NOYAU
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
