// Site-wide language: one choice translates every page. Strings come from reviewed static dictionaries
// in ./site/*.json (English source text -> translation); nothing is sent to a translation service.
import { useEffect, useState } from "react";
import { setLang as setPatientLang } from "./patient";

export type SiteLang = "en" | "hi" | "bho" | "bn" | "mr" | "ta" | "te";

export const SITE_LANGS: { code: SiteLang; native: string; english: string; dialect: string }[] = [
  { code: "en", native: "English", english: "English", dialect: "" },
  { code: "hi", native: "हिंदी", english: "Hindi", dialect: "HINDI" },
  { code: "bho", native: "भोजपुरी", english: "Bhojpuri", dialect: "BHOJPURI" },
  { code: "bn", native: "বাংলা", english: "Bengali", dialect: "BENGALI" },
  { code: "mr", native: "मराठी", english: "Marathi", dialect: "MARATHI" },
  { code: "ta", native: "தமிழ்", english: "Tamil", dialect: "TAMIL" },
  { code: "te", native: "తెలుగు", english: "Telugu", dialect: "TELUGU" },
];

const STORAGE_KEY = "cervisetu_site_lang";
const loaders = import.meta.glob<{ default: Record<string, string> }>("./site/*.json");

function readLang(): SiteLang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (SITE_LANGS.some((l) => l.code === v)) return v as SiteLang;
  } catch {
    // storage unavailable (private mode)
  }
  return "en";
}

let current: SiteLang = readLang();
const listeners = new Set<(l: SiteLang) => void>();

export function getSiteLang(): SiteLang {
  return current;
}

export function setSiteLang(lang: SiteLang) {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  // Patient screens have hand-written Hindi copy; every other language goes through the page translator
  setPatientLang(lang === "hi" ? "hi" : "en");
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function onSiteLang(fn: (l: SiteLang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSiteLang(): [SiteLang, (l: SiteLang) => void] {
  const [lang, set] = useState<SiteLang>(current);
  useEffect(() => onSiteLang(set), []);
  return [lang, setSiteLang];
}

export async function loadDictionary(lang: SiteLang): Promise<Record<string, string>> {
  if (lang === "en") return {};
  const load = loaders[`./site/${lang}.json`];
  return load ? (await load()).default : {};
}
