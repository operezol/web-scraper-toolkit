/**
 * Print chunk count and sizes for chunked Drive upload via browser CDP.
 * Agent should call browser_cdp Runtime.evaluate for each chunk then finalize.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const folderId = process.argv[2];
const filePath = process.argv[3];
const chunkSize = 500_000; // base64 chars per chunk

if (!folderId || !filePath) {
  console.error("Usage: node drive-upload-chunked.mjs <folderId> <file>");
  process.exit(1);
}

const name = path.basename(filePath);
const mime = name.endsWith(".zip")
  ? "application/zip"
  : name.endsWith(".csv")
    ? "text/csv"
    : "application/octet-stream";
const b64 = readFileSync(filePath).toString("base64");
const chunks = [];
for (let i = 0; i < b64.length; i += chunkSize) {
  chunks.push(b64.slice(i, i + chunkSize));
}

const init = `window.__fxsUpload={b64:'',name:${JSON.stringify(name)},mime:${JSON.stringify(mime)},folder:${JSON.stringify(folderId)}}; 'init';`;
const appendExprs = chunks.map(
  (c, i) =>
    `{window.__fxsUpload.b64+=${JSON.stringify(c)}; 'chunk-${i + 1}/${chunks.length}';}`,
);
const finalize = `
(async () => {
  const u = window.__fxsUpload;
  const bin = Uint8Array.from(atob(u.b64), (c) => c.charCodeAt(0));
  const meta = { name: u.name, mimeType: u.mime, parents: [u.folder] };
  const boundary = "-------fxs" + Date.now();
  const head = "--" + boundary + "\\r\\nContent-Type: application/json; charset=UTF-8\\r\\n\\r\\n" +
    JSON.stringify(meta) + "\\r\\n--" + boundary + "\\r\\nContent-Type: " + u.mime + "\\r\\n\\r\\n";
  const tail = "\\r\\n--" + boundary + "--";
  const enc = new TextEncoder();
  const h = enc.encode(head);
  const t = enc.encode(tail);
  const merged = new Uint8Array(h.length + bin.length + t.length);
  merged.set(h, 0);
  merged.set(bin, h.length);
  merged.set(t, h.length + bin.length);
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
  delete window.__fxsUpload;
  return res.status + " " + text.slice(0, 1000);
})()
`;

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const plan = { init, appendExprs, finalize, chunks: chunks.length };
const out = path.join(tmpdir(), "drive-chunks.json");
writeFileSync(out, JSON.stringify(plan), "utf8");
console.log(out, plan.chunks);
