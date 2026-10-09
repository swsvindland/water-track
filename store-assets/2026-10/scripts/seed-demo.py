"""Seed an empty, isolated iOS capture container only, after app migrations; stop app first."""
import datetime as dt, json, math, sqlite3, sys, uuid
from pathlib import Path
container=Path(sys.argv[1]).resolve()
if 'CoreSimulator/Devices/' not in str(container): raise SystemExit('Capture simulator required.')
p=container/'Documents/SQLite/water-track.db'
if not p.exists(): raise SystemExit('Run app migrations first.')
con=sqlite3.connect(p)
if con.execute('select count(*) from drinks').fetchone()[0]: raise SystemExit('Refusing existing drinks.')
now=dt.datetime.now()
favs=[{'id':'water','kind':'water','name':'','ml':250,'caffeine':0,'abv':0},{'id':'drip-coffee','kind':'coffee','name':'Drip coffee','ml':240,'caffeine':95,'abv':0},{'id':'jasmine-tea','kind':'tea','name':'Jasmine tea','ml':240,'caffeine':30,'abv':0},{'id':'sparkling-water','kind':'water','name':'Sparkling water','ml':355,'caffeine':0,'abv':0}]
with con:
 con.execute("update preferences set language='en',appearance='light',units='metric',goal_ml=2500,default_ml=250,quick_ml=250,favorites=?,bac_enabled=0,health_enabled=0,reminders_enabled=0 where id=1",(json.dumps(favs),))
 for days in range(28):
  day=(now-dt.timedelta(days=days)).replace(hour=7,minute=0,second=0,microsecond=0)
  for index in range(7 if days else 5):
   when=day+dt.timedelta(minutes=index*60)
   if when>now: continue
   f=favs[1 if index==1 else 2 if index==4 else 0]
   volume=f['ml'] if f['kind']!='water' else (350 if index%2==0 else 250)
   time=int(when.timestamp()*1000)
   con.execute('insert into drinks(id,kind,name,volume_ml,caffeine_mg,abv,consumed_at,updated_at,revision,deleted,synced_revision) values(?,?,?,?,?,0,?,?,1,0,0)',(str(uuid.uuid4()),f['kind'],f['name'],volume,f['caffeine'],time,time))
con.close()
print('Seeded fictional intake history. Sync, BAC and notifications disabled.')
