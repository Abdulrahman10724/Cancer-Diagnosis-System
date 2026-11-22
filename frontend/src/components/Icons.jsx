// The few icons the app needs, drawn as inline SVG.

// SVG glyphs placed inside the metro diagram, centred on (x, y)
export function LockGlyph({ x, y, className }) {
  return (
    <g transform={`translate(${x - 5} ${y - 6})`} className={className} aria-hidden="true">
      <path d="M2.5 5.5V3.6a2.5 2.5 0 0 1 5 0v1.9" fill="none" strokeWidth="1.6" stroke="currentColor" />
      <rect x="0.5" y="5.5" width="9" height="6.5" rx="1.5" fill="currentColor" />
    </g>
  );
}

export function CheckGlyph({ x, y, className }) {
  return (
    <path
      d={`M${x - 5},${y} l3.5,3.5 l6.5,-7`}
      className={className}
      fill="none"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  );
}

// 32 x 18 (horizontal) or 18 x 32 (vertical), drawn from (0, 0)
export function TrainGlyph({ vertical = false }) {
  const body = vertical ? (
    <>
      <rect x="0" y="0" width="18" height="32" rx="9" className="train-body" />
      <rect x="4" y="5" width="10" height="7" rx="2" className="train-window" />
    </>
  ) : (
    <>
      <rect x="0" y="0" width="32" height="18" rx="9" className="train-body" />
      <rect x="20" y="4" width="7" height="10" rx="2" className="train-window" />
    </>
  );
  return <g>{body}</g>;
}

// HTML icons (16px by default)
function Svg({ size = 16, children, label, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const LockIcon = (p) => (
  <Svg {...p}>
    <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    <rect x="3.5" y="7" width="9" height="7" rx="1.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const CheckIcon = (p) => (
  <Svg {...p}>
    <path d="M3 8.5l3 3 7-7" />
  </Svg>
);

export const ArrowIcon = ({ left = false, ...p }) => (
  <Svg {...p}>
    {left ? <path d="M13 8H3m4-4L3 8l4 4" /> : <path d="M3 8h10m-4-4 4 4-4 4" />}
  </Svg>
);

export const CloseIcon = (p) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);

export const MenuIcon = (p) => (
  <Svg {...p}>
    <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
  </Svg>
);

export const TrainIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="1.5" width="10" height="10" rx="3" />
    <path d="M3 7h10M5.5 14l1-2.5M10.5 14l-1-2.5" />
  </Svg>
);

// Outcome icons: always shown with a word
export const UpIcon = (p) => (
  <Svg {...p}>
    <path d="M8 2.5 14 13H2z" fill="currentColor" stroke="none" />
  </Svg>
);

export const BangIcon = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 4.5v4.2M8 11.3v.2" />
  </Svg>
);
