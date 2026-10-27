import { useEffect, useId, useRef, useState } from 'react';
import { ACTIVE_SECTORS, N, SECTOR_COUNTS, type Project } from '../data/projects';
import { SECTOR_BY_KEY, type UniverseKey } from '../data/sectors';
import { universeColor } from '../scene/portals';
import { StarIcon } from './Icons';
import s from './breadcrumb.module.css';

interface Props {
  universe: UniverseKey;
  /** Saut en cours : le fil affiche déjà la destination, marquée « en route ». */
  warping: boolean;
  project: Project | null;
  section: string | null;
  onHub: () => void;
  onUniverse: (u: UniverseKey) => void;
  compact?: boolean;
}

/*
 * Fil d'Ariane : Data Orbit › univers ▾ › système. Remplace la liste des secteurs.
 * Le premier maillon ramène au noyau, le second rouvre la vue d'ensemble de l'univers ; son menu
 * mène à n'importe quel autre univers (saut en distorsion).
 */
export function Breadcrumb({ universe, warping, project, section, onHub, onUniverse, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const hub = universe === 'hub';
  const sector = hub ? null : SECTOR_BY_KEY[universe];
  const leaf = project ? `${project.sys} ${compact ? project.short : project.title}` : section;
  const pick = (u: UniverseKey) => {
    setOpen(false);
    onUniverse(u);
  };

  return (
    <nav aria-label="Fil d’Ariane" className={s.root} data-compact={compact}>
      <ol className={s.list}>
        <li>
          <button type="button" className={s.crumb} onClick={onHub} aria-current={hub && !leaf ? 'location' : undefined}>
            <StarIcon kind="all" size={14} />
            {compact ? 'NOYAU' : 'DATA ORBIT'}
          </button>
        </li>
        <li
          ref={wrapRef}
          className={s.menuWrap}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <span aria-hidden="true" className={s.sep}>
            ›
          </span>
          {sector && (
            <button
              type="button"
              className={s.crumb}
              style={{ color: sector.color, ['--crumb-accent' as string]: sector.color }}
              onClick={() => onUniverse(sector.key)}
              aria-current={!leaf ? 'location' : undefined}
            >
              <StarIcon kind={sector.star} size={14} />
              {compact ? sector.label : sector.name.toUpperCase()}
              {warping && <span className={s.enRoute}>EN ROUTE</span>}
            </button>
          )}
          <button
            type="button"
            className={s.toggle}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={hub ? undefined : 'Changer d’univers'}
            onClick={() => setOpen((o) => !o)}
          >
            {hub && (compact || leaf ? 'UNIVERS' : 'CHOISIR UN UNIVERS')}
            <span aria-hidden="true" className={s.caret} data-open={open}>
              ▾
            </span>
          </button>
          <ul id={menuId} className={s.menu} hidden={!open}>
            <li>
              <button type="button" className={s.item} aria-current={hub ? 'true' : undefined} onClick={() => pick('hub')}>
                <StarIcon kind="all" size={16} />
                <span className={s.itemName}>Noyau · profil</span>
                <span className={s.itemCount} style={{ color: universeColor('hub') }}>
                  {N}
                </span>
              </button>
            </li>
            {ACTIVE_SECTORS.map((x) => (
              <li key={x.key}>
                <button type="button" className={s.item} aria-current={universe === x.key ? 'true' : undefined} onClick={() => pick(x.key)}>
                  <StarIcon kind={x.star} size={16} />
                  <span className={s.itemName}>{x.name}</span>
                  <span className={s.itemCount} style={{ color: x.color }}>
                    {SECTOR_COUNTS[x.key]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </li>
        {leaf && (
          <li className={s.leafWrap}>
            <span aria-hidden="true" className={s.sep}>
              ›
            </span>
            <span className={s.leaf} aria-current="page">
              {leaf}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}
