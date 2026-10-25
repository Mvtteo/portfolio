import * as THREE from 'three';
import type { Mark } from '../data/sectors';

/* Textures dessinées une fois sur canvas, en blanc : la couleur vient du matériau. */

const SIZE = 128;

function make(draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, SIZE);
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

/** Contour de marque. La forme occupe ~90 % de la texture ; `width` en px de texture. */
export function markTexture(mark: Mark | 'ring', width: number) {
  return make((ctx, s) => {
    const c = s / 2;
    const m = s / 2 - width;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (mark === 'circle' || mark === 'ring') ctx.arc(c, c, m, 0, Math.PI * 2);
    else if (mark === 'square') ctx.rect(c - m * 0.85, c - m * 0.85, m * 1.7, m * 1.7);
    else if (mark === 'diamond') {
      ctx.moveTo(c, c - m);
      ctx.lineTo(c + m, c);
      ctx.lineTo(c, c + m);
      ctx.lineTo(c - m, c);
      ctx.closePath();
    } else if (mark === 'hexagon') {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const x = c + Math.cos(a) * m;
        const y = c + Math.sin(a) * m;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(c, c - m);
      ctx.lineTo(c + m * 0.95, c + m * 0.65);
      ctx.lineTo(c - m * 0.95, c + m * 0.65);
      ctx.closePath();
    }
    ctx.stroke();
  });
}
