"""Save one visually verified Android screen from an isolated capture emulator.
Usage: python3 capture-android.py emulator-SERIAL FILENAME-STEM
Open the desired route and verify it has fully loaded before using this script.
"""
from pathlib import Path
import subprocess, json, sys
out = Path(__file__).resolve().parents[1]
if len(sys.argv) != 3:
    raise SystemExit("Usage: capture-android.py emulator-SERIAL FILENAME-STEM")
serial, stem = sys.argv[1:]
if not serial.startswith("emulator-"):
    raise SystemExit("Use an isolated emulator.")
allowed = {item["file"] for item in json.loads((out / "listing.json").read_text())["screenshotCaptions"]}
if stem not in allowed:
    raise SystemExit("Choose a filename stem from listing.json.")
adb = str(Path.home() / "Library/Android/sdk/platform-tools/adb")
result = subprocess.run([adb, "-s", serial, "exec-out", "screencap", "-p"], check=True, capture_output=True)
if not result.stdout.startswith(b"\x89PNG\r\n\x1a\n"):
    raise SystemExit("The emulator did not return a PNG.")
raw = out / "raw/android"
raw.mkdir(parents=True, exist_ok=True)
(raw / (stem + ".png")).write_bytes(result.stdout)
print(stem + ".png — visually inspect before rendering")
