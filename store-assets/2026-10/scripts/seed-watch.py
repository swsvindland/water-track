"""Seed a fresh, isolated Watch simulator with the fictional iPhone capture state.
Usage: python3 seed-watch.py WATCH_UDID /absolute/iPhone/capture/container
This verifies the Watch app has no saved state before writing. It does not test WatchConnectivity.
"""
import datetime as dt, json, pathlib, sqlite3, subprocess, sys
watch, phone = sys.argv[1:]
phone = pathlib.Path(phone).resolve()
if "CoreSimulator/Devices/" not in str(phone): raise SystemExit("Capture simulator required.")
bundle = "dev.svindland.vector.water.watchkitapp"
def sim(*args, **kw): return subprocess.run(["xcrun", "simctl", *args], **kw)
existing = sim("spawn",watch,"defaults","read",bundle,"state",capture_output=True)
if existing.returncode == 0: raise SystemExit("Refusing existing Watch state.")
con = sqlite3.connect(phone / "Documents/SQLite/water-track.db")
con.row_factory = sqlite3.Row
prefs = dict(con.execute("select * from preferences where id=1").fetchone())
now = dt.datetime.now()
day = int(now.replace(hour=0,minute=0,second=0,microsecond=0).timestamp()*1000)
rows = [dict(r) for r in con.execute("select * from drinks where consumed_at>=? and consumed_at<?",(day,day+86400000))]
favorites = []
for f in json.loads(prefs["favorites"]):
    ml=prefs["quick_ml"] or prefs["default_ml"]
    favorites.append(dict(id=f["id"],kind=f["kind"],title=f["name"] or "Water",name=f["name"],color="cyan",volumeMl=ml,caffeineMg=f["caffeine"]*ml/f["ml"],abv=f["abv"]))
en=json.loads((pathlib.Path(__file__).resolve().parents[3]/"src/lib/locales/en.json").read_text())
state=dict(day=day,totalMl=sum(r["volume_ml"] for r in rows if not r["deleted"] and r["abv"]==0),goalMl=prefs["goal_ml"],sizeMl=prefs["quick_ml"],units=prefs["units"],locale="en-US",ids=[r["id"] for r in rows],favorites=favorites,text=dict(logged=en["logged"],undo=en["undo"],empty=en["favoriteEmpty"],addDrink=en["addDrink"]))
sim("spawn",watch,"defaults","write",bundle,"state","-string",json.dumps(state),check=True)
print("Seeded fictional cached Watch state; no health data or accounts used.")
