import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
test("migrations preserve the legacy counter and support drink revisions and tombstones", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(new URL("../drizzle/0000_fresh_doctor_faustus.sql", import.meta.url), "utf8")
  );
  db.exec("INSERT INTO counters VALUES (1, 7)");
  db.exec(
    readFileSync(new URL("../drizzle/0001_serious_vin_gonzales.sql", import.meta.url), "utf8")
  );
  assert.equal(db.prepare("SELECT value FROM counters").get().value, 7);
  db.exec(
    "INSERT INTO drinks (id,kind,volume_ml,consumed_at,updated_at) VALUES ('one','water',250,1000,1000)"
  );
  assert.equal(
    db.prepare("SELECT SUM(volume_ml) AS total FROM drinks WHERE deleted = 0").get().total,
    250
  );
  db.exec("UPDATE drinks SET volume_ml=500,revision=2 WHERE id='one'");
  // A sync of revision 1 must not acknowledge the edit at revision 2.
  db.exec("UPDATE drinks SET synced_revision=1 WHERE id='one' AND revision=1");
  assert.equal(db.prepare("SELECT synced_revision FROM drinks").get().synced_revision, 0);
  db.exec("UPDATE drinks SET deleted=1, revision=3 WHERE id='one'");
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM drinks WHERE deleted=0").get().total, 0);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS total FROM drinks WHERE synced_revision != revision").get()
      .total,
    1
  );
  db.close();
});

test("quick logging migration preserves records and persists favorites and selected size", () => {
  const db = new DatabaseSync(":memory:");
  for (const file of ["0000_fresh_doctor_faustus", "0001_serious_vin_gonzales"]) {
    db.exec(readFileSync(new URL(`../drizzle/${file}.sql`, import.meta.url), "utf8"));
  }
  db.exec(`INSERT INTO preferences (id,language,units,presets) VALUES (1,'en','metric','[250,500]');
    INSERT INTO drinks (id,kind,volume_ml,consumed_at,updated_at) VALUES ('old','water',250,1000,1000);`);
  db.exec(readFileSync(new URL("../drizzle/0002_past_jane_foster.sql", import.meta.url), "utf8"));
  const prefs = db.prepare("SELECT * FROM preferences").get();
  assert.equal(prefs.quick_ml, null);
  assert.equal(prefs.default_ml, 250);
  assert.equal(JSON.parse(prefs.favorites).length, 4);
  assert.equal(db.prepare("SELECT volume_ml FROM drinks WHERE id='old'").get().volume_ml, 250);
  db.exec("UPDATE preferences SET quick_ml=500 WHERE id=1");
  db.exec(`INSERT INTO drinks (id,kind,name,volume_ml,caffeine_mg,consumed_at,updated_at)
    VALUES ('quick','energy','Monster',500,169.13,2000,2000)`);
  assert.equal(db.prepare("SELECT quick_ml FROM preferences").get().quick_ml, 500);
  assert.equal(db.prepare("SELECT name FROM drinks WHERE id='quick'").get().name, "Monster");
  db.exec("UPDATE drinks SET deleted=1,revision=revision+1 WHERE id='quick'");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM drinks WHERE deleted=0").get().n, 1);
  assert.equal(db.prepare("SELECT quick_ml FROM preferences").get().quick_ml, 500);
  db.close();
});

test("appearance migration defaults to system and preserves existing preferences", () => {
  const db = new DatabaseSync(":memory:");
  for (const file of [
    "0000_fresh_doctor_faustus",
    "0001_serious_vin_gonzales",
    "0002_past_jane_foster",
  ]) {
    db.exec(readFileSync(new URL(`../drizzle/${file}.sql`, import.meta.url), "utf8"));
  }
  db.exec("INSERT INTO preferences (id,language,units,presets) VALUES (1,'es','us','[250,500]')");
  db.exec(readFileSync(new URL("../drizzle/0003_sturdy_psylocke.sql", import.meta.url), "utf8"));
  const prefs = db.prepare("SELECT * FROM preferences").get();
  assert.equal(prefs.appearance, "system");
  assert.equal(prefs.language, "es");
  assert.equal(prefs.units, "us");
  for (const appearance of ["light", "dark", "system"]) {
    db.prepare("UPDATE preferences SET appearance=?,language='system' WHERE id=1").run(appearance);
    assert.equal(db.prepare("SELECT appearance FROM preferences").get().appearance, appearance);
  }
  assert.equal(db.prepare("SELECT language FROM preferences").get().language, "system");
  db.close();
});

test("expanded health migration preserves manual weight and queues existing drinks for new exports", () => {
  const db = new DatabaseSync(":memory:");
  for (const file of [
    "0000_fresh_doctor_faustus",
    "0001_serious_vin_gonzales",
    "0002_past_jane_foster",
    "0003_sturdy_psylocke",
  ]) {
    db.exec(readFileSync(new URL(`../drizzle/${file}.sql`, import.meta.url), "utf8"));
  }
  db.exec(
    "INSERT INTO preferences (id,language,units,presets,weight_kg,health_enabled) VALUES (1,'fr','metric','[250]',80,1)"
  );
  db.exec(
    "INSERT INTO drinks (id,kind,volume_ml,consumed_at,updated_at,revision,synced_revision) VALUES ('old','water',250,1000,1000,3,3)"
  );
  db.exec(
    readFileSync(new URL("../drizzle/0004_careful_katie_power.sql", import.meta.url), "utf8")
  );
  const prefs = db.prepare("SELECT * FROM preferences").get();
  assert.equal(prefs.weight_kg, 80);
  assert.equal(prefs.health_weight_kg, null);
  assert.equal(prefs.health_error, null);
  assert.equal(prefs.health_enabled, 1);
  const record = db.prepare("SELECT * FROM drinks").get();
  assert.equal(record.revision, 3);
  assert.equal(record.synced_revision, 0);
  db.close();
});
