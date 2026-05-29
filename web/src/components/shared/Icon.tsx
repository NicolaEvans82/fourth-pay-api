import type { CSSProperties, ReactNode } from 'react';

// Centralised SVG icon registry. Every icon used by Fourth Pay lives
// here; new ones go below as `path:`/`children:` entries. Sourced
// from the original docs/index.html (Tabler-style strokes). Keeping
// them inline avoids loading a sprite or icon font.
const PATHS: Record<string, ReactNode> = {
  bolt:        <path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" />,
  back:        <path d="M15 6l-6 6l6 6" />,
  chevronR:    <path d="M9 6l6 6l-6 6" />,
  chevronD:    <path d="M6 9l6 6l6 -6" />,
  check:       <path d="M5 12l5 5l10 -10" />,
  bell:        <><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></>,
  warning:     <><circle cx="12" cy="12" r="9" /><path d="M12 8v1" /><path d="M11 12h1v4h1" /></>,
  info:        <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  alert:       <><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16v.01" /></>,
  plus:        <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  send:        <><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></>,
  download:    <><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4v12" /></>,
  mail:        <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6l9 -6" /></>,
  trend:       <><polyline points="4 19 8 15 12 19 16 13 20 19" /><line x1="4" y1="15" x2="20" y2="15" /></>,
  card:        <><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" /></>,
  piggy:       <><path d="M17 8v-1a5 5 0 0 0 -10 0v1" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M5 8h14a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-1l-1 3h-8l-1 -3h-1a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1z" /><path d="M19 12h2" /></>,
  coin:        <><circle cx="12" cy="12" r="9" /><path d="M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 0 0 4h-2a2 2 0 0 1 -1.8 -1" /><path d="M12 7v10" /></>,
  shield:      <><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /><rect x="9" y="3" width="6" height="4" rx="2" /><path d="M9 12l2 2l4 -4" /><path d="M9 17l2 2l4 -4" /></>,
  pension:     <><path d="M10 3.2a9 9 0 1 0 10.8 10.8a1 1 0 0 0 -1 -1h-6.8a2 2 0 0 1 -2 -2v-7a.9 .9 0 0 0 -1 -.8" /><path d="M15 3.5a9 9 0 0 1 5.5 5.5h-4.5a1 1 0 0 1 -1 -1v-4.5" /></>,
  robot:       <><rect x="3" y="9" width="18" height="12" rx="3" /><path d="M15 9v-4a3 3 0 0 0 -6 0v4" /><circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none" /><circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none" /><path d="M12 3l0 .01" /></>,
  doc:         <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8" /><path d="M8 11h3" /><path d="M13 11h3" /><path d="M8 15h3" /><path d="M13 15h3" /><path d="M8 19h3" /><path d="M13 19h3" /></>,
  book:        <><path d="M22 9l-10 -4l-10 4l10 4z" /><path d="M6 10.6v4.4a6 6 0 0 0 12 0v-4.4" /><path d="M22 9v6" /></>,
  home:        <><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></>,
  cal:         <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M11 15h1" /><path d="M12 15v3" /></>,
  grid:        <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  heart:       <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.566" />,
  pause:       <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>,
  building:    <><path d="M3 21l18 0" /><path d="M9 8h1" /><path d="M9 12h1" /><path d="M9 16h1" /><path d="M14 8h1" /><path d="M14 12h1" /><path d="M14 16h1" /><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" /></>,
  wifi:        <><path d="M12 18l.01 0" /><path d="M9.172 15.172a4 4 0 0 1 5.656 0" /><path d="M6.343 12.343a8 8 0 0 1 11.314 0" /><path d="M3.515 9.515c4.686 -4.687 12.284 -4.687 16.97 0" /></>,
  battery:     <><path d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2" /><path d="M7 10v4" /><path d="M10 10v4" /></>,
  eye:         <><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></>,
  bank:        <><path d="M3 21l18 0" /><path d="M3 10l18 0" /><path d="M5 6l7 -3l7 3" /><path d="M4 10l0 11" /><path d="M20 10l0 11" /><path d="M8 14l0 3" /><path d="M12 14l0 3" /><path d="M16 14l0 3" /></>,
  sliders:     <><circle cx="6" cy="10" r="2" /><path d="M6 4v4m0 4v8" /><circle cx="12" cy="6" r="2" /><path d="M12 4v0m0 4v14" /><circle cx="18" cy="14" r="2" /><path d="M18 4v8m0 4v4" /></>,
  flag:        <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />,
  fileText:    <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 17h6" /><path d="M9 13h6" /></>,
  headset:     <><path d="M4 14v-3a8 8 0 1 1 16 0v3" /><path d="M18 19c0 1.657 -2.686 3 -6 3" /><rect x="2" y="14" width="4" height="6" rx="2" /><rect x="18" y="14" width="4" height="6" rx="2" /></>,
  users:       <><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></>,
  fileBlank:   <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 9h1" /><path d="M9 13h6" /><path d="M9 17h6" /></>,
};

interface IconProps {
  name: keyof typeof PATHS;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 20, color, className, style }: IconProps) {
  const path = PATHS[name];
  if (!path) {
    // eslint-disable-next-line no-console
    console.warn('Icon: unknown name', name);
    return null;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      {path}
    </svg>
  );
}
