import { MARK_PATHS, type Mark } from '../data/sectors';

export function MarkIcon({ mark, size = 12, color = 'currentColor', width = 1.5 }: { mark: Mark | 'all'; size?: number; color?: string; width?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 12 12" style={{ flex: 'none' }}>
      <path d={MARK_PATHS[mark]} fill="none" stroke={color} strokeWidth={width} />
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
