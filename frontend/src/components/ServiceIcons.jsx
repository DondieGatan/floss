// One matching set of duotone line icons for the clinic's services (the landing page's service
// cards, specialty cards and ticker). They draw with currentColor, and a soft fill of the same
// colour picks out the main shape, so each one follows whatever colour its tile sets.

const TOOTH =
  'M8 3c1.2 0 1.8.6 4 .6s2.8-.6 4-.6c2.2 0 3.5 2 3.5 5 0 4-1.2 8-2.5 10.5-.5 1-1.2 1.9-2 1.9s-1-1.6-1.3-3.3c-.3-1.7-.7-3.1-1.7-3.1s-1.4 1.4-1.7 3.1c-.3 1.7-.5 3.3-1.3 3.3s-1.5-.9-2-1.9C5.7 16 4.5 12 4.5 8c0-3 1.3-5 3.5-5z';

function Svg({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const SOFT = { fill: 'currentColor', fillOpacity: 0.16 };

export function ToothbrushIcon() {
  return (
    <Svg>
      <g transform="rotate(-45 12 12)">
        <rect x="2" y="10.4" width="12" height="3.2" rx="1.6" />
        <rect x="14.5" y="8.8" width="7.5" height="6.4" rx="1.6" {...SOFT} />
        <path d="M16.6 8.8V6.6M19 8.8V6.2M21.3 8.8V6.8" />
      </g>
      <path d="M5.5 3v4.4M3.3 5.2h4.4" strokeWidth="1.4" />
    </Svg>
  );
}

export function BracesIcon() {
  return (
    <Svg>
      <rect x="2" y="6.5" width="4.4" height="11" rx="2" {...SOFT} />
      <rect x="7.2" y="6.5" width="4.4" height="11" rx="2" {...SOFT} />
      <rect x="12.4" y="6.5" width="4.4" height="11" rx="2" {...SOFT} />
      <rect x="17.6" y="6.5" width="4.4" height="11" rx="2" {...SOFT} />
      <path d="M1.5 12h21" />
      <g fill="currentColor" stroke="none">
        <rect x="3.2" y="10.6" width="2" height="2.8" rx="0.6" />
        <rect x="8.4" y="10.6" width="2" height="2.8" rx="0.6" />
        <rect x="13.6" y="10.6" width="2" height="2.8" rx="0.6" />
        <rect x="18.8" y="10.6" width="2" height="2.8" rx="0.6" />
      </g>
    </Svg>
  );
}

export function SmileIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12.5" r="8.5" {...SOFT} />
      <path d="M12 4c-.4-1.4.6-2.4 2-2.2" />
      <path d="M8.3 15c1 1.7 2.3 2.4 3.7 2.4s2.7-.7 3.7-2.4" />
      <g fill="currentColor" stroke="none">
        <circle cx="9" cy="11.5" r="0.95" />
        <circle cx="15" cy="11.5" r="0.95" />
      </g>
    </Svg>
  );
}

export function RootCanalIcon() {
  return (
    <Svg>
      <path d={TOOTH} {...SOFT} />
      <path d="M9.3 10.5c.4 2.4.3 5.2-.1 7.4M14.7 10.5c-.4 2.4-.3 5.2.1 7.4" strokeWidth="1.4" />
    </Svg>
  );
}

export function GumIcon() {
  return (
    <Svg>
      <path d={TOOTH} />
      <path
        d="M2.5 13c1.9-1.4 3.4-1.4 4.8 0s3.3 1.4 4.7 0 3.3-1.4 4.7 0 3.1 1.4 4.8 0V21.5H2.5z"
        {...SOFT}
      />
      <path d="M2.5 13c1.9-1.4 3.4-1.4 4.8 0s3.3 1.4 4.7 0 3.3-1.4 4.7 0 3.1 1.4 4.8 0" />
    </Svg>
  );
}

export function ScalpelIcon() {
  return (
    <Svg>
      <g transform="rotate(45 12 12)">
        <rect x="2.5" y="10.8" width="10.5" height="2.4" rx="1.2" />
        <path d="M13 10.8l8 1.2-8 1.2z" {...SOFT} />
      </g>
      <path d="M18.5 3v4.4M16.3 5.2h4.4" strokeWidth="1.4" />
    </Svg>
  );
}
