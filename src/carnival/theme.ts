/**
 * The carnival's colours, fonts and sizes. Games draw with these rather than
 * their own values, so every booth on the midway looks like it belongs.
 *
 * The look is a light, map-like shell inspired by the Calcite Design System's
 * light tokens: white and light-grey surfaces, dark text, thin borders and a
 * blue brand colour for actions. Colours used for text on `background` meet
 * WCAG AA contrast.
 */
export const theme = {
  colors: {
    /** The page and every game canvas. */
    background: '#f7f7f7',
    /** Panels and cards that sit on the background. */
    foreground: '#ffffff',
    /** Filled shapes a step darker than the background: holes, empty pips. */
    surface: '#c7c7c7',
    border: '#d4d4d4',
    text: '#141414',
    muted: '#4a4a4a',
    /** Links, primary actions and focus. */
    brand: '#007ac2',
    brandPress: '#00619b',
    /** The warm highlight games use for targets, rings and points scored. */
    accent: '#a85300',
    danger: '#c42b1c',
    /** Two-tone bands and rings, such as a booth's valance or a target. */
    stripeA: '#007ac2',
    stripeB: '#a5cfee',
    water: '#2e8fcc',
    wood: '#8a5a3b',
  },
  font: {
    family:
      '"Avenir Next", Avenir, "Avenir Next LT Pro", "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif',
    small: 14,
    body: 18,
    title: 32,
  },
  radius: 4,
  canvas: {
    width: 800,
    height: 500,
  },
} as const;

/** Canvas font string, e.g. canvasFont('title') → 'bold 32px "Avenir Next", …'. */
export function canvasFont(size: 'small' | 'body' | 'title', weight: 'normal' | 'bold' = 'normal') {
  return `${weight} ${theme.font[size]}px ${theme.font.family}`;
}

/** Exposes the theme to CSS as custom properties, e.g. --color-accent. */
export function applyTheme(root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${name}`, value);
  }
  root.style.setProperty('--font-family', theme.font.family);
  root.style.setProperty('--radius', `${theme.radius}px`);
}
