// Builds src/i18n/site/<lang>.json from scripts/tr/<lang>.*.txt, whose lines are "index|translation"
// against the English source list in scripts/tr/source.json.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "tr");
const out = path.resolve(import.meta.dirname, "../src/i18n/site");
const source = JSON.parse(fs.readFileSync(path.join(dir, "source.json"), "utf8"));
fs.mkdirSync(out, { recursive: true });

const byLang = {};
for (const f of fs.readdirSync(dir).filter((f) => /^[a-z]+\.\d+\.txt$/.test(f)).sort()) {
  const lang = f.split(".")[0];
  const dict = (byLang[lang] ??= {});
  for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
    const m = /^(\d+)\|(.+)$/.exec(line.trim());
    if (!m) continue;
    const en = source[+m[1]];
    if (en === undefined) throw new Error(`${f}: index ${m[1]} out of range`);
    dict[en] = m[2].trim();
  }
}
// <lang>.tail files hold one translation per line, in the order of the indices listed in hi.4 + hi.5
const tailIdx = ["hi.4.txt", "hi.5.txt"].flatMap((f) =>
  [...fs.readFileSync(path.join(dir, f), "utf8").matchAll(/^(\d+)\|/gm)].map((m) => +m[1]),
);
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".tail"))) {
  const lang = f.split(".")[0];
  const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter((l) => l.trim());
  if (lines.length !== tailIdx.length) throw new Error(`${f}: ${lines.length} lines, expected ${tailIdx.length}`);
  const dict = (byLang[lang] ??= {});
  lines.forEach((l, i) => (dict[source[tailIdx[i]]] = l.trim()));
}
for (const [lang, dict] of Object.entries(byLang)) {
  fs.writeFileSync(path.join(out, `${lang}.json`), JSON.stringify(dict, null, 1) + "\n");
  console.log(lang, Object.keys(dict).length, "strings");
}
