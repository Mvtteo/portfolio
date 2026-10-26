import { STAR_TYPES, type StarClass } from '../data/sectors';

/*
 * Icône d'objet stellaire (HUD) : reprend la forme de l'objet dans la scène, donc le type se lit
 * sans la couleur. 'all' = trou noir central (ombre, anneau de photons, disque).
 */
export function StarIcon({ kind, size = 14 }: { kind: StarClass | 'all'; size?: number }) {
  if (kind === 'all') {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" style={{ flex: 'none' }}>
        <ellipse cx="8" cy="8" rx="7.4" ry="2.1" fill="none" stroke="#F5A86E" strokeWidth="1.1" />
        <circle cx="8" cy="8" r="3.6" fill="#FFE2C2" opacity=".35" />
        <circle cx="8" cy="8" r="2.7" fill="#020203" stroke="#FFF8EC" strokeWidth=".8" />
        <path d="M2.4 8.9Q8 10.6 13.6 8.9" fill="none" stroke="#FFE2C2" strokeWidth="1.1" />
      </svg>
    );
  }
  const t = STAR_TYPES[kind];
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" style={{ flex: 'none' }}>
      <circle cx="8" cy="8" r="7" fill={t.halo} opacity=".14" />
      {kind === 'cepheid' && <circle cx="8" cy="8" r="6.2" fill="none" stroke={t.halo} strokeWidth=".9" strokeDasharray="1.6 1.4" />}
      <circle cx="8" cy="8" r={kind === 'binary' ? 3.4 : 4} fill={t.halo} opacity=".32" />
      {kind === 'A' && <path d="M8 .6V15.4M.6 8H15.4" stroke={t.halo} strokeWidth=".8" />}
      {kind === 'pulsar' && <path d="M8 8L2.2 1.4L3.6 1L8 8L12.4 15L13.8 14.6z" fill={t.halo} opacity=".85" />}
      {kind === 'binary' ? (
        <>
          <circle cx="6.6" cy="8.6" r="2.2" fill={t.core} />
          <circle cx="12" cy="5.4" r="1.4" fill="#FFE0C8" />
        </>
      ) : (
        <circle cx="8" cy="8" r={kind === 'pulsar' ? 1.6 : 2} fill={t.core} />
      )}
    </svg>
  );
}

export function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" style={{ flex: 'none' }}>
      <path d="M2 7a5 5 0 1 0 10 0a5 5 0 1 0-10 0M10.8 10.8L14 14" fill="none" stroke="var(--c-muted)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
      <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Chevron({ dir, size = 16 }: { dir: 'left' | 'right'; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" style={{ flex: 'none' }}>
      <path d={dir === 'left' ? 'M10 3L5 8L10 13' : 'M6 3L11 8L6 13'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TargetIcon({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" style={{ flex: 'none' }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M8 5a3 3 0 1 0 0 6a3 3 0 1 0 0-6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 18 18">
      <path d="M3 6H15M3 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
