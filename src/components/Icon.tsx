/** A tiny stroke icon set. Hand-drawn paths, no icon package. */

export type IconName =
  | "pulse"
  | "layers"
  | "users"
  | "book"
  | "clock"
  | "arrow"
  | "note"
  | "alert"
  | "check"
  | "rollback"
  | "search"
  | "play";

const PATHS: Record<IconName, string> = {
  pulse: "M2 12h4l2.5-6 3.5 12 2.5-6H22",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M17 8.5a3 3 0 1 0 0-6M18 14a5.5 5.5 0 0 1 5.5 5.5",
  book: "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17ZM4 19.5A2.5 2.5 0 0 1 6.5 17H20",
  clock: "M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  note: "M5 3h9l5 5v13H5V3Zm9 0v5h5M8 13h8M8 17h5",
  alert: "M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.5",
  check: "M4 12.5 9.5 18 20 6",
  rollback: "M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5 -2 5 5",
  play: "M7 4.5v15l13-7.5-13-7.5Z",
};

export function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
