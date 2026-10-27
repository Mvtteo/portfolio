import { useEffect, useRef } from 'react';
import { PROJECTS, SECTOR_COUNTS } from '../data/projects';
import { SECTOR_BY_KEY, type SectorKey } from '../data/sectors';
import { isProtostar } from '../data/projects';
import { portalIndex, type Hit, type OrbitEngine } from './engine';
import { PORTALS, universeName } from './portals';
import { THEMES } from './themes';
import s from './scene.module.css';

interface Props {
  engine: OrbitEngine;
  hovered: Hit;
  selected: number | null;
  /** Libellés de portail avec compteur (desktop) ou sans (mobile). */
  counts?: boolean;
  filter?: SectorKey | 'all';
}

/*
 * Éléments HTML posés sur la scène (positions écrites à chaque frame par engine.tick) :
 * libellés permanents des secteurs et du noyau, étiquette de survol, réticule de la cible.
 */
export function SceneOverlays({ engine, hovered, selected, counts = true }: Props) {
  const labelRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLSpanElement>(null);
  const portalRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    engine.attach({ label: labelRef.current, reticle: reticleRef.current, core: coreRef.current, portals: portalRefs.current });
  }, [engine]);

  const hovP = typeof hovered === 'number' ? PROJECTS[hovered] : null;
  const hovPortal = portalIndex(hovered);
  const portal = hovPortal != null ? PORTALS[hovPortal] : null;
  const kicker = hovP
    ? `${hovP.sys} • ${SECTOR_BY_KEY[hovP.sector].label}${isProtostar(hovP) ? ' · PROTO-ÉTOILE' : ''}`
    : portal
      ? `PORTAIL · ${THEMES[portal.to].gateName}`
      : 'NOYAU · TROU NOIR';
  const title = hovP
    ? hovP.title
    : portal
      ? portal.to === 'hub'
        ? 'Retour au noyau'
        : `${universeName(portal.to)} · ${SECTOR_COUNTS[portal.to]} systèmes`
      : 'Mattéo Berthelot — profil';
  const hint = hovP ? 'CLIC POUR CIBLER' : portal ? 'CLIC POUR ENTRER' : 'CLIC POUR OUVRIR';
  const showLabel = hovered != null && hovered !== selected;

  return (
    <div aria-hidden="true" className={s.overlays}>
      {PORTALS.map((pt, i) => (
        <span
          key={pt.id}
          ref={(el) => {
            portalRefs.current[i] = el;
          }}
          className={s.sectorLabel}
          style={{ visibility: 'hidden', color: pt.color }}
        >
          {counts ? pt.label : pt.label.split(' · ')[0]}
        </span>
      ))}
      <span ref={coreRef} className={s.coreLabel} style={{ visibility: 'hidden' }}>
        NOYAU · PROFIL
      </span>
      <div ref={reticleRef} className={s.reticle} style={{ visibility: 'hidden' }} hidden={selected == null}>
        <svg viewBox="0 0 64 64" width="100%" height="100%">
          <path d="M2 16V2H16M48 2H62V16M62 48V62H48M16 62H2V48" fill="none" stroke="#F29A5C" strokeWidth="2" />
          {!engine.cfg.mobile && <circle cx="32" cy="32" r="20" fill="none" stroke="#F29A5C" strokeWidth="1" strokeDasharray="2 5" opacity=".8" />}
        </svg>
      </div>
      <div ref={labelRef} className={s.hoverLabel} style={{ visibility: 'hidden' }} hidden={!showLabel}>
        <span className={s.hoverKicker} style={hovP ? { color: SECTOR_BY_KEY[hovP.sector].color } : portal ? { color: portal.color } : undefined}>
          {kicker}
        </span>
        <span className={s.hoverTitle}>{title}</span>
        <span className={s.hoverHint}>{hint}</span>
      </div>
    </div>
  );
}
