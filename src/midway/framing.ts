/**
 * Where the midway's camera may go and how close it sits. Plain functions,
 * so the framing can be tested without a browser.
 */

import { islandBounds, type Bounds } from './cutaway';
import type { MidwayMap, Point } from './world';

/** How far past the island, in world pixels, the camera may look. */
const SIDE_MARGIN = 24;
/** Room for the tallest rides above the horizon. */
const SKY_ROOM = 150;
/** Room below the island's lowest root. */
const UNDER_MARGIN = 14;

/** CSS pixels per world pixel for a canvas of the given CSS size. */
export function zoomFor(width: number, height: number): number {
  // Fit most of the midway on screen, but never so small that people get lost.
  return Math.max(1.3, Math.min(3, Math.min(width / 720, height / 540)));
}

/**
 * The world-pixel box the camera stays inside: the island with its whole
 * cross-section, and the sky above it. It depends only on the map, so the
 * world never grows unbounded.
 */
export function cameraBounds(map: Pick<MidwayMap, 'width' | 'height'>, horizon: number): Bounds {
  const island = islandBounds(map);
  return {
    left: island.left - SIDE_MARGIN,
    right: island.right + SIDE_MARGIN,
    top: horizon - SKY_ROOM,
    bottom: island.bottom + UNDER_MARGIN,
  };
}

/**
 * The camera's top-left corner that keeps `focus` a little below the middle
 * of a `view`-sized window, without leaving `bounds`. Along a side where the
 * bounds are smaller than the view, they're centred instead.
 */
export function cameraTarget(bounds: Bounds, focus: Point, view: { w: number; h: number }): Point {
  const fit = (target: number, min: number, max: number, size: number) =>
    max - min <= size ? (min + max) / 2 - size / 2 : Math.max(min, Math.min(max - size, target));
  return {
    x: fit(focus.x - view.w / 2, bounds.left, bounds.right, view.w),
    y: fit(focus.y - view.h / 2 - 16, bounds.top, bounds.bottom, view.h),
  };
}
