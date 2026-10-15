import { readFileSync, writeFileSync } from "node:fs";

const items = JSON.parse(
  readFileSync(
    "c:/Users/oriol/source/repos/spanish-site-translation-plan/locales/_work/en-unique.json",
    "utf8",
  ),
);
const short = items.filter((s) => s.length <= 140);
const long = items.filter((s) => s.length > 140);
writeFileSync(
  "c:/Users/oriol/source/repos/spanish-site-translation-plan/locales/_work/en-short.json",
  JSON.stringify(short, null, 2),
);
writeFileSync(
  "c:/Users/oriol/source/repos/spanish-site-translation-plan/locales/_work/en-long.json",
  JSON.stringify(long, null, 2),
);
console.log("short", short.length, "long", long.length);
