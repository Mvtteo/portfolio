import { Component, lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { useLatest } from '../lib/hooks';
import type { UniverseKey } from '../data/sectors';
import { portalIndex, type Hit, type OrbitEngine } from './engine';
import { PORTALS } from './portals';
import s from './scene.module.css';

const StarMap = lazy(() => import('./StarMap'));

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface Props {
  engine: OrbitEngine;
  label: string;
  onSelect: (i: number) => void;
  onCore: () => void;
  /** Clic sur un portail : saut vers son univers. */
  onPortal: (to: UniverseKey) => void;
  onHover?: (h: Hit) => void;
  onFallback: () => void;
}

/**
 * Couche d'interaction de la carte : un déplacement de plus de 5 px (6 au toucher) est une orbite,
 * pas un clic ; deux doigts = pincement pour zoomer. La sélection passe par engine.hit (étoiles projet seulement).
 */
export function SceneLayer({ engine, label, onSelect, onCore, onPortal, onHover, onFallback }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const handlers = useLatest({ onSelect, onCore, onPortal, onHover });

  useEffect(() => {
    const el = wrapRef.current!;
    const pointers = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; moved: boolean } | null = null;
    let pinch: number | null = null;
    const threshold = engine.cfg.mobile ? 6 : 5;

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const setHover = (h: Hit) => {
      if (h === engine.hovered) return;
      handlers.current.onHover?.(h);
    };
    const cursor = (h: Hit = engine.hovered) => {
      el.style.cursor = engine.dragging && down?.moved ? 'grabbing' : h != null && !engine.cfg.mobile ? 'pointer' : 'grab';
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, moved: false };
      else {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      engine.dragging = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture facultative */
      }
    };

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (prev) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size >= 2 && pinch) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > 0) engine.zoom(pinch / d);
          pinch = d;
          if (down) down.moved = true;
          return;
        }
        if (down) {
          if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > threshold) down.moved = true;
          if (down.moved) {
            engine.orbit(e.clientX - prev.x, e.clientY - prev.y, engine.cfg.mobile ? 0.006 : 0.005);
            cursor();
            return;
          }
        }
      }
      if (e.pointerType === 'mouse' && !down) {
        const h = engine.hit(...local(e));
        setHover(h);
        cursor(h);
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = null;
      const d = down;
      if (pointers.size === 0) {
        down = null;
        engine.dragging = false;
      }
      if (d && !d.moved && e.type === 'pointerup') {
        const h = engine.hit(...local(e));
        if (typeof h === 'number') handlers.current.onSelect(h);
        else if (h === 'core') handlers.current.onCore();
        else {
          const pi = portalIndex(h);
          if (pi != null) handlers.current.onPortal(PORTALS[pi].to);
        }
      }
      cursor();
    };

    const onLeave = () => {
      if (!down) setHover(null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      engine.zoom(Math.exp(e.deltaY * 0.0012));
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('wheel', onWheel);
    };
  }, [engine, handlers]);

  useEffect(() => {
    engine.on({ onLowFps: onFallback });
  }, [engine, onFallback]);

  return (
    <div ref={wrapRef} className={s.layer}>
      <Boundary onError={onFallback}>
        <Suspense
          fallback={
            <p role="status" className={s.loading}>
              CHARGEMENT DE LA CARTE…
            </p>
          }
        >
          <StarMap engine={engine} label={label} />
        </Suspense>
      </Boundary>
    </div>
  );
}
