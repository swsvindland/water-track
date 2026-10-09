"""Save one verified iOS screen. Navigate in Simulator first; deep links can show OS prompts.
Usage: python3 capture-ios.py SIMULATOR_UDID SCREEN_FILENAME_WITHOUT_EXTENSION
Screen names are listed in listing.json. Review the resulting PNG before rendering.
"""
from pathlib import Path
import subprocess, json, sys
out = Path(__file__).resolve().parents[1]
if len(sys.argv) != 3:
    raise SystemExit(__doc__)
device, screen = sys.argv[1:]
allowed = {s["file"] for s in json.loads((out / "listing.json").read_text())["screenshotCaptions"]}
if screen not in allowed:
    raise SystemExit("Choose a screen from listing.json: " + ", ".join(sorted(allowed)))
raw = out / "raw/ios"
raw.mkdir(parents=True, exist_ok=True)
subprocess.run(["xcrun", "simctl", "io", device, "screenshot", str(raw / (screen + ".png"))], check=True)
