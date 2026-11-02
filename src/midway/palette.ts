import { theme } from '../carnival';

const { colors } = theme;

/**
 * The midway map's palette, drawn like a light topographic map. Brand blues,
 * whites and inks come from the carnival theme; the terrain greens, contour
 * lines, water and other scenery shades only the map uses live here.
 */
export const palette = {
  sky: '#dceaf3',
  skyHigh: '#b9d6ea',
  cloud: colors.foreground,
  cloudShade: '#e3edf4',
  haze: '#c9dfe0',

  grass: '#cfe0b4',
  grassDark: '#a9c487',
  grassEdge: '#9cb87d',
  grassLight: '#e1ecc9',
  path: colors.foreground,
  pathShade: colors.border,
  /** Casing either side of a path, like a road on a map. */
  pathCasing: '#a8a8a8',
  /** Index contours (every fifth) are drawn darker than the rest. */
  contour: 'rgba(120, 92, 52, 0.28)',
  contourIndex: 'rgba(120, 92, 52, 0.5)',
  contourLabel: '#6e5530',
  hedge: '#7fa65a',
  hedgeDark: '#5f8a3f',
  hedgeLight: '#9cc073',
  shadow: 'rgba(40, 60, 30, 0.22)',

  red: colors.danger,
  redShade: '#9c2216',
  cream: colors.foreground,
  creamShade: '#e4e4e4',
  gold: '#f0a830',
  goldShade: '#c98512',
  blue: colors.brand,
  blueShade: colors.brandPress,
  sky2: '#6cb7e2',
  pink: '#e58fae',
  pinkShade: '#c86e8f',
  wood: colors.wood,
  woodDark: '#6b4429',
  woodLight: '#b7834f',
  board: '#ece4d6',
  metal: '#f0f0f0',
  metalShade: '#b5b5b5',
  ink: colors.text,
  opening: '#3d3d3d',
  closed: '#c2c2c2',
  closedShade: '#8c8c8c',
  white: '#ffffff',

  skins: ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'],
  hairs: ['#3b2219', colors.text, '#a55728', '#e6c35c', '#6b4429'],
  shirts: [colors.water, '#7bd389', '#b48ee0', colors.danger, colors.brand, colors.foreground],
  pants: ['#2d3a6b', '#3b3b4f', '#5a4a3a'],
  bunting: [colors.brand, '#f0a830', colors.danger, colors.foreground],
  balloons: [colors.danger, '#f0a830', colors.brand, colors.water, '#e58fae'],
} as const;
