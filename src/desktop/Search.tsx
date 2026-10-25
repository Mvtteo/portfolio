import { useRef, type KeyboardEvent } from 'react';
import { matchesQuery, N, PROJECTS, techLine } from '../data/projects';
import { SECTOR_BY_KEY } from '../data/sectors';
import { SearchIcon } from '../hud/Icons';
import h from '../hud/hud.module.css';
import s from './desktop.module.css';

const MAX = 6;

interface Props {
  query: string;
  open: boolean;
  onQuery: (q: string) => void;
  onOpen: (open: boolean) => void;
  onPick: (i: number) => void;
  onHover: (i: number | null) => void;
  /** Plus de résultats que la liste déroulante : ouvrir la liste filtrée. */
  onShowAll: () => void;
}

/** Recherche sur titre, technologies, secteur, identifiant et statut. Entrée = premier résultat. */
export function Search({ query, open, onQuery, onOpen, onPick, onHover, onShowAll }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const q = query.trim();
  const matches = PROJECTS.filter((p) => matchesQuery(p, q));
  const results = matches.slice(0, MAX);
  const showResults = open && q.length > 0;

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results[0]) {
      e.preventDefault();
      onPick(results[0].index);
    } else if (e.key === 'ArrowDown' && showResults) {
      e.preventDefault();
      boxRef.current?.querySelector<HTMLButtonElement>('[data-result]')?.focus();
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(boxRef.current?.querySelectorAll<HTMLButtonElement>('[data-result]') ?? []);
    const k = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowUp' && k <= 0) boxRef.current?.querySelector('input')?.focus();
    else items[Math.min(items.length - 1, Math.max(0, k + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };

  return (
    <div
      ref={boxRef}
      className={s.search}
      onBlur={(e) => {
        if (!boxRef.current?.contains(e.relatedTarget as Node)) onOpen(false);
      }}
    >
      <label htmlFor="orbit-search" className="visually-hidden">
        Rechercher un projet
      </label>
      <div className={s.searchField} data-open={open}>
        <SearchIcon />
        <input
          id="orbit-search"
          type="search"
          autoComplete="off"
          value={query}
          placeholder="Rechercher un projet, une techno…"
          aria-expanded={showResults}
          aria-controls="orbit-results"
          onChange={(e) => {
            onQuery(e.target.value);
            onOpen(true);
          }}
          onFocus={() => onOpen(true)}
          onKeyDown={onKey}
        />
        <span className={s.count} aria-hidden="true">
          {q ? `${matches.length} / ${N}` : `${N} PROJETS`}
        </span>
        <span role="status" className="visually-hidden">
          {q ? `${matches.length} projet${matches.length > 1 ? 's' : ''} sur ${N} pour « ${q} »` : ''}
        </span>
      </div>
      {showResults && (
        <ul id="orbit-results" aria-label="Résultats" className={s.results} onKeyDown={onListKey}>
          {results.map((p, n) => (
            <li key={p.id}>
              <button
                type="button"
                data-result
                className={s.result}
                data-first={n === 0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(p.index)}
                onMouseEnter={() => onHover(p.index)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(p.index)}
                onBlur={() => onHover(null)}
              >
                <span className={h.rowSys} style={{ width: 44 }}>
                  {p.sys}
                </span>
                <span className={h.rowText}>
                  <span className={h.rowTitle} style={{ fontSize: 15 }}>
                    {p.title}
                  </span>
                  <span className={h.rowMeta}>
                    {SECTOR_BY_KEY[p.sector].label} · {techLine(p)}
                  </span>
                </span>
                <span className={s.resultHint}>CIBLER ↵</span>
              </button>
            </li>
          ))}
          {matches.length > MAX && (
            <li>
              <button type="button" data-result className={s.showAll} onMouseDown={(e) => e.preventDefault()} onClick={onShowAll}>
                Voir les {matches.length} résultats dans la liste
              </button>
            </li>
          )}
          {matches.length === 0 && <li className={h.empty}>Aucun projet ne correspond.</li>}
        </ul>
      )}
    </div>
  );
}
