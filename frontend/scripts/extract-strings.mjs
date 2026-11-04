// Collects user-visible English strings from the UI source for the site-wide translation dictionaries.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../src");
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (f.name !== "i18n" && f.name !== "icons") walk(p); }
    else if (/\.tsx?$/.test(f.name)) files.push(p);
  }
})(root);

const out = new Set();
const keep = (s) => {
  s = s.replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 400 || !/[A-Za-z]{2}/.test(s)) return;
  if (/^(https?:|\/|\.\/|@|#|data:|var\(|rgb|M\d)/.test(s)) return;
  if (/[{}<>=;]|=>|\$\{/.test(s)) return;
  if (/^[a-z0-9_.\-]+$/.test(s)) return;                       // identifiers, keys
  if (!/[A-Z]/.test(s) && /(^|\s)[a-z0-9]+[-:\/\[][\w\-\[\]\/.:%#]*/.test(s)) return; // tailwind classes
  if (/\[#|^(flex|grid|text-|bg-|border|p[xy]?-|m[xy]?-|w-|h-|gap-|rounded|font-|inline|absolute|relative|hidden|block)/.test(s)) return;
  if (!/[\x00-\x7f]{3}/.test(s) || /^[a-z]+(\.[\w]+)+$/.test(s)) return; // already-native or i18n keys
  if (/^[A-Z0-9_]+$/.test(s) && s.includes("_")) return;     // CONSTANT_IDS
  if (/^[a-z]+[A-Z]\w*$/.test(s)) return;                       // camelCase
  out.add(s);
};
for (const f of files) {
  const src = fs.readFileSync(f, "utf8").replace(/^\s*(import|export \* from).*$/gm, "").replace(/\/\/.*$/gm, "");
  for (const m of src.matchAll(/>([^<>{}]+)</g)) keep(m[1]);
  for (const m of src.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`([^`$\\]*)`/g)) keep(m[1] ?? m[2] ?? m[3]);
}
// Patient copy: English values of the patient dictionary, with {var} placeholders kept for pattern matching
const patient = fs.readFileSync(path.join(root, "i18n/patient.ts"), "utf8");
const enBlock = patient.slice(patient.indexOf("const en = {"), patient.indexOf("};", patient.indexOf("const en = {")));
for (const m of enBlock.matchAll(/:\s*"((?:[^"\\]|\\.)*)"/g)) out.add(m[1].replace(/\s+/g, " ").trim());
const junk = /^(\(|\)|\+|,|\.\.\/|&|\[k|v\.replace|[a-z]{2}-[A-Z]{2}$|PT-|ASHA-0|TKT-|DR-|LEAD-|LINAC-|NURSE-|CASE-|DHM-|UP-RTC-\d|ROOM-|Content-Type|Backspace$|Enter$|Ctrl\+K$)/;
// Append-only: translation files refer to strings by their index in source.json
const file = path.resolve(import.meta.dirname, "tr/source.json");
const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
const known = new Set(list);
const added = [...out].filter((s) => !junk.test(s) && !known.has(s)).sort();
list.push(...added);
fs.writeFileSync(file, JSON.stringify(list, null, 1));
console.log(list.length, "strings,", added.length, "new");
