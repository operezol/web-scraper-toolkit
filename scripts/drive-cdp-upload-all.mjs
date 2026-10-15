/**
 * Upload file to Drive via browser CDP chunk expressions.
 * Reads e*.js from chunk dir, prints progress JSON lines for agent to execute.
 * Usage: node drive-cdp-upload-all.mjs <chunkDir> [finalizePath]
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const chunkDir = process.argv[2];
const finalizePath =
  process.argv[3] ||
  path.join(process.env.TEMP || "/tmp", "drive-chunks.json");

if (!chunkDir) {
  console.error("Usage: node drive-cdp-upload-all.mjs <chunkDir> [finalizeJson]");
  process.exit(1);
}

const init = `window.__fxsUpload={b64:'',name:"anexo-2026-09-21-locales.zip",mime:"application/zip",folder:"1l6fphCJaJptWWROoBLDs9Qhsb5RfjDlt"}; 'init';`;

const exprFiles = readdirSync(chunkDir)
  .filter((f) => /^e\d+\.js$/.test(f))
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

let finalize;
try {
  const plan = JSON.parse(readFileSync(finalizePath, "utf8"));
  finalize = plan.finalize;
} catch {
  finalize = readFileSync(
    path.join(process.env.TEMP || "/tmp", "finalize.js"),
    "utf8",
  );
}

const steps = [
  { step: "init", expr: init },
  ...exprFiles.map((f, i) => ({
    step: `chunk-${i}`,
    expr: readFileSync(path.join(chunkDir, f), "utf8"),
  })),
  { step: "finalize", expr: finalize },
];

console.log(JSON.stringify({ total: steps.length, steps: steps.map((s) => s.step) }));
