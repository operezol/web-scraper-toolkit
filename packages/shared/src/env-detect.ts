import { evaluateDetection } from "./detection.js";
import { FXSTREET_DETECTION } from "./presets/fxstreet.js";
import { normalizeInternalPath } from "./url-normalize.js";

export type PageEnvironment = "next" | "sitefinity" | "unknown" | "conflict";

/**
 * FXStreet stack detection via shared evaluateDetection + FXStreet preset.
 * Prefer evaluateDetection + preset in new code.
 */
export function detectPageEnvironment(html: string): PageEnvironment {
  return evaluateDetection(html, FXSTREET_DETECTION) as PageEnvironment;
}

export { normalizeInternalPath };
