import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Compile the same module Metro uses, resolving its JSON dictionaries from src/lib.
const sourceUrl = new URL("../src/lib/i18n.ts", import.meta.url);
const compiled = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const exports = {};
runInNewContext(compiled, { exports, require: createRequire(sourceUrl) });
const { languages, dictionaries, languagePreference, resolveLanguage, translate } = exports;

test("all supported languages contain every translated message", () => {
  assert.deepEqual(Object.keys(languages), [
    "en",
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "nl",
    "sv",
    "ja",
    "ko",
    "zh",
  ]);
  const keys = Object.keys(dictionaries.en).sort();
  for (const language of Object.keys(languages)) {
    assert.deepEqual(Object.keys(dictionaries[language]).sort(), keys, language);
    for (const key of keys) {
      assert.equal(typeof translate(language, key), "string", `${language}.${key}`);
      assert.ok(translate(language, key).trim(), `${language}.${key}`);
    }
  }
});

test("system language follows supported device languages and safely falls back to English", () => {
  for (const language of Object.keys(languages)) {
    assert.equal(resolveLanguage("system", language), language);
    assert.equal(languagePreference(language), language);
    assert.equal(resolveLanguage(language, "en"), language);
    assert.doesNotThrow(() =>
      new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : language).format(new Date())
    );
    assert.doesNotThrow(() => new Intl.NumberFormat(language).format(1234.5));
  }
  for (const value of [undefined, "", "unknown", "toString", "__proto__"]) {
    assert.equal(languagePreference(value), "system");
    assert.equal(resolveLanguage("system", value), "en");
  }
  assert.equal(resolveLanguage("system", null), "en");
  assert.equal(resolveLanguage("fr", "ja"), "fr");
  assert.equal(translate("ja", "water"), "水");
  assert.equal(translate("de", "water"), "Wasser");
});
