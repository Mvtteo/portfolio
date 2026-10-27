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

/* ---------- Portes : une forme par univers de destination ---------- */

/** Porte stellaire : anneau épais, neuf chevrons lumineux, horizon intérieur à peine voilé. */
export function gateStargateTexture() {
  return make((ctx, s) => {
    const h = s / 2;
    ctx.translate(h, h);
    const R = h * 0.74;
    const r = h * 0.6;
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.arc(0, 0, r, 0, Math.PI * 2, true);
    ctx.fill();
    // Glyphes : tirets réguliers dans la bande.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 39; i++) {
      const a = (i / 39) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6));
      ctx.lineTo(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    [R, r].forEach((rad) => {
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Chevrons.
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(R + 10, -14);
      ctx.lineTo(R + 10, 14);
      ctx.lineTo(R - 10, 7);
      ctx.lineTo(R - 10, -7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }, 256);
}

/** Horizon de la porte stellaire : ondes concentriques (animées par échelle et rotation). */
export function gateRippleTexture() {
  return make((ctx, s) => {
    const h = s / 2;
    const g = ctx.createRadialGradient(h, h, 0, h, h, h * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0.12)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(h, h, h * 0.6, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 1; i < 8; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.35 - i * 0.03})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(h + Math.sin(i) * 3, h + Math.cos(i) * 3, h * 0.075 * i, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, 256);
}

/** Trou de ver : tunnel d'anneaux qui s'enfoncent vers un point décentré, lèvre très lumineuse. */
export function gateWormholeTexture() {
  return make((ctx, s) => {
    const h = s / 2;
    const n = 12;
    for (let i = n - 1; i >= 0; i--) {
      const f = Math.pow(0.8, i);
      const cx = h + (1 - f) * h * 0.18;
      const cy = h - (1 - f) * h * 0.1;
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.5 * (1 - i / n)})`;
      ctx.lineWidth = Math.max(1.5, 7 * f);
      ctx.beginPath();
      ctx.ellipse(cx, cy, h * 0.72 * f, h * 0.72 * f * 0.94, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    const cx = h + h * 0.18;
    const cy = h - h * 0.1;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.18);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }, 256);
}

/** Faille spatiale : déchirure verticale en amande, bords incandescents, stries intérieures. */
export function gateRiftTexture() {
  return make((ctx, s) => {
    const h = s / 2;
    const w = s * 0.26;
    const top = s * 0.04;
    const bot = s * 0.96;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(h, top);
      ctx.bezierCurveTo(h + w * 1.1, s * 0.3, h + w * 0.9, s * 0.7, h, bot);
      ctx.bezierCurveTo(h - w * 0.9, s * 0.7, h - w * 1.1, s * 0.3, h, top);
      ctx.closePath();
    };
    path();
    const g = ctx.createLinearGradient(h - w, 0, h + w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0.15)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    path();
    ctx.clip();
    for (let i = 0; i < 26; i++) {
      const x = h + (Math.sin(i * 7.3) * w) / 1.3;
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.3 * Math.abs(Math.sin(i))})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + Math.sin(i) * 10, bot);
      ctx.stroke();
    }
    ctx.restore();
    path();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();
  }, 256);
}

/** Trou noir de retour : ombre opaque, anneau de photons et disque vu de biais (texture en couleurs). */
export function gateBlackholeTexture() {
  return make((ctx, s) => {
    const h = s / 2;
    ctx.translate(h, h);
    const disk = (front: boolean) => {
      ctx.save();
      ctx.scale(1, 0.26);
      ctx.beginPath();
      if (front) ctx.rect(-h, 0, s, h * 4);
      else ctx.rect(-h, -h * 4, s, h * 4);
      ctx.clip();
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `rgba(${245 - i * 6}, ${168 - i * 12}, ${110 - i * 10}, ${0.75 - i * 0.1})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, h * (0.44 + i * 0.07), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };
    disk(false);
    const glow = ctx.createRadialGradient(0, 0, h * 0.24, 0, 0, h * 0.42);
    glow.addColorStop(0, 'rgba(255,226,194,1)');
    glow.addColorStop(1, 'rgba(255,200,154,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#020203';
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.25, 0, Math.PI * 2);
    ctx.fill();
    disk(true);
  }, 256);
}
