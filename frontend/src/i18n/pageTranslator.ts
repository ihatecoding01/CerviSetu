// Translates rendered text in place: every text node and label attribute whose English text is in the
// active dictionary. Originals are remembered so switching back (or to another language) is lossless,
// and React updates to a node are picked up as new source text.
import { useEffect, useState } from "react";
import { getSiteLang, loadDictionary, onSiteLang, type SiteLang } from "./site";

const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "SVG"]);

let dict: Record<string, string> = {};
let patterns: { re: RegExp; names: string[]; out: string }[] = [];
const textSource = new WeakMap<Text, string>();
const textWritten = new WeakMap<Text, string>();
const attrSource = new WeakMap<Element, Record<string, string>>();
const attrWritten = new WeakMap<Element, Record<string, string>>();

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildPatterns() {
  // Entries with {name} placeholders match text whose variable parts differ (counts, dates, names)
  patterns = Object.entries(dict)
    .filter(([k]) => /\{\w+\}/.test(k))
    .map(([k, out]) => {
      const names: string[] = [];
      const body = k.split(/(\{\w+\})/).map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return escapeRe(part);
        names.push(m[1]);
        return "(.+?)";
      });
      return { re: new RegExp(`^${body.join("")}$`), names, out };
    });
}

function lookup(source: string): string | null {
  const key = norm(source);
  if (!key) return null;
  const hit = dict[key];
  if (hit) return hit;
  // "Label:" and "Label" share one entry
  if (key.endsWith(":") && dict[key.slice(0, -1).trim()]) return dict[key.slice(0, -1).trim()] + ":";
  for (const p of patterns) {
    const m = p.re.exec(key);
    if (m) return p.names.reduce((s, n, i) => s.split(`{${n}}`).join(m[i + 1]), p.out);
  }
  return null;
}

function translated(source: string): string {
  const tr = lookup(source);
  if (tr === null) return source;
  const lead = source.match(/^\s*/)![0];
  const trail = source.match(/\s*$/)![0];
  return lead + tr + trail;
}

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName.toUpperCase())) return true;
    if (e.getAttribute("translate") === "no" || e.classList.contains("notranslate")) return true;
  }
  return false;
}

function doText(node: Text) {
  if (skipped(node.parentElement)) return;
  const written = textWritten.get(node);
  if (written === undefined || node.data !== written) textSource.set(node, node.data); // new source from React
  const source = textSource.get(node)!;
  const next = translated(source);
  if (node.data !== next) node.data = next;
  textWritten.set(node, next);
}

function doAttrs(el: Element) {
  if (skipped(el)) return;
  const src = attrSource.get(el) ?? {};
  const wrote = attrWritten.get(el) ?? {};
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur === null) continue;
    if (wrote[a] === undefined || cur !== wrote[a]) src[a] = cur;
    const next = translated(src[a]);
    if (cur !== next) el.setAttribute(a, next);
    wrote[a] = next;
  }
  attrSource.set(el, src);
  attrWritten.set(el, wrote);
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  doAttrs(root as Element);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else doAttrs(n as Element);
  }
}

let observer: MutationObserver | null = null;
let applying = false;

function apply() {
  applying = true;
  try {
    walk(document.body);
  } finally {
    observer?.takeRecords();
    applying = false;
  }
}

const dictListeners = new Set<() => void>();

async function switchTo(lang: SiteLang) {
  dict = await loadDictionary(lang);
  buildPatterns();
  apply();
  dictListeners.forEach((fn) => fn());
}

// For text a component splits up itself (e.g. word-by-word animation): translate it before splitting,
// and mark the rendered pieces translate="no"
export function useTranslatedText(text: string): string {
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    dictListeners.add(fn);
    return () => {
      dictListeners.delete(fn);
    };
  }, []);
  return lookup(text) ?? text;
}

export function startPageTranslator() {
  observer = new MutationObserver((records) => {
    if (applying) return;
    applying = true;
    try {
      for (const r of records) {
        if (r.type === "characterData") doText(r.target as Text);
        else if (r.type === "attributes") doAttrs(r.target as Element);
        else r.addedNodes.forEach(walk);
      }
    } finally {
      observer!.takeRecords();
      applying = false;
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });
  onSiteLang((l) => void switchTo(l));
  document.documentElement.lang = getSiteLang();
  void switchTo(getSiteLang());
}
