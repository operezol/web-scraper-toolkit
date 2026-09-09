export type ArticleMatchMode =
  | "slug-after-section"
  | "min-slug-depth"
  | "path-regex";

export interface ArticlePathRule {
  /** Path segment name, e.g. "news" | "analysis" | "blog" */
  section: string;
  match: ArticleMatchMode;
  /** Segments under section that are never treated as articles */
  allowSegments?: string[];
  /** For min-slug-depth: minimum number of segments after section */
  minDepth?: number;
  /** For path-regex: RegExp source matched against pathname */
  pattern?: string;
}

/**
 * Returns true if pathname looks like an article/detail URL under the rules.
 * Landings that end at `{section}` are never articles.
 */
export function isArticlePath(
  pathname: string,
  rules: ArticlePathRule[],
): boolean {
  if (!rules.length) return false;
  const parts = pathname.split("/").filter(Boolean);

  for (const rule of rules) {
    if (matchesRule(parts, pathname, rule)) return true;
  }
  return false;
}

function matchesRule(
  parts: string[],
  pathname: string,
  rule: ArticlePathRule,
): boolean {
  const allow = new Set(rule.allowSegments ?? []);

  if (rule.match === "path-regex") {
    if (!rule.pattern) return false;
    return new RegExp(rule.pattern).test(pathname);
  }

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== rule.section) continue;
    const after = parts.slice(i + 1);

    if (rule.match === "slug-after-section") {
      if (after.length === 0) continue;
      if (allow.has(after[0])) continue;
      return true;
    }

    if (rule.match === "min-slug-depth") {
      const min = rule.minDepth ?? 1;
      if (after.length >= min && !allow.has(after[0])) return true;
    }
  }

  return false;
}
