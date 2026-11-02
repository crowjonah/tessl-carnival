import { theme } from '../carnival';

const { colors } = theme;

/**
 * The midway map's palette, printed like a limited-ink atlas: white paper,
 * cyan, vermilion and forest-green inks with their lighter tints, and dark
 * linework. Full-strength inks come from the carnival theme; the tints and
 * print effects only the map uses live here.
 */
export const palette = {
  sky: '#f4f8f7',
  skyHigh: '#d9edf2',
  cloud: colors.foreground,
  cloudShade: '#cfe7ee',

  /**
   * The island's cross-section, from the topsoil down to the bedrock, in
   * tints of the same three inks, so the underground stays part of the print.
   */
  strata: ['#5e8f63', '#f6d9cd', '#cfe6ee', '#e1eee0', '#a9d3e0', '#f1c0ae', '#6aa7bf'],
  /** The ruled line between two strata. */
  strataLine: 'rgba(22, 35, 42, 0.4)',
  /** The cyan wash over the face turned away from the light. */
  faceShade: 'rgba(0, 77, 107, 0.18)',
  /** Roots in section, and the pale hollows the buried relics lie in. */
  root: '#4e3220',
  rootLight: '#a8774f',
  hollow: 'rgba(255, 255, 255, 0.7)',
  /** The Water Cannon's buried main, and the water in its cistern. */
  pipe: colors.brandPress,
  pipeLight: colors.stripeB,
  water: colors.water,
  /** Terrace tops, from the lowest step to the highest, in green-ink tints. */
  terraces: ['#eef5ea', '#dcebd5', '#c8e0c0', '#b2d3ab', '#9cc597', '#86b683', '#6fa671'],
  /** Riser faces under each terrace's front edge. */
  riser: '#5e8f63',
  riserDark: '#3f6e48',
  /** The crisp dark rim on top of each riser. */
  terraceEdge: 'rgba(22, 35, 42, 0.55)',
  path: colors.foreground,
  pathShade: colors.border,
  /** Casing either side of a path, like a road on a map. */
  pathCasing: colors.text,
  /** Index contours (every fifth) are drawn darker than the rest. */
  contour: 'rgba(44, 106, 69, 0.35)',
  contourIndex: 'rgba(44, 106, 69, 0.65)',
  contourLabel: colors.accent,
  /** Print textures: stipple on the terraces, halftone in shadows. */
  stipple: 'rgba(44, 106, 69, 0.5)',
  halftone: 'rgba(0, 100, 138, 0.55)',
  /** The second ink, printed slightly off register on selected scenery. */
  misregister: 'rgba(194, 57, 27, 0.5)',
  hedge: '#4f8a5c',
  hedgeDark: colors.forest,
  hedgeLight: '#7fb48a',
  shadow: 'rgba(0, 77, 107, 0.2)',

  red: colors.accent,
  redShade: '#8f2a14',
  cream: colors.foreground,
  creamShade: '#dde6e4',
  /** What was gold is now a vermilion tint, so there are only three inks. */
  gold: '#f19a7e',
  goldShade: '#d4664a',
  blue: colors.brand,
  blueShade: colors.brandPress,
  sky2: '#69b7d1',
  /** What was pink is now a cyan tint. */
  pink: colors.stripeB,
  pinkShade: '#5fa9c2',
  wood: colors.wood,
  woodDark: '#4e3220',
  woodLight: '#a8774f',
  board: '#eef2f0',
  metal: '#f0f3f2',
  metalShade: '#8fa3a0',
  ink: colors.text,
  opening: '#24343b',
  closed: '#c8d1cf',
  closedShade: '#6e7f7c',
  white: '#ffffff',

  skins: ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'],
  hairs: ['#3b2219', colors.text, '#8f2a14', '#d9a15c', '#4e3220'],
  shirts: [colors.water, colors.forest, colors.accent, '#f19a7e', colors.brand, colors.foreground],
  pants: [colors.text, '#2f4a52', '#4e3220'],
  bunting: [colors.brand, colors.accent, colors.forest, colors.foreground],
  balloons: [colors.accent, '#f19a7e', colors.brand, colors.stripeB, colors.forest],
} as const;
