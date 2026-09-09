import * as cheerio from "cheerio";

export type DetectionRuleType =
  | "selectorExists"
  | "selectorCountMin"
  | "metaContentContains"
  | "anyScriptSrcContains";

export interface DetectionRule {
  type: DetectionRuleType;
  selector?: string;
  min?: number;
  name?: string;
  substring?: string;
  caseInsensitive?: boolean;
}

export interface DetectionDefinition {
  label: string;
  rules: DetectionRule[];
  /** How to combine rules inside this definition. Default "or". */
  combine?: "and" | "or";
}

export interface DetectionConfig {
  definitions: DetectionDefinition[];
  policy?: "exclusive-first-match" | "multi-hit-conflict";
  fallbackLabel?: string;
  conflictLabel?: string;
}

/**
 * Evaluate declarative HTML detection rules → label string.
 */
export function evaluateDetection(
  html: string,
  config: DetectionConfig,
): string {
  const $ = cheerio.load(html);
  const policy = config.policy ?? "multi-hit-conflict";
  const fallback = config.fallbackLabel ?? "unknown";
  const conflict = config.conflictLabel ?? "conflict";

  const hits: string[] = [];
  for (const def of config.definitions) {
    if (definitionMatches($, def)) {
      hits.push(def.label);
      if (policy === "exclusive-first-match") break;
    }
  }

  if (hits.length === 0) return fallback;
  if (hits.length === 1) return hits[0];
  if (policy === "exclusive-first-match") return hits[0];
  return conflict;
}

function definitionMatches(
  $: cheerio.CheerioAPI,
  def: DetectionDefinition,
): boolean {
  const combine = def.combine ?? "or";
  if (def.rules.length === 0) return false;

  if (combine === "and") {
    return def.rules.every((r) => ruleMatches($, r));
  }
  return def.rules.some((r) => ruleMatches($, r));
}

function ruleMatches($: cheerio.CheerioAPI, rule: DetectionRule): boolean {
  switch (rule.type) {
    case "selectorExists": {
      if (!rule.selector) return false;
      return $(rule.selector).length > 0;
    }
    case "selectorCountMin": {
      if (!rule.selector) return false;
      return $(rule.selector).length >= (rule.min ?? 1);
    }
    case "metaContentContains": {
      const name = rule.name ?? "";
      const needle = rule.substring ?? "";
      const content =
        $(`meta[name="${name}"]`).attr("content") ??
        $(`meta[name="${name.toLowerCase()}"]`).attr("content") ??
        "";
      if (rule.caseInsensitive) {
        return content.toLowerCase().includes(needle.toLowerCase());
      }
      return content.includes(needle);
    }
    case "anyScriptSrcContains": {
      const needle = rule.substring ?? "";
      const ci = rule.caseInsensitive ?? false;
      let found = false;
      $("script[src]").each((_, el) => {
        const src = $(el).attr("src") ?? "";
        if (ci ? src.toLowerCase().includes(needle.toLowerCase()) : src.includes(needle)) {
          found = true;
        }
      });
      return found;
    }
    default:
      return false;
  }
}
