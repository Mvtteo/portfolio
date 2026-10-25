import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Garde toujours la dernière valeur accessible depuis la boucle d'animation sans re-créer celle-ci. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function isUsable(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement) || !el.isConnected || el.closest('[inert]')) return false;
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** Rend le focus au déclencheur quand une surcouche non modale se ferme (si le focus était dedans). */
export function useReturnFocus(open: boolean, containerRef: RefObject<HTMLElement | null>, fallback?: () => HTMLElement | null) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const fallbackRef = useLatest(fallback);
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement && !container?.contains(active) ? active : null;
    return () => {
      const now = document.activeElement;
      if (now && now !== document.body && !container?.contains(now)) return;
      requestAnimationFrame(() => {
        const target = isUsable(triggerRef.current) ? triggerRef.current : fallbackRef.current?.();
        target?.focus({ preventScroll: true });
      });
    };
  }, [open, containerRef, fallbackRef]);
}

interface OverlayFocusOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
  /** Piège de focus (feuilles et menu mobiles). Le panneau desktop est non modal. */
  trap?: boolean;
  /** Élément à refocaliser si le déclencheur a disparu entre-temps. */
  fallback?: () => HTMLElement | null;
}

/** Focus à l'ouverture, Escape, piège de focus optionnel, focus rendu au déclencheur à la fermeture. */
export function useOverlayFocus({ open, containerRef, initialFocusRef, onEscape, trap, fallback }: OverlayFocusOptions) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const escapeRef = useLatest(onEscape);
  const fallbackRef = useLatest(fallback);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement && !container?.contains(active) ? active : null;
    initialFocusRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        escapeRef.current();
        return;
      }
      if (!trap || e.key !== 'Tab' || !container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isUsable);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const inside = container.contains(current);
      if (e.shiftKey && (current === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      const focusWasInside = !document.activeElement || document.activeElement === document.body || container?.contains(document.activeElement);
      if (!focusWasInside) return;
      // Attendre que `inert` soit retiré du fond avant de rendre le focus.
      requestAnimationFrame(() => {
        // Une autre surcouche (ex. fiche ouverte depuis la liste) a déjà pris le focus.
        const now = document.activeElement;
        if (now && now !== document.body && !container?.contains(now)) return;
        const target = isUsable(triggerRef.current) ? triggerRef.current : fallbackRef.current?.();
        target?.focus({ preventScroll: true });
      });
    };
  }, [open, trap, containerRef, initialFocusRef, escapeRef, fallbackRef]);
}
