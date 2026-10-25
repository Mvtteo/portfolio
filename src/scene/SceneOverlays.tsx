import { useEffect, useRef } from 'react';
import { ACTIVE_SECTORS, PROJECTS, SECTOR_COUNTS } from '../data/projects';
import { SECTOR_BY_KEY, type SectorKey } from '../data/sectors';
import type { Hit, OrbitEngine } from './engine';
import s from './scene.module.css';

interface Props {
  engine: OrbitEngine;
  hovered: Hit;
  selected: number | null;
  /** Libellés de secteur avec compteur (desktop) ou sans (mobile). */
  counts?: boolean;
  filter: SectorKey | 'all';
}

/*
 * Éléments HTML posés sur la scène (positions écrites à chaque frame par engine.tick) :
 * libellés permanents des secteurs et du noyau, étiquette de survol, réticule de la cible.
 */
export function SceneOverlays({ engine, hovered, selected, counts = true, filter }: Props) {
  const labelRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLSpanElement>(null);
  const sectorRefs = useRef<Partial<Record<SectorKey, HTMLSpanElement | null>>>({});

  useEffect(() => {
    engine.attach({ label: labelRef.current, reticle: reticleRef.current, core: coreRef.current, sectors: sectorRefs.current });
  }, [engine]);

  const hovP = typeof hovered === 'number' ? PROJECTS[hovered] : null;
  const showLabel = hovered != null && hovered !== selected;

  return (
    <div aria-hidden="true" className={s.overlays}>
      {ACTIVE_SECTORS.map((sec) => (
        <span
          key={sec.key}
          ref={(el) => {
            sectorRefs.current[sec.key] = el;
          }}
          className={s.sectorLabel}
          data-dim={filter !== 'all' && filter !== sec.key}
          style={{ visibility: 'hidden' }}
        >
          {counts ? `${sec.label} · ${SECTOR_COUNTS[sec.key]}` : sec.label}
        </span>
      ))}
      <span ref={coreRef} className={s.coreLabel} style={{ visibility: 'hidden' }}>
        NOYAU · PROFIL
      </span>
      <div ref={reticleRef} className={s.reticle} style={{ visibility: 'hidden' }} hidden={selected == null}>
        <svg viewBox="0 0 64 64" width="100%" height="100%">
          <path d="M2 16V2H16M48 2H62V16M62 48V62H48M16 62H2V48" fill="none" stroke="#D9442F" strokeWidth="2" />
          {!engine.cfg.mobile && <circle cx="32" cy="32" r="20" fill="none" stroke="#D9442F" strokeWidth="1" strokeDasharray="2 5" opacity=".8" />}
        </svg>
      </div>
      <div ref={labelRef} className={s.hoverLabel} style={{ visibility: 'hidden' }} hidden={!showLabel}>
        <span className={s.hoverKicker}>{hovP ? `${hovP.sys} • ${SECTOR_BY_KEY[hovP.sector].label}` : 'NOYAU'}</span>
        <span className={s.hoverTitle}>{hovP ? hovP.title : 'Mattéo Berthelot — profil'}</span>
        <span className={s.hoverHint}>{hovP ? 'CLIC POUR CIBLER' : 'CLIC POUR OUVRIR'}</span>
      </div>
    </div>
  );
}
