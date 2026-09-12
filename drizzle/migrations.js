// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from "./meta/_journal.json";
import m0000 from "./0000_fresh_doctor_faustus.sql";
import m0001 from "./0001_serious_vin_gonzales.sql";
import m0002 from "./0002_past_jane_foster.sql";
import m0003 from "./0003_sturdy_psylocke.sql";
import m0004 from "./0004_careful_katie_power.sql";
import m0005 from "./0005_slow_garia.sql";
import m0006 from "./0006_bumpy_gauntlet.sql";
import m0007 from "./0007_burly_mindworm.sql";

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
    m0006,
    m0007,
  },
};
