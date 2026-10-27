import type { CSSProperties, Ref } from 'react';
import { planetOf } from '../data/planets';
import { linkNote, metaOf, starOf, techLine, type Project } from '../data/projects';
import { SECTOR_BY_KEY } from '../data/sectors';
import { StarIcon } from './Icons';
import h from './hud.module.css';

interface Props {
  p: Project;
  titleRef?: Ref<HTMLHeadingElement>;
  /** Mobile : pas d'aperçu (la feuille fait 540 px). */
  preview?: boolean;
}

/** Contenu d'une fiche : statut, titre, description, aperçu, métadonnées, liens vérifiés seulement. */
export function ProjectBody({ p, titleRef, preview = true }: Props) {
  const [metaLabel, metaValue] = metaOf(p);
  const star = SECTOR_BY_KEY[p.sector].star;
  return (
    <>
      <div className={h.chips} style={{ '--accent': starOf(p).halo } as CSSProperties}>
        <span className={p.statusVerified ? h.chip : h.chipDashed}>{p.status.toUpperCase()}</span>
        {p.note && <span className={h.chipDashed}>{p.note.toUpperCase()}</span>}
      </div>
      <h2 ref={titleRef} tabIndex={-1} className={h.systemTitle}>
        {p.title}
      </h2>
      <p className={h.desc}>{p.description}</p>
      {preview &&
        (p.preview ? (
          <div className={h.preview}>
            <img src={p.preview} alt={`Capture du projet ${p.title}`} loading="lazy" />
          </div>
        ) : (
          <div role="img" aria-label="Aperçu non disponible" className={h.preview}>
            <div aria-hidden="true" className={h.previewGlow} />
            <StarIcon kind={star} size={56} />
            <span className={h.previewNote}>{p.repoUrl ? 'APERÇU À GÉNÉRER DEPUIS LE DÉPÔT' : 'AUCUN APERÇU DISPONIBLE'}</span>
          </div>
        ))}
      <dl className={h.metaGrid}>
        <div>
          <dt>OBJET</dt>
          <dd>{planetOf(p).name.toUpperCase()}</dd>
        </div>
        <div>
          <dt>TECHNOLOGIES · LUNES</dt>
          <dd>{techLine(p)}</dd>
        </div>
        <div>
          <dt>{metaLabel}</dt>
          <dd>{metaValue}</dd>
        </div>
      </dl>
      <div className={h.links}>
        {(p.repoUrl || p.demoUrl) && (
          <div className={h.linkRow}>
            {p.repoUrl && (
              <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className={h.primary}>
                VOIR LE DÉPÔT ↗
              </a>
            )}
            {p.demoUrl && (
              <a href={p.demoUrl} target="_blank" rel="noopener noreferrer" className={h.outline}>
                VOIR LA DÉMO ↗
              </a>
            )}
          </div>
        )}
        <p className={h.note}>{linkNote(p)}</p>
      </div>
    </>
  );
}
