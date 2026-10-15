import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const filePath = process.argv[2];
const chunkSize = Number(process.argv[3] || 60000);
const outDir = process.argv[4] || path.join(process.env.TEMP || "/tmp", "drive-chunk-files-sm");

if (!filePath) {
  console.error("Usage: node drive-chunk-split.mjs <file> [chunkSize] [outDir]");
  process.exit(1);
}

const b64 = readFileSync(filePath).toString("base64");
mkdirSync(outDir, { recursive: true });
const chunks = [];
for (let i = 0; i < b64.length; i += chunkSize) {
  chunks.push(b64.slice(i, i + chunkSize));
}
chunks.forEach((c, i) => writeFileSync(path.join(outDir, `c${i}.json`), JSON.stringify(c)));
console.log(outDir, chunks.length);
