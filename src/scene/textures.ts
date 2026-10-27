import * as THREE from 'three';

/* Textures dessinées une fois sur canvas, en blanc sauf mention : la couleur vient du matériau. */

const SIZE = 128;

function make(draw: (ctx: CanvasRenderingContext2D, s: number) => void, size = SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Halo : dégradé radial plein centre → transparent. */
export function glowTexture(stops: [number, string][] = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) {
  return make((ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

export function discTexture() {
  return make((ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Trait fin qui s'éteint vers les extrémités, centré ; `gap` = part vide au centre (0–1). */
function streak(ctx: CanvasRenderingContext2D, s: number, angle: number, width: number, gap = 0) {
  const h = s / 2;
  ctx.save();
  ctx.translate(h, h);
  ctx.rotate(angle);
  [-1, 1].forEach((dir) => {
    const g = ctx.createLinearGradient(0, dir * gap * h, 0, dir * h);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-width / 2, Math.min(dir * gap * h, dir * h), width, h * (1 - gap));
  });
  ctx.restore();
}

/** Aigrettes de diffraction (étoiles chaudes de classe A) : croix fine. */
export function spikesTexture() {
  return make(
    (ctx, s) => {
      streak(ctx, s, 0, 2);
      streak(ctx, s, Math.PI / 2, 2);
    },
    256,
  );
}

/** Faisceaux d'un pulsar : deux cônes opposés, très fins près de l'étoile. */
export function beamTexture() {
  return make(
    (ctx, s) => {
      const c = s / 2;
      [-1, 1].forEach((dir) => {
        const g = ctx.createLinearGradient(c, c, c, c + dir * c);
        g.addColorStop(0, 'rgba(255,255,255,.95)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(c - 1, c);
        ctx.lineTo(c - 7, c + dir * c);
        ctx.lineTo(c + 7, c + dir * c);
        ctx.lineTo(c + 1, c);
        ctx.closePath();
        ctx.fill();
      });
    },
    256,
  );
}

/** Jets bipolaires d'une proto-étoile : deux traits verticaux, vides au centre (cocon). */
export function jetsTexture() {
  return make((ctx, s) => streak(ctx, s, 0, 1.6, 0.26));
}

/** Contour circulaire (orbite, cible). */
export function ringTexture(width: number) {
  return make(
    (ctx, s) => {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2 - width, 0, Math.PI * 2);
      ctx.stroke();
    },
    256,
  );
}

/*
 * Image lentillée du disque autour de l'ombre (couleurs réelles, pas de teinte de matériau) :
 * anneau lumineux serré contre l'ombre (r = 1 → 1,85 rs) + anneau de photons fin à 1,03 rs.
 * La texture couvre 2 rs de rayon.
 */
export function lensTexture() {
  return make(
    (ctx, s) => {
      const c = s / 2;
      const rs = c / 2;
      const g = ctx.createRadialGradient(c, c, rs, c, c, rs * 1.85);
      g.addColorStop(0, 'rgba(255,250,240,.95)');
      g.addColorStop(0.12, 'rgba(255,226,194,.7)');
      g.addColorStop(0.45, 'rgba(245,168,110,.28)');
      g.addColorStop(1, 'rgba(196,86,46,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c, c, rs * 1.85, 0, Math.PI * 2);
      ctx.arc(c, c, rs, 0, Math.PI * 2, true);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,236,.9)';
      ctx.lineWidth = Math.max(1.5, rs * 0.035);
      ctx.beginPath();
      ctx.arc(c, c, rs * 1.03, 0, Math.PI * 2);
      ctx.stroke();
    },
    512,
  );
}

/** Anneau de portail : couronne nette + halo intérieur et extérieur. */
export function portalRingTexture() {
  return make((ctx, s) => {
    const h = s / 2;
    const g = ctx.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.52, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.66, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.7, 'rgba(255,255,255,1)');
    g.addColorStop(0.74, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.86, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }, 256);
}

/** Vortex de portail : bras spiralés qui s'éteignent vers le centre et le bord (tourné par le matériau). */
export function portalVortexTexture() {
  return make((ctx, s) => {
    const h = s / 2;
    ctx.translate(h, h);
    for (let arm = 0; arm < 5; arm++) {
      for (let k = 0; k < 120; k++) {
        const t = k / 120;
        const r = h * 0.66 * t;
        const a = arm * ((Math.PI * 2) / 5) + t * 4.2;
        const alpha = Math.sin(t * Math.PI) * 0.22;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2 + t * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.66);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.66, 0, Math.PI * 2);
    ctx.fill();
  }, 256);
}
