import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'play'
  | 'pause'
  | 'step'
  | 'reset'
  | 'undo'
  | 'redo'
  | 'plus'
  | 'folder'
  | 'save'
  | 'chevron'
  | 'learn'
  | 'close'
  | 'alert'
  | 'check'
  | 'trash'
  | 'fit'
  | 'clock'
  | 'info'
  | 'trashWire';

const paths: Record<IconName, ReactNode> = {
  play: <path fill="currentColor" stroke="none" d="M8 5.5v13l11-6.5z" />,
  pause: (
    <>
      <rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  step: (
    <>
      <path d="M6 5v14l9-7z" fill="currentColor" stroke="none" />
      <path d="M18 5v14" />
    </>
  ),
  reset: (
    <>
      <path d="M4 5v5h5" />
      <path d="M5.5 14a7 7 0 1 0 1.2-6.7L4 10" />
    </>
  ),
  undo: (
    <>
      <path d="m8 5-4 4 4 4" />
      <path d="M4 9h9a6 6 0 0 1 0 12h-3" />
    </>
  ),
  redo: (
    <>
      <path d="m16 5 4 4-4 4" />
      <path d="M20 9h-9a6 6 0 0 0 0 12h3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  folder: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  save: (
    <>
      <path d="M4 4h12l4 4v12H4z" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" />
    </>
  ),
  chevron: <path d="m7 9 5 5 5-5" />,
  learn: (
    <>
      <path d="m3 9 9-4 9 4-9 4z" />
      <path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5M21 9v5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 4 3 20h18z" />
      <path d="M12 9v5M12 17.5v.1" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
    </>
  ),
  fit: (
    <>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 8v.1" />
    </>
  ),
  trashWire: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
