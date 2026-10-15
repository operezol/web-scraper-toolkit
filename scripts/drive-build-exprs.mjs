import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node drive-build-exprs.mjs <chunkDir>");
  process.exit(1);
}

const jsonFiles = readdirSync(dir)
  .filter((f) => /^c\d+\.json$/.test(f))
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

for (const file of jsonFiles) {
  const i = file.slice(1, -5);
  const chunk = readFileSync(path.join(dir, file), "utf8");
  writeFileSync(path.join(dir, `e${i}.js`), `{window.__fxsUpload.b64+=${chunk}; "chunk-${i}";}`);
}

console.log(jsonFiles.length);
