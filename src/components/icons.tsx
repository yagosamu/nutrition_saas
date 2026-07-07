// Set de ícones do produto: SVG inline, traço 1.5, herda cor do texto.
// Uso: <Icon name="home" size={20} />

const PATHS = {
  home: <path d="m3 9.5 9-7 9 7V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20Z M9 21.5v-8h6v8" />,
  book: <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />,
  chart: <path d="M22 7.5 13.5 16l-5-5L2 17.5 M16.5 7.5H22V13" />,
  folder: <path d="M3.5 20h17a1.5 1.5 0 0 0 1.5-1.5V8a1.5 1.5 0 0 0-1.5-1.5h-8.4a1.5 1.5 0 0 1-1.27-.68L9.6 4.18A1.5 1.5 0 0 0 8.35 3.5H3.5A1.5 1.5 0 0 0 2 5v13.5A1.5 1.5 0 0 0 3.5 20Z" />,
  list: <path d="M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01" />,
  camera: <path d="M14.5 4.5h-5l-1.7 2.5H4A1.5 1.5 0 0 0 2.5 8.5v9A1.5 1.5 0 0 0 4 19h16a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 20 7h-3.8Z M12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  link: <path d="M10 13.5a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 10.5a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />,
  refresh: <path d="M3 12a9 9 0 0 1 15.2-6.5L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15.2 6.5L3 16 M3 21v-5h5" />,
  edit: <path d="M17 3.5a2.1 2.1 0 0 1 3 3L8.5 18l-4 1 1-4Z" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  alert: <path d="M12 3 1.8 20.5h20.4Z M12 10v4.5 M12 17.8v.01" />,
  sparkles: <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />,
  clock: <path d="M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z M12 6.5V12l3.5 2" />,
  arrowLeft: <path d="M19 12H5 M11 18l-6-6 6-6" />,
  x: <path d="M18 6 6 18 M6 6l12 12" />,
  plus: <path d="M12 5v14 M5 12h14" />,
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: 16 | 20 | 24 | 12 | 18;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
