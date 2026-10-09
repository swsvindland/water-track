"""Copy fictional fixtures from this task's iOS capture container to an EMPTY Android emulator app.
Usage: python3 seed-android-from-ios.py emulator-SERIAL /absolute/CoreSimulator/.../Application/CONTAINER
Run app migrations first. Refuses nonempty tracking records; never targets a physical Android device.
"""
import pathlib, subprocess, sqlite3, sys, tempfile
root = pathlib.Path(__file__).resolve().parents[3]
body = root.name == "body-track"
serial, container = sys.argv[1:]
container = pathlib.Path(container).resolve()
if not serial.startswith("emulator-") or "CoreSimulator/Devices/" not in str(container):
    raise SystemExit("Only the isolated capture simulators are supported.")
package = "dev.svindland.vector." + ("body" if body else "water")
name = "body_track.db" if body else "water-track.db"
adb = str(pathlib.Path.home() / "Library/Android/sdk/platform-tools/adb")
def run(*args, **kwargs):
    return subprocess.run([adb, "-s", serial, *args], check=True, **kwargs)
run("shell", "am", "force-stop", package)
with tempfile.TemporaryDirectory(prefix="pendum-fixture-") as temp:
    target = pathlib.Path(temp) / name
    target.write_bytes(run("exec-out", "run-as", package, "cat", "files/SQLite/" + name, capture_output=True).stdout)
    # WAL may hold migrations and records that are not yet in the main file after force-stop.
    for suffix in ("-wal", "-shm"):
        sidecar = subprocess.run([adb, "-s", serial, "exec-out", "run-as", package, "cat", "files/SQLite/" + name + suffix], capture_output=True)
        if sidecar.returncode == 0:
            pathlib.Path(str(target) + suffix).write_bytes(sidecar.stdout)
    db = sqlite3.connect(target)
    for table in (("weight_entries", "measurements", "photos") if body else ("drinks",)):
        if db.execute(f"select count(*) from {table}").fetchone()[0]:
            raise SystemExit("Refusing to overwrite existing tracking records.")
    db.close()
    fixture = pathlib.Path(temp) / "fixture.db"
    original = sqlite3.connect(container / "Documents/SQLite" / name)
    copy = sqlite3.connect(fixture)
    original.backup(copy)
    copy.close()
    original.close()
    run("shell", "run-as", package, "sh", "-c", '"cat > files/SQLite/' + name + '"', input=fixture.read_bytes())
    run("shell", "run-as", package, "rm", "-f", "files/SQLite/" + name + "-wal", "files/SQLite/" + name + "-shm")
    if body:
        run("shell", "run-as", package, "mkdir", "-p", "files/progress-photos")
        for photo in (container / "Documents/progress-photos").glob("*.png"):
            run("shell", "run-as", package, "sh", "-c", '"cat > files/progress-photos/' + photo.name + '"', input=photo.read_bytes())
print("Copied fictional capture fixtures. App remains stopped; launch with its local preview server.")
