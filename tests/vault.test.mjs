// Vector Vault test entry, ESM twin of vault.test.cjs (synced, hash-checked; water runs it through
// `TZ=America/New_York node --experimental-strip-types --test tests/*.test.mjs`). The test bodies are CommonJS in
// every repo (tests/vault/<area>.cjs), so this entry loads them with createRequire.
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const load = createRequire(import.meta.url);
const areas = fileURLToPath(new URL("./vault/", import.meta.url));
for (const file of readdirSync(areas)
  .filter((f) => f.endsWith(".cjs"))
  .sort())
  load(`${areas}${file}`);
