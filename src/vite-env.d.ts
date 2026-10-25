/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Service d'envoi du formulaire consulting (Formspree ou compatible). Absent = échec explicite à l'envoi. */
  readonly VITE_FORM_ENDPOINT?: string;
}
