// Stroke icon set — 24px grid, 1.8 stroke, round caps. SVG instead of emoji
// keeps the chrome adult and lets the active state tint with currentColor.
const base = {
  width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
};

export const IconSun = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconPlus = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export const IconBody = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="5" r="2.6" />
    <path d="M12 8v6M12 14l-3 6M12 14l3 6M7 10.5l5-1.5 5 1.5" />
  </svg>
);

export const IconPulse = (p) => (
  <svg {...base} {...p}>
    <path d="M3 12h4l2.5-6 4 12L16 12h5" />
  </svg>
);

export const IconChat = (p) => (
  <svg {...base} {...p}>
    <path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 21 12Z" />
    <path d="M9 11h6M9 14h3" />
  </svg>
);

export const IconGear = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.07-.4.1-.8.1-1.2Z" />
  </svg>
);

export const IconBolt = (p) => (
  <svg {...base} {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
);

export const IconMoon = (p) => (
  <svg {...base} {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" /></svg>
);

export const IconFlame = (p) => (
  <svg {...base} {...p}>
    <path d="M12 22c4 0 7-2.8 7-6.7 0-3.2-2-5.5-3.8-7.3C13.7 6.5 13 4.5 13 2c-3 2-4.2 4.6-4.2 6.8 0 .7.1 1.3.2 1.8C8 9.8 7 8.6 7 7c-1.8 1.7-2 4.2-2 5.8C5 19 8 22 12 22Z" />
  </svg>
);

export const IconFork = (p) => (
  <svg {...base} {...p}>
    <path d="M7 2v8M4.5 2v5a2.5 2.5 0 0 0 5 0V2M7 14v8M17 2c-2 2-2.5 5-2.5 8h5V2ZM17 10v12" />
  </svg>
);

export const IconHeart = (p) => (
  <svg {...base} {...p}>
    <path d="M12 21s-7.5-4.6-9.5-9.4C1 7.6 3.5 4 7 4c2 0 3.8 1.2 5 3 1.2-1.8 3-3 5-3 3.5 0 6 3.6 4.5 7.6C19.5 16.4 12 21 12 21Z" />
  </svg>
);

export const IconDrop = (p) => (
  <svg {...base} {...p}><path d="M12 2.7S5.5 9.8 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 9.8 12 2.7 12 2.7Z" /></svg>
);

export const IconClipboard = (p) => (
  <svg {...base} {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9 4a2 2 0 0 1 6 0M9 10h6M9 14h6M9 18h3" />
  </svg>
);

export const IconBarbell = (p) => (
  <svg {...base} {...p}>
    <path d="M7 12h10M3.5 9.5v5M6 7.5v9M18 7.5v9M20.5 9.5v5" />
  </svg>
);

export const IconWatch = (p) => (
  <svg {...base} {...p}>
    <rect x="7" y="6.5" width="10" height="11" rx="3.5" />
    <path d="M9 6.5 9.6 2h4.8L15 6.5M9 17.5 9.6 22h4.8l.6-4.5M12 10v2.5l1.8 1.2" />
  </svg>
);

export const IconLock = (p) => (
  <svg {...base} {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="3" />
    <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7M12 14.5v2.5" />
  </svg>
);

export const IconLink = (p) => (
  <svg {...base} {...p}>
    <path d="M9.5 14.5 14.5 9.5M8 11l-2.6 2.6a3.8 3.8 0 0 0 5.4 5.4L13.4 16M16 13l2.6-2.6a3.8 3.8 0 0 0-5.4-5.4L10.6 8" />
  </svg>
);

export const IconShield = (p) => (
  <svg {...base} {...p}>
    <path d="M12 2.5 19.5 5v6c0 5-3.2 8.7-7.5 10.5C7.7 19.7 4.5 16 4.5 11V5L12 2.5Z" />
    <path d="m9 11.5 2.2 2.2L15.5 9.4" />
  </svg>
);

export const IconArrow = (p) => (
  <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export const IconBack = (p) => (
  <svg {...base} {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
);

export const IconX = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export const IconSearch = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></svg>
);

export const IconTrend = (p) => (
  <svg {...base} {...p}><path d="M3 17l5.5-5.5 3.5 3.5L21 7M15.5 7H21v5.5" /></svg>
);

export const IconSparkle = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
  </svg>
);
