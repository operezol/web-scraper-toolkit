/**
 * Upload a local file to a Drive folder using the authenticated MCP browser page.
 * Reads file as base64 and posts via clients6.google.com (cookie auth).
 *
 * Usage: node drive-upload-via-cdp.mjs <folderId> <localFile>
 * Requires: run from agent with browser_cdp access — prints JS for manual CDP evaluate.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const folderId = process.argv[2];
const filePath = process.argv[3];
if (!folderId || !filePath) {
  console.error("Usage: node drive-upload-via-cdp.mjs <folderId> <localFile>");
  process.exit(1);
}

const name = path.basename(filePath);
const b64 = readFileSync(filePath).toString("base64");
const mime =
  name.endsWith(".zip")
    ? "application/zip"
    : name.endsWith(".csv")
      ? "text/csv"
      : name.endsWith(".md")
        ? "text/markdown"
        : "application/octet-stream";

const js = `
(async () => {
  const b64 = ${JSON.stringify(b64)};
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bin], { type: ${JSON.stringify(mime)} });
  const meta = {
    name: ${JSON.stringify(name)},
    mimeType: ${JSON.stringify(mime)},
    parents: [${JSON.stringify(folderId)}],
  };
  const boundary = "-------fxs" + Date.now();
  const body =
    "--" + boundary + "\\r\\n" +
    "Content-Type: application/json; charset=UTF-8\\r\\n\\r\\n" +
    JSON.stringify(meta) + "\\r\\n" +
    "--" + boundary + "\\r\\n" +
    "Content-Type: " + ${JSON.stringify(mime)} + "\\r\\n\\r\\n";
  const tail = "\\r\\n--" + boundary + "--";
  const enc = new TextEncoder();
  const head = enc.encode(body);
  const foot = enc.encode(tail);
  const merged = new Uint8Array(head.length + bin.length + foot.length);
  merged.set(head, 0);
  merged.set(bin, head.length);
  merged.set(foot, head.length + bin.length);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "multipart/related; boundary=" + boundary,
        "X-Goog-AuthUser": "0",
      },
      body: merged,
    },
  );
  const text = await res.text();
  return res.status + " " + text.slice(0, 500);
})()
`;

const out = path.join(tmpdir(), "drive-upload-expr.js");
writeFileSync(out, js, "utf8");
console.log(out, js.length);
