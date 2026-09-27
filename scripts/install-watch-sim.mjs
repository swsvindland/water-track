// `expo run:ios` installs only on the iPhone simulator, and simulators never copy the embedded
// watch app across to the paired watch. This installs the most recently built watch app onto
// the watch paired with the booted iPhone simulator, then launches it.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;

function simctl(...args) {
  return execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8" });
}

function productDirs() {
  const dirs = [join(root, "ios/build/dd/Build/Products")];
  const derived = join(homedir(), "Library/Developer/Xcode/DerivedData");
  if (existsSync(derived)) {
    for (const name of readdirSync(derived)) {
      dirs.push(join(derived, name, "Build/Products"));
    }
  }
  return dirs.flatMap((dir) =>
    ["Debug-iphonesimulator", "Release-iphonesimulator"].map((config) => join(dir, config))
  );
}

function findWatchApp() {
  const candidates = [];
  for (const dir of productDirs()) {
    if (!existsSync(dir)) continue;
    for (const app of readdirSync(dir).filter((name) => name.endsWith(".app"))) {
      const watchDir = join(dir, app, "Watch");
      if (!existsSync(watchDir)) continue;
      for (const watchApp of readdirSync(watchDir).filter((name) => name.endsWith(".app"))) {
        const path = join(watchDir, watchApp);
        candidates.push({ path, mtime: statSync(path).mtimeMs });
      }
    }
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.path;
}

const pairs = Object.values(JSON.parse(simctl("list", "pairs", "--json")).pairs);
const pair = pairs.find((p) => p.phone.state === "Booted");
if (!pair) {
  console.error("No booted iPhone simulator with a paired watch. Run `pnpm ios` first.");
  process.exit(1);
}

const watchApp = findWatchApp();
if (!watchApp) {
  console.error("No built watch app found. Run `pnpm ios` first.");
  process.exit(1);
}

const { watch } = pair;
if (watch.state !== "Booted") {
  console.log(`Booting ${watch.name}…`);
  simctl("boot", watch.udid);
}
try {
  execFileSync("open", ["-b", "com.apple.iphonesimulator"], { stdio: "ignore" });
} catch {
  // The watch still gets the app; it just won't be brought to the front.
}

const bundleId = execFileSync(
  "plutil",
  ["-extract", "CFBundleIdentifier", "raw", join(watchApp, "Info.plist")],
  { encoding: "utf8" }
).trim();

console.log(`Installing ${bundleId} on ${watch.name}…`);
simctl("install", watch.udid, watchApp);
simctl("launch", watch.udid, bundleId);
console.log("Watch app launched.");
