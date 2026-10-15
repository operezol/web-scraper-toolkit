/** HTTP statuses that never enter the 2xx inventory. */
export function isHttpNotFound(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 410;
}

const SOFT_404_TITLE =
  /oops i did it again|oops je l['’]ai encore fait|oh,\s*lo hice otra vez/i;
const SOFT_404_HEADING =
  /error\s*404|erreur\s*404|errore\s*404|fehler\s*404|erro\s*404/i;

function decodeBasicEntities(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * FXStreet custom 404 (title/h1). Used when the CMS answers 200 with the
 * "Oops i did it again / Error 404" template.
 */
export function isSoftNotFoundHtml(html: string): boolean {
  if (!html) return false;
  const title = decodeBasicEntities(
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
  );
  const heading = decodeBasicEntities(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "",
  );
  const haystack = `${title} ${heading}`;
  return SOFT_404_TITLE.test(haystack) || SOFT_404_HEADING.test(haystack);
}

export function classifyFetchedPage(
  statusCode: number,
  html: string,
): { ok: boolean; statusCode: number } {
  if (isHttpNotFound(statusCode) || statusCode < 200 || statusCode >= 300) {
    return { ok: false, statusCode };
  }
  if (isSoftNotFoundHtml(html)) {
    return { ok: false, statusCode: 404 };
  }
  return { ok: true, statusCode };
}
