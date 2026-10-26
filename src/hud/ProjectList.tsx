import { matchesQuery, PROJECTS, techLine, type Filter } from '../data/projects';
import { SECTORS } from '../data/sectors';
import { StarIcon } from './Icons';
import h from './hud.module.css';

interface Props {
  query: string;
  filter: Filter;
  active?: number | null;
  onPick: (i: number) => void;
  /** Survol ou focus d'une ligne = même effet que le survol de l'étoile. */
  onHover?: (i: number | null) => void;
}

/** Liste groupée par secteur : même contenu que la carte, sans navigation 3D. Sert aussi de repli. */
export function ProjectList({ query, filter, active, onPick, onHover }: Props) {
  const groups = SECTORS.map((s) => ({
    s,
    items: PROJECTS.filter((p) => p.sector === s.key && (filter === 'all' || filter === s.key) && matchesQuery(p, query)),
  })).filter((g) => g.items.length);

  if (!groups.length) return <p className={h.empty}>Aucun projet ne correspond.</p>;

  return (
    <>
      {groups.map(({ s, items }) => (
        <section key={s.key} aria-label={s.name} style={{ display: 'flex', flexDirection: 'column', paddingTop: 10 }}>
          <h3 className={h.groupLabel} style={{ margin: 0 }}>
            <StarIcon kind={s.star} size={14} />
            {s.name.toUpperCase()}
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={h.row}
                  data-active={active === p.index}
                  onClick={() => onPick(p.index)}
                  onMouseEnter={onHover && (() => onHover(p.index))}
                  onMouseLeave={onHover && (() => onHover(null))}
                  onFocus={onHover && (() => onHover(p.index))}
                  onBlur={onHover && (() => onHover(null))}
                >
                  <span className={h.rowSys} style={{ color: s.color }}>
                    {p.sys}
                  </span>
                  <span className={h.rowText}>
                    <span className={h.rowTitle}>{p.title}</span>
                    <span className={h.rowMeta}>
                      {p.status.toUpperCase()} · {techLine(p)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
