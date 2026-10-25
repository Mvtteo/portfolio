import { useRef, useState, type FormEvent } from 'react';
import { CONSULTING, FORM_ENDPOINT, PROFILE } from '../data/profile';
import h from './hud.module.css';

type Field = 'name' | 'company' | 'email' | 'need' | 'budget' | 'message';
type Values = Record<Field, string>;
type Errors = Partial<Record<'name' | 'email' | 'message', string>>;
type Result = { ok: boolean; text: string } | null;

const EMPTY: Values = { name: '', company: '', email: '', need: CONSULTING.needs[0], budget: '', message: '' };

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = 'Indiquez votre nom.';
  if (!v.email.trim()) e.email = 'Indiquez votre email pour que je puisse vous répondre.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'Format attendu : nom@domaine.fr';
  if (!v.message.trim()) e.message = 'Décrivez votre projet en quelques lignes.';
  return e;
}

/** Message pré-rempli : repli quand aucun service d'envoi n'est branché ou que l'envoi échoue. */
function mailto(v: Values) {
  const body = [
    `Nom : ${v.name}`,
    v.company ? `Entreprise : ${v.company}` : null,
    `Email : ${v.email}`,
    `Type de besoin : ${v.need}`,
    v.budget ? `Budget indicatif : ${v.budget}` : null,
    '',
    v.message,
  ]
    .filter((l) => l !== null)
    .join('\n');
  return `mailto:${PROFILE.email}?subject=${encodeURIComponent(`Mission de consulting — ${v.need}`)}&body=${encodeURIComponent(body)}`;
}

/**
 * Formulaire consulting. Sans service branché (FORM_ENDPOINT null), il prépare l'email dans la messagerie du
 * visiteur, sans jamais annoncer un envoi. Avec un service (POST JSON), succès affiché seulement si la réponse est OK.
 */
export function ContactForm({ id }: { id: string }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [result, setResult] = useState<Result>(null);
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (f: Field, value: string) => {
    const next = { ...values, [f]: value };
    setValues(next);
    // Après une première erreur, la correction est validée au fil de la saisie.
    if (touched[f]) setErrors(validate(next));
  };
  const blur = (f: Field) => {
    setTouched((t) => ({ ...t, [f]: true }));
    setErrors(validate(values));
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    setTouched({ name: true, email: true, message: true });
    const first = (['name', 'email', 'message'] as const).find((f) => errs[f]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (!FORM_ENDPOINT) {
      window.location.href = mailto(values);
      setResult({ ok: true, text: 'Votre messagerie s’ouvre avec le message pré-rempli : il reste à l’envoyer depuis celle-ci.' });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(String(res.status));
      setValues(EMPTY);
      setTouched({});
      setResult({ ok: true, text: 'Message envoyé. Réponse par email.' });
    } catch {
      setResult({ ok: false, text: 'L’envoi a échoué : aucun message n’a été transmis.' });
    } finally {
      setSending(false);
    }
  };

  const err = (f: 'name' | 'email' | 'message') =>
    touched[f] && errors[f] ? (
      <span id={`${id}-${f}-err`} className={h.fieldError}>
        {errors[f]}
      </span>
    ) : null;
  const described = (f: 'name' | 'email' | 'message') => (touched[f] && errors[f] ? `${id}-${f}-err` : undefined);
  const invalid = (f: 'name' | 'email' | 'message') => (touched[f] && errors[f] ? true : undefined);

  return (
    <form ref={formRef} onSubmit={submit} noValidate className={h.card} aria-labelledby={`${id}-title`}>
      <span id={`${id}-title`} className={h.kicker}>
        MISSION DE CONSULTING
      </span>
      <p className={h.formHint}>
        {FORM_ENDPOINT
          ? 'Les champs marqués * sont obligatoires.'
          : 'Les champs marqués * sont obligatoires. Le message s’ouvrira dans votre messagerie, pré-rempli, pour que vous l’envoyiez.'}
      </p>
      <div className={h.formRow}>
        <label className={h.field}>
          <span>
            Nom <span aria-hidden="true">*</span>
          </span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            required
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => blur('name')}
            aria-invalid={invalid('name')}
            aria-describedby={described('name')}
          />
          {err('name')}
        </label>
        <label className={h.field}>
          <span>
            Email <span aria-hidden="true">*</span>
          </span>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            onBlur={() => blur('email')}
            aria-invalid={invalid('email')}
            aria-describedby={described('email')}
          />
          {err('email')}
        </label>
      </div>
      <div className={h.formRow}>
        <label className={h.field}>
          <span>
            Entreprise <span className={h.optional}>(facultatif)</span>
          </span>
          <input name="company" type="text" autoComplete="organization" value={values.company} onChange={(e) => set('company', e.target.value)} />
        </label>
        <label className={h.field}>
          <span>
            Budget <span className={h.optional}>(facultatif)</span>
          </span>
          <input name="budget" type="text" value={values.budget} onChange={(e) => set('budget', e.target.value)} />
        </label>
      </div>
      <label className={h.field}>
        Type de besoin
        <select name="need" value={values.need} onChange={(e) => set('need', e.target.value)}>
          {CONSULTING.needs.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label className={h.field}>
        <span>
          Description du projet <span aria-hidden="true">*</span>
        </span>
        <textarea
          name="message"
          rows={4}
          required
          value={values.message}
          onChange={(e) => set('message', e.target.value)}
          onBlur={() => blur('message')}
          aria-invalid={invalid('message')}
          aria-describedby={described('message')}
        />
        {err('message')}
      </label>
      <button type="submit" className={h.submit} disabled={sending} aria-busy={sending}>
        {sending ? 'ENVOI…' : FORM_ENDPOINT ? 'ENVOYER' : 'PRÉPARER L’EMAIL'}
      </button>
      <div role="status" aria-live="polite">
        {result && (
          <p className={h.formMsg} data-ok={result.ok}>
            {result.text}{' '}
            {!result.ok && (
              <>
                Vous pouvez{' '}
                <a href={mailto(values)} className={h.inlineLink}>
                  l’envoyer depuis votre messagerie
                </a>{' '}
                ou écrire à <a href={`mailto:${PROFILE.email}`}>{PROFILE.email}</a>.
              </>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
