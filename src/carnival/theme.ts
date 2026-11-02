/**
 * The carnival's colours, fonts and sizes. Games draw with these rather than
 * their own values, so every booth on the midway looks like it belongs.
 *
 * The look is a printed atlas: white paper, a limited family of cyan,
 * vermilion and forest-green inks, and dark linework. Colours used for text
 * on `background` and `foreground` meet WCAG AA contrast.
 */
export const theme = {
  colors: {
    /** The page and every game canvas: white paper. */
    background: '#fbfcfb',
    /** Panels and cards that sit on the background. */
    foreground: '#ffffff',
    /** Filled shapes a step darker than the background: holes, empty pips. */
    surface: '#c8d5d1',
    border: '#9fb3b0',
    /** Dark linework and body text. */
    text: '#16232a',
    muted: '#3d4f55',
    /** Links, primary actions and focus: the cyan ink at full strength. */
    brand: '#00648a',
    brandPress: '#004d6b',
    /** The vermilion ink games use for targets, rings and points scored. */
    accent: '#c2391b',
    danger: '#a3162a',
    /** The forest-green ink. */
    forest: '#2c6a45',
    /** Two-tone bands and rings, such as a booth's valance or a target. */
    stripeA: '#00648a',
    stripeB: '#9fd3e3',
    water: '#1a7fa8',
    wood: '#7a4e2d',
  },
  font: {
    family: '"Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif',
    /** Bold, condensed atlas lettering for the carnival's name and booth signs. */
    display:
      '"Avenir Next Condensed", "DIN Condensed", "Bahnschrift SemiBold Condensed", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", Impact, sans-serif-condensed, sans-serif',
    small: 14,
    body: 18,
    title: 32,
  },
  radius: 2,
  canvas: {
    width: 800,
    height: 500,
  },
} as const;

/** Canvas font string, e.g. canvasFont('title') → 'bold 32px "Avenir Next", …'. */
export function canvasFont(
  size: 'small' | 'body' | 'title',
  weight: 'normal' | 'bold' = 'normal',
  face: 'family' | 'display' = 'family',
) {
  return `${weight} ${theme.font[size]}px ${theme.font[face]}`;
}

/** Exposes the theme to CSS as custom properties, e.g. --color-accent. */
export function applyTheme(root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${name}`, value);
  }
  root.style.setProperty('--font-family', theme.font.family);
  root.style.setProperty('--font-display', theme.font.display);
  root.style.setProperty('--radius', `${theme.radius}px`);
}
