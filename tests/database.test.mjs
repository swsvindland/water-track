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
