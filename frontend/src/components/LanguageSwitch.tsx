import React from "react";
import { SITE_LANGS, useSiteLang, type SiteLang } from "../i18n/site";

// Site-wide language picker; the choice translates every page and persists across pages and refresh
export const LanguageSwitch: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [lang, setLang] = useSiteLang();
  return (
    <label translate="no" className={`notranslate relative inline-flex items-center ${className}`}>
      <span className="sr-only">Language / भाषा</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 size-3.5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as SiteLang)}
        className="min-h-9 appearance-none bg-slate-100 border border-slate-200 rounded-full pl-7 pr-7 text-xs font-semibold text-slate-800 hover:bg-slate-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-black"
      >
        {SITE_LANGS.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.code === "en" ? l.native : `${l.native} · ${l.english}`}
          </option>
        ))}
      </select>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 size-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
};
