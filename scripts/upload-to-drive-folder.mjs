/**
 * Upload files to an open Google Drive folder via Playwright file chooser.
 * Usage: node upload-to-drive-folder.mjs <folderUrl> <file1> [file2...]
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages/shared/package.json"),
);
const { chromium } = require("playwright");

const folderUrl = process.argv[2];
const files = process.argv.slice(3);
if (!folderUrl || !files.length) {
  console.error("Usage: node upload-to-drive-folder.mjs <folderUrl> <file...>");
  process.exit(1);
}

const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext();
context.setDefaultTimeout(180_000);
const page = await context.newPage();
page.setDefaultTimeout(180_000);

console.log("Abre sesión Google si hace falta, luego sube archivos…");
await page.goto(folderUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });

// Wait until logged in (folder title visible, not sign-in)
await page.waitForFunction(
  () =>
    document.title.includes("Google Drive") &&
    !location.href.includes("accounts.google.com"),
  { timeout: 180_000 },
);

await page.getByRole("button", { name: "New", exact: true }).click();
const chooserPromise = page.waitForEvent("filechooser", { timeout: 30_000 });
await page.getByRole("menuitem", { name: /File upload/i }).click();
const chooser = await chooserPromise;
await chooser.setFiles(files);
console.log(`Subiendo ${files.length} archivo(s)…`);

await page.waitForTimeout(5000);
for (const name of files.map((f) => f.split(/[\\/]/).pop())) {
  await page.getByText(name, { exact: false }).first().waitFor({
    timeout: 120_000,
  });
  console.log(`✓ ${name}`);
}

await browser.close();
