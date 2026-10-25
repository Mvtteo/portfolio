import type { CSSProperties, Ref } from 'react';
import { CONSULTING, EDUCATION, EXPERIENCE, FACTS, PROFILE, SKILLS, type SectionKey } from '../data/profile';
import { ContactForm } from './ContactForm';
import h from './hud.module.css';

/** CV : lien réel si le PDF est dans le projet, sinon mention pointillée (aucun faux téléchargement). */
export function CvLink({ label = 'CV' }: { label?: string }) {
  if (PROFILE.cvUrl)
    return (
      <a href={PROFILE.cvUrl} className={h.outline} download>
        {label} · PDF
      </a>
    );
  return (
    <span className={h.missing} title="Le PDF du CV n’est pas encore dans le projet">
      {label} · PDF À AJOUTER
    </span>
  );
}

export function LinkedInLink() {
  return (
    <a href={PROFILE.linkedin} target="_blank" rel="noopener noreferrer" className={h.outline}>
      LINKEDIN ↗
    </a>
  );
}

interface Props {
  section: SectionKey;
  titleRef?: Ref<HTMLHeadingElement>;
  onNavigate: (s: SectionKey) => void;
  /** Mobile : identifiants de formulaire distincts du desktop. */
  compactForm?: boolean;
}

export function SectionBody({ section, titleRef, onNavigate, compactForm }: Props) {
  const title = (text: string, style?: CSSProperties) => (
    <h2 ref={titleRef} tabIndex={-1} className={h.sectionTitle} style={style}>
      {text}
    </h2>
  );

  switch (section) {
    case 'profil':
      return (
        <div className={h.section}>
          {title(PROFILE.name)}
          <p className={h.role}>{PROFILE.role}</p>
          <p className={h.body}>{PROFILE.about}</p>
          <dl className={h.facts}>
            {FACTS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className={h.linkRow}>
            <button type="button" className={h.outline} onClick={() => onNavigate('experience')}>
              EXPÉRIENCE
            </button>
            <button type="button" className={h.outline} onClick={() => onNavigate('competences')}>
              COMPÉTENCES
            </button>
            <button type="button" className={h.primary} onClick={() => onNavigate('contact')}>
              CONTACT
            </button>
          </div>
        </div>
      );
    case 'experience':
      return (
        <div className={h.section} style={{ gap: 22 }}>
          {title('Expérience')}
          {EXPERIENCE.map((x) => (
            <article key={x.title} className={h.job}>
              <span className={h.kicker}>{x.when}</span>
              <h3 className={h.jobTitle}>{x.title}</h3>
              {x.points.length > 0 && (
                <div className={h.jobPoints}>
                  {x.points.map(([k, v]) => (
                    <p key={k}>
                      <strong>{k}</strong> {v}
                    </p>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      );
    case 'competences':
      return (
        <div className={h.section} style={{ gap: 18 }}>
          {title('Compétences')}
          {SKILLS.map((g) => (
            <div key={g.label} className={h.skillGroup}>
              <h3 className={`${h.mono} ${h.muted}`} style={{ margin: 0 }}>
                {g.label}
              </h3>
              <ul className={h.tags}>
                {g.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case 'formation':
      return (
        <div className={h.section}>
          {title('Formation')}
          <ol className={h.timeline}>
            {EDUCATION.map((e) => (
              <li key={e.title}>
                <span className={h.kicker}>{e.years}</span>
                <span className={h.eduTitle}>
                  <strong>{e.title}</strong>
                  <span>{e.school}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      );
    case 'consulting':
      return (
        <div className={h.section}>
          <span className={h.pending}>OFFRE EN COURS DE DÉFINITION</span>
          {title(CONSULTING.title, { fontSize: 24, lineHeight: 1.15 })}
          <p className={h.body}>{CONSULTING.pitch}</p>
          <ul className={h.offers}>
            {CONSULTING.offers.map(([k, v]) => (
              <li key={k}>
                <strong>{k}</strong>
                <span>{v}</span>
              </li>
            ))}
          </ul>
          <button type="button" className={h.submit} onClick={() => onNavigate('contact')}>
            DISCUTER D’UN PROJET
          </button>
        </div>
      );
    case 'contact':
      return (
        <div className={h.section} style={{ gap: 18 }}>
          {title('Contact')}
          <div className={h.card}>
            <span className={h.kicker}>RECRUTEMENT</span>
            <div className={h.linkRow}>
              <a href={`mailto:${PROFILE.email}`} className={h.primary}>
                {PROFILE.email.toUpperCase()}
              </a>
              <LinkedInLink />
              <CvLink />
            </div>
          </div>
          <ContactForm id={`form-${compactForm ? 'm' : 'd'}`} />
        </div>
      );
  }
}
